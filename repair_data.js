const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const Transaction = require('./server/models/Transaction');
const Bill = require('./server/models/Bill');

async function repair() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Fix missing month/year in Transactions
        const allTxs = await Transaction.find({ $or: [{ month: null }, { year: null }] });
        console.log(`Fixing ${allTxs.length} transactions missing month/year...`);
        for (const tx of allTxs) {
            const d = tx.date || new Date();
            tx.month = d.getMonth() + 1;
            tx.year = d.getFullYear();
            await tx.save();
        }

        // 2. Fix missing month/year in Bills (just in case)
        const allBills = await Bill.find({ $or: [{ month: null }, { year: null }] });
        console.log(`Fixing ${allBills.length} bills missing month/year...`);
        for (const bill of allBills) {
            const d = bill.billDate || new Date();
            bill.month = d.getMonth() + 1;
            bill.year = d.getFullYear();
            await bill.save();
        }

        // 3. Create missing Transactions for Bills
        const bills = await Bill.find();
        let createdCount = 0;
        for (const bill of bills) {
            const txExists = await Transaction.findOne({ receiptId: bill._id });
            if (!txExists) {
                console.log(`Creating missing transaction for bill: ${bill.storeName} (${bill._id})`);
                const newTx = new Transaction({
                    user: bill.userId,
                    type: 'expense',
                    amount: bill.totalAmount,
                    category: 'shopping',
                    merchant: bill.storeName,
                    description: `Restored bill from ${bill.storeName}`,
                    date: bill.billDate,
                    receiptId: bill._id,
                    paymentMethod: 'cash' // Defaulting to cash since we don't know the original
                });
                await newTx.save();
                createdCount++;
            }
        }
        console.log(`Restored ${createdCount} missing transactions.`);

        mongoose.connection.close();
        console.log('Done!');
    } catch (err) {
        console.error(err);
    }
}

repair();
