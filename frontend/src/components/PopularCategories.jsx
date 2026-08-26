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

const CATEGORY_DEFAULT_IMAGES = {
    all: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=300&q=80",
    biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80",
    briyani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80",
    pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80",
    burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80",
    coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80",
    cofee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80",
    "fast food": "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=300&q=80",
    dessert: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80",
    desserts: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80",
    beverage: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=300&q=80",
    beverages: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=300&q=80",
    "ice cream": "https://images.unsplash.com/photo-1567206563064-6f60f4006501?auto=format&fit=crop&w=300&q=80",
    food: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80",
    sweet: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=300&q=80",
    sweets: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=300&q=80",
};

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

export const getCategoryFallbackImage = (name = "") => {
    const clean = String(name).toLowerCase().trim();
    if (CATEGORY_DEFAULT_IMAGES[clean]) {
        return CATEGORY_DEFAULT_IMAGES[clean];
    }

    for (const [key, url] of Object.entries(CATEGORY_DEFAULT_IMAGES)) {
        if (clean.includes(key)) return url;
    }

    return CATEGORY_DEFAULT_IMAGES.food;
};

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

export const normalizeCategoryName = (raw = "") => {
    const s = String(raw || "").trim();
    if (!s) return "";
    const lower = s.toLowerCase();
    if (lower === "cofee") return "Coffee";
    if (lower === "dessert") return "Desserts";
    if (lower === "briyani") return "Biryani";
    if (lower === "beverage") return "Beverages";
    if (lower === "sweet" || lower === "sweets") return "Sweet";
    if (lower === "food") return "Food";
    return s.charAt(0).toUpperCase() + s.slice(1);
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
            const rawName = String(cat?.name || "").trim();
            const name = normalizeCategoryName(rawName);
            if (name && !seenNames.has(name.toLowerCase())) {
                seenNames.add(name.toLowerCase());
                dynamicCategories.push({
                    name,
                    imageUrl: cat.imageUrl || getCategoryFallbackImage(name),
                });
            }
        }

        // 2. Add dynamic categories from available items
        if (Array.isArray(items)) {
            for (const item of items) {
                const rawName = String(item?.category || "").trim();
                const name = normalizeCategoryName(rawName);
                if (name && !seenNames.has(name.toLowerCase())) {
                    seenNames.add(name.toLowerCase());
                    dynamicCategories.push({
                        name,
                        imageUrl: item.image || getCategoryFallbackImage(name),
                    });
                }
            }
        }

        // 3. Add default fallbacks if missing
        for (const fb of DEFAULT_FALLBACK_CATEGORIES) {
            const name = normalizeCategoryName(fb.name);
            if (!seenNames.has(name.toLowerCase())) {
                seenNames.add(name.toLowerCase());
                dynamicCategories.push({
                    name,
                    imageUrl: getCategoryFallbackImage(name),
                });
            }
        }

        return [
            { name: "All", imageUrl: CATEGORY_DEFAULT_IMAGES.all },
            ...dynamicCategories.slice(0, 14),
        ];
    }, [globalCategories, items]);

    return (
        <div className={`space-y-3 ${className}`}>
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--app-text)] sm:text-sm">
                    Popular Categories
                </h2>
                {selectedCategory ? (
                    <button
                        type="button"
                        onClick={() => onSelectCategory?.("")}
                        className="text-xs font-extrabold text-[color:var(--app-accent)] hover:underline"
                    >
                        Clear Filter
                    </button>
                ) : null}
            </div>

            <div className="snap-x snap-mandatory overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max gap-3.5 sm:gap-4">
                    {categoriesList.map((cat) => {
                        const isAll = cat.name.toLowerCase() === "all";
                        const isActive = isAll
                            ? !selectedCategory
                            : selectedCategory.toLowerCase() === cat.name.toLowerCase();

                        const imgUrl = resolveImageUrl(cat.imageUrl) || getCategoryFallbackImage(cat.name);

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
                                    className={`relative h-[56px] w-[56px] rounded-full p-[2.5px] transition duration-300 sm:h-[64px] sm:w-[64px] ${
                                        isActive
                                            ? "bg-[linear-gradient(135deg,#ff8a1f_0%,#d97706_100%)] shadow-lg shadow-[#ff8a1f]/35 scale-105"
                                            : "border border-[var(--app-border)] bg-white/10 hover:border-[#ff8a1f]/50 hover:scale-105"
                                    }`}
                                >
                                    <div className="relative h-full w-full overflow-hidden rounded-full bg-zinc-900">
                                        <img
                                            src={imgUrl}
                                            alt={cat.name}
                                            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                                            loading="lazy"
                                        />
                                        {isAll ? (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                                                    ALL
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                <span
                                    className={`truncate text-center text-[10.5px] font-bold capitalize sm:text-[11.5px] max-w-[64px] sm:max-w-[72px] ${
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
