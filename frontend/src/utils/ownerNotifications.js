const STORAGE_KEY = "owner_notifications_v1";
const CHANGE_EVENT = "owner-notifications:changed";
const MAX_NOTIFICATIONS = 100;

const isBrowser = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

const toSafeText = (value, fallback = "") => {
    const next = String(value ?? "").trim();
    return next || fallback;
};

const toSafeTime = (value) => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return new Date().toISOString();
    return dt.toISOString();
};

const normalizeOne = (raw, index = 0) => {
    return {
        id: toSafeText(raw?.id, `notif_${Date.now()}_${index}`),
        title: toSafeText(raw?.title, "Notification"),
        message: toSafeText(raw?.message, "You have a new update."),
        type: toSafeText(raw?.type, "info"),
        createdAt: toSafeTime(raw?.createdAt),
        read: Boolean(raw?.read),
    };
};

const sortNewestFirst = (list) =>
    [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const seededNotifications = () => {
    const now = Date.now();
    return [
        {
            id: "seed_welcome",
            title: "Welcome to notifications",
            message: "All important owner updates will appear here.",
            type: "system",
            createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
            read: false,
        },
        {
            id: "seed_orders",
            title: "Live order activity",
            message: "Track order status updates in one place.",
            type: "orders",
            createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
            read: false,
        },
        {
            id: "seed_settings",
            title: "Keep your profile updated",
            message: "Review restaurant settings to keep billing and operations accurate.",
            type: "settings",
            createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
            read: true,
        },
    ];
};

const readRaw = () => {
    if (!isBrowser()) return [];

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch {
        return [];
    }
};

const writeRaw = (list) => {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

const emitChange = () => {
    if (!isBrowser()) return;
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

const getNormalized = () => sortNewestFirst(readRaw().map((item, idx) => normalizeOne(item, idx)));

export const ensureOwnerNotifications = () => {
    const current = getNormalized();
    if (current.length) return current;
    const seed = seededNotifications();
    writeRaw(seed);
    return sortNewestFirst(seed.map((item, idx) => normalizeOne(item, idx)));
};

export const getOwnerNotifications = () => ensureOwnerNotifications();

export const getOwnerUnreadCount = () =>
    getOwnerNotifications().reduce((sum, item) => sum + (item.read ? 0 : 1), 0);

export const markOwnerNotificationRead = (id) => {
    const targetId = toSafeText(id);
    if (!targetId) return;

    const updated = getOwnerNotifications().map((item) =>
        item.id === targetId ? { ...item, read: true } : item
    );
    writeRaw(updated);
    emitChange();
};

export const markAllOwnerNotificationsRead = () => {
    const updated = getOwnerNotifications().map((item) => ({ ...item, read: true }));
    writeRaw(updated);
    emitChange();
};

export const appendOwnerNotification = ({
    title = "Notification",
    message = "You have a new update.",
    type = "info",
    read = false,
} = {}) => {
    const newItem = normalizeOne({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        message,
        type,
        createdAt: new Date().toISOString(),
        read: Boolean(read),
    });

    const updated = [newItem, ...getOwnerNotifications()].slice(0, MAX_NOTIFICATIONS);
    writeRaw(updated);
    emitChange();
    return newItem;
};

export const subscribeOwnerNotifications = (listener) => {
    if (!isBrowser() || typeof listener !== "function") return () => {};

    const onChange = () => listener(getOwnerNotifications());
    const onStorage = (event) => {
        if (event?.key && event.key !== STORAGE_KEY) return;
        onChange();
    };

    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);

    return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener("storage", onStorage);
    };
};
