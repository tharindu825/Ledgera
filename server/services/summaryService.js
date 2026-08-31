const Bill = require('../models/Bill');
const Transaction = require('../models/Transaction');
const MonthlySummary = require('../models/MonthlySummary');
const Category = require('../models/Category');
const User = require('../models/User');

async function recalculateMonthlySummary(userId, month, year, manualIncome = null, manualPct = null) {
    const user = await User.findById(userId);
    if (!user) return;

    // Check if a summary already exists to preserve historical settings
    const existingSummary = await MonthlySummary.findOne({ userId, month, year });

    const income = manualIncome !== null ? manualIncome : (existingSummary?.monthlyIncome || user.monthlyIncome || 0);
    const pct = manualPct !== null ? manualPct : (existingSummary?.budgetPercentage || user.budgetPercentage || 30);
    const budgetLimit = (income * pct) / 100;

    const bills = await Bill.find({ userId, month, year });
    const userCategories = await Category.find({ user: userId, type: 'expense' });

    const categoryBreakdown = { other: 0 };
    userCategories.forEach(c => {
        categoryBreakdown[c.mainCategory] = 0;
    });

    let totalSpent = 0;
    const dailyMap = {};

    bills.forEach(bill => {
        totalSpent += bill.totalAmount;
        const dateKey = bill.billDate.toISOString().split('T')[0];
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + bill.totalAmount;

        bill.items.forEach(item => {
            const cat = item.category || 'other';
            if (categoryBreakdown.hasOwnProperty(cat)) {
                categoryBreakdown[cat] += item.totalPrice;
            } else {
                categoryBreakdown.other = (categoryBreakdown.other || 0) + item.totalPrice;
            }
        });
    });

    // Also consider transactions NOT coming from bills (manual grocery transactions)
    // Actually, normally grocery bills ARE transactions. 
    // But what if a user adds a manual transaction of type 'expense' and category 'food'?
    // The current dashboard summary specifically looks at 'bills'. 
    // If the user wants a global summary, we should include all transactions of type 'expense'.

    const transactions = await Transaction.find({
        user: userId,
        type: 'expense',
        date: {
            $gte: new Date(year, month - 1, 1),
            $lte: new Date(year, month, 0, 23, 59, 59)
        },
        receiptId: null // Avoid double counting bills
    });

    transactions.forEach(t => {
        totalSpent += t.amount;
        const dateKey = t.date.toISOString().split('T')[0];
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + t.amount;

        const cat = t.category || 'other';
        if (categoryBreakdown.hasOwnProperty(cat)) {
            categoryBreakdown[cat] += t.amount;
        } else {
            categoryBreakdown.other = (categoryBreakdown.other || 0) + t.amount;
        }
    });

    const weeklySpending = [1, 2, 3, 4, 5].map(week => {
        const weekStart = (week - 1) * 7 + 1;
        const weekEnd = week * 7;
        let amount = 0;
        Object.entries(dailyMap).forEach(([dateStr, amt]) => {
            const day = new Date(dateStr).getDate();
            if (day >= weekStart && day <= weekEnd) amount += amt;
        });
        return { week, amount };
    });

    const dailySpending = Object.entries(dailyMap).map(([date, amount]) => ({ date: new Date(date), amount }));

    // Generate alerts
    const alerts = [];
    const spentPercent = budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0;

    if (spentPercent >= 90) {
        alerts.push({ type: 'budget_critical', message: `You've spent ${spentPercent.toFixed(0)}% of your grocery budget!`, severity: 'danger' });
    } else if (spentPercent >= 70) {
        alerts.push({ type: 'budget_warning', message: `You've used ${spentPercent.toFixed(0)}% of your grocery budget.`, severity: 'warning' });
    }

    await MonthlySummary.findOneAndUpdate(
        { userId, month, year },
        {
            totalSpent,
            totalBills: bills.length,
            categoryBreakdown,
            weeklySpending,
            dailySpending,
            budgetLimit,
            monthlyIncome: income,
            budgetPercentage: pct,
            remainingBudget: budgetLimit - totalSpent,
            savingsAchieved: Math.max(0, budgetLimit - totalSpent),
            alerts
        },
        { upsert: true, new: true }
    );
}

module.exports = { recalculateMonthlySummary };
