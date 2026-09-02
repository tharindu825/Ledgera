const express = require('express');
const auth = require('../middleware/auth');
const Category = require('../models/Category');
const CategoryBudget = require('../models/CategoryBudget');
const Transaction = require('../models/Transaction');
const Bill = require('../models/Bill');
const router = express.Router();

// ─── Helper: compute actual spend per category for a month ──────────────────
async function getActualSpend(userId, month, year) {
    const spent = {};

    // From bills (item-level)
    const bills = await Bill.find({ userId, month, year });
    bills.forEach(bill => {
        bill.items.forEach(item => {
            const cat = item.category || 'other';
            spent[cat] = (spent[cat] || 0) + (item.totalPrice || 0);
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
        spent[cat] = (spent[cat] || 0) + (tx.amount || 0);
    });

    return spent;
}

// ─── GET /api/category-budget?month=&year= ───────────────────────────────────
// Returns all expense categories enriched with: budget limit for this month + actual spend
router.get('/', auth, async (req, res) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const categories = await Category.find({ user: req.userId, type: 'expense' });
        const overrides = await CategoryBudget.find({ user: req.userId, month, year });
        const actualSpend = await getActualSpend(req.userId, month, year);

        const overrideMap = {};
        overrides.forEach(o => { overrideMap[o.category.toString()] = o.budgetLimit; });

        const enriched = categories.map(cat => {
            const id = cat._id.toString();
            // Use override for this month if exists, otherwise fall back to category's base monthlyBudget
            const budgetLimit = overrideMap[id] !== undefined ? overrideMap[id] : (cat.monthlyBudget || 0);
            const spent = actualSpend[cat.mainCategory] || 0;
            const pct = budgetLimit > 0 ? Math.round((spent / budgetLimit) * 100) : 0;

            return {
                _id: cat._id,
                mainCategory: cat.mainCategory,
                icon: cat.icon,
                color: cat.color,
                budgetGroup: cat.budgetGroup,
                subcategories: cat.subcategories,
                budgetLimit,
                spent,
                pct,
                hasOverride: overrideMap[id] !== undefined,
                status: pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : 'ok'
            };
        });

        // Group by budgetGroup
        const groups = { needs: [], wants: [], savings_debt: [] };
        enriched.forEach(c => {
            const g = c.budgetGroup || 'wants';
            if (groups[g]) groups[g].push(c);
            else groups.wants.push(c);
        });

        res.json({ categories: enriched, groups, month, year });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/category-budget/:categoryId ────────────────────────────────────
// Set or update budget limit for a specific category in a specific month
router.put('/:categoryId', auth, async (req, res) => {
    try {
        const { month, year, budgetLimit, applyToBase } = req.body;
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const targetYear = parseInt(year) || new Date().getFullYear();

        // Upsert the monthly override
        const override = await CategoryBudget.findOneAndUpdate(
            { user: req.userId, category: req.params.categoryId, month: targetMonth, year: targetYear },
            { budgetLimit: parseFloat(budgetLimit) },
            { upsert: true, new: true }
        );

        // If user wants this as the new carry-forward default, update the base too
        if (applyToBase) {
            await Category.findOneAndUpdate(
                { _id: req.params.categoryId, user: req.userId },
                { monthlyBudget: parseFloat(budgetLimit) }
            );
        }

        res.json({ success: true, override });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/category-budget/alerts?month=&year= ────────────────────────────
// Returns categories that are at/above 80% of their budget (for push notifications)
router.get('/alerts', auth, async (req, res) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const categories = await Category.find({ user: req.userId, type: 'expense' });
        const overrides = await CategoryBudget.find({ user: req.userId, month, year });
        const actualSpend = await getActualSpend(req.userId, month, year);

        const overrideMap = {};
        overrides.forEach(o => { overrideMap[o.category.toString()] = o.budgetLimit; });

        const alerts = [];
        categories.forEach(cat => {
            const budgetLimit = overrideMap[cat._id.toString()] ?? cat.monthlyBudget ?? 0;
            if (budgetLimit <= 0) return; // Skip categories with no budget set

            const spent = actualSpend[cat.mainCategory] || 0;
            const pct = Math.round((spent / budgetLimit) * 100);

            if (pct >= 100) {
                alerts.push({
                    categoryId: cat._id,
                    mainCategory: cat.mainCategory,
                    icon: cat.icon,
                    color: cat.color,
                    severity: 'exceeded',
                    pct,
                    spent,
                    budgetLimit,
                    message: `${cat.icon} ${cat.mainCategory} budget exceeded! (${pct}% used)`
                });
            } else if (pct >= 80) {
                alerts.push({
                    categoryId: cat._id,
                    mainCategory: cat.mainCategory,
                    icon: cat.icon,
                    color: cat.color,
                    severity: 'warning',
                    pct,
                    spent,
                    budgetLimit,
                    message: `${cat.icon} ${cat.mainCategory} is at ${pct}% of budget`
                });
            }
        });

        res.json({ alerts, month, year });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
