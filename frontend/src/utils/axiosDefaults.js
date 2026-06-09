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

axios.interceptors.request.use((config) => {
    const path = pathFromUrl(config?.url);
    const activeStaffSession = getActiveStaffSession();
    const staffToken = activeStaffSession?.token || null;
    const customerToken = localStorage.getItem("customerToken");

    config.headers = config.headers || {};

    if (!config.headers.Authorization) {
        if (path.startsWith("/customer") && customerToken) {
            config.headers.Authorization = `Bearer ${customerToken}`;
        } else if (staffToken) {
            config.headers.Authorization = `Bearer ${staffToken}`;
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
            try {
                if (path.startsWith("/customer")) {
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
                        detail: { scope: path.startsWith("/customer") ? "customer" : "staff" },
                    })
                );
            } catch {
                // ignore
            }
        }
        return Promise.reject(error);
    }
);
