const Category = require('../models/Category');

/**
 * Ensures that a category and its subcategory exist for a user.
 * If the category (mainCategory) doesn't exist, it's created.
 * If the subcategory is provided but doesn't exist in that category, it's added.
 */
async function ensureCategoryAndSubcategory(userId, type, mainCategory, subcategory) {
    if (!mainCategory) return null;

    try {
        // Find existing category
        let category = await Category.findOne({
            user: userId,
            type: type || 'expense',
            mainCategory: mainCategory.toLowerCase()
        });

        if (!category) {
            // Create new category
            category = new Category({
                user: userId,
                type: type || 'expense',
                mainCategory: mainCategory.toLowerCase(),
                subcategories: subcategory ? [subcategory.trim()] : []
            });
            await category.save();
        } else if (subcategory && !category.subcategories.includes(subcategory.trim())) {
            // Add subcategory if it doesn't exist
            category.subcategories.push(subcategory.trim());
            await category.save();
        }

        return category;
    } catch (err) {
        console.error('[CategoryHelper] Error ensuring category:', err.message);
        return null;
    }
}

const defaultCategories = [
    { type: 'expense', mainCategory: 'baby & childcare', icon: '📁', color: '#64748b', subcategories: ['Essentials', 'Nutrition', 'Gear & Apparel', 'Education', 'basic clothing'], budgetGroup: 'needs' },
    { type: 'expense', mainCategory: 'financial & miscellaneous', icon: '📁', color: '#64748b', subcategories: ['Savings & Investments', 'Gifts & Donations'], budgetGroup: 'savings_debt' },
    { type: 'expense', mainCategory: 'financial debts', icon: '📁', color: '#64748b', subcategories: ['Loan_Repay', 'bank/service fees'], budgetGroup: 'needs' },
    { type: 'expense', mainCategory: 'food & dining', icon: '📁', color: '#64748b', subcategories: ['Groceries', 'Snacks & Sweets', 'Beverages', 'Dining Out', 'Dairy Products'], budgetGroup: 'needs' },
    { type: 'expense', mainCategory: 'household & utilities', icon: '📁', color: '#64748b', subcategories: ['Utilities', 'Home Supplies', 'Maintenance & Decor', 'Housing'], budgetGroup: 'needs' },
    { type: 'expense', mainCategory: 'lifestyle & entertainment', icon: '📁', color: '#64748b', subcategories: ['Subscriptions', 'Shopping', 'Leisure & Hobbies'], budgetGroup: 'wants' },
    { type: 'expense', mainCategory: 'personal care & health', icon: '📁', color: '#64748b', subcategories: ['Toiletries & Grooming', 'Healthcare & Pharmacy', 'Fitness & Wellness'], budgetGroup: 'needs' },
    { type: 'expense', mainCategory: 'transportation', icon: '🚗', color: '#f59e0b', subcategories: ['Fuel', 'Bus/Train Fares', 'Vehicle servicing', 'Insurance & Licensing'], budgetGroup: 'needs' },
    { type: 'income', mainCategory: 'earned income', icon: '📁', color: '#64748b', subcategories: ['Base Salary / Wages', 'Hourly Wages / Overtime', 'Bonuses & Incentives', 'Commissions', 'Tips & Gratuities'], budgetGroup: 'income' },
    { type: 'income', mainCategory: 'investment & passive income', icon: '📁', color: '#64748b', subcategories: ['Dividends', 'Interest Income', 'Capital Gains', 'Real Estate / Rental Income', 'Royalties & Licensing'], budgetGroup: 'income' },
    { type: 'income', mainCategory: 'miscellaneous & other inflows', icon: '📁', color: '#64748b', subcategories: ['Gifts & Cash Received', 'Reimbursements', 'Selling Personal Items', 'Grants & Scholarships', 'Alimony & Child Support'], budgetGroup: 'income' },
    { type: 'income', mainCategory: 'retirement & government benefits', icon: '📁', color: '#64748b', subcategories: ['Pension / Retirement Benefits', 'Social Security & State Allowances', 'Tax Refunds'], budgetGroup: 'income' },
    { type: 'income', mainCategory: 'self-employment & business income', icon: '📁', color: '#64748b', subcategories: ['Freelance / Client Projects', 'Side Hustles / Gig Work', 'Business Revenue / Draws', 'Digital Products & Creator Income'], budgetGroup: 'income' }
];

async function seedDefaultCategories(userId) {
    try {
        const count = await Category.countDocuments({ user: userId });
        if (count > 0) return; // User already has categories

        const categoriesToInsert = defaultCategories.map(cat => ({
            ...cat,
            user: userId
        }));

        await Category.insertMany(categoriesToInsert);
    } catch (err) {
        console.error('[CategoryHelper] Error seeding default categories:', err.message);
    }
}

module.exports = { ensureCategoryAndSubcategory, seedDefaultCategories };
