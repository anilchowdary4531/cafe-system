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
    Building2,
    CreditCard,
    MapPin,
    Clock,
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
            showToast(`Supplier account status updated to ${status}!`);
            loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to update supplier status", { type: "error" });
        }
    };

    const handleUpdateProductStatus = async (productId, status) => {
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

    const pendingSuppliers = suppliers.filter((s) => s.status !== "ACTIVE");
    const activeSuppliers = suppliers.filter((s) => s.status === "ACTIVE");

    return (
        <section className="space-y-6">
            {/* Header - Matching Super Admin Theme */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b theme-border pb-5">
                <div>
                    <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
                        <Truck className="theme-accent-text" />
                        Super Admin — Supply Chain Management
                    </h2>
                    <p className="theme-muted text-xs mt-0.5">Supplier KYC verification approval, catalog moderation, B2B orders & settlements</p>
                </div>

                <button
                    type="button"
                    onClick={loadData}
                    className="theme-soft-button rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    Refresh Stats
                </button>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="theme-panel rounded-2xl p-5 space-y-1.5 border shadow-sm">
                    <p className="theme-muted text-xs font-bold uppercase tracking-wider">Pending KYC Verification</p>
                    <p className="text-3xl font-black theme-accent-text">{pendingSuppliers.length}</p>
                    <p className="theme-muted text-xs font-semibold">Requires Super Admin Review</p>
                </div>

                <div className="theme-panel rounded-2xl p-5 space-y-1.5 border shadow-sm">
                    <p className="theme-muted text-xs font-bold uppercase tracking-wider">Active Approved Suppliers</p>
                    <p className="text-3xl font-black text-emerald-500">{activeSuppliers.length}</p>
                    <p className="theme-muted text-xs font-semibold">{suppliers.length} Total Registered</p>
                </div>

                <div className="theme-panel rounded-2xl p-5 space-y-1.5 border shadow-sm">
                    <p className="theme-muted text-xs font-bold uppercase tracking-wider">Gross B2B GMV</p>
                    <p className="text-3xl font-black theme-accent-text">₹{(dashboard?.orders?.totalVolume || 0).toLocaleString()}</p>
                    <p className="theme-muted text-xs font-semibold">{dashboard?.orders?.totalCount || 0} Total Orders Placed</p>
                </div>

                <div className="theme-panel rounded-2xl p-5 space-y-1.5 border shadow-sm">
                    <p className="theme-muted text-xs font-bold uppercase tracking-wider">Net Platform Revenue</p>
                    <p className="text-3xl font-black text-emerald-500">₹{(dashboard?.settlements?.netRevenue || 0).toLocaleString()}</p>
                    <p className="theme-muted text-xs font-semibold">5% Platform Commission</p>
                </div>
            </div>

            {/* Tab Navigation Controls */}
            <div className="flex border-b theme-border gap-2">
                <button
                    type="button"
                    onClick={() => setActiveTab("suppliers")}
                    className={`px-5 py-2.5 text-xs font-extrabold rounded-t-xl transition cursor-pointer ${
                        activeTab === "suppliers" ? "theme-button shadow-md" : "theme-soft-button"
                    }`}
                >
                    Supplier Accounts & KYC Verification ({suppliers.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("products")}
                    className={`px-5 py-2.5 text-xs font-extrabold rounded-t-xl transition cursor-pointer ${
                        activeTab === "products" ? "theme-button shadow-md" : "theme-soft-button"
                    }`}
                >
                    Product Moderation ({products.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className={`px-5 py-2.5 text-xs font-extrabold rounded-t-xl transition cursor-pointer ${
                        activeTab === "orders" ? "theme-button shadow-md" : "theme-soft-button"
                    }`}
                >
                    Marketplace Orders ({orders.length})
                </button>
            </div>

            {/* Tab 1: Supplier Verification & KYC Review */}
            {activeTab === "suppliers" && (
                <div className="space-y-6">
                    {/* PENDING KYC VERIFICATION APPLICATIONS */}
                    {pendingSuppliers.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-extrabold theme-accent-text flex items-center gap-2">
                                <Clock size={20} />
                                Pending Supplier KYC Verification Requests ({pendingSuppliers.length})
                            </h3>

                            <div className="space-y-4">
                                {pendingSuppliers.map((s) => {
                                    const prof = s.profile || {};
                                    const addr = s.addresses?.[0] || {};
                                    return (
                                        <div key={s.id} className="theme-panel rounded-3xl p-6 space-y-4 shadow-md border">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b theme-border pb-4">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-xl font-bold">{prof.businessName || `Supplier #${s.id}`}</h4>
                                                        <span className="theme-chip rounded-full px-3 py-1 text-xs font-extrabold">
                                                            {s.status || "PENDING"}
                                                        </span>
                                                    </div>
                                                    <p className="theme-muted text-xs mt-1">Email: {s.email} • Phone: {s.phone}</p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateSupplierStatus(s.id, "ACTIVE")}
                                                        className="theme-button rounded-xl px-5 py-2.5 text-xs font-black transition cursor-pointer shadow-md flex items-center gap-1.5"
                                                    >
                                                        <CheckCircle2 size={16} />
                                                        Approve & Activate Account
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateSupplierStatus(s.id, "REJECTED")}
                                                        className="rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-4 py-2.5 text-xs transition cursor-pointer"
                                                    >
                                                        Reject KYC
                                                    </button>
                                                </div>
                                            </div>

                                            {/* SUBMITTED KYC DETAILS GRID */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                <div className="theme-card rounded-2xl p-4 border space-y-1.5">
                                                    <p className="theme-muted text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                        <Building2 size={14} /> Tax & Compliance
                                                    </p>
                                                    <p><span className="theme-muted">Legal Name:</span> <strong className="font-bold">{prof.legalName || "N/A"}</strong></p>
                                                    <p><span className="theme-muted">GSTIN:</span> <strong className="theme-accent-text font-extrabold">{prof.gstin || "N/A"}</strong></p>
                                                    <p><span className="theme-muted">FSSAI License:</span> <strong className="font-bold">{prof.fssaiLicense || "N/A"}</strong></p>
                                                </div>

                                                <div className="theme-card rounded-2xl p-4 border space-y-1.5">
                                                    <p className="theme-muted text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                        <CreditCard size={14} /> Bank Payout Account
                                                    </p>
                                                    <p><span className="theme-muted">Account No:</span> <strong className="font-bold">{prof.bankAccountNumber || "N/A"}</strong></p>
                                                    <p><span className="theme-muted">IFSC Code:</span> <strong className="font-bold">{prof.bankIfscCode || "N/A"}</strong></p>
                                                    <p><span className="theme-muted">Holder / Bank:</span> <strong className="font-bold">{prof.bankAccountName || "N/A"} ({prof.bankName || "Bank"})</strong></p>
                                                </div>

                                                <div className="theme-card rounded-2xl p-4 border space-y-1.5">
                                                    <p className="theme-muted text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                        <MapPin size={14} /> Warehouse Facility
                                                    </p>
                                                    <p><strong className="font-bold">{addr.line1 || "No address line"}</strong></p>
                                                    <p className="theme-muted">{addr.city || "City"}, {addr.state || "State"} - {addr.pincode || "Pincode"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ACTIVE SUPPLIERS */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold">Active Approved Suppliers ({activeSuppliers.length})</h3>
                        {activeSuppliers.length === 0 ? (
                            <p className="theme-muted text-sm py-4">No active suppliers approved yet.</p>
                        ) : (
                            activeSuppliers.map((s) => (
                                <div key={s.id} className="theme-panel rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border shadow-sm">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-base">{s.profile?.businessName || `Supplier #${s.id}`}</h4>
                                            <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold">
                                                ACTIVE
                                            </span>
                                        </div>
                                        <p className="theme-muted text-xs">Email: {s.email} • Phone: {s.phone}</p>
                                        <p className="theme-muted text-xs mt-0.5">GSTIN: {s.profile?.gstin || "N/A"} • FSSAI: {s.profile?.fssaiLicense || "N/A"}</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateSupplierStatus(s.id, "SUSPENDED")}
                                            className="rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 text-xs font-bold transition cursor-pointer"
                                        >
                                            Suspend
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleProcessSettlement(s.id)}
                                            className="theme-soft-button rounded-xl font-bold px-4 py-2 text-xs transition cursor-pointer"
                                        >
                                            Process Payout
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Tab 2: Product Moderation */}
            {activeTab === "products" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((p) => (
                        <div key={p.id} className="theme-panel rounded-2xl p-5 space-y-3 border shadow-sm">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-bold text-base">{p.name}</h3>
                                    <p className="theme-muted text-xs">Supplier: {p.supplier?.profile?.businessName || "Unknown"}</p>
                                </div>
                                <span className="theme-chip rounded-full px-3 py-0.5 text-xs font-bold">
                                    {p.status}
                                </span>
                            </div>
                            <div className="text-xs space-y-1 theme-muted border-t theme-border pt-3">
                                <p>Base Price: <span className="font-bold">₹{p.prices?.[0]?.basePrice || 100}</span> / {p.unit}</p>
                                <p>MOQ: <span className="font-bold">{p.moq} {p.unit}</span></p>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => handleUpdateProductStatus(p.id, "ACTIVE")}
                                    className="flex-1 theme-button py-2 text-xs font-extrabold cursor-pointer transition shadow-sm rounded-xl"
                                >
                                    Approve
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleUpdateProductStatus(p.id, "REJECTED")}
                                    className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 text-xs font-bold cursor-pointer transition"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tab 3: Marketplace Orders Audit */}
            {activeTab === "orders" && (
                <div className="space-y-3">
                    {orders.map((o) => (
                        <div key={o.id} className="theme-panel rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border shadow-sm">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-extrabold theme-accent-text">{o.orderNo}</span>
                                    <span className="theme-chip rounded-full px-3 py-0.5 text-xs font-bold">{o.status}</span>
                                </div>
                                <p className="theme-muted text-xs">Supplier: {o.supplier?.profile?.businessName || "Unknown"} • Restaurant: {o.restaurant?.name || "Tiffzy Cafe"}</p>
                                <p className="text-sm font-extrabold mt-1">Order Amount: ₹{o.totalAmount}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
