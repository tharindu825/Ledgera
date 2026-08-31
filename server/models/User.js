const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    accessGranted: { type: Boolean, default: false },       // Admin must grant access
    accessExpiresAt: { type: Date, default: null },          // null = no expiry once granted
    monthlyIncome: { type: Number, default: 0 },
    currency: { type: String, default: 'LKR' },
    familySize: { type: Number, default: 1 },
    savingsGoal: { type: Number, default: 0 },
    budgetPercentage: { type: Number, default: 60 }, // % of income for groceries
    avatar: { type: String, default: '' },
    preferences: {
        dietaryRestrictions: [String],
        preferLocal: { type: Boolean, default: true },
        notificationsEnabled: { type: Boolean, default: true }
    }
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
