const mongoose = require('mongoose');

const groceryPlanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    recommendedItems: [{
        name: String,
        category: String,
        estimatedPrice: Number,
        alternative: String,
        alternativePrice: Number,
        reason: String
    }],
    totalEstimatedCost: { type: Number, default: 0 },
    potentialSavings: { type: Number, default: 0 },
    tips: [String],
    healthScore: { type: Number, default: 0 }, // 0-100
    generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

groceryPlanSchema.index({ userId: 1, year: 1, month: 1 });

module.exports = mongoose.model('GroceryPlan', groceryPlanSchema);
