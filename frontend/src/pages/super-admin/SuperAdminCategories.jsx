import { useEffect, useState } from "react";
import {
    BarChart3,
    LayoutDashboard,
    Building2,
    Users,
    Store,
    Settings,
    Menu,
    X,
    Plus,
    Trash2,
    Save,
    Image as ImageIcon,
    Utensils,
    Power,
    Wallet,
    Sparkles,
    Scale,
    Layers,
    Search,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import tiffzyLogo from "../../assets/tiffzy-logo.png";

import SuperAdminSidebar from "../../components/super-admin/SuperAdminSidebar";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { getCategoryFallbackImage } from "../../components/PopularCategories";

export default function SuperAdminCategories() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // New Category Form
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: "", imageUrl: "", priority: 0 });

    const [syncing, setSyncing] = useState(false);
    const [seedingTobacco, setSeedingTobacco] = useState(false);
    const [tobaccoMessage, setTobaccoMessage] = useState("");

    const loadCategories = async () => {
        try {
            setLoading(true);
            setError("");
            const res = await api.get("/super-admin/categories");
            const data = res?.data || res;
            const categoriesList = Array.isArray(data) ? data : (data?.categories || []);
            setCategories(categoriesList);
        } catch (err) {
            console.error("[SuperAdminCategories] Load error:", err);
            setError(err.response?.data?.message || err.message || "Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            setError("");
            await api.post("/super-admin/categories/sync");
            await loadCategories();
        } catch (err) {
            console.error("[SuperAdminCategories] Sync error:", err);
            setError(err.response?.data?.message || "Failed to sync categories from menu items");
        } finally {
            setSyncing(false);
        }
    };

    const handlePlaceTobaccoCatalog = async () => {
        try {
            setSeedingTobacco(true);
            setError("");
            setTobaccoMessage("");
            const res = await api.post("/super-admin/categories/place-tobacco");
            const data = res?.data || res;
            setTobaccoMessage(data?.message || "Cigarettes catalog placed successfully!");
            await loadCategories();
        } catch (err) {
            console.error("[SuperAdminCategories] Place tobacco error:", err);
            setError(err.response?.data?.message || "Failed to place cigarettes catalog");
        } finally {
            setSeedingTobacco(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/super-admin/categories", formData);
            setShowForm(false);
            setFormData({ name: "", imageUrl: "", priority: 0 });
            loadCategories();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create category");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this category?")) return;
        try {
            setError("");
            setCategories((prev) => prev.filter((c) => c.id !== id));
            await api.delete(`/super-admin/categories/${id}`);
        } catch (err) {
            console.warn("[SuperAdminCategories] Delete warning:", err);
            loadCategories();
        }
    };

    const toggleStatus = async (category) => {
        try {
            setError("");
            setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, isActive: !c.isActive } : c)));
            await api.patch(`/super-admin/categories/${category.id}`, { isActive: !category.isActive });
        } catch (err) {
            console.warn("[SuperAdminCategories] Toggle status warning:", err);
            loadCategories();
        }
    };

    // Active Tab & Search
    const [activeTab, setActiveTab] = useState("categories"); // "categories" | "units"
    const [searchQuery, setSearchQuery] = useState("");
    const [unitTypeFilter, setUnitTypeFilter] = useState("All");

    // Standard Inventory Measurement Units State
    const [units, setUnits] = useState([
        { id: "u1", symbol: "kg", name: "Kilograms", type: "Weight", baseUnit: "g", multiplier: 1000, description: "Standard weight unit for bulk produce & meat", isSystem: true },
        { id: "u2", symbol: "g", name: "Grams", type: "Weight", baseUnit: "g", multiplier: 1, description: "Base weight unit for spices & fine ingredients", isSystem: true },
        { id: "u3", symbol: "mg", name: "Milligrams", type: "Weight", baseUnit: "g", multiplier: 0.001, description: "Micro weight unit for saffron & rare seasonings", isSystem: true },
        { id: "u4", symbol: "L", name: "Liters", type: "Volume", baseUnit: "ml", multiplier: 1000, description: "Standard liquid volume unit for milk, oil & syrup", isSystem: true },
        { id: "u5", symbol: "ml", name: "Milliliters", type: "Volume", baseUnit: "ml", multiplier: 1, description: "Base liquid volume unit for beverages & extracts", isSystem: true },
        { id: "u6", symbol: "pcs", name: "Pieces", type: "Count", baseUnit: "pcs", multiplier: 1, description: "Discrete item count for buns, eggs & fruits", isSystem: true },
        { id: "u7", symbol: "dozen", name: "Dozen", type: "Count", baseUnit: "pcs", multiplier: 12, description: "Pack of 12 pieces for eggs & bakery items", isSystem: true },
        { id: "u8", symbol: "pack", name: "Pack", type: "Container", baseUnit: "pcs", multiplier: 1, description: "Pre-packaged supplier bundle", isSystem: false },
        { id: "u9", symbol: "box", name: "Box", type: "Container", baseUnit: "pcs", multiplier: 1, description: "Shipping carton or storage crate", isSystem: false },
        { id: "u10", symbol: "bottle", name: "Bottle", type: "Container", baseUnit: "ml", multiplier: 750, description: "Standard sauce or beverage bottle", isSystem: false },
        { id: "u11", symbol: "can", name: "Can / Tin", type: "Container", baseUnit: "ml", multiplier: 330, description: "Canned goods & beverages", isSystem: false },
    ]);

    const [showUnitForm, setShowUnitForm] = useState(false);
    const [unitFormData, setUnitFormData] = useState({ symbol: "", name: "", type: "Weight", baseUnit: "g", multiplier: 1, description: "" });

    const handleAddUnit = (e) => {
        e.preventDefault();
        if (!unitFormData.symbol || !unitFormData.name) return;
        const newUnit = {
            id: `u_${Date.now()}`,
            symbol: unitFormData.symbol.trim(),
            name: unitFormData.name.trim(),
            type: unitFormData.type,
            baseUnit: unitFormData.baseUnit,
            multiplier: Number(unitFormData.multiplier || 1),
            description: unitFormData.description.trim() || "Custom kitchen unit",
            isSystem: false
        };
        setUnits(prev => [newUnit, ...prev]);
        setShowUnitForm(false);
        setUnitFormData({ symbol: "", name: "", type: "Weight", baseUnit: "g", multiplier: 1, description: "" });
    };

    const handleDeleteUnit = (id) => {
        if (!window.confirm("Are you sure you want to delete this measurement unit?")) return;
        setUnits(prev => prev.filter(u => u.id !== id));
    };

    // Filtered Lists
    const filteredCategories = categories.filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return c.name?.toLowerCase().includes(q);
    });

    const filteredUnits = units.filter(u => {
        const matchesSearch = !searchQuery.trim() || 
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            u.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.type.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = unitTypeFilter === "All" || u.type === unitTypeFilter;
        return matchesSearch && matchesType;
    });

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
            <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} currentKey="categories" />

            {/* Header Console Bar */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-2xs">
                <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setSidebarOpen(true)} 
                                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                            >
                                <Menu size={18} />
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-black tracking-tight text-slate-900">Inventory Categories & Units</h1>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                                        {categories.length} Categories • {units.length} Units
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Manage menu dish categories, raw material classifications, and standard measurement units.</p>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                            >
                                <Sparkles size={14} className={syncing ? "animate-spin text-amber-600" : "text-amber-600"} />
                                <span>{syncing ? "Syncing..." : "Sync Menu Categories"}</span>
                            </button>

                            {activeTab === "categories" ? (
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                                >
                                    <Plus size={15} />
                                    <span>Add Category</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowUnitForm(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                                >
                                    <Plus size={15} />
                                    <span>Add Custom Unit</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Navigation Tabs & Search Controls Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl w-fit">
                            <button
                                onClick={() => setActiveTab("categories")}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    activeTab === "categories"
                                        ? "bg-white text-slate-900 shadow-2xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                <Layers size={14} className={activeTab === "categories" ? "text-orange-500" : "text-slate-400"} />
                                <span>Global Categories</span>
                                <span className="ml-1 rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-700">
                                    {categories.length}
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab("units")}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    activeTab === "units"
                                        ? "bg-white text-slate-900 shadow-2xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                <Scale size={14} className={activeTab === "units" ? "text-orange-500" : "text-slate-400"} />
                                <span>Measurement Units</span>
                                <span className="ml-1 rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-700">
                                    {units.length}
                                </span>
                            </button>
                        </div>

                        {/* Search & Type Filters */}
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={activeTab === "categories" ? "Search categories..." : "Search units..."}
                                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 w-48 sm:w-64"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            {activeTab === "units" && (
                                <select
                                    value={unitTypeFilter}
                                    onChange={(e) => setUnitTypeFilter(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                >
                                    <option value="All">All Unit Types</option>
                                    <option value="Weight">Weight (g, kg)</option>
                                    <option value="Volume">Volume (ml, L)</option>
                                    <option value="Count">Count (pcs, dozen)</option>
                                    <option value="Container">Containers & Packs</option>
                                </select>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
                {/* Alert Notification */}
                {error && (
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-500 shrink-0" />
                            <span>{error}</span>
                        </div>
                        <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Quick Action: Cigarettes & Tobacco Catalog Placement (Compact Analytics Accent Banner) */}
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 p-4 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider border border-amber-200">
                                <span>🚬 Tobacco Catalog Seeding</span>
                            </div>
                            <h2 className="text-sm font-bold text-slate-900">
                                Place Platform-Wide Cigarettes & Tobacco Catalog
                            </h2>
                            <p className="text-xs text-slate-600">
                                One-click publish global Cigarettes category and automatically seed standard tobacco items into all active restaurant menus.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handlePlaceTobaccoCatalog}
                            disabled={seedingTobacco}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Sparkles size={14} className={seedingTobacco ? "animate-spin" : ""} />
                            <span>{seedingTobacco ? "Placing Catalog..." : "Place Cigarettes Catalog"}</span>
                        </button>
                    </div>

                    {tobaccoMessage && (
                        <div className="mt-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            <span>{tobaccoMessage}</span>
                        </div>
                    )}
                </div>

                {/* Add Category Form Modal / Panel */}
                {showForm && (
                    <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Create New Menu Category</h3>
                                <p className="text-xs text-slate-500">Add a global category for grouping customer menu items.</p>
                            </div>
                            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700">Category Name *</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    placeholder="e.g. Biryani, Beverages, Desserts"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700">Image URL</label>
                                <input
                                    value={formData.imageUrl}
                                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    placeholder="https://images.unsplash.com/..."
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700">Display Priority Order</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={formData.priority}
                                        onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                    <button type="submit" className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 text-xs font-bold shadow-xs shrink-0 cursor-pointer">
                                        Save Category
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Add Custom Measurement Unit Panel */}
                {showUnitForm && (
                    <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Add Custom Measurement Unit</h3>
                                <p className="text-xs text-slate-500">Define custom inventory unit of measure for recipes & raw material stock counts.</p>
                            </div>
                            <button onClick={() => setShowUnitForm(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleAddUnit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700">Unit Symbol *</label>
                                <input
                                    required
                                    value={unitFormData.symbol}
                                    onChange={e => setUnitFormData({ ...unitFormData, symbol: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    placeholder="e.g. scoop, tray, sachet"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700">Full Name *</label>
                                <input
                                    required
                                    value={unitFormData.name}
                                    onChange={e => setUnitFormData({ ...unitFormData, name: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    placeholder="e.g. Ice Cream Scoop"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700">Unit Type</label>
                                <select
                                    value={unitFormData.type}
                                    onChange={e => setUnitFormData({ ...unitFormData, type: e.target.value, baseUnit: e.target.value === "Weight" ? "g" : e.target.value === "Volume" ? "ml" : "pcs" })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                >
                                    <option value="Weight">Weight (g / kg)</option>
                                    <option value="Volume">Volume (ml / L)</option>
                                    <option value="Count">Count (pcs)</option>
                                    <option value="Container">Container / Bundle</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700">Base Unit Multiplier</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={unitFormData.multiplier}
                                        onChange={e => setUnitFormData({ ...unitFormData, multiplier: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                    <button type="submit" className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 text-xs font-bold shadow-xs shrink-0 cursor-pointer">
                                        Save Unit
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* TAB 1: CATEGORIES TABLE */}
                {activeTab === "categories" && (
                    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
                        <div className="p-4 bg-slate-50/60 border-b border-slate-200/80 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Global Item Categories Catalog</h3>
                                <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                                    {filteredCategories.length} items
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">Compact high-density inventory list</p>
                        </div>

                        {loading ? (
                            <div className="py-12 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
                                <Sparkles className="animate-spin text-orange-500" size={16} /> Loading categories...
                            </div>
                        ) : filteredCategories.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <Layers className="mx-auto mb-2 text-slate-300" size={32} />
                                <h4 className="text-sm font-bold text-slate-900">No Categories Found</h4>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                    {searchQuery ? `No categories matching "${searchQuery}"` : "Get started by adding a category or syncing from menu items."}
                                </p>
                                <div className="mt-4 flex items-center justify-center gap-2">
                                    <button onClick={handleSync} disabled={syncing} className="px-3.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs font-bold">
                                        Sync Menu Categories
                                    </button>
                                    <button onClick={() => setShowForm(true)} className="px-3.5 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold">
                                        Add Category
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="py-2.5 px-3.5 w-12">#</th>
                                            <th className="py-2.5 px-3.5">Category Name</th>
                                            <th className="py-2.5 px-3.5 text-center">Connected Dishes</th>
                                            <th className="py-2.5 px-3.5 text-center">Priority</th>
                                            <th className="py-2.5 px-3.5 text-center">Status</th>
                                            <th className="py-2.5 px-3.5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                        {filteredCategories.map((category, idx) => (
                                            <tr key={category.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-2 px-3.5 text-slate-400 font-bold">{idx + 1}</td>
                                                <td className="py-2 px-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden">
                                                            <img
                                                                src={resolveImageUrl(category.imageUrl) || getCategoryFallbackImage(category.name)}
                                                                alt={category.name}
                                                                className="h-full w-full object-cover"
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = getCategoryFallbackImage(category.name);
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-slate-900 text-[13px]">{category.name}</span>
                                                            {category.name?.toLowerCase().includes("tobacco") || category.name?.toLowerCase().includes("cigarette") ? (
                                                                <span className="ml-2 text-[10px] text-amber-700 font-bold">🚬 Seeded</span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-2 px-3.5 text-center">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                                        {category.itemCount || 0} dishes
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3.5 text-center font-bold text-slate-600">
                                                    {category.priority || 0}
                                                </td>
                                                <td className="py-2 px-3.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        category.isActive 
                                                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                                                            : "bg-slate-100 text-slate-600 border border-slate-200"
                                                    }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${category.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                                                        {category.isActive ? "Active" : "Paused"}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => toggleStatus(category)}
                                                            title={category.isActive ? "Pause Category" : "Activate Category"}
                                                            className={`p-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                                                                category.isActive 
                                                                    ? "border-slate-200 text-slate-600 hover:bg-slate-100" 
                                                                    : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                                            }`}
                                                        >
                                                            <Power size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(category.id)}
                                                            title="Delete Category"
                                                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: MEASUREMENT UNITS TABLE */}
                {activeTab === "units" && (
                    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
                        <div className="p-4 bg-slate-50/60 border-b border-slate-200/80 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Standard Measurement Units Catalog</h3>
                                <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                                    {filteredUnits.length} units
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">Base inventory units for recipe scaling & stock management</p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-2.5 px-3.5">Symbol</th>
                                        <th className="py-2.5 px-3.5">Unit Name</th>
                                        <th className="py-2.5 px-3.5">Unit Classification</th>
                                        <th className="py-2.5 px-3.5">Base Unit Ratio</th>
                                        <th className="py-2.5 px-3.5">Description</th>
                                        <th className="py-2.5 px-3.5 text-center">Type Tag</th>
                                        <th className="py-2.5 px-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                    {filteredUnits.map((unit) => (
                                        <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2 px-3.5">
                                                <span className="font-extrabold text-slate-900 bg-slate-100 border border-slate-200/80 rounded-lg px-2 py-0.5 text-[12px]">
                                                    {unit.symbol}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3.5 font-bold text-slate-900 text-[13px]">
                                                {unit.name}
                                            </td>
                                            <td className="py-2 px-3.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                    unit.type === "Weight" ? "bg-amber-50 text-amber-900 border border-amber-200" :
                                                    unit.type === "Volume" ? "bg-blue-50 text-blue-900 border border-blue-200" :
                                                    unit.type === "Count" ? "bg-emerald-50 text-emerald-900 border border-emerald-200" :
                                                    "bg-purple-50 text-purple-900 border border-purple-200"
                                                }`}>
                                                    {unit.type}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3.5 font-semibold text-slate-700">
                                                {unit.multiplier} {unit.baseUnit} = 1 {unit.symbol}
                                            </td>
                                            <td className="py-2 px-3.5 text-slate-500 text-xs max-w-xs truncate">
                                                {unit.description}
                                            </td>
                                            <td className="py-2 px-3.5 text-center">
                                                {unit.isSystem ? (
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                        Standard
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                                                        Custom
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3.5 text-right">
                                                {!unit.isSystem ? (
                                                    <button
                                                        onClick={() => handleDeleteUnit(unit.id)}
                                                        className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                        title="Delete Custom Unit"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
