import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRestaurantContext } from "../context/RestaurantContext";
import { cachedGet } from "../utils/apiClient";

export default function RestaurantSelector({ variant = "default" }) {
    const compact = variant === "compact";
    const navigate = useNavigate();
    const location = useLocation();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();

    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <label className={`theme-dropdown ${compact ? "theme-dropdown-compact" : ""}`}>
            <span className="theme-dropdown-label">
                <MapPin size={15} />
                <span>{compact ? "Restaurant" : "Restaurant"}</span>
            </span>

            <select
                value={selected ? selected.slug : selectedSlug}
                onChange={(event) => handleChange(event.target.value)}
                aria-label="Select restaurant"
                disabled={loading || restaurants.length === 0}
            >
                {!selectedSlug && (
                    <option value="" disabled>
                        Select...
                    </option>
                )}
                {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.slug}>
                        {restaurant.name}
                    </option>
                ))}
            </select>

            <span className="theme-dropdown-swatch" aria-hidden="true" />
        </label>
    );
}
