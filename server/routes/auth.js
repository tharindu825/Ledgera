const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, monthlyIncome, familySize, currency } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // First user becomes admin with permanent access
        const userCount = await User.countDocuments();
        const isFirstUser = userCount === 0;

        const user = new User({
            name, email, password,
            monthlyIncome: monthlyIncome || 0,
            familySize: familySize || 1,
            currency: currency || 'LKR',
            role: isFirstUser ? 'admin' : 'user',
            accessGranted: isFirstUser ? true : false,    // First user gets auto-access
            accessExpiresAt: null
        });
        await user.save();

        // ─── Seed Default Categories ───
        const Category = require('../models/Category');
        const defaultCategories = [
            { type: 'expense', mainCategory: 'food_and_drink' },
            { type: 'expense', mainCategory: 'housing' },
            { type: 'expense', mainCategory: 'vehicle' },
            { type: 'expense', mainCategory: 'communication_and_pc' },
            { type: 'expense', mainCategory: 'vegetables' },
            { type: 'expense', mainCategory: 'fruits' },
            { type: 'expense', mainCategory: 'dairy' },
            { type: 'expense', mainCategory: 'meat' },
            { type: 'expense', mainCategory: 'household' },
            { type: 'expense', mainCategory: 'snacks' },
            { type: 'expense', mainCategory: 'beverages' },
            { type: 'expense', mainCategory: 'personal_care' },
            { type: 'expense', mainCategory: 'other' },
            { type: 'income', mainCategory: 'salary' },
            { type: 'income', mainCategory: 'business' },
            { type: 'income', mainCategory: 'freelance' },
            { type: 'income', mainCategory: 'other' }
        ];

        await Category.insertMany(defaultCategories.map(c => ({ ...c, user: user._id })));

        // If user has no access, inform them to wait for admin
        if (!user.accessGranted) {
            return res.status(201).json({
                pendingAccess: true,
                message: 'Account created! Please wait for the administrator to grant you access.'
            });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                accessGranted: user.accessGranted,
                accessExpiresAt: user.accessExpiresAt,
                monthlyIncome: user.monthlyIncome,
                familySize: user.familySize,
                currency: user.currency,
                budgetPercentage: user.budgetPercentage,
                savingsGoal: user.savingsGoal
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Auto-promote cvsushi14@gmail.com to admin
        if (user.email === 'cvsushi14@gmail.com' && user.role !== 'admin') {
            user.role = 'admin';
            user.accessGranted = true;
            await user.save();
        }


        // Access check (admin always has access)
        if (user.role !== 'admin') {
            if (!user.accessGranted) {
                return res.status(403).json({
                    error: 'ACCESS_DENIED',
                    message: 'You don\'t have access to this system. Please contact your administrator.'
                });
            }

            if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) {
                return res.status(403).json({
                    error: 'ACCESS_EXPIRED',
                    message: 'Your access period has expired. Please contact your administrator to renew.'
                });
            }
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                accessGranted: user.accessGranted,
                accessExpiresAt: user.accessExpiresAt,
                monthlyIncome: user.monthlyIncome,
                familySize: user.familySize,
                currency: user.currency,
                budgetPercentage: user.budgetPercentage,
                savingsGoal: user.savingsGoal,
                preferences: user.preferences
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get profile
router.get('/profile', auth, async (req, res) => {
    res.json({ user: req.user });
});

// Update profile
router.put('/profile', auth, async (req, res) => {
    try {
        const updates = req.body;
        const allowedUpdates = ['name', 'monthlyIncome', 'familySize', 'savingsGoal', 'budgetPercentage', 'currency', 'preferences'];

        const filteredUpdates = {};
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) filteredUpdates[key] = updates[key];
        });

        const user = await User.findByIdAndUpdate(req.userId, filteredUpdates, { new: true }).select('-password');
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
