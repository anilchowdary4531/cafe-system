import { useMemo } from "react";
import { Check } from "lucide-react";

const DEFAULT_STEPS = [
    { key: "PLACED", label: "Placed", hint: "Order received" },
    { key: "PREPARING", label: "Preparing", hint: "Kitchen is working on it" },
    { key: "READY", label: "Ready", hint: "Almost there" },
    { key: "SERVED", label: "Served", hint: "Enjoy your meal" },
];

const getStepKeys = (steps) =>
    new Set(
        (Array.isArray(steps) ? steps : [])
            .map((step) => String(step?.key || "").trim().toUpperCase())
            .filter(Boolean)
    );

const getTerminalStepKey = (steps) => {
    const stepKeys = getStepKeys(steps);
    if (stepKeys.has("PICKED_UP")) return "PICKED_UP";
    if (stepKeys.has("DELIVERED")) return "DELIVERED";
    if (stepKeys.has("SERVED")) return "SERVED";
    return "";
};

const normalizeStatus = (value, steps = DEFAULT_STEPS) => {
    const s = String(value || "").trim().toUpperCase();
    if (!s) return "PLACED";
    if (s === "ACCEPTED") return "PREPARING";
    if (s === "DELIVERED" || s === "SERVED") return getTerminalStepKey(steps) || s;
    return s;
};

export default function OrderTrackingTimeline({ status, steps = DEFAULT_STEPS, compact = false }) {
    const currentKey = normalizeStatus(status, steps);

    const currentIndex = useMemo(() => {
        const idx = steps.findIndex((s) => String(s?.key || "").toUpperCase() === currentKey);
        return idx >= 0 ? idx : 0;
    }, [currentKey, steps]);

    if (compact) {
        return (
            <div className="w-full pb-1">
                <ol className="grid w-full grid-cols-4 gap-2 sm:gap-3">
                    {steps.map((step, idx) => {
                        const isDone = idx < currentIndex;
                        const isActive = idx === currentIndex;
                        const isLast = idx === steps.length - 1;

                        const markerClass = isDone
                            ? "border-[#dfc07b] bg-[#fff5d8] text-black"
                            : isActive
                                ? "border-[#e2b64a] bg-[#fff1c5] text-black ring-2 ring-[#e2b64a]/18"
                                : "border-[#d8d0c4] bg-[#f2ece1] text-black/45";

                        const connectorClass = isDone
                            ? "bg-[#e2b64a]/60"
                            : isActive
                                ? "bg-[#e2b64a]/45"
                                : "bg-[#d8d0c4]";

                        return (
                            <li key={step.key} className="relative min-w-0 flex flex-col items-center pt-1 text-center">
                                {!isLast && (
                                    <span
                                        className={["absolute top-4 left-1/2 right-[-50%] h-[2px] rounded-full", connectorClass].join(" ")}
                                        aria-hidden="true"
                                    />
                                )}

                                <div
                                    className={[
                                        "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_1px_0_rgba(255,255,255,0.7)]",
                                        markerClass,
                                        isActive ? "animate-[pulse_1.8s_ease-in-out_infinite]" : "",
                                    ].join(" ")}
                                    aria-hidden="true"
                                >
                                    {isDone ? (
                                        <Check size={18} className="text-black" />
                                    ) : (
                                        <span className="text-sm font-extrabold tabular-nums text-black">{idx + 1}</span>
                                    )}
                                </div>

                                <p
                                    className={[
                                        "mt-3 truncate px-1 text-sm font-semibold text-black",
                                        isActive ? "font-bold" : "",
                                    ].join(" ")}
                                    title={step.label}
                                >
                                    {step.label}
                                </p>
                            </li>
                        );
                    })}
                </ol>
            </div>
        );
    }

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
