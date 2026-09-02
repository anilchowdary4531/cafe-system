import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { appendOwnerNotification } from "../utils/ownerNotifications";

const DEFAULT_DURATION_MS = 3200;

const iconFor = (variant) => {
    const v = String(variant || "info").toLowerCase();
    if (v === "success") return CheckCircle2;
    if (v === "error") return AlertTriangle;
    return Info;
};

const classFor = (variant) => {
    const v = String(variant || "info").toLowerCase();
    if (v === "success") return "border-emerald-500/50 bg-[#062419] text-emerald-100 shadow-emerald-950/40";
    if (v === "error") return "border-red-500/50 bg-[#290c0c] text-red-100 shadow-red-950/40";
    return "border-amber-500/50 bg-[#241a06] text-amber-100 shadow-amber-950/40";
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

            setToasts((prev) => [...prev.slice(-2), toast]);

            const pathname = String(window.location?.pathname || "");
            if (pathname.startsWith("/owner")) {
                appendOwnerNotification({
                    title: toast.title || "Notification",
                    message: toast.message || toast.title || "New update available.",
                    type: toast.variant || "info",
                });
            }

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
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 220, damping: 20 }}
                    className={`pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border px-4.5 py-3.5 shadow-2xl backdrop-blur-xl ${classFor(
                        toast.variant
                    )}`}
                >
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-xl bg-white/10 p-2 text-white flex-shrink-0">
                            <Icon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            {toast.title && <p className="text-sm font-extrabold text-white leading-snug">{toast.title}</p>}
                            {toast.message && <p className="mt-0.5 text-xs text-white/80 font-medium leading-relaxed">{toast.message}</p>}
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
                                    className="mt-2 inline-flex rounded-xl bg-white text-black px-3 py-1.5 text-xs font-black hover:bg-amber-300 transition"
                                >
                                    {toast.actionLabel}
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                            className="rounded-xl p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
                            aria-label="Dismiss"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </motion.div>
            );
        });
    }, [toasts]);

    return (
        <div
            className="pointer-events-none fixed left-0 right-0 z-[100] flex flex-col items-center gap-3 px-4"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
        >
            <AnimatePresence>{rendered}</AnimatePresence>
        </div>
    );
}
