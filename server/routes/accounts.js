const express = require('express');
const Account = require('../models/Account');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all accounts for this user
router.get('/', auth, async (req, res) => {
    try {
        let accounts = await Account.find({ user: req.userId, isArchived: false }).sort({ isDefault: -1, createdAt: 1 });

        // Ensure a default account exists
        const defaultAcc = accounts.find(a => a.isDefault);
        if (!defaultAcc) {
            const cash = new Account({
                user: req.userId,
                name: 'Cash',
                balance: 0,
                icon: '💵', // Note: using 💵 emoji as string is fine
                color: '#10b981',
                isDefault: true
            });
            await cash.save();
            accounts.unshift(cash);
        }
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new account
router.post('/', auth, async (req, res) => {
    try {
        const { name, balance, icon, color } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Account name is required' });

        const existing = await Account.findOne({ user: req.userId, name: name.trim(), isArchived: false });
        if (existing) return res.status(409).json({ error: 'Account with this name already exists' });

        const account = new Account({
            user: req.userId,
            name: name.trim(),
            balance: parseFloat(balance) || 0,
            icon: icon || '🏦',
            color: color || '#3b82f6'
        });
        await account.save();
        res.status(201).json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an account (name, balance, icon, color)
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, balance, icon, color } = req.body;
        const account = await Account.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            { name, balance: parseFloat(balance) || 0, icon, color },
            { new: true }
        );
        if (!account) return res.status(404).json({ error: 'Account not found' });
        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Adjust balance (add or subtract)
router.patch('/:id/adjust', auth, async (req, res) => {
    try {
        const { amount, operation } = req.body; // operation: 'add' or 'subtract'
        const delta = operation === 'subtract' ? -(parseFloat(amount) || 0) : (parseFloat(amount) || 0);
        const account = await Account.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            { $inc: { balance: delta } },
            { new: true }
        );
        if (!account) return res.status(404).json({ error: 'Account not found' });
        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete (archive) an account
router.delete('/:id', auth, async (req, res) => {
    try {
        const account = await Account.findOne({ _id: req.params.id, user: req.userId });
        if (!account) return res.status(404).json({ error: 'Account not found' });
        if (account.isDefault) return res.status(400).json({ error: 'Cannot delete the default Cash account' });
        account.isArchived = true;
        await account.save();
        res.json({ message: 'Account archived' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
