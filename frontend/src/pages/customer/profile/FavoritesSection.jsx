import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2 } from "lucide-react";
import { getCustomerFavorites, setCustomerFavorites } from "../../../utils/customerFavorites";
import { showToast } from "../../../utils/toast";

const formatMoney = (value) => `₹${Math.round(Number(value || 0))}`;

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
        <div className="space-y-6">
            <div className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Favorites</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Saved dishes</h1>
                <p className="theme-muted mt-3 text-sm md:text-base">Your most-loved items across restaurants.</p>
            </div>

            {favorites.length === 0 ? (
                <div className="theme-panel rounded-[32px] p-10 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-black/20">
                        <Heart className="theme-accent-text" size={28} />
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold">No favorites yet</h2>
                    <p className="theme-muted mt-2">Open a restaurant menu and tap the heart icon.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {grouped.map((group) => (
                        <section key={group.slug} className="theme-panel rounded-[32px] p-6 md:p-8">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="theme-muted text-xs font-semibold uppercase tracking-[0.22em]">Restaurant</p>
                                    <h3 className="mt-2 text-2xl font-semibold">{group.name}</h3>
                                </div>
                                <Link
                                    to={`/r/${group.slug}`}
                                    className="theme-button inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold"
                                >
                                    Open Menu
                                </Link>
                            </div>

                            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {group.items.map((fav) => (
                                    <article key={fav.key} className="theme-card overflow-hidden rounded-3xl">
                                        {fav.image ? (
                                            <img src={fav.image} alt={fav.itemName} className="h-40 w-full object-cover" />
                                        ) : (
                                            <div className="h-40 w-full bg-black/20" />
                                        )}
                                        <div className="p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-lg font-semibold">{fav.itemName}</p>
                                                    <p className="theme-muted mt-1 text-sm">{formatMoney(fav.price)}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFavorite(fav.key)}
                                                    className="theme-soft-button inline-flex h-10 w-10 items-center justify-center rounded-2xl"
                                                    aria-label="Remove"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
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

