const express = require('express');
const User = require('../models/User');
const MonthlySummary = require('../models/MonthlySummary');
const auth = require('../middleware/auth');
const router = express.Router();

// Get budget settings (Income is now derived from transactions)
router.get('/', auth, async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const user = await User.findById(req.userId).select('familySize savingsGoal budgetPercentage currency');

        // Sum income from transactions for the given month
        const Transaction = require('../models/Transaction');
        const incomeTransactions = await Transaction.find({
            user: req.userId,
            type: 'income',
            month: targetMonth,
            year: targetYear
        });
        const monthlyIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);

        const budgetLimit = (monthlyIncome * user.budgetPercentage) / 100;

        res.json({
            monthlyIncome,
            familySize: user.familySize,
            savingsGoal: user.savingsGoal,
            budgetPercentage: user.budgetPercentage,
            currency: user.currency,
            budgetLimit,
            perPersonBudget: user.familySize > 0 ? budgetLimit / user.familySize : budgetLimit,
            month: targetMonth,
            year: targetYear
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update budget settings
router.put('/', auth, async (req, res) => {
    try {
        const { monthlyIncome, familySize, savingsGoal, budgetPercentage, currency } = req.body;

        const user = await User.findByIdAndUpdate(req.userId, {
            monthlyIncome, familySize, savingsGoal, budgetPercentage, currency
        }, { new: true }).select('-password');

        const budgetLimit = (user.monthlyIncome * user.budgetPercentage) / 100;

        res.json({
            monthlyIncome: user.monthlyIncome,
            familySize: user.familySize,
            savingsGoal: user.savingsGoal,
            budgetPercentage: user.budgetPercentage,
            currency: user.currency,
            budgetLimit,
            perPersonBudget: user.familySize > 0 ? budgetLimit / user.familySize : budgetLimit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get budget status for specified or current month
router.get('/status', auth, async (req, res) => {
    try {
        const { month, year } = req.query;
        const now = new Date();
        const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
        const targetYear = year ? parseInt(year) : now.getFullYear();

        const user = await User.findById(req.userId);

        // Dynamic income for the target month
        const Transaction = require('../models/Transaction');
        const incomeTransactions = await Transaction.find({
            user: req.userId,
            type: 'income',
            month: targetMonth,
            year: targetYear
        });
        const monthlyIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const budgetLimit = (monthlyIncome * user.budgetPercentage) / 100;

        const summary = await MonthlySummary.findOne({ userId: req.userId, month: targetMonth, year: targetYear });

        const totalSpent = summary ? summary.totalSpent : 0;
        const remainingBudget = budgetLimit - totalSpent;
        const spentPercentage = budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0;

        let status = 'safe';
        if (spentPercentage >= 90) status = 'danger';
        else if (spentPercentage >= 70) status = 'warning';

        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const daysPassed = (targetMonth === now.getMonth() + 1 && targetYear === now.getFullYear()) ? now.getDate() : daysInMonth;
        const daysRemaining = daysInMonth - daysPassed;
        const dailyBudgetRemaining = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

        res.json({
            monthlyIncome,
            budgetLimit,
            totalSpent,
            remainingBudget,
            spentPercentage: Math.round(spentPercentage),
            status,
            daysRemaining,
            dailyBudgetRemaining: Math.round(dailyBudgetRemaining),
            currency: user.currency,
            month: targetMonth,
            year: targetYear
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all monthly summaries (history) — only months with real transactions
router.get('/history', auth, async (req, res) => {
    try {
        const Transaction = require('../models/Transaction');
        const user = await User.findById(req.userId);

        // Step 1: Find all months that have at least one transaction for this user
        const txMonths = await Transaction.aggregate([
            { $match: { user: req.userId } },
            { $group: { _id: { month: '$month', year: '$year' } } },
            { $sort: { '_id.year': -1, '_id.month': -1 } }
        ]);

        if (txMonths.length === 0) {
            // No transactions at all — delete any stale summaries and return empty
            await MonthlySummary.deleteMany({ userId: req.userId });
            return res.json({ summaries: [], user });
        }

        // Step 2: Delete any MonthlySummary records that have NO transactions
        const allSummaries = await MonthlySummary.find({ userId: req.userId }).lean();
        for (const s of allSummaries) {
            const hasTxs = txMonths.some(m => m._id.month === s.month && m._id.year === s.year);
            if (!hasTxs) {
                await MonthlySummary.deleteOne({ _id: s._id });
            }
        }

        // Step 3: For each month that HAS transactions, compute real totals
        const enriched = await Promise.all(txMonths.map(async ({ _id: { month, year } }) => {
            const txs = await Transaction.find({ user: req.userId, month, year });

            const actualIncome = txs
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            const actualSpent = txs
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);

            const totalBills = txs.filter(t => t.type === 'expense' && t.receiptId).length;

            // Look up stored summary for budget settings (income %, limit)
            const stored = await MonthlySummary.findOne({ userId: req.userId, month, year }).lean();
            const income = stored?.monthlyIncome || actualIncome;
            const pct = stored?.budgetPercentage || user.budgetPercentage || 30;
            const budgetLimit = stored?.budgetLimit > 0 ? stored.budgetLimit : (income * pct) / 100;
            const categoryBreakdown = stored?.categoryBreakdown || {};

            return {
                month,
                year,
                totalSpent: actualSpent,
                monthlyIncome: income,
                budgetPercentage: pct,
                budgetLimit,
                remainingBudget: Math.max(0, budgetLimit - actualSpent),
                savingsAchieved: Math.max(0, budgetLimit - actualSpent),
                totalBills,
                categoryBreakdown,
                alerts: stored?.alerts || []
            };
        }));

        res.json({ summaries: enriched, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a past month's budget/income
router.put('/history/:year/:month', auth, async (req, res) => {
    try {
        const { year, month } = req.params;
        const { monthlyIncome, budgetPercentage } = req.body;
        const income = parseFloat(monthlyIncome);
        const pct = parseFloat(budgetPercentage);
        if (!income || income <= 0) return res.status(400).json({ error: 'Valid monthly income is required' });
        if (!pct || pct <= 0 || pct > 100) return res.status(400).json({ error: 'Budget percentage must be 1-100' });

        // We update the MonthlySummary directly with the new budget limit
        // and then recalculate everything else
        const { recalculateMonthlySummary } = require('../services/summaryService');
        
        const budgetLimit = (income * pct) / 100;

        // Recalculate using the provided budget settings
        await recalculateMonthlySummary(req.userId, parseInt(month), parseInt(year), income, pct);
        
        const summary = await MonthlySummary.findOne({ userId: req.userId, month: parseInt(month), year: parseInt(year) });

        res.json({ summary, message: 'Historical budget updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
