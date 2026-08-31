const mongoose = require('mongoose');

const DebtSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['owed_by_me', 'owed_to_me'], required: true },
    totalAmount: { type: Number, required: true },
    remainingAmount: { type: Number, required: true },
    personName: { type: String, required: true },
    dueDate: { type: Date },
    interestRate: { type: Number, default: 0 },
    repayments: [{
        amount: Number,
        date: { type: Date, default: Date.now },
        note: String,
        accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
        transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }
    }],
    status: { type: String, enum: ['active', 'paid'], default: 'active' },
    notes: String
}, { timestamps: true });

module.exports = mongoose.model('Debt', DebtSchema);
