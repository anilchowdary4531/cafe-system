import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

const DEFAULT_DURATION_MS = 2600;

const iconFor = (variant) => {
    const v = String(variant || "info").toLowerCase();
    if (v === "success") return CheckCircle2;
    if (v === "error") return AlertTriangle;
    return Info;
};

const classFor = (variant) => {
    const v = String(variant || "info").toLowerCase();
    if (v === "success") return "border-emerald-500/30 bg-emerald-500/10";
    if (v === "error") return "border-red-500/30 bg-red-500/10";
    return "border-white/10 bg-black/20";
};

export default function ToastHost() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const handler = (event) => {
            const detail = event?.detail || {};
            const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const durationMs = Number(detail.durationMs || DEFAULT_DURATION_MS);

            const toast = {
                id,
                title: String(detail.title || ""),
                message: String(detail.message || ""),
                variant: String(detail.variant || "info"),
                actionLabel: String(detail.actionLabel || ""),
                onAction: typeof detail.onAction === "function" ? detail.onAction : null,
                durationMs,
            };

            setToasts((prev) => [...prev.slice(-2), toast]); // keep max 3

            if (durationMs > 0) {
                window.setTimeout(() => {
                    setToasts((prev) => prev.filter((t) => t.id !== id));
                }, durationMs);
            }
        };

        window.addEventListener("toast:show", handler);
        return () => window.removeEventListener("toast:show", handler);
    }, []);

    const rendered = useMemo(() => {
        return toasts.map((toast) => {
            const Icon = iconFor(toast.variant);
            return (
                <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 180, damping: 18 }}
                    className={`theme-panel pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border px-4 py-3 shadow-2xl ${classFor(
                        toast.variant
                    )}`}
                >
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-xl bg-black/20 p-2">
                            <Icon size={18} className="theme-accent-text" />
                        </div>
                        <div className="min-w-0 flex-1">
                            {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
                            {toast.message && <p className="theme-muted mt-0.5 text-sm">{toast.message}</p>}
                            {toast.actionLabel && toast.onAction && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        try {
                                            toast.onAction();
                                        } finally {
                                            setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                                        }
                                    }}
                                    className="theme-button mt-2 inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold"
                                >
                                    {toast.actionLabel}
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                            className="theme-muted rounded-xl p-1.5 hover:opacity-80"
                            aria-label="Dismiss"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </motion.div>
            );
        });
    }, [toasts]);

    return (
        <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-[90] flex flex-col items-center gap-3 px-4">
            <AnimatePresence>{rendered}</AnimatePresence>
        </div>
    );
}

