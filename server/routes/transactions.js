const express = require('express');
const Transaction = require('../models/Transaction');
const MonthlySummary = require('../models/MonthlySummary');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all distinct years that have transaction data
router.get('/years', auth, async (req, res) => {
    try {
        const userId = req.userId || req.user?.id || req.user?._id;
        const mongoose = require('mongoose');
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const result = await Transaction.aggregate([
            { $match: { user: userObjectId } },
            {
                $project: {
                    // Use stored year if present, otherwise extract from date field
                    resolvedYear: {
                        $cond: {
                            if: { $and: [{ $ifNull: ['$year', false] }, { $gt: ['$year', 0] }] },
                            then: '$year',
                            else: { $year: '$date' }
                        }
                    }
                }
            },
            { $group: { _id: '$resolvedYear' } },
            { $sort: { _id: 1 } }
        ]);

        const years = result.map(r => r._id).filter(y => y && y > 1970);

        // Always include current year
        const currentYear = new Date().getFullYear();
        if (!years.includes(currentYear)) years.push(currentYear);

        res.json({ years: years.sort((a, b) => a - b) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all transactions with filters
router.get('/', auth, async (req, res) => {
    try {
        const { type, category, startDate, endDate, month, year, accountId, limit = 100 } = req.query;
        let query = { user: req.user.id };

        if (type) query.type = type;
        if (category) query.category = category;
        if (month) query.month = parseInt(month);
        if (year) query.year = parseInt(year);
        if (accountId) {
            const Account = require('../models/Account');
            const targetAcc = await Account.findOne({ _id: accountId, user: req.user.id });

            if (targetAcc && targetAcc.isDefault) {
                // If filtering by default account, include legacy records where accountId is null
                query.accountId = { $in: [accountId, null] };
            } else {
                query.accountId = accountId;
            }
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(query)
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .populate('receiptId');

        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const { recalculateMonthlySummary } = require('../services/summaryService');

// Helper to trigger summary update
async function triggerSummaryUpdate(userId, date) {
    const d = new Date(date);
    await recalculateMonthlySummary(userId, d.getMonth() + 1, d.getFullYear());
}

// Create a new transaction (manual or from OCR)
router.post('/', auth, async (req, res) => {
    try {
        const { amount, type, category, subcategory, merchant, description, date, paymentMethod, accountId, receiptId } = req.body;
        const numAmount = parseFloat(amount) || 0;

        // Balance Validation
        if (accountId && type === 'expense') {
            const Account = require('../models/Account');
            const targetAcc = await Account.findOne({ _id: accountId, user: req.user.id });
            if (targetAcc && targetAcc.balance < numAmount) {
                return res.status(400).json({
                    error: 'Insufficient Funds',
                    message: `Account "${targetAcc.name}" only has ${targetAcc.balance}. Bill amount is ${numAmount}.`
                });
            }
        }

        const transaction = new Transaction({
            user: req.user.id,
            type,
            amount: numAmount,
            category,
            subcategory,
            merchant,
            description,
            date: date || new Date(),
            paymentMethod: accountId ? 'account' : (paymentMethod || 'cash'),
            accountId: accountId || null,
            receiptId
        });

        await transaction.save();

        // ─── Auto-Add Category/Subcategory ───
        const { ensureCategoryAndSubcategory } = require('../utils/categoryHelper');
        await ensureCategoryAndSubcategory(req.user.id, type, category, subcategory || description);

        // Adjust account balance if linked
        if (accountId) {
            const Account = require('../models/Account');
            const delta = type === 'expense' ? -(parseFloat(amount) || 0) : (parseFloat(amount) || 0);
            await Account.findByIdAndUpdate(accountId, { $inc: { balance: delta } });
        }

        // Update Summary
        await triggerSummaryUpdate(req.user.id, transaction.date);

        res.status(201).json(transaction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create multiple transactions (e.g. from a bill with line items)
router.post('/bulk', auth, async (req, res) => {
    try {
        const { transactions } = req.body; // Array of objects
        const userTransactions = transactions.map(t => ({
            ...t,
            user: req.user.id
        }));

        const result = await Transaction.insertMany(userTransactions);
        if (result.length > 0) {
            await triggerSummaryUpdate(req.user.id, result[0].date);
        }
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update transaction
router.put('/:id', auth, async (req, res) => {
    try {
        const oldTx = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
        if (!oldTx) return res.status(404).json({ error: 'Transaction not found' });

        const newTxData = req.body;

        // Handle account balance adjustments if linked accounts exist
        const Account = require('../models/Account');

        if (oldTx.accountId) {
            const reverseDelta = oldTx.type === 'expense' ? (oldTx.amount || 0) : -(oldTx.amount || 0);
            await Account.findByIdAndUpdate(oldTx.accountId, { $inc: { balance: reverseDelta } });
        }

        if (newTxData.accountId) {
            const newType = newTxData.type || oldTx.type;
            const newAmount = parseFloat(newTxData.amount) || 0;

            // Check if account can handle the NEW amount (considering the old amount is being reversed)
            const targetAcc = await Account.findOne({ _id: newTxData.accountId, user: req.user.id });
            const oldReversedBalance = oldTx.accountId?.toString() === newTxData.accountId ? (targetAcc.balance + (oldTx.type === 'expense' ? oldTx.amount : -oldTx.amount)) : targetAcc.balance;

            if (newType === 'expense' && oldReversedBalance < newAmount) {
                return res.status(400).json({
                    error: 'Insufficient Funds',
                    message: `Update failed. Target account would have a negative balance.`
                });
            }

            const delta = newType === 'expense' ? -newAmount : newAmount;
            await Account.findByIdAndUpdate(newTxData.accountId, { $inc: { balance: delta } });
        }

        const transaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { $set: { ...newTxData, paymentMethod: newTxData.accountId ? 'account' : (newTxData.paymentMethod || oldTx.paymentMethod) } },
            { new: true }
        );

        await triggerSummaryUpdate(req.user.id, transaction.date);
        res.json(transaction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete transaction
router.delete('/:id', auth, async (req, res) => {
    try {
        const result = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!result) return res.status(404).json({ error: 'Transaction not found' });

        const Account = require('../models/Account');

        // Reverse account balance for this transaction
        if (result.accountId) {
            // For transfers: the deleted side is a debit (money out), so add back
            // For transfers: the credit side is handled below when we delete the linked tx
            // For regular expense: reverse means adding back. For income: subtracting.
            const reverseDelta = result.type === 'expense' ? (result.amount || 0)
                : result.type === 'income' ? -(result.amount || 0)
                : (result.amount || 0); // transfer debit side: add back to source
            await Account.findByIdAndUpdate(result.accountId, { $inc: { balance: reverseDelta } });
        }

        // If this is a transfer, also delete the linked paired transaction
        if (result.type === 'transfer' && result.transferLinkedId) {
            const linked = await Transaction.findOneAndDelete({ _id: result.transferLinkedId, user: req.user.id });
            if (linked && linked.accountId) {
                // The linked credit side: reverse means subtracting from destination
                await Account.findByIdAndUpdate(linked.accountId, { $inc: { balance: -(linked.amount || 0) } });
            }
        }

        await triggerSummaryUpdate(req.user.id, result.date);
        res.json({ message: 'Transaction deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
