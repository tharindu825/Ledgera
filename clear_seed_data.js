const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const MonthlySummary = require('./server/models/MonthlySummary');
const Bill = require('./server/models/Bill');
const Transaction = require('./server/models/Transaction');

const MONGO_URI = process.env.MONGODB_URI;

async function clearOldSeedData() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB Atlas');

        // Delete all summaries, bills, and transactions before August 2026
        // (Assuming August and September are the user's actual data)
        const dateThreshold = new Date(2026, 7, 1); // August 1, 2026

        const delSummaries = await MonthlySummary.deleteMany({
            $or: [
                { year: { $lt: 2026 } },
                { year: 2026, month: { $lt: 8 } }
            ]
        });
        
        const delBills = await Bill.deleteMany({
            billDate: { $lt: dateThreshold }
        });

        const delTx = await Transaction.deleteMany({
            date: { $lt: dateThreshold }
        });

        console.log(`🗑️ Deleted ${delSummaries.deletedCount} old monthly summaries`);
        console.log(`🗑️ Deleted ${delBills.deletedCount} old bills`);
        console.log(`🗑️ Deleted ${delTx.deletedCount} old transactions`);

        console.log(`✨ Old seed data cleared successfully!`);
        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

clearOldSeedData();
