const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Transaction = require('../server/models/Transaction');
const Category = require('../server/models/Category');
const Bill = require('../server/models/Bill');
const User = require('../server/models/User');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find().lean();
    console.log('Users:', users.map(u => ({ id: u._id, name: u.name, email: u.email })));
    for (const u of users) {
        const cats = await Category.find({ user: u._id }).lean();
        console.log(`User ${u.name} categories:`, cats.length);
        cats.forEach(c => console.log(`  [${c.type}] ${c.mainCategory} (${c.icon}) subs: ${c.subcategories.join(', ')}`));
        
        const txs = await Transaction.find({ user: u._id }).lean();
        console.log(`User ${u.name} tx count:`, txs.length);
        const months = {};
        txs.forEach(t => {
            const k = `${t.year}-${String(t.month).padStart(2, '0')}`;
            if (!months[k]) months[k] = { expense: 0, income: 0, count: 0 };
            months[k][t.type] = (months[k][t.type] || 0) + t.amount;
            months[k].count++;
        });
        console.log('Months breakdown:', months);
    }
    await mongoose.disconnect();
}
test();
