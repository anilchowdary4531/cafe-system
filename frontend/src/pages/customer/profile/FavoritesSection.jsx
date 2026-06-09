import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2 } from "lucide-react";
import { getCustomerFavorites, setCustomerFavorites } from "../../../utils/customerFavorites";
import { resolveImageUrl } from "../../../utils/resolveImageUrl";
import { showToast } from "../../../utils/toast";
import { buildRestaurantMenuPath } from "../../../utils/restaurantMenuNavigation";

const formatMoney = (value) => `Rs ${Math.round(Number(value || 0))}`;

export default function FavoritesSection() {
    const [favorites, setFavorites] = useState(() => getCustomerFavorites());

    const grouped = useMemo(() => {
        const byRestaurant = new Map();
        favorites.forEach((fav) => {
            const slug = String(fav?.restaurantSlug || "").trim();
            if (!slug) return;
            if (!byRestaurant.has(slug)) {
                byRestaurant.set(slug, {
                    slug,
                    name: String(fav?.restaurantName || slug),
                    items: [],
                });
            }
            byRestaurant.get(slug).items.push(fav);
        });
        return [...byRestaurant.values()];
    }, [favorites]);

    const removeFavorite = (key) => {
        const next = favorites.filter((f) => String(f?.key || "") !== String(key || ""));
        setCustomerFavorites(next);
        setFavorites(next);
        showToast({ title: "Removed", message: "Removed from favorites.", variant: "success" });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2 px-1">
                <p className="theme-accent-text text-[11px] font-semibold uppercase tracking-[0.28em]">Favorites</p>
                <h1 className="text-2xl font-bold tracking-tight md:text-[2rem]">Saved dishes</h1>
                <p className="theme-muted text-xs md:text-sm">Your most-loved items across restaurants.</p>
            </div>

            {favorites.length === 0 ? (
                <div className="px-1 py-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-black/10">
                        <Heart className="theme-accent-text" size={22} />
                    </div>
                    <h2 className="mt-3 text-xl font-semibold">No favorites yet</h2>
                    <p className="theme-muted mt-1 text-sm">Open a restaurant menu and tap the heart icon.</p>
                </div>
            ) : (
                <div className="space-y-4 px-1">
                    {grouped.map((group) => (
                        <section key={group.slug} className="border-b border-[var(--app-border)] pb-4 last:border-b-0">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Restaurant</p>
                                    <h3 className="mt-1 text-lg font-semibold">{group.name}</h3>
                                    <p className="theme-muted mt-0.5 text-xs">{group.items.length} item{group.items.length === 1 ? "" : "s"}</p>
                                </div>
                                <Link
                                    to={buildRestaurantMenuPath(group.slug)}
                                    className="theme-button inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold"
                                >
                                    Open Menu
                                </Link>
                            </div>

                            <div className="mt-3 space-y-0">
                                {group.items.map((fav) => (
                                    <article key={fav.key} className="flex items-center gap-3 border-b border-[var(--app-border)] py-2.5 last:border-b-0">
                                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/15">
                                            {fav.image ? (
                                                <img src={resolveImageUrl(fav.image)} alt={fav.itemName} className="h-full w-full object-cover" />
                                            ) : null}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold">{fav.itemName}</p>
                                            <p className="theme-muted mt-0.5 text-xs">{formatMoney(fav.price)}</p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeFavorite(fav.key)}
                                            className="theme-soft-button inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                            aria-label="Remove"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
