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
    Package,
    Filter,
    SlidersHorizontal,
    Building2,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { SUPPLY_CATEGORIES } from "../../utils/supplyCategories";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

const getSupplyProductImageUrl = (item) => {
    if (!item) return "";
    let raw = "";
    if (typeof item.primaryImage === "string" && item.primaryImage.trim()) raw = item.primaryImage.trim();
    else if (typeof item.imageUrl === "string" && item.imageUrl.trim()) raw = item.imageUrl.trim();
    else if (typeof item.image === "string" && item.image.trim()) raw = item.image.trim();
    else if (Array.isArray(item.images) && item.images.length > 0) {
        const first = item.images[0];
        if (typeof first === "string" && first.trim()) raw = first.trim();
        else if (first && typeof first.imageUrl === "string" && first.imageUrl.trim()) raw = first.imageUrl.trim();
        else if (first && typeof first.url === "string" && first.url.trim()) raw = first.url.trim();
    }

    const resolved = resolveImageUrl(raw);
    if (resolved) return resolved;

    const name = String(item.name || "").toLowerCase();
    const cat = String(item.category?.name || item.categoryName || item.category || "").toLowerCase();

    if (name.includes("chicken") || name.includes("checken") || name.includes("poultry") || name.includes("meat") || cat.includes("meat")) {
        return "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("water") || name.includes("bottle") || name.includes("beverage") || cat.includes("beverage")) {
        return "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("produce") || name.includes("vegetable") || name.includes("fruit") || name.includes("tomato") || name.includes("onion")) {
        return "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("dairy") || name.includes("milk") || name.includes("cheese") || name.includes("butter") || name.includes("paneer")) {
        return "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("spice") || cat.includes("sauce") || name.includes("chili") || name.includes("pepper") || name.includes("sauce")) {
        return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("bakery") || name.includes("flour") || name.includes("bread") || name.includes("bun")) {
        return "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("oil") || name.includes("oil") || name.includes("ghee")) {
        return "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("packaging") || cat.includes("disposable") || name.includes("box") || name.includes("container") || name.includes("cup")) {
        return "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80";
    }

    return "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80";
};


export default function OwnerSupplyMarketplace() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState({ items: [], cartTotal: 0 });
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("browse");
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All Categories");
    const [selectedSupplier, setSelectedSupplier] = useState("All Suppliers");
    const [sortBy, setSortBy] = useState("default");
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
            const errorMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to send bargain offer";
            showToast(errorMsg, { type: "error" });
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

            {/* Search + Categories Bar + Filter Controls */}
            {activeTab === "browse" && (
                <div className="theme-panel rounded-3xl p-5 border shadow-sm space-y-4">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                        {/* Search Input Bar */}
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 theme-muted" />
                            <input
                                type="text"
                                placeholder="Search products, suppliers (e.g. SocialSea), categories..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full rounded-2xl theme-input pl-11 pr-10 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#f5b94e]"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 theme-muted hover:text-white cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* SELECT CATEGORY OPTION SELECTOR DROPDOWN */}
                            <div className="flex items-center gap-2">
                                <Tag size={16} className="theme-accent-text" />
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="theme-input rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#f5b94e] cursor-pointer"
                                >
                                    <option value="All Categories">📦 Select Category (All Categories - {products.length})</option>
                                    {SUPPLY_CATEGORIES.map((cat) => {
                                        const count = products.filter((p) => {
                                            const target = cat.name.trim().toLowerCase();
                                            const pCatName = String(p.category?.name || p.categoryName || p.category || "").trim().toLowerCase();
                                            return pCatName === target || (pCatName && (pCatName.includes(target) || target.includes(pCatName)));
                                        }).length;
                                        return (
                                            <option key={cat.id} value={cat.name}>
                                                {cat.name} ({count})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* FILTER BY SUPPLIER DROPDOWN */}
                            <div className="flex items-center gap-2">
                                <Building2 size={16} className="theme-muted" />
                                <select
                                    value={selectedSupplier}
                                    onChange={(e) => setSelectedSupplier(e.target.value)}
                                    className="theme-input rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#f5b94e] cursor-pointer"
                                >
                                    <option value="All Suppliers">🏢 All Suppliers</option>
                                    {Array.from(
                                        new Set(
                                            products
                                                .map((p) => p.supplierName || p.supplier?.profile?.businessName || p.supplier?.businessName)
                                                .filter(Boolean)
                                        )
                                    ).map((sName) => (
                                        <option key={sName} value={sName}>
                                            {sName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* SORT BY DROPDOWN */}
                            <div className="flex items-center gap-2">
                                <Filter size={16} className="theme-muted" />
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="theme-input rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#f5b94e] cursor-pointer"
                                >
                                    <option value="default">Sort: Recommended</option>
                                    <option value="price_low_high">Price: Low to High</option>
                                    <option value="price_high_low">Price: High to Low</option>
                                    <option value="name_asc">Name: A to Z</option>
                                </select>
                            </div>

                            {/* Reset Filters Button */}
                            {(search || selectedCategory !== "All Categories" || selectedSupplier !== "All Suppliers" || sortBy !== "default") && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch("");
                                        setSelectedCategory("All Categories");
                                        setSelectedSupplier("All Suppliers");
                                        setSortBy("default");
                                    }}
                                    className="rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3.5 py-2.5 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                                >
                                    <X size={14} /> Clear Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* CATEGORY SELECTOR PILLS BAR */}
                    <div className="pt-2 border-t theme-border">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                            <span className="text-[11px] font-extrabold theme-muted uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1">
                                <SlidersHorizontal size={13} /> Select Category:
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedCategory("All Categories")}
                                className={`rounded-xl px-4 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                                    selectedCategory === "All Categories"
                                        ? "theme-button shadow-md font-extrabold"
                                        : "theme-button-secondary"
                                }`}
                            >
                                ✨ All ({products.length})
                            </button>
                            {SUPPLY_CATEGORIES.map((cat) => {
                                const count = products.filter((p) => {
                                    const target = cat.name.trim().toLowerCase();
                                    const pCatName = String(p.category?.name || p.categoryName || p.category || "").trim().toLowerCase();
                                    return pCatName === target || (pCatName && (pCatName.includes(target) || target.includes(pCatName)));
                                }).length;

                                const isSelected = selectedCategory === cat.name;

                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.name)}
                                        className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                                            isSelected
                                                ? "theme-button shadow-md font-extrabold"
                                                : count > 0
                                                ? "border theme-border theme-soft-button theme-accent-text"
                                                : "theme-button-secondary"
                                        }`}
                                    >
                                        <span>{cat.icon}</span>
                                        <span>{cat.name}</span>
                                        {count > 0 && (
                                            <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-black ${isSelected ? "bg-black/30 text-white" : "bg-amber-500 text-black"}`}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Browse Grid */}
            {activeTab === "browse" && (() => {
                const filtered = products
                    .filter((p) => {
                        if (search.trim()) {
                            const query = search.toLowerCase();
                            const pName = String(p.name || "").toLowerCase();
                            const pDesc = String(p.description || "").toLowerCase();
                            const pSupplier = String(p.supplierName || p.supplier?.profile?.businessName || p.supplier?.businessName || "").toLowerCase();
                            const pCat = String(p.category?.name || p.categoryName || p.category || "").toLowerCase();
                            if (!pName.includes(query) && !pDesc.includes(query) && !pSupplier.includes(query) && !pCat.includes(query)) {
                                return false;
                            }
                        }

                        if (selectedCategory !== "All Categories") {
                            const target = selectedCategory.trim().toLowerCase();
                            const pCatName = String(p.category?.name || p.categoryName || p.category || "").trim().toLowerCase();
                            const pCatSlug = String(p.category?.slug || "").trim().toLowerCase();
                            if (pCatName !== target && pCatSlug !== target && !pCatName.includes(target) && !target.includes(pCatName)) {
                                return false;
                            }
                        }

                        if (selectedSupplier !== "All Suppliers") {
                            const targetSupp = selectedSupplier.trim().toLowerCase();
                            const pSuppName = String(p.supplierName || p.supplier?.profile?.businessName || p.supplier?.businessName || "").trim().toLowerCase();
                            if (pSuppName !== targetSupp && !pSuppName.includes(targetSupp)) {
                                return false;
                            }
                        }

                        return true;
                    })
                    .sort((a, b) => {
                        const priceA = Number(a.prices?.[0]?.basePrice || a.basePrice || a.finalPrice || 0);
                        const priceB = Number(b.prices?.[0]?.basePrice || b.basePrice || b.finalPrice || 0);
                        if (sortBy === "price_low_high") return priceA - priceB;
                        if (sortBy === "price_high_low") return priceB - priceA;
                        if (sortBy === "name_asc") return String(a.name || "").localeCompare(String(b.name || ""));
                        return 0;
                    });

                if (filtered.length === 0) {
                    return (
                        <div className="theme-panel rounded-3xl border p-10 text-center space-y-4 shadow-xl my-4">
                            <Package size={44} className="mx-auto theme-accent-text opacity-80" />
                            <div>
                                <h3 className="text-base font-bold">No products match your filters</h3>
                                <p className="theme-muted text-xs mt-1 max-w-md mx-auto">
                                    {selectedCategory === "All Categories" && selectedSupplier === "All Suppliers"
                                        ? "No supply products found matching your search term."
                                        : `No products found under category "${selectedCategory}" for supplier "${selectedSupplier}". Click below to reset.`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setSelectedCategory("All Categories"); setSelectedSupplier("All Suppliers"); setSearch(""); setSortBy("default"); }}
                                className="theme-button rounded-xl px-5 py-2.5 text-xs font-extrabold transition shadow-md cursor-pointer inline-flex items-center gap-1.5"
                            >
                                ✨ Reset All Filters ({products.length} Products Available)
                            </button>
                        </div>
                    );
                }

                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map((p) => {
                            const imgUrl = getSupplyProductImageUrl(p);
                            const displaySupplierName = p.supplierName || p.supplier?.profile?.businessName || p.supplier?.businessName || "SocialSea";
                            const displayPrice = p.prices?.[0]?.basePrice || p.basePrice || p.finalPrice || 100;

                            return (
                                <div key={p.id} className="theme-panel rounded-2xl border p-4 space-y-3 shadow-md hover:border-[#f5b94e]/40 transition">
                                    <div className="h-44 w-full rounded-xl overflow-hidden border theme-border bg-black/10 shadow-inner relative flex items-center justify-center">
                                        {imgUrl ? (
                                            <img
                                                src={imgUrl}
                                                alt={p.name}
                                                className="h-full w-full object-cover hover:scale-105 transition duration-300"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80";
                                                }}
                                            />
                                        ) : (
                                            <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-amber-500/10 theme-muted">
                                                <Package size={36} className="theme-accent-text mb-1 opacity-80" />
                                                <span className="text-[11px] font-bold uppercase tracking-wider">{p.category?.name || p.category || "Raw Supply"}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h3 className="font-bold text-base leading-snug">{p.name}</h3>
                                            <p className="text-xs mt-1.5 flex items-center gap-1.5 flex-wrap">
                                                <span className="theme-muted font-medium">Supplier:</span>
                                                <span className="font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 inline-flex items-center gap-1 text-[11px]">
                                                    <Building2 size={12} />
                                                    {displaySupplierName}
                                                </span>
                                            </p>
                                        </div>
                                        <span className="theme-button-secondary rounded-full px-3 py-1 text-xs font-black whitespace-nowrap">
                                            ₹{displayPrice} / {p.unit}
                                        </span>
                                    </div>

                                    <div className="text-xs space-y-1 theme-muted border-t theme-border pt-3">
                                        <p>Min Order Qty (MOQ): <span className="font-bold text-white">{p.moq} {p.unit}</span></p>
                                        <p>Available Stock: <span className="font-bold theme-accent-text">{p.inventory?.availableStock || p.availableStock || 250} {p.unit}</span></p>
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
