import { useEffect, useState } from "react";
import {
    BarChart3,
    Building2,
    LayoutDashboard,
    Menu,
    Power,
    Search,
    Settings,
    Store,
    Users,
    X,
    Image as ImageIcon,
    ExternalLink,
    Utensils,
    Mail,
    Phone,
    Copy,
    Check,
    CreditCard,
    Shield,
    Receipt,
    MapPin,
    DollarSign
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import tiffzyLogo from "../../assets/tiffzy-logo.png";

const SUPER_ADMIN_MENU_ITEMS = [
    { key: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, to: "/super-admin" },
    { key: "restaurants", label: "Restaurant Management", icon: Building2, to: "/super-admin#restaurants-section" },
    { key: "restaurant-profile", label: "Restaurant Profile Page", icon: Utensils, to: "/super-admin/restaurant-profiles" },
    { key: "categories", label: "Home Categories", icon: Menu, to: "/super-admin/categories" },
    { key: "banners", label: "Promotion Banners", icon: ImageIcon, to: "/super-admin/banners" },
    { key: "users", label: "Customer & Staff Users", icon: Users, to: "/super-admin/users" },
    { key: "settlements", label: "Cashfree Easy Split", icon: BarChart3, to: "/super-admin/settlements" },
    { key: "create-restaurant", label: "Create Restaurant", icon: Store, to: "/super-admin/create-restaurant" },
    { key: "settings", label: "System Settings", icon: Settings, to: "/super-admin/settings" },
];

export default function SuperAdminRestaurantProfiles() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialQuery = searchParams.get("q") || searchParams.get("search") || "";

    const { logout } = useAuth();

    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState(initialQuery);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [copiedKey, setCopiedKey] = useState(null);

    const loadRestaurants = async () => {
        try {
            setLoading(true);
            setError("");
            const res = await api.get("/super-admin/restaurants");
            const data = res?.data || res;
            setRestaurants(Array.isArray(data) ? data : (data?.restaurants || []));
        } catch (err) {
            console.error("[SuperAdminRestaurantProfiles] Load error:", err);
            setError(err.response?.data?.message || "Failed to load restaurant profiles");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRestaurants();
    }, []);

    const toggleStatus = async (restaurant) => {
        try {
            await api.patch(`/super-admin/restaurants/${restaurant.id}`, { isActive: !restaurant.isActive });
            loadRestaurants();
        } catch (err) {
            setError("Failed to update status");
        }
    };

    const handleCopy = (text, key) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
    };

    const filtered = restaurants.filter((r) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return (
            r.name?.toLowerCase().includes(s) ||
            r.slug?.toLowerCase().includes(s) ||
            r.ownerName?.toLowerCase().includes(s) ||
            r.email?.toLowerCase().includes(s) ||
            r.phone?.includes(s) ||
            r.city?.toLowerCase().includes(s) ||
            r.upiId?.toLowerCase().includes(s)
        );
    });

    return (
        <div className="theme-page min-h-screen">
            {/* Sidebar */}
            <div className={`fixed inset-0 z-50 transition ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
                <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className={`absolute inset-0 bg-black/45 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
                />
                <aside className={`theme-panel theme-border absolute left-0 top-0 h-full w-72 max-w-[84vw] border-r p-5 shadow-2xl transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <img src={tiffzyLogo} alt="Tiffzy" className="h-8 w-8 object-contain" />
                            <h2 className="text-xl font-bold text-white">Tiffzy Admin</h2>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="theme-soft-button p-2 rounded-xl text-white"><X size={18} /></button>
                    </div>
                    <nav className="grid gap-2">
                        {SUPER_ADMIN_MENU_ITEMS.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => { navigate(item.to); setSidebarOpen(false); }}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${item.key === "restaurant-profile" ? "theme-button" : "theme-soft-button"}`}
                            >
                                <item.icon size={18} /> {item.label}
                            </button>
                        ))}
                    </nav>
                </aside>
            </div>

            {/* Header */}
            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(true)} className="theme-soft-button p-2.5 rounded-xl"><Menu size={20} /></button>
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-widest font-bold">Super Admin</p>
                            <h1 className="text-2xl font-bold text-white">Restaurant Profiles & Directory</h1>
                        </div>
                    </div>
                    <button onClick={logout} className="rounded-full bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20">
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
                {error && <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-300 text-sm">{error}</div>}

                {/* Controls Bar */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by restaurant name, mail, phone, city, or UPI..."
                            className="theme-input rounded-2xl pl-11 pr-4 py-3 text-sm w-full outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                    <button onClick={() => navigate("/super-admin/create-restaurant")} className="theme-button flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-lg">
                        <Store size={18} /> Add New Restaurant
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-16 text-gray-400">Loading restaurant profile details...</div>
                ) : filtered.length === 0 ? (
                    <div className="theme-panel rounded-3xl p-12 text-center text-gray-400 border theme-border">
                        <Utensils className="mx-auto mb-4 text-gray-600" size={48} />
                        <h3 className="text-lg font-bold text-white mb-1">No Restaurants Found</h3>
                        <p className="text-sm text-gray-400">No restaurant matches your search criteria.</p>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {filtered.map((restaurant) => {
                            const ownerEmail = restaurant.owner?.email || restaurant.email || "Not set";
                            const ownerPhone = restaurant.owner?.phone || restaurant.phone || "Not set";
                            const upi = restaurant.upiId || `${restaurant.slug}@upi`;

                            return (
                                <div key={restaurant.id} className="theme-panel rounded-3xl border theme-border p-6 shadow-xl relative flex flex-col justify-between">
                                    <div>
                                        {/* Card Header */}
                                        <div className="flex items-start justify-between gap-4 pb-4 border-b theme-border">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-800 border theme-border flex items-center justify-center shrink-0">
                                                    {restaurant.logoUrl ? (
                                                        <img src={resolveImageUrl(restaurant.logoUrl)} alt={restaurant.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Store size={28} className="text-gray-500" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-xl font-black text-white">{restaurant.name}</h3>
                                                        <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${restaurant.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                                            {restaurant.isActive ? "ACTIVE" : "DISABLED"}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-orange-400 font-mono mt-0.5">/{restaurant.slug}</p>
                                                    {restaurant.legalName && <p className="text-xs text-gray-400">Legal: {restaurant.legalName}</p>}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => toggleStatus(restaurant)}
                                                className={`p-2.5 rounded-xl border transition-all ${restaurant.isActive ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-green-500/30 text-green-400 hover:bg-green-500/10"}`}
                                                title={restaurant.isActive ? "Disable Restaurant" : "Activate Restaurant"}
                                            >
                                                <Power size={18} />
                                            </button>
                                        </div>

                                        {/* Details Grid */}
                                        <div className="grid gap-4 py-4 sm:grid-cols-2 text-sm">
                                            {/* Mail & Contact */}
                                            <div className="theme-card rounded-2xl p-4 border theme-border space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                                                    <Mail size={14} /> Owner Contact Info
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-400 block">Owner Name:</span>
                                                    <span className="font-bold text-white">{restaurant.owner?.name || restaurant.ownerName || "Not set"}</span>
                                                </div>
                                                <div className="flex items-center justify-between group">
                                                    <div>
                                                        <span className="text-xs text-gray-400 block">Email (Mail):</span>
                                                        <span className="font-semibold text-gray-200 text-xs break-all">{ownerEmail}</span>
                                                    </div>
                                                    <button onClick={() => handleCopy(ownerEmail, `email-${restaurant.id}`)} className="text-gray-400 hover:text-white p-1">
                                                        {copiedKey === `email-${restaurant.id}` ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-xs text-gray-400 block">Phone (Number):</span>
                                                        <span className="font-semibold text-gray-200 text-xs">{ownerPhone}</span>
                                                    </div>
                                                    <button onClick={() => handleCopy(ownerPhone, `phone-${restaurant.id}`)} className="text-gray-400 hover:text-white p-1">
                                                        {copiedKey === `phone-${restaurant.id}` ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* UPI & Bank Details */}
                                            <div className="theme-card rounded-2xl p-4 border theme-border space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                                    <CreditCard size={14} /> Payment & UPI Details
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-xs text-gray-400 block">UPI ID:</span>
                                                        <span className="font-mono text-emerald-300 font-bold text-xs">{upi}</span>
                                                    </div>
                                                    <button onClick={() => handleCopy(upi, `upi-${restaurant.id}`)} className="text-gray-400 hover:text-white p-1">
                                                        {copiedKey === `upi-${restaurant.id}` ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-400 block">Bank Account:</span>
                                                    <span className="font-semibold text-gray-200 text-xs">{restaurant.bankAccountNumber}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-400 block">IFSC Code:</span>
                                                    <span className="font-mono text-gray-300 text-xs">{restaurant.bankIfscCode}</span>
                                                </div>
                                            </div>

                                            {/* Address & Location */}
                                            <div className="theme-card rounded-2xl p-4 border theme-border space-y-1.5 sm:col-span-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                                                    <MapPin size={14} /> Location & Business Details
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-gray-400">City / State:</span> <span className="text-white font-semibold">{restaurant.city || "N/A"}, {restaurant.state || "N/A"}</span></div>
                                                    <div><span className="text-gray-400">GST Number:</span> <span className="text-white font-mono">{restaurant.gstNumber}</span></div>
                                                    <div><span className="text-gray-400">Pincode:</span> <span className="text-white font-mono">{restaurant.pincode || "N/A"}</span></div>
                                                    <div><span className="text-gray-400">Tax & Prefix:</span> <span className="text-white font-semibold">{restaurant.invoicePrefix} ({restaurant.defaultTaxPercent}%)</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-4 border-t theme-border flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 text-xs text-gray-400">
                                            <span>Orders: <strong className="text-white">{restaurant.counts?.orders || 0}</strong></span>
                                            <span>Menu: <strong className="text-white">{restaurant.counts?.menuItems || 0}</strong></span>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/r/${restaurant.slug}/menu`)}
                                            className="theme-button flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold shadow-md hover:scale-105 transition-transform"
                                        >
                                            <ExternalLink size={14} /> Open Restaurant Page
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
