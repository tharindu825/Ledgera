const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const Transaction = require('./server/models/Transaction');
const Bill = require('./server/models/Bill');

async function debug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const allTransactions = await Transaction.find().lean();
        const badTx = allTransactions.filter(t => !t.month || !t.year);
        console.log('Transactions missing month/year:', badTx.length);
        console.log(badTx);

        const allBills = await Bill.find().lean();
        const billsWithoutTx = [];
        for (const bill of allBills) {
            const tx = await Transaction.findOne({ receiptId: bill._id });
            if (!tx) billsWithoutTx.push(bill);
        }
        console.log('Bills without transaction:', billsWithoutTx.length);
        console.log(billsWithoutTx.map(b => `${b._id} - ${b.storeName} - ${b.billDate}`));

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

debug();
