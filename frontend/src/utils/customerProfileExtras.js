const STORAGE_KEY = "customer_profile_extras:v1";

const safeParse = (raw) => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const normalizePhoneKey = (phone) => String(phone || "").trim();

const readAll = () => {
    if (typeof window === "undefined") return {};
    const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
};

const writeAll = (next) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next || {}));
    } catch {
        // ignore quota / private mode issues
    }
};

export const getCustomerProfileExtras = (phone) => {
    const key = normalizePhoneKey(phone);
    if (!key) return { nickname: "", avatarDataUrl: "" };
    const all = readAll();
    const raw = all[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { nickname: "", avatarDataUrl: "" };
    return {
        nickname: String(raw.nickname || "").trim(),
        avatarDataUrl: String(raw.avatarDataUrl || "").trim(),
    };
};

export const setCustomerProfileExtras = (phone, patch = {}) => {
    const key = normalizePhoneKey(phone);
    if (!key) return { nickname: "", avatarDataUrl: "" };

    const all = readAll();
    const prev = getCustomerProfileExtras(key);
    const next = {
        nickname: String(patch.nickname ?? prev.nickname ?? "").trim(),
        avatarDataUrl: String(patch.avatarDataUrl ?? prev.avatarDataUrl ?? "").trim(),
    };

    if (!next.nickname && !next.avatarDataUrl) {
        delete all[key];
    } else {
        all[key] = next;
    }

    writeAll(all);
    return next;
};

