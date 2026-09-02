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
import BrandLogo from "../../components/BrandLogo";

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
        <div className="theme-page min-h-screen flex flex-col">
            {/* Header Navigation - Matching Customer Theme */}
            <header className="theme-nav sticky top-0 z-30 px-6 py-4 border-b">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="theme-card flex h-10 w-10 items-center justify-center rounded-2xl shadow-md">
                            <BrandLogo className="h-7 w-7" title="Brand logo" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">
                                {profile?.profile?.businessName || "Supplier Portal"}
                            </h1>
                            <p className="theme-muted text-xs font-medium">
                                Tiffzy Supply Chain Marketplace • Status:{" "}
                                <span className="theme-accent-text font-bold">{profile?.status || "ACTIVE"}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={loadData}
                            className="theme-soft-button rounded-xl px-3.5 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            Refresh
                        </button>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition flex items-center gap-1.5 cursor-pointer"
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
                    <div className="theme-panel rounded-2xl p-5 space-y-1.5 border shadow-sm">
                        <p className="theme-muted text-xs font-bold uppercase tracking-wider">Active Products</p>
                        <p className="text-3xl font-black">{products.length}</p>
                    </div>

                    <div className="theme-panel rounded-2xl p-5 space-y-1.5 border shadow-sm">
                        <p className="theme-muted text-xs font-bold uppercase tracking-wider">B2B Restaurant Orders</p>
                        <p className="text-3xl font-black">{orders.length}</p>
                    </div>

                    <div className="theme-panel rounded-2xl p-5 space-y-1.5 border shadow-sm">
                        <p className="theme-muted text-xs font-bold uppercase tracking-wider">Total Sales Volume</p>
                        <p className="text-3xl font-black theme-accent-text">₹{totalSales.toLocaleString()}</p>
                    </div>

                    <div className="theme-panel rounded-2xl p-5 space-y-1.5 border shadow-sm">
                        <p className="theme-muted text-xs font-bold uppercase tracking-wider">Low Stock Alerts</p>
                        <p className="text-3xl font-black text-red-400">
                            {products.filter((p) => (p.inventory?.availableStock || 0) <= 10).length}
                        </p>
                    </div>
                </div>

                {/* Tab Navigation Controls */}
                <div className="flex border-b theme-border gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab("products")}
                        className={`px-6 py-3 text-sm font-bold rounded-t-xl transition cursor-pointer ${
                            activeTab === "products"
                                ? "theme-button font-extrabold shadow-md"
                                : "theme-soft-button"
                        }`}
                    >
                        Product Studio ({products.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("orders")}
                        className={`px-6 py-3 text-sm font-bold rounded-t-xl transition cursor-pointer ${
                            activeTab === "orders"
                                ? "theme-button font-extrabold shadow-md"
                                : "theme-soft-button"
                        }`}
                    >
                        Restaurant Orders ({orders.length})
                    </button>
                </div>

                {/* Tab Content: Products */}
                {activeTab === "products" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold tracking-tight">Catalog Products</h2>
                            <button
                                type="button"
                                onClick={() => setShowAddProductModal(true)}
                                className="theme-button rounded-xl px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                                <Plus size={16} />
                                Add Supply Product
                            </button>
                        </div>

                        {products.length === 0 ? (
                            <div className="theme-panel rounded-3xl p-12 text-center border space-y-3">
                                <Package size={40} className="mx-auto theme-accent-text" />
                                <h3 className="text-lg font-bold">No products added yet</h3>
                                <p className="theme-muted text-sm max-w-sm mx-auto">
                                    Click "Add Supply Product" to publish raw ingredients, set pricing, MOQ, and inventory.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {products.map((p) => (
                                    <div key={p.id} className="theme-panel rounded-2xl p-5 space-y-3 border shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-bold text-base">{p.name}</h3>
                                                <p className="theme-muted text-xs">MOQ: {p.moq} {p.unit}</p>
                                            </div>
                                            <span className="theme-button-secondary rounded-full px-3 py-1 text-xs font-bold">
                                                ₹{p.prices?.[0]?.basePrice || 100} / {p.unit}
                                            </span>
                                        </div>
                                        <div className="text-xs space-y-1 theme-muted border-t theme-border pt-3">
                                            <p>Stock: <span className="font-bold">{p.inventory?.availableStock || 0} {p.unit}</span> available</p>
                                            <p>Discount: <span className="font-bold theme-accent-text">{p.discounts?.[0]?.value || 0}% OFF</span></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Content: Orders */}
                {activeTab === "orders" && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold tracking-tight">Live B2B Orders</h2>
                        {orders.length === 0 ? (
                            <div className="theme-panel rounded-3xl p-12 text-center border space-y-3">
                                <ShoppingBag size={40} className="mx-auto theme-accent-text" />
                                <h3 className="text-lg font-bold">No incoming B2B orders yet</h3>
                                <p className="theme-muted text-sm max-w-sm mx-auto">
                                    Orders placed by restaurants from the Tiffzy Supply Marketplace will appear here for fulfillment.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {orders.map((o) => (
                                    <div key={o.id} className="theme-panel rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border shadow-sm">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-extrabold theme-accent-text">{o.orderNo}</span>
                                                <span className="theme-chip rounded-full px-3 py-0.5 text-xs font-bold">
                                                    {o.status}
                                                </span>
                                            </div>
                                            <p className="theme-muted text-xs">Restaurant: {o.restaurant?.name || "Tiffzy Cafe"}</p>
                                            <p className="text-sm font-extrabold mt-1">Total: ₹{o.totalAmount}</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {o.status === "PLACED" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateOrderStatus(o.id, "accept")}
                                                    className="theme-button rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer"
                                                >
                                                    Accept Order
                                                </button>
                                            )}
                                            {o.status === "ACCEPTED" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateOrderStatus(o.id, "dispatch")}
                                                    className="theme-button-secondary rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer"
                                                >
                                                    Dispatch Order
                                                </button>
                                            )}
                                            {o.status === "DISPATCHED" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateOrderStatus(o.id, "complete")}
                                                    className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 text-xs transition cursor-pointer"
                                                >
                                                    Mark Completed
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Add Product Modal */}
            {showAddProductModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
                    <div className="theme-panel w-full max-w-lg rounded-3xl p-6 space-y-4 border shadow-2xl">
                        <h3 className="text-xl font-bold">Add New Product to Marketplace</h3>
                        <form onSubmit={handleCreateProduct} className="space-y-3">
                            <div>
                                <label className="theme-muted mb-1 block text-xs font-bold uppercase">Product Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Fresh Chicken Breast"
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                    required
                                    className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="theme-muted mb-1 block text-xs font-bold uppercase">Unit</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. KG, LITER"
                                        value={newProduct.unit}
                                        onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="theme-muted mb-1 block text-xs font-bold uppercase">Minimum Order Qty (MOQ)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 10"
                                        value={newProduct.moq}
                                        onChange={(e) => setNewProduct({ ...newProduct, moq: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="theme-muted mb-1 block text-xs font-bold uppercase">Base Price (₹)</label>
                                    <input
                                        type="number"
                                        placeholder="250"
                                        value={newProduct.basePrice}
                                        onChange={(e) => setNewProduct({ ...newProduct, basePrice: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="theme-muted mb-1 block text-xs font-bold uppercase">Initial Stock</label>
                                    <input
                                        type="number"
                                        placeholder="500"
                                        value={newProduct.initialStock}
                                        onChange={(e) => setNewProduct({ ...newProduct, initialStock: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddProductModal(false)}
                                    className="theme-soft-button rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="theme-button rounded-xl px-5 py-2.5 text-xs font-bold cursor-pointer"
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
