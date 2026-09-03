/**
 * Shared category utilities — NO hardcoded category names.
 * Works dynamically with whatever categories exist in the DB.
 */

// ── Emoji map by common category / subcategory key fragments ──────────────────
const EMOJI_MAP = [
    [/bar|cafe|coffee|pub|wine|beer/i, '🍷'],
    [/dining.out|restaurant|eat.in|fast.food|takeout/i, '🍙'],
    [/grocerie|supermarket|market/i, '🍉'],
    [/vegetable|veggie|fruit/i, '🥦'],
    [/egg/i, '🥚'],
    [/meat|poultry|chicken|beef|fish|seafood/i, '🥩'],
    [/dairy|milk|cheese|butter|yogurt/i, '🥛'],
    [/snack|candy|sweet|biscuit|cookie|chocolate/i, '🍿'],
    [/beverage|drink|tea|juice|soda/i, '🥤'],
    [/food|dining|meal/i, '🍽️'],
    [/vehicle|car|automobile|bike|motor/i, '🚗'],
    [/fuel|petrol|diesel|gas.station/i, '⛽'],
    [/transport|transit|bus|train|taxi|ride|cab/i, '🚎'],
    [/housing|rent|apartment|mortgage/i, '🏠'],
    [/utilit|electricity|water|cooking.gas/i, '⚡'],
    [/household|home|cleaning|supplies|detergent/i, '🧼'],
    [/baby|child|kid|diaper|infant/i, '👶'],
    [/personal.care|toiletries|grooming|hygiene|beauty|skincare/i, '🧴'],
    [/health|pharmacy|medicine|doctor|medical|clinic/i, '💊'],
    [/fitness|wellness|gym|sport/i, '🏋️'],
    [/shopping|clothing|apparel|footwear|fashion/i, '🛍️'],
    [/subscription|streaming|netflix|spotify/i, '📺'],
    [/entertainment|leisure|hobby|game|movie|outing|travel/i, '🎬'],
    [/education|school|tuition|course|book|study/i, '📚'],
    [/saving|invest|stock|crypto|mutual|deposit/i, '📈'],
    [/debt|loan|credit.card|repay|bank.fee/i, '💳'],
    [/gift|donation|charity|present/i, '🎁'],
    [/salary|wage|earned|payroll|job/i, '💼'],
    [/freelance|client|project|consulting|gig/i, '💻'],
    [/passive|dividend|interest|rental|royalt/i, '🪙'],
    [/income|cash|money|bonus|reward/i, '💰'],
    [/insurance/i, '🛡️'],
    [/travel|holiday|vacation|hotel|flight/i, '✈️'],
    [/communication|internet|mobile|phone|broadband/i, '📱'],
    [/other|misc|general/i, '📦'],
];

/**
 * Returns an emoji for a given category or subcategory key
 */
export function getCategoryEmoji(name = '') {
    for (const [pattern, emoji] of EMOJI_MAP) {
        if (pattern.test(name)) return emoji;
    }
    return '📁';
}

export function getSubcategoryEmoji(name = '') {
    for (const [pattern, emoji] of EMOJI_MAP) {
        if (pattern.test(name)) return emoji;
    }
    return '▫️';
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
