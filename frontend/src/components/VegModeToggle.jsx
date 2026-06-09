import { Leaf } from "lucide-react";

export default function VegModeToggle({ enabled = false, onToggle, className = "", compact = false }) {
    const handleClick = () => {
        if (typeof onToggle === "function") {
            onToggle(!enabled);
        }
    };

    const activeStyle = enabled
        ? {
              backgroundColor: "#16a34a",
              borderColor: "#15803d",
              color: "#ffffff",
              boxShadow: "0 10px 22px rgba(34, 197, 94, 0.22)",
          }
        : {
              backgroundColor: "rgba(255,255,255,0.96)",
              borderColor: "rgba(34,197,94,0.35)",
              color: "#166534",
          };

    return (
        <button
            type="button"
            aria-pressed={enabled}
            onClick={handleClick}
            style={activeStyle}
            className={[
                "theme-soft-button inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap font-medium transition",
                compact ? "min-w-[76px] px-3 py-2 text-[11px] sm:min-w-[84px] sm:px-3.5 sm:text-xs" : "min-w-[92px] px-3 py-2 text-xs sm:min-w-[104px] sm:px-4 sm:text-sm",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <Leaf size={compact ? 15 : 16} strokeWidth={2.4} />
            <span>{enabled ? "Veg only" : "Veg"}</span>
        </button>
    );
}
