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
                quantity: qty || product.moq || 10,
            });
            showToast("Item added to supply cart!");
            if (res.data?.cart) setCart(res.data.cart);
            else loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to add item to cart", { type: "error" });
        }
    };

    const handleUpdateCartItem = async (itemId, quantity) => {
        try {
            const res = await api.put(`/supply-cart/items/${itemId}`, { quantity });
            if (res.data?.cart) setCart(res.data.cart);
            else loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to update item quantity", { type: "error" });
        }
    };

    const handleRemoveCartItem = async (itemId) => {
        try {
            const res = await api.delete(`/supply-cart/items/${itemId}`);
            showToast("Item removed from supply cart");
            if (res.data?.cart) setCart(res.data.cart);
            else loadData();
        } catch (err) {
            showToast("Failed to remove item", { type: "error" });
        }
    };

    const handleCheckoutOrder = async () => {
        try {
            const res = await api.post("/supply-orders/checkout", { paymentMethod: "PAY_ON_DELIVERY" });
            showToast(res.data?.message || "Supply order placed successfully!");
            setShowCartModal(false);
            loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to place supply order", { type: "error" });
        }
    };

    return (
        <section className="space-y-6 text-white">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-white/10 pb-5">
                <div>
                    <h2 className="text-2xl font-extrabold text-white flex items-center gap-2 tracking-tight">
                        <Truck className="text-amber-400" />
                        Tiffzy Supply Marketplace
                    </h2>
                    <p className="text-slate-300 text-xs mt-0.5">Direct raw ingredient procurement from verified suppliers</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setShowCartModal(true)}
                        className="relative rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 px-4 py-2.5 text-xs font-extrabold text-white flex items-center gap-2 transition cursor-pointer shadow-md"
                    >
                        <ShoppingCart size={16} />
                        Supply Cart
                        <span className="rounded-full bg-amber-500 text-black px-2 py-0.5 text-[11px] font-black">
                            {cart.items?.length || 0}
                        </span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setActiveTab("browse")}
                    className={`rounded-xl px-5 py-2.5 text-xs font-extrabold transition cursor-pointer ${
                        activeTab === "browse" ? "bg-amber-500 text-black shadow-md" : "border border-white/15 bg-white/10 text-slate-300 hover:text-white"
                    }`}
                >
                    Browse Ingredients ({products.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className={`rounded-xl px-5 py-2.5 text-xs font-extrabold transition cursor-pointer ${
                        activeTab === "orders" ? "bg-amber-500 text-black shadow-md" : "border border-white/15 bg-white/10 text-slate-300 hover:text-white"
                    }`}
                >
                    Track Supply Orders ({orders.length})
                </button>
            </div>

            {/* Search Bar */}
            {activeTab === "browse" && (
                <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search ingredients (e.g. Chicken Breast, Dairy, Spices)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-[#12141c] pl-11 pr-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 transition"
                    />
                </div>
            )}

            {/* Browse Grid */}
            {activeTab === "browse" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {products.map((p) => (
                        <div key={p.id} className="rounded-2xl border border-white/15 bg-[#12141c] p-5 space-y-3.5 shadow-lg">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-bold text-white text-base">{p.name}</h3>
                                    <p className="text-xs text-slate-300 mt-0.5">Supplier: {p.supplier?.profile?.businessName || "Verified Supplier"}</p>
                                </div>
                                <span className="rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 text-xs font-bold">
                                    ₹{p.prices?.[0]?.basePrice || 100} / {p.unit}
                                </span>
                            </div>

                            <div className="text-xs space-y-1 text-slate-300 border-t border-white/10 pt-3">
                                <p>Min Order Qty (MOQ): <span className="font-bold text-white">{p.moq} {p.unit}</span></p>
                                <p>Available Stock: <span className="font-bold text-emerald-400">{p.inventory?.availableStock || 0} {p.unit}</span></p>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleAddToCart(p, p.moq)}
                                className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-black py-2.5 text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                            >
                                <Plus size={16} />
                                Add {p.moq} {p.unit} to Cart
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Orders Tab */}
            {activeTab === "orders" && (
                <div className="space-y-3">
                    {orders.map((o) => (
                        <div key={o.id} className="rounded-2xl border border-white/15 bg-[#12141c] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-extrabold text-amber-400">{o.orderNo}</span>
                                    <span className="rounded-full bg-white/10 text-white border border-white/15 px-3 py-0.5 text-xs font-bold">
                                        {o.status}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300">Supplier: {o.supplier?.profile?.businessName || "Direct Supplier"}</p>
                                <p className="text-sm font-extrabold text-white mt-1">Total Amount: ₹{o.totalAmount}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Cart Modal */}
            {showCartModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
                    <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#12141c] p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <ShoppingCart size={20} className="text-amber-400" />
                                Your Supply Cart
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowCartModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {cart.items?.length === 0 ? (
                            <p className="text-center text-slate-300 py-8 text-sm font-medium">Your supply cart is empty.</p>
                        ) : (
                            <div className="space-y-3">
                                {cart.items?.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between border-b border-white/10 pb-3">
                                        <div>
                                            <p className="font-bold text-white text-sm">{item.product?.name}</p>
                                            <p className="text-xs text-slate-300">₹{item.unitPrice} / {item.product?.unit}</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateCartItem(item.id, Math.max(1, item.quantity - 1))}
                                                className="rounded-lg bg-white/10 hover:bg-white/20 p-1 text-white"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span className="text-sm font-bold text-white px-1">{item.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateCartItem(item.id, item.quantity + 1)}
                                                className="rounded-lg bg-white/10 hover:bg-white/20 p-1 text-white"
                                            >
                                                <Plus size={14} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCartItem(item.id)}
                                                className="text-red-400 hover:text-red-300 ml-2 text-xs font-bold"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div className="flex items-center justify-between border-t border-white/15 pt-3">
                                    <span className="font-bold text-white text-base">Total Order Cost</span>
                                    <span className="font-black text-amber-400 text-xl">₹{cart.cartTotal || 0}</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleCheckoutOrder}
                                    className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-black py-3 font-extrabold transition shadow-md cursor-pointer mt-2"
                                >
                                    Place Supply Order (Pay on Delivery)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
