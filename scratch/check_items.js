const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const Bill = require('../server/models/Bill');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const bills = await Bill.find().lean();
    bills.forEach(b => {
        console.log('Bill:', b.storeName, 'Date:', b.billDate, 'Total:', b.totalAmount);
        console.log('Items:', b.items);
    });
    await mongoose.disconnect();
}
test();
