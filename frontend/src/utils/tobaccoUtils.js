export const TOBACCO_KEYWORDS = [
    "cigarette",
    "cigarettes",
    "tobacco",
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
    "cigar",
    "cigars",
];

export const isTobaccoText = (text = "") => {
    const clean = String(text || "").trim().toLowerCase();
    if (!clean) return false;
    return TOBACCO_KEYWORDS.some((kw) => clean.includes(kw));
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
