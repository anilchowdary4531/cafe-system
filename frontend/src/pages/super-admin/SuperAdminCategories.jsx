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
    Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import tiffzyLogo from "../../assets/tiffzy-logo.png";

import SuperAdminSidebar from "../../components/super-admin/SuperAdminSidebar";

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
        const targetCat = categories.find((c) => c.id === id);
        try {
            setError("");
            setCategories((prev) => prev.filter((c) => c.id !== id));
            await api.delete(`/super-admin/categories/${id}`, { data: { name: targetCat?.name } });
            await loadCategories();
        } catch (err) {
            console.warn("[SuperAdminCategories] Delete warning:", err);
            loadCategories();
        }
    };

    const toggleStatus = async (category) => {
        try {
            setError("");
            setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, isActive: !c.isActive } : c)));
            await api.patch(`/super-admin/categories/${category.id}`, { isActive: !category.isActive, name: category.name });
            await loadCategories();
        } catch (err) {
            console.warn("[SuperAdminCategories] Toggle status warning:", err);
            loadCategories();
        }
    };

    return (
        <div className="theme-page min-h-screen">
            <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} currentKey="categories" />

            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(true)} className="theme-soft-button p-2 rounded-full"><Menu size={20} /></button>
                        <h1 className="text-2xl font-bold">Global Categories</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleSync} disabled={syncing} className="theme-soft-button flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                            <Sparkles size={16} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing..." : "Sync All Item Categories"}
                        </button>
                        <button onClick={() => setShowForm(true)} className="theme-button flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
                            <Plus size={18} /> Add Category
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
                {error && <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-300 text-sm">{error}</div>}

                {showForm && (
                    <div className="theme-panel mb-8 rounded-3xl p-6 border theme-border">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Create New Category</h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
                            <div className="grid gap-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category Name</label>
                                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="theme-input rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. Pizza" />
                            </div>
                            <div className="grid gap-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Image URL</label>
                                <input value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="theme-input rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500" placeholder="https://unsplash..." />
                            </div>
                            <div className="grid gap-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Priority</label>
                                <div className="flex gap-2">
                                    <input type="number" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="theme-input rounded-xl px-4 py-3 text-sm outline-none w-full" />
                                    <button type="submit" className="theme-button rounded-xl px-6 font-bold"><Save size={18} /></button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12 text-gray-400 flex items-center justify-center gap-2">
                        <Sparkles className="animate-spin text-amber-500" size={20} /> Loading categories...
                    </div>
                ) : categories.length === 0 ? (
                    <div className="theme-panel rounded-3xl p-12 text-center text-gray-400 border theme-border">
                        <Menu className="mx-auto mb-4 text-gray-600" size={48} />
                        <h3 className="text-lg font-bold text-white mb-1">No Global Categories Yet</h3>
                        <p className="text-sm text-gray-400 mb-6">Add curated global categories (like Pizza, Biryani, Coffee) or click below to auto-sync existing categories from restaurant menu items.</p>
                        <div className="flex items-center justify-center gap-3">
                            <button onClick={handleSync} disabled={syncing} className="theme-soft-button inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold border border-amber-500/40 text-amber-400">
                                <Sparkles size={18} className={syncing ? "animate-spin" : ""} /> Sync All Item Categories
                            </button>
                            <button onClick={() => setShowForm(true)} className="theme-button inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold">
                                <Plus size={18} /> Add Category
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {categories.map((category) => (
                            <div key={category.id} className="theme-panel rounded-3xl overflow-hidden border theme-border group transition-all hover:border-orange-500/50">
                                <div className="h-32 bg-gray-900 relative">
                                    {category.imageUrl ? (
                                        <img src={category.imageUrl} className="w-full h-full object-cover" alt={category.name} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-700"><ImageIcon size={40} /></div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <button onClick={() => toggleStatus(category)} className={`p-2 rounded-full shadow-lg ${category.isActive ? "bg-green-500 text-white" : "bg-gray-700 text-gray-400"}`}>
                                            <Power size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(category.id)} className="p-2 rounded-full bg-red-500 text-white shadow-lg">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-white uppercase tracking-tight">{category.name}</h4>
                                        <p className="text-xs text-amber-400 font-extrabold mt-0.5">
                                            {category.itemCount || 0} {category.itemCount === 1 ? "dish connected" : "dishes connected"}
                                        </p>
                                    </div>
                                    <div className={`h-2.5 w-2.5 rounded-full ${category.isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-600"}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function PowerIcon({ size, className }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>;
}
