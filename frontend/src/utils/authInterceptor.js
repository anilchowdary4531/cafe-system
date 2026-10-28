import axios from "axios";
import { API } from "../config";
import {
    clearStaffSession,
    getActiveStaffSession,
    getStaffRefreshToken,
    isStaffWithinOfflineGracePeriod,
    writeStaffSession,
} from "./staffSessionStorage";

let isRefreshingStaff = false;
let staffRefreshQueue = [];

const processStaffQueue = (error, token = null) => {
    staffRefreshQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    staffRefreshQueue = [];
};

/**
 * Safely extracts the pathname from any URL string or object.
 * Handles:
 * - Full URLs (e.g. "https://api.tiffzy.com/owner/1/tables" -> "/owner/1/tables")
 * - Root-relative URLs (e.g. "/customer/orders" -> "/customer/orders")
 * - Relative URLs (e.g. "api/wallet" -> "/api/wallet")
 */
export const pathFromUrl = (url) => {
    const raw = String(url || "");
    try {
        const u = new URL(raw, typeof window !== "undefined" ? window.location.origin : "http://localhost");
        return String(u.pathname || "");
    } catch {
        return raw.startsWith("/") ? raw : `/${raw}`;
    }
};

/**
 * Resolves whether an endpoint request belongs to:
 * - "customer": Customer portal / orders / profile / customer wallet / notifications
 * - "supplier": Supplier marketplace / catalog / chat / supplier profile
 * - "staff": Owner / Manager / Waiter / Chef / Cashier / Super Admin operations
 * - "public": Unauthenticated public endpoints
 */
export const resolveEndpointScope = (config) => {
    // 1. Explicit hints from config
    const explicitScope = String(
        config?.authScope ||
        config?.params?.scope ||
        config?.headers?.["X-Scope"] ||
        config?.headers?.["x-scope"] ||
        ""
    ).toLowerCase();

    if (explicitScope === "customer") return "customer";
    if (explicitScope === "supplier") return "supplier";
    if (explicitScope === "staff") return "staff";

    const path = pathFromUrl(config?.url).toLowerCase();

    // 2. Customer Paths
    if (
        path.startsWith("/customer") ||
        path.startsWith("/api/customer") ||
        path.startsWith("/wallet") ||
        path.startsWith("/api/wallet") ||
        path.startsWith("/r/") || // customer table/order routes: /r/:slug/order, /r/:slug/orders
        path.includes("scope=customer")
    ) {
        return "customer";
    }

    // 3. Supplier Paths
    if (
        path.startsWith("/supplier") ||
        path.startsWith("/api/supplier") ||
        path.startsWith("/suppliers") ||
        path.startsWith("/api/suppliers") ||
        path.startsWith("/supply-chat") ||
        path.startsWith("/api/supply-chat")
    ) {
        return "supplier";
    }

    // 4. Staff / Owner / Admin Paths
    if (
        path.startsWith("/owner") ||
        path.startsWith("/api/owner") ||
        path.startsWith("/staff") ||
        path.startsWith("/api/staff") ||
        path.startsWith("/super-admin") ||
        path.startsWith("/api/super-admin") ||
        path.startsWith("/kitchen") ||
        path.startsWith("/api/kitchen") ||
        path.startsWith("/server") ||
        path.startsWith("/tables") ||
        path.startsWith("/api/tables") ||
        path.startsWith("/kot") ||
        path.startsWith("/printers") ||
        path.startsWith("/shifts") ||
        path.startsWith("/reports") ||
        path.startsWith("/supply-orders") ||
        path.startsWith("/api/supply-orders") ||
        path.startsWith("/api/supply/marketplace")
    ) {
        return "staff";
    }

    // 5. Notifications endpoint (dual-use)
    if (path.startsWith("/api/notifications") || path.startsWith("/notifications")) {
        const activeStaff = getActiveStaffSession();
        if (activeStaff?.token) return "staff";
        if (typeof localStorage !== "undefined" && localStorage.getItem("supplierToken")) return "supplier";
        if (typeof localStorage !== "undefined" && localStorage.getItem("customerToken")) return "customer";
        return "staff";
    }

    // 6. Ambiguous / default: Determine based on active sessions without cross-contaminating
    const activeStaff = getActiveStaffSession();
    if (activeStaff?.token) return "staff";
    if (typeof localStorage !== "undefined" && localStorage.getItem("supplierToken")) return "supplier";
    if (typeof localStorage !== "undefined" && localStorage.getItem("customerToken")) return "customer";

    return "public";
};

/**
 * Attaches the appropriate token to the request configuration.
 * Strictly avoids cross-token contamination:
 * - A customerToken is NEVER attached to staff/owner/admin endpoints.
 * - A staffToken is NEVER attached to customer endpoints.
 * - A supplierToken is NEVER attached to customer or staff endpoints.
 */
export const applyAuthHeaders = (config) => {
    config.headers = config.headers || {};

    // If caller explicitly provided an Authorization header, respect it.
    if (config.headers.Authorization || config.headers.authorization) {
        return config;
    }

    const scope = resolveEndpointScope(config);
    const activeStaffSession = getActiveStaffSession();
    const staffToken = activeStaffSession?.token || null;
    const customerToken = typeof localStorage !== "undefined" ? localStorage.getItem("customerToken") : null;
    const supplierToken = typeof localStorage !== "undefined" ? localStorage.getItem("supplierToken") : null;

    if (scope === "customer") {
        if (customerToken) {
            config.headers.Authorization = `Bearer ${customerToken}`;
        }
    } else if (scope === "supplier") {
        if (supplierToken) {
            config.headers.Authorization = `Bearer ${supplierToken}`;
        }
    } else if (scope === "staff") {
        if (staffToken) {
            config.headers.Authorization = `Bearer ${staffToken}`;
        }
    } else {
        // Fallback for general unclassified endpoints
        if (staffToken) {
            config.headers.Authorization = `Bearer ${staffToken}`;
        } else if (supplierToken) {
            config.headers.Authorization = `Bearer ${supplierToken}`;
        } else if (customerToken) {
            config.headers.Authorization = `Bearer ${customerToken}`;
        }
    }

    return config;
};

/**
 * Response interceptor for handling 401 Unauthorized status.
 * Strictly evicts only the session matching the failing endpoint's scope.
 * Prevents customer 401s from nuking the staff session, and vice-versa.
 */
export const handleAuth401 = (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};

    if (status === 401) {
        const scope = resolveEndpointScope(originalRequest);

        if (scope === "customer") {
            try {
                if (typeof localStorage !== "undefined") {
                    localStorage.removeItem("customerToken");
                    localStorage.removeItem("customer");
                }
            } catch {
                // Ignore storage errors in non-browser envs
            }
            try {
                if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
                    window.dispatchEvent(new CustomEvent("auth:logout", { detail: { scope: "customer" } }));
                }
            } catch {
                // Ignore event errors in non-browser envs
            }
            return Promise.reject(error);
        }

        if (scope === "supplier") {
            try {
                if (typeof localStorage !== "undefined") {
                    localStorage.removeItem("supplierToken");
                    localStorage.removeItem("supplier");
                    localStorage.removeItem("supplier_refresh_token");
                }
            } catch {
                // Ignore storage errors in non-browser envs
            }
            try {
                if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
                    window.dispatchEvent(new CustomEvent("auth:logout", { detail: { scope: "supplier" } }));
                }
            } catch {
                // Ignore event errors in non-browser envs
            }
            return Promise.reject(error);
        }

        // Staff / Super Admin Scope
        const requestUrl = pathFromUrl(originalRequest?.url).toLowerCase();
        const isRefreshCall = requestUrl.includes("/auth/staff/refresh") || originalRequest._isStaffRefresh;

        if (isRefreshCall) {
            // The refresh call itself returned 401: explicit server revocation
            isRefreshingStaff = false;
            processStaffQueue(error, null);

            clearStaffSession();
            try {
                if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
                    window.dispatchEvent(new CustomEvent("auth:logout", { detail: { scope: "staff" } }));
                }
            } catch {
                // Ignore event errors in non-browser envs
            }
            return Promise.reject(error);
        }

        if (originalRequest._retry) {
            // Already retried once and still got 401
            clearStaffSession();
            try {
                if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
                    window.dispatchEvent(new CustomEvent("auth:logout", { detail: { scope: "staff" } }));
                }
            } catch {
                // Ignore event errors in non-browser envs
            }
            return Promise.reject(error);
        }

        const refreshToken = getStaffRefreshToken();
        if (!refreshToken) {
            // No refresh token available to renew
            clearStaffSession();
            try {
                if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
                    window.dispatchEvent(new CustomEvent("auth:logout", { detail: { scope: "staff" } }));
                }
            } catch {
                // Ignore event errors in non-browser envs
            }
            return Promise.reject(error);
        }

        // Single-flight refresh queue: if a refresh is already in-flight, wait for it
        if (isRefreshingStaff) {
            return new Promise((resolve, reject) => {
                staffRefreshQueue.push({ resolve, reject });
            })
                .then((newToken) => {
                    originalRequest._retry = true;
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return axios(originalRequest);
                })
                .catch((queueErr) => Promise.reject(queueErr));
        }

        originalRequest._retry = true;
        isRefreshingStaff = true;

        return new Promise((resolve, reject) => {
            axios
                .post(
                    `${API}/auth/staff/refresh`,
                    { refreshToken },
                    {
                        _isStaffRefresh: true,
                        headers: { "Content-Type": "application/json" },
                    }
                )
                .then((res) => {
                    const newToken = res.data?.token;
                    const newRefreshToken = res.data?.refreshToken || refreshToken;
                    const newUser = res.data?.user;

                    if (!newToken) {
                        throw new Error("No token returned from staff refresh");
                    }

                    const activeSession = getActiveStaffSession();
                    const targetScope = activeSession?.scope || "local";

                    writeStaffSession({
                        token: newToken,
                        refreshToken: newRefreshToken,
                        user: newUser || activeSession?.user,
                        scope: targetScope,
                        validatedAt: Date.now(),
                    });

                    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
                        window.dispatchEvent(
                            new CustomEvent("auth:token-refreshed", {
                                detail: { token: newToken, user: newUser },
                            })
                        );
                    }

                    processStaffQueue(null, newToken);

                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    resolve(axios(originalRequest));
                })
                .catch((refreshErr) => {
                    const isNetwork =
                        !refreshErr.response ||
                        refreshErr.code === "ERR_NETWORK" ||
                        refreshErr.code === "ECONNABORTED" ||
                        refreshErr.message === "Network Error" ||
                        (typeof navigator !== "undefined" && navigator.onLine === false);

                    const withinGrace = isStaffWithinOfflineGracePeriod();

                    if (isNetwork && withinGrace) {
                        // Genuinely offline and within 72-hour grace period!
                        // Preserve session; do NOT clear storage or log out.
                        processStaffQueue(refreshErr, null);
                        reject(refreshErr);
                        return;
                    }

                    // Genuine server rejection or grace period expired
                    clearStaffSession();
                    try {
                        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
                            window.dispatchEvent(new CustomEvent("auth:logout", { detail: { scope: "staff" } }));
                        }
                    } catch {
                        // Ignore event errors in non-browser envs
                    }
                    processStaffQueue(refreshErr, null);
                    reject(refreshErr);
                })
                .finally(() => {
                    isRefreshingStaff = false;
                });
        });
    }

    return Promise.reject(error);
};
