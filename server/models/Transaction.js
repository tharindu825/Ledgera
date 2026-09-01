const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['expense', 'income', 'transfer'], required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    subcategory: { type: String },
    merchant: { type: String }, // For receipts
    description: { type: String },
    date: { type: Date, default: Date.now },
    month: { type: Number },
    year: { type: Number },
    paymentMethod: { type: String, default: 'cash' },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' }, // Link to extracted bill if any
    transferLinkedId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null }, // Mirror transaction for transfers
    isRecurring: { type: Boolean, default: false },
    status: { type: String, enum: ['completed', 'pending'], default: 'completed' }
}, { timestamps: true });

TransactionSchema.pre('save', function (next) {
    if (this.date) {
        this.month = this.date.getMonth() + 1;
        this.year = this.date.getFullYear();
    }
    next();
});

TransactionSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.$set && update.$set.date) {
        const d = new Date(update.$set.date);
        update.$set.month = d.getMonth() + 1;
        update.$set.year = d.getFullYear();
    } else if (update.date) {
        const d = new Date(update.date);
        update.month = d.getMonth() + 1;
        update.year = d.getFullYear();
    }
    next();
});

TransactionSchema.index({ user: 1, year: 1, month: 1, type: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
