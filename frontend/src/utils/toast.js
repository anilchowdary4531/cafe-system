export const showToast = (payload, options = {}) => {
    if (typeof window === "undefined") return;

    let title = "";
    let message = "";
    let variant = "info";
    let actionLabel = "";
    let onAction = null;
    let durationMs;

    if (typeof payload === "string") {
        title = payload;
        if (options && typeof options === "object") {
            variant = options.type || options.variant || "info";
            actionLabel = options.actionLabel || "";
            onAction = options.onAction;
            durationMs = options.durationMs;
        }
    } else if (payload && typeof payload === "object") {
        title = payload.title ? String(payload.title) : (payload.message ? String(payload.message) : "");
        message = payload.title && payload.message ? String(payload.message) : "";
        variant = payload.variant || payload.type || "info";
        actionLabel = payload.actionLabel ? String(payload.actionLabel) : "";
        onAction = typeof payload.onAction === "function" ? payload.onAction : null;
        durationMs = payload.durationMs ? Number(payload.durationMs) : undefined;
    }

    window.dispatchEvent(
        new CustomEvent("toast:show", {
            detail: {
                title,
                message,
                variant,
                actionLabel,
                onAction,
                durationMs,
            },
        })
    );
};
