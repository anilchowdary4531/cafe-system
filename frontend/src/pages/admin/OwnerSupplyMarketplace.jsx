import { useEffect, useState } from "react";
import {
    ShoppingBag,
    Search,
    Truck,
    CheckCircle2,
    ShieldCheck,
    AlertCircle,
    Plus,
    Minus,
    ShoppingCart,
    Clock,
    X,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

export default function OwnerSupplyMarketplace() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState({ items: [], cartTotal: 0 });
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("browse");
    const [search, setSearch] = useState("");
    const [showCartModal, setShowCartModal] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [prodRes, cartRes, ordersRes] = await Promise.all([
                api.get("/marketplace/products", { params: { search } }).catch(() => null),
                api.get("/supply-cart").catch(() => null),
                api.get("/supply-orders").catch(() => null),
            ]);

            if (prodRes?.data?.products) setProducts(prodRes.data.products);
            if (cartRes?.data) setCart(cartRes.data);
            if (ordersRes?.data?.orders) setOrders(ordersRes.data.orders);
        } catch (err) {
            showToast("Failed to load marketplace data", { type: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [search]);

    const handleAddToCart = async (product, qty) => {
        try {
            const res = await api.post("/supply-cart/items", {
                productId: product.id,
                quantity: qty,
            });
            setCart(res.data);
            showToast(`Added ${product.name} to Supply Cart!`);
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to add to cart", { type: "error" });
        }
    };

    const handleCheckout = async () => {
        try {
            const res = await api.post("/supply-orders", {
                deliveryAddress: "Main Restaurant Kitchen Address",
                notes: "Urgent raw material procurement",
            });
            showToast(res.data?.message || "Supply Order placed successfully!");
            setShowCartModal(false);
            loadData();
            setActiveTab("orders");
        } catch (err) {
            showToast(err?.response?.data?.error || "Checkout failed", { type: "error" });
        }
    };

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-[var(--app-border)] pb-5">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Truck className="text-amber-500" />
                        Tiffzy Supply Marketplace
                    </h2>
                    <p className="theme-muted text-xs">Direct raw ingredient procurement from verified suppliers</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCartModal(true)}
                        className="theme-soft-button relative rounded-full px-4 py-2 text-xs font-bold flex items-center gap-2"
                    >
                        <ShoppingCart size={16} />
                        Supply Cart
                        <span className="rounded-full bg-amber-500 text-black px-2 py-0.5 text-[11px] font-bold">
                            {cart.items?.length || 0}
                        </span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab("browse")}
                    className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                        activeTab === "browse" ? "bg-amber-500 text-black" : "theme-soft-button"
                    }`}
                >
                    Browse Ingredients ({products.length})
                </button>
                <button
                    onClick={() => setActiveTab("orders")}
                    className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                        activeTab === "orders" ? "bg-amber-500 text-black" : "theme-soft-button"
                    }`}
                >
                    Track Supply Orders ({orders.length})
                </button>
            </div>

            {/* Search Bar */}
            {activeTab === "browse" && (
                <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search ingredients (e.g. Chicken Breast, Dairy, Spices)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] pl-11 pr-4 py-3 text-sm text-white outline-none"
                    />
                </div>
            )}

            {/* Browse Grid */}
            {activeTab === "browse" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {products.map((p) => (
                        <div key={p.id} className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 space-y-4 shadow-lg">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="rounded-full bg-amber-500/20 text-amber-400 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                                        {p.supplierName}
                                    </span>
                                    <h3 className="font-bold text-lg text-white mt-1">{p.name}</h3>
                                    <p className="theme-muted text-xs">MOQ: <span className="font-bold text-white">{p.moq} {p.unit}</span></p>
                                </div>
                                <div className="text-right">
                                    {p.discountPercent > 0 && (
                                        <p className="line-through text-xs text-gray-400">₹{p.basePrice}</p>
                                    )}
                                    <p className="text-lg font-bold text-amber-400">₹{p.finalPrice} <span className="text-xs text-gray-400 font-normal">/{p.unit}</span></p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs border-t border-b border-[var(--app-border)] py-2">
                                <span className="text-gray-300">Available: <span className="font-bold text-white">{p.availableStock} {p.unit}</span></span>
                                <span className="text-green-400 font-semibold">Same Day Delivery</span>
                            </div>

                            <button
                                onClick={() => handleAddToCart(p, p.moq)}
                                className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-black py-2.5 text-xs font-bold transition flex items-center justify-center gap-2"
                            >
                                <Plus size={16} />
                                Add to Supply Cart ({p.moq} {p.unit})
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Orders Tracker */}
            {activeTab === "orders" && (
                <div className="space-y-3">
                    {orders.map((o) => (
                        <div key={o.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-amber-400">{o.orderNo}</span>
                                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-white">
                                        {o.status}
                                    </span>
                                </div>
                                <p className="theme-muted text-xs">Supplier: {o.supplier?.profile?.businessName || "ABC Foods"}</p>
                                <p className="text-xs font-bold text-white mt-1">Total Payable: ₹{o.totalAmount}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Cart Drawer / Modal */}
            {showCartModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-3xl border border-[var(--app-border)] bg-[#15151a] p-6 space-y-5 text-white">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <h3 className="font-bold text-lg">Supply Cart ({cart.items?.length || 0} items)</h3>
                            <button onClick={() => setShowCartModal(false)}><X size={20} /></button>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                            {cart.items?.map((item) => (
                                <div key={item.id} className="flex items-center justify-between rounded-xl bg-black/30 p-3 text-xs border border-white/5">
                                    <div>
                                        <p className="font-bold text-white">{item.name}</p>
                                        <p className="text-amber-200/70">{item.quantity} {item.unit} • ₹{item.finalPrice}/{item.unit}</p>
                                    </div>
                                    <p className="font-bold text-amber-400">₹{item.itemTotal}</p>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                            <p className="text-sm font-bold">Total Amount:</p>
                            <p className="text-xl font-bold text-amber-400">₹{cart.cartTotal}</p>
                        </div>

                        <button
                            onClick={handleCheckout}
                            disabled={!cart.items || cart.items.length === 0}
                            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-black py-3 font-bold transition disabled:opacity-50"
                        >
                            Place Supply Order & Checkout
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
