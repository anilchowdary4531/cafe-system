import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ChefHat, ShoppingCart, UserCircle2, UtensilsCrossed, LayoutGrid } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThemeSelector from "./ThemeSelector";
import RestaurantSelector from "./RestaurantSelector";
import { useRestaurantContext } from "../context/RestaurantContext";
import BrandLogo from "./BrandLogo";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";
import { resolveEffectiveStaffRole } from "../utils/staffRole";

export default function Navbar() {
    const location = useLocation();
    const { user, customer, staffToken, logout } = useAuth();
    const { restaurantContext } = useRestaurantContext();
    const isCustomerProfileScope = new URLSearchParams(location.search).get("scope") === "customer";
    const hasStaffSession = Boolean(user && staffToken);
    const isStaff = hasStaffSession && !isCustomerProfileScope;
    const activeProfile = isStaff ? user : customer;
    const normalizedRole = resolveEffectiveStaffRole(isStaff ? user?.role : "", isStaff ? user?.designation : "");
    const isProfilePage =
        String(location.pathname || "").startsWith("/profile") ||
        String(location.pathname || "").startsWith("/staff/profile");

    const loginPath = (() => {
        const path = String(location.pathname || "");
        if (path.startsWith("/owner") || path.startsWith("/admin") || path.startsWith("/super-admin")) {
            return "/login?mode=staff";
        }
        return "/login?mode=customer";
    })();

    const restaurantName = (() => {
        const fromUserRestaurant = isStaff ? user?.restaurant?.name || user?.restaurantName || null : null;
        if (fromUserRestaurant) return fromUserRestaurant;

        if (normalizedRole === "SUPER_ADMIN" || normalizedRole === "ADMIN") {
            return "All Restaurants";
        }

        return restaurantContext?.name || "Tiffzy";
    })();

    const customerMenuPath = (() => {
        const slug = String(restaurantContext?.slug || "").trim();
        return buildRestaurantMenuPath(slug, restaurantContext?.tableNo);
    })();

    const staffProfilePath = (() => {
        const staffId = String(user?.id || "").trim();
        return staffId ? `/staff/profile/${encodeURIComponent(staffId)}` : "/kitchen";
    })();

    const staffLinks = (() => {
        if (!isStaff) return [];
        const role = normalizedRole;
        const links = [
            {
                key: "pos",
                to: "/admin/new-order",
                label: "Billing Desk",
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
                key: "server",
                to: "/server",
                label: "Server",
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

                {isStaff && ["OWNER", "MANAGER", "CHEF", "CASHIER"].includes(normalizedRole) && (
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
                                aria-label="Tiffzy Home"
                                title="Home"
                            >
                                <BrandLogo className="theme-brand-logo h-10 w-10" title="Tiffzy Home" />
                            </Link>
                        )}

                        <Link
                            to={isStaff ? staffProfilePath : customerMenuPath || "/"}
                            className="theme-soft-button inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm"
                            aria-label={isProfilePage && !isStaff ? "Return" : "Profile"}
                            title={isProfilePage && !isStaff ? "Return" : "Profile"}
                        >
                            {isProfilePage && !isStaff ? <ChevronLeft size={18} /> : <UserCircle2 size={18} />}
                        </Link>

                        {isStaff && (
                            <button
                                type="button"
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
