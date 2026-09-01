const express = require('express');
const auth = require('../middleware/auth');
const Account = require('../models/Account');
const Category = require('../models/Category');
const router = express.Router();

const WALLET_BASE = 'https://rest.budgetbakers.com/wallet/v1/api';

// ─── Helper: fetch all pages from Wallet API ─────────────────────────────────
async function fetchAllWallet(path) {
    const apiKey = process.env.WALLET_API_KEY;
    if (!apiKey) throw new Error('WALLET_API_KEY is not set in .env');

    let items = [];
    let offset = 0;
    const limit = 200;

    while (true) {
        const res = await fetch(`${WALLET_BASE}${path}?limit=${limit}&offset=${offset}`, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Wallet API error (${res.status}): ${err}`);
        }
        const data = await res.json();
        const chunk = data.data || data.accounts || data.categories || [];
        items = items.concat(chunk);
        if (data.nextOffset == null || chunk.length === 0) break;
        offset = data.nextOffset;
    }
    return items;
}

// ─── Map Wallet account type → Ledgera icon label ────────────────────────────
const ACCOUNT_TYPE_ICON = {
    Cash: 'Cash',
    CurrentAccount: 'Bank',
    SavingAccount: 'Savings',
    CreditCard: 'Card',
    General: 'Bank',
    Investment: 'Digital',
    Insurance: 'Savings',
    Loan: 'Bank',
    Mortgage: 'Home',
    Overdraft: 'Card',
    Bonus: 'Coins',
};

// ─── GET /api/wallet/accounts  (preview) ─────────────────────────────────────
router.get('/accounts', auth, async (req, res) => {
    try {
        const items = await fetchAllWallet('/accounts');
        const accounts = items
            .filter(a => !a.archived)
            .map(a => ({
                walletId: a.id,
                name: a.name,
                balance: a.balance?.currentBalance ?? 0,
                currencyCode: a.currencyCode,
                accountType: a.accountType,
                color: a.color || '#3b82f6',
                icon: ACCOUNT_TYPE_ICON[a.accountType] || 'Bank',
            }));
        res.json({ accounts, total: accounts.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/wallet/sync-accounts  (import into Ledgera) ───────────────────
router.post('/sync-accounts', auth, async (req, res) => {
    try {
        const items = await fetchAllWallet('/accounts');
        const active = items.filter(a => !a.archived);

        let created = 0, updated = 0, skipped = 0;

        for (const a of active) {
            const existing = await Account.findOne({ user: req.userId, name: a.name, isArchived: false });
            if (existing) {
                // Update balance & color but keep user customisations
                existing.color = a.color || existing.color;
                existing.balance = a.balance?.currentBalance ?? existing.balance;
                await existing.save();
                updated++;
            } else {
                await Account.create({
                    user: req.userId,
                    name: a.name,
                    balance: a.balance?.currentBalance ?? 0,
                    icon: ACCOUNT_TYPE_ICON[a.accountType] || 'Bank',
                    color: a.color || '#3b82f6',
                    isDefault: false,
                });
                created++;
            }
        }

        res.json({ message: `Sync complete`, created, updated, skipped });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/wallet/categories  (preview) ───────────────────────────────────
router.get('/categories', auth, async (req, res) => {
    try {
        const items = await fetchAllWallet('/categories');
        const enabled = items.filter(c => !c.archived && c.enabled !== false);

        // Group by group.id (parent category)
        const groups = {};
        for (const cat of enabled) {
            const groupId = cat.group?.id || 'other';
            const groupName = cat.group?.name || 'Other';
            if (!groups[groupId]) {
                groups[groupId] = { groupId, groupName, color: cat.color, subcategories: [] };
            }
            // Only add if it has a parent (custom subcategory) or is a leaf under a group
            if (cat.parentId || cat.systemId) {
                groups[groupId].subcategories.push(cat.name);
            }
        }

        // Determine type heuristics based on group name
        const incomeGroups = ['income'];
        const result = Object.values(groups).map(g => ({
            ...g,
            type: incomeGroups.includes(g.groupId) ? 'income' : 'expense',
        }));

        res.json({ categories: result, total: result.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/wallet/sync-categories  (import into Ledgera) ─────────────────
router.post('/sync-categories', auth, async (req, res) => {
    try {
        const items = await fetchAllWallet('/categories');
        const enabled = items.filter(c => !c.archived && c.enabled !== false);

        // Build group map
        const groups = {};
        for (const cat of enabled) {
            const groupId = cat.group?.id || 'other';
            const groupName = (cat.group?.name || 'Other').toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (!groups[groupId]) {
                groups[groupId] = {
                    mainCategory: groupName,
                    color: cat.color || '#64748b',
                    subcategories: new Set(),
                };
            }
            if (cat.name && (cat.parentId || cat.systemId)) {
                groups[groupId].subcategories.add(cat.name);
            }
        }

        const incomeGroupIds = ['income'];
        let created = 0, updated = 0;

        for (const [groupId, group] of Object.entries(groups)) {
            const type = incomeGroupIds.includes(groupId) ? 'income' : 'expense';
            const subs = [...group.subcategories];

            const existing = await Category.findOne({
                user: req.userId,
                type,
                mainCategory: group.mainCategory
            });

            if (existing) {
                // Merge subcategories
                const merged = [...new Set([...existing.subcategories, ...subs])];
                existing.subcategories = merged;
                existing.color = group.color;
                await existing.save();
                updated++;
            } else {
                await Category.create({
                    user: req.userId,
                    type,
                    mainCategory: group.mainCategory,
                    color: group.color,
                    icon: '📁',
                    subcategories: subs,
                });
                created++;
            }
        }

        res.json({ message: 'Categories synced', created, updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
