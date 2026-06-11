const ASSIGNMENTS_PREFIX = "kitchen_chef_assignments_v1";
const HISTORY_PREFIX = "kitchen_chef_assignment_history_v1";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const safeParse = (raw, fallback) => {
    try {
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const safeId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `kitchen_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeText = (value, fallback = "") => String(value ?? fallback).trim();

export const normalizeKitchenStatus = (status) => {
    const raw = normalizeText(status, "PLACED").toUpperCase();
    return raw === "SERVED" ? "DELIVERED" : raw;
};

export const isLiveKitchenStatus = (status) => {
    return new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]).has(normalizeKitchenStatus(status));
};

export const formatKitchenMoney = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "Rs 0.00";
    return `Rs ${amount.toFixed(2)}`;
};

export const getKitchenMinutesSince = (isoDate) => {
    if (!isoDate) return null;
    const time = new Date(isoDate).getTime();
    if (Number.isNaN(time)) return null;
    return Math.max(0, Math.floor((Date.now() - time) / 60000));
};

export const formatKitchenAge = (minutes) => {
    if (minutes === null || minutes === undefined) return "-";
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

export const getKitchenEmptyOrderLabel = (order) => {
    const tableNo = normalizeText(order?.tableNo);
    if (tableNo) return `Table ${tableNo}`;

    const source = normalizeText(order?.orderSource).toUpperCase();
    if (source === "ONLINE") return "Online ticket";
    if (source === "POS") return "POS ticket";
    return "Kitchen ticket";
};

export const getKitchenAssignmentsStorageKey = (restaurantId) => `${ASSIGNMENTS_PREFIX}_${restaurantId}`;

export const getKitchenAssignmentHistoryStorageKey = (restaurantId) => `${HISTORY_PREFIX}_${restaurantId}`;

export const readKitchenAssignments = (restaurantId) => {
    if (!isBrowser() || !restaurantId) return {};

    const raw = window.localStorage.getItem(getKitchenAssignmentsStorageKey(restaurantId));
    const parsed = safeParse(raw, {});
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce((acc, [itemKey, chefId]) => {
        const normalizedItemKey = normalizeText(itemKey);
        const normalizedChefId = normalizeText(chefId);
        if (!normalizedItemKey || !normalizedChefId) return acc;
        acc[normalizedItemKey] = normalizedChefId;
        return acc;
    }, {});
};

export const writeKitchenAssignments = (restaurantId, assignments) => {
    if (!isBrowser() || !restaurantId) return;

    try {
        window.localStorage.setItem(
            getKitchenAssignmentsStorageKey(restaurantId),
            JSON.stringify(assignments || {})
        );
    } catch {
        // Ignore localStorage write failures and keep the board functional.
    }
};

export const readKitchenAssignmentHistory = (restaurantId) => {
    if (!isBrowser() || !restaurantId) return [];

    const raw = window.localStorage.getItem(getKitchenAssignmentHistoryStorageKey(restaurantId));
    const parsed = safeParse(raw, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
};

export const appendKitchenAssignmentHistory = (restaurantId, entry, limit = 500) => {
    if (!isBrowser() || !restaurantId) return null;

    const existing = readKitchenAssignmentHistory(restaurantId);
    const nextEntry = {
        id: safeId(),
        timestamp: new Date().toISOString(),
        ...entry,
        restaurantId: Number(restaurantId || 0),
    };
    const next = [...existing, nextEntry].slice(-Math.max(1, Number(limit || 500)));

    try {
        window.localStorage.setItem(getKitchenAssignmentHistoryStorageKey(restaurantId), JSON.stringify(next));
    } catch {
        // Ignore localStorage write failures and keep the board functional.
    }

    return nextEntry;
};

export const createKitchenAssignmentHistoryEntry = ({
    action,
    item,
    chef,
    previousChef,
    note,
}) => {
    const normalizedAction = normalizeText(action, "ASSIGNED").toUpperCase();
    const safeAction =
        normalizedAction === "REASSIGNED" ||
        normalizedAction === "UNASSIGNED" ||
        normalizedAction === "COMPLETED" ||
        normalizedAction === "ASSIGNED"
            ? normalizedAction
            : "ASSIGNED";

    return {
        action: safeAction,
        itemKey: normalizeText(item?.itemKey),
        orderId: Number(item?.orderId || 0),
        orderRef: normalizeText(item?.orderRef),
        orderLabel: normalizeText(item?.orderLabel),
        tableNo: normalizeText(item?.tableNo),
        itemName: normalizeText(item?.itemName, "Item") || "Item",
        qty: Math.max(1, Number(item?.qty || 1)),
        lineTotal: Number(item?.lineTotal || 0),
        notes: normalizeText(item?.notes),
        orderStatus: normalizeKitchenStatus(item?.orderStatus),
        chefId: normalizeText(chef?.id),
        chefName: normalizeText(chef?.name, "Chef") || "Chef",
        previousChefId: normalizeText(previousChef?.id),
        previousChefName: normalizeText(previousChef?.name),
        note: normalizeText(note),
    };
};

export const buildKitchenTicketRows = (orders) => {
    const rows = [];

    (Array.isArray(orders) ? orders : []).forEach((order) => {
        const items = Array.isArray(order?.items) ? order.items : [];
        items.forEach((item, index) => {
            const itemKey = normalizeText(item?.id || `${order?.id || "order"}:${index}`);
            const qty = Math.max(1, Number(item?.qty || 1));
            const lineTotal = Number(item?.total || Number(item?.price || 0) * qty);
            const orderRef = normalizeText(order?.orderNo || `#${order?.id || "-"}`);
            const ageText = formatKitchenAge(getKitchenMinutesSince(order?.createdAt));

            rows.push({
                itemKey,
                orderId: Number(order?.id || 0),
                orderRef,
                orderStatus: normalizeKitchenStatus(order?.status),
                orderLabel: getKitchenEmptyOrderLabel(order),
                itemName: normalizeText(item?.itemName, "Item") || "Item",
                qty,
                lineTotal,
                notes: normalizeText(order?.notes),
                ageText,
                createdAt: order?.createdAt || null,
            });
        });
    });

    return rows;
};
