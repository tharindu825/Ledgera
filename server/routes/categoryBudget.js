const express = require('express');
const auth = require('../middleware/auth');
const Category = require('../models/Category');
const CategoryBudget = require('../models/CategoryBudget');
const Transaction = require('../models/Transaction');
const Bill = require('../models/Bill');
const router = express.Router();

// ─── Helper: compute actual spend per category/subcategory for a month ──────
async function getActualSpend(userId, month, year) {
    const spent = {};
    // spent[mainCategory] = { total: X, subcategories: { sub1: Y, sub2: Z } }

    const initCat = (cat) => {
        if (!spent[cat]) spent[cat] = { total: 0, subcategories: {} };
    };

    // From bills (item-level)
    const bills = await Bill.find({ userId, month, year });
    bills.forEach(bill => {
        bill.items.forEach(item => {
            const cat = item.category || 'other';
            const sub = item.subcategory || 'unassigned';
            initCat(cat);
            spent[cat].total += (item.totalPrice || 0);
            spent[cat].subcategories[sub] = (spent[cat].subcategories[sub] || 0) + (item.totalPrice || 0);
        });
    });

    // From manual transactions (non-bill)
    const txs = await Transaction.find({
        user: userId,
        type: 'expense',
        month,
        year,
        receiptId: null
    });
    txs.forEach(tx => {
        const cat = tx.category || 'other';
        const sub = tx.subcategory || 'unassigned';
        initCat(cat);
        spent[cat].total += (tx.amount || 0);
        spent[cat].subcategories[sub] = (spent[cat].subcategories[sub] || 0) + (tx.amount || 0);
    });

    return spent;
}

// ─── GET /api/category-budget?month=&year= ───────────────────────────────────
router.get('/', auth, async (req, res) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const categories = await Category.find({ user: req.userId, type: 'expense' });
        const overrides = await CategoryBudget.find({ user: req.userId, month, year });
        const actualSpend = await getActualSpend(req.userId, month, year);

        const overrideMap = {};
        // overrideMap['catId'] = limit
        // overrideMap['catId_subName'] = limit
        overrides.forEach(o => { 
            if (o.subcategory) {
                overrideMap[`${o.category.toString()}_${o.subcategory}`] = o.budgetLimit;
            } else {
                overrideMap[o.category.toString()] = o.budgetLimit;
            }
        });

        const enriched = categories.map(cat => {
            const id = cat._id.toString();
            const spendData = actualSpend[cat.mainCategory] || { total: 0, subcategories: {} };
            
            // Main category stats
            const budgetLimit = overrideMap[id] !== undefined ? overrideMap[id] : (cat.monthlyBudget || 0);
            const spent = spendData.total;
            const pct = budgetLimit > 0 ? Math.round((spent / budgetLimit) * 100) : 0;

            // Subcategories stats
            const subSettingsMap = {};
            (cat.subcategorySettings || []).forEach(s => {
                subSettingsMap[s.name] = s;
            });

            const enrichedSubs = (cat.subcategories || []).map(subName => {
                const subId = `${id}_${subName}`;
                const settings = subSettingsMap[subName] || { budgetGroup: 'unassigned', monthlyBudget: 0 };
                const subLimit = overrideMap[subId] !== undefined ? overrideMap[subId] : settings.monthlyBudget;
                const subSpent = spendData.subcategories[subName] || 0;
                const subPct = subLimit > 0 ? Math.round((subSpent / subLimit) * 100) : 0;

                return {
                    name: subName,
                    budgetGroup: settings.budgetGroup,
                    budgetLimit: subLimit,
                    spent: subSpent,
                    pct: subPct,
                    hasOverride: overrideMap[subId] !== undefined,
                    status: subPct >= 100 ? 'exceeded' : subPct >= 80 ? 'warning' : 'ok'
                };
            });

            return {
                _id: cat._id,
                mainCategory: cat.mainCategory,
                icon: cat.icon,
                color: cat.color,
                budgetGroup: cat.budgetGroup,
                budgetLimit,
                spent,
                pct,
                hasOverride: overrideMap[id] !== undefined,
                status: pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : 'ok',
                subcategories: enrichedSubs
            };
        });

        // Group by budgetGroup
        const groups = { needs: [], wants: [], savings_debt: [] };

        enriched.forEach(cat => {
            // Which groups does this category or its subcategories belong to?
            const targetGroups = new Set();
            if (cat.budgetGroup && cat.budgetGroup !== 'unassigned') targetGroups.add(cat.budgetGroup);
            cat.subcategories.forEach(sub => {
                if (sub.budgetGroup && sub.budgetGroup !== 'unassigned') targetGroups.add(sub.budgetGroup);
            });

            // For each target group, clone the category and filter subcategories
            targetGroups.forEach(g => {
                if (!groups[g]) return;
                
                const clonedCat = { ...cat };
                // A subcategory appears in this group if it's explicitly assigned to it,
                // OR if it's 'unassigned' but the parent is in this group
                clonedCat.subcategories = cat.subcategories.filter(sub => 
                    sub.budgetGroup === g || (sub.budgetGroup === 'unassigned' && cat.budgetGroup === g)
                );
                
                groups[g].push(clonedCat);
            });
        });

        res.json({ categories: enriched, groups, month, year });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/category-budget/:categoryId ────────────────────────────────────
router.put('/:categoryId', auth, async (req, res) => {
    try {
        const { month, year, budgetLimit, applyToBase, subcategory } = req.body;
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const targetYear = parseInt(year) || new Date().getFullYear();

        // Upsert the monthly override
        const query = { user: req.userId, category: req.params.categoryId, month: targetMonth, year: targetYear };
        if (subcategory) query.subcategory = subcategory;
        else query.subcategory = null;

        const override = await CategoryBudget.findOneAndUpdate(
            query,
            { budgetLimit: parseFloat(budgetLimit) },
            { upsert: true, new: true }
        );

        // If user wants this as the new carry-forward default, update the base too
        if (applyToBase) {
            if (subcategory) {
                // Update subcategorySettings in Category
                const cat = await Category.findOne({ _id: req.params.categoryId, user: req.userId });
                if (cat) {
                    const idx = cat.subcategorySettings.findIndex(s => s.name === subcategory);
                    if (idx >= 0) {
                        cat.subcategorySettings[idx].monthlyBudget = parseFloat(budgetLimit);
                    } else {
                        cat.subcategorySettings.push({ name: subcategory, monthlyBudget: parseFloat(budgetLimit) });
                    }
                    await cat.save();
                }
            } else {
                await Category.findOneAndUpdate(
                    { _id: req.params.categoryId, user: req.userId },
                    { monthlyBudget: parseFloat(budgetLimit) }
                );
            }
        }

        res.json({ success: true, override });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/category-budget/alerts?month=&year= ────────────────────────────
router.get('/alerts', auth, async (req, res) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const categories = await Category.find({ user: req.userId, type: 'expense' });
        const overrides = await CategoryBudget.find({ user: req.userId, month, year });
        const actualSpend = await getActualSpend(req.userId, month, year);

        const overrideMap = {};
        overrides.forEach(o => { 
            if (o.subcategory) overrideMap[`${o.category.toString()}_${o.subcategory}`] = o.budgetLimit;
            else overrideMap[o.category.toString()] = o.budgetLimit;
        });

        const alerts = [];
        
        categories.forEach(cat => {
            const id = cat._id.toString();
            const spendData = actualSpend[cat.mainCategory] || { total: 0, subcategories: {} };
            
            // Check main category
            const budgetLimit = overrideMap[id] ?? cat.monthlyBudget ?? 0;
            if (budgetLimit > 0) {
                const pct = Math.round((spendData.total / budgetLimit) * 100);
                if (pct >= 100) {
                    alerts.push({
                        categoryId: cat._id, mainCategory: cat.mainCategory,
                        icon: cat.icon, color: cat.color, severity: 'exceeded',
                        pct, spent: spendData.total, budgetLimit,
                        message: `${cat.icon} ${cat.mainCategory} budget exceeded! (${pct}% used)`
                    });
                } else if (pct >= 80) {
                    alerts.push({
                        categoryId: cat._id, mainCategory: cat.mainCategory,
                        icon: cat.icon, color: cat.color, severity: 'warning',
                        pct, spent: spendData.total, budgetLimit,
                        message: `${cat.icon} ${cat.mainCategory} is at ${pct}% of budget`
                    });
                }
            }

            // Check subcategories
            const subSettingsMap = {};
            (cat.subcategorySettings || []).forEach(s => { subSettingsMap[s.name] = s; });

            (cat.subcategories || []).forEach(subName => {
                const subId = `${id}_${subName}`;
                const settings = subSettingsMap[subName] || { monthlyBudget: 0 };
                const subLimit = overrideMap[subId] ?? settings.monthlyBudget ?? 0;
                if (subLimit > 0) {
                    const subSpent = spendData.subcategories[subName] || 0;
                    const subPct = Math.round((subSpent / subLimit) * 100);
                    if (subPct >= 100) {
                        alerts.push({
                            categoryId: cat._id, mainCategory: cat.mainCategory, subcategory: subName,
                            icon: cat.icon, color: cat.color, severity: 'exceeded',
                            pct: subPct, spent: subSpent, budgetLimit: subLimit,
                            message: `${cat.icon} ${subName} budget exceeded! (${subPct}% used)`
                        });
                    } else if (subPct >= 80) {
                        alerts.push({
                            categoryId: cat._id, mainCategory: cat.mainCategory, subcategory: subName,
                            icon: cat.icon, color: cat.color, severity: 'warning',
                            pct: subPct, spent: subSpent, budgetLimit: subLimit,
                            message: `${cat.icon} ${subName} is at ${subPct}% of budget`
                        });
                    }
                }
            });
        });

        res.json({ alerts, month, year });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
