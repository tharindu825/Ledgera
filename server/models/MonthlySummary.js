const mongoose = require('mongoose');

const monthlySummarySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    totalSpent: { type: Number, default: 0 },
    totalBills: { type: Number, default: 0 },
    categoryBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    weeklySpending: [{ week: Number, amount: Number }],
    dailySpending: [{ date: Date, amount: Number }],
    budgetLimit: { type: Number, default: 0 },
    monthlyIncome: { type: Number, default: 0 },
    budgetPercentage: { type: Number, default: 0 },
    remainingBudget: { type: Number, default: 0 },
    savingsAchieved: { type: Number, default: 0 },
    alerts: [{
        type: { type: String },
        message: String,
        severity: { type: String, enum: ['info', 'warning', 'danger'] },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

monthlySummarySchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlySummary', monthlySummarySchema);
