import { useEffect, useState } from "react";
import {
    BarChart3,
    Building2,
    LayoutDashboard,
    Loader2,
    Menu,
    Plus,
    Settings,
    Store,
    Users,
    X,
    Image as ImageIcon,
    Utensils,
    Wallet
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import tiffzyLogo from "../../assets/tiffzy-logo.png";

const initialForm = {
    name: "",
    slug: "",
    legalName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    ownerPassword: "",
    restaurantEmail: "",
    restaurantPhone: "",
    city: "",
    state: "",
    pincode: "",
    gstNumber: "",
    invoicePrefix: "",
    defaultTaxPercent: 5,
};

const slugify = (value) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const SUPER_ADMIN_MENU_ITEMS = [
    { key: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, to: "/super-admin" },
    { key: "restaurants", label: "Restaurant Management", icon: Building2, to: "/super-admin#restaurants-section" },
    { key: "restaurant-profile", label: "Restaurant Profile Page", icon: Utensils, to: "/super-admin/restaurant-profiles" },
    { key: "wallets", label: "Customer Wallet Ledger", icon: Wallet, to: "/super-admin/wallets" },
    { key: "categories", label: "Home Categories", icon: Menu, to: "/super-admin/categories" },
    { key: "banners", label: "Promotion Banners", icon: ImageIcon, to: "/super-admin/banners" },
    { key: "users", label: "All Users & Staff", icon: Users, to: "/super-admin/users" },
    { key: "settlements", label: "Cashfree Easy Split", icon: BarChart3, to: "/super-admin/settlements" },
    { key: "create-restaurant", label: "Create Restaurant", icon: Store, to: "/super-admin/create-restaurant" },
    { key: "settings", label: "System Settings", icon: Settings, to: "/super-admin/settings" },
];

const HASH_TO_MENU_KEY = {
    "restaurants-section": "restaurants",
};

export default function SuperAdminCreateRestaurant() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeMenuKey, setActiveMenuKey] = useState("create-restaurant");

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

    useEffect(() => {
        if (location.pathname === "/super-admin/create-restaurant") {
            setActiveMenuKey("create-restaurant");
            return;
        }

        const hashId = location.hash.replace("#", "");
        setActiveMenuKey(HASH_TO_MENU_KEY[hashId] || "dashboard");
    }, [location.pathname, location.hash]);

    const updateForm = (key, value) => {
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            if (key === "name" && !prev.slug) {
                next.slug = slugify(value);
            }
            if (key === "ownerEmail" && !prev.restaurantEmail) {
                next.restaurantEmail = value;
            }
            if (key === "ownerPhone" && !prev.restaurantPhone) {
                next.restaurantPhone = value;
            }
            return next;
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            await api.post("/super-admin/restaurants", form);

            setSuccess("Restaurant and owner created successfully.");
            setForm(initialForm);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create restaurant");
        } finally {
            setSaving(false);
        }
    };

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
                            <h1 className="text-2xl font-bold">Create Restaurant</h1>
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

                {success && (
                    <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                        {success}
                    </div>
                )}

                <section className="theme-panel mx-auto max-w-3xl rounded-3xl p-5">
                    <div className="flex items-center gap-2">
                        <Store className="theme-accent-text" size={20} />
                        <h2 className="text-xl font-bold">Create Restaurant</h2>
                    </div>
                    <p className="theme-muted mt-2 text-sm">
                        This creates the restaurant, owner login, and full owner access.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
                        <Input label="Restaurant Name" value={form.name} onChange={(value) => updateForm("name", value)} required />
                        <Input label="Slug" value={form.slug} onChange={(value) => updateForm("slug", slugify(value))} required />
                        <Input label="Legal Name" value={form.legalName} onChange={(value) => updateForm("legalName", value)} />
                        <Input label="Owner Name" value={form.ownerName} onChange={(value) => updateForm("ownerName", value)} required />
                        <Input label="Owner Email" type="email" value={form.ownerEmail} onChange={(value) => updateForm("ownerEmail", value)} required />
                        <Input label="Owner Phone" value={form.ownerPhone} onChange={(value) => updateForm("ownerPhone", value)} />
                        <Input label="Owner Password" type="password" value={form.ownerPassword} onChange={(value) => updateForm("ownerPassword", value)} required />

                        <div className="grid gap-3 md:grid-cols-2">
                            <Input label="City" value={form.city} onChange={(value) => updateForm("city", value)} />
                            <Input label="State" value={form.state} onChange={(value) => updateForm("state", value)} />
                            <Input label="Pincode" value={form.pincode} onChange={(value) => updateForm("pincode", value)} />
                            <Input label="GST Number" value={form.gstNumber} onChange={(value) => updateForm("gstNumber", value)} />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <Input label="Invoice Prefix" value={form.invoicePrefix} onChange={(value) => updateForm("invoicePrefix", value)} />
                            <Input label="Tax %" type="number" value={form.defaultTaxPercent} onChange={(value) => updateForm("defaultTaxPercent", value)} />
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="theme-button mt-2 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            Create Restaurant & Owner
                        </button>
                    </form>
                </section>
            </main>
        </div>
    );
}

function Input({ label, value, onChange, type = "text", required = false }) {
    return (
        <label className="grid gap-1.5">
            <span className="theme-muted text-sm">{label}{required ? " *" : ""}</span>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                required={required}
                className="theme-input rounded-xl px-3 py-2.5 outline-none"
            />
        </label>
    );
}
