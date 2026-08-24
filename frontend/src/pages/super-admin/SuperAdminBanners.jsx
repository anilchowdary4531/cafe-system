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
    ExternalLink,
    Utensils
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";

const SUPER_ADMIN_MENU_ITEMS = [
    { key: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, to: "/super-admin" },
    { key: "restaurants", label: "Restaurant Management", icon: Building2, to: "/super-admin#restaurants-section" },
    { key: "restaurant-profile", label: "Restaurant Profile Page", icon: Utensils, to: "/r/beanhouse/menu" },
    { key: "categories", label: "Home Categories", icon: Menu, to: "/super-admin/categories" },
    { key: "banners", label: "Promotion Banners", icon: ImageIcon, to: "/super-admin/banners" },
    { key: "users", label: "Customer & Staff Users", icon: Users, to: "/super-admin/users" },
    { key: "settlements", label: "Cashfree Easy Split", icon: BarChart3, to: "/super-admin/settlements" },
    { key: "create-restaurant", label: "Create Restaurant", icon: Store, to: "/super-admin/create-restaurant" },
    { key: "settings", label: "System Settings", icon: Settings, to: "/super-admin/settings" },
];

export default function SuperAdminBanners() {
    const navigate = useNavigate();
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ title: "", imageUrl: "", actionUrl: "", priority: 0 });

    const loadBanners = async () => {
        try {
            setLoading(true);
            setError("");
            const res = await api.get("/super-admin/banners");
            const data = res?.data || res;
            const bannersList = Array.isArray(data) ? data : (data?.banners || []);
            setBanners(bannersList);
        } catch (err) {
            console.error("[SuperAdminBanners] Load error:", err);
            setError(err.response?.data?.message || err.message || "Failed to load banners");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBanners();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/super-admin/banners", formData);
            setShowForm(false);
            setFormData({ title: "", imageUrl: "", actionUrl: "", priority: 0 });
            loadBanners();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create banner");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this banner?")) return;
        try {
            await api.delete(`/super-admin/banners/${id}`);
            loadBanners();
        } catch (err) {
            setError("Failed to delete banner");
        }
    };

    const toggleStatus = async (banner) => {
        try {
            await api.patch(`/super-admin/banners/${banner.id}`, { isActive: !banner.isActive });
            loadBanners();
        } catch (err) {
            setError("Failed to update status");
        }
    };

    return (
        <div className="theme-page min-h-screen">
            <div className={`fixed inset-0 z-50 transition ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
                <button onClick={() => setSidebarOpen(false)} className={`absolute inset-0 bg-black/45 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0"}`} />
                <aside className={`theme-panel theme-border absolute left-0 top-0 h-full w-72 max-w-[84vw] border-r p-5 shadow-2xl transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold text-white">Tiffzy Admin</h2>
                        <button onClick={() => setSidebarOpen(false)} className="theme-soft-button p-2 rounded-xl text-white"><X size={18} /></button>
                    </div>
                    <nav className="grid gap-2">
                        {SUPER_ADMIN_MENU_ITEMS.map((item) => (
                            <button key={item.key} onClick={() => { navigate(item.to); setSidebarOpen(false); }} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold transition ${item.key === "banners" ? "theme-button" : "theme-soft-button"}`}>
                                <item.icon size={18} /> {item.label}
                            </button>
                        ))}
                    </nav>
                </aside>
            </div>

            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(true)} className="theme-soft-button p-2 rounded-full"><Menu size={20} /></button>
                        <h1 className="text-2xl font-bold">App Banners</h1>
                    </div>
                    <button onClick={() => setShowForm(true)} className="theme-button flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
                        <Plus size={18} /> Add Banner
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
                {error && <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-300 text-sm">{error}</div>}

                {showForm && (
                    <div className="theme-panel mb-8 rounded-3xl p-6 border theme-border">
                        <div className="flex justify-between items-center mb-6 text-white font-bold">
                            <h3>Configure Promotion Banner</h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
                            <div className="grid gap-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Banner Title</label>
                                <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="theme-input rounded-xl px-4 py-3 text-sm outline-none" placeholder="e.g. 50% Off Today" />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Image URL</label>
                                <input required value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="theme-input rounded-xl px-4 py-3 text-sm outline-none" placeholder="Direct link to image" />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Action Link (Click URL)</label>
                                <input value={formData.actionUrl} onChange={e => setFormData({...formData, actionUrl: e.target.value})} className="theme-input rounded-xl px-4 py-3 text-sm outline-none" placeholder="/restaurant/slug or https://..." />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Priority</label>
                                <div className="flex gap-3">
                                    <input type="number" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="theme-input rounded-xl px-4 py-3 text-sm outline-none w-full" />
                                    <button type="submit" className="theme-button rounded-xl px-8 font-bold">PUBLISH</button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading banners...</div>
                ) : banners.length === 0 ? (
                    <div className="theme-panel rounded-3xl p-12 text-center text-gray-400 border theme-border">
                        <ImageIcon className="mx-auto mb-4 text-gray-600" size={48} />
                        <h3 className="text-lg font-bold text-white mb-1">No Promotion Banners Yet</h3>
                        <p className="text-sm text-gray-400 mb-6">Create promotional banners to highlight deals on the mobile app home screen.</p>
                        <button onClick={() => setShowForm(true)} className="theme-button inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold">
                            <Plus size={18} /> Add First Banner
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        {banners.map((banner) => (
                            <div key={banner.id} className="theme-panel rounded-3xl overflow-hidden border theme-border flex flex-col group transition-all hover:border-orange-500/50">
                                <div className="aspect-[21/9] bg-gray-900 relative overflow-hidden">
                                    <img src={banner.imageUrl} className="w-full h-full object-cover" alt={banner.title} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                                    <div className="absolute bottom-4 left-4 text-white font-bold text-xl drop-shadow-md">{banner.title}</div>
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button onClick={() => toggleStatus(banner)} className={`p-2.5 rounded-full shadow-xl transition-transform active:scale-95 ${banner.isActive ? "bg-green-500 text-white" : "bg-gray-800 text-gray-400"}`}>
                                            <Power size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(banner.id)} className="p-2.5 rounded-full bg-red-500 text-white shadow-xl active:scale-95 transition-transform">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-5 flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Priority {banner.priority}</span>
                                        <div className="flex items-center gap-2 text-gray-400 text-xs truncate max-w-[200px]">
                                            <ExternalLink size={12} /> {banner.actionUrl || "No Link"}
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black ${banner.isActive ? "bg-green-500/10 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                                        {banner.isActive ? "LIVE" : "DRAFT"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function Power({ size, className }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>;
}
