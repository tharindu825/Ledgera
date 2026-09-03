const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const authRoutes = require('./routes/auth');
const billRoutes = require('./routes/bills');
const budgetRoutes = require('./routes/budget');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const ocrRoutes = require('./routes/ocr');
const transactionRoutes = require('./routes/transactions');
const debtRoutes = require('./routes/debts');
const accountRoutes = require('./routes/accounts');
const categoryRoutes = require('./routes/categories');
const adminRoutes = require('./routes/admin');
const walletRoutes = require('./routes/wallet');
const transferRoutes = require('./routes/transfers');
const categoryBudgetRoutes = require('./routes/categoryBudget');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/category-budget', categoryBudgetRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static assets in production or if client/dist exists
const fs = require('fs');
const clientDistPath = path.resolve(__dirname, '..', 'client', 'dist');

if (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(clientDistPath, 'index.html'))) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas - Ledgera Database');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 LAN access: http://<your-ip>:${PORT}`);
      console.log(`📱 Ledgera Executive API Ready`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;
