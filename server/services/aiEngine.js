// AI Engine — Rule-based categorization, budget analysis, and smart planning

// Item categorization dictionary (Sri Lankan + global items)
const categoryKeywords = {
    food: ['rice', 'bread', 'flour', 'noodles', 'pasta', 'sugar', 'salt', 'oil', 'coconut', 'dhal', 'lentils', 'samba', 'basmati', 'atta', 'maida', 'wheat', 'cereal', 'oats', 'string hoppers', 'pittu', 'roti'],
    vegetables: ['carrot', 'potato', 'onion', 'tomato', 'beans', 'cabbage', 'leeks', 'brinjal', 'pumpkin', 'beetroot', 'mushroom', 'garlic', 'ginger', 'capsicum', 'cucumber', 'lettuce', 'spinach', 'kankun', 'gotukola', 'mukunuwenna'],
    fruits: ['banana', 'apple', 'orange', 'mango', 'papaya', 'pineapple', 'grapes', 'watermelon', 'guava', 'passion fruit', 'avocado', 'lime', 'lemon', 'rambutan', 'durian', 'jackfruit', 'wood apple'],
    dairy: ['milk', 'curd', 'yogurt', 'cheese', 'butter', 'cream', 'ghee', 'ice cream', 'paneer'],
    meat: ['chicken', 'fish', 'beef', 'pork', 'mutton', 'prawn', 'shrimp', 'crab', 'egg', 'sausage', 'bacon', 'tuna', 'sardine', 'dried fish'],
    household: ['soap', 'detergent', 'bleach', 'disinfectant', 'sponge', 'brush', 'mop', 'tissue', 'toilet', 'bin bags', 'foil', 'cling wrap', 'matches', 'candle'],
    snacks: ['chips', 'biscuit', 'cookie', 'chocolate', 'candy', 'sweets', 'cake', 'pastry', 'crackers', 'popcorn', 'murukku', 'konda kavum', 'watalappan'],
    beverages: ['tea', 'coffee', 'juice', 'soda', 'water', 'soft drink', 'milo', 'cocoa', 'cordial', 'energy drink', 'sprite', 'coca cola', 'pepsi'],
    personal_care: ['shampoo', 'conditioner', 'lotion', 'toothpaste', 'toothbrush', 'deodorant', 'razor', 'sanitary', 'sunscreen', 'face wash', 'moisturizer']
};

// Smart alternatives database (Sri Lankan context)
const smartAlternatives = {
    'imported apples': { alternative: 'Local bananas', savings: '60%', reason: 'Bananas are locally grown, cheaper, and equally nutritious' },
    'apple': { alternative: 'Local banana or papaya', savings: '50%', reason: 'Local fruits are fresher and more affordable' },
    'imported cheese': { alternative: 'Local curd (meekiri)', savings: '70%', reason: 'Traditional Sri Lankan curd is cheaper and probiotic-rich' },
    'olive oil': { alternative: 'Coconut oil', savings: '65%', reason: 'Coconut oil is locally produced and has many health benefits' },
    'cornflakes': { alternative: 'Oats or local rice flakes', savings: '40%', reason: 'More filling and affordable breakfast option' },
    'packaged juice': { alternative: 'Fresh lime juice or king coconut', savings: '55%', reason: 'Natural, healthier, and cheaper' },
    'chips': { alternative: 'Homemade banana chips', savings: '60%', reason: 'Healthier and much cheaper when made at home' },
    'chocolate': { alternative: 'Local jaggery/treacle sweets', savings: '50%', reason: 'Traditional sweets are more natural and affordable' },
    'pasta': { alternative: 'String hoppers or noodles', savings: '30%', reason: 'Local alternatives that are just as versatile' },
    'butter': { alternative: 'Coconut cream/milk', savings: '40%', reason: 'Great for cooking, locally available' },
    'energy drink': { alternative: 'King coconut water', savings: '70%', reason: 'Natural electrolytes, no added sugar' },
    'soft drink': { alternative: 'Homemade ginger beer', savings: '50%', reason: 'Traditional Sri Lankan drink, much healthier' },
    'soda': { alternative: 'Lime and soda homemade', savings: '60%', reason: 'Refreshing and costs almost nothing' }
};

// Categorize a bill item name
function categorizeBillItem(itemName) {
    const name = itemName.toLowerCase().trim();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => name.includes(keyword))) {
            return category;
        }
    }
    return 'other';
}

function predictCategory(itemName) {
    const name = itemName.toLowerCase().trim();
    let category = 'other';
    let subcategory = '';

    // Advanced mapping for Sri Lankan context
    if (name.includes('rice') || name.includes('samba') || name.includes('nadu')) {
        category = 'food';
        subcategory = 'Grains & Rice';
    } else if (name.includes('milk') || name.includes('yogurt') || name.includes('curd')) {
        category = 'dairy';
        subcategory = 'Dairy Products';
    } else if (name.includes('chicken') || name.includes('meat') || name.includes('fish')) {
        category = 'meat';
        subcategory = 'Protein';
    } else if (name.includes('soap') || name.includes('shampoo') || name.includes('detergent')) {
        category = 'household';
        subcategory = 'Cleaning & Hygiene';
    } else if (name.includes('carrot') || name.includes('beans') || name.includes('leeks') || name.includes('cabbage')) {
        category = 'vegetables';
        subcategory = 'Fresh Produce';
    } else if (name.includes('apple') || name.includes('mango') || name.includes('banana')) {
        category = 'fruits';
        subcategory = 'Fresh Fruits';
    } else if (name.includes('tea') || name.includes('coffee') || name.includes('milo')) {
        category = 'beverages';
        subcategory = 'Drinks & Beverages';
    }

    // Fallback to keyword scan
    if (category === 'other') {
        category = categorizeBillItem(name);
        // capitalize name for subcategory
        subcategory = name.charAt(0).toUpperCase() + name.slice(1);
    }

    return { category, subcategory };
}

// Generate budget analysis
function analyzeBudget(user, monthlySummary) {
    const familySize = user.familySize || 1;
    const savingsGoal = user.savingsGoal || 0;
    
    // Prioritize historical settings from summary if available
    const monthlyIncome = monthlySummary?.monthlyIncome || user.monthlyIncome || 0;
    const budgetPercentage = monthlySummary?.budgetPercentage || user.budgetPercentage || 0;
    
    const budgetLimit = (monthlyIncome * budgetPercentage) / 100;
    const totalSpent = monthlySummary?.totalSpent || 0;
    const spentPercent = budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0;
    const incomePercent = monthlyIncome > 0 ? (totalSpent / monthlyIncome) * 100 : 0;

    const analysis = {
        status: 'safe',
        statusMessage: '',
        insights: [],
        warnings: [],
        tips: []
    };

    // Budget status
    if (spentPercent >= 100) {
        analysis.status = 'danger';
        analysis.statusMessage = `⚠️ You've exceeded your grocery budget by ${(totalSpent - budgetLimit).toLocaleString()} LKR!`;
    } else if (spentPercent >= 80) {
        analysis.status = 'danger';
        analysis.statusMessage = `🔴 Critical: ${spentPercent.toFixed(0)}% of grocery budget used.`;
    } else if (spentPercent >= 60) {
        analysis.status = 'warning';
        analysis.statusMessage = `🟡 Caution: ${spentPercent.toFixed(0)}% of grocery budget used.`;
    } else {
        analysis.status = 'safe';
        analysis.statusMessage = `🟢 Good: Only ${spentPercent.toFixed(0)}% of grocery budget used.`;
    }

    // Category insights
    const cb = monthlySummary?.categoryBreakdown || {};
    if (totalSpent > 0) {
        const snackPercent = ((cb.snacks || 0) / totalSpent) * 100;
        const healthPercent = (((cb.vegetables || 0) + (cb.fruits || 0)) / totalSpent) * 100;
        const meatPercent = ((cb.meat || 0) / totalSpent) * 100;

        if (snackPercent > 20) {
            analysis.warnings.push(`🍿 Snack spending is ${snackPercent.toFixed(0)}% — consider reducing to under 15%`);
        }
        if (healthPercent < 20) {
            analysis.warnings.push(`🥬 Fruits & vegetables are only ${healthPercent.toFixed(0)}% — aim for at least 25%`);
        }
        if (meatPercent > 30) {
            analysis.warnings.push(`🥩 Meat spending is ${meatPercent.toFixed(0)}% — try mixing with plant-based proteins`);
        }

        // Positive insights
        if (healthPercent >= 25) {
            analysis.insights.push(`✅ Great job! ${healthPercent.toFixed(0)}% spent on fruits & vegetables`);
        }
        if (snackPercent <= 10) {
            analysis.insights.push(`✅ Low snack spending (${snackPercent.toFixed(0)}%) — healthy choice!`);
        }
    }

    // Tips
    analysis.tips = [
        '📋 Make a shopping list before going to the store',
        '🏪 Buy from local markets — usually 20-30% cheaper',
        '📦 Buy staples (rice, dhal, sugar) in bulk',
        '🌿 Grow herbs at home to save on recurring buys',
        `👨‍👩‍👧‍👦 For a family of ${familySize}, aim to spend under ${Math.round(budgetLimit / familySize).toLocaleString()} per person`
    ];

    if (savingsGoal > 0) {
        const monthlyTarget = savingsGoal / 12;
        const maxGrocery = monthlyIncome - monthlyTarget;
        analysis.tips.push(`🎯 To reach your savings goal, keep groceries under ${Math.round(maxGrocery).toLocaleString()} LKR/month`);
    }

    return analysis;
}

// Generate smart grocery plan
function generateGroceryPlan(user, monthlySummary, previousBills) {
    const { monthlyIncome, budgetPercentage, familySize } = user;
    const budgetLimit = (monthlyIncome * budgetPercentage) / 100;

    // Analyze previous spending patterns
    const itemFrequency = {};
    const itemPrices = {};

    previousBills.forEach(bill => {
        bill.items.forEach(item => {
            const key = item.name.toLowerCase().trim();
            if (!itemFrequency[key]) {
                itemFrequency[key] = { name: item.name, category: item.category, count: 0, totalSpent: 0 };
            }
            itemFrequency[key].count += 1;
            itemFrequency[key].totalSpent += item.totalPrice;

            if (!itemPrices[key]) itemPrices[key] = [];
            itemPrices[key].push(item.totalPrice);
        });
    });

    // Build recommended items
    const recommendedItems = [];
    let totalEstimatedCost = 0;
    let potentialSavings = 0;

    // Essential items (most frequently purchased)
    const sortedItems = Object.values(itemFrequency).sort((a, b) => b.count - a.count);

    sortedItems.forEach(item => {
        const avgPrice = item.totalSpent / item.count;
        const nameKey = item.name.toLowerCase();

        // Check for alternatives
        let alternative = null;
        for (const [key, alt] of Object.entries(smartAlternatives)) {
            if (nameKey.includes(key)) {
                alternative = alt;
                break;
            }
        }

        const recommended = {
            name: item.name,
            category: item.category,
            estimatedPrice: Math.round(avgPrice),
            alternative: alternative ? alternative.alternative : null,
            alternativePrice: alternative ? Math.round(avgPrice * (1 - parseInt(alternative.savings) / 100)) : null,
            reason: alternative ? alternative.reason : `Frequently purchased (${item.count} times)`
        };

        if (alternative) {
            potentialSavings += Math.round(avgPrice * parseInt(alternative.savings) / 100);
        }

        totalEstimatedCost += Math.round(avgPrice);
        recommendedItems.push(recommended);
    });

    // Add essential items if not present
    const essentials = [
        { name: 'Rice (5kg)', category: 'food', estimatedPrice: 1500 },
        { name: 'Coconut Oil', category: 'food', estimatedPrice: 600 },
        { name: 'Dhal (1kg)', category: 'food', estimatedPrice: 450 },
        { name: 'Mixed Vegetables', category: 'vegetables', estimatedPrice: 800 },
        { name: 'Milk Powder', category: 'dairy', estimatedPrice: 950 },
        { name: 'Eggs (10)', category: 'meat', estimatedPrice: 550 },
        { name: 'Tea (200g)', category: 'beverages', estimatedPrice: 350 },
        { name: 'Sugar (1kg)', category: 'food', estimatedPrice: 250 }
    ];

    essentials.forEach(essential => {
        const exists = recommendedItems.some(r => r.name.toLowerCase().includes(essential.name.toLowerCase().split(' ')[0]));
        if (!exists) {
            recommendedItems.push({
                ...essential,
                alternative: null,
                alternativePrice: null,
                reason: 'Essential monthly item'
            });
            totalEstimatedCost += essential.estimatedPrice;
        }
    });

    // Health score based on category distribution
    const catTotals = {};
    recommendedItems.forEach(item => {
        catTotals[item.category] = (catTotals[item.category] || 0) + item.estimatedPrice;
    });

    const healthyPercent = totalEstimatedCost > 0
        ? (((catTotals.vegetables || 0) + (catTotals.fruits || 0)) / totalEstimatedCost) * 100
        : 0;
    const snackPercent = totalEstimatedCost > 0
        ? ((catTotals.snacks || 0) / totalEstimatedCost) * 100
        : 0;

    let healthScore = 50;
    healthScore += Math.min(25, healthyPercent);
    healthScore -= Math.min(25, snackPercent);
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Tips
    const tips = [
        `💡 Your estimated monthly grocery cost: ${totalEstimatedCost.toLocaleString()} LKR`,
        `💰 Potential savings with alternatives: ${potentialSavings.toLocaleString()} LKR`,
        `👨‍👩‍👧‍👦 Per-person monthly cost: ${Math.round(totalEstimatedCost / familySize).toLocaleString()} LKR`,
        '🛒 Buy at local Pola markets on weekdays for best prices',
        '🥬 Buy seasonal vegetables — they\'re fresher and cheaper',
        '📦 Consider buying rice and pulses from wholesale shops'
    ];

    if (totalEstimatedCost > budgetLimit) {
        tips.unshift(`⚠️ Estimated cost exceeds budget by ${(totalEstimatedCost - budgetLimit).toLocaleString()} LKR — review alternatives`);
    }

    return {
        recommendedItems,
        totalEstimatedCost,
        potentialSavings,
        tips,
        healthScore: Math.round(healthScore)
    };
}

// Predict next month expenses
function predictExpenses(trendData) {
    if (!trendData || trendData.length < 2) return null;

    const amounts = trendData.map(t => t.totalSpent).filter(a => a > 0);
    if (amounts.length < 2) return null;

    // Simple linear regression
    const n = amounts.length;
    const xArr = amounts.map((_, i) => i);
    const sumX = xArr.reduce((a, b) => a + b, 0);
    const sumY = amounts.reduce((a, b) => a + b, 0);
    const sumXY = xArr.reduce((tot, x, i) => tot + x * amounts[i], 0);
    const sumXX = xArr.reduce((tot, x) => tot + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const predicted = intercept + slope * n;

    const avg = sumY / n;
    const trend = slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable';

    return {
        predictedAmount: Math.max(0, Math.round(predicted)),
        averageMonthly: Math.round(avg),
        trend,
        confidence: amounts.length >= 4 ? 'high' : 'medium'
    };
}

module.exports = {
    categorizeBillItem,
    predictCategory,
    analyzeBudget,
    generateGroceryPlan,
    predictExpenses,
    categoryKeywords,
    smartAlternatives
};
