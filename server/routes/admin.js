const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const router = express.Router();

// Get all users (admin only)
router.get('/users', auth, adminOnly, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Grant access to a user
router.put('/users/:id/grant-access', auth, adminOnly, async (req, res) => {
    try {
        const { accessExpiresAt } = req.body; // Optional expiry date

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'admin') return res.status(400).json({ error: 'Cannot modify admin access' });

        user.accessGranted = true;
        user.accessExpiresAt = accessExpiresAt ? new Date(accessExpiresAt) : null;
        await user.save();

        res.json({ message: `Access granted to ${user.name}`, user: user.toObject({ versionKey: false }) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Revoke access from a user
router.put('/users/:id/revoke-access', auth, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'admin') return res.status(400).json({ error: 'Cannot revoke admin access' });

        user.accessGranted = false;
        user.accessExpiresAt = null;
        await user.save();

        res.json({ message: `Access revoked for ${user.name}`, user: user.toObject({ versionKey: false }) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update access expiry
router.put('/users/:id/update-access', auth, adminOnly, async (req, res) => {
    try {
        const { accessExpiresAt, role } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Don't allow changing the first admin's role
        if (user.role === 'admin' && role === 'user') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) return res.status(400).json({ error: 'Cannot demote the last admin' });
        }

        if (accessExpiresAt !== undefined) user.accessExpiresAt = accessExpiresAt ? new Date(accessExpiresAt) : null;
        if (role && ['admin', 'user'].includes(role)) {
            user.role = role;
            if (role === 'admin') user.accessGranted = true; // Admin always has access
        }

        await user.save();

        res.json({ message: `Updated access for ${user.name}`, user: user.toObject({ versionKey: false }) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a user entirely (admin only)
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete admin users' });

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: `User ${user.name} deleted` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
