import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Truck,
    Package,
    ShoppingBag,
    Plus,
    CheckCircle2,
    XCircle,
    Clock,
    DollarSign,
    Layers,
    User,
    LogOut,
    RefreshCw,
    AlertTriangle,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

export default function SupplierDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("products");
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [showAddProductModal, setShowAddProductModal] = useState(false);

    const [newProduct, setNewProduct] = useState({
        name: "",
        unit: "KG",
        moq: 10,
        basePrice: 250,
        taxPercent: 5,
        discountType: "PERCENTAGE",
        discountValue: 8,
        initialStock: 500,
        description: "Fresh premium quality raw supplies",
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [profileRes, productsRes, ordersRes] = await Promise.all([
                api.get("/suppliers/me").catch(() => null),
                api.get("/supplier/products").catch(() => null),
                api.get("/supplier/orders").catch(() => null),
            ]);

            if (profileRes?.data) setProfile(profileRes.data);
            if (productsRes?.data?.products) setProducts(productsRes.data.products);
            if (ordersRes?.data?.orders) setOrders(ordersRes.data.orders);
        } catch (err) {
            showToast("Failed to load supplier data", { type: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreateProduct = async (e) => {
        e.preventDefault();
        try {
            await api.post("/supplier/products", newProduct);
            showToast("Product added successfully!");
            setShowAddProductModal(false);
            loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to create product", { type: "error" });
        }
    };

    const handleUpdateOrderStatus = async (orderId, action) => {
        try {
            await api.post(`/supplier/orders/${orderId}/${action}`, { notes: `Updated via supplier portal` });
            showToast(`Order status updated (${action.toUpperCase()})`);
            loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || `Failed to update order`, { type: "error" });
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("supplier_refresh_token");
        navigate("/supplier/login");
    };

    const totalSales = orders
        .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED")
        .reduce((sum, o) => sum + o.totalAmount, 0);

    return (
        <div className="min-h-screen bg-[#07090d] text-[#fff8e7] flex flex-col">
            {/* Header Navigation */}
            <header className="border-b border-white/10 bg-[#0f1118] px-6 py-4">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                            <Truck size={22} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">{profile?.profile?.businessName || "Supplier Portal"}</h1>
                            <p className="text-xs text-amber-200/70">Tiffzy Supply Chain Marketplace • Status: <span className="text-amber-400 font-semibold">{profile?.status || "ACTIVE"}</span></p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={loadData}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 transition flex items-center gap-1.5"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            Refresh
                        </button>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition flex items-center gap-1.5"
                        >
                            <LogOut size={14} />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="mx-auto max-w-7xl w-full flex-1 p-6 space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-[#15151a] p-5 space-y-1">
                        <p className="text-xs font-bold text-amber-200/70 uppercase">Active Products</p>
                        <p className="text-2xl font-bold text-white">{products.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#15151a] p-5 space-y-1">
                        <p className="text-xs font-bold text-amber-200/70 uppercase">B2B Restaurant Orders</p>
                        <p className="text-2xl font-bold text-white">{orders.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#15151a] p-5 space-y-1">
                        <p className="text-xs font-bold text-amber-200/70 uppercase">Total Sales Volume</p>
                        <p className="text-2xl font-bold text-amber-400">₹{totalSales.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#15151a] p-5 space-y-1">
                        <p className="text-xs font-bold text-amber-200/70 uppercase">Low Stock Alerts</p>
                        <p className="text-2xl font-bold text-red-400">
                            {products.filter((p) => (p.inventory?.availableStock || 0) <= 10).length}
                        </p>
                    </div>
                </div>

                {/* Tab Navigation Controls */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => setActiveTab("products")}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
                            activeTab === "products" ? "border-amber-500 text-amber-400" : "border-transparent text-amber-200/60 hover:text-white"
                        }`}
                    >
                        Product Studio ({products.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("orders")}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
                            activeTab === "orders" ? "border-amber-500 text-amber-400" : "border-transparent text-amber-200/60 hover:text-white"
                        }`}
                    >
                        Restaurant Orders ({orders.length})
                    </button>
                </div>

                {/* Tab Content: Products */}
                {activeTab === "products" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">Catalog Products</h2>
                            <button
                                onClick={() => setShowAddProductModal(true)}
                                className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 text-xs font-bold transition flex items-center gap-1.5"
                            >
                                <Plus size={16} />
                                Add Supply Product
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {products.map((p) => (
                                <div key={p.id} className="rounded-2xl border border-white/10 bg-[#15151a] p-5 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-bold text-white text-base">{p.name}</h3>
                                            <p className="text-xs text-amber-200/70">MOQ: {p.moq} {p.unit}</p>
                                        </div>
                                        <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-400">
                                            ₹{p.prices?.[0]?.basePrice || 100} / {p.unit}
                                        </span>
                                    </div>
                                    <div className="text-xs space-y-1 text-amber-100/70">
                                        <p>Stock: <span className="font-bold text-white">{p.inventory?.availableStock || 0} {p.unit}</span> available</p>
                                        <p>Discount: <span className="font-bold text-amber-300">{p.discounts?.[0]?.value || 0}% OFF</span></p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tab Content: Orders */}
                {activeTab === "orders" && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white">Live B2B Orders</h2>
                        <div className="space-y-3">
                            {orders.map((o) => (
                                <div key={o.id} className="rounded-2xl border border-white/10 bg-[#15151a] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-amber-400">{o.orderNo}</span>
                                            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-white">
                                                {o.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-amber-200/70">Restaurant: {o.restaurant?.name || "Tiffzy Cafe"}</p>
                                        <p className="text-xs text-white font-bold mt-1">Total: ₹{o.totalAmount}</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {o.status === "PLACED" && (
                                            <button
                                                onClick={() => handleUpdateOrderStatus(o.id, "accept")}
                                                className="rounded-xl bg-amber-500 text-black font-bold px-3 py-1.5 text-xs hover:bg-amber-400 transition"
                                            >
                                                Accept Order
                                            </button>
                                        )}
                                        {o.status === "ACCEPTED" && (
                                            <button
                                                onClick={() => handleUpdateOrderStatus(o.id, "dispatch")}
                                                className="rounded-xl bg-blue-500 text-white font-bold px-3 py-1.5 text-xs hover:bg-blue-400 transition"
                                            >
                                                Dispatch Order
                                            </button>
                                        )}
                                        {o.status === "DISPATCHED" && (
                                            <button
                                                onClick={() => handleUpdateOrderStatus(o.id, "complete")}
                                                className="rounded-xl bg-green-500 text-white font-bold px-3 py-1.5 text-xs hover:bg-green-400 transition"
                                            >
                                                Mark Completed
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Add Product Modal */}
            {showAddProductModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#15151a] p-6 space-y-4">
                        <h3 className="text-lg font-bold text-white">Add New Product to Marketplace</h3>
                        <form onSubmit={handleCreateProduct} className="space-y-3">
                            <input
                                type="text"
                                placeholder="Product Name (e.g. Chicken Breast)"
                                value={newProduct.name}
                                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                required
                                className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="Unit (e.g. KG, LITER)"
                                    value={newProduct.unit}
                                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none"
                                />
                                <input
                                    type="number"
                                    placeholder="MOQ (e.g. 10)"
                                    value={newProduct.moq}
                                    onChange={(e) => setNewProduct({ ...newProduct, moq: e.target.value })}
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="number"
                                    placeholder="Base Price (₹)"
                                    value={newProduct.basePrice}
                                    onChange={(e) => setNewProduct({ ...newProduct, basePrice: e.target.value })}
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none"
                                />
                                <input
                                    type="number"
                                    placeholder="Initial Stock (e.g. 500)"
                                    value={newProduct.initialStock}
                                    onChange={(e) => setNewProduct({ ...newProduct, initialStock: e.target.value })}
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddProductModal(false)}
                                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 text-xs font-bold"
                                >
                                    Save Product
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
