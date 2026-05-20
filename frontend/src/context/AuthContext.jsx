import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAllCache } from "../utils/localCache";
import { getCustomerSettings } from "../utils/customerSettings";

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
    return useContext(AuthContext);
}

export default function AuthProvider({ children }) {
    const navigate = useNavigate();
    const [user, setUser] = useState(readStored("user"));
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

    useEffect(() => {
        const handleStorage = (event) => {
            if (!event?.key) return;
            if (event.key === "user") setUser(readStored("user"));
            if (event.key === "customer") setCustomer(readStored("customer"));
            if (event.key === "token" && !event.newValue) setUser(null);
            if (event.key === "customerToken") setCustomerToken(event.newValue || null);
        };

        const handleForcedLogout = (event) => {
            // NOTE: storage events do NOT fire on the same tab that calls localStorage.setItem/removeItem.
            // Our axios interceptor dispatches `auth:logout` so we can sync state immediately.
            const scope = String(event?.detail?.scope || "").toLowerCase(); // "staff" | "customer" | ""

            if (!scope || scope === "staff") {
                setUser(null);
            }

            if (!scope || scope === "customer") {
                setCustomer(null);
                setCustomerToken(null);
            }

            clearAllCache();
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener("auth:logout", handleForcedLogout);
        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("auth:logout", handleForcedLogout);
        };
    }, []);

    const login = (data) => {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
    };

    const loginCustomer = (profile) => {
        const nextCustomer = {
            id: profile?.id || null,
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
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        clearAllCache();
        navigate("/login", { replace: true });
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
                customer,
                customerToken,
                login,
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
