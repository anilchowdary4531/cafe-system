export const TOBACCO_KEYWORDS = [
    "cigar",
    "cigars",
    "cigarette",
    "cigarettes",
    "tobacco",
    "marlboro",
    "gold flake",
    "goldflake",
    "classic ice burst",
    "classic milds",
    "classic connect",
    "classic filter",
    "classic regular",
    "classic double burst",
    "vape",
    "nicotine",
    "bidi",
    "bidis",
    "beedi",
    "beedis",
    "hookah",
    "rolling paper",
];

const TOBACCO_CATEGORY_REGEX = /\b(cigarette|cigarettes|tobacco|cigar|cigars|bidi|bidis|beedi|beedis|hookah|vape|vapes|nicotine)\b/i;
const TOBACCO_ITEM_REGEX = /\b(marlboro|gold\s*flake|goldflake|classic\s*(ice\s*burst|milds|connect|filter|regular|double|kings|lights|blue)|cigarette|cigarettes|tobacco|cigar|cigars|bidi|bidis|beedi|beedis|hookah|rolling\s*paper|vape|nicotine)\b/i;

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

export const isTobaccoText = (text = "") => {
    const clean = String(text || "").trim();
    if (!clean || clean.length < 2) return false;
    return TOBACCO_ITEM_REGEX.test(clean) || TOBACCO_CATEGORY_REGEX.test(clean);
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
