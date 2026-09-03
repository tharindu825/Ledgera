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
 * Color map by category key fragments
 */
const COLOR_MAP = [
    [/baby|child|kid|diaper|infant/i, '#ec4899'],
    [/food|dining|meal|grocerie|supermarket|eat.in|restaurant|fruit|vegetable|snack|beverage|dairy|meat/i, '#f59e0b'],
    [/transport|transit|fuel|petrol|diesel|car|vehicle|bus|train|taxi|bike/i, '#06b6d4'],
    [/housing|rent|apartment|mortgage|utilit|electricity|water|gas|household|home|cleaning/i, '#8b5cf6'],
    [/personal.care|toiletries|grooming|health|pharmacy|medicine|doctor|medical|fitness|wellness/i, '#10b981'],
    [/shopping|clothing|apparel|fashion|subscription|entertainment|leisure|hobby|game|movie|outing|travel/i, '#a855f7'],
    [/debt|loan|credit.card|repay|bank.fee/i, '#ef4444'],
    [/saving|invest|stock|crypto|deposit/i, '#14b8a6'],
    [/salary|wage|earned|payroll|income|cash|money|bonus/i, '#22c55e'],
    [/gift|donation|charity/i, '#f43f5e'],
    [/communication|internet|mobile|phone|broadband/i, '#3b82f6'],
    [/other|misc|general/i, '#64748b']
];

export const DISTINCT_PALETTE = [
    '#ec4899', // Pink (Baby & Childcare)
    '#f59e0b', // Amber (Food & Dining)
    '#06b6d4', // Cyan (Transportation)
    '#8b5cf6', // Violet (Household & Utilities)
    '#10b981', // Emerald (Personal Care & Health)
    '#a855f7', // Purple (Lifestyle & Shopping)
    '#ef4444', // Red (Debts & Loans)
    '#3b82f6', // Blue (Education / Tech)
    '#14b8a6', // Teal (Savings & Invest)
    '#f97316', // Orange
    '#84cc16', // Lime
    '#e11d48', // Crimson
    '#6366f1', // Indigo
    '#d946ef', // Fuchsia
    '#0284c7', // Sky Blue
    '#eab308', // Gold
    '#64748b'  // Slate
];

/**
 * Returns a unique color for a given category name or key.
 */
export function getCategoryColor(name = '', index = 0) {
    const trimmed = (name || '').trim();
    for (const [pattern, color] of COLOR_MAP) {
        if (pattern.test(trimmed)) return color;
    }
    return DISTINCT_PALETTE[Math.abs(index) % DISTINCT_PALETTE.length];
}

/**
 * Converts a DB categories array into the { value, label, color } shape
 * used by UploadBill / ItemSelector.
 */
export function dbCategoriesToOptions(dbCategories = []) {
    return dbCategories.map((c, idx) => ({
        value: c.mainCategory,
        label: getCategoryDisplay(c.mainCategory),
        color: c.color && c.color !== '#64748b' ? c.color : getCategoryColor(c.mainCategory, idx),
    }));
}
