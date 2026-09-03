const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../server/models/User');
const Category = require('../server/models/Category');
const Bill = require('../server/models/Bill');
const Transaction = require('../server/models/Transaction');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getPrevMonthsList(year, month, count = 4) {
    const list = [];
    let curY = year;
    let curM = month;
    for (let i = 0; i < count; i++) {
        list.push({
            year: curY,
            month: curM,
            label: `${MONTH_NAMES[curM - 1]} ${curY}`,
            shortLabel: `${SHORT_MONTH_NAMES[curM - 1]} ${curY}`
        });
        curM--;
        if (curM < 1) {
            curM = 12;
            curY--;
        }
    }
    return list;
}

function calcComparison(curr, prev, type) {
    curr = Number(curr || 0);
    prev = Number(prev || 0);

    if (prev === 0 && curr === 0) {
        return { pct: 0, direction: 'neutral', arrow: '⊝', text: '0%' };
    }
    if (prev === 0 && curr > 0) {
        return {
            pct: 100,
            direction: type === 'expense' ? 'up_bad' : 'up_good',
            arrow: '↑',
            text: '100%'
        };
    }
    if (prev > 0 && curr === 0) {
        return {
            pct: 100,
            direction: type === 'expense' ? 'down_good' : 'down_bad',
            arrow: '↑',
            text: '100%'
        };
    }

    const diff = curr - prev;
    const pctVal = Math.round((diff / prev) * 100);

    if (type === 'expense') {
        if (diff < 0) {
            return {
                pct: Math.abs(pctVal),
                direction: 'down_good',
                arrow: '↓',
                text: `${Math.abs(pctVal)}%`
            };
        } else if (diff > 0) {
            return {
                pct: pctVal,
                direction: 'up_bad',
                arrow: '↗',
                text: `${pctVal}%`
            };
        } else {
            return { pct: 0, direction: 'neutral', arrow: '⊝', text: '0%' };
        }
    } else {
        if (diff > 0) {
            return {
                pct: pctVal,
                direction: 'up_good',
                arrow: '↗',
                text: `${pctVal}%`
            };
        } else if (diff < 0) {
            return {
                pct: pctVal,
                direction: 'down_bad',
                arrow: pctVal <= -50 ? '↓' : '↘',
                text: `${pctVal}%`
            };
        } else {
            return { pct: 0, direction: 'neutral', arrow: '⊝', text: '0%' };
        }
    }
}

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: 'tharindudilshan0825@gmail.com' });
    const userId = user._id;
    const year = 2026;
    const month = 9;

    const monthsList = getPrevMonthsList(year, month, 4);
    const displayMonths = monthsList.slice(0, 3);

    console.log('Display Months:', displayMonths);

    const userCategories = await Category.find({ user: userId });
    const userCatMap = {};
    userCategories.forEach(c => {
        const key = `${c.type}_${c.mainCategory.trim().toLowerCase()}`;
        userCatMap[key] = {
            id: c._id,
            type: c.type,
            mainCategory: c.mainCategory.trim().toLowerCase(),
            name: c.mainCategory,
            icon: c.icon || '📁',
            color: c.color || '#64748b',
            subcategories: (c.subcategories || []).map(s => s.trim())
        };
    });

    const monthlyData = [];
    for (let i = 0; i < 4; i++) {
        const m = monthsList[i];
        const mBills = await Bill.find({ userId, year: m.year, month: m.month });
        const mExpensesTxs = await Transaction.find({ user: userId, year: m.year, month: m.month, type: 'expense', receiptId: null });
        const mIncomeTxs = await Transaction.find({ user: userId, year: m.year, month: m.month, type: 'income' });

        let mTotalExpense = 0;
        let mTotalIncome = 0;
        const mExpenseCats = {};
        const mIncomeCats = {};

        const ensureCatObj = (map, cat) => {
            if (!map[cat]) map[cat] = { total: 0, subcategories: {} };
        };

        mBills.forEach(bill => {
            (bill.items || []).forEach(item => {
                const cat = (item.category || 'other').trim().toLowerCase();
                const sub = (item.subcategory || '').trim() || 'General';
                const amt = Number(item.totalPrice) || 0;
                ensureCatObj(mExpenseCats, cat);
                mExpenseCats[cat].total += amt;
                mExpenseCats[cat].subcategories[sub] = (mExpenseCats[cat].subcategories[sub] || 0) + amt;
                mTotalExpense += amt;
            });
        });

        mExpensesTxs.forEach(tx => {
            const cat = (tx.category || 'other').trim().toLowerCase();
            const sub = (tx.subcategory || '').trim() || 'General';
            const amt = Number(tx.amount) || 0;
            ensureCatObj(mExpenseCats, cat);
            mExpenseCats[cat].total += amt;
            mExpenseCats[cat].subcategories[sub] = (mExpenseCats[cat].subcategories[sub] || 0) + amt;
            mTotalExpense += amt;
        });

        mIncomeTxs.forEach(tx => {
            const cat = (tx.category || 'earned income').trim().toLowerCase();
            const sub = (tx.subcategory || '').trim() || 'General';
            const amt = Number(tx.amount) || 0;
            ensureCatObj(mIncomeCats, cat);
            mIncomeCats[cat].total += amt;
            mIncomeCats[cat].subcategories[sub] = (mIncomeCats[cat].subcategories[sub] || 0) + amt;
            mTotalIncome += amt;
        });

        monthlyData.push({
            year: m.year,
            month: m.month,
            totalExpense: mTotalExpense,
            totalIncome: mTotalIncome,
            expenseCats: mExpenseCats,
            incomeCats: mIncomeCats
        });
    }

    console.log('Monthly summary:', monthlyData);
    await mongoose.disconnect();
}
test();
