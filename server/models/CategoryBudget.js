const mongoose = require('mongoose');

/**
 * CategoryBudget — per-month budget limit override for a specific category.
 * The base limit lives on Category.monthlyBudget and carries forward.
 * This model stores overrides when a user edits a specific month.
 */
const categoryBudgetSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subcategory: { type: String, default: null },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    budgetLimit: { type: Number, required: true, min: 0 }
}, { timestamps: true });

// One override per user/category/subcategory/month/year
categoryBudgetSchema.index({ user: 1, category: 1, subcategory: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('CategoryBudget', categoryBudgetSchema);
