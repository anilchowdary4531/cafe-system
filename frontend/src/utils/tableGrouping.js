export const TABLE_GROUPS_STORAGE_PREFIX = "owner_table_groups_v1";
export const TABLE_GROUP_CATALOG_STORAGE_PREFIX = "owner_table_group_catalog_v1";
export const TABLE_GROUPS_SYNC_EVENT = "tiffzy_table_groups_updated";

export const toTitleCase = (str) =>
    String(str || "")
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");

export const normalizeGroupName = (value) =>
    String(value || "")
        .trim()
        .replace(/\s+/g, " ");

export const isSameGroupName = (left, right) =>
    normalizeGroupName(left).toLowerCase() ===
    normalizeGroupName(right).toLowerCase();

export const mergeUniqueGroupNames = (names) => {
    const unique = new Map();
    for (const name of names || []) {
        const normalized = normalizeGroupName(name);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (!unique.has(key)) unique.set(key, toTitleCase(normalized));
    }
    return [...unique.values()].sort((a, b) => {
        if (a.toLowerCase() === "ungrouped") return 1;
        if (b.toLowerCase() === "ungrouped") return -1;
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
};

export const getStoredTableGroups = (restaurantId) => {
    if (!restaurantId || typeof window === "undefined") return {};
    try {
        const raw = localStorage.getItem(`${TABLE_GROUPS_STORAGE_PREFIX}_${restaurantId}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch {}
    return {};
};

export const getStoredGroupCatalog = (restaurantId) => {
    if (!restaurantId || typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(`${TABLE_GROUP_CATALOG_STORAGE_PREFIX}_${restaurantId}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return mergeUniqueGroupNames(parsed);
            }
        }
    } catch {}
    return [];
};

export const writeStoredTableGroups = (restaurantId, tableGroups) => {
    if (!restaurantId || typeof window === "undefined") return;
    try {
        localStorage.setItem(
            `${TABLE_GROUPS_STORAGE_PREFIX}_${restaurantId}`,
            JSON.stringify(tableGroups)
        );
        window.dispatchEvent(
            new CustomEvent(TABLE_GROUPS_SYNC_EVENT, {
                detail: { restaurantId, tableGroups },
            })
        );
        window.dispatchEvent(new Event("storage"));
    } catch (e) {
        console.error("Failed to write table groups to localStorage:", e);
    }
};

export const writeStoredGroupCatalog = (restaurantId, catalog) => {
    if (!restaurantId || typeof window === "undefined") return;
    try {
        localStorage.setItem(
            `${TABLE_GROUP_CATALOG_STORAGE_PREFIX}_${restaurantId}`,
            JSON.stringify(catalog)
        );
        window.dispatchEvent(
            new CustomEvent(TABLE_GROUPS_SYNC_EVENT, {
                detail: { restaurantId, catalog },
            })
        );
        window.dispatchEvent(new Event("storage"));
    } catch (e) {
        console.error("Failed to write group catalog to localStorage:", e);
    }
};

/**
 * Resolves the authoritative group name for a table.
 * 
 * Order of precedence:
 * 1. Explicit assignment in tableGroups by table ID (from Tables & QR page)
 * 2. Explicit assignment in tableGroups by tableNo (from Tables & QR page)
 * 3. Explicit groupName property on the table object
 * 4. Explicit section from database (if NOT the Prisma schema default "Main Floor", or if "Main Floor" is in groupCatalog)
 * 5. Conventional naming pattern (e.g. numeric tables -> "Main Hall", T-prefix -> "Section T")
 * 6. Explicit "Ungrouped" for any table with no group assigned (never defaults to "Main Floor")
 */
export const resolveTableGroup = (table, tableGroups = {}, catalog = []) => {
    const idKey = String(table?.id || "").trim();
    if (idKey && tableGroups[idKey] && String(tableGroups[idKey]).trim()) {
        return toTitleCase(tableGroups[idKey]);
    }

    const noKey = String(table?.tableNo || "").trim();
    if (noKey && tableGroups[noKey] && String(tableGroups[noKey]).trim()) {
        return toTitleCase(tableGroups[noKey]);
    }

    if (table?.groupName && String(table.groupName).trim()) {
        return toTitleCase(table.groupName);
    }

    const section = String(table?.section || "").trim();
    if (section) {
        const isDefaultMainFloor = section.toLowerCase() === "main floor";
        const isExplicitCatalogGroup = Array.isArray(catalog) && catalog.some(
            (c) => c.toLowerCase() === section.toLowerCase()
        );
        if (!isDefaultMainFloor || isExplicitCatalogGroup) {
            return toTitleCase(section);
        }
    }

    // Standard naming conventions
    if (noKey) {
        if (/^\d+$/.test(noKey)) return "Main Hall";
        const letterMatch = noKey.match(/^([A-Za-z]+)\s*\d+$/);
        if (letterMatch) {
            const prefix = letterMatch[1].toUpperCase();
            return prefix === "T" ? "Section T" : `Section ${prefix}`;
        }
    }

    return "Ungrouped";
};
