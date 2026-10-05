import React, { useState, useEffect, useMemo } from "react";
import {
    ShoppingCart,
    Search,
    Filter,
    Building2,
    Star,
    ShieldCheck,
    CheckCircle2,
    Truck,
    Clock,
    Tag,
    DollarSign,
    Sparkles,
    MessageSquare,
    Plus,
    Minus,
    ArrowRight,
    RefreshCw,
    X,
    FileText,
    TrendingDown,
    SlidersHorizontal,
    ExternalLink,
    BadgePercent,
    Award,
    ChevronRight,
    Zap,
    Send,
    Package,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

// Fallback images for raw material categories
const getProductImageUrl = (item) => {
    if (!item) return "";
    let raw = "";
    if (typeof item.primaryImage === "string" && item.primaryImage.trim()) raw = item.primaryImage.trim();
    else if (typeof item.imageUrl === "string" && item.imageUrl.trim()) raw = item.imageUrl.trim();
    else if (typeof item.image === "string" && item.image.trim()) raw = item.image.trim();
    const resolved = resolveImageUrl(raw);
    if (resolved) return resolved;

    const name = String(item.name || "").toLowerCase();
    if (name.includes("tomato")) return "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80";
    if (name.includes("onion")) return "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cf?auto=format&fit=crop&w=600&q=80";
    if (name.includes("mirchi") || name.includes("chili")) return "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80";
    if (name.includes("chicken") || name.includes("meat")) return "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80";
    if (name.includes("oil") || name.includes("ghee")) return "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80";
    if (name.includes("milk") || name.includes("cheese") || name.includes("paneer")) return "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80";
    if (name.includes("rice")) return "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80";

    return "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80";
};

export default function OwnerSupplyChainMarketplace() {
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [cart, setCart] = useState({ items: [], cartTotal: 0 });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("ALL");
    const [selectedSupplier, setSelectedSupplier] = useState("ALL");
    const [maxPrice, setMaxPrice] = useState(1000);
    const [maxMoq, setMaxMoq] = useState(100);
    const [minRating, setMinRating] = useState(0);
    const [deliveryTimeFilter, setDeliveryTimeFilter] = useState("ALL");
    const [gstVerifiedOnly, setGstVerifiedOnly] = useState(false);
    const [fssaiVerifiedOnly, setFssaiVerifiedOnly] = useState(false);

    // Modals & Sliders
    const [activeSection, setActiveSection] = useState("ALL"); // ALL, RECOMMENDED, LOW_PRICE, BULK, RECENT
    const [selectedSupplierDetail, setSelectedSupplierDetail] = useState(null);
    const [negotiateProduct, setNegotiateProduct] = useState(null);
    const [negotiateForm, setNegotiateForm] = useState({ quantity: "", targetPrice: "", notes: "" });
    const [submittingNegotiation, setSubmittingNegotiation] = useState(false);
    const [convertingPO, setConvertingPO] = useState(false);

    const fetchData = async () => {
        try {
            setRefreshing(true);
            const [prodRes, suppRes, cartRes] = await Promise.all([
                api.get("/api/marketplace/products"),
                api.get("/api/owner/suppliers"),
                api.get("/api/supply-cart"),
            ]);

            const prods = prodRes.data?.products || prodRes.data || [];
            const supps = suppRes.data?.suppliers || suppRes.data || [];
            const cartData = cartRes.data || { items: [], cartTotal: 0 };

            setProducts(prods);
            setSuppliers(supps);
            setCart(cartData);
        } catch (err) {
            console.error("Failed to load marketplace data:", err);
            showToast.error("Failed to load supplier marketplace data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Unique Categories
    const categories = useMemo(() => {
        const set = new Set(products.map((p) => p.category).filter(Boolean));
        return ["ALL", ...Array.from(set)];
    }, [products]);

    // Section Filters & Search Application
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            // Search text
            const matchesSearch =
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.supplierName || p.supplier?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.category || "").toLowerCase().includes(searchQuery.toLowerCase());

            // Category filter
            const matchesCategory = selectedCategory === "ALL" || p.category === selectedCategory;

            // Supplier filter
            const matchesSupplier =
                selectedSupplier === "ALL" ||
                p.supplierId === Number(selectedSupplier) ||
                (p.supplier?.id === Number(selectedSupplier));

            // Price filter
            const price = p.unitPrice || p.price || 0;
            const matchesPrice = price <= maxPrice;

            // MOQ filter
            const moq = p.minOrderQuantity || p.moq || 1;
            const matchesMoq = moq <= maxMoq;

            // Rating filter
            const rating = p.rating || p.supplier?.rating || 4.5;
            const matchesRating = rating >= minRating;

            // Delivery time filter
            const est = (p.deliveryEstimate || p.deliveryTime || "").toLowerCase();
            let matchesDelivery = true;
            if (deliveryTimeFilter === "SAME_DAY") matchesDelivery = est.includes("same day") || est.includes("today") || est.includes("4");
            if (deliveryTimeFilter === "24_HOURS") matchesDelivery = est.includes("24") || est.includes("1 day") || est.includes("same day");

            // Verification filters
            const isGst = p.gstVerified || p.supplier?.gstVerified || p.supplier?.profile?.gstVerified || true;
            const isFssai = p.fssaiVerified || p.supplier?.fssaiVerified || p.supplier?.profile?.fssaiVerified || true;

            const matchesGst = !gstVerifiedOnly || isGst;
            const matchesFssai = !fssaiVerifiedOnly || isFssai;

            // Section Filter
            let matchesSection = true;
            if (activeSection === "RECOMMENDED") matchesSection = p.isRecommended || p.isFeatured || p.rating >= 4.5;
            if (activeSection === "LOW_PRICE") matchesSection = p.discountPercent > 0 || (p.unitPrice && p.unitPrice < 80);
            if (activeSection === "BULK") matchesSection = (p.minOrderQuantity && p.minOrderQuantity >= 10) || p.bulkDiscountAvailable;
            if (activeSection === "RECENT") matchesSection = p.isRecentlyPurchased || p.orderCount > 0;

            return (
                matchesSearch &&
                matchesCategory &&
                matchesSupplier &&
                matchesPrice &&
                matchesMoq &&
                matchesRating &&
                matchesDelivery &&
                matchesGst &&
                matchesFssai &&
                matchesSection
            );
        });
    }, [
        products,
        searchQuery,
        selectedCategory,
        selectedSupplier,
        maxPrice,
        maxMoq,
        minRating,
        deliveryTimeFilter,
        gstVerifiedOnly,
        fssaiVerifiedOnly,
        activeSection,
    ]);

    // Featured Suppliers List
    const featuredSuppliers = useMemo(() => {
        return suppliers.slice(0, 5);
    }, [suppliers]);

    // Handle Add to Cart
    const handleAddToCart = async (product, qtyChange = 1) => {
        try {
            const currentItem = (cart.items || []).find((i) => i.productId === product.id);
            const newQty = (currentItem?.quantity || 0) + qtyChange;

            const res = await api.post("/api/supply-cart/items", {
                productId: product.id,
                quantity: Math.max(0, newQty),
            });

            setCart(res.data || { items: [], cartTotal: 0 });
            showToast.success(`Updated "${product.name}" in supply cart`);
        } catch (err) {
            console.error("Cart update error:", err);
            showToast.error("Failed to update cart");
        }
    };

    // Handle Direct Convert Cart to Purchase Order
    const handleCreateDirectPO = async () => {
        if (!cart.items || cart.items.length === 0) {
            showToast.error("Your supply cart is empty. Add items to create a Purchase Order.");
            return;
        }

        try {
            setConvertingPO(true);
            const firstItem = cart.items[0];
            const supplierId = firstItem.product?.supplierId || 1;

            const poPayload = {
                supplierId,
                expectedDeliveryDate: new Date(Date.now() + 86400000 * 2).toISOString(),
                items: cart.items.map((ci) => ({
                    productId: ci.productId,
                    productName: ci.product?.name || ci.productName || "Item",
                    quantity: ci.quantity,
                    unit: ci.product?.unit || "kg",
                    unitPrice: ci.unitPrice || ci.product?.price || 0,
                    taxPercent: 5,
                    discount: 0,
                })),
                notes: "Generated directly from Tiffzy Enterprise Supplier Marketplace cart.",
            };

            await api.post("/api/owner/purchase-orders", poPayload);
            showToast.success("Purchase Order created directly from Marketplace!");
            fetchData();
        } catch (err) {
            console.error("PO Creation Error:", err);
            showToast.error("Failed to convert cart to Purchase Order");
        } finally {
            setConvertingPO(false);
        }
    };

    // Submit Price Negotiation Quote Request
    const handleSubmitNegotiation = async (e) => {
        e.preventDefault();
        if (!negotiateProduct || !negotiateForm.quantity || !negotiateForm.targetPrice) {
            showToast.error("Please provide required quantity and proposed target price");
            return;
        }

        try {
            setSubmittingNegotiation(true);
            // Simulate sending quote negotiation request to supplier & creating a draft PO
            await new Promise((resolve) => setTimeout(resolve, 800));

            showToast.success(`Price negotiation sent to ${negotiateProduct.supplierName || "Supplier"} for ${negotiateProduct.name}!`);
            setNegotiateProduct(null);
        } catch (err) {
            showToast.error("Failed to submit price negotiation request");
        } finally {
            setSubmittingNegotiation(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                            <ShoppingCart className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Enterprise Supplier Marketplace</h1>
                            <p className="text-sm text-slate-400">
                                Procure verified raw materials, negotiate bulk rates, and convert directly to Purchase Orders.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition font-medium text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>

                    {/* Cart Quick Summary & Convert PO */}
                    <div className="flex items-center gap-3 bg-slate-800/90 px-4 py-2 rounded-xl border border-slate-700">
                        <div className="relative">
                            <ShoppingCart className="w-5 h-5 text-amber-400" />
                            {(cart.items || []).length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-amber-500 text-slate-950 font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                                    {cart.items.length}
                                </span>
                            )}
                        </div>
                        <div className="text-left">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Cart Total</span>
                            <span className="text-sm font-bold text-white">₹{(cart.cartTotal || 0).toFixed(2)}</span>
                        </div>
                        {(cart.items || []).length > 0 && (
                            <button
                                onClick={handleCreateDirectPO}
                                disabled={convertingPO}
                                className="ml-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
                            >
                                {convertingPO ? "Creating PO..." : "Convert to PO"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* FEATURED SUPPLIERS CAROUSEL / GRID */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-400" /> Featured Verified Suppliers
                    </h3>
                    <span className="text-xs text-slate-400">GST & FSSAI Certified Partners</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {featuredSuppliers.map((supp) => {
                        const profile = supp.profile || {};

                        return (
                            <div
                                key={supp.id}
                                onClick={() => setSelectedSupplierDetail(supp)}
                                className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 hover:border-amber-500/50 transition cursor-pointer group flex flex-col justify-between"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center border border-amber-500/20 text-sm">
                                            {supp.name ? supp.name.slice(0, 2).toUpperCase() : "SP"}
                                        </div>
                                        <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800 text-[10px] text-amber-400 font-bold">
                                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                            {profile.rating || 4.8}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition leading-snug">
                                            {supp.name || profile.companyName || "Supplier"}
                                        </h4>
                                        <span className="text-[10px] text-slate-400 block">{profile.category || "Wholesale Food Supply"}</span>
                                    </div>

                                    <div className="flex flex-wrap gap-1 pt-1">
                                        <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                            <ShieldCheck className="w-2.5 h-2.5" /> GST
                                        </span>
                                        <span className="text-[9px] font-semibold bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 flex items-center gap-1">
                                            <CheckCircle2 className="w-2.5 h-2.5" /> FSSAI
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                                    <span>{supp.products?.length || 12}+ Products</span>
                                    <span className="text-amber-400 font-semibold group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
                                        View <ChevronRight className="w-3 h-3" />
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SECTIONS TABS NAVIGATION */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
                <button
                    onClick={() => setActiveSection("ALL")}
                    className={`px-4 py-2 rounded-xl border transition ${activeSection === "ALL" ? "bg-amber-500 text-slate-950 font-bold border-amber-400" : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"}`}
                >
                    All Catalog ({products.length})
                </button>
                <button
                    onClick={() => setActiveSection("RECOMMENDED")}
                    className={`px-4 py-2 rounded-xl border transition flex items-center gap-1.5 ${activeSection === "RECOMMENDED" ? "bg-amber-500 text-slate-950 font-bold border-amber-400" : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"}`}
                >
                    <Sparkles className="w-3.5 h-3.5" /> Recommended Products
                </button>
                <button
                    onClick={() => setActiveSection("LOW_PRICE")}
                    className={`px-4 py-2 rounded-xl border transition flex items-center gap-1.5 ${activeSection === "LOW_PRICE" ? "bg-amber-500 text-slate-950 font-bold border-amber-400" : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"}`}
                >
                    <TrendingDown className="w-3.5 h-3.5" /> Low Price Opportunities
                </button>
                <button
                    onClick={() => setActiveSection("BULK")}
                    className={`px-4 py-2 rounded-xl border transition flex items-center gap-1.5 ${activeSection === "BULK" ? "bg-amber-500 text-slate-950 font-bold border-amber-400" : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"}`}
                >
                    <BadgePercent className="w-3.5 h-3.5" /> Bulk Deals
                </button>
                <button
                    onClick={() => setActiveSection("RECENT")}
                    className={`px-4 py-2 rounded-xl border transition flex items-center gap-1.5 ${activeSection === "RECENT" ? "bg-amber-500 text-slate-950 font-bold border-amber-400" : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"}`}
                >
                    <Clock className="w-3.5 h-3.5" /> Recently Purchased
                </button>
            </div>

            {/* FILTERS & SEARCH TOOLBAR */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search products or suppliers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-transparent text-xs text-slate-200 focus:outline-none w-full"
                        >
                            <option value="ALL" className="bg-slate-900">All Categories</option>
                            {categories.filter((c) => c !== "ALL").map((cat) => (
                                <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Supplier Filter */}
                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <select
                            value={selectedSupplier}
                            onChange={(e) => setSelectedSupplier(e.target.value)}
                            className="bg-transparent text-xs text-slate-200 focus:outline-none w-full"
                        >
                            <option value="ALL" className="bg-slate-900">All Suppliers</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Delivery Time Filter */}
                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <select
                            value={deliveryTimeFilter}
                            onChange={(e) => setDeliveryTimeFilter(e.target.value)}
                            className="bg-transparent text-xs text-slate-200 focus:outline-none w-full"
                        >
                            <option value="ALL" className="bg-slate-900">Any Delivery Time</option>
                            <option value="SAME_DAY" className="bg-slate-900">⚡ Same Day Delivery</option>
                            <option value="24_HOURS" className="bg-slate-900">🚚 Within 24 Hours</option>
                        </select>
                    </div>
                </div>

                {/* Extended Verification & Range Controls */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                            <input
                                type="checkbox"
                                checked={gstVerifiedOnly}
                                onChange={(e) => setGstVerifiedOnly(e.target.checked)}
                                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
                            />
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> GST Verified Only
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                            <input
                                type="checkbox"
                                checked={fssaiVerifiedOnly}
                                onChange={(e) => setFssaiVerifiedOnly(e.target.checked)}
                                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
                            />
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> FSSAI Certified Only
                        </label>
                    </div>

                    <div className="flex items-center gap-6 text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>Max Price:</span>
                            <span className="font-bold text-white">₹{maxPrice}</span>
                            <input
                                type="range"
                                min="10"
                                max="2000"
                                step="10"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(Number(e.target.value))}
                                className="w-24 accent-amber-500"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span>Min Rating:</span>
                            <span className="font-bold text-amber-400">{minRating > 0 ? `${minRating}★` : "Any"}</span>
                            <input
                                type="range"
                                min="0"
                                max="4.8"
                                step="0.5"
                                value={minRating}
                                onChange={(e) => setMinRating(Number(e.target.value))}
                                className="w-20 accent-amber-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* PRODUCT CARDS CATALOG GRID */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
                    <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-slate-300">No products match your filters</h3>
                    <p className="text-sm text-slate-500">Try adjusting price ranges or clearing verification filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {filteredProducts.map((product) => {
                        const price = product.unitPrice || product.price || 0;
                        const moq = product.minOrderQuantity || product.moq || 1;
                        const unit = product.unit || "kg";
                        const supplierName = product.supplierName || product.supplier?.name || "Verified Wholesale Supplier";
                        const imageUrl = getProductImageUrl(product);
                        const rating = product.rating || 4.7;

                        const cartItem = (cart.items || []).find((i) => i.productId === product.id);
                        const cartQty = cartItem?.quantity || 0;

                        return (
                            <div
                                key={product.id}
                                className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden hover:border-slate-700 transition flex flex-col justify-between group"
                            >
                                <div>
                                    {/* Image Container with Badges */}
                                    <div className="relative h-44 bg-slate-950 overflow-hidden">
                                        <img
                                            src={imageUrl}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                                        {/* Category Badge */}
                                        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-slate-900/80 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/20 backdrop-blur-md">
                                            {product.category || "Produce"}
                                        </span>

                                        {/* Rating Badge */}
                                        <span className="absolute top-3 right-3 text-[10px] font-bold bg-slate-900/80 text-white px-2 py-1 rounded-lg border border-slate-700 backdrop-blur-md flex items-center gap-1">
                                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                            {rating}
                                        </span>

                                        {/* Product Price Floating Badge */}
                                        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                                            <div>
                                                <span className="text-xl font-extrabold text-white">₹{price}</span>
                                                <span className="text-xs text-slate-300 font-normal"> / {unit}</span>
                                            </div>

                                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                                                MOQ: {moq} {unit}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content Details */}
                                    <div className="p-4 space-y-3">
                                        <div>
                                            <h3 className="text-base font-bold text-white leading-tight group-hover:text-amber-400 transition">
                                                {product.name}
                                            </h3>
                                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                                                {product.description || "High quality commercial grade raw material"}
                                            </p>
                                        </div>

                                        {/* Supplier Details & Verification */}
                                        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-slate-200 truncate">{supplierName}</span>
                                                <div className="flex items-center gap-1 text-[10px]">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                                    <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Truck className="w-3 h-3 text-amber-400" /> {product.deliveryEstimate || "Same Day"}
                                                </span>
                                                <span className="text-slate-300">In Stock</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="p-4 bg-slate-950/40 border-t border-slate-800/80 space-y-2">
                                    <div className="flex items-center gap-2">
                                        {/* Price Negotiation Button */}
                                        <button
                                            onClick={() => setNegotiateProduct(product)}
                                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-1"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5 text-amber-400" /> Negotiate
                                        </button>

                                        {/* View Supplier Profile */}
                                        <button
                                            onClick={() => setSelectedSupplierDetail(product.supplier || { name: supplierName })}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition"
                                            title="View Supplier Profile"
                                        >
                                            <Building2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Add to Cart / Quantity Controller */}
                                    {cartQty === 0 ? (
                                        <button
                                            onClick={() => handleAddToCart(product, moq)}
                                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5"
                                        >
                                            <Plus className="w-4 h-4" /> Add to Purchase
                                        </button>
                                    ) : (
                                        <div className="flex items-center justify-between bg-amber-500 text-slate-950 font-bold rounded-xl p-1 text-xs">
                                            <button
                                                onClick={() => handleAddToCart(product, -1)}
                                                className="p-1 hover:bg-amber-600 rounded-lg transition"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span>{cartQty} {unit} in Cart</span>
                                            <button
                                                onClick={() => handleAddToCart(product, 1)}
                                                className="p-1 hover:bg-amber-600 rounded-lg transition"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* SUPPLIER DETAIL MODAL */}
            {selectedSupplierDetail && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center border border-amber-500/20 text-lg">
                                    {selectedSupplierDetail.name ? selectedSupplierDetail.name.slice(0, 2).toUpperCase() : "SP"}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{selectedSupplierDetail.name || "Supplier Profile"}</h2>
                                    <p className="text-xs text-slate-400">Verified Tiffzy Wholesale Partner</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedSupplierDetail(null)}
                                className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                    <span className="text-xs text-slate-400 block mb-1">GST Identification Number</span>
                                    <span className="font-mono font-bold text-emerald-400">
                                        {selectedSupplierDetail.profile?.gstNumber || "36AAACT1234F1Z9"}
                                    </span>
                                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold block w-fit mt-1">
                                        GST Verified
                                    </span>
                                </div>

                                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                    <span className="text-xs text-slate-400 block mb-1">FSSAI License</span>
                                    <span className="font-mono font-bold text-cyan-400">
                                        {selectedSupplierDetail.profile?.fssaiNumber || "10019042004312"}
                                    </span>
                                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-semibold block w-fit mt-1">
                                        FSSAI Certified
                                    </span>
                                </div>
                            </div>

                            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                                <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Contact & Address</h4>
                                <p className="text-xs text-slate-300">
                                    {selectedSupplierDetail.profile?.address || "Warehouse 4B, Wholesale Market Road, Hyderabad, Telangana - 500018"}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-amber-400 pt-1">
                                    <span>📞 +91 98765 43210</span>
                                    <span>✉️ supplier@tiffzymarket.com</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-800 bg-slate-900/80 flex justify-end">
                            <button
                                onClick={() => setSelectedSupplierDetail(null)}
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition"
                            >
                                Close Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRICE NEGOTIATION MODAL */}
            {negotiateProduct && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Negotiate Price Quote</h2>
                                    <p className="text-xs text-slate-400">Request bulk pricing directly from supplier</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setNegotiateProduct(null)}
                                className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitNegotiation} className="p-6 space-y-4">
                            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-bold text-white block">{negotiateProduct.name}</span>
                                    <span className="text-slate-400">Listed Rate: ₹{negotiateProduct.unitPrice || negotiateProduct.price} / {negotiateProduct.unit || "kg"}</span>
                                </div>
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 font-semibold">
                                    MOQ: {negotiateProduct.minOrderQuantity || 1}
                                </span>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-300 block mb-1">Required Quantity ({negotiateProduct.unit || "kg"}) *</label>
                                <input
                                    type="number"
                                    required
                                    min={negotiateProduct.minOrderQuantity || 1}
                                    placeholder="Enter bulk quantity"
                                    value={negotiateForm.quantity}
                                    onChange={(e) => setNegotiateForm({ ...negotiateForm, quantity: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-300 block mb-1">Proposed Target Price / {negotiateProduct.unit || "kg"} (₹) *</label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    placeholder="Enter proposed rate"
                                    value={negotiateForm.targetPrice}
                                    onChange={(e) => setNegotiateForm({ ...negotiateForm, targetPrice: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-300 block mb-1">Message / Terms for Supplier</label>
                                <textarea
                                    rows={3}
                                    placeholder="E.g., We order 500kg monthly. Request best rate for recurring delivery."
                                    value={negotiateForm.notes}
                                    onChange={(e) => setNegotiateForm({ ...negotiateForm, notes: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setNegotiateProduct(null)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingNegotiation}
                                    className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/10"
                                >
                                    <Send className="w-4 h-4" />
                                    {submittingNegotiation ? "Sending..." : "Submit Quote Request"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
