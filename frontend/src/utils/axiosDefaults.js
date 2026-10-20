import axios from "axios";
import { clearStaffSession, getActiveStaffSession } from "./staffSessionStorage";

const pathFromUrl = (url) => {
    const raw = String(url || "");
    try {
        const u = new URL(raw, window.location.origin);
        return String(u.pathname || "");
    } catch {
        return raw.startsWith("/") ? raw : "";
    }
};

const isCustomerPath = (path) => {
    const p = String(path || "").toLowerCase();
    return (
        p.startsWith("/customer") ||
        p.startsWith("/api/customer") ||
        p.startsWith("/wallet") ||
        p.startsWith("/api/wallet") ||
        p.startsWith("/api/notifications") ||
        p.includes("scope=customer")
    );
};

axios.interceptors.request.use((config) => {
    const path = pathFromUrl(config?.url);
    const activeStaffSession = getActiveStaffSession();
    const staffToken = activeStaffSession?.token || null;
    const customerToken = localStorage.getItem("customerToken");

    config.headers = config.headers || {};

    if (!config.headers.Authorization) {
        if (isCustomerPath(path)) {
            if (customerToken) {
                config.headers.Authorization = `Bearer ${customerToken}`;
            }
        } else if (staffToken) {
            config.headers.Authorization = `Bearer ${staffToken}`;
        } else if (customerToken) {
            config.headers.Authorization = `Bearer ${customerToken}`;
        }
    }

    return config;
});

axios.interceptors.response.use(
    (res) => res,
    (error) => {
        const status = error?.response?.status;
        if (status === 401) {
            const path = pathFromUrl(error?.config?.url);
            const activeStaffSession = getActiveStaffSession();
            const isCustomer = isCustomerPath(path);
            try {
                if (isCustomer) {
                    localStorage.removeItem("customerToken");
                    localStorage.removeItem("customer");
                } else {
                    clearStaffSession(activeStaffSession?.scope || "local");
                }
            } catch {
                // ignore
            }
            try {
                window.dispatchEvent(
                    new CustomEvent("auth:logout", {
                        detail: { scope: isCustomer ? "customer" : "staff" },
                    })
                );
            } catch {
                // ignore
            }
        }
        return Promise.reject(error);
    }
);
