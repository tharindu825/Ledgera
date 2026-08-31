const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Bill = require('../models/Bill');
const MonthlySummary = require('../models/MonthlySummary');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

router.post('/seed-data', auth, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        const now = new Date();
        
        // Clear existing bills and summaries for the last 6 months to ensure a clean trend
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        await Bill.deleteMany({ userId, billDate: { $gte: sixMonthsAgo } });
        await MonthlySummary.deleteMany({ userId, createdAt: { $gte: sixMonthsAgo } }); // Simple cleanup

        const monthsToSeed = [0, 1, 2, 3, 4, 5]; 
        
        for (const offset of monthsToSeed) {
            const d = new Date(now);
            d.setMonth(d.getMonth() - offset);
            const month = d.getMonth() + 1;
            const year = d.getFullYear();

            // Create 2 bills per month with varying totals to show trends
            const baseAmount = 15000 + (Math.random() * 5000);
            // Make earlier months slightly cheaper to show an "increasing" trend
            const trendFactor = (5 - offset) * 1000; 
            const totalForMonth = baseAmount + trendFactor;

            const bill1 = new Bill({
                userId,
                billDate: new Date(year, month - 1, 10),
                storeName: 'Keells Super',
                totalAmount: totalForMonth / 2,
                items: [
                    { name: 'Red Rice 5kg', category: 'food', quantity: 1, totalPrice: 1200 },
                    { name: 'Chicken 1kg', category: 'meat', quantity: 1, totalPrice: 1500 }
                ],
                inputMethod: 'manual'
            });
            await bill1.save();

            const bill2 = new Bill({
                userId,
                billDate: new Date(year, month - 1, 20),
                storeName: 'Cargills Food City',
                totalAmount: totalForMonth / 2,
                items: [
                    { name: 'Vegetables', category: 'vegetables', quantity: 1, totalPrice: 800 },
                    { name: 'Fruits', category: 'fruits', quantity: 1, totalPrice: 1000 }
                ],
                inputMethod: 'manual'
            });
            await bill2.save();

            // Update summary
            await MonthlySummary.findOneAndUpdate(
                { userId, month, year },
                {
                    userId, month, year,
                    totalSpent: totalForMonth,
                    totalBills: 2,
                    categoryBreakdown: {
                        food: 1200,
                        meat: 1500,
                        vegetables: 800,
                        fruits: 1000,
                        other: totalForMonth - 4500
                    },
                    budgetLimit: (user.monthlyIncome * user.budgetPercentage) / 100 || 25000,
                    remainingBudget: ((user.monthlyIncome * user.budgetPercentage) / 100 || 25000) - totalForMonth
                },
                { upsert: true }
            );
        }

        res.json({ message: '6 months of trend data seeded successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
