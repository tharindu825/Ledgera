/**
 * reset_financial_data.js
 * ─────────────────────────────────────────────────────────────────
 * Clears ALL financial data for a fresh start:
 *   ✅ Deletes all Transactions
 *   ✅ Deletes all Bills (receipts)
 *   ✅ Deletes all Debts & Loans
 *   ✅ Deletes all Monthly Summaries
 *   ✅ Resets all Account balances to 0
 *
 * KEEPS:
 *   ✅ User accounts (login credentials)
 *   ✅ Accounts (names, icons — just zeroes balances)
 *   ✅ Categories & Subcategories
 *   ✅ Budget settings (limits per category)
 *   ✅ GroceryPlans / AI plans
 *
 * Usage:  node reset_financial_data.js
 * ─────────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Transaction   = require('./server/models/Transaction');
const Bill          = require('./server/models/Bill');
const Debt          = require('./server/models/Debt');
const MonthlySummary = require('./server/models/MonthlySummary');
const Account       = require('./server/models/Account');

const MONGO_URI = process.env.MONGODB_URI;

async function reset() {
    try {
        console.log('🔌 Connecting to MongoDB Atlas…');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected!\n');

        // ── 1. Transactions ───────────────────────────────────────────
        const txResult = await Transaction.deleteMany({});
        console.log(`🗑️  Transactions deleted   : ${txResult.deletedCount}`);

        // ── 2. Bills (Receipts) ───────────────────────────────────────
        const billResult = await Bill.deleteMany({});
        console.log(`🗑️  Bills deleted          : ${billResult.deletedCount}`);

        // ── 3. Debts & Loans ──────────────────────────────────────────
        const debtResult = await Debt.deleteMany({});
        console.log(`🗑️  Debts/Loans deleted    : ${debtResult.deletedCount}`);

        // ── 4. Monthly Summaries ──────────────────────────────────────
        const summaryResult = await MonthlySummary.deleteMany({});
        console.log(`🗑️  Monthly Summaries deleted: ${summaryResult.deletedCount}`);

        // ── 5. Reset Account Balances to 0 ───────────────────────────
        const accResult = await Account.updateMany({}, { $set: { balance: 0 } });
        console.log(`💳  Account balances zeroed : ${accResult.modifiedCount}`);

        console.log('\n✨ Fresh start complete! All financial data has been cleared.');
        console.log('   Your accounts, categories, and budget settings are intact.\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during reset:', err.message);
        process.exit(1);
    }
}

reset();
