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
    MessageSquare,
    Tag,
    Handshake,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { SUPPLY_CATEGORIES } from "../../utils/supplyCategories";

export default function OwnerSupplyMarketplace() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState({ items: [], cartTotal: 0 });
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("browse");
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All Categories");
    const [showCartModal, setShowCartModal] = useState(false);
    const [showBargainModal, setShowBargainModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [bargainForm, setBargainForm] = useState({
        quantity: 50,
        offeredPrice: 200,
    });

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

    const handleOpenBargain = (product) => {
        setSelectedProduct(product);
        const base = product.prices?.[0]?.basePrice || 100;
        setBargainForm({
            quantity: product.moq || 10,
            offeredPrice: Math.round(base * 0.9), // Default 10% lower bargain offer proposal
        });
        setShowBargainModal(true);
    };

    const handleSendBargainOffer = async (e) => {
        e.preventDefault();
        if (!selectedProduct) return;
        try {
            const basePrice = selectedProduct.prices?.[0]?.basePrice || 100;
            await api.post("/supply-chat/messages", {
                threadId: `thread_supp_${selectedProduct.supplierId}_rest_1`,
                sender: "CLIENT",
                senderName: "Restaurant Owner Client",
                type: "BARGAIN_OFFER",
                offer: {
                    productName: selectedProduct.name,
                    quantity: bargainForm.quantity,
                    unit: selectedProduct.unit,
                    originalPrice: basePrice,
                    offeredPrice: bargainForm.offeredPrice,
                },
            });
            showToast("Price bargain offer sent to supplier!");
            setShowBargainModal(false);
        } catch (err) {
            showToast("Failed to send bargain offer", { type: "error" });
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
        <section className="space-y-6 theme-adaptive">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b theme-border pb-5">
                <div>
                    <h2 className="text-2xl font-extrabold flex items-center gap-2 tracking-tight">
                        <Truck className="theme-accent-text" />
                        Tiffzy Supply Marketplace & Price Bargaining
                    </h2>
                    <p className="theme-muted text-xs mt-0.5">Direct raw ingredient procurement & live price negotiation with verified suppliers</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setShowCartModal(true)}
                        className="relative theme-button-secondary rounded-xl px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 transition cursor-pointer shadow-md"
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
                        activeTab === "browse" ? "theme-button shadow-md" : "theme-button-secondary"
                    }`}
                >
                    Browse Ingredients ({products.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className={`rounded-xl px-5 py-2.5 text-xs font-extrabold transition cursor-pointer ${
                        activeTab === "orders" ? "theme-button shadow-md" : "theme-button-secondary"
                    }`}
                >
                    Track Supply Orders ({orders.length})
                </button>
            </div>

            {/* Search + Categories Bar */}
            {activeTab === "browse" && (
                <div className="space-y-3">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-3.5 theme-muted" />
                        <input
                            type="text"
                            placeholder="Search 20 supply categories (e.g. Chicken Breast, Dairy, Spices, Utensils, Packaging, Water Bottles)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-2xl theme-input pl-11 pr-4 py-3 text-sm outline-none transition"
                        />
                    </div>

                    {/* 20 Restaurant Supply Categories Scrollable Bar */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        <button
                            type="button"
                            onClick={() => setSelectedCategory("All Categories")}
                            className={`rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                                selectedCategory === "All Categories"
                                    ? "theme-button shadow-md font-extrabold"
                                    : "theme-button-secondary"
                            }`}
                        >
                            ✨ All Categories ({products.length})
                        </button>
                        {SUPPLY_CATEGORIES.map((cat) => {
                            const count = products.filter((p) => {
                                const target = cat.name.trim().toLowerCase();
                                const pCatName = String(p.category?.name || p.categoryName || "").trim().toLowerCase();
                                return pCatName === target || (pCatName && (pCatName.includes(target) || target.includes(pCatName)));
                            }).length;

                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.name)}
                                    className={`rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                                        selectedCategory === cat.name
                                            ? "theme-button shadow-md font-extrabold"
                                            : count > 0
                                            ? "border theme-border theme-soft-button theme-accent-text"
                                            : "theme-button-secondary"
                                    }`}
                                >
                                    <span>{cat.icon}</span>
                                    <span>{cat.name}</span>
                                    {count > 0 && (
                                        <span className="ml-1 rounded-full bg-amber-500 text-black px-1.5 py-0.5 text-[10px] font-black">
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Browse Grid */}
            {activeTab === "browse" && (() => {
                const filtered = products.filter((p) => {
                    if (search.trim()) {
                        const query = search.toLowerCase();
                        const pName = String(p.name || "").toLowerCase();
                        const pDesc = String(p.description || "").toLowerCase();
                        const pSupplier = String(p.supplier?.profile?.businessName || "").toLowerCase();
                        const pCat = String(p.category?.name || p.categoryName || "").toLowerCase();
                        if (!pName.includes(query) && !pDesc.includes(query) && !pSupplier.includes(query) && !pCat.includes(query)) {
                            return false;
                        }
                    }

                    if (selectedCategory !== "All Categories") {
                        const target = selectedCategory.trim().toLowerCase();
                        const pCatName = String(p.category?.name || p.categoryName || "").trim().toLowerCase();
                        const pCatSlug = String(p.category?.slug || "").trim().toLowerCase();
                        if (pCatName !== target && pCatSlug !== target && !pCatName.includes(target) && !target.includes(pCatName)) {
                            return false;
                        }
                    }

                    return true;
                });

                if (filtered.length === 0) {
                    return (
                        <div className="theme-panel rounded-3xl border p-10 text-center space-y-4 shadow-xl my-4">
                            <Package size={44} className="mx-auto theme-accent-text opacity-80" />
                            <div>
                                <h3 className="text-base font-bold">No products listed under "{selectedCategory}"</h3>
                                <p className="theme-muted text-xs mt-1 max-w-md mx-auto">
                                    {selectedCategory === "All Categories"
                                        ? "No supply products added to marketplace yet."
                                        : `Currently no suppliers have listed products under "${selectedCategory}". Click below to show all available ingredients.`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setSelectedCategory("All Categories"); setSearch(""); }}
                                className="theme-button rounded-xl px-5 py-2.5 text-xs font-extrabold transition shadow-md cursor-pointer inline-flex items-center gap-1.5"
                            >
                                ✨ View All Supply Products ({products.length})
                            </button>
                        </div>
                    );
                }

                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map((p) => {
                            const imgUrl = p.images?.[0]?.imageUrl || p.imageUrl;
                            return (
                                <div key={p.id} className="theme-panel rounded-2xl border p-4 space-y-3 shadow-md">
                                    {imgUrl ? (
                                        <div className="h-36 w-full rounded-xl overflow-hidden border theme-border bg-black/20 shadow-inner">
                                            <img src={imgUrl} alt={p.name} className="h-full w-full object-cover hover:scale-105 transition duration-300" />
                                        </div>
                                    ) : null}

                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-bold text-base">{p.name}</h3>
                                            <p className="theme-muted text-xs mt-0.5">Supplier: {p.supplier?.profile?.businessName || "Verified Supplier"}</p>
                                        </div>
                                        <span className="theme-button-secondary rounded-full px-3 py-1 text-xs font-bold">
                                            ₹{p.prices?.[0]?.basePrice || 100} / {p.unit}
                                        </span>
                                    </div>

                                    <div className="text-xs space-y-1 theme-muted border-t theme-border pt-3">
                                        <p>Min Order Qty (MOQ): <span className="font-bold">{p.moq} {p.unit}</span></p>
                                        <p>Available Stock: <span className="font-bold theme-accent-text">{p.inventory?.availableStock || 0} {p.unit}</span></p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => handleAddToCart(p, p.moq)}
                                            className="theme-button flex-1 rounded-xl py-2.5 text-xs font-extrabold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                                        >
                                            <Plus size={15} />
                                            Add {p.moq} {p.unit}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenBargain(p)}
                                            className="theme-button-secondary rounded-xl py-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                            title="Negotiate Price with Supplier"
                                        >
                                            <Handshake size={15} className="theme-accent-text" />
                                            Bargain Price
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Orders Tab */}
            {activeTab === "orders" && (
                <div className="space-y-3">
                    {orders.map((o) => (
                        <div key={o.id} className="theme-panel rounded-2xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-extrabold theme-accent-text">{o.orderNo}</span>
                                    <span className="theme-button-secondary rounded-full px-3 py-0.5 text-xs font-bold">
                                        {o.status}
                                    </span>
                                </div>
                                <p className="theme-muted text-xs">Supplier: {o.supplier?.profile?.businessName || "Direct Supplier"}</p>
                                <p className="text-sm font-extrabold mt-1">Total Amount: ₹{o.totalAmount}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Price Bargaining Modal for Restaurant Owner */}
            {showBargainModal && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center theme-modal-backdrop p-4">
                    <div className="theme-modal w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b theme-border pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Handshake size={20} className="theme-accent-text" />
                                Negotiate Bulk Price with Supplier
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowBargainModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSendBargainOffer} className="space-y-3">
                            <div className="p-3 rounded-2xl theme-card border text-xs space-y-1">
                                <p className="font-bold text-white text-sm">{selectedProduct.name}</p>
                                <p className="theme-muted">Supplier: {selectedProduct.supplier?.profile?.businessName || "Verified Supplier"}</p>
                                <p className="theme-muted">Catalog Listed Base Price: <strong className="text-white">₹{selectedProduct.prices?.[0]?.basePrice || 100} / {selectedProduct.unit}</strong></p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1">Bulk Quantity ({selectedProduct.unit})</label>
                                    <input
                                        type="number"
                                        value={bargainForm.quantity}
                                        onChange={(e) => setBargainForm({ ...bargainForm, quantity: e.target.value })}
                                        required
                                        className="w-full rounded-xl theme-input px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1">Your Offered Price / {selectedProduct.unit} (₹)</label>
                                    <input
                                        type="number"
                                        value={bargainForm.offeredPrice}
                                        onChange={(e) => setBargainForm({ ...bargainForm, offeredPrice: e.target.value })}
                                        required
                                        className="w-full rounded-xl theme-input px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-black py-3 text-xs font-extrabold transition cursor-pointer shadow-md mt-2"
                            >
                                Send Bargain Offer to Supplier
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Cart Modal */}
            {showCartModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center theme-modal-backdrop p-4">
                    <div className="theme-modal w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b theme-border pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <ShoppingCart size={20} className="theme-accent-text" />
                                Your Supply Cart
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowCartModal(false)}
                                className="theme-muted hover:opacity-80"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {cart.items?.length === 0 ? (
                            <p className="text-center theme-muted py-8 text-sm font-medium">Your supply cart is empty.</p>
                        ) : (
                            <div className="space-y-3">
                                {cart.items?.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between border-b theme-border pb-3">
                                        <div>
                                            <p className="font-bold text-sm">{item.product?.name}</p>
                                            <p className="text-xs theme-muted">₹{item.unitPrice} / {item.product?.unit}</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateCartItem(item.id, Math.max(1, item.quantity - 1))}
                                                className="rounded-lg theme-button-secondary p-1"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span className="text-sm font-bold px-1">{item.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateCartItem(item.id, item.quantity + 1)}
                                                className="rounded-lg theme-button-secondary p-1"
                                            >
                                                <Plus size={14} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCartItem(item.id)}
                                                className="text-red-500 hover:text-red-400 ml-2 text-xs font-bold"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div className="flex items-center justify-between border-t theme-border pt-3">
                                    <span className="font-bold text-base">Total Order Cost</span>
                                    <span className="font-black theme-accent-text text-xl">₹{cart.cartTotal || 0}</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleCheckoutOrder}
                                    className="theme-button w-full rounded-xl py-3 font-extrabold transition shadow-md cursor-pointer mt-2"
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
