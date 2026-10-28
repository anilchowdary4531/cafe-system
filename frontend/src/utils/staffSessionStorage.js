export const STAFF_OFFLINE_GRACE_PERIOD_HOURS = 72;
export const STAFF_OFFLINE_GRACE_PERIOD_SECONDS = STAFF_OFFLINE_GRACE_PERIOD_HOURS * 60 * 60;
export const STAFF_OFFLINE_GRACE_PERIOD_MS = STAFF_OFFLINE_GRACE_PERIOD_SECONDS * 1000;

export const STAFF_TOKEN_KEY = "token";
export const STAFF_USER_KEY = "user";
export const STAFF_REFRESH_TOKEN_KEY = "staff_refresh_token";
export const STAFF_LAST_VALIDATED_KEY = "staff_last_validated_at";
export const STAFF_MODE_KEY = "staff_session_mode";

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

    // Authoritative 72-Hour Offline Grace Period Check:
    // If the device has been continuous offline / unvalidated for >= 72 hours, expire the session.
    const rawValidated = storage.getItem(STAFF_LAST_VALIDATED_KEY);
    if (rawValidated) {
        const lastValidated = Number(rawValidated);
        if (Number.isFinite(lastValidated) && (Date.now() - lastValidated >= STAFF_OFFLINE_GRACE_PERIOD_MS)) {
            storage.removeItem(STAFF_TOKEN_KEY);
            storage.removeItem(STAFF_USER_KEY);
            storage.removeItem(STAFF_REFRESH_TOKEN_KEY);
            storage.removeItem(STAFF_LAST_VALIDATED_KEY);
            return null;
        }
    }

    const user = safeParse(storage.getItem(STAFF_USER_KEY));

    return {
        scope,
        token,
        user: user && typeof user === "object" ? user : null,
    };
};

export const getActiveStaffSession = () => {
    if (typeof window === "undefined") return null;

    const sessionMode = window.sessionStorage?.getItem(STAFF_MODE_KEY);
    const session = readSession(window.sessionStorage, "session");
    if (session) return session;
    if (sessionMode === "session") return null;
    return readSession(window.localStorage, "local") || null;
};

export const getActiveStaffToken = () => getActiveStaffSession()?.token || null;

export const getActiveStaffScope = () => getActiveStaffSession()?.scope || null;

export const getStaffRefreshToken = () => {
    if (typeof window === "undefined") return null;
    const session = window.sessionStorage?.getItem(STAFF_REFRESH_TOKEN_KEY);
    if (session) return session;
    return window.localStorage?.getItem(STAFF_REFRESH_TOKEN_KEY) || null;
};

export const getStaffLastValidatedAt = (scope = "active") => {
    if (typeof window === "undefined") return null;
    if (scope === "session") {
        const val = Number(window.sessionStorage?.getItem(STAFF_LAST_VALIDATED_KEY));
        return Number.isFinite(val) && val > 0 ? val : null;
    }
    if (scope === "local") {
        const val = Number(window.localStorage?.getItem(STAFF_LAST_VALIDATED_KEY));
        return Number.isFinite(val) && val > 0 ? val : null;
    }
    const sessionVal = Number(window.sessionStorage?.getItem(STAFF_LAST_VALIDATED_KEY));
    if (Number.isFinite(sessionVal) && sessionVal > 0) return sessionVal;
    const localVal = Number(window.localStorage?.getItem(STAFF_LAST_VALIDATED_KEY));
    return Number.isFinite(localVal) && localVal > 0 ? localVal : null;
};

export const isStaffWithinOfflineGracePeriod = (scope = "active") => {
    const lastValidated = getStaffLastValidatedAt(scope);
    if (!lastValidated) return false;
    const elapsed = Date.now() - lastValidated;
    return elapsed >= 0 && elapsed < STAFF_OFFLINE_GRACE_PERIOD_MS;
};

export const isStaffOfflineGracePeriodExpired = (scope = "active") => {
    const lastValidated = getStaffLastValidatedAt(scope);
    if (!lastValidated) return false;
    const elapsed = Date.now() - lastValidated;
    return elapsed >= STAFF_OFFLINE_GRACE_PERIOD_MS;
};

export const writeStaffSession = ({ token, refreshToken, user, scope = "local", validatedAt }) => {
    const storage = getStorage(scope);
    if (!storage) return null;

    storage.setItem(STAFF_TOKEN_KEY, String(token || ""));
    storage.setItem(STAFF_USER_KEY, JSON.stringify(user || null));

    if (refreshToken !== undefined) {
        if (refreshToken) {
            storage.setItem(STAFF_REFRESH_TOKEN_KEY, String(refreshToken));
        } else {
            storage.removeItem(STAFF_REFRESH_TOKEN_KEY);
        }
    }

    const existingValidated = storage.getItem(STAFF_LAST_VALIDATED_KEY);
    if (validatedAt !== undefined) {
        if (validatedAt) {
            storage.setItem(STAFF_LAST_VALIDATED_KEY, String(validatedAt));
        } else {
            storage.removeItem(STAFF_LAST_VALIDATED_KEY);
        }
    } else if (!existingValidated) {
        storage.setItem(STAFF_LAST_VALIDATED_KEY, String(Date.now()));
    }

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
    storage.removeItem(STAFF_REFRESH_TOKEN_KEY);
    storage.removeItem(STAFF_LAST_VALIDATED_KEY);
    if (resolvedScope === "local") {
        window.sessionStorage.removeItem(STAFF_MODE_KEY);
    }
};
