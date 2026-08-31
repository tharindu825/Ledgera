const express = require('express');
const Bill = require('../models/Bill');
const MonthlySummary = require('../models/MonthlySummary');
const GroceryPlan = require('../models/GroceryPlan');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { analyzeBudget, generateGroceryPlan, predictExpenses, predictCategory } = require('../services/aiEngine');
const Account = require('../models/Account');
const Debt = require('../models/Debt');
const Transaction = require('../models/Transaction');
const router = express.Router();

// Smart category prediction
router.post('/predict-category', auth, async (req, res) => {
    try {
        const { itemName } = req.body;
        if (!itemName) return res.status(400).json({ error: 'itemName is required' });
        const prediction = predictCategory(itemName);
        res.json(prediction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get AI budget analysis
router.get('/analysis', auth, async (req, res) => {
    try {
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();
        const user = await User.findById(req.userId);
        const summary = await MonthlySummary.findOne({ userId: req.userId, month, year });
        const analysis = analyzeBudget(user, summary);
        res.json({ analysis, month, year });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate AI grocery plan
router.get('/plan', auth, async (req, res) => {
    try {
        const now = new Date();
        const user = await User.findById(req.userId);
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const previousBills = await Bill.find({ userId: req.userId, billDate: { $gte: threeMonthsAgo } });
        const summary = await MonthlySummary.findOne({ userId: req.userId, month: now.getMonth() + 1, year: now.getFullYear() });
        const plan = generateGroceryPlan(user, summary, previousBills);
        const nextMonth = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
        const nextYear = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();
        await GroceryPlan.findOneAndUpdate(
            { userId: req.userId, month: nextMonth, year: nextYear },
            { userId: req.userId, month: nextMonth, year: nextYear, ...plan, generatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ plan, forMonth: nextMonth, forYear: nextYear });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get expense prediction
router.get('/predict', auth, async (req, res) => {
    try {
        const now = new Date();
        const user = await User.findById(req.userId);
        const budgetLimit = (user.monthlyIncome * user.budgetPercentage) / 100;
        const trendData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now); d.setMonth(d.getMonth() - i);
            const m = d.getMonth() + 1; const y = d.getFullYear();
            const s = await MonthlySummary.findOne({ userId: req.userId, month: m, year: y });
            trendData.push({ month: m, year: y, totalSpent: s ? s.totalSpent : 0 });
        }
        const prediction = predictExpenses(trendData);
        res.json({ prediction, budgetLimit, currency: user.currency, trendData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Smart alerts
router.get('/alerts', auth, async (req, res) => {
    try {
        const now = new Date();
        const summary = await MonthlySummary.findOne({ userId: req.userId, month: now.getMonth() + 1, year: now.getFullYear() });
        const user = await User.findById(req.userId);
        const budgetLimit = (user.monthlyIncome * user.budgetPercentage) / 100;
        const totalSpent = summary?.totalSpent || 0;
        const spentPercent = budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0;
        const alerts = summary?.alerts || [];
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const expectedSpentPercent = (daysPassed / daysInMonth) * 100;
        if (spentPercent > expectedSpentPercent * 1.3 && totalSpent > 0) {
            alerts.push({ type: 'pace_alert', message: `You're spending faster than expected. At this pace, you'll exceed your budget by ${Math.round(totalSpent * (daysInMonth / daysPassed) - budgetLimit).toLocaleString()} LKR.`, severity: 'warning' });
        }
        const remainingBudget = budgetLimit - totalSpent;
        const daysRemaining = daysInMonth - daysPassed;
        if (daysRemaining > 0 && remainingBudget > 0) {
            alerts.push({ type: 'daily_budget', message: `Daily budget remaining: ${Math.round(remainingBudget / daysRemaining).toLocaleString()} LKR per day`, severity: 'info' });
        }
        if (remainingBudget > budgetLimit * 0.3 && daysPassed > daysInMonth * 0.5) {
            const savings = Math.round(remainingBudget - budgetLimit * 0.1);
            if (savings > 0) alerts.push({ type: 'savings_opportunity', message: `Great news! You can save about ${savings.toLocaleString()} LKR this month.`, severity: 'info' });
        }
        res.json({ alerts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI Chatbot — comprehensive financial data context
router.post('/chat', auth, async (req, res) => {
    try {
        const { message, chatHistory = [] } = req.body;
        if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

        const now = new Date();
        const currMonth = now.getMonth() + 1;
        const currYear = now.getFullYear();
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        const user = await User.findById(req.userId);
        if (!user) return res.status(401).json({ error: 'User not found' });
        const budgetLimit = Math.round((user.monthlyIncome || 0) * (user.budgetPercentage || 0) / 100);

        // Fetch ALL data (no limits)
        console.log('[AI /chat] Fetching data for user:', req.userId);
        const [allBills, allSummaries, accounts, allDebts, allTransactions] = await Promise.all([
            Bill.find({ userId: req.userId }).sort({ billDate: -1 }).lean(),
            MonthlySummary.find({ userId: req.userId }).sort({ year: -1, month: -1 }).lean(),
            Account.find({ user: req.userId }).lean(),
            Debt.find({ user: req.userId }).lean(),
            Transaction.find({ user: req.userId }).sort({ date: -1 }).lean()
        ]);

        console.log('[AI /chat] Data fetched. Summaries:', allSummaries.length, 'Transactions:', allTransactions.length);

        // Current month
        const currSummary = allSummaries.find(s => s.month === currMonth && s.year === currYear);
        const currSpent   = currSummary?.totalSpent || 0;
        const daysInMonth = new Date(currYear, currMonth, 0).getDate();
        const daysPassed  = now.getDate();
        const daysLeft    = daysInMonth - daysPassed;
        const dailyRate   = daysPassed > 0 ? Math.round(currSpent / daysPassed) : 0;

        // This week
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const thisWeekTx  = allTransactions.filter(t => new Date(t.date) >= startOfWeek);
        const weekExpense = Math.round(thisWeekTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0));
        const weekIncome  = Math.round(thisWeekTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0));

        // Last week
        const startOfLastWeek = new Date(startOfWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
        const lastWeekTx = allTransactions.filter(t => { const d = new Date(t.date); return d >= startOfLastWeek && d < startOfWeek; });
        const lastWeekExpense = Math.round(lastWeekTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0));

        // 12-month income/expense/savings breakdown
        const monthlyBreakdown = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(currYear, currMonth - 1 - i, 1);
            const m = d.getMonth() + 1; const y = d.getFullYear();
            const s = allSummaries.find(x => x.month === m && x.year === y);
            const mTx = allTransactions.filter(t => t.month === m && t.year === y);
            const income    = Math.round(mTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0));
            const expense   = Math.round(mTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0));
            const groceries = Math.round(s?.totalSpent || 0);
            if (income > 0 || expense > 0 || groceries > 0) {
                monthlyBreakdown.push({
                    period: `${monthNames[m-1]} ${y}`, income, expense, grocerySpend: groceries,
                    totalOutflow: expense + groceries, savings: income - expense - groceries,
                    budgetUsed: budgetLimit > 0 ? Math.round((groceries / budgetLimit) * 100) : 0
                });
            }
        }

        // Category spending — current month (transactions)
        const currMonthTx = allTransactions.filter(t => t.month === currMonth && t.year === currYear);
        const catExpMap   = {};
        currMonthTx.filter(t => t.type === 'expense').forEach(t => {
            const c = (t.category || 'other').toLowerCase();
            catExpMap[c] = (catExpMap[c] || 0) + t.amount;
        });
        const txCategoryThisMonth = Object.entries(catExpMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => ({ category: cat, amount: Math.round(amt) }));

        // Category spending — all time (transactions)
        const allCatMap = {};
        allTransactions.filter(t => t.type === 'expense').forEach(t => {
            const c = (t.category || 'other').toLowerCase();
            allCatMap[c] = (allCatMap[c] || 0) + t.amount;
        });
        const allTimeCategorySpend = Object.entries(allCatMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => ({ category: cat, amount: Math.round(amt) }));

        // Income sources (all time)
        const incomeSourceMap = {};
        allTransactions.filter(t => t.type === 'income').forEach(t => {
            const c = t.category || 'other';
            incomeSourceMap[c] = (incomeSourceMap[c] || 0) + t.amount;
        });
        const incomeSources = Object.entries(incomeSourceMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => ({ source: cat, totalReceived: Math.round(amt) }));

        // Recent 30 transactions
        const recent30Tx = allTransactions.slice(0, 30).map(t => ({
            date: new Date(t.date).toLocaleDateString('en-GB'), type: t.type, category: t.category,
            description: t.description || t.merchant || '', amount: Math.round(t.amount), paymentMethod: t.paymentMethod
        }));

        // Store analysis
        const storeMap = {};
        allBills.forEach(b => {
            const s = b.storeName || 'Unknown';
            if (!storeMap[s]) storeMap[s] = { visits: 0, total: 0 };
            storeMap[s].visits++; storeMap[s].total += b.totalAmount || 0;
        });
        const topStores = Object.entries(storeMap).sort((a, b) => b[1].total - a[1].total).slice(0, 8)
            .map(([store, d]) => ({ store, visits: d.visits, totalSpent: Math.round(d.total), avgPerVisit: Math.round(d.total / d.visits) }));

        // Item frequency
        const itemMap = {};
        allBills.forEach(b => {
            (b.items || []).forEach(item => {
                const key = (item.name || '').toLowerCase().trim();
                if (!key) return;
                if (!itemMap[key]) itemMap[key] = { name: item.name, count: 0, totalSpent: 0 };
                itemMap[key].count++; itemMap[key].totalSpent += item.totalPrice || 0;
            });
        });
        const topItemsByFrequency = Object.values(itemMap).sort((a, b) => b.count - a.count).slice(0, 15)
            .map(i => ({ name: i.name, timesBought: i.count, totalSpent: Math.round(i.totalSpent), avgPrice: i.count > 0 ? Math.round(i.totalSpent / i.count) : 0 }));

        // Most expensive items by unit price
        const expMap = {};
        allBills.forEach(b => {
            (b.items || []).forEach(item => {
                const key = (item.name || '').toLowerCase().trim();
                if (!key) return;
                const up = item.unitPrice || (item.totalPrice / Math.max(item.quantity || 1, 1));
                if (!expMap[key] || up > expMap[key].unitPrice) {
                    expMap[key] = { name: item.name, unitPrice: Math.round(up), totalSpent: Math.round(item.totalPrice || 0), store: b.storeName, lastDate: new Date(b.billDate).toLocaleDateString('en-GB') };
                }
            });
        });
        const mostExpensiveItems = Object.values(expMap).sort((a, b) => b.unitPrice - a.unitPrice).slice(0, 15);

        // Items bought in last 3 weeks
        const cutoff3w = new Date(now); cutoff3w.setDate(cutoff3w.getDate() - 21);
        const recentItems = [];
        allBills.filter(b => new Date(b.billDate) >= cutoff3w).forEach(b => {
            (b.items || []).forEach(item => {
                recentItems.push({ name: item.name, unitPrice: Math.round(item.unitPrice || 0), totalPrice: Math.round(item.totalPrice || 0), qty: item.quantity || 1, store: b.storeName, date: new Date(b.billDate).toLocaleDateString('en-GB') });
            });
        });
        const recentItemsByPrice = [...recentItems].sort((a, b) => b.unitPrice - a.unitPrice).slice(0, 20);

        // Grocery category breakdown (bills, current month)
        const groceryCats = Object.entries(currSummary?.categoryBreakdown || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
            .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt), pct: currSpent > 0 ? Math.round((amt / currSpent) * 100) : 0 }));

        // Accounts
        const totalBalance = Math.round(accounts.reduce((a, ac) => a + (ac.balance || 0), 0));
        const accountList  = accounts.map(a => ({ name: a.name, type: a.type, balance: Math.round(a.balance || 0) }));

        // Debts
        const activeDebts   = allDebts.filter(d => d.status !== 'paid');
        const paidDebts     = allDebts.filter(d => d.status === 'paid');
        const totalOwedByMe = Math.round(activeDebts.filter(d => d.type === 'owed_by_me').reduce((a, d) => a + (d.remainingAmount || 0), 0));
        const totalOwedToMe = Math.round(activeDebts.filter(d => d.type === 'owed_to_me').reduce((a, d) => a + (d.remainingAmount || 0), 0));
        const debtList = allDebts.map(d => ({
            title: d.title || 'Untitled', person: d.personName || 'Unknown',
            type: d.type === 'owed_by_me' ? 'I owe them' : 'They owe me',
            originalAmount: Math.round(d.totalAmount || 0),
            remainingAmount: Math.round(d.remainingAmount || 0),
            paidSoFar: Math.round((d.totalAmount || 0) - (d.remainingAmount || 0)),
            status: d.status || 'active',
            dueDate: d.dueDate ? new Date(d.dueDate).toLocaleDateString('en-GB') : 'No due date',
            repaymentCount: d.repayments?.length || 0
        }));

        // All-time totals
        const allTimeExpense = Math.round(allTransactions.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0));
        const allTimeIncome  = Math.round(allTransactions.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0));
        const allTimeGrocery = Math.round(allBills.reduce((a, b) => a + (b.totalAmount || 0), 0));

        // Last month
        const lastMonthDate = new Date(now); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        const lm = lastMonthDate.getMonth() + 1; const ly = lastMonthDate.getFullYear();
        const lastSummary = allSummaries.find(s => s.month === lm && s.year === ly);
        const lastSpent   = lastSummary?.totalSpent || 0;
        const momChange   = lastSpent > 0 ? `${Math.round(((currSpent - lastSpent) / lastSpent) * 100)}%` : 'No prior data';

        // BUILD CONTEXT
        const context = {
            USER_PROFILE: { name: user.name, currency: user.currency, familySize: user.familySize, monthlyIncome: user.monthlyIncome, budgetPercentage: user.budgetPercentage, groceryBudgetLimit: budgetLimit, savingsGoal: user.savingsGoal },
            THIS_WEEK: { expenseTotal: weekExpense, incomeTotal: weekIncome, transactionCount: thisWeekTx.length },
            LAST_WEEK: { expenseTotal: lastWeekExpense },
            CURRENT_MONTH: {
                period: `${monthNames[currMonth-1]} ${currYear}`, grocerySpend: Math.round(currSpent), budgetLimit,
                budgetUsedPercent: budgetLimit > 0 ? Math.round((currSpent / budgetLimit) * 100) : 0,
                remainingBudget: Math.round(budgetLimit - currSpent),
                budgetStatus: currSpent > budgetLimit ? 'OVER_BUDGET' : currSpent > budgetLimit * 0.8 ? 'NEAR_LIMIT' : 'ON_TRACK',
                daysPassed, daysLeft, dailySpendRate: dailyRate,
                projectedMonthEnd: Math.round(dailyRate * daysInMonth),
                transactionExpense: Math.round(currMonthTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)),
                transactionIncome:  Math.round(currMonthTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0))
            },
            LAST_MONTH: { period: `${monthNames[lm-1]} ${ly}`, grocerySpend: Math.round(lastSpent) },
            MONTH_ON_MONTH_GROCERY_CHANGE: momChange,
            MONTHLY_BREAKDOWN_12M: monthlyBreakdown,
            GROCERY_CATEGORIES_THIS_MONTH: groceryCats,
            TRANSACTION_CATEGORIES_THIS_MONTH: txCategoryThisMonth,
            ALL_TIME_CATEGORY_SPEND: allTimeCategorySpend,
            INCOME_SOURCES_ALL_TIME: incomeSources,
            TOP_STORES: topStores,
            MOST_PURCHASED_ITEMS: topItemsByFrequency,
            MOST_EXPENSIVE_ITEMS_BY_UNIT_PRICE: mostExpensiveItems,
            ITEMS_LAST_3_WEEKS: recentItemsByPrice,
            ITEMS_LAST_3_WEEKS_COUNT: recentItems.length,
            RECENT_30_TRANSACTIONS: recent30Tx,
            ACCOUNTS: { totalBalance, list: accountList },
            DEBTS: { totalIOweThem: totalOwedByMe, totalTheyOweMe: totalOwedToMe, netDebtPosition: totalOwedByMe - totalOwedToMe, activeCount: activeDebts.length, paidCount: paidDebts.length, list: debtList },
            ALL_TIME_TOTALS: { totalBills: allBills.length, totalGrocerySpend: allTimeGrocery, avgBillAmount: allBills.length > 0 ? Math.round(allTimeGrocery / allBills.length) : 0, totalTransactionExpense: allTimeExpense, totalTransactionIncome: allTimeIncome, totalTransactions: allTransactions.length, netSavings: allTimeIncome - allTimeExpense - allTimeGrocery }
        };

        // Limit arrays to keep payload under token limit for free models
        const safeContext = {
            ...context,
            MONTHLY_BREAKDOWN_12M: context.MONTHLY_BREAKDOWN_12M,
            MOST_PURCHASED_ITEMS: context.MOST_PURCHASED_ITEMS.slice(0, 10),
            MOST_EXPENSIVE_ITEMS_BY_UNIT_PRICE: context.MOST_EXPENSIVE_ITEMS_BY_UNIT_PRICE.slice(0, 10),
            ITEMS_LAST_3_WEEKS: context.ITEMS_LAST_3_WEEKS.slice(0, 10),
            RECENT_30_TRANSACTIONS: context.RECENT_30_TRANSACTIONS.slice(0, 20),
            TOP_STORES: context.TOP_STORES.slice(0, 5),
            DEBTS: { ...context.DEBTS, list: context.DEBTS.list.slice(0, 10) }
        };

        const systemPrompt = `You are Ledgera AI — a precise personal finance assistant. All data below is PRE-COMPUTED from the user's real records. Answer using ONLY this data.

TODAY: ${now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
CURRENCY: ${user.currency}

=== FINANCIAL DATA ===
${JSON.stringify(safeContext, null, 2)}

ANSWER GUIDE:
- "this week" → THIS_WEEK
- "last week" → LAST_WEEK
- "this month" → CURRENT_MONTH + GROCERY_CATEGORIES_THIS_MONTH + TRANSACTION_CATEGORIES_THIS_MONTH
- "last month" → LAST_MONTH
- "compare months / trend" → MONTHLY_BREAKDOWN_12M
- "most expensive item" → MOST_EXPENSIVE_ITEMS_BY_UNIT_PRICE (sorted by unit price)
- "recent / last few weeks" → ITEMS_LAST_3_WEEKS
- "most bought / frequently" → MOST_PURCHASED_ITEMS
- "stores" → TOP_STORES
- "income / salary" → MONTHLY_BREAKDOWN_12M + INCOME_SOURCES_ALL_TIME
- "savings" → MONTHLY_BREAKDOWN_12M savings + ALL_TIME_TOTALS.netSavings
- "debt / loan / owe" → DEBTS
- "account / balance" → ACCOUNTS
- "all time / ever" → ALL_TIME_TOTALS
- "category all time" → ALL_TIME_CATEGORY_SPEND
- "recent transactions" → RECENT_30_TRANSACTIONS

RULES:
1. Use EXACT numbers — never recalculate.
2. Always show currency (${user.currency}) with amounts.
3. Use bullet points for lists.
4. If ITEMS_LAST_3_WEEKS_COUNT is 0 and asked about recent items, say: "No bills recorded in the last 3 weeks."
5. If data is missing/zero, say: "No data recorded for that yet."
6. You are READ-ONLY — never say "I updated" or "I changed" anything.
7. Be concise and structured.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...chatHistory.slice(-8).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: message }
        ];

        // Free model fallback chain (Optimized for May 2026 availability)
        const CHAT_MODELS = [
            'openrouter/free',
            'google/gemini-2.0-flash-lite-preview-02-05:free',
            'google/gemini-2.0-flash-lite-001:free',
            'meta-llama/llama-3.3-70b-instruct:free',
            'meta-llama/llama-3.1-8b-instruct:free',
            'google/gemma-2-9b-it:free',
            'qwen/qwen-2.5-72b-instruct:free',
            'deepseek/deepseek-chat:free'
        ];

        let lastError = null;
        for (const model of CHAT_MODELS) {
            try {
                console.log(`[AI /chat] Attempting model: ${model}...`);
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': process.env.APP_URL || 'https://ledgera.app',
                        'X-Title': 'Ledgera-FinanceAI',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ model, messages, temperature: 0.15, max_tokens: 1200 })
                });

                if (!response.ok) {
                    let errMsg = `HTTP ${response.status}`;
                    try {
                        const errText = await response.text();
                        try {
                            const errJson = JSON.parse(errText);
                            errMsg = `${response.status}: ${errJson.error?.message || errText}`;
                        } catch (e) {
                            errMsg = `${response.status}: ${errText.substring(0, 150)}`;
                        }
                    } catch (e) {
                        errMsg = `${response.status}: (could not read body)`;
                    }
                    lastError = errMsg;
                    console.warn(`[AI /chat] Model ${model} failed: ${errMsg}`);
                    continue;
                }

                const data = await response.json();
                const reply = data.choices?.[0]?.message?.content;
                if (!reply) { lastError = 'Empty response from model'; continue; }
                return res.json({ reply, model });
            } catch (err) {
                lastError = err.message; continue;
            }
        }
        res.status(500).json({ 
            error: 'AI assistant is currently overwhelmed or unavailable.', 
            detail: lastError,
            suggestion: 'Please try again in a few minutes or check your internet connection.'
        });
    } catch (err) {
        console.error('[AI /chat ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }

});

module.exports = router;
