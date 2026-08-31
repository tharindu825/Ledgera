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

module.exports = { ensureCategoryAndSubcategory };
