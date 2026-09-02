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
        <section className="space-y-6 text-white">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-white/10 pb-5">
                <div>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        <Truck className="text-amber-400" />
                        Super Admin — Supply Chain Management
                    </h2>
                    <p className="text-slate-300 text-xs mt-0.5">Supplier KYC verification approval, catalog moderation, B2B orders & settlements</p>
                </div>

                <button
                    type="button"
                    onClick={loadData}
                    className="rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    Refresh Stats
                </button>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/15 bg-[#12141c] p-5 space-y-1.5 shadow-lg">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pending KYC Verification</p>
                    <p className="text-3xl font-black text-amber-400">{pendingSuppliers.length}</p>
                    <p className="text-xs text-slate-300 font-semibold">Requires Super Admin Review</p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#12141c] p-5 space-y-1.5 shadow-lg">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Approved Suppliers</p>
                    <p className="text-3xl font-black text-emerald-400">{activeSuppliers.length}</p>
                    <p className="text-xs text-slate-300 font-semibold">{suppliers.length} Total Registered</p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#12141c] p-5 space-y-1.5 shadow-lg">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Gross B2B GMV</p>
                    <p className="text-3xl font-black text-amber-400">₹{(dashboard?.orders?.totalVolume || 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-300 font-semibold">{dashboard?.orders?.totalCount || 0} Total Orders Placed</p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#12141c] p-5 space-y-1.5 shadow-lg">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Net Platform Revenue</p>
                    <p className="text-3xl font-black text-emerald-400">₹{(dashboard?.settlements?.netRevenue || 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-300 font-semibold">5% Platform Commission</p>
                </div>
            </div>

            {/* Tab Navigation Controls */}
            <div className="flex border-b border-white/10 gap-2">
                <button
                    type="button"
                    onClick={() => setActiveTab("suppliers")}
                    className={`px-5 py-2.5 text-xs font-extrabold rounded-t-xl transition cursor-pointer ${
                        activeTab === "suppliers" ? "bg-amber-500 text-black shadow-md" : "border border-white/15 bg-white/10 text-slate-300 hover:text-white"
                    }`}
                >
                    Supplier Accounts & KYC Verification ({suppliers.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("products")}
                    className={`px-5 py-2.5 text-xs font-extrabold rounded-t-xl transition cursor-pointer ${
                        activeTab === "products" ? "bg-amber-500 text-black shadow-md" : "border border-white/15 bg-white/10 text-slate-300 hover:text-white"
                    }`}
                >
                    Product Moderation ({products.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className={`px-5 py-2.5 text-xs font-extrabold rounded-t-xl transition cursor-pointer ${
                        activeTab === "orders" ? "bg-amber-500 text-black shadow-md" : "border border-white/15 bg-white/10 text-slate-300 hover:text-white"
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
                            <h3 className="text-lg font-extrabold text-amber-400 flex items-center gap-2">
                                <Clock size={20} />
                                Pending Supplier KYC Verification Requests ({pendingSuppliers.length})
                            </h3>

                            <div className="space-y-4">
                                {pendingSuppliers.map((s) => {
                                    const prof = s.profile || {};
                                    const addr = s.addresses?.[0] || {};
                                    return (
                                        <div key={s.id} className="rounded-3xl border border-amber-500/40 bg-[#141622] p-6 space-y-4 shadow-xl">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-xl font-bold text-white">{prof.businessName || `Supplier #${s.id}`}</h4>
                                                        <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 text-xs font-extrabold">
                                                            {s.status || "PENDING"}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 mt-1">Email: {s.email} • Phone: {s.phone}</p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateSupplierStatus(s.id, "ACTIVE")}
                                                        className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black px-5 py-2.5 text-xs transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                                                    >
                                                        <CheckCircle2 size={16} />
                                                        Approve & Activate Account
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateSupplierStatus(s.id, "REJECTED")}
                                                        className="rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-200 font-bold px-4 py-2.5 text-xs transition cursor-pointer"
                                                    >
                                                        Reject KYC
                                                    </button>
                                                </div>
                                            </div>

                                            {/* SUBMITTED KYC DETAILS GRID */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1.5">
                                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
                                                        <Building2 size={14} /> Tax & Compliance
                                                    </p>
                                                    <p><span className="text-slate-400">Legal Name:</span> <strong className="text-white">{prof.legalName || "N/A"}</strong></p>
                                                    <p><span className="text-slate-400">GSTIN:</span> <strong className="text-amber-300">{prof.gstin || "N/A"}</strong></p>
                                                    <p><span className="text-slate-400">FSSAI License:</span> <strong className="text-white">{prof.fssaiLicense || "N/A"}</strong></p>
                                                </div>

                                                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1.5">
                                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
                                                        <CreditCard size={14} /> Bank Payout Account
                                                    </p>
                                                    <p><span className="text-slate-400">Account No:</span> <strong className="text-white">{prof.bankAccountNumber || "N/A"}</strong></p>
                                                    <p><span className="text-slate-400">IFSC Code:</span> <strong className="text-white">{prof.bankIfscCode || "N/A"}</strong></p>
                                                    <p><span className="text-slate-400">Holder / Bank:</span> <strong className="text-white">{prof.bankAccountName || "N/A"} ({prof.bankName || "Bank"})</strong></p>
                                                </div>

                                                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1.5">
                                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
                                                        <MapPin size={14} /> Warehouse Facility
                                                    </p>
                                                    <p><strong className="text-white">{addr.line1 || "No address line"}</strong></p>
                                                    <p className="text-slate-300">{addr.city || "City"}, {addr.state || "State"} - {addr.pincode || "Pincode"}</p>
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
                        <h3 className="text-lg font-bold text-white">Active Approved Suppliers ({activeSuppliers.length})</h3>
                        {activeSuppliers.length === 0 ? (
                            <p className="text-slate-300 text-sm py-4">No active suppliers approved yet.</p>
                        ) : (
                            activeSuppliers.map((s) => (
                                <div key={s.id} className="rounded-2xl border border-white/15 bg-[#12141c] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-white text-base">{s.profile?.businessName || `Supplier #${s.id}`}</h4>
                                            <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold">
                                                ACTIVE
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300">Email: {s.email} • Phone: {s.phone}</p>
                                        <p className="text-xs text-slate-300 mt-0.5">GSTIN: {s.profile?.gstin || "N/A"} • FSSAI: {s.profile?.fssaiLicense || "N/A"}</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateSupplierStatus(s.id, "SUSPENDED")}
                                            className="rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-200 px-4 py-2 text-xs font-bold transition cursor-pointer"
                                        >
                                            Suspend
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleProcessSettlement(s.id)}
                                            className="rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 text-xs transition cursor-pointer border border-white/15"
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
                        <div key={p.id} className="rounded-2xl border border-white/15 bg-[#12141c] p-5 space-y-3 shadow-lg">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-bold text-white text-base">{p.name}</h3>
                                    <p className="text-xs text-slate-300">Supplier: {p.supplier?.profile?.businessName || "Unknown"}</p>
                                </div>
                                <span className="rounded-full bg-white/10 text-white border border-white/15 px-3 py-0.5 text-xs font-bold">
                                    {p.status}
                                </span>
                            </div>
                            <div className="text-xs space-y-1 text-slate-300 border-t border-white/10 pt-3">
                                <p>Base Price: <span className="font-bold text-white">₹{p.prices?.[0]?.basePrice || 100}</span> / {p.unit}</p>
                                <p>MOQ: <span className="font-bold text-white">{p.moq} {p.unit}</span></p>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => handleUpdateProductStatus(p.id, "ACTIVE")}
                                    className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-black py-2 text-xs font-extrabold cursor-pointer transition shadow-md"
                                >
                                    Approve
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleUpdateProductStatus(p.id, "REJECTED")}
                                    className="flex-1 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-200 py-2 text-xs font-bold cursor-pointer transition"
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
                        <div key={o.id} className="rounded-2xl border border-white/15 bg-[#12141c] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-extrabold text-amber-400">{o.orderNo}</span>
                                    <span className="rounded-full bg-white/10 text-white border border-white/15 px-3 py-0.5 text-xs font-bold">{o.status}</span>
                                </div>
                                <p className="text-xs text-slate-300">Supplier: {o.supplier?.profile?.businessName || "Unknown"} • Restaurant: {o.restaurant?.name || "Tiffzy Cafe"}</p>
                                <p className="text-sm font-extrabold text-white mt-1">Order Amount: ₹{o.totalAmount}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
