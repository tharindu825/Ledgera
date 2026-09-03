const express = require('express');
const Bill = require('../models/Bill');
const Transaction = require('../models/Transaction');
const Debt = require('../models/Debt');
const MonthlySummary = require('../models/MonthlySummary');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
    try {
        const userId = req.userId || req.user?._id || req.user?.id;

        if (!userId) {
            console.error('[Dashboard] Missing userId in request. User info:', req.user);
            return res.status(401).json({ error: 'User context missing. Please re-login.' });
        }

        const { month, year } = req.query;
        const now = new Date();
        const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
        const targetYear = year ? parseInt(year) : now.getFullYear();

        const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
        const endOfMonth = new Date(targetYear, targetMonth, 0);

        // 1. Get Monthly Summary (Budget vs Spend)
        let summary = await MonthlySummary.findOne({
            userId: userId,
            month: targetMonth,
            year: targetYear
        });

        if (!summary) {
            console.log(`[Dashboard] Creating summary for user ${userId} for ${targetMonth}/${targetYear}`);
            summary = new MonthlySummary({
                userId: userId,
                month: targetMonth,
                year: targetYear,
                budgetLimit: 0, // Will be calculated after income
                totalSpent: 0
            });
        }

        // 2. Calculate Total Income & Expenses from Transactions (target period)
        const transactions = await Transaction.find({
            user: userId,
            month: targetMonth,
            year: targetYear
        });

        const monthIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((s, t) => s + t.amount, 0);

        const monthExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((s, t) => s + t.amount, 0);

        // 3. Debts Status
        const debts = await Debt.find({ user: userId, status: 'active' });
        const owedByMe = debts.filter(d => d.type === 'owed_by_me').reduce((s, d) => s + d.remainingAmount, 0);
        const owedToMe = debts.filter(d => d.type === 'owed_to_me').reduce((s, d) => s + d.remainingAmount, 0);

        // 4. Accounts Total Balance
        const Account = require('../models/Account');
        const userAccounts = await Account.find({ user: userId, isArchived: false });
        const totalNetBalance = userAccounts.reduce((s, acc) => s + (acc.balance || 0), 0);

        // 5. Recent Bills (OCR history)
        const recentBills = await Bill.find({ userId: userId })
            .sort({ createdAt: -1 })
            .limit(5);

        // 6. Calculate dynamic budget limit if using transaction-based income
        const User = require('../models/User');
        const userSettings = await User.findById(userId).select('budgetPercentage');
        const budgetLimit = summary.budgetLimit > 0 ? summary.budgetLimit : (monthIncome * (userSettings.budgetPercentage || 60)) / 100;

        // 7. Build Final Response
        res.json({
            user: {
                name: req.user.name,
                currency: req.user.currency,
                balance: totalNetBalance // Real-time net balance
            },
            currentMonth: {
                income: monthIncome,
                expense: monthExpense,
                budgetLimit: budgetLimit,
                totalSpent: summary.totalSpent,
                remainingBudget: Math.max(0, budgetLimit - summary.totalSpent),
                spentPercentage: Math.round((summary.totalSpent / budgetLimit) * 100) || 0,
                categoryBreakdown: summary.categoryBreakdown || {},
                alerts: summary.alerts || [],
                month: targetMonth,
                year: targetYear
            },
            debts: {
                owedByMe,
                owedToMe
            },
            recentBills,
            trendData: [], // Would normally be last 6 months summaries
            todaySpent: transactions
                .filter(t => t.type === 'expense' && new Date(t.date).toDateString() === now.toDateString())
                .reduce((s, t) => s + t.amount, 0)
        });

    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper to generate previous months list
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getPrevMonthsList(year, month, count = 4) {
    const list = [];
    let curY = year;
    let curM = month;
    for (let i = 0; i < count; i++) {
        list.push({
            year: curY,
            month: curM,
            label: `${MONTH_NAMES[curM - 1]} ${curY}`,
            shortLabel: `${SHORT_MONTH_NAMES[curM - 1]} ${curY}`
        });
        curM--;
        if (curM < 1) {
            curM = 12;
            curY--;
        }
    }
    return list;
}

function calcComparison(curr, prev, type) {
    curr = Number(curr || 0);
    prev = Number(prev || 0);

    if (prev === 0 && curr === 0) {
        return { pct: 0, direction: 'neutral', arrow: '⊝', text: '0%' };
    }
    if (prev === 0 && curr > 0) {
        return {
            pct: 100,
            direction: type === 'expense' ? 'up_bad' : 'up_good',
            arrow: '↑',
            text: '100%'
        };
    }
    if (prev > 0 && curr === 0) {
        return {
            pct: 100,
            direction: type === 'expense' ? 'down_good' : 'down_bad',
            arrow: '↑',
            text: '100%'
        };
    }

    const diff = curr - prev;
    const pctVal = Math.round((diff / prev) * 100);

    if (type === 'expense') {
        if (diff < 0) {
            // Spending decreased (Good!)
            return {
                pct: Math.abs(pctVal),
                direction: 'down_good',
                arrow: '↓',
                text: `${Math.abs(pctVal)}%`
            };
        } else if (diff > 0) {
            // Spending increased (Bad / Warning)
            return {
                pct: pctVal,
                direction: 'up_bad',
                arrow: '↗',
                text: `${pctVal > 0 ? '' : ''}${pctVal}%`
            };
        } else {
            return { pct: 0, direction: 'neutral', arrow: '⊝', text: '0%' };
        }
    } else {
        // Income
        if (diff > 0) {
            // Income increased (Good!)
            return {
                pct: pctVal,
                direction: 'up_good',
                arrow: '↗',
                text: `${pctVal}%`
            };
        } else if (diff < 0) {
            // Income decreased (Bad)
            return {
                pct: pctVal,
                direction: 'down_bad',
                arrow: pctVal <= -50 ? '↓' : '↘',
                text: `${pctVal}%`
            };
        } else {
            return { pct: 0, direction: 'neutral', arrow: '⊝', text: '0%' };
        }
    }
}

// ─── Analytics Drilldown Endpoint ─────────────────────────────────────────────
router.get('/analytics-drilldown', auth, async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const year = parseInt(req.query.year);
        const month = parseInt(req.query.month);
        const type = req.query.type || 'expense';
        const category = (req.query.category || '').trim().toLowerCase();
        const subcategory = (req.query.subcategory || '').trim().toLowerCase();

        const results = [];

        if (type === 'expense') {
            // 1. Bill items
            const bills = await Bill.find({ userId, year, month }).sort({ billDate: -1 });
            bills.forEach(bill => {
                (bill.items || []).forEach(item => {
                    const itemCat = (item.category || 'other').trim().toLowerCase();
                    const itemSub = (item.subcategory || '').trim().toLowerCase();

                    const matchCat = !category || itemCat === category;
                    let matchSub = true;
                    if (subcategory) {
                        if (subcategory === 'general' || subcategory === 'uncategorized') {
                            matchSub = !itemSub || itemSub === 'general' || itemSub === 'uncategorized';
                        } else {
                            matchSub = itemSub === subcategory;
                        }
                    }

                    if (matchCat && matchSub) {
                        results.push({
                            id: `${bill._id}_${item._id}`,
                            billId: bill._id,
                            name: item.name,
                            category: item.category,
                            subcategory: item.subcategory || 'General',
                            amount: item.totalPrice,
                            unitPrice: item.unitPrice,
                            quantity: item.quantity,
                            unit: item.unit,
                            date: bill.billDate,
                            store: bill.storeName || 'Unknown Store',
                            source: 'bill'
                        });
                    }
                });
            });

            // 2. Manual transactions
            const txs = await Transaction.find({
                user: userId,
                year,
                month,
                type: 'expense',
                receiptId: null
            }).sort({ date: -1 });

            txs.forEach(t => {
                const itemCat = (t.category || 'other').trim().toLowerCase();
                const itemSub = (t.subcategory || '').trim().toLowerCase();

                const matchCat = !category || itemCat === category;
                let matchSub = true;
                if (subcategory) {
                    if (subcategory === 'general' || subcategory === 'uncategorized') {
                        matchSub = !itemSub || itemSub === 'general' || itemSub === 'uncategorized';
                    } else {
                        matchSub = itemSub === subcategory;
                    }
                }

                if (matchCat && matchSub) {
                    results.push({
                        id: t._id,
                        name: t.description || t.merchant || 'Expense Entry',
                        category: t.category,
                        subcategory: t.subcategory || 'General',
                        amount: t.amount,
                        date: t.date,
                        store: t.merchant || 'Manual Transaction',
                        source: 'transaction'
                    });
                }
            });
        } else if (type === 'income') {
            const txs = await Transaction.find({
                user: userId,
                year,
                month,
                type: 'income'
            }).sort({ date: -1 });

            txs.forEach(t => {
                const itemCat = (t.category || 'earned income').trim().toLowerCase();
                const itemSub = (t.subcategory || '').trim().toLowerCase();

                const matchCat = !category || itemCat === category;
                let matchSub = true;
                if (subcategory) {
                    if (subcategory === 'general' || subcategory === 'uncategorized') {
                        matchSub = !itemSub || itemSub === 'general' || itemSub === 'uncategorized';
                    } else {
                        matchSub = itemSub === subcategory;
                    }
                }

                if (matchCat && matchSub) {
                    results.push({
                        id: t._id,
                        name: t.description || t.merchant || 'Income Entry',
                        category: t.category,
                        subcategory: t.subcategory || 'General',
                        amount: t.amount,
                        date: t.date,
                        store: t.merchant || 'Income',
                        source: 'transaction'
                    });
                }
            });
        }

        results.sort((a, b) => new Date(b.date) - new Date(a.date));
        const totalAmount = results.reduce((s, r) => s + (r.amount || 0), 0);

        res.json({
            count: results.length,
            totalAmount,
            results
        });
    } catch (err) {
        console.error('Analytics drilldown error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET 3-Month Analytics ───────────────────────────────────────────────────
router.get('/analytics/:year/:month', auth, async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);

        const Category = require('../models/Category');
        const User = require('../models/User');

        // 1. Generate 4 months (M0 = Selected, M1 = Prev, M2 = 2-months-ago, M3 = 3-months-ago for M2 baseline)
        const monthsList = getPrevMonthsList(year, month, 4);
        const displayMonths = monthsList.slice(0, 3); // 3 displayed columns

        // 2. Fetch all user defined categories
        const userCategories = await Category.find({ user: userId });
        const userCatMap = {};
        userCategories.forEach(c => {
            const key = `${c.type}_${c.mainCategory.trim().toLowerCase()}`;
            userCatMap[key] = {
                id: c._id,
                type: c.type,
                mainCategory: c.mainCategory.trim().toLowerCase(),
                name: c.mainCategory,
                icon: c.icon || '📁',
                color: c.color || '#64748b',
                subcategories: (c.subcategories || []).map(s => s.trim())
            };
        });

        // 3. Aggregate 4 months data
        // monthlyData[i] = { totalExpense, totalIncome, expenseCats: {}, incomeCats: {} }
        const monthlyData = [];

        for (let i = 0; i < 4; i++) {
            const m = monthsList[i];
            const mBills = await Bill.find({ userId, year: m.year, month: m.month });
            const mExpensesTxs = await Transaction.find({ user: userId, year: m.year, month: m.month, type: 'expense', receiptId: null });
            const mIncomeTxs = await Transaction.find({ user: userId, year: m.year, month: m.month, type: 'income' });

            let mTotalExpense = 0;
            let mTotalIncome = 0;
            const mExpenseCats = {}; // cat -> { total, subcategories: {} }
            const mIncomeCats = {};  // cat -> { total, subcategories: {} }

            const ensureCatObj = (map, cat) => {
                if (!map[cat]) map[cat] = { total: 0, subcategories: {} };
            };

            // Process bills
            mBills.forEach(bill => {
                (bill.items || []).forEach(item => {
                    const cat = (item.category || 'other').trim().toLowerCase();
                    const sub = (item.subcategory || '').trim() || 'General';
                    const amt = Number(item.totalPrice) || 0;

                    ensureCatObj(mExpenseCats, cat);
                    mExpenseCats[cat].total += amt;
                    mExpenseCats[cat].subcategories[sub] = (mExpenseCats[cat].subcategories[sub] || 0) + amt;
                    mTotalExpense += amt;
                });
            });

            // Process manual expenses
            mExpensesTxs.forEach(tx => {
                const cat = (tx.category || 'other').trim().toLowerCase();
                const sub = (tx.subcategory || '').trim() || 'General';
                const amt = Number(tx.amount) || 0;

                ensureCatObj(mExpenseCats, cat);
                mExpenseCats[cat].total += amt;
                mExpenseCats[cat].subcategories[sub] = (mExpenseCats[cat].subcategories[sub] || 0) + amt;
                mTotalExpense += amt;
            });

            // Process income
            mIncomeTxs.forEach(tx => {
                const cat = (tx.category || 'earned income').trim().toLowerCase();
                const sub = (tx.subcategory || '').trim() || 'General';
                const amt = Number(tx.amount) || 0;

                ensureCatObj(mIncomeCats, cat);
                mIncomeCats[cat].total += amt;
                mIncomeCats[cat].subcategories[sub] = (mIncomeCats[cat].subcategories[sub] || 0) + amt;
                mTotalIncome += amt;
            });

            monthlyData.push({
                year: m.year,
                month: m.month,
                totalExpense: mTotalExpense,
                totalIncome: mTotalIncome,
                expenseCats: mExpenseCats,
                incomeCats: mIncomeCats
            });
        }

        // 4. Build Combined Expense Category Tree
        // Collect all expense category keys across user categories + actual data
        const allExpenseCatKeys = new Set();
        userCategories.filter(c => c.type === 'expense').forEach(c => allExpenseCatKeys.add(c.mainCategory.trim().toLowerCase()));
        monthlyData.forEach(md => Object.keys(md.expenseCats).forEach(k => allExpenseCatKeys.add(k)));

        const expenseCategoriesTree = [];
        allExpenseCatKeys.forEach(catKey => {
            const userCat = userCatMap[`expense_${catKey}`];
            const catName = userCat?.name || catKey;
            const icon = userCat?.icon || '📁';
            const color = userCat?.color || '#64748b';

            // Collect all subcategories for this category
            const allSubSet = new Set(userCat?.subcategories || []);
            monthlyData.forEach(md => {
                if (md.expenseCats[catKey]?.subcategories) {
                    Object.keys(md.expenseCats[catKey].subcategories).forEach(s => allSubSet.add(s));
                }
            });

            // Amounts for 4 months for this category
            const catAmounts4 = [0, 1, 2, 3].map(idx => monthlyData[idx].expenseCats[catKey]?.total || 0);

            // Months data for the 3 displayed columns
            const monthsData = [0, 1, 2].map(idx => {
                const currAmt = catAmounts4[idx];
                const prevAmt = catAmounts4[idx + 1];
                const change = calcComparison(currAmt, prevAmt, 'expense');
                return {
                    amount: currAmt,
                    change
                };
            });

            // Subcategories details (only keep non-zero in 3-month window)
            const subcategories = Array.from(allSubSet).map(subName => {
                const subAmounts4 = [0, 1, 2, 3].map(idx => monthlyData[idx].expenseCats[catKey]?.subcategories?.[subName] || 0);
                const subMonthsData = [0, 1, 2].map(idx => {
                    const currAmt = subAmounts4[idx];
                    const prevAmt = subAmounts4[idx + 1];
                    const change = calcComparison(currAmt, prevAmt, 'expense');
                    return {
                        amount: currAmt,
                        change
                    };
                });

                const totalSpendAcross3M = subMonthsData.reduce((s, m) => s + m.amount, 0);

                return {
                    name: subName,
                    monthsData: subMonthsData,
                    totalSpend3M: totalSpendAcross3M
                };
            }).filter(sub => sub.totalSpend3M > 0);

            // Sort subcategories: active ones first, then alphabetical
            subcategories.sort((a, b) => b.totalSpend3M - a.totalSpend3M || a.name.localeCompare(b.name));

            const totalSpendAcross3M = monthsData.reduce((s, m) => s + m.amount, 0);

            // Only add category if it has spend in the 3-month window
            if (totalSpendAcross3M > 0) {
                expenseCategoriesTree.push({
                    key: catKey,
                    name: catName,
                    icon,
                    color,
                    monthsData,
                    subcategories,
                    totalSpend3M: totalSpendAcross3M
                });
            }
        });

        // Sort categories: highest spend first, then alphabetical
        expenseCategoriesTree.sort((a, b) => b.totalSpend3M - a.totalSpend3M || a.name.localeCompare(b.name));

        // 5. Build Combined Income Category Tree
        const allIncomeCatKeys = new Set();
        userCategories.filter(c => c.type === 'income').forEach(c => allIncomeCatKeys.add(c.mainCategory.trim().toLowerCase()));
        monthlyData.forEach(md => Object.keys(md.incomeCats).forEach(k => allIncomeCatKeys.add(k)));

        const incomeCategoriesTree = [];
        allIncomeCatKeys.forEach(catKey => {
            const userCat = userCatMap[`income_${catKey}`];
            const catName = userCat?.name || catKey;
            const icon = userCat?.icon || '💰';
            const color = userCat?.color || '#10b981';

            const allSubSet = new Set(userCat?.subcategories || []);
            monthlyData.forEach(md => {
                if (md.incomeCats[catKey]?.subcategories) {
                    Object.keys(md.incomeCats[catKey].subcategories).forEach(s => allSubSet.add(s));
                }
            });

            const catAmounts4 = [0, 1, 2, 3].map(idx => monthlyData[idx].incomeCats[catKey]?.total || 0);
            const monthsData = [0, 1, 2].map(idx => {
                const currAmt = catAmounts4[idx];
                const prevAmt = catAmounts4[idx + 1];
                const change = calcComparison(currAmt, prevAmt, 'income');
                return {
                    amount: currAmt,
                    change
                };
            });

            const subcategories = Array.from(allSubSet).map(subName => {
                const subAmounts4 = [0, 1, 2, 3].map(idx => monthlyData[idx].incomeCats[catKey]?.subcategories?.[subName] || 0);
                const subMonthsData = [0, 1, 2].map(idx => {
                    const currAmt = subAmounts4[idx];
                    const prevAmt = subAmounts4[idx + 1];
                    const change = calcComparison(currAmt, prevAmt, 'income');
                    return {
                        amount: currAmt,
                        change
                    };
                });
                const totalIncome3M = subMonthsData.reduce((s, m) => s + m.amount, 0);
                return {
                    name: subName,
                    monthsData: subMonthsData,
                    totalIncome3M
                };
            }).filter(sub => sub.totalIncome3M > 0);

            subcategories.sort((a, b) => b.totalIncome3M - a.totalIncome3M || a.name.localeCompare(b.name));
            const totalIncome3M = monthsData.reduce((s, m) => s + m.amount, 0);

            // Only add income category if it has income in the 3-month window
            if (totalIncome3M > 0) {
                incomeCategoriesTree.push({
                    key: catKey,
                    name: catName,
                    icon,
                    color,
                    monthsData,
                    subcategories,
                    totalIncome3M
                });
            }
        });

        incomeCategoriesTree.sort((a, b) => b.totalIncome3M - a.totalIncome3M || a.name.localeCompare(b.name));

        // 6. Total Income & Total Expense Comparison Rows (for displayMonths)
        const totalIncomeMonthsData = [0, 1, 2].map(idx => {
            const currAmt = monthlyData[idx].totalIncome;
            const prevAmt = monthlyData[idx + 1].totalIncome;
            const change = calcComparison(currAmt, prevAmt, 'income');
            return { amount: currAmt, change };
        });

        const totalExpenseMonthsData = [0, 1, 2].map(idx => {
            const currAmt = monthlyData[idx].totalExpense;
            const prevAmt = monthlyData[idx + 1].totalExpense;
            const change = calcComparison(currAmt, prevAmt, 'expense');
            return { amount: currAmt, change };
        });

        // 7. Get user settings and top items for the current month
        const user = await User.findById(userId).select('budgetPercentage currency monthlyIncome');
        const currentMonthBills = await Bill.find({ userId, year, month }).sort({ billDate: -1 });

        const allItems = currentMonthBills.reduce((acc, bill) => {
            (bill.items || []).forEach(item => {
                const existing = acc.find(i => i.name.toLowerCase() === item.name.toLowerCase());
                if (existing) {
                    existing.total += item.totalPrice;
                    existing.count += 1;
                } else {
                    acc.push({
                        name: item.name,
                        category: item.category,
                        subcategory: item.subcategory,
                        total: item.totalPrice,
                        count: 1
                    });
                }
            });
            return acc;
        }, []);

        const topItems = allItems.sort((a, b) => b.total - a.total).slice(0, 10);

        const summary = await MonthlySummary.findOne({ userId, year, month }) || {
            totalSpent: monthlyData[0].totalExpense,
            categoryBreakdown: monthlyData[0].expenseCats,
            weeklySpending: []
        };

        const budgetLimit = summary.budgetLimit || (monthlyData[0].totalIncome * (user?.budgetPercentage || 60)) / 100;

        res.json({
            months: displayMonths,
            totalIncome: {
                monthsData: totalIncomeMonthsData
            },
            totalExpense: {
                monthsData: totalExpenseMonthsData
            },
            incomeCategories: incomeCategoriesTree,
            expenseCategories: expenseCategoriesTree,
            summary,
            bills: currentMonthBills,
            topItems,
            budgetLimit: budgetLimit || 0,
            currency: user?.currency || 'LKR'
        });
    } catch (err) {
        console.error('Analytics Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
