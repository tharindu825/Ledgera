const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Transaction = require('./server/models/Transaction');
const Bill = require('./server/models/Bill');
const Category = require('./server/models/Category');
const { recalculateMonthlySummary } = require('./server/services/summaryService');
const User = require('./server/models/User');

const MONGO_URI = process.env.MONGODB_URI;

async function fixCategories() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB Atlas');

        const users = await User.find();

        for (const user of users) {
            console.log(`Processing user: ${user.name}`);
            const userCategories = await Category.find({ user: user._id });

            // 1. Fix Transactions
            const txs = await Transaction.find({ user: user._id });
            let txFixed = 0;
            for (const tx of txs) {
                if (tx.category && tx.category.includes('_')) {
                    const noUnderscore = tx.category.replace(/_/g, ' ');
                    // Verify if this matches a real category
                    const realCat = userCategories.find(c => c.mainCategory === noUnderscore);
                    if (realCat) {
                        tx.category = realCat.mainCategory;
                        await tx.save();
                        txFixed++;
                    }
                }
            }
            console.log(`  - Fixed ${txFixed} transactions`);

            // 2. Fix Bills
            const bills = await Bill.find({ userId: user._id });
            let billsFixed = 0;
            for (const bill of bills) {
                let changed = false;
                for (const item of bill.items) {
                    if (item.category && item.category.includes('_')) {
                        const noUnderscore = item.category.replace(/_/g, ' ');
                        const realCat = userCategories.find(c => c.mainCategory === noUnderscore);
                        if (realCat) {
                            item.category = realCat.mainCategory;
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    await bill.save();
                    billsFixed++;
                }
            }
            console.log(`  - Fixed ${billsFixed} bills`);

            // 3. Recalculate summaries for recent months
            await recalculateMonthlySummary(user._id, 9, 2026);
            await recalculateMonthlySummary(user._id, 8, 2026);
            console.log(`  - Recalculated summaries`);
        }

        console.log(`✨ All clean!`);
        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

fixCategories();
