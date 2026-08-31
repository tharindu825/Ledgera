const express = require('express');
const Debt = require('../models/Debt');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all debts
router.get('/', auth, async (req, res) => {
    try {
        const debts = await Debt.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(debts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new debt
router.post('/', auth, async (req, res) => {
    try {
        const { title, type, totalAmount, personName, dueDate, notes } = req.body;
        const debt = new Debt({
            user: req.user.id,
            title,
            type,
            totalAmount,
            remainingAmount: totalAmount,
            personName,
            dueDate,
            notes
        });
        await debt.save();
        res.status(201).json(debt);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Record a repayment
router.post('/:id/repayment', auth, async (req, res) => {
    try {
        const { amount, note, accountId } = req.body;
        const debt = await Debt.findOne({ _id: req.params.id, user: req.user.id });
        if (!debt) return res.status(404).json({ error: 'Debt not found' });

        let transactionId = null;

        // 1. If accountId is provided, update account balance & create transaction
        if (accountId || amount > 0) {
            // Determine transaction type
            // If I owe money (owed_by_me) and I repay, it's an EXPENSE.
            // If someone owes me (owed_to_me) and they repay, it's an INCOME.
            const type = debt.type === 'owed_by_me' ? 'expense' : 'income';

            const transaction = new Transaction({
                user: req.user.id,
                type,
                amount,
                category: 'Debt Repayment',
                description: `${debt.type === 'owed_by_me' ? 'Paid to' : 'Received from'} ${debt.personName} for: ${debt.title}`,
                date: new Date(),
                paymentMethod: accountId ? 'account' : 'cash',
                accountId: accountId || null,
                status: 'completed'
            });

            await transaction.save();
            transactionId = transaction._id;

            // Update Account Balance if accountId provided
            if (accountId) {
                const account = await Account.findOne({ _id: accountId, user: req.user.id });
                if (account) {
                    if (type === 'expense') account.balance -= amount;
                    else account.balance += amount;
                    await account.save();
                }
            }
        }

        // 2. Record repayment in Debt model
        debt.repayments.push({
            amount,
            note,
            date: new Date(),
            accountId: accountId || null,
            transactionId: transactionId
        });

        debt.remainingAmount -= amount;

        if (debt.remainingAmount <= 0) {
            debt.remainingAmount = 0;
            debt.status = 'paid';
        }

        await debt.save();
        res.json(debt);
    } catch (err) {
        console.error('Repayment Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update a repayment
router.put('/:id/repayment/:repaymentId', auth, async (req, res) => {
    try {
        const { amount, note, date } = req.body;
        const debt = await Debt.findOne({ _id: req.params.id, user: req.user.id });
        if (!debt) return res.status(404).json({ error: 'Debt not found' });

        const repayment = debt.repayments.find(r => r._id.toString() === req.params.repaymentId);
        if (!repayment) return res.status(404).json({ error: 'Repayment not found' });

        const oldAmount = repayment.amount;
        const accountId = repayment.accountId;
        const transactionId = repayment.transactionId;

        // 1. Update the repayment data
        if (amount !== undefined) repayment.amount = amount;
        if (note !== undefined) repayment.note = note;
        if (date !== undefined) repayment.date = date;

        // 2. Sync with Transaction if it exists
        if (transactionId) {
            const transaction = await Transaction.findOne({ _id: transactionId, user: req.user.id });
            if (transaction) {
                if (amount !== undefined) transaction.amount = amount;
                if (date !== undefined) transaction.date = date;
                if (note !== undefined) transaction.description = `${debt.type === 'owed_by_me' ? 'Paid to' : 'Received from'} ${debt.personName} for: ${debt.title} (${note})`;
                await transaction.save();
            }
        }

        // 3. Sync with Account balance if accountId exists
        if (accountId && amount !== undefined && amount !== oldAmount) {
            const account = await Account.findOne({ _id: accountId, user: req.user.id });
            if (account) {
                const diff = amount - oldAmount;
                const type = debt.type === 'owed_by_me' ? 'expense' : 'income';
                
                // If it's an expense (paying my debt), more amount means less account balance
                if (type === 'expense') account.balance -= diff;
                else account.balance += diff;
                
                await account.save();
            }
        }

        // 4. Recalculate debt totals
        const totalPaid = debt.repayments.reduce((sum, r) => sum + r.amount, 0);
        debt.remainingAmount = Math.max(0, debt.totalAmount - totalPaid);
        debt.status = debt.remainingAmount <= 0 ? 'paid' : 'active';

        await debt.save();
        res.json(debt);
    } catch (err) {
        console.error('Repayment update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update debt
router.put('/:id', auth, async (req, res) => {
    try {
        const { title, type, totalAmount, personName, dueDate, notes, status } = req.body;
        const debt = await Debt.findOne({ _id: req.params.id, user: req.user.id });
        if (!debt) return res.status(404).json({ error: 'Debt not found' });

        if (title !== undefined) debt.title = title;
        if (type !== undefined) debt.type = type;
        if (personName !== undefined) debt.personName = personName;
        if (dueDate !== undefined) debt.dueDate = dueDate;
        if (notes !== undefined) debt.notes = notes;
        if (status !== undefined) debt.status = status;

        if (totalAmount !== undefined) {
            const oldTotal = debt.totalAmount;
            debt.totalAmount = totalAmount;
            // Recalculate remaining based on total - paid
            const paid = debt.repayments.reduce((sum, r) => sum + r.amount, 0);
            debt.remainingAmount = Math.max(0, totalAmount - paid);
            if (debt.remainingAmount <= 0) debt.status = 'paid';
            else if (debt.status === 'paid') debt.status = 'active';
        }

        await debt.save();
        res.json(debt);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete debt
router.delete('/:id', auth, async (req, res) => {
    try {
        const result = await Debt.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!result) return res.status(404).json({ error: 'Debt not found' });
        res.json({ message: 'Debt removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
