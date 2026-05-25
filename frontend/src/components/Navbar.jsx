import { Link, useLocation } from "react-router-dom";
import { ChefHat, ShoppingCart, UserCircle2, UtensilsCrossed, LayoutGrid } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThemeSelector from "./ThemeSelector";
import RestaurantSelector from "./RestaurantSelector";
import { useRestaurantContext } from "../context/RestaurantContext";
import BrandLogo from "./BrandLogo";

export default function Navbar() {
    const location = useLocation();
    const { user, customer, logout } = useAuth();
    const { restaurantContext } = useRestaurantContext();
    const activeProfile = user || customer;
    const isStaff = Boolean(user);
    const normalizedRole = String(user?.role || "").toUpperCase();
    const isProfilePage = String(location.pathname || "").startsWith("/profile");

    const loginPath = (() => {
        const path = String(location.pathname || "");
        if (path.startsWith("/owner") || path.startsWith("/admin") || path.startsWith("/super-admin")) {
            return "/login?mode=staff";
        }
        return "/login?mode=customer";
    })();

    const restaurantName = (() => {
        const fromUserRestaurant = user?.restaurant?.name || user?.restaurantName || null;
        if (fromUserRestaurant) return fromUserRestaurant;

        if (normalizedRole === "SUPER_ADMIN" || normalizedRole === "ADMIN") {
            return "All Restaurants";
        }

        return restaurantContext?.name || "Tiffzy";
    })();

    const customerMenuPath = (() => {
        const slug = String(restaurantContext?.slug || "").trim();
        return slug ? `/r/${encodeURIComponent(slug)}` : "/";
    })();

    const staffLinks = (() => {
        if (!isStaff) return [];
        const role = normalizedRole;
        const links = [
            {
                key: "pos",
                to: "/admin/new-order",
                label: "New Order",
                icon: <UtensilsCrossed size={16} />,
                allow: true,
            },
            {
                key: "kitchen",
                to: "/kitchen",
                label: "Kitchen",
                icon: <ChefHat size={16} />,
                allow: role === "SUPER_ADMIN" || role === "OWNER" || role === "MANAGER" || role === "CHEF",
            },
            {
                key: "waiter",
                to: "/waiter",
                label: "Waiter",
                icon: <LayoutGrid size={16} />,
                allow: role === "SUPER_ADMIN" || role === "OWNER" || role === "MANAGER" || role === "WAITER" || role === "CASHIER",
            },
        ];
        return links.filter((l) => l.allow);
    })();

    return (
        <div className="theme-nav flex w-full flex-col gap-4 border-b px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
            {!isProfilePage && (
                <div className="flex items-center gap-3">
                    <Link
                        to="/"
                        className="inline-flex h-14 w-14 items-center justify-center"
                        aria-label="Tiffzy Home"
                    >
                        <BrandLogo className="theme-brand-logo h-full w-full" title="Tiffzy logo" />
                    </Link>
                    <div>
                        <Link to="/" className="theme-brand-text text-3xl font-bold leading-none">
                            Tiffzy
                        </Link>
                        <p className="theme-muted text-xs">
                            {isStaff ? restaurantName : customer?.phone || restaurantName}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex w-full flex-wrap items-center justify-between gap-2 md:w-auto md:justify-end md:gap-4">
                {!isStaff && !isProfilePage && <RestaurantSelector variant="compact" />}
                {isStaff && <ThemeSelector />}

                {staffLinks.map((link) => (
                    <Link
                        key={link.key}
                        to={link.to}
                        className="theme-soft-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                    >
                        {link.icon}
                        {link.label}
                    </Link>
                ))}

                {normalizedRole === "SUPER_ADMIN" && (
                    <Link
                        to="/super-admin"
                        className="theme-button-secondary rounded-lg px-4 py-2 text-sm"
                    >
                        Super Admin
                    </Link>
                )}

                {normalizedRole === "ADMIN" && (
                    <Link
                        to="/admin"
                        className="theme-button-secondary rounded-lg px-4 py-2 text-sm"
                    >
                        Dashboard
                    </Link>
                )}

                {user && normalizedRole !== "ADMIN" && normalizedRole !== "SUPER_ADMIN" && (
                    <Link
                        to="/owner"
                        className="theme-button-secondary rounded-lg px-4 py-2 text-sm"
                    >
                        Back Office
                    </Link>
                )}

                {activeProfile ? (
                    <>
                        {!isStaff && isProfilePage && (
                            <Link
                                to="/"
                                className="inline-flex h-12 w-12 items-center justify-center"
                                aria-label="Home"
                                title="Home"
                            >
                                <BrandLogo className="theme-brand-logo h-10 w-10" title="Home" />
                            </Link>
                        )}

                        <Link
                            to={isStaff ? "/profile" : customerMenuPath}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                        >
                            <UserCircle2 size={18} />
                            Profile
                        </Link>

                        {isStaff && (
                            <button
                                onClick={logout}
                                className="rounded-lg bg-red-500 px-4 py-2 text-sm"
                            >
                                Logout
                            </button>
                        )}
                    </>
                ) : (
                    <Link
                        to={loginPath}
                        className="theme-button rounded-lg px-4 py-2 text-sm"
                    >
                        Login
                    </Link>
                )}

                <Link
                    to="/cart"
                    className="theme-icon-button theme-icon-button-primary inline-flex items-center justify-center rounded-lg p-2.5"
                    aria-label="Cart"
                >
                    <ShoppingCart size={18} />
                </Link>
            </div>
        </div>
    );
}
