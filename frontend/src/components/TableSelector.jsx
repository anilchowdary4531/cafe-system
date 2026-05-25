import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, TableProperties } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useRestaurantContext } from "../context/RestaurantContext";
import useCachedGet from "../hooks/useCachedGet";

export default function TableSelector({ slug, variant = "default", className = "", disabled = false }) {
    const compact = variant === "compact";
    const pos = variant === "pos";
    const dropdownRef = useRef(null);
    const [open, setOpen] = useState(false);
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
    const isDisabled = disabled || !enabled || tables.length === 0;

    useEffect(() => {
        // If URL has `?table=`, prefer it as the source of truth.
        if (!enabled) return;
        if (disabled) return;
        if (!tableFromUrl) return;
        if (tableFromUrl === restaurantContext?.tableNo) return;
        setRestaurantContext({ tableNo: tableFromUrl });
    }, [disabled, enabled, restaurantContext?.tableNo, setRestaurantContext, tableFromUrl]);

    useEffect(() => {
        const closeOnOutsideClick = (event) => {
            if (!dropdownRef.current) return;
            if (!dropdownRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        window.addEventListener("pointerdown", closeOnOutsideClick);
        window.addEventListener("keydown", closeOnEscape);

        return () => {
            window.removeEventListener("pointerdown", closeOnOutsideClick);
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, []);

    useEffect(() => {
        if (!isDisabled) return;
        setOpen(false);
    }, [isDisabled]);

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

        setOpen(false);
    };

    const selectedTable = useMemo(
        () => tables.find((table) => table.tableNo === selectedTableNo) || null,
        [selectedTableNo, tables]
    );

    const triggerLabel = selectedTable
        ? `${selectedTable.tableNo}${selectedTable.seats ? ` (${selectedTable.seats} seats)` : ""}`
        : selectedTableNo || "Takeaway / No table";

    const options = useMemo(
        () => [
            {
                key: "__takeaway__",
                value: "",
                label: "Takeaway / No table",
                meta: "No table assigned",
            },
            ...tables.map((table) => ({
                key: table.id || `table-${table.tableNo}`,
                value: table.tableNo,
                label: table.tableNo,
                meta: table.seats ? `${table.seats} seats` : "",
            })),
        ],
        [tables]
    );

    const renderOptions = (ariaLabel) => (
        <div className="theme-dropdown-panel" role="listbox" aria-label={ariaLabel}>
            {options.map((option) => {
                const isActive = String(option.value) === selectedTableNo;
                return (
                    <button
                        key={option.key}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className={`theme-dropdown-option ${isActive ? "is-active" : ""}`}
                        onClick={() => handleChange(option.value)}
                    >
                        <span className="theme-dropdown-option-main">
                            <span className="theme-dropdown-option-name">{option.label}</span>
                            {option.meta ? <span className="theme-dropdown-option-meta">{option.meta}</span> : null}
                        </span>
                        {isActive ? (
                            <Check size={16} className="theme-dropdown-option-check" aria-hidden="true" />
                        ) : null}
                    </button>
                );
            })}
        </div>
    );

    if (pos) {
        return (
            <div
                ref={dropdownRef}
                className={[
                    "relative flex items-center gap-3 rounded-3xl border border-white/10 bg-black/10 px-4 py-3 shadow-sm backdrop-blur transition",
                    isDisabled ? "cursor-not-allowed opacity-70" : "hover:bg-black/20",
                    open ? "theme-dropdown-open" : "",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] theme-accent-text">
                    <TableProperties size={16} />
                    Table
                </span>

                <button
                    type="button"
                    className="theme-dropdown-trigger min-w-0 flex-1 text-base font-bold sm:text-lg"
                    aria-label="Select table"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    disabled={isDisabled}
                    onClick={() => {
                        if (isDisabled) return;
                        setOpen((prev) => !prev);
                    }}
                >
                    <span className="theme-dropdown-trigger-text">{triggerLabel}</span>
                    <ChevronDown size={18} className="theme-dropdown-chevron" aria-hidden="true" />
                </button>

                {open ? (
                    <div className="absolute left-auto right-0 top-[calc(100%+8px)] z-50 w-[280px] max-w-[calc(100vw-2rem)]">
                        {renderOptions("Tables")}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div
            ref={dropdownRef}
            className={[
                "theme-dropdown theme-dropdown-menu",
                compact ? "theme-dropdown-compact" : "",
                open ? "theme-dropdown-open" : "",
                isDisabled ? "theme-dropdown-disabled" : "",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <span className="theme-dropdown-label">
                <TableProperties size={15} />
                <span>{compact ? "Table" : "Select Table"}</span>
            </span>

            <button
                type="button"
                className="theme-dropdown-trigger"
                aria-label="Select table"
                aria-haspopup="listbox"
                aria-expanded={open}
                disabled={isDisabled}
                onClick={() => {
                    if (isDisabled) return;
                    setOpen((prev) => !prev);
                }}
            >
                <span className="theme-dropdown-trigger-text">{triggerLabel}</span>
                <ChevronDown size={16} className="theme-dropdown-chevron" aria-hidden="true" />
            </button>

            <span className="theme-dropdown-swatch" aria-hidden="true" />

            {open ? renderOptions("Tables") : null}
        </div>
    );
}
