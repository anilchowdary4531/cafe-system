import { useEffect, useState } from "react";
import {
    Truck,
    Package,
    CheckCircle2,
    XCircle,
    ShieldAlert,
    RefreshCw,
    DollarSign,
    Layers,
    Users,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

export default function SuperAdminSupplyChain() {
    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState("suppliers");

    const loadData = async () => {
        setLoading(true);
        try {
            const [dashRes, suppRes, prodRes, ordRes] = await Promise.all([
                api.get("/super-admin/supply/dashboard").catch(() => null),
                api.get("/super-admin/supply/suppliers").catch(() => null),
                api.get("/super-admin/supply/products").catch(() => null),
                api.get("/super-admin/supply/orders").catch(() => null),
            ]);

            if (dashRes?.data) setDashboard(dashRes.data);
            if (suppRes?.data?.suppliers) setSuppliers(suppRes.data.suppliers);
            if (prodRes?.data?.products) setProducts(prodRes.data.products);
            if (ordRes?.data?.orders) setOrders(ordRes.data.orders);
        } catch (err) {
            showToast("Failed to load Super Admin supply data", { type: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleUpdateSupplierStatus = async (supplierId, status) => {
        try {
            await api.post(`/super-admin/supply/suppliers/${supplierId}/status`, { status });
            showToast(`Supplier status updated to ${status}`);
            loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to update supplier status", { type: "error" });
        }
    };

    const handleModerateProduct = async (productId, status) => {
        try {
            await api.post(`/super-admin/supply/products/${productId}/status`, { status });
            showToast(`Product status updated to ${status}`);
            loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to update product status", { type: "error" });
        }
    };

    const handleProcessSettlement = async (supplierId) => {
        try {
            await api.post(`/super-admin/supply/settlements`, { supplierId, commissionPercent: 5.0 });
            showToast("Supplier payout settlement processed successfully!");
            loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to process settlement", { type: "error" });
        }
    };

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-white/10 pb-5">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Truck className="text-amber-500" />
                        Super Admin — Supply Chain Management
                    </h2>
                    <p className="theme-muted text-xs">Supplier KYC compliance, product catalog moderation, B2B orders & settlements</p>
                </div>

                <button
                    onClick={loadData}
                    className="theme-soft-button rounded-full px-4 py-2 text-xs font-bold flex items-center gap-2"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    Refresh Stats
                </button>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[var(--app-surface)] p-5 space-y-1">
                    <p className="text-xs font-bold text-amber-200/70 uppercase">Total Suppliers</p>
                    <p className="text-2xl font-bold text-white">{dashboard?.suppliers?.total || 0}</p>
                    <p className="text-[11px] text-green-400 font-semibold">{dashboard?.suppliers?.active || 0} Active / {dashboard?.suppliers?.pending || 0} Pending</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[var(--app-surface)] p-5 space-y-1">
                    <p className="text-xs font-bold text-amber-200/70 uppercase">Total Products</p>
                    <p className="text-2xl font-bold text-white">{dashboard?.products?.total || 0}</p>
                    <p className="text-[11px] text-amber-300 font-semibold">{dashboard?.products?.active || 0} Approved Active</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[var(--app-surface)] p-5 space-y-1">
                    <p className="text-xs font-bold text-amber-200/70 uppercase">Supply Orders</p>
                    <p className="text-2xl font-bold text-white">{dashboard?.orders?.total || 0}</p>
                    <p className="text-[11px] text-blue-400 font-semibold">{dashboard?.orders?.completed || 0} Completed</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[var(--app-surface)] p-5 space-y-1">
                    <p className="text-xs font-bold text-amber-200/70 uppercase">Total B2B Supply Volume</p>
                    <p className="text-2xl font-bold text-amber-400">₹{dashboard?.sales?.totalSales?.toLocaleString() || 0}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab("suppliers")}
                    className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                        activeTab === "suppliers" ? "bg-amber-500 text-black" : "theme-soft-button"
                    }`}
                >
                    Suppliers ({suppliers.length})
                </button>
                <button
                    onClick={() => setActiveTab("products")}
                    className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                        activeTab === "products" ? "bg-amber-500 text-black" : "theme-soft-button"
                    }`}
                >
                    Catalog Products ({products.length})
                </button>
                <button
                    onClick={() => setActiveTab("orders")}
                    className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                        activeTab === "orders" ? "bg-amber-500 text-black" : "theme-soft-button"
                    }`}
                >
                    B2B Order Registry ({orders.length})
                </button>
            </div>

            {/* Content: Suppliers */}
            {activeTab === "suppliers" && (
                <div className="space-y-3">
                    {suppliers.map((s) => (
                        <div key={s.id} className="rounded-2xl border border-white/10 bg-[var(--app-surface)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-white text-base">{s.profile?.businessName || s.email}</h3>
                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                        s.status === "ACTIVE" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
                                    }`}>
                                        {s.status}
                                    </span>
                                </div>
                                <p className="theme-muted text-xs">Email: {s.email} • Phone: {s.phone}</p>
                                <p className="theme-muted text-xs">Products: {s._count?.products || 0} • Orders: {s._count?.orders || 0}</p>
                            </div>

                            <div className="flex items-center gap-2">
                                {s.status !== "ACTIVE" && (
                                    <button
                                        onClick={() => handleUpdateSupplierStatus(s.id, "APPROVED")}
                                        className="rounded-xl bg-green-500 text-black font-bold px-3 py-1.5 text-xs hover:bg-green-400 transition"
                                    >
                                        Approve Supplier
                                    </button>
                                )}
                                {s.status === "ACTIVE" && (
                                    <button
                                        onClick={() => handleUpdateSupplierStatus(s.id, "SUSPENDED")}
                                        className="rounded-xl bg-amber-500/20 text-amber-300 font-bold px-3 py-1.5 text-xs hover:bg-amber-500/30 transition"
                                    >
                                        Suspend
                                    </button>
                                )}
                                <button
                                    onClick={() => handleProcessSettlement(s.id)}
                                    className="rounded-xl border border-amber-500/40 text-amber-400 font-bold px-3 py-1.5 text-xs hover:bg-amber-500/10 transition"
                                >
                                    Process Settlement
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Content: Products */}
            {activeTab === "products" && (
                <div className="space-y-3">
                    {products.map((p) => (
                        <div key={p.id} className="rounded-2xl border border-white/10 bg-[var(--app-surface)] p-4 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-white text-sm">{p.name}</h3>
                                <p className="theme-muted text-xs">Supplier: {p.supplier?.profile?.businessName || "ABC Foods"} • Stock: {p.inventory?.availableStock || 0} {p.unit}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {p.status !== "APPROVED" ? (
                                    <button
                                        onClick={() => handleModerateProduct(p.id, "APPROVED")}
                                        className="rounded-xl bg-green-500 text-black font-bold px-3 py-1 text-xs"
                                    >
                                        Approve Listing
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleModerateProduct(p.id, "DISABLED")}
                                        className="rounded-xl bg-red-500/20 text-red-300 font-bold px-3 py-1 text-xs"
                                    >
                                        Disable Listing
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
