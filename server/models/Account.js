const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },        // e.g. "BOC", "HNB", "Cash"
    balance: { type: Number, required: true, default: 0 },
    icon: { type: String, default: '🏦' },
    color: { type: String, default: '#3b82f6' },
    isDefault: { type: Boolean, default: false },               // Cash wallet is default
    isArchived: { type: Boolean, default: false }
}, { timestamps: true });

AccountSchema.index({ user: 1 });

module.exports = mongoose.model('Account', AccountSchema);
