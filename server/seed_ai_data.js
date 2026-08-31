const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('./models/User');
const Bill = require('./models/Bill');
const MonthlySummary = require('./models/MonthlySummary');
const Transaction = require('./models/Transaction');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB...');

        const user = await User.findOne({ email: 'cvsushi14@gmail.com' });
        if (!user) {
            console.log('User not found. Please login first.');
            process.exit(1);
        }

        const userId = user._id;
        const now = new Date();
        
        // Clear existing dummy data for these months to avoid duplicates
        const monthsToSeed = [0, 1, 2]; // 0 = current, 1 = last month, 2 = month before last
        
        for (const offset of monthsToSeed) {
            const d = new Date(now);
            d.setMonth(d.getMonth() - offset);
            const month = d.getMonth() + 1;
            const year = d.getFullYear();

            console.log(`Seeding data for ${month}/${year}...`);

            // 1. Create a few Bills
            const billData = [
                {
                    storeName: 'Keells Super',
                    totalAmount: 4500 + (offset * 500),
                    items: [
                        { name: 'Red Rice 5kg', category: 'food', quantity: 1, unitPrice: 1200, totalPrice: 1200 },
                        { name: 'Chicken 1kg', category: 'meat', quantity: 1, unitPrice: 1500, totalPrice: 1500 },
                        { name: 'Milk Powder', category: 'dairy', quantity: 1, unitPrice: 1100, totalPrice: 1100 },
                        { name: 'Soap Bundle', category: 'household', quantity: 1, unitPrice: 700, totalPrice: 700 }
                    ]
                },
                {
                    storeName: 'Cargills Food City',
                    totalAmount: 3200 - (offset * 200),
                    items: [
                        { name: 'Carrots', category: 'vegetables', quantity: 1, unitPrice: 400, totalPrice: 400 },
                        { name: 'Apples', category: 'fruits', quantity: 1, unitPrice: 1200, totalPrice: 1200 },
                        { name: 'Biscuits', category: 'snacks', quantity: 2, unitPrice: 300, totalPrice: 600 },
                        { name: 'Dishwash', category: 'household', quantity: 1, unitPrice: 1000, totalPrice: 1000 }
                    ]
                }
            ];

            for (const b of billData) {
                const billDate = new Date(d);
                billDate.setDate(10 + Math.floor(Math.random() * 10)); // Random day between 10-20
                
                const bill = new Bill({
                    userId,
                    billDate,
                    ...b,
                    inputMethod: 'manual'
                });
                await bill.save();

                // Create transaction for the bill
                const transaction = new Transaction({
                    user: userId,
                    type: 'expense',
                    amount: b.totalAmount,
                    category: 'shopping',
                    merchant: b.storeName,
                    date: billDate,
                    paymentMethod: 'cash',
                    receiptId: bill._id
                });
                await transaction.save();
            }

            // 2. Create/Update MonthlySummary
            const totalSpent = billData.reduce((sum, b) => sum + b.totalAmount, 0);
            const categoryBreakdown = {
                food: 1200,
                meat: 1500,
                dairy: 1100,
                household: 1700,
                vegetables: 400,
                fruits: 1200,
                snacks: 600,
                other: 0
            };

            await MonthlySummary.findOneAndUpdate(
                { userId, month, year },
                {
                    userId,
                    month,
                    year,
                    totalSpent,
                    totalBills: 2,
                    categoryBreakdown,
                    budgetLimit: (user.monthlyIncome * user.budgetPercentage) / 100 || 50000,
                    remainingBudget: ((user.monthlyIncome * user.budgetPercentage) / 100 || 50000) - totalSpent
                },
                { upsert: true }
            );
        }

        console.log('Successfully seeded 3 months of data!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
}

seed();
