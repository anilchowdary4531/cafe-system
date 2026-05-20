import { useEffect, useMemo } from "react";
import { ChevronDown, TableProperties } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useRestaurantContext } from "../context/RestaurantContext";
import useCachedGet from "../hooks/useCachedGet";

export default function TableSelector({ slug, variant = "default", className = "", disabled = false }) {
    const compact = variant === "compact";
    const pos = variant === "pos";
    const [searchParams, setSearchParams] = useSearchParams();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();

    const enabled = Boolean(slug);

    const { data } = useCachedGet(enabled ? `/r/${slug}/tables` : "/r/_/tables", {
        enabled,
        ttlMs: 30_000,
        staleMs: 10 * 60_000,
        scope: `restaurant:${slug}`,
    });

    const tables = useMemo(() => {
        const list = Array.isArray(data) ? data : [];
        return list
            .filter((t) => t && t.isActive !== false)
            .map((t) => ({
                id: t.id,
                tableNo: String(t.tableNo || "").trim(),
                seats: Number(t.seats || 0),
            }))
            .filter((t) => t.tableNo);
    }, [data]);

    const tableFromUrl = String(searchParams.get("table") || "").trim();
    const selectedTableNo = disabled ? "" : tableFromUrl || String(restaurantContext?.tableNo || "").trim();

    useEffect(() => {
        // If URL has `?table=`, prefer it as the source of truth.
        if (!enabled) return;
        if (disabled) return;
        if (!tableFromUrl) return;
        if (tableFromUrl === restaurantContext?.tableNo) return;
        setRestaurantContext({ tableNo: tableFromUrl });
    }, [disabled, enabled, restaurantContext?.tableNo, setRestaurantContext, tableFromUrl]);

    const handleChange = (nextTableNo) => {
        const value = String(nextTableNo || "").trim();

        setRestaurantContext({ tableNo: value || null });

        setSearchParams(
            (prev) => {
                if (value) prev.set("table", value);
                else prev.delete("table");
                return prev;
            },
            { replace: true }
        );
    };

    const isDisabled = disabled || !enabled || tables.length === 0;

    if (pos) {
        return (
            <label
                className={[
                    "flex items-center gap-3 rounded-3xl border border-white/10 bg-black/10 px-4 py-3 shadow-sm backdrop-blur transition",
                    isDisabled ? "cursor-not-allowed opacity-70" : "hover:bg-black/20",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] theme-accent-text">
                    <TableProperties size={16} />
                    Table
                </span>

                <div className="relative min-w-0 flex-1">
                    <select
                        value={selectedTableNo}
                        onChange={(event) => handleChange(event.target.value)}
                        aria-label="Select table"
                        disabled={isDisabled}
                        className="w-full appearance-none bg-transparent pr-8 text-base font-bold outline-none sm:text-lg"
                    >
                        <option value="">Takeaway / No table</option>
                        {tables.map((t) => (
                            <option key={t.id} value={t.tableNo}>
                                {t.tableNo}
                                {t.seats ? ` (${t.seats} seats)` : ""}
                            </option>
                        ))}
                    </select>
                    <ChevronDown
                        size={18}
                        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 theme-muted"
                        aria-hidden="true"
                    />
                </div>
            </label>
        );
    }

    return (
        <label className={`theme-dropdown ${compact ? "theme-dropdown-compact" : ""} ${className}`.trim()}>
            <span className="theme-dropdown-label">
                <TableProperties size={15} />
                <span>{compact ? "Table" : "Select Table"}</span>
            </span>

            <select
                value={selectedTableNo}
                onChange={(event) => handleChange(event.target.value)}
                aria-label="Select table"
                disabled={isDisabled}
            >
                <option value="">Takeaway / No table</option>
                {tables.map((t) => (
                    <option key={t.id} value={t.tableNo}>
                        {t.tableNo}{t.seats ? ` (${t.seats} seats)` : ""}
                    </option>
                ))}
            </select>

            <span className="theme-dropdown-swatch" aria-hidden="true" />
        </label>
    );
}
