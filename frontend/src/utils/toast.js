export const showToast = ({ title, message, variant = "info", actionLabel, onAction, durationMs } = {}) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent("toast:show", {
            detail: {
                title: title ? String(title) : "",
                message: message ? String(message) : "",
                variant,
                actionLabel: actionLabel ? String(actionLabel) : "",
                onAction: typeof onAction === "function" ? onAction : null,
                durationMs: durationMs ? Number(durationMs) : undefined,
            },
        })
    );
};

