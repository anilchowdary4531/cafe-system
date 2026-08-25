import { useMemo } from "react";
import {
    Cake,
    Coffee,
    Flame,
    GlassWater,
    IceCream,
    Pizza,
    Soup,
    Utensils,
} from "lucide-react";
import useCachedGet from "../hooks/useCachedGet";
import { resolveImageUrl } from "../utils/resolveImageUrl";

const DEFAULT_FALLBACK_CATEGORIES = [
    { name: "Biryani" },
    { name: "Pizza" },
    { name: "Burger" },
    { name: "Coffee" },
    { name: "Fast Food" },
    { name: "Desserts" },
    { name: "Beverages" },
    { name: "Ice Cream" },
];

export const getCategoryIcon = (name = "") => {
    const clean = String(name).toLowerCase().trim();
    if (clean.includes("pizza")) return Pizza;
    if (clean.includes("coffee") || clean.includes("cafe")) return Coffee;
    if (clean.includes("cake") || clean.includes("dessert") || clean.includes("sweet")) return Cake;
    if (clean.includes("ice cream")) return IceCream;
    if (clean.includes("biryani") || clean.includes("briyani") || clean.includes("rice") || clean.includes("soup")) return Soup;
    if (clean.includes("drink") || clean.includes("beverage")) return GlassWater;
    if (clean.includes("burger") || clean.includes("fast food") || clean.includes("fries") || clean.includes("sandwich")) return Flame;
    return Utensils;
};

export default function PopularCategories({
    items = [],
    selectedCategory = "",
    onSelectCategory,
    className = "",
}) {
    const { data: globalCatData } = useCachedGet("/global-categories", {
        ttlMs: 15_000,
        staleMs: 60_000,
    });

    const globalCategories = Array.isArray(globalCatData)
        ? globalCatData.filter((c) => c?.isActive !== false)
        : Array.isArray(globalCatData?.categories)
        ? globalCatData.categories.filter((c) => c?.isActive !== false)
        : [];

    const categoriesList = useMemo(() => {
        const dynamicCategories = [];
        const seenNames = new Set();

        // 1. Add global categories from server
        for (const cat of globalCategories) {
            const name = String(cat?.name || "").trim();
            if (name && !seenNames.has(name.toLowerCase())) {
                seenNames.add(name.toLowerCase());
                dynamicCategories.push({
                    name,
                    imageUrl: cat.imageUrl || null,
                });
            }
        }

        // 2. Add dynamic categories from available items
        if (Array.isArray(items)) {
            for (const item of items) {
                const name = String(item?.category || "").trim();
                if (name && !seenNames.has(name.toLowerCase())) {
                    seenNames.add(name.toLowerCase());
                    dynamicCategories.push({
                        name,
                        imageUrl: item.image || null,
                    });
                }
            }
        }

        // 3. Add default fallbacks if missing
        for (const fb of DEFAULT_FALLBACK_CATEGORIES) {
            if (!seenNames.has(fb.name.toLowerCase())) {
                seenNames.add(fb.name.toLowerCase());
                dynamicCategories.push(fb);
            }
        }

        return [{ name: "All", imageUrl: null }, ...dynamicCategories.slice(0, 12)];
    }, [globalCategories, items]);

    return (
        <div className={`space-y-2.5 ${className}`}>
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-[color:var(--app-text)] sm:text-base">
                    Popular Categories
                </h2>
                {selectedCategory ? (
                    <button
                        type="button"
                        onClick={() => onSelectCategory?.("")}
                        className="text-xs font-bold text-[color:var(--app-accent)] hover:underline"
                    >
                        Clear Filter
                    </button>
                ) : null}
            </div>

            <div className="snap-x snap-mandatory overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max gap-3 sm:gap-4">
                    {categoriesList.map((cat) => {
                        const isAll = cat.name.toLowerCase() === "all";
                        const isActive = isAll
                            ? !selectedCategory
                            : selectedCategory.toLowerCase() === cat.name.toLowerCase();

                        const IconComp = getCategoryIcon(cat.name);
                        const resolvedImg = resolveImageUrl(cat.imageUrl);

                        return (
                            <button
                                key={cat.name}
                                type="button"
                                onClick={() => {
                                    if (isAll) {
                                        onSelectCategory?.("");
                                    } else {
                                        onSelectCategory?.(isActive ? "" : cat.name);
                                    }
                                }}
                                className="group flex w-[64px] shrink-0 snap-start flex-col items-center gap-1.5 focus:outline-none sm:w-[72px]"
                            >
                                <div
                                    className={`relative flex h-[52px] w-[52px] items-center justify-center rounded-full transition duration-300 sm:h-[60px] sm:w-[60px] ${
                                        isActive
                                            ? "ring-4 ring-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white shadow-lg shadow-[color:var(--app-accent)]/30 scale-105"
                                            : "border border-[var(--app-border)] bg-black/20 text-white/80 hover:border-white/30 hover:bg-black/40 hover:scale-105"
                                    }`}
                                >
                                    {resolvedImg && !isAll ? (
                                        <img
                                            src={resolvedImg}
                                            alt={cat.name}
                                            className="h-full w-full rounded-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <IconComp
                                            size={isActive ? 26 : 24}
                                            className={`transition ${isActive ? "text-white" : "text-[color:var(--app-accent)] group-hover:scale-110"}`}
                                        />
                                    )}
                                </div>
                                <span
                                    className={`truncate text-center text-[10.5px] font-bold sm:text-[11.5px] max-w-[64px] sm:max-w-[72px] ${
                                        isActive
                                            ? "text-[color:var(--app-accent)]"
                                            : "text-[color:var(--app-muted)] group-hover:text-[color:var(--app-text)]"
                                    }`}
                                >
                                    {cat.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
