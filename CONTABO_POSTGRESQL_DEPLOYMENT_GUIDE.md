# 🚀 Ledgera — Contabo Ubuntu Deployment Guide
## PostgreSQL (Self-Hosted, No MongoDB Atlas Required)

> **Target Stack**: Contabo Ubuntu 22.04 LTS · Node.js 20 · PostgreSQL 16 · Sequelize ORM · Nginx · PM2

> [!IMPORTANT]
> This is a **database migration**, not just a hosting change. Your app currently uses MongoDB (Mongoose).
> Switching to PostgreSQL requires replacing **all models, queries, and the DB connection** throughout the codebase.
> Follow every section carefully in order.

---

## 📋 Table of Contents

### Part A — Application Code Changes (Do on Your Local Machine First)
1. [Overview of What Changes](#1-overview-of-what-changes)
2. [Install PostgreSQL Dependencies](#2-install-postgresql-npm-dependencies)
3. [Create the Database Connection File](#3-create-the-database-connection-file)
4. [Rewrite All Models with Sequelize](#4-rewrite-all-models-with-sequelize)
5. [Create DB Migration / Init Script](#5-create-database-migration--init-script)
6. [Update server.js](#6-update-serverjs)
7. [Update All Routes](#7-update-all-routes)
8. [Update .env File](#8-update-env-file)

### Part B — Contabo Server Setup
9. [Create Contabo VPS](#9-create-contabo-vps)
10. [Initial Server Setup](#10-initial-server-setup)
11. [Install PostgreSQL 16](#11-install-postgresql-16)
12. [Create Database & User](#12-create-database--user)
13. [Install Node.js](#13-install-nodejs)
14. [Deploy Ledgera App](#14-deploy-ledgera-app)
15. [Build React Frontend](#15-build-the-react-frontend)
16. [Setup PM2](#16-setup-pm2-process-manager)
17. [Setup Nginx](#17-setup-nginx-reverse-proxy)
18. [Configure Firewall](#18-configure-firewall-ufw)
19. [Environment Variables on Server](#19-environment-variables-on-server)
20. [PostgreSQL Backup Strategy](#20-postgresql-backup-strategy)
21. [Migrate Data from MongoDB Atlas](#21-migrate-data-from-mongodb-atlas)
22. [SSL with Let's Encrypt](#22-ssl-with-lets-encrypt)
23. [Maintenance Cheatsheet](#23-maintenance-cheatsheet)

---

## Part A — Application Code Changes

## 1. Overview of What Changes

| File | Change Type | Why |
|---|---|---|
| `package.json` | Add `pg`, `sequelize`; remove `mongoose` | Replace MongoDB driver with PostgreSQL |
| `server/db.js` | **NEW FILE** | Sequelize connection instance |
| `server/models/*.js` | **REWRITE ALL** | Mongoose → Sequelize models |
| `server/models/index.js` | **NEW FILE** | Association definitions |
| `server/initDb.js` | **NEW FILE** | DB table creation script |
| `server/server.js` | Update DB connection | Replace mongoose.connect |
| `server/routes/*.js` | **Update all queries** | Mongoose syntax → Sequelize syntax |
| `.env` | Change `MONGODB_URI` → `DATABASE_URL` | PostgreSQL connection string |

> [!WARNING]
> This is a **large refactor**. PostgreSQL is installed **only on the Contabo VPS** — not on your Windows PC.
> The recommended workflow is:
> 1. Make all code changes on your local machine (Sections 2–8)
> 2. Keep your local `.env` pointing at **MongoDB Atlas** for now (so dev still works)
> 3. Push the updated code to Contabo via Git or SCP
> 4. On the server, set `DATABASE_URL` in `.env` and run `node server/initDb.js`
> 5. PostgreSQL runs on the Contabo VPS only — your Windows machine never needs it

---

## 2. Install PostgreSQL NPM Dependencies

Run in your project root (`F:\Onedrive\Tharindu\Researches\Ledgera`):

```powershell
npm uninstall mongoose
npm install pg pg-hstore sequelize
```

Your `package.json` dependencies section becomes:

```json
"dependencies": {
  "bcryptjs": "^2.4.3",
  "concurrently": "^8.2.2",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "express": "^4.21.0",
  "jsonwebtoken": "^9.0.2",
  "multer": "^1.4.5-lts.1",
  "pg": "^8.12.0",
  "pg-hstore": "^2.3.4",
  "sequelize": "^6.37.3",
  "tesseract.js": "^5.1.1"
}
```

---

## 3. Create the Database Connection File

Create **`server/db.js`** (new file):

```javascript
// server/db.js — Sequelize PostgreSQL connection
const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? {
            require: true,
            rejectUnauthorized: false
        } : false
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
});

module.exports = sequelize;
```

---

## 4. Rewrite All Models with Sequelize

> [!NOTE]
> PostgreSQL uses **INTEGER** auto-increment IDs instead of MongoDB ObjectId.
> All `_id` references become `id`. All `user` FK fields become `userId`.
> The frontend and JWT work the same — IDs are just integers in JSON now.

### 4.1 — `server/models/index.js` (NEW)

```javascript
// server/models/index.js — load all models and define associations
const sequelize = require('../db');

const User = require('./User');
const Account = require('./Account');
const Transaction = require('./Transaction');
const Bill = require('./Bill');
const BillItem = require('./BillItem');
const Category = require('./Category');
const CategorySubcategorySetting = require('./CategorySubcategorySetting');
const CategoryBudget = require('./CategoryBudget');
const Debt = require('./Debt');
const DebtRepayment = require('./DebtRepayment');
const MonthlySummary = require('./MonthlySummary');
const GroceryPlan = require('./GroceryPlan');
const GroceryPlanItem = require('./GroceryPlanItem');

// User → everything
User.hasMany(Account,           { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(Transaction,       { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(Bill,              { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(Category,          { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(CategoryBudget,    { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(Debt,              { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(MonthlySummary,    { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(GroceryPlan,       { foreignKey: 'userId', onDelete: 'CASCADE' });

Account.belongsTo(User,         { foreignKey: 'userId' });
Transaction.belongsTo(User,     { foreignKey: 'userId' });
Bill.belongsTo(User,            { foreignKey: 'userId' });
Category.belongsTo(User,        { foreignKey: 'userId' });
CategoryBudget.belongsTo(User,  { foreignKey: 'userId' });
Debt.belongsTo(User,            { foreignKey: 'userId' });
MonthlySummary.belongsTo(User,  { foreignKey: 'userId' });
GroceryPlan.belongsTo(User,     { foreignKey: 'userId' });

Transaction.belongsTo(Account,  { foreignKey: 'accountId', as: 'account' });
Transaction.belongsTo(Bill,     { foreignKey: 'receiptId', as: 'receipt' });

Bill.hasMany(BillItem,          { foreignKey: 'billId', onDelete: 'CASCADE', as: 'items' });
BillItem.belongsTo(Bill,        { foreignKey: 'billId' });

Category.hasMany(CategorySubcategorySetting, { foreignKey: 'categoryId', onDelete: 'CASCADE', as: 'subcategorySettings' });
CategorySubcategorySetting.belongsTo(Category, { foreignKey: 'categoryId' });

CategoryBudget.belongsTo(Category, { foreignKey: 'categoryId' });

Debt.hasMany(DebtRepayment,     { foreignKey: 'debtId', onDelete: 'CASCADE', as: 'repayments' });
DebtRepayment.belongsTo(Debt,   { foreignKey: 'debtId' });

GroceryPlan.hasMany(GroceryPlanItem, { foreignKey: 'planId', onDelete: 'CASCADE', as: 'recommendedItems' });
GroceryPlanItem.belongsTo(GroceryPlan, { foreignKey: 'planId' });

module.exports = {
    sequelize,
    User, Account, Transaction, Bill, BillItem,
    Category, CategorySubcategorySetting, CategoryBudget,
    Debt, DebtRepayment, MonthlySummary, GroceryPlan, GroceryPlanItem
};
```

### 4.2 — `server/models/User.js` (REPLACE)

```javascript
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../db');

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'user'), defaultValue: 'user' },
    accessGranted: { type: DataTypes.BOOLEAN, defaultValue: false },
    accessExpiresAt: { type: DataTypes.DATE, allowNull: true },
    monthlyIncome: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    currency: { type: DataTypes.STRING(10), defaultValue: 'LKR' },
    familySize: { type: DataTypes.INTEGER, defaultValue: 1 },
    savingsGoal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    budgetPercentage: { type: DataTypes.INTEGER, defaultValue: 60 },
    avatar: { type: DataTypes.TEXT, defaultValue: '' },
    preferences: {
        type: DataTypes.JSONB,
        defaultValue: { dietaryRestrictions: [], preferLocal: true, notificationsEnabled: true }
    }
}, {
    tableName: 'users',
    timestamps: true,
    hooks: {
        beforeCreate: async (user) => {
            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(user.password, salt);
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(12);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

User.prototype.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;
```

### 4.3 — `server/models/Account.js` (REPLACE)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Account = sequelize.define('Account', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    balance: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    icon: { type: DataTypes.STRING(10), defaultValue: '🏦' },
    color: { type: DataTypes.STRING(20), defaultValue: '#3b82f6' },
    isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
    isArchived: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'accounts', timestamps: true });

module.exports = Account;
```

### 4.4 — `server/models/Transaction.js` (REPLACE)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Transaction = sequelize.define('Transaction', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM('expense', 'income', 'transfer'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    subcategory: { type: DataTypes.STRING },
    merchant: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    month: { type: DataTypes.INTEGER },
    year: { type: DataTypes.INTEGER },
    paymentMethod: { type: DataTypes.STRING(50), defaultValue: 'cash' },
    accountId: { type: DataTypes.INTEGER, allowNull: true },
    receiptId: { type: DataTypes.INTEGER, allowNull: true },
    transferLinkedId: { type: DataTypes.INTEGER, allowNull: true },
    isRecurring: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: { type: DataTypes.ENUM('completed', 'pending'), defaultValue: 'completed' }
}, {
    tableName: 'transactions',
    timestamps: true,
    hooks: {
        beforeCreate: (tx) => {
            if (tx.date) { const d = new Date(tx.date); tx.month = d.getMonth() + 1; tx.year = d.getFullYear(); }
        },
        beforeUpdate: (tx) => {
            if (tx.changed('date') && tx.date) { const d = new Date(tx.date); tx.month = d.getMonth() + 1; tx.year = d.getFullYear(); }
        }
    },
    indexes: [{ fields: ['userId', 'year', 'month', 'type'] }]
});

module.exports = Transaction;
```

### 4.5 — `server/models/Bill.js` (REPLACE)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Bill = sequelize.define('Bill', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    billDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    storeName: { type: DataTypes.STRING, defaultValue: 'Unknown Store' },
    totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    discountAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    imageUrl: { type: DataTypes.TEXT, defaultValue: '' },
    inputMethod: { type: DataTypes.ENUM('manual', 'ocr', 'voice'), defaultValue: 'manual' },
    notes: { type: DataTypes.TEXT, defaultValue: '' },
    month: { type: DataTypes.INTEGER },
    year: { type: DataTypes.INTEGER }
}, {
    tableName: 'bills',
    timestamps: true,
    hooks: {
        beforeCreate: (bill) => {
            if (bill.billDate) { const d = new Date(bill.billDate); bill.month = d.getMonth() + 1; bill.year = d.getFullYear(); }
        },
        beforeUpdate: (bill) => {
            if (bill.changed('billDate') && bill.billDate) { const d = new Date(bill.billDate); bill.month = d.getMonth() + 1; bill.year = d.getFullYear(); }
        }
    },
    indexes: [{ fields: ['userId', 'year', 'month'] }]
});

module.exports = Bill;
```

### 4.6 — `server/models/BillItem.js` (NEW — was embedded in MongoDB)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const BillItem = sequelize.define('BillItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    billId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, defaultValue: 'other' },
    subcategory: { type: DataTypes.STRING },
    quantity: { type: DataTypes.DECIMAL(10, 3), defaultValue: 1 },
    unit: { type: DataTypes.STRING(20), defaultValue: 'pcs' },
    unitPrice: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    totalPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: false }
}, { tableName: 'bill_items', timestamps: false });

module.exports = BillItem;
```

### 4.7 — `server/models/Category.js` (REPLACE)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Category = sequelize.define('Category', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM('expense', 'income'), allowNull: false },
    mainCategory: { type: DataTypes.STRING, allowNull: false },
    icon: { type: DataTypes.STRING(10), defaultValue: '📁' },
    color: { type: DataTypes.STRING(20), defaultValue: '#64748b' },
    budgetGroup: {
        type: DataTypes.ENUM('needs', 'wants', 'savings_debt', 'income', 'unassigned'),
        defaultValue: 'wants'
    },
    monthlyBudget: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    subcategories: { type: DataTypes.JSONB, defaultValue: [] }
}, {
    tableName: 'categories',
    timestamps: true,
    indexes: [{ fields: ['userId', 'type', 'mainCategory'], unique: true }]
});

module.exports = Category;
```

### 4.8 — `server/models/CategorySubcategorySetting.js` (NEW)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const CategorySubcategorySetting = sequelize.define('CategorySubcategorySetting', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    categoryId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    budgetGroup: {
        type: DataTypes.ENUM('needs', 'wants', 'savings_debt', 'income', 'unassigned'),
        defaultValue: 'unassigned'
    },
    monthlyBudget: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 }
}, { tableName: 'category_subcategory_settings', timestamps: false });

module.exports = CategorySubcategorySetting;
```

### 4.9 — `server/models/CategoryBudget.js` (REPLACE)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const CategoryBudget = sequelize.define('CategoryBudget', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    categoryId: { type: DataTypes.INTEGER, allowNull: false },
    subcategory: { type: DataTypes.STRING, allowNull: true },
    month: { type: DataTypes.INTEGER, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    budgetLimit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, validate: { min: 0 } }
}, {
    tableName: 'category_budgets',
    timestamps: true,
    indexes: [{ fields: ['userId', 'categoryId', 'subcategory', 'month', 'year'], unique: true }]
});

module.exports = CategoryBudget;
```

### 4.10 — `server/models/Debt.js` (REPLACE)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Debt = sequelize.define('Debt', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM('owed_by_me', 'owed_to_me'), allowNull: false },
    totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    remainingAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    personName: { type: DataTypes.STRING, allowNull: false },
    dueDate: { type: DataTypes.DATE, allowNull: true },
    interestRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    status: { type: DataTypes.ENUM('active', 'paid'), defaultValue: 'active' },
    notes: { type: DataTypes.TEXT }
}, { tableName: 'debts', timestamps: true });

module.exports = Debt;
```

### 4.11 — `server/models/DebtRepayment.js` (NEW — was embedded array)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const DebtRepayment = sequelize.define('DebtRepayment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    debtId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.DECIMAL(15, 2) },
    date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    note: { type: DataTypes.TEXT },
    accountId: { type: DataTypes.INTEGER, allowNull: true },
    transactionId: { type: DataTypes.INTEGER, allowNull: true }
}, { tableName: 'debt_repayments', timestamps: false });

module.exports = DebtRepayment;
```

### 4.12 — `server/models/MonthlySummary.js` (REPLACE)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const MonthlySummary = sequelize.define('MonthlySummary', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    month: { type: DataTypes.INTEGER, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    totalSpent: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    totalBills: { type: DataTypes.INTEGER, defaultValue: 0 },
    categoryBreakdown: { type: DataTypes.JSONB, defaultValue: {} },
    weeklySpending: { type: DataTypes.JSONB, defaultValue: [] },
    dailySpending: { type: DataTypes.JSONB, defaultValue: [] },
    budgetLimit: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    monthlyIncome: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    budgetPercentage: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    remainingBudget: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    savingsAchieved: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    alerts: { type: DataTypes.JSONB, defaultValue: [] }
}, {
    tableName: 'monthly_summaries',
    timestamps: true,
    indexes: [{ fields: ['userId', 'year', 'month'], unique: true }]
});

module.exports = MonthlySummary;
```

### 4.13 — `server/models/GroceryPlan.js` (REPLACE)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const GroceryPlan = sequelize.define('GroceryPlan', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    month: { type: DataTypes.INTEGER, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    totalEstimatedCost: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    potentialSavings: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    tips: { type: DataTypes.JSONB, defaultValue: [] },
    healthScore: { type: DataTypes.INTEGER, defaultValue: 0 },
    generatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'grocery_plans',
    timestamps: true,
    indexes: [{ fields: ['userId', 'year', 'month'] }]
});

module.exports = GroceryPlan;
```

### 4.14 — `server/models/GroceryPlanItem.js` (NEW)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const GroceryPlanItem = sequelize.define('GroceryPlanItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    planId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING },
    category: { type: DataTypes.STRING },
    estimatedPrice: { type: DataTypes.DECIMAL(15, 2) },
    alternative: { type: DataTypes.STRING },
    alternativePrice: { type: DataTypes.DECIMAL(15, 2) },
    reason: { type: DataTypes.TEXT }
}, { tableName: 'grocery_plan_items', timestamps: false });

module.exports = GroceryPlanItem;
```

---

## 5. Create Database Migration / Init Script

Create **`server/initDb.js`**:

```javascript
// server/initDb.js — Run once to create all PostgreSQL tables
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('./models/index');

async function initDb() {
    try {
        console.log('🔌 Connecting to PostgreSQL...');
        await sequelize.authenticate();
        console.log('✅ Connected to PostgreSQL successfully');

        console.log('📦 Creating/updating tables...');
        await sequelize.sync({ alter: true });

        console.log('✅ All tables created/updated successfully');
        console.log('\nTables:');
        console.log('  users, accounts, transactions, bills, bill_items');
        console.log('  categories, category_subcategory_settings, category_budgets');
        console.log('  debts, debt_repayments, monthly_summaries');
        console.log('  grocery_plans, grocery_plan_items');

        process.exit(0);
    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
        process.exit(1);
    }
}

initDb();
```

Run it once after deploying:
```bash
node server/initDb.js
```

---

## 6. Update `server/server.js`

Replace the entire file:

```javascript
// server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('./models/index');

const authRoutes        = require('./routes/auth');
const billRoutes        = require('./routes/bills');
const budgetRoutes      = require('./routes/budget');
const dashboardRoutes   = require('./routes/dashboard');
const aiRoutes          = require('./routes/ai');
const ocrRoutes         = require('./routes/ocr');
const transactionRoutes = require('./routes/transactions');
const debtRoutes        = require('./routes/debts');
const accountRoutes     = require('./routes/accounts');
const categoryRoutes    = require('./routes/categories');
const adminRoutes       = require('./routes/admin');
const walletRoutes      = require('./routes/wallet');
const transferRoutes    = require('./routes/transfers');
const categoryBudgetRoutes = require('./routes/categoryBudget');

const app = express();

app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',            authRoutes);
app.use('/api/bills',           billRoutes);
app.use('/api/budget',          budgetRoutes);
app.use('/api/dashboard',       dashboardRoutes);
app.use('/api/ai',              aiRoutes);
app.use('/api/ocr',             ocrRoutes);
app.use('/api/transactions',    transactionRoutes);
app.use('/api/debts',           debtRoutes);
app.use('/api/accounts',        accountRoutes);
app.use('/api/categories',      categoryRoutes);
app.use('/api/admin',           adminRoutes);
app.use('/api/wallet',          walletRoutes);
app.use('/api/transfers',       transferRoutes);
app.use('/api/category-budget', categoryBudgetRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: 'postgresql', timestamp: new Date().toISOString() });
});

const fs = require('fs');
const clientDistPath = path.resolve(__dirname, '..', 'client', 'dist');

if (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(clientDistPath, 'index.html'))) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint not found' });
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

const PORT = process.env.PORT || 5000;

sequelize.authenticate()
    .then(() => {
        console.log('✅ Connected to PostgreSQL - Ledgera Database');
        return sequelize.sync();
    })
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 Ledgera Executive API Ready`);
        });
    })
    .catch(err => {
        console.error('❌ PostgreSQL connection error:', err.message);
        process.exit(1);
    });

module.exports = app;
```

---

## 7. Update All Routes

### Quick Reference: Mongoose → Sequelize Syntax

| Operation | Mongoose | Sequelize |
|---|---|---|
| Find all | `Model.find({ user: id })` | `Model.findAll({ where: { userId: id } })` |
| Find one | `Model.findOne({ _id: id })` | `Model.findOne({ where: { id } })` |
| Find by ID | `Model.findById(id)` | `Model.findByPk(id)` |
| Create | `new Model({...}); await m.save()` | `await Model.create({...})` |
| Update | `Model.findByIdAndUpdate(id, data)` | `await Model.update(data, { where: { id } })` |
| Delete | `Model.findByIdAndDelete(id)` | `await Model.destroy({ where: { id } })` |
| Count | `Model.countDocuments({...})` | `Model.count({ where: {...} })` |
| Increment | `{ $inc: { balance: delta } }` | `Model.increment('balance', { by: delta, where: {...} })` |
| Sort (asc) | `.sort({ createdAt: 1 })` | `order: [['createdAt', 'ASC']]` |
| Sort (desc) | `.sort({ createdAt: -1 })` | `order: [['createdAt', 'DESC']]` |
| Populate | `.populate('account')` | `include: [{ model: Account, as: 'account' }]` |
| Select fields | `.select('-password')` | `attributes: { exclude: ['password'] }` |
| FK field | `user: req.userId` | `userId: req.userId` |
| ID field | `_id` | `id` |
| Aggregation sum | `$group/$sum` | `fn('SUM', col('amount'))` + `group` |

### 7.1 — `server/routes/auth.js` (REPLACE)

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/index');
const auth = require('../middleware/auth');
const router = express.Router();
const { seedDefaultCategories } = require('../utils/categoryHelper');

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, monthlyIncome, familySize, currency } = req.body;

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'Email already registered' });

        const userCount = await User.count();
        const isFirstUser = userCount === 0;

        const user = await User.create({
            name, email, password,
            monthlyIncome: monthlyIncome || 0,
            familySize: familySize || 1,
            currency: currency || 'LKR',
            role: isFirstUser ? 'admin' : 'user',
            accessGranted: isFirstUser,
            accessExpiresAt: null
        });

        await seedDefaultCategories(user.id);

        if (!user.accessGranted) {
            return res.status(201).json({
                pendingAccess: true,
                message: 'Account created! Please wait for the administrator to grant you access.'
            });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({
            token,
            user: {
                id: user.id, name: user.name, email: user.email,
                role: user.role, accessGranted: user.accessGranted,
                accessExpiresAt: user.accessExpiresAt,
                monthlyIncome: user.monthlyIncome, familySize: user.familySize,
                currency: user.currency, budgetPercentage: user.budgetPercentage,
                savingsGoal: user.savingsGoal
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.email === 'cvsushi14@gmail.com' && user.role !== 'admin') {
            await user.update({ role: 'admin', accessGranted: true });
        }

        if (user.role !== 'admin') {
            if (!user.accessGranted) return res.status(403).json({ error: 'ACCESS_DENIED', message: "You don't have access to this system." });
            if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) return res.status(403).json({ error: 'ACCESS_EXPIRED', message: 'Your access has expired.' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({
            token,
            user: {
                id: user.id, name: user.name, email: user.email,
                role: user.role, accessGranted: user.accessGranted,
                accessExpiresAt: user.accessExpiresAt,
                monthlyIncome: user.monthlyIncome, familySize: user.familySize,
                currency: user.currency, budgetPercentage: user.budgetPercentage,
                savingsGoal: user.savingsGoal, preferences: user.preferences
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/profile', auth, async (req, res) => {
    res.json({ user: req.user });
});

router.put('/profile', auth, async (req, res) => {
    try {
        const allowed = ['name', 'monthlyIncome', 'familySize', 'savingsGoal', 'budgetPercentage', 'currency', 'preferences'];
        const filtered = {};
        Object.keys(req.body).forEach(k => { if (allowed.includes(k)) filtered[k] = req.body[k]; });
        await User.update(filtered, { where: { id: req.userId } });
        const user = await User.findByPk(req.userId, { attributes: { exclude: ['password'] } });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
```

### 7.2 — `server/routes/accounts.js` (REPLACE)

```javascript
const express = require('express');
const { Account } = require('../models/index');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
    try {
        let accounts = await Account.findAll({
            where: { userId: req.userId, isArchived: false },
            order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
        });
        if (!accounts.find(a => a.isDefault)) {
            const cash = await Account.create({ userId: req.userId, name: 'Cash', balance: 0, icon: '💵', color: '#10b981', isDefault: true });
            accounts.unshift(cash);
        }
        res.json(accounts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
    try {
        const { name, balance, icon, color } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Account name is required' });
        const existing = await Account.findOne({ where: { userId: req.userId, name: name.trim(), isArchived: false } });
        if (existing) return res.status(409).json({ error: 'Account with this name already exists' });
        const account = await Account.create({ userId: req.userId, name: name.trim(), balance: parseFloat(balance) || 0, icon: icon || '🏦', color: color || '#3b82f6' });
        res.status(201).json(account);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
    try {
        const { name, balance, icon, color } = req.body;
        const [updated] = await Account.update({ name, balance: parseFloat(balance) || 0, icon, color }, { where: { id: req.params.id, userId: req.userId } });
        if (!updated) return res.status(404).json({ error: 'Account not found' });
        res.json(await Account.findByPk(req.params.id));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/adjust', auth, async (req, res) => {
    try {
        const { amount, operation } = req.body;
        const delta = operation === 'subtract' ? -(parseFloat(amount) || 0) : (parseFloat(amount) || 0);
        await Account.increment('balance', { by: delta, where: { id: req.params.id, userId: req.userId } });
        const account = await Account.findByPk(req.params.id);
        if (!account) return res.status(404).json({ error: 'Account not found' });
        res.json(account);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const account = await Account.findOne({ where: { id: req.params.id, userId: req.userId } });
        if (!account) return res.status(404).json({ error: 'Account not found' });
        if (account.isDefault) return res.status(400).json({ error: 'Cannot delete the default Cash account' });
        await account.update({ isArchived: true });
        res.json({ message: 'Account archived' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
```

> [!NOTE]
> The remaining route files (`bills.js`, `transactions.js`, `categories.js`, `categoryBudget.js`, `debts.js`, `dashboard.js`, `budget.js`, `admin.js`, `transfers.js`, `wallet.js`, `ai.js`, `ocr.js`) follow the **exact same pattern**:
> 1. Change `require('../models/ModelName')` → `const { ModelName } = require('../models/index')`
> 2. Change `user: req.userId` → `userId: req.userId`
> 3. Change `_id` → `id` everywhere
> 4. Change `Model.find({})` → `Model.findAll({ where: {} })`
> 5. Change `Model.findById(id)` → `Model.findByPk(id)`
> 6. Change `{ $inc: { field: val } }` → `Model.increment('field', { by: val, where: {} })`
> 7. Change `.populate('x')` → `include: [{ model: X, as: 'x' }]`
>
> Ask for specific route files to be rewritten and I'll handle each one.

---

## 8. Update `.env` File

**Your local `.env` (Windows dev machine) — keep MongoDB Atlas during development:**

> [!NOTE]
> You do **not** install PostgreSQL on Windows. Keep using MongoDB Atlas locally while you code and test the changes. Once you push to Contabo, the server `.env` will use `DATABASE_URL` pointing to the local PostgreSQL instance on the VPS.

```env
# ─── DATABASE CONFIGURATION (local dev — still MongoDB) ──────────────────────
MONGODB_URI=mongodb+srv://tharindudilshan0825:Ddunac%4041@cluster0.l0r9b.mongodb.net/Ledgera?appName=Cluster0

# ─── AUTHENTICATION ─────────────────────────────────────────────────────────
JWT_SECRET=grocery_planner_secret_key_2024_ultra_secure

# ─── SERVER SETTINGS ────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ─── APP URL ────────────────────────────────────────────────────────────────
APP_URL=http://localhost:3000

# ─── AI OCR CONFIGURATION (OPENROUTER) ──────────────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# ─── BUDGETBAKERS WALLET API ────────────────────────────────────────────────
WALLET_API_KEY=your-wallet-api-key-here
```

> [!IMPORTANT]
> Because your local dev still uses MongoDB and the server uses PostgreSQL, your `server/db.js` and `server/server.js` must read `DATABASE_URL` (not `MONGODB_URI`). This means **local dev will break** once you switch the server files. The clean approach:
> - Finish all code changes → commit to Git
> - Push to Contabo → set `DATABASE_URL` on the server → run `initDb.js`
> - Only then remove `MONGODB_URI` from your local `.env` if you want to test against the VPS DB remotely

---

## Part B — Contabo Server Setup

## 9. Create Contabo VPS

1. Go to https://contabo.com → **Cloud VPS** → Choose a plan
2. Recommended: **VPS S** (2 vCores, 4 GB RAM, €4.99/mo) — plenty for this app
3. Choose:
   - **OS**: Ubuntu 22.04 LTS
   - **Region**: Germany or Asia (Singapore if available)
4. Complete checkout — you'll receive IP and root password by email

---

## 10. Initial Server Setup

```bash
# Connect via SSH
ssh root@YOUR_CONTABO_IP

# Create non-root user
adduser ledgera
usermod -aG sudo ledgera

# Update system
apt update && apt upgrade -y
apt install -y curl wget git unzip gnupg2

# Switch to app user
su - ledgera
```

---

## 11. Install PostgreSQL 16

```bash
# Add official PostgreSQL repository
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
  sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
sudo apt install -y postgresql-16

sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify
sudo systemctl status postgresql    # Should show "active (running)"
```

---

## 12. Create Database & User

```bash
sudo -i -u postgres psql
```

Run in the psql shell:

```sql
-- Create database
CREATE DATABASE ledgera;

-- Create dedicated app user
CREATE USER ledgera_user WITH ENCRYPTED PASSWORD 'YourStrongPassword456!';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ledgera TO ledgera_user;

-- PostgreSQL 15+ schema privileges
\c ledgera
GRANT ALL ON SCHEMA public TO ledgera_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ledgera_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ledgera_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ledgera_user;

\q
```

```bash
# Go back to ledgera user
exit

# Test connection (enter your password when prompted)
psql -U ledgera_user -d ledgera -h localhost -W
# If you see "ledgera=>" it works!
\q
```

### Lock down PostgreSQL to localhost only

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
# Set: listen_addresses = 'localhost'

sudo systemctl restart postgresql
```

---

## 13. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node --version   # v20.x.x
npm --version    # 10.x.x
```

---

## 14. Deploy Ledgera App

```bash
sudo mkdir -p /var/www/ledgera
sudo chown ledgera:ledgera /var/www/ledgera
```

**Option A — Git:**
```bash
cd /var/www/ledgera
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
```

**Option B — SCP from Windows (PowerShell):**
```powershell
scp -r "F:\Onedrive\Tharindu\Researches\Ledgera\server" ledgera@YOUR_CONTABO_IP:/var/www/ledgera/
scp -r "F:\Onedrive\Tharindu\Researches\Ledgera\client" ledgera@YOUR_CONTABO_IP:/var/www/ledgera/
scp "F:\Onedrive\Tharindu\Researches\Ledgera\package.json" ledgera@YOUR_CONTABO_IP:/var/www/ledgera/
scp "F:\Onedrive\Tharindu\Researches\Ledgera\package-lock.json" ledgera@YOUR_CONTABO_IP:/var/www/ledgera/
# NEVER upload .env or node_modules
```

```bash
# On server: install dependencies
cd /var/www/ledgera
npm install --production
npm --prefix client install

# Create uploads dir
mkdir -p /var/www/ledgera/server/uploads
chmod 755 /var/www/ledgera/server/uploads
```

---

## 15. Build the React Frontend

```bash
cd /var/www/ledgera
npm run build
# Outputs to client/dist/ — Express serves this in production
```

---

## 16. Setup PM2 Process Manager

```bash
sudo npm install -g pm2

cd /var/www/ledgera
pm2 start server/server.js --name ledgera

pm2 save
pm2 startup systemd
# Copy and run the command it outputs, e.g.:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ledgera --hp /home/ledgera
```

```bash
# Useful commands
pm2 status           # Check if running
pm2 logs ledgera     # Live logs
pm2 restart ledgera  # Restart
```

---

## 17. Setup Nginx Reverse Proxy

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/ledgera
```

Paste:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /uploads/ {
        alias /var/www/ledgera/server/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ledgera /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # Should say "syntax is ok"
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 18. Configure Firewall (UFW)

```bash
sudo ufw enable

sudo ufw allow OpenSSH      # SSH — do this FIRST!
sudo ufw allow 'Nginx Full' # HTTP + HTTPS

# Block direct access to app and DB ports
sudo ufw deny 5000
sudo ufw deny 5432

sudo ufw status
```

---

## 19. Environment Variables on Server

```bash
nano /var/www/ledgera/.env
```

```env
# ─── DATABASE CONFIGURATION ──────────────────────────────────────────────────
DATABASE_URL=postgresql://ledgera_user:YourStrongPassword456!@localhost:5432/ledgera
DB_SSL=false

# ─── AUTHENTICATION ─────────────────────────────────────────────────────────
JWT_SECRET=paste_64_byte_hex_generated_below

# ─── SERVER SETTINGS ────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=production

# ─── APP URL ────────────────────────────────────────────────────────────────
APP_URL=https://yourdomain.com

# ─── AI OCR CONFIGURATION (OPENROUTER) ──────────────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-your-actual-key

# ─── BUDGETBAKERS WALLET API ────────────────────────────────────────────────
WALLET_API_KEY=your-actual-wallet-api-key
```

```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Secure the .env file
chmod 600 /var/www/ledgera/.env

# Initialize the PostgreSQL tables (run ONCE after .env is ready)
node /var/www/ledgera/server/initDb.js

# Restart app
pm2 restart ledgera
pm2 logs ledgera --lines 30
```

---

## 20. PostgreSQL Backup Strategy

### Manual Backup

```bash
mkdir -p /home/ledgera/backups

pg_dump \
  -U ledgera_user \
  -h localhost \
  -d ledgera \
  -F c \
  -f /home/ledgera/backups/ledgera-$(date +%Y-%m-%d).dump
```

### Automated Daily Backup Script

```bash
nano /home/ledgera/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/ledgera/backups"
DATE=$(date +%Y-%m-%d_%H-%M)
export PGPASSWORD="YourStrongPassword456!"

mkdir -p "$BACKUP_DIR"

pg_dump \
  -U ledgera_user \
  -h localhost \
  -d ledgera \
  -F c \
  -f "$BACKUP_DIR/ledgera-$DATE.dump"

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete
echo "Backup completed: $DATE"
```

```bash
chmod +x /home/ledgera/backup.sh
crontab -e
# Add:
0 2 * * * /home/ledgera/backup.sh >> /home/ledgera/backup.log 2>&1
```

### Restore from Backup

```bash
pg_restore \
  -U ledgera_user \
  -h localhost \
  -d ledgera \
  --clean \
  /home/ledgera/backups/ledgera-2026-09-28_02-00.dump
```

---

## 21. Migrate Data from MongoDB Atlas

Since the DB is changing from MongoDB to PostgreSQL, you **cannot directly dump and restore**.

### Option A — Start Fresh (Recommended if data is not critical)
Just run `node server/initDb.js` — all tables are created fresh. Users re-register.

### Option B — Write a One-Time Migration Script

Create a script that reads from MongoDB Atlas and inserts to PostgreSQL:

```javascript
// server/migrate_to_pg.js — Run ONCE, then delete
// Requires: npm install mongoose (temporarily)
// Set both MONGODB_URI and DATABASE_URL in .env

const mongoose = require('mongoose');
const { User, Account, Transaction, Category, Debt, DebtRepayment, Bill, BillItem, sequelize } = require('./models/index');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

// Define minimal old Mongoose schemas for reading
const OldUserSchema = new mongoose.Schema({}, { strict: false });
const OldUser = mongoose.model('User', OldUserSchema);
// ... add other models similarly

async function migrate() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    await sequelize.authenticate();
    await sequelize.sync({ force: true }); // WARNING: drops existing PG tables
    console.log('✅ PostgreSQL tables recreated');

    // Migrate Users
    const users = await OldUser.find({});
    const userMap = {};  // Maps old ObjectId → new integer id
    for (const u of users) {
        const newUser = await User.create({
            name: u.name, email: u.email,
            password: u.password, // already hashed - bypass hook
            role: u.role, accessGranted: u.accessGranted,
            accessExpiresAt: u.accessExpiresAt,
            monthlyIncome: u.monthlyIncome, currency: u.currency,
            familySize: u.familySize, savingsGoal: u.savingsGoal,
            budgetPercentage: u.budgetPercentage, preferences: u.preferences
        });
        userMap[u._id.toString()] = newUser.id;
    }
    console.log(`✅ Migrated ${users.length} users`);

    // ... repeat for other collections using userMap to translate ObjectIds

    console.log('✅ Migration complete!');
    process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
```

> [!WARNING]
> When bypassing the password hash hook in migration, set the model hook to check for `$fromMigration` flag, or temporarily remove the `beforeCreate` hook.

---

## 22. SSL with Let's Encrypt

Only if you have a domain pointed to your Contabo IP:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## 23. Maintenance Cheatsheet

### Update the App

```bash
cd /var/www/ledgera
git pull
npm install --production
npm --prefix client install
npm run build
node server/initDb.js    # Only if you changed models
pm2 restart ledgera
```

### View Logs

```bash
pm2 logs ledgera                              # App logs
sudo tail -f /var/log/nginx/error.log         # Nginx errors
sudo journalctl -u postgresql -f              # PostgreSQL logs
```

### PostgreSQL Shell

```bash
psql -U ledgera_user -d ledgera -h localhost -W
```

Useful psql commands:
```sql
\dt                         -- List all tables
\d users                    -- Describe table
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM transactions;
\q                          -- Quit
```

### Restart Everything

```bash
sudo systemctl restart postgresql
pm2 restart ledgera
sudo systemctl restart nginx
```

---

## Summary: Everything That Changes

| Component | Before (MongoDB Atlas) | After (Contabo + PostgreSQL) |
|---|---|---|
| `MONGODB_URI` env var | `mongodb+srv://...atlas.net` | **Removed** |
| `DATABASE_URL` env var | Not present | `postgresql://user:pass@localhost:5432/ledgera` |
| Node package | `mongoose ^8.7` | `pg ^8.12`, `sequelize ^6.37`, `pg-hstore ^2.3` |
| DB connection | `mongoose.connect()` | `sequelize.authenticate()` |
| Models | Mongoose schemas (9 files) | Sequelize models (13 files — 4 new for embedded arrays) |
| Embedded docs | `items: [billItemSchema]` | Separate `bill_items` table |
| Primary keys | ObjectId (24-char hex) | INTEGER AUTO_INCREMENT |
| JSON fields | `Schema.Types.Mixed` | `DataTypes.JSONB` |
| Query syntax | `Model.find({user: id})` | `Model.findAll({where:{userId: id}})` |
| Aggregations | MongoDB `$group/$sum` | Sequelize `fn('SUM', col('x'))` + `group` |
| DB hosting | Atlas cloud (managed) | PostgreSQL on Contabo VPS |
| Backups | Atlas auto-backup | `pg_dump` cron job |
| Frontend | Vite dev server | Express serves `client/dist` |
| Process manager | `npm start` | PM2 (auto-restart) |
| Reverse proxy | None | Nginx (80/443 → 5000) |
| SSL | None | Let's Encrypt (free) |

---

> [!TIP]
> **Contabo Value**: VPS S (2 vCores, 4 GB RAM) at €4.99/mo is better value than Linode Nanode ($5/mo, 1 GB RAM). PostgreSQL + Node.js + Nginx runs comfortably on 4 GB RAM.

> [!NOTE]
> The route files are the most time-consuming part — each of the 12 route files needs Mongoose → Sequelize syntax conversion. Start with `auth.js` and `accounts.js` (done above), test those locally, then work through the others one by one. Ask me to rewrite any specific route file.
