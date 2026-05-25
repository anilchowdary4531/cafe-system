import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRestaurantContext } from "../context/RestaurantContext";
import { cachedGet } from "../utils/apiClient";

export default function RestaurantSelector({ variant = "default" }) {
    const compact = variant === "compact";
    const navigate = useNavigate();
    const location = useLocation();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const dropdownRef = useRef(null);

    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    const selectedSlug = String(restaurantContext?.slug || "");

    const selected = useMemo(() => {
        return restaurants.find((r) => String(r.slug) === selectedSlug) || null;
    }, [restaurants, selectedSlug]);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                setLoading(true);
                if (!alive) return;
                const list = await cachedGet("/restaurants", { ttlMs: 10 * 60_000, staleMs: 60 * 60_000 });
                if (!alive) return;
                setRestaurants(Array.isArray(list) ? list : []);
            } catch {
                if (!alive) return;
                setRestaurants([]);
            } finally {
                if (alive) setLoading(false);
            }
        };
        load();
        return () => {
            alive = false;
        };
    }, []);

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
        setOpen(false);
    }, [location.pathname, location.search]);

    const handleChange = (slug) => {
        const next = restaurants.find((r) => String(r.slug) === String(slug));
        if (!next) return;

        setRestaurantContext({
            id: next.id || null,
            name: next.name || null,
            slug: next.slug || null,
            logo: next.logo || next.logoUrl || null,
            tableNo: null,
        });

        // If the user is currently on a restaurant menu page, switching restaurants should navigate.
        // We intentionally drop any existing `?table=` query because it is tied to the previous restaurant.
        const path = String(location.pathname || "");
        if (path === "/" || path.startsWith("/r/")) {
            navigate(`/r/${next.slug}`);
        }
    };

    const selectedName = selected?.name || "";
    const triggerLabel = (() => {
        if (loading) return "Loading restaurants...";
        if (selectedName) return selectedName;
        if (!restaurants.length) return "No restaurants";
        return "Select restaurant";
    })();

    const listDisabled = loading || restaurants.length === 0;

    return (
        <div
            ref={dropdownRef}
            className={[
                "theme-dropdown theme-dropdown-menu",
                compact ? "theme-dropdown-compact" : "",
                open ? "theme-dropdown-open" : "",
                listDisabled ? "theme-dropdown-disabled" : "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <span className="theme-dropdown-label">
                <MapPin size={15} />
                <span>{compact ? "Restaurant" : "Restaurant"}</span>
            </span>

            <button
                type="button"
                className="theme-dropdown-trigger"
                aria-label="Select restaurant"
                aria-haspopup="listbox"
                aria-expanded={open}
                disabled={listDisabled}
                onClick={() => {
                    if (listDisabled) return;
                    setOpen((prev) => !prev);
                }}
            >
                <span className="theme-dropdown-trigger-text">{triggerLabel}</span>
                <ChevronDown size={16} className="theme-dropdown-chevron" aria-hidden="true" />
            </button>

            <span className="theme-dropdown-swatch" aria-hidden="true" />

            {open && (
                <div className="theme-dropdown-panel" role="listbox" aria-label="Restaurants">
                    {restaurants.map((restaurant) => {
                        const isActive = String(restaurant.slug) === String(selected?.slug || selectedSlug);
                        const placeText = [restaurant.city, restaurant.state].filter(Boolean).join(", ");

                        return (
                            <button
                                key={restaurant.id}
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                className={`theme-dropdown-option ${isActive ? "is-active" : ""}`}
                                onClick={() => {
                                    handleChange(restaurant.slug);
                                    setOpen(false);
                                }}
                            >
                                <span className="theme-dropdown-option-main">
                                    <span className="theme-dropdown-option-name">{restaurant.name}</span>
                                    {placeText ? (
                                        <span className="theme-dropdown-option-meta">{placeText}</span>
                                    ) : null}
                                </span>
                                {isActive ? (
                                    <Check size={16} className="theme-dropdown-option-check" aria-hidden="true" />
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
