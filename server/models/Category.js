const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['expense', 'income'], required: true },
    mainCategory: { type: String, required: true },
    icon: { type: String, default: '📁' },
    color: { type: String, default: '#64748b' },
    subcategories: [{ type: String, trim: true }],
    // Budget grouping: which 50/30/20 bucket this category belongs to
    budgetGroup: { type: String, enum: ['needs', 'wants', 'savings_debt', 'income'], default: 'wants' },
    // Default monthly budget limit (carried forward each month, can be overridden per-month)
    monthlyBudget: { type: Number, default: 0 }
}, { timestamps: true });

// Ensure unique combination of user, type, and mainCategory
categorySchema.index({ user: 1, type: 1, mainCategory: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
