/**
 * migrate_budget_groups.js — fixed for space-based category names
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Category = require('./server/models/Category');

// ── Budget Group Mapping matching actual DB mainCategory values ───────────────
// Based on Budget.txt groupings

const NEEDS = new Set([
    // Food & Dining → needs (essential groceries only; the parent group maps to needs for essential)
    'food & dining',
    'groceries',
    // Household
    'household & utilities',
    'utilities',
    'home supplies',
    'housing',
    // Health
    'personal care & health',
    'healthcare & pharmacy',
    'baby & childcare',
    'baby essentials',
    'baby nutrition',
    'education',
    // Transport
    'transportation',
    'fuel',
    'public transit & rides',
    'vehicle maintenance',
    // Financial essentials
    'debt & payments',
    'packaging & service fees',
]);

const SAVINGS_DEBT = new Set([
    'savings & investments',
    'financial & miscellaneous',
]);

// Everything else (expense) → 'wants'

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas');

        const categories = await Category.find();
        let updated = 0;

        for (const cat of categories) {
            let group;
            const key = cat.mainCategory.toLowerCase().trim();

            if (cat.type === 'income') {
                group = 'income';
            } else if (NEEDS.has(key)) {
                group = 'needs';
            } else if (SAVINGS_DEBT.has(key)) {
                group = 'savings_debt';
            } else {
                group = 'wants';
            }

            if (cat.budgetGroup !== group) {
                await Category.updateOne({ _id: cat._id }, { budgetGroup: group });
                console.log(`  ✓ "${cat.mainCategory}" → ${group}`);
                updated++;
            } else {
                console.log(`  - "${cat.mainCategory}" already ${group}`);
            }
        }

        console.log(`\n✅ Updated ${updated} categories with budgetGroup assignments`);
        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

migrate();
