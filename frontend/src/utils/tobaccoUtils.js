export const TOBACCO_KEYWORDS = [
    "cigar",
    "cigars",
    "cigarette",
    "cigarettes",
    "ciggarette",
    "ciggarettes",
    "cig",
    "cigs",
    "tobacco",
    "marlboro",
    "gold flake",
    "goldflake",
    "advance",
    "advance compact",
    "marlboro advance",
    "classic",
    "classic ice burst",
    "classic milds",
    "classic connect",
    "classic filter",
    "classic regular",
    "classic double burst",
    "classic kings",
    "classic lights",
    "classic blue",
    "vape",
    "vapes",
    "vaping",
    "nicotine",
    "bidi",
    "bidis",
    "beedi",
    "beedis",
    "hookah",
    "hukka",
    "rolling paper",
    "paan corner",
];

export const TOBACCO_QUICK_TAGS = [
    "Cigarette",
    "Gold flake cigarette",
    "Paan corner cigarette",
    "Marlboro cigarette",
    "Advance cigarette",
];

export const DEFAULT_TOBACCO_ITEMS = [
    { id: "tob-1", name: "Marlboro Advance Compact", category: "Cigarettes", price: 122, packSize: "10 pcs", rating: 4.9, reviewCount: 312, orderCount: 1850, isAvailable: true, image: "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17", restaurant: { name: "Tiffzy Express", slug: "cafe-king" } },
    { id: "tob-2", name: "Gold Flake King's Blue (Lights)", category: "Cigarettes", price: 240, packSize: "10 pcs", rating: 4.8, reviewCount: 245, orderCount: 1620, isAvailable: true, image: "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17", restaurant: { name: "Tiffzy Express", slug: "cafe-king" } },
    { id: "tob-3", name: "Gold Flake Indie Mint", category: "Cigarettes", price: 125, packSize: "10 pcs", rating: 4.7, reviewCount: 190, orderCount: 1410, isAvailable: true, image: "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17", restaurant: { name: "Tiffzy Express", slug: "cafe-king" } },
    { id: "tob-4", name: "Gold Flake Filter", category: "Cigarettes", price: 127, packSize: "10 pcs", rating: 4.8, reviewCount: 180, orderCount: 1350, isAvailable: true, image: "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17", restaurant: { name: "Tiffzy Express", slug: "cafe-king" } },
    { id: "tob-5", name: "Classic Connect", category: "Cigarettes", price: 390, packSize: "20 pcs", rating: 4.9, reviewCount: 210, orderCount: 1550, isAvailable: true, image: "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17", restaurant: { name: "Tiffzy Express", slug: "cafe-king" } },
    { id: "tob-6", name: "Classic Ice Burst", category: "Cigarettes", price: 240, packSize: "10 pcs", rating: 4.9, reviewCount: 420, orderCount: 2100, isAvailable: true, image: "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17", restaurant: { name: "Tiffzy Express", slug: "cafe-king" } },
    { id: "tob-7", name: "Classic Double Burst", category: "Cigarettes", price: 250, packSize: "10 pcs", rating: 4.8, reviewCount: 195, orderCount: 1280, isAvailable: true, image: "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17", restaurant: { name: "Tiffzy Express", slug: "cafe-king" } },
    { id: "tob-8", name: "Marlboro Gold Advance", category: "Cigarettes", price: 240, packSize: "10 pcs", rating: 4.9, reviewCount: 350, orderCount: 1920, isAvailable: true, image: "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17", restaurant: { name: "Tiffzy Express", slug: "cafe-king" } },
];

const FOOD_TERMS_REGEX = /\b(pizza|coffee|cofee|burger|burgers|fries|fry|pasta|sandwich|sandwiches|biryani|briyani|paneer|chicken|mutton|fish|egg|eggs|dal|salad|salads|roll|rolls|momo|momos|maggi|dosa|dosas|idli|idlis|rice|noodle|noodles|soup|soups|cake|cakes|dessert|desserts|sweet|sweets|cookie|cookies|juice|juices|shake|shakes|milkshake|tea|chai|beverage|beverages|curry|curries|roti|naan|gravy|starter|starters|snack|snacks|ice\s*cream|icecream|pastry|pastries|chole|bhature|paratha|parathas|thali|platter|mocktail|smoothie|waffle|waffles|pancake|pancakes|donut|donuts|brownie|brownies|meal|meals|combo|combos|drink|drinks|margherita|tikka|masala|kebab|kebabs)\b/i;

const EXPLICIT_TOBACCO_REGEX = /\b(cigarette|cigarettes|ciggarette|ciggarettes|cig|cigs|cigar|cigars|tobacco|tobaco|tobacoo|bidi|bidis|beedi|beedis|hookah|hukka|sheesha|shisha|vape|vapes|vaping|nicotine|rolling\s*paper|rolling\s*papers)\b/i;

const TOBACCO_BRAND_REGEX = /\b(marlboro|gold\s*flake|goldflake|advance)\b/i;

const TOBACCO_CATEGORY_REGEX = /\b(cigarette|cigarettes|tobacco|cigar|cigars|bidi|bidis|beedi|beedis|hookah|vape|vapes|nicotine|paan\s*corner)\b/i;

const TOBACCO_ITEM_REGEX = /\b(marlboro|gold\s*flake|goldflake|advance\s*(compact|cigarette|cigs)?|classic\s*(ice\s*burst|milds|connect|filter|regular|double(\s*burst)?|kings?|lights?|blue)|cigarette|cigarettes|cigar|cigars|tobacco|bidi|bidis|beedi|beedis|hookah|rolling\s*paper|vape|vapes|nicotine)\b/i;

export const matchesTobaccoCatalogue = (query = "", customCatalogItems = []) => {
    const clean = String(query || "").trim().toLowerCase();
    if (!clean || clean.length < 2) return false;

    const items = Array.isArray(customCatalogItems) && customCatalogItems.length > 0
        ? customCatalogItems
        : DEFAULT_TOBACCO_ITEMS;

    for (const item of items) {
        if (!item) continue;
        const name = String(item.name || "").toLowerCase();
        const cleanedName = name.replace(/\s*\([^)]*\)/g, "").trim();
        const category = String(item.category || "").toLowerCase();

        if (clean === name || clean === cleanedName || clean === category) return true;
        if (name.includes(clean) || clean.includes(cleanedName)) return true;
    }

    for (const tag of TOBACCO_QUICK_TAGS) {
        const t = String(tag || "").toLowerCase();
        if (clean === t || t.includes(clean) || clean.includes(t)) return true;
    }

    return false;
};

export const isTobaccoCategory = (category = "") => {
    const clean = String(category || "").trim();
    if (!clean) return false;
    return TOBACCO_CATEGORY_REGEX.test(clean) || TOBACCO_ITEM_REGEX.test(clean);
};

export const isTobaccoItem = (item) => {
    if (!item) return false;
    const cat = String(item?.category || "");
    if (isTobaccoCategory(cat)) return true;
    const name = String(item?.name || "");
    const description = String(item?.description || "");
    return TOBACCO_ITEM_REGEX.test(name) || TOBACCO_ITEM_REGEX.test(description);
};

export const isTobaccoText = (text = "", options = {}) => {
    const clean = String(text || "").trim().toLowerCase();
    if (!clean || clean.length < 2) return false;

    const catalogItems = Array.isArray(options?.catalogItems) && options.catalogItems.length > 0
        ? options.catalogItems
        : DEFAULT_TOBACCO_ITEMS;

    // 1. Food exclusion rule:
    // If the query mentions food/beverage items and has NO explicit tobacco keywords
    // (e.g. "Classic Cold Coffee", "Classic Margherita Pizza", "pizza", "coffee", "classic burger"),
    // it must NEVER trigger tobacco detection.
    if (FOOD_TERMS_REGEX.test(clean) && !EXPLICIT_TOBACCO_REGEX.test(clean)) {
        return false;
    }

    // 2. Explicit tobacco terms & abbreviations (cigarette, cig, cigs, tobacco, vape, bidi, etc.)
    if (EXPLICIT_TOBACCO_REGEX.test(clean)) {
        return true;
    }

    // 3. Known tobacco brand / product aliases (Marlboro, Gold Flake, Advance)
    if (TOBACCO_BRAND_REGEX.test(clean)) {
        return true;
    }

    // 4. "Classic" keyword (when not excluded by food check above)
    if (/\bclassic\b/i.test(clean)) {
        return true;
    }

    // 5. Match against active or default tobacco catalogue items & quick tags
    if (matchesTobaccoCatalogue(clean, catalogItems)) {
        return true;
    }

    // 6. Match against tobacco category names
    if (TOBACCO_CATEGORY_REGEX.test(clean)) {
        return true;
    }

    return false;
};

export const isTobaccoAgeConfirmed = () => {
    if (typeof window === "undefined") return false;
    try {
        return window.sessionStorage.getItem("tiffzy_tobacco_age_confirmed") === "true";
    } catch {
        return false;
    }
};

export const setTobaccoAgeConfirmed = (confirmed = true) => {
    if (typeof window === "undefined") return;
    try {
        if (confirmed) {
            window.sessionStorage.setItem("tiffzy_tobacco_age_confirmed", "true");
        } else {
            window.sessionStorage.removeItem("tiffzy_tobacco_age_confirmed");
        }
    } catch {
        // ignore
    }
};

export const resetTobaccoAgeConfirmed = () => {
    setTobaccoAgeConfirmed(false);
};
