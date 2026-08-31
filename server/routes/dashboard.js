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

router.get('/analytics/:year/:month', auth, async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);

        // 1. Get Summary
        const summary = await MonthlySummary.findOne({ userId, year, month }) || {
            totalSpent: 0,
            categoryBreakdown: {},
            weeklySpending: []
        };

        // 2. Get Bills for the period
        const bills = await Bill.find({ userId, year, month }).sort({ billDate: -1 });

        // 3. Get Top Items (Aggregate from bills)
        const allItems = bills.reduce((acc, bill) => {
            bill.items.forEach(item => {
                const existing = acc.find(i => i.name.toLowerCase() === item.name.toLowerCase());
                if (existing) {
                    existing.total += item.totalPrice;
                    existing.count += 1;
                } else {
                    acc.push({
                        name: item.name,
                        category: item.category,
                        total: item.totalPrice,
                        count: 1
                    });
                }
            });
            return acc;
        }, []);

        const topItems = allItems.sort((a, b) => b.total - a.total).slice(0, 5);

        // 4. Get User Settings & Income for budget calculation
        const User = require('../models/User');
        const user = await User.findById(userId).select('budgetPercentage currency');

        const incomeTransactions = await Transaction.find({ user: userId, year, month, type: 'income' });
        const monthIncome = incomeTransactions.reduce((s, t) => s + t.amount, 0);

        const budgetLimit = summary.budgetLimit || (monthIncome * (user.budgetPercentage || 60)) / 100;

        res.json({
            summary,
            bills,
            topItems,
            budgetLimit: budgetLimit || 0,
            currency: user.currency || 'LKR'
        });
    } catch (err) {
        console.error('Analytics Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
