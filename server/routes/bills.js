const express = require('express');
const Bill = require('../models/Bill');
const Transaction = require('../models/Transaction');
const MonthlySummary = require('../models/MonthlySummary');
const auth = require('../middleware/auth');
const { categorizeBillItem } = require('../services/aiEngine');
const router = express.Router();

// Create bill (manual entry)
router.post('/', auth, async (req, res) => {
    try {
        const { items, storeName, billDate, notes, inputMethod, discountAmount, accountId } = req.body;

        // Auto-categorize items and sanitize prices (remove commas)
        const sanitizeNum = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            return parseFloat(String(val).replace(/,/g, '')) || 0;
        };

        const categorizedItems = items.map(item => ({
            ...item,
            category: item.category || categorizeBillItem(item.name),
            unitPrice: sanitizeNum(item.unitPrice),
            quantity: sanitizeNum(item.quantity) || 1,
            totalPrice: sanitizeNum(item.totalPrice) || (sanitizeNum(item.unitPrice) * (sanitizeNum(item.quantity) || 1)) || 0
        }));

        const subTotal = categorizedItems.reduce((sum, item) => sum + sanitizeNum(item.totalPrice), 0);
        const safeDiscount = sanitizeNum(discountAmount);
        const totalAmount = Math.max(0, subTotal - safeDiscount);

        // Duplicate Check: Same store, date and total amount for this user
        const startOfDay = new Date(billDate || new Date());
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(billDate || new Date());
        endOfDay.setHours(23, 59, 59, 999);

        const existingBill = await Bill.findOne({
            userId: req.userId,
            storeName: storeName || 'Unknown Store',
            totalAmount: totalAmount,
            billDate: { $gte: startOfDay, $lte: endOfDay }
        });

        if (existingBill) {
            return res.status(409).json({
                error: 'Duplicate Bill Detected',
                message: `A bill from "${storeName}" on this date with the same amount (${totalAmount}) already exists.`,
                billId: existingBill._id
            });
        }

        const bill = new Bill({
            userId: req.userId,
            items: categorizedItems,
            totalAmount: parseFloat(totalAmount) || 0,
            discountAmount: safeDiscount,
            storeName: storeName || 'Unknown Store',
            billDate: billDate ? new Date(billDate) : new Date(),
            notes,
            inputMethod: inputMethod || 'manual'
        });

        // Balance Validation
        if (accountId) {
            const Account = require('../models/Account');
            const targetAcc = await Account.findOne({ _id: accountId, userId: req.userId });
            if (targetAcc && targetAcc.balance < bill.totalAmount) {
                return res.status(400).json({
                    error: 'Insufficient Funds',
                    message: `Account "${targetAcc.name}" has ${targetAcc.balance}. Bill total is ${bill.totalAmount}.`
                });
            }
        }

        await bill.save();

        // ─── Auto-Add Categories/Subcategories ───
        const { ensureCategoryAndSubcategory } = require('../utils/categoryHelper');
        for (const item of categorizedItems) {
            if (item.category) {
                await ensureCategoryAndSubcategory(req.userId, 'expense', item.category, item.subcategory);
            }
        }

        // Derive the dominant category from bill items
        const catCount = {};
        categorizedItems.forEach(item => {
            if (item.category) catCount[item.category] = (catCount[item.category] || 0) + 1;
        });
        const dominantCategory = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'shopping';

        // Also create a entry in Transactions
        const transaction = new Transaction({
            user: req.userId,
            type: 'expense',
            amount: parseFloat(totalAmount) || 0,
            category: dominantCategory,
            subcategory: categorizedItems.length === 1 ? categorizedItems[0].subcategory : undefined,
            merchant: storeName || 'Grocery Store',
            description: `Bill from ${storeName || 'Unknown'}`,
            date: bill.billDate,
            paymentMethod: accountId ? 'account' : 'cash',
            accountId: accountId || null,
            receiptId: bill._id
        });
        await transaction.save();

        // Adjust account balance if linked
        if (accountId) {
            const Account = require('../models/Account');
            await Account.findByIdAndUpdate(accountId, { $inc: { balance: -(parseFloat(totalAmount) || 0) } });
        }

        // Update monthly summary
        await updateMonthlySummary(req.userId, bill);

        res.status(201).json({ bill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all bills (with pagination & filters)
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, month, year, category } = req.query;
        const query = { userId: req.userId };

        if (month) query.month = parseInt(month);
        if (year) query.year = parseInt(year);

        const bills = await Bill.find(query)
            .sort({ billDate: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const itemIds = bills.map(b => b._id);
        const transactions = await Transaction.find({ receiptId: { $in: itemIds } });
        const txMap = {};
        transactions.forEach(t => txMap[t.receiptId?.toString()] = t.accountId);

        bills.forEach(b => {
            b.accountId = txMap[b._id.toString()] || null;
        });

        const total = await Bill.countDocuments(query);

        res.json({ bills, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single bill
router.get('/:id', auth, async (req, res) => {
    try {
        const bill = await Bill.findOne({ _id: req.params.id, userId: req.userId }).lean();
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        const tx = await Transaction.findOne({ receiptId: bill._id });
        bill.accountId = tx?.accountId || null;

        res.json({ bill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update bill
router.put('/:id', auth, async (req, res) => {
    try {
        const { items, storeName, billDate, notes, discountAmount, accountId } = req.body;

        const sanitizeNum = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            return parseFloat(String(val).replace(/,/g, '')) || 0;
        };

        const categorizedItems = items.map(item => ({
            ...item,
            category: item.category || categorizeBillItem(item.name),
            unitPrice: sanitizeNum(item.unitPrice),
            quantity: sanitizeNum(item.quantity) || 1,
            totalPrice: sanitizeNum(item.totalPrice) || (sanitizeNum(item.unitPrice) * (sanitizeNum(item.quantity) || 1)) || 0
        }));

        const subTotal = categorizedItems.reduce((sum, item) => sum + sanitizeNum(item.totalPrice), 0);
        const safeDiscount = sanitizeNum(discountAmount);
        const totalAmount = Math.max(0, subTotal - safeDiscount);

        const bill = await Bill.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { items: categorizedItems, totalAmount: sanitizeNum(totalAmount), discountAmount: safeDiscount, storeName, billDate, notes },
            { new: true }
        );

        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        // ─── Auto-Add Categories/Subcategories ───
        const { ensureCategoryAndSubcategory } = require('../utils/categoryHelper');
        for (const item of categorizedItems) {
            if (item.category) {
                await ensureCategoryAndSubcategory(req.userId, 'expense', item.category, item.subcategory);
            }
        }

        // Update the associated transaction if exists
        const oldTx = await Transaction.findOne({ receiptId: bill._id });
        if (oldTx) {
            const Account = require('../models/Account');

            // Reverse old account impact
            if (oldTx.accountId) {
                const reverseDelta = oldTx.type === 'expense' ? (oldTx.amount || 0) : -(oldTx.amount || 0);
                await Account.findByIdAndUpdate(oldTx.accountId, { $inc: { balance: reverseDelta } });
            }

            // Apply new account impact
            if (accountId) {
                const delta = oldTx.type === 'expense' ? -(parseFloat(totalAmount) || 0) : (parseFloat(totalAmount) || 0);
                await Account.findByIdAndUpdate(accountId, { $inc: { balance: delta } });
            }

            await Transaction.findOneAndUpdate(
                { receiptId: bill._id },
                {
                    amount: parseFloat(totalAmount) || 0,
                    merchant: storeName || 'Grocery Store',
                    date: billDate,
                    accountId: accountId || null,
                    paymentMethod: accountId ? 'account' : 'cash'
                }
            );
        }

        // Recalculate monthly summary
        await recalculateMonthlySummary(req.userId, bill.month, bill.year);

        res.json({ bill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete bill
router.delete('/:id', auth, async (req, res) => {
    try {
        const bill = await Bill.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        // Delete the associated transaction
        await Transaction.findOneAndDelete({ receiptId: bill._id });

        await recalculateMonthlySummary(req.userId, bill.month, bill.year);
        res.json({ message: 'Bill deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get suggestions for auto-fill
router.get('/suggestions', auth, async (req, res) => {
    try {
        const bills = await Bill.find({ userId: req.userId }).lean();
        const itemNames = new Set();
        const storeNames = new Set();
        const subcategories = new Set();
        const itemMap = {}; // Maps name to its last known category
        const priceMap = {}; // Maps name to its last known unit price
        const subCatMap = {}; // Maps name to its last known subcategory

        bills.forEach(bill => {
            if (bill.storeName) storeNames.add(bill.storeName);
            bill.items.forEach(item => {
                const name = item.name.trim();
                itemNames.add(name);
                itemMap[name] = item.category;
                priceMap[name] = item.unitPrice;
                if (item.subcategory) {
                    subCatMap[name] = item.subcategory;
                    subcategories.add(item.subcategory);
                }
            });
        });

        res.json({
            items: Array.from(itemNames),
            stores: Array.from(storeNames),
            subcategories: Array.from(subcategories),
            itemMap,
            priceMap,
            subCatMap
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const { recalculateMonthlySummary } = require('../services/summaryService');

// Helper: Update monthly summary after adding a bill
async function updateMonthlySummary(userId, bill) {
    const month = bill.billDate.getMonth() + 1;
    const year = bill.billDate.getFullYear();
    await recalculateMonthlySummary(userId, month, year);
}

module.exports = router;
