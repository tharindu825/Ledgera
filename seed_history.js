const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const User = require('./server/models/User');
const Bill = require('./server/models/Bill');
const Transaction = require('./server/models/Transaction');
const MonthlySummary = require('./server/models/MonthlySummary');
const Account = require('./server/models/Account');
const Debt = require('./server/models/Debt');
const GroceryPlan = require('./server/models/GroceryPlan');
const { recalculateMonthlySummary } = require('./server/services/summaryService');

const MONGO_URI = process.env.MONGODB_URI;

async function seedHistory() {
    try {
        console.log('🚀 Starting FULL Data Seeding for Ledgera...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB Atlas');

        const user = await User.findOne();
        if (!user) {
            console.error('❌ No user found. Please register a user first.');
            process.exit(1);
        }
        const userId = user._id;
        console.log(`👤 Seeding data for: ${user.name} (${user.email})`);

        // ─── 1. SEED ACCOUNTS ───────────────────────────────────────────
        console.log('💳 Seeding Accounts...');
        await Account.deleteMany({ user: userId });
        const accounts = [
            { user: userId, name: 'Commercial Bank Savings', balance: 450000, icon: 'Bank', color: '#3b82f6' },
            { user: userId, name: 'HNB Current Account', balance: 125000, icon: 'Bank', color: '#1d4ed8' },
            { user: userId, name: 'Main Wallet (Cash)', balance: 25000, icon: 'Cash', color: '#10b981' },
            { user: userId, name: 'Petty Cash', balance: 5000, icon: 'Wallet', color: '#f59e0b' }
        ];
        await Account.insertMany(accounts);

        // ─── 2. SEED DEBTS ──────────────────────────────────────────────
        console.log('💸 Seeding Debts & Loans...');
        await Debt.deleteMany({ user: userId });
        const debts = [
            { user: userId, title: 'Personal Loan', type: 'owed_by_me', personName: 'Sampath Bank', totalAmount: 500000, remainingAmount: 350000, dueDate: new Date(2026, 11, 31), notes: 'Personal Loan' },
            { user: userId, title: 'Friendly Loan', type: 'owed_to_me', personName: 'Kamal Perera', totalAmount: 50000, remainingAmount: 50000, dueDate: new Date(2026, 6, 15), notes: 'Friendly Loan' }
        ];
        await Debt.insertMany(debts);

        // ─── 3. SEED HISTORICAL MONTHS ──────────────────────────────────
        const months = [
            { month: 1, year: 2026, income: 480000, budgetPercent: 25 },
            { month: 2, year: 2026, income: 490000, budgetPercent: 25 },
            { month: 3, year: 2026, income: 500000, budgetPercent: 20 },
            { month: 4, year: 2026, income: 500000, budgetPercent: 20 },
            { month: 5, year: 2026, income: 500000, budgetPercent: 20 }
        ];

        const storeNames = ['Keells Super', 'Cargills Food City', 'Arpico Supercentre', 'Spar Supermarket', 'Glomark'];
        const itemTemplates = [
            { name: 'Keeri Samba Rice 5kg', category: 'food', price: 1450 },
            { name: 'Chicken Breast 1kg', category: 'meat', price: 1280 },
            { name: 'Fresh Milk 1L', category: 'dairy', price: 450 },
            { name: 'Red Onion 1kg', category: 'vegetables', price: 580 },
            { name: 'Coconut Oil 1L', category: 'food', price: 680 },
            { name: 'Tea Leaves 500g', category: 'beverages', price: 820 },
            { name: 'Sugar 1kg', category: 'food', price: 260 },
            { name: 'Eggs (Pack of 10)', category: 'meat', price: 540 },
            { name: 'Dishwash Liquid', category: 'household', price: 380 },
            { name: 'Biscuits Assorted', category: 'snacks', price: 450 },
            { name: 'Apples 1kg', category: 'fruits', price: 1100 },
            { name: 'Banana 1kg', category: 'fruits', price: 350 }
        ];

        for (const m of months) {
            console.log(`📅 Seeding ${m.month}/${m.year}...`);
            await Bill.deleteMany({ userId, month: m.month, year: m.year });
            await Transaction.deleteMany({ user: userId, month: m.month, year: m.year });
            await MonthlySummary.deleteMany({ userId, month: m.month, year: m.year });

            // Salary
            await new Transaction({
                user: userId, type: 'income', amount: m.income, category: 'salary', 
                description: 'Monthly Salary', date: new Date(m.year, m.month - 1, 1), 
                month: m.month, year: m.year
            }).save();

            // Bills
            const billCount = 4 + Math.floor(Math.random() * 2);
            for (let i = 0; i < billCount; i++) {
                const day = 2 + (i * 6);
                const store = storeNames[Math.floor(Math.random() * storeNames.length)];
                const itemCount = 4 + Math.floor(Math.random() * 4);
                const items = [];
                let billTotal = 0;
                for (let j = 0; j < itemCount; j++) {
                    const t = itemTemplates[Math.floor(Math.random() * itemTemplates.length)];
                    const qty = 1 + Math.floor(Math.random() * 2);
                    items.push({ name: t.name, category: t.category, quantity: qty, unitPrice: t.price, totalPrice: t.price * qty });
                    billTotal += t.price * qty;
                }
                const billDate = new Date(m.year, m.month - 1, day);
                const savedBill = await new Bill({ userId, storeName: store, billDate, items, totalAmount: billTotal, month: m.month, year: m.year, inputMethod: 'manual' }).save();
                await new Transaction({ user: userId, type: 'expense', amount: billTotal, category: 'shopping', merchant: store, description: `Groceries at ${store}`, date: billDate, receiptId: savedBill._id, month: m.month, year: m.year }).save();
            }

            // Fixed Expenses
            const fixed = [{ d: 'Electricity', c: 'bills', a: 9500 }, { d: 'Internet', c: 'bills', a: 4500 }, { d: 'Fuel', c: 'transport', a: 12000 }];
            for (const f of fixed) {
                await new Transaction({ user: userId, type: 'expense', amount: f.a, category: f.c, description: f.d, date: new Date(m.year, m.month - 1, 15), month: m.month, year: m.year }).save();
            }

            await recalculateMonthlySummary(userId, m.month, m.year, m.income, m.budgetPercent);
        }

        // ─── 4. SEED AI GROCERY PLAN ────────────────────────────────────
        console.log('🤖 Seeding AI Smart Plan...');
        await GroceryPlan.deleteMany({ userId });
        const plan = new GroceryPlan({
            userId, month: 6, year: 2026,
            recommendedItems: [
                { name: 'Rice 5kg', category: 'food', estimatedPrice: 1450, alternative: 'Bulk Rice', alternativePrice: 1200, reason: 'Buying in bulk saves 15%' },
                { name: 'Apples 1kg', category: 'fruits', estimatedPrice: 1100, alternative: 'Bananas', alternativePrice: 350, reason: 'Seasonal fruits are cheaper' }
            ],
            totalEstimatedCost: 25000, potentialSavings: 4500, healthScore: 85,
            tips: ['Shop on weekdays for better prices', 'Check for discounts at Keells'],
            generatedAt: new Date()
        });
        await plan.save();

        console.log('\n✨ FULL DATABASE SEEDING COMPLETED!');
        console.log('✅ Check: Dashboard (Balance/Owed), AI Planner (Plan/Predictions), Analytics (Graphs)');
        
        if (require.main === module) {
            await mongoose.disconnect();
        }
    } catch (err) {
        console.error('❌ Seeding Error:', err);
        if (require.main === module) process.exit(1);
        throw err;
    }
}

module.exports = { seedHistory };

if (require.main === module) {
    seedHistory();
}
