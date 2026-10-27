const STAFF_TOKEN_KEY = "token";
const STAFF_USER_KEY = "user";
const STAFF_MODE_KEY = "staff_session_mode";

const safeParse = (value) => {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const getStorage = (scope) => {
    if (typeof window === "undefined") return null;
    if (scope === "session") return window.sessionStorage;
    if (scope === "local") return window.localStorage;
    return null;
};

const readSession = (storage, scope) => {
    if (!storage) return null;

    const token = String(storage.getItem(STAFF_TOKEN_KEY) || "").trim();
    if (!token) return null;

    const user = safeParse(storage.getItem(STAFF_USER_KEY));

    return {
        scope,
        token,
        user: user && typeof user === "object" ? user : null,
    };
};

export const getActiveStaffSession = () => {
    if (typeof window === "undefined") return null;

    const sessionMode = window.sessionStorage.getItem(STAFF_MODE_KEY);
    const session = readSession(window.sessionStorage, "session");
    if (session) return session;
    if (sessionMode === "session") return null;
    return readSession(window.localStorage, "local") || null;
};

export const getActiveStaffToken = () => getActiveStaffSession()?.token || null;

export const getActiveStaffScope = () => getActiveStaffSession()?.scope || null;

export const writeStaffSession = ({ token, user, scope = "local" }) => {
    const storage = getStorage(scope);
    if (!storage) return null;

    storage.setItem(STAFF_TOKEN_KEY, String(token || ""));
    storage.setItem(STAFF_USER_KEY, JSON.stringify(user || null));
    if (scope === "session") {
        window.sessionStorage.setItem(STAFF_MODE_KEY, "session");
    } else {
        window.sessionStorage.removeItem(STAFF_MODE_KEY);
    }

    return {
        scope,
        token: String(token || ""),
        user: user || null,
    };
};

export const clearStaffSession = (scope = "active") => {
    if (typeof window === "undefined") return;

    const resolvedScope =
        scope === "active" ? getActiveStaffScope() || "local" : scope;
    const storage = getStorage(resolvedScope === "session" ? "session" : "local");
    if (!storage) return;

    storage.removeItem(STAFF_TOKEN_KEY);
    storage.removeItem(STAFF_USER_KEY);
    if (resolvedScope === "local") {
        window.sessionStorage.removeItem(STAFF_MODE_KEY);
    }
};
