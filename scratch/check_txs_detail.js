const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Transaction = require('../server/models/Transaction');
const Bill = require('../server/models/Bill');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const txs = await Transaction.find().lean();
    console.log('Transactions:', txs);
    const bills = await Bill.find().lean();
    console.log('Bills:', bills);
    await mongoose.disconnect();
}
test();
