/**
 * Shared category utilities — NO hardcoded category names.
 * Works dynamically with whatever categories exist in the DB.
 */

// ── Emoji map by common category key fragments ────────────────────────────────
const EMOJI_MAP = [
    [/food|grocerie|meal|restaurant|dining/i, '🍚'],
    [/vegetable|veggie/i, '🥦'],
    [/fruit/i, '🍎'],
    [/dairy|milk/i, '🥛'],
    [/meat|poultry|chicken|beef|fish|seafood/i, '🥩'],
    [/household|home|cleaning/i, '🧼'],
    [/snack|candy|sweet|junk/i, '🍿'],
    [/beverage|drink|coffee|tea|juice/i, '🥤'],
    [/personal.care|hygiene|beauty|health|medical/i, '🧴'],
    [/transport|vehicle|car|fuel|petrol|taxi|bus|train|fuel/i, '🚗'],
    [/housing|rent|utilities|electricity|water|gas|internet|phone/i, '🏠'],
    [/shopping|clothing|fashion|apparel/i, '🛍️'],
    [/entertainment|sport|fitness|fun|leisure|hobby/i, '🎬'],
    [/education|school|tuition|book/i, '📚'],
    [/investment|saving|finance/i, '📈'],
    [/income|salary|wage|bonus|freelance|business/i, '💰'],
    [/insurance/i, '🛡️'],
    [/travel|holiday|vacation|hotel|flight/i, '✈️'],
    [/gift|charity|donation/i, '🎁'],
    [/communication|internet|mobile|phone/i, '📱'],
    [/other|misc|general/i, '📦'],
];

/**
 * Returns an emoji for a given category key (e.g. "food_and_drinks" → "🍚")
 * Falls back to 📦 if no match.
 */
export function getCategoryEmoji(mainCategory = '') {
    for (const [pattern, emoji] of EMOJI_MAP) {
        if (pattern.test(mainCategory)) return emoji;
    }
    return '📦';
}

/**
 * Returns a human-readable label for a raw mainCategory key.
 * e.g. "food_and_drink" → "Food And Drink"
 *      "life_entertainment" → "Life Entertainment"
 */
export function formatCategoryLabel(mainCategory = '') {
    return mainCategory
        .replace(/_and_/gi, ' & ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Returns "emoji label" for a category key.
 * e.g. "food" → "🍚 Food"
 */
export function getCategoryDisplay(mainCategory = '') {
    const emoji = getCategoryEmoji(mainCategory);
    const label = formatCategoryLabel(mainCategory);
    return `${emoji} ${label}`;
}

/**
 * Converts a DB categories array into the { value, label, color } shape
 * used by UploadBill / ItemSelector.
 */
export function dbCategoriesToOptions(dbCategories = []) {
    return dbCategories.map(c => ({
        value: c.mainCategory,
        label: getCategoryDisplay(c.mainCategory),
        color: c.color || '#64748b',
    }));
}
