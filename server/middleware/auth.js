const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(401).json({ error: 'User not found.' });
        }

        // Check if user has access (admin always has access)
        if (user.role !== 'admin') {
            if (!user.accessGranted) {
                return res.status(403).json({
                    error: 'ACCESS_DENIED',
                    message: 'Your access has been revoked. Please contact your administrator.'
                });
            }

            // Check if access has expired
            if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) {
                return res.status(403).json({
                    error: 'ACCESS_EXPIRED',
                    message: 'Your access period has expired. Please contact your administrator to renew.'
                });
            }
        }

        req.user = user;
        req.userId = user._id;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token.' });
    }
};

// Admin-only middleware (use after auth)
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
};

module.exports = auth;
module.exports.adminOnly = adminOnly;
