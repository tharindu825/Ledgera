const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    category: {
        type: String,
        default: 'other',
        trim: true
    },
    subcategory: {
        type: String,
        trim: true
    },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'pcs' },
    unitPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true }
});

const billSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    billDate: { type: Date, default: Date.now },
    storeName: { type: String, trim: true, default: 'Unknown Store' },
    items: [billItemSchema],
    totalAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    imageUrl: { type: String, default: '' },
    inputMethod: { type: String, enum: ['manual', 'ocr', 'voice'], default: 'manual' },
    notes: { type: String, default: '' },
    month: { type: Number }, // 1-12
    year: { type: Number }
}, { timestamps: true });

// Auto-set month/year before save
billSchema.pre('save', function (next) {
    if (this.billDate) {
        this.month = this.billDate.getMonth() + 1;
        this.year = this.billDate.getFullYear();
    }
    next();
});

billSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.$set && update.$set.billDate) {
        const d = new Date(update.$set.billDate);
        update.$set.month = d.getMonth() + 1;
        update.$set.year = d.getFullYear();
    } else if (update.billDate) {
        const d = new Date(update.billDate);
        update.month = d.getMonth() + 1;
        update.year = d.getFullYear();
    }
    next();
});

// Index for fast monthly queries
billSchema.index({ userId: 1, year: 1, month: 1 });

module.exports = mongoose.model('Bill', billSchema);
