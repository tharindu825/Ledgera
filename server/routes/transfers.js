const express = require('express');
const auth = require('../middleware/auth');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { recalculateMonthlySummary } = require('../services/summaryService');
const router = express.Router();

// ─── POST /api/transfers  ─────────────────────────────────────────────────────
// Transfer money between two accounts atomically
router.post('/', auth, async (req, res) => {
    const { fromAccountId, toAccountId, amount, date, note } = req.body;
    const userId = req.userId || req.user?.id;

    try {
        if (!fromAccountId || !toAccountId) {
            return res.status(400).json({ error: 'Both fromAccountId and toAccountId are required' });
        }
        if (fromAccountId === toAccountId) {
            return res.status(400).json({ error: 'Cannot transfer to the same account' });
        }
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than 0' });
        }

        // Fetch both accounts
        const [fromAcc, toAcc] = await Promise.all([
            Account.findOne({ _id: fromAccountId, user: userId, isArchived: false }),
            Account.findOne({ _id: toAccountId, user: userId, isArchived: false }),
        ]);

        if (!fromAcc) return res.status(404).json({ error: 'Source account not found' });
        if (!toAcc) return res.status(404).json({ error: 'Destination account not found' });

        // Balance check
        if (fromAcc.balance < numAmount) {
            return res.status(400).json({
                error: 'Insufficient Funds',
                message: `"${fromAcc.name}" has only ${fromAcc.balance.toLocaleString()}. Cannot transfer ${numAmount.toLocaleString()}.`
            });
        }

        const transferDate = date ? new Date(date) : new Date();

        // Create two mirrored Transfer transactions
        const debitTx = new Transaction({
            user: userId,
            type: 'transfer',
            amount: numAmount,
            category: 'transfer',
            description: note || `Transfer to ${toAcc.name}`,
            merchant: toAcc.name,
            date: transferDate,
            paymentMethod: 'account',
            accountId: fromAccountId,
        });
        const creditTx = new Transaction({
            user: userId,
            type: 'transfer',
            amount: numAmount,
            category: 'transfer',
            description: note || `Transfer from ${fromAcc.name}`,
            merchant: fromAcc.name,
            date: transferDate,
            paymentMethod: 'account',
            accountId: toAccountId,
        });

        await debitTx.save();
        creditTx.transferLinkedId = debitTx._id;
        debitTx.transferLinkedId = creditTx._id; // will update after creditTx saves
        await creditTx.save();

        // Link the two transactions
        debitTx.transferLinkedId = creditTx._id;
        await debitTx.save();

        // Update account balances atomically
        await Promise.all([
            Account.findByIdAndUpdate(fromAccountId, { $inc: { balance: -numAmount } }),
            Account.findByIdAndUpdate(toAccountId, { $inc: { balance: numAmount } }),
        ]);

        // Update monthly summaries
        const m = transferDate.getMonth() + 1;
        const y = transferDate.getFullYear();
        await recalculateMonthlySummary(userId, m, y);

        res.status(201).json({
            message: 'Transfer successful',
            debitTransaction: debitTx,
            creditTransaction: creditTx,
            fromBalance: fromAcc.balance - numAmount,
            toBalance: toAcc.balance + numAmount,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
