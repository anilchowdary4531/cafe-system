export const buildRestaurantMenuPath = (slug, tableNo = "") => {
    const safeSlug = String(slug || "").trim();
    if (!safeSlug) return "/";

    const safeTable = String(tableNo || "").trim();
    if (safeTable) {
        return `/m/${encodeURIComponent(safeSlug)}/${encodeURIComponent(safeTable)}`;
    }

    return `/r/${encodeURIComponent(safeSlug)}/menu`;
};
