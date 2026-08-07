import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAllCache } from "../utils/localCache";
import { getCustomerSettings } from "../utils/customerSettings";
import {
    clearStaffSession,
    getActiveStaffSession,
    getActiveStaffScope,
    writeStaffSession,
} from "../utils/staffSessionStorage";

const AuthContext = createContext();

const readStored = (key) => {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
};

const parseJwtPayload = (token) => {
    try {
        const parts = String(token || "").split(".");
        if (parts.length < 2) return null;
        let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4) b64 += "=";
        const json = atob(b64);
        return JSON.parse(json);
    } catch {
        return null;
    }
};

const customerFromToken = (token) => {
    const payload = parseJwtPayload(token);
    if (!payload || String(payload.type || "") !== "customer") return null;
    const phone = String(payload.phone || "").trim();
    if (!phone) return null;
    return {
        id: payload.customerAccountId || null,
        name: "",
        email: "",
        phone,
        latestOrderId: null,
        verified: true,
    };
};

export function useAuth() {
    return useContext(AuthContext) || {};
}

export default function AuthProvider({ children }) {
    const navigate = useNavigate();
    const initialStaffSession = getActiveStaffSession();
    const [staffToken, setStaffToken] = useState(() => initialStaffSession?.token || null);
    const [user, setUser] = useState(() => initialStaffSession?.user || null);
    const [staffSessionScope, setStaffSessionScope] = useState(() => initialStaffSession?.scope || null);
    const [customerToken, setCustomerToken] = useState(() => {
        const token = localStorage.getItem("customerToken") || null;
        const settings = getCustomerSettings();
        if (token && settings.rememberSession === false) {
            try {
                localStorage.removeItem("customerToken");
            } catch {
                // ignore
            }
            return null;
        }
        return token;
    });
    const [customer, setCustomer] = useState(() => {
        const stored = readStored("customer");
        if (stored) return stored;
        const token = localStorage.getItem("customerToken");
        return token ? customerFromToken(token) : null;
    });

    const syncStaffSessionFromStorage = useCallback(() => {
        const session = getActiveStaffSession();

        setStaffToken(session?.token || null);
        setUser(session?.user || null);
        setStaffSessionScope(session?.scope || null);
    }, []);

    useEffect(() => {
        const handleStorage = (event) => {
            if (!event?.key) return;
            if (event.key === "user" || event.key === "token") {
                if (typeof window !== "undefined" && window.sessionStorage.getItem("token")) {
                    return;
                }
                syncStaffSessionFromStorage();
            }
            if (event.key === "customer") setCustomer(readStored("customer"));
            if (event.key === "customerToken") setCustomerToken(event.newValue || null);
        };

        const handleForcedLogout = (event) => {
            // NOTE: storage events do NOT fire on the same tab that calls localStorage.setItem/removeItem.
            // Our axios interceptor dispatches `auth:logout` so we can sync state immediately.
            const scope = String(event?.detail?.scope || "").toLowerCase(); // "staff" | "customer" | ""

            if (!scope || scope === "staff") {
                setUser(null);
                setStaffToken(null);
                setStaffSessionScope(null);
            }

            if (!scope || scope === "customer") {
                setCustomer(null);
                setCustomerToken(null);
            }

            clearAllCache();
        };

        const handlePageShow = () => {
            syncStaffSessionFromStorage();
        };

        const handleFocus = () => {
            syncStaffSessionFromStorage();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                syncStaffSessionFromStorage();
            }
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener("auth:logout", handleForcedLogout);
        window.addEventListener("pageshow", handlePageShow);
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("auth:logout", handleForcedLogout);
            window.removeEventListener("pageshow", handlePageShow);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    const login = (data) => {
        clearStaffSession("session");
        writeStaffSession({
            token: data.token,
            user: data.user,
            scope: "local",
        });
        setStaffToken(String(data.token || ""));
        setUser(data.user);
        setStaffSessionScope("local");
    };

    const loginSession = (data) => {
        writeStaffSession({
            token: data.token,
            user: data.user,
            scope: "session",
        });
        setStaffToken(String(data.token || ""));
        setUser(data.user);
        setStaffSessionScope("session");
    };

    const loginCustomer = (profile) => {
        const nextCustomer = {
            id: profile?.id || null,
            username: String(profile?.username || "").trim(),
            name: String(profile?.name || "").trim(),
            email: String(profile?.email || "").trim(),
            phone: String(profile?.phone || "").trim(),
            latestOrderId: profile?.latestOrderId || null,
            verified: Boolean(profile?.verified),
        };

        if (profile?.token) {
            const settings = getCustomerSettings();
            if (settings.rememberSession !== false) {
                localStorage.setItem("customerToken", String(profile.token));
                setCustomerToken(String(profile.token));
            } else {
                // Keep an in-memory-only profile (no persisted token) when the user opts out.
                localStorage.removeItem("customerToken");
                setCustomerToken(null);
            }
        }
        localStorage.setItem("customer", JSON.stringify(nextCustomer));
        setCustomer(nextCustomer);
    };

    const updateCustomer = (profile) => {
        const nextCustomer = {
            ...(customer || {}),
            ...profile,
        };
        localStorage.setItem("customer", JSON.stringify(nextCustomer));
        setCustomer(nextCustomer);
    };

    const logout = () => {
        clearStaffSession(staffSessionScope || getActiveStaffScope() || "local");
        setUser(null);
        setStaffToken(null);
        setStaffSessionScope(null);
        clearAllCache();
        navigate("/login?mode=staff", { replace: true });
    };

    const logoutCustomer = () => {
        localStorage.removeItem("customer");
        localStorage.removeItem("customerToken");
        setCustomer(null);
        setCustomerToken(null);
        clearAllCache();
        navigate("/", { replace: true });
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                staffToken,
                customer,
                customerToken,
                login,
                loginSession,
                loginCustomer,
                updateCustomer,
                logout,
                logoutCustomer,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
