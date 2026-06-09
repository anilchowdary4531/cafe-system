import { useEffect, useState } from "react";
import {
    Building2,
    LayoutDashboard,
    Menu,
    Search,
    Settings,
    Store,
    UserRound,
    Users,
    X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cachedGet } from "../../utils/apiClient";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import tiffzyLogo from "../../assets/tiffzy-logo.png";

const SUPER_ADMIN_MENU_ITEMS = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/super-admin" },
    { key: "profile", label: "Profile", icon: UserRound, to: "/super-admin#profile-section" },
    { key: "users", label: "Users", icon: Users, to: "/super-admin/users" },
    { key: "restaurants", label: "Restaurants", icon: Building2, to: "/super-admin#restaurants-section" },
    { key: "create-restaurant", label: "Create Restaurant", icon: Store, to: "/super-admin/create-restaurant" },
    { key: "settings", label: "Settings", icon: Settings, to: "/super-admin/settings" },
];

export default function SuperAdminUsers() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const [restaurants, setRestaurants] = useState([]);
    const [summary, setSummary] = useState(null);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeMenuKey, setActiveMenuKey] = useState("users");

    const loadUsers = async (search = query) => {
        try {
            setLoading(true);
            const data = await cachedGet("/super-admin/users", {
                params: search ? { q: search } : {},
                ttlMs: 10_000,
                staleMs: 60_000,
                scope: "auth",
            });
            setRestaurants(data?.restaurants || []);
            setSummary(data?.summary || null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers("");
    }, []);

    useEffect(() => {
        if (location.pathname === "/super-admin/users") {
            setActiveMenuKey("users");
        }
    }, [location.pathname]);

    useEffect(() => {
        if (!sidebarOpen) return undefined;

        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
            }
        };

        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [sidebarOpen]);

    const handleMenuClick = (item) => {
        setActiveMenuKey(item.key);
        setSidebarOpen(false);
        navigate(item.to);
    };

    return (
        <div className="theme-page min-h-screen">
            <div className={`fixed inset-0 z-50 transition ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
                <button
                    type="button"
                    aria-label="Close Tiffzy menu"
                    onClick={() => setSidebarOpen(false)}
                    className={`absolute inset-0 bg-black/45 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
                />
                <aside
                    className={`theme-panel theme-border absolute left-0 top-0 h-full w-72 max-w-[84vw] border-r p-5 shadow-2xl transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.2em]">Menu</p>
                            <h2 className="text-xl font-bold">Tiffzy</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="theme-soft-button inline-flex h-9 w-9 items-center justify-center rounded-xl"
                            aria-label="Close sidebar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <nav className="mt-5 grid gap-2">
                        {SUPER_ADMIN_MENU_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = item.key === activeMenuKey;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleMenuClick(item)}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${isActive ? "theme-button" : "theme-soft-button"}`}
                                >
                                    <Icon size={17} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>
            </div>

            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                        >
                            <Menu size={16} />
                            Tiffzy
                        </button>
                        <div className="flex h-12 w-12 -rotate-2 items-center justify-center overflow-hidden rounded-md border border-[#d9c8af] bg-transparent p-0.5 shadow-[0_3px_8px_rgba(88,61,36,0.14)]">
                            <img src={tiffzyLogo} alt="Tiffzy logo" className="h-full w-full object-contain mix-blend-multiply" />
                        </div>
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.28em]">Super Admin</p>
                            <h1 className="text-2xl font-bold">Users</h1>
                            <p className="theme-muted text-sm">{user?.email || "admin@tiffzy.com"}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={logout}
                            className="rounded-full bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
                {error && (
                    <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                <section className="theme-panel rounded-3xl p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <Users className="theme-accent-text" size={20} />
                                <h2 className="text-xl font-bold">Users Under Restaurants</h2>
                            </div>
                            <p className="theme-muted mt-2 text-sm">
                                Showing {summary?.users || 0} users across {summary?.restaurants || 0} restaurants.
                            </p>
                        </div>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                loadUsers(query);
                            }}
                            className="theme-input flex items-center gap-2 rounded-2xl px-3 py-2 md:w-80"
                        >
                            <Search size={16} className="theme-muted" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search user or restaurant"
                                className="w-full bg-transparent text-sm outline-none"
                            />
                        </form>
                    </div>

                    {loading ? (
                        <div className="theme-empty mt-5 rounded-2xl p-8 text-center">
                            Loading users...
                        </div>
                    ) : restaurants.length ? (
                        <div className="mt-5 grid gap-4">
                            {restaurants.map((restaurant) => (
                                <article key={restaurant.id} className="theme-card rounded-2xl p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="theme-pill flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                                            {restaurant.logoUrl ? (
                                                <img
                                                    src={resolveImageUrl(restaurant.logoUrl)}
                                                    alt={`${restaurant.name} logo`}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <Store size={20} className="theme-muted" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-lg font-bold">{restaurant.name}</h3>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${restaurant.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                                    {restaurant.isActive ? "Active" : "Disabled"}
                                                </span>
                                            </div>
                                            <p className="theme-muted mt-1 text-sm">/{restaurant.slug} - {restaurant.city || "City not set"}</p>
                                        </div>
                                    </div>

                                    {restaurant.users?.length ? (
                                        <div className="mt-4 overflow-x-auto">
                                            <table className="w-full min-w-[560px] text-sm">
                                                <thead>
                                                    <tr className="theme-muted text-left">
                                                        <th className="px-3 py-2 font-semibold">User Name</th>
                                                        <th className="px-3 py-2 font-semibold">Phone Number</th>
                                                        <th className="px-3 py-2 font-semibold">Email</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {restaurant.users.map((item) => (
                                                        <tr key={item.id} className="border-t theme-border">
                                                            <td className="px-3 py-2">{item.name || "Not set"}</td>
                                                            <td className="px-3 py-2">{item.phone || "Not set"}</td>
                                                            <td className="px-3 py-2">{item.email || "Not set"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="theme-empty mt-4 rounded-xl p-4 text-sm">
                                            No users found under this restaurant.
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="theme-empty mt-5 rounded-2xl p-8 text-center">
                            No restaurants or users found.
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
