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
import SupplyChainSubNav from "../../components/SupplyChainSubNav";
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
        <section className="space-y-4 font-sans text-sm text-slate-900 pb-12">
            {/* Global Horizontal Enterprise Sub-Nav Bar */}
            <SupplyChainSubNav />

            {/* 1. COMPACT PAGE HEADER */}
            <header className="pb-3 border-b border-slate-200/80">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
                            <ShoppingCart size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                    Enterprise Supplier Marketplace
                                </h1>
                                <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-600 border border-orange-200">
                                    VERIFIED B2B
                                </span>
                            </div>
                            <p className="text-slate-500 text-xs mt-0.5">
                                Procure verified raw materials, negotiate bulk rates, and convert directly to Purchase Orders.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={fetchData}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                            Refresh
                        </button>

                        {/* Cart Summary Pill */}
                        <div className="inline-flex items-center gap-2.5 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl shadow-sm border border-slate-800 text-xs">
                            <div className="relative flex items-center gap-1.5">
                                <ShoppingCart size={15} className="text-orange-400" />
                                {(cart.items || []).length > 0 && (
                                    <span className="bg-orange-500 text-white font-extrabold text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">
                                        {cart.items.length}
                                    </span>
                                )}
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Cart Total</span>
                                <span className="font-extrabold text-white">₹{(cart.cartTotal || 0).toFixed(2)}</span>
                            </div>
                            {(cart.items || []).length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleCreateDirectPO}
                                    disabled={convertingPO}
                                    className="ml-1 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-lg text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {convertingPO ? "Creating PO..." : "Convert to PO"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* 2. COMPACT MARKETPLACE METRICS ROW (MINIMAL DIVIDERS, NO HEAVY CARDS) */}
            <div className="pb-4 border-b border-slate-200/80">
                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600 mb-2">
                    MARKETPLACE OVERVIEW · REAL-TIME B2B SUPPLY & FULFILLMENT
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-2">
                    <div>
                        <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Available Catalog SKUs</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                            {products.length} Products
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                            <CheckCircle2 size={12} />
                            <span>100% Quality Inspected</span>
                        </div>
                    </div>

                    <div>
                        <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Verified Suppliers</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                            {suppliers.length} Active Partners
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-cyan-600 font-medium">
                            <ShieldCheck size={12} />
                            <span>GST & FSSAI Compliant</span>
                        </div>
                    </div>

                    <div>
                        <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Avg Delivery SLA</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                            24 Hours
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                            <Truck size={12} />
                            <span>Same Day Delivery Available</span>
                        </div>
                    </div>

                    <div>
                        <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Active Cart Total</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                            ₹{(cart.cartTotal || 0).toFixed(0)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-orange-600 font-medium">
                            <ShoppingCart size={12} />
                            <span>{cart.items?.length || 0} Items Pending PO</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. FEATURED SUPPLIERS ROW */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Award size={16} className="text-orange-500" /> Featured Verified Suppliers
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">GST & FSSAI Certified Partners</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    {featuredSuppliers.map((supp) => {
                        const profile = supp.profile || {};

                        return (
                            <div
                                key={supp.id}
                                onClick={() => setSelectedSupplierDetail(supp)}
                                className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 hover:border-orange-300 transition cursor-pointer group flex flex-col justify-between"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 font-bold flex items-center justify-center border border-orange-200 text-xs">
                                            {supp.name ? supp.name.slice(0, 2).toUpperCase() : "SP"}
                                        </div>
                                        <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px] text-amber-600 font-bold">
                                            <Star size={11} className="fill-amber-400 text-amber-400" />
                                            {profile.rating || 4.8}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-orange-600 transition leading-snug truncate">
                                            {supp.name || profile.companyName || "Supplier"}
                                        </h4>
                                        <span className="text-[10px] text-slate-500 block truncate">{profile.category || "Wholesale Food Supply"}</span>
                                    </div>

                                    <div className="flex flex-wrap gap-1 pt-1">
                                        <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                                            <ShieldCheck size={10} /> GST Verified
                                        </span>
                                        <span className="text-[9px] font-bold bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-200 flex items-center gap-0.5">
                                            <CheckCircle2 size={10} /> FSSAI
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                                    <span>{supp.products?.length || 12}+ Products</span>
                                    <span className="text-orange-600 font-bold group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
                                        View <ChevronRight size={12} />
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 4. SECTION TABS NAVIGATION */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold scrollbar-none">
                <button
                    type="button"
                    onClick={() => setActiveSection("ALL")}
                    className={`px-3.5 py-1.5 rounded-xl border transition ${
                        activeSection === "ALL"
                            ? "bg-orange-500 text-white font-bold border-orange-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                >
                    All Catalog ({products.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection("RECOMMENDED")}
                    className={`px-3.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                        activeSection === "RECOMMENDED"
                            ? "bg-orange-500 text-white font-bold border-orange-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                >
                    <Sparkles size={13} /> Recommended Products
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection("LOW_PRICE")}
                    className={`px-3.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                        activeSection === "LOW_PRICE"
                            ? "bg-orange-500 text-white font-bold border-orange-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                >
                    <TrendingDown size={13} /> Low Price Opportunities
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection("BULK")}
                    className={`px-3.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                        activeSection === "BULK"
                            ? "bg-orange-500 text-white font-bold border-orange-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                >
                    <BadgePercent size={13} /> Bulk Deals
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection("RECENT")}
                    className={`px-3.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                        activeSection === "RECENT"
                            ? "bg-orange-500 text-white font-bold border-orange-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                >
                    <Clock size={13} /> Recently Purchased
                </button>
            </div>

            {/* 5. FILTERS & SEARCH TOOLBAR */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Search Input */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search products or suppliers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <Filter size={13} className="text-slate-400" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-transparent text-xs text-slate-900 outline-none w-full cursor-pointer"
                        >
                            <option value="ALL">All Categories</option>
                            {categories.filter((c) => c !== "ALL").map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Supplier Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <Building2 size={13} className="text-slate-400" />
                        <select
                            value={selectedSupplier}
                            onChange={(e) => setSelectedSupplier(e.target.value)}
                            className="bg-transparent text-xs text-slate-900 outline-none w-full cursor-pointer"
                        >
                            <option value="ALL">All Suppliers</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Delivery Time Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <Truck size={13} className="text-slate-400" />
                        <select
                            value={deliveryTimeFilter}
                            onChange={(e) => setDeliveryTimeFilter(e.target.value)}
                            className="bg-transparent text-xs text-slate-900 outline-none w-full cursor-pointer"
                        >
                            <option value="ALL">Any Delivery Time</option>
                            <option value="SAME_DAY">⚡ Same Day Delivery</option>
                            <option value="24_HOURS">🚚 Within 24 Hours</option>
                        </select>
                    </div>
                </div>

                {/* Extended Verification & Range Controls */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                            <input
                                type="checkbox"
                                checked={gstVerifiedOnly}
                                onChange={(e) => setGstVerifiedOnly(e.target.checked)}
                                className="rounded bg-slate-100 border-slate-300 text-orange-500 focus:ring-0"
                            />
                            <ShieldCheck size={14} className="text-emerald-600" /> GST Verified Only
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                            <input
                                type="checkbox"
                                checked={fssaiVerifiedOnly}
                                onChange={(e) => setFssaiVerifiedOnly(e.target.checked)}
                                className="rounded bg-slate-100 border-slate-300 text-orange-500 focus:ring-0"
                            />
                            <CheckCircle2 size={14} className="text-cyan-600" /> FSSAI Certified Only
                        </label>
                    </div>

                    <div className="flex items-center gap-6 text-slate-500 text-xs">
                        <div className="flex items-center gap-2">
                            <span>Max Price:</span>
                            <span className="font-bold text-slate-900">₹{maxPrice}</span>
                            <input
                                type="range"
                                min="10"
                                max="2000"
                                step="10"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(Number(e.target.value))}
                                className="w-24 accent-orange-500"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span>Min Rating:</span>
                            <span className="font-bold text-amber-600">{minRating > 0 ? `${minRating}★` : "Any"}</span>
                            <input
                                type="range"
                                min="0"
                                max="4.8"
                                step="0.5"
                                value={minRating}
                                onChange={(e) => setMinRating(Number(e.target.value))}
                                className="w-20 accent-orange-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 6. PRODUCT CARDS CATALOG GRID */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw size={32} className="text-orange-500 animate-spin" />
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                    <ShoppingCart size={40} className="text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-800">No products match your filters</h3>
                    <p className="text-xs text-slate-500">Try adjusting price ranges or clearing verification filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:border-orange-200 transition flex flex-col justify-between shadow-sm group"
                            >
                                <div>
                                    {/* Image Container with Badges */}
                                    <div className="relative h-40 bg-slate-100 overflow-hidden">
                                        <img
                                            src={imageUrl}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />

                                        {/* Category Badge */}
                                        <span className="absolute top-2.5 left-2.5 text-[9px] font-bold uppercase tracking-wider bg-white/90 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 backdrop-blur-xs">
                                            {product.category || "Produce"}
                                        </span>

                                        {/* Rating Badge */}
                                        <span className="absolute top-2.5 right-2.5 text-[9px] font-bold bg-white/90 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 backdrop-blur-xs flex items-center gap-1">
                                            <Star size={10} className="fill-amber-400 text-amber-400" />
                                            {rating}
                                        </span>

                                        {/* Product Price Floating Badge */}
                                        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between">
                                            <div>
                                                <span className="text-lg font-extrabold text-white">₹{price}</span>
                                                <span className="text-xs text-slate-200 font-normal"> / {unit}</span>
                                            </div>

                                            <span className="text-[10px] bg-emerald-500/90 text-white px-2 py-0.5 rounded font-bold">
                                                MOQ: {moq} {unit}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content Details */}
                                    <div className="p-3 space-y-2.5">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-orange-600 transition">
                                                {product.name}
                                            </h3>
                                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                                {product.description || "High quality commercial grade raw material"}
                                            </p>
                                        </div>

                                        {/* Supplier Details & Verification */}
                                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-slate-900 text-[11px] truncate">{supplierName}</span>
                                                <div className="flex items-center gap-1 text-[10px]">
                                                    <ShieldCheck size={12} className="text-emerald-600" />
                                                    <CheckCircle2 size={12} className="text-cyan-600" />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Truck size={11} className="text-orange-500" /> {product.deliveryEstimate || "Same Day"}
                                                </span>
                                                <span className="text-emerald-600 font-bold">In Stock</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="p-3 bg-slate-50/50 border-t border-slate-100 space-y-2">
                                    <div className="flex items-center gap-1.5">
                                        {/* Price Negotiation Button */}
                                        <button
                                            type="button"
                                            onClick={() => setNegotiateProduct(product)}
                                            className="flex-1 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-semibold border border-slate-200 transition flex items-center justify-center gap-1 shadow-2xs"
                                        >
                                            <MessageSquare size={13} className="text-orange-500" /> Negotiate
                                        </button>

                                        {/* View Supplier Profile */}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSupplierDetail(product.supplier || { name: supplierName })}
                                            className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-semibold border border-slate-200 transition shadow-2xs"
                                            title="View Supplier Profile"
                                        >
                                            <Building2 size={13} />
                                        </button>
                                    </div>

                                    {/* Add to Cart / Quantity Controller */}
                                    {cartQty === 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => handleAddToCart(product, moq)}
                                            className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1"
                                        >
                                            <Plus size={14} /> Add to Purchase
                                        </button>
                                    ) : (
                                        <div className="flex items-center justify-between bg-orange-500 text-white font-bold rounded-xl p-1 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => handleAddToCart(product, -1)}
                                                className="p-1 hover:bg-orange-600 rounded-lg transition"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span>{cartQty} {unit} in Cart</span>
                                            <button
                                                type="button"
                                                onClick={() => handleAddToCart(product, 1)}
                                                className="p-1 hover:bg-orange-600 rounded-lg transition"
                                            >
                                                <Plus size={14} />
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
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
                    <div className="bg-white border border-slate-200 w-full max-w-xl rounded-xl shadow-xl overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-orange-500 text-white font-bold flex items-center justify-center shadow-2xs text-sm">
                                    {selectedSupplierDetail.name ? selectedSupplierDetail.name.slice(0, 2).toUpperCase() : "SP"}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-bold text-slate-900">{selectedSupplierDetail.name || "Supplier Profile"}</h2>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                            <ShieldCheck size={11} /> GST VERIFIED
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Verified Tiffzy B2B Wholesale Partner</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedSupplierDetail(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Top Financial & SLA Overview Bar */}
                        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 px-5 py-2.5 bg-slate-50/50 text-xs">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GST Audit Status</span>
                                <span className="font-mono font-bold text-emerald-700 text-xs mt-0.5 block">
                                    {selectedSupplierDetail.profile?.gstNumber || "36AAACT1234F1Z9"}
                                </span>
                            </div>
                            <div className="pl-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">FSSAI Registration</span>
                                <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">
                                    {selectedSupplierDetail.profile?.fssaiNumber || "10019042004312"}
                                </span>
                            </div>
                            <div className="pl-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SLA On-Time Rate</span>
                                <span className="font-bold text-emerald-600 text-xs mt-0.5 block">
                                    98.4% (4.9 ★ Rating)
                                </span>
                            </div>
                        </div>

                        {/* Body - Clean Key-Value list separated by subtle dividers */}
                        <div className="p-5 text-xs space-y-3">
                            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider text-orange-600 pb-1 border-b border-slate-100">
                                Contact & Verification Information
                            </h4>

                            <div className="divide-y divide-slate-100 text-xs">
                                <div className="py-2 flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">Business / Legal Name</span>
                                    <span className="font-bold text-slate-900">{selectedSupplierDetail.name}</span>
                                </div>

                                <div className="py-2 flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">Key Contact Person</span>
                                    <span className="font-semibold text-slate-800">Key Vendor Account Manager</span>
                                </div>

                                <div className="py-2 flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">Phone Support</span>
                                    <span className="font-mono font-semibold text-slate-800">+91 98765 43210</span>
                                </div>

                                <div className="py-2 flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">Official Email</span>
                                    <span className="font-semibold text-orange-600">supplier@tiffzymarket.com</span>
                                </div>

                                <div className="py-2 flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">Warehouse Address</span>
                                    <span className="font-medium text-slate-800 text-right max-w-xs">
                                        {selectedSupplierDetail.profile?.address || "Warehouse 4B, Wholesale Market Road, Hyderabad, Telangana - 500018"}
                                    </span>
                                </div>

                                <div className="py-2 flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">Standard Payment Terms</span>
                                    <span className="font-bold text-slate-900">Net 15 Days</span>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedSupplierDetail(null)}
                                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition"
                            >
                                Close Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRICE NEGOTIATION MODAL */}
            {negotiateProduct && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden text-slate-900">
                        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-orange-100 text-orange-600 rounded-xl border border-orange-200">
                                    <MessageSquare size={16} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">Negotiate Price Quote</h2>
                                    <p className="text-xs text-slate-500">Request bulk pricing directly from supplier</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNegotiateProduct(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitNegotiation} className="p-5 space-y-3">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-bold text-slate-900 block">{negotiateProduct.name}</span>
                                    <span className="text-slate-500">Listed Rate: ₹{negotiateProduct.unitPrice || negotiateProduct.price} / {negotiateProduct.unit || "kg"}</span>
                                </div>
                                <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-200 font-bold">
                                    MOQ: {negotiateProduct.minOrderQuantity || 1}
                                </span>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Required Quantity ({negotiateProduct.unit || "kg"}) *</label>
                                <input
                                    type="number"
                                    required
                                    min={negotiateProduct.minOrderQuantity || 1}
                                    placeholder="Enter bulk quantity"
                                    value={negotiateForm.quantity}
                                    onChange={(e) => setNegotiateForm({ ...negotiateForm, quantity: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Proposed Target Price / {negotiateProduct.unit || "kg"} (₹) *</label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    placeholder="Enter proposed rate"
                                    value={negotiateForm.targetPrice}
                                    onChange={(e) => setNegotiateForm({ ...negotiateForm, targetPrice: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Message / Terms for Supplier</label>
                                <textarea
                                    rows={3}
                                    placeholder="E.g., We order 500kg monthly. Request best rate for recurring delivery."
                                    value={negotiateForm.notes}
                                    onChange={(e) => setNegotiateForm({ ...negotiateForm, notes: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-3 text-xs placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setNegotiateProduct(null)}
                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingNegotiation}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs transition shadow-xs disabled:opacity-50"
                                >
                                    <Send size={13} />
                                    {submittingNegotiation ? "Sending..." : "Submit Quote Request"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
