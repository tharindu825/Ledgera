const express = require('express');
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all categories for a user
router.get('/', auth, async (req, res) => {
    try {
        let categories = await Category.find({ user: req.userId });

        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update category fields
router.put('/:id', auth, async (req, res) => {
    try {
        const { subcategories, icon, color, mainCategory } = req.body;
        const updateData = {};
        if (subcategories !== undefined) updateData.subcategories = subcategories;
        if (icon !== undefined) updateData.icon = icon;
        if (color !== undefined) updateData.color = color;
        if (mainCategory !== undefined) updateData.mainCategory = mainCategory;

        const category = await Category.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            updateData,
            { new: true }
        );
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a subcategory to a specific main category by type and name
router.post('/add-sub', auth, async (req, res) => {
    try {
        const { type, mainCategory, subcategory } = req.body;
        let category = await Category.findOne({ user: req.userId, type, mainCategory });

        if (!category) {
            category = new Category({
                user: req.userId,
                type,
                mainCategory,
                subcategories: [subcategory]
            });
        } else {
            if (!category.subcategories.includes(subcategory)) {
                category.subcategories.push(subcategory);
            }
        }
        await category.save();
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new main category
router.post('/', auth, async (req, res) => {
    try {
        const { type, mainCategory, icon, color } = req.body;
        const category = new Category({
            user: req.userId,
            type,
            mainCategory: mainCategory.toLowerCase(),
            icon: icon || '📁',
            color: color || '#64748b',
            subcategories: []
        });
        await category.save();
        res.status(201).json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a category
router.delete('/:id', auth, async (req, res) => {
    try {
        const category = await Category.findOneAndDelete({ _id: req.params.id, user: req.userId });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
