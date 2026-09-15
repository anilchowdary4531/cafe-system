export const TOBACCO_KEYWORDS = [
    "cig",
    "ciga",
    "cigar",
    "cigars",
    "cigarette",
    "cigarettes",
    "tob",
    "toba",
    "tobacco",
    "marl",
    "marlboro",
    "gold flake",
    "goldflake",
    "classic",
    "vape",
    "nicotine",
    "bidi",
    "beedi",
    "hookah",
    "rolling paper",
    "paan corner",
    "paan",
    "smoke",
    "smokes",
];

export const isTobaccoText = (text = "") => {
    const clean = String(text || "").trim().toLowerCase();
    if (!clean || clean.length < 2) return false;
    return TOBACCO_KEYWORDS.some((kw) => clean.includes(kw) || (clean.length >= 3 && kw.includes(clean)));
};

export const isTobaccoItem = (item) => {
    if (!item) return false;
    const name = String(item?.name || "");
    const description = String(item?.description || "");
    const category = String(item?.category || "");
    return isTobaccoText(`${name} ${description} ${category}`);
};

export const isTobaccoCategory = (category = "") => {
    return isTobaccoText(category);
};

export const isTobaccoAgeConfirmed = () => {
    if (typeof window === "undefined") return false;
    try {
        return window.sessionStorage.getItem("tiffzy_tobacco_age_confirmed") === "true";
    } catch {
        return false;
    }
};

export const setTobaccoAgeConfirmed = () => {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem("tiffzy_tobacco_age_confirmed", "true");
    } catch {
        // ignore
    }
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
