import { useEffect, useState } from "react";
import {
    BarChart3,
    Building2,
    CheckCircle2,
    IndianRupee,
    Loader2,
    Plus,
    Power,
    Search,
    ShieldCheck,
    Store,
    UserRound,
    Users,
} from "lucide-react";
import ThemeSelector from "../../components/ThemeSelector";
import { useAuth } from "../../context/AuthContext";
import { api, cachedGet, invalidateGetCache } from "../../utils/apiClient";

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

const formatMoney = (value) =>
    `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

export default function SuperAdminDashboard() {
    const { user, logout } = useAuth();
    const [restaurants, setRestaurants] = useState([]);
    const [summary, setSummary] = useState(null);
    const [form, setForm] = useState(initialForm);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadRestaurants = async (search = query) => {
        try {
            setLoading(true);
            const data = await cachedGet("/super-admin/restaurants", {
                params: search ? { q: search } : {},
                ttlMs: 10_000,
                staleMs: 60_000,
                scope: "auth",
            });
            setRestaurants(data?.restaurants || []);
            setSummary(data?.summary || null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load restaurants");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRestaurants("");
    }, []);

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
            invalidateGetCache({ urlStartsWith: "/super-admin/restaurants" });
            await loadRestaurants("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create restaurant");
        } finally {
            setSaving(false);
        }
    };

    const toggleRestaurant = async (restaurant) => {
        try {
            setError("");
            await api.patch(`/super-admin/restaurants/${restaurant.id}/status`, { isActive: !restaurant.isActive });
            invalidateGetCache({ urlStartsWith: "/super-admin/restaurants" });
            await loadRestaurants(query);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update restaurant status");
        }
    };

    return (
        <div className="theme-page min-h-screen">
            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="theme-button flex h-12 w-12 items-center justify-center rounded-2xl">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.28em]">Super Admin</p>
                            <h1 className="text-2xl font-bold">Application Control Center</h1>
                            <p className="theme-muted text-sm">{user?.email || "admin@tiffzy.com"}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <ThemeSelector />
                        <button
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

                <section className="grid gap-4 md:grid-cols-4">
                    <StatCard icon={<Building2 size={19} />} label="Restaurants" value={summary?.restaurants || 0} />
                    <StatCard icon={<CheckCircle2 size={19} />} label="Active" value={summary?.activeRestaurants || 0} />
                    <StatCard icon={<Users size={19} />} label="Owners" value={summary?.owners || 0} />
                    <StatCard icon={<IndianRupee size={19} />} label="Revenue" value={formatMoney(summary?.revenue || 0)} />
                </section>

                <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
                    <section className="theme-panel rounded-3xl p-5">
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

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                                <Input label="City" value={form.city} onChange={(value) => updateForm("city", value)} />
                                <Input label="State" value={form.state} onChange={(value) => updateForm("state", value)} />
                                <Input label="Pincode" value={form.pincode} onChange={(value) => updateForm("pincode", value)} />
                                <Input label="GST Number" value={form.gstNumber} onChange={(value) => updateForm("gstNumber", value)} />
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
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

                    <section className="theme-panel rounded-3xl p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="theme-accent-text" size={20} />
                                    <h2 className="text-xl font-bold">Restaurants Under Super Admin</h2>
                                </div>
                                <p className="theme-muted mt-2 text-sm">Application-wide restaurant list with owner login details.</p>
                            </div>

                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    loadRestaurants(query);
                                }}
                                className="theme-input flex items-center gap-2 rounded-2xl px-3 py-2 md:w-80"
                            >
                                <Search size={16} className="theme-muted" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search restaurants"
                                    className="w-full bg-transparent text-sm outline-none"
                                />
                            </form>
                        </div>

                        {loading ? (
                            <div className="theme-empty mt-5 rounded-2xl p-8 text-center">
                                Loading restaurants...
                            </div>
                        ) : restaurants.length ? (
                            <div className="mt-5 grid gap-4">
                                {restaurants.map((restaurant) => (
                                    <article key={restaurant.id} className="theme-card rounded-2xl p-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-lg font-bold">{restaurant.name}</h3>
                                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${restaurant.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                                        {restaurant.isActive ? "Active" : "Disabled"}
                                                    </span>
                                                </div>
                                                <p className="theme-muted mt-1 text-sm">/{restaurant.slug} • {restaurant.city || "City not set"}</p>
                                                <div className="theme-muted-strong mt-3 grid gap-1 text-sm md:grid-cols-2">
                                                    <span>Owner: {restaurant.owner?.name || restaurant.ownerName || "Not set"}</span>
                                                    <span>Email: {restaurant.owner?.email || restaurant.email || "Not set"}</span>
                                                    <span>Phone: {restaurant.owner?.phone || restaurant.phone || "Not set"}</span>
                                                    <span>Revenue: {formatMoney(restaurant.revenue)}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[320px]">
                                                <MiniMetric label="Users" value={restaurant.counts?.users || 0} />
                                                <MiniMetric label="Menu" value={restaurant.counts?.menuItems || 0} />
                                                <MiniMetric label="Orders" value={restaurant.counts?.orders || 0} />
                                                <MiniMetric label="Tables" value={restaurant.counts?.tables || 0} />
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 theme-border">
                                            <div className="flex items-center gap-2 text-sm">
                                                <UserRound className="theme-accent-text" size={16} />
                                                <span className="theme-muted">Owner can log in and manage this restaurant.</span>
                                            </div>
                                            <button
                                                onClick={() => toggleRestaurant(restaurant)}
                                                className="theme-soft-button inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
                                            >
                                                <Power size={15} />
                                                {restaurant.isActive ? "Disable" : "Activate"}
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="theme-empty mt-5 rounded-2xl p-8 text-center">
                                No restaurants found.
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}

function StatCard({ icon, label, value }) {
    return (
        <article className="theme-card rounded-2xl p-5">
            <div className="theme-accent-text flex items-center gap-2">
                {icon}
                <span className="text-sm font-semibold">{label}</span>
            </div>
            <p className="mt-3 text-2xl font-bold">{value}</p>
        </article>
    );
}

function MiniMetric({ label, value }) {
    return (
        <div className="theme-pill rounded-xl px-3 py-2">
            <p className="text-xs">{label}</p>
            <p className="mt-1 text-lg font-bold">{value}</p>
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
