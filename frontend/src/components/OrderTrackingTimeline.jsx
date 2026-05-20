import { useMemo } from "react";
import { Check } from "lucide-react";

const DEFAULT_STEPS = [
    { key: "PLACED", label: "Placed", hint: "Order received" },
    { key: "PREPARING", label: "Preparing", hint: "Kitchen is working on it" },
    { key: "READY", label: "Ready", hint: "Almost there" },
    { key: "SERVED", label: "Served", hint: "Enjoy your meal" },
];

const normalizeStatus = (value) => {
    const s = String(value || "").trim().toUpperCase();
    if (!s) return "PLACED";
    if (s === "ACCEPTED") return "PREPARING";
    if (s === "DELIVERED") return "SERVED";
    return s;
};

export default function OrderTrackingTimeline({ status, steps = DEFAULT_STEPS, compact = false }) {
    const currentKey = normalizeStatus(status);

    const currentIndex = useMemo(() => {
        const idx = steps.findIndex((s) => String(s?.key || "").toUpperCase() === currentKey);
        return idx >= 0 ? idx : 0;
    }, [currentKey, steps]);

    return (
        <ol className={compact ? "space-y-3" : "space-y-4"}>
            {steps.map((step, idx) => {
                const isDone = idx < currentIndex;
                const isActive = idx === currentIndex;
                const isLast = idx === steps.length - 1;

                const markerClass = isDone
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                    : isActive
                        ? "border-amber-400/50 bg-amber-400/10 text-amber-100 ring-2 ring-amber-400/15"
                        : "border-white/10 bg-black/10 theme-muted";

                const lineClass = isDone
                    ? "bg-emerald-400/35"
                    : isActive
                        ? "bg-amber-400/25"
                        : "bg-white/10";

                return (
                    <li key={step.key} className={["relative flex gap-4", isLast ? "" : compact ? "pb-3" : "pb-4"].join(" ")}>
                        <div className="flex w-8 flex-col items-center">
                            <div
                                className={[
                                    "flex h-8 w-8 items-center justify-center rounded-2xl border",
                                    markerClass,
                                    isActive ? "animate-[pulse_1.8s_ease-in-out_infinite]" : "",
                                ].join(" ")}
                                aria-hidden="true"
                            >
                                {isDone ? (
                                    <Check size={16} className="text-emerald-200" />
                                ) : (
                                    <span className="text-xs font-extrabold tabular-nums">{idx + 1}</span>
                                )}
                            </div>
                            {!isLast && <div className={["mt-2 w-px flex-1 rounded-full", lineClass].join(" ")} />}
                        </div>

                        <div className="min-w-0 pt-0.5">
                            <p
                                className={[
                                    "text-sm font-semibold",
                                    isDone ? "text-emerald-100" : isActive ? "text-amber-100" : "",
                                ].join(" ")}
                            >
                                {step.label}
                            </p>
                            {step.hint && <p className="theme-muted mt-1 text-xs">{step.hint}</p>}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

