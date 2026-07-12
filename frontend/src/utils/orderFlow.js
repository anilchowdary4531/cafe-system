const ACTIVE_SCOPE_KEY = "cafe_system:order_flow_scope:v1";

export const ORDER_FLOW_SCOPES = {
    ONLINE: "online",
    TABLE: "table",
};

export const getOrderFlowScopeFromPath = (pathname = "") => {
    const path = String(pathname || "").trim();

    if (path.startsWith("/m/") || path.startsWith("/debug/menu/")) {
        return ORDER_FLOW_SCOPES.TABLE;
    }

    if (path.startsWith("/r/")) {
        return ORDER_FLOW_SCOPES.ONLINE;
    }

    return "";
};

export const getStoredOrderFlowScope = () => {
    try {
        const value = localStorage.getItem(ACTIVE_SCOPE_KEY);
        if (value === ORDER_FLOW_SCOPES.TABLE || value === ORDER_FLOW_SCOPES.ONLINE) {
            return value;
        }
    } catch {
        // ignore storage access failures
    }

    return ORDER_FLOW_SCOPES.ONLINE;
};

export const setStoredOrderFlowScope = (scope) => {
    const nextScope = scope === ORDER_FLOW_SCOPES.TABLE ? ORDER_FLOW_SCOPES.TABLE : ORDER_FLOW_SCOPES.ONLINE;

    try {
        localStorage.setItem(ACTIVE_SCOPE_KEY, nextScope);
    } catch {
        // ignore storage access failures
    }

    return nextScope;
};

export const resolveOrderFlowScope = (pathname = "") => {
    return getOrderFlowScopeFromPath(pathname) || getStoredOrderFlowScope();
};
