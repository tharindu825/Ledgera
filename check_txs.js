const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Transaction = require('./server/models/Transaction');

const MONGO_URI = process.env.MONGODB_URI;

async function checkTxs() {
    try {
        await mongoose.connect(MONGO_URI);
        const txs = await Transaction.find({ year: 2026, month: { $lte: 7 } });
        console.log('Txs before Aug 2026:', txs.length);
        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

checkTxs();
