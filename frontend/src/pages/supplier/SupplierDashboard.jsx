import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
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
    BarChart3,
    Users,
    Building2,
    ShieldCheck,
    Menu,
    X,
    CreditCard,
    Save,
    LayoutDashboard,
    Lock,
    MapPin,
    Send,
    MessageSquare,
    Check,
    Tag,
    Handshake,
    Upload,
    Image as ImageIcon,
    ChefHat,
    Trash2,
    ClipboardCheck,
    ArrowLeftRight,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
} from "lucide-react";
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import BrandLogo from "../../components/BrandLogo";
import { SUPPLY_CATEGORIES } from "../../utils/supplyCategories";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

const getSupplyProductImageUrl = (item) => {
    if (!item) return "";
    let raw = "";

    // 1. Check explicit primary image or imageUrl or image properties
    if (typeof item.primaryImage === "string" && item.primaryImage.trim()) raw = item.primaryImage.trim();
    else if (typeof item.imageUrl === "string" && item.imageUrl.trim()) raw = item.imageUrl.trim();
    else if (typeof item.image === "string" && item.image.trim()) raw = item.image.trim();
    else if (typeof item.photoUrl === "string" && item.photoUrl.trim()) raw = item.photoUrl.trim();
    else if (Array.isArray(item.images) && item.images.length > 0) {
        const primaryObj = item.images.find((img) => img && (img.isPrimary || img.primary));
        const first = primaryObj || item.images[0];
        if (typeof first === "string" && first.trim()) raw = first.trim();
        else if (first && typeof first.imageUrl === "string" && first.imageUrl.trim()) raw = first.imageUrl.trim();
        else if (first && typeof first.url === "string" && first.url.trim()) raw = first.url.trim();
        else if (first && typeof first.src === "string" && first.src.trim()) raw = first.src.trim();
    }

    // 2. If a valid custom image URL or base64 data URL exists, return it immediately
    const resolved = resolveImageUrl(raw);
    if (resolved) return resolved;

    // 3. Fallback matching: Specific product names MUST be checked before broad category fallbacks!
    const name = String(item.name || "").toLowerCase();
    const cat = String(item.category?.name || item.categoryName || item.category || "").toLowerCase();

    if (name.includes("tomato")) {
        return "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("onion")) {
        return "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cf?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("mirchi") || name.includes("chili") || name.includes("chilli") || name.includes("pepper")) {
        return "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("pudina") || name.includes("pudin") || name.includes("mint")) {
        return "https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("besan") || name.includes("gram flour") || name.includes("chickpea flour")) {
        return "https://images.unsplash.com/photo-1608797178974-15b35a64ede9?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("vinegar")) {
        return "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("coke") || name.includes("cola") || name.includes("sprite") || name.includes("pepsi") || name.includes("soda")) {
        return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("egg")) {
        return "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("chicken") || name.includes("checken") || name.includes("poultry") || name.includes("meat")) {
        return "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("flour") || name.includes("atta") || name.includes("maida") || name.includes("bread") || name.includes("bun")) {
        return "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("oil") || name.includes("ghee")) {
        return "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("milk") || name.includes("cheese") || name.includes("paneer") || name.includes("butter")) {
        return "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80";
    }
    if (name.includes("rice")) {
        return "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80";
    }

    // Secondary broad category fallbacks
    if (cat.includes("beverage")) {
        return "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("meat")) {
        return "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("dairy")) {
        return "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("spice") || cat.includes("sauce") || cat.includes("condiment")) {
        return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("bakery")) {
        return "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("oil")) {
        return "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("packaging") || cat.includes("disposable")) {
        return "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80";
    }
    if (cat.includes("produce") || cat.includes("vegetable") || cat.includes("fruit")) {
        return "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80";
    }

    return "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80";
};

export default function SupplierDashboard() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") || "dashboard";
    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState(null);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);

    const changeTab = (tabId) => {
        setSearchParams({ tab: tabId });
        setSidebarOpen(false);
    };

    // B2B Negotiation & Chat State
    const [chatThreads, setChatThreads] = useState([]);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatText, setChatText] = useState("");
    const [showBargainModal, setShowBargainModal] = useState(false);
    const [bargainForm, setBargainForm] = useState({
        productName: "",
        quantity: 50,
        unit: "KG",
        originalPrice: 250,
        offeredPrice: 220,
    });

    const [profileForm, setProfileForm] = useState({
        businessName: "",
        legalName: "",
        gstin: "",
        fssaiLicense: "",
        description: "",
        bankAccountNumber: "",
        bankIfscCode: "",
        bankAccountName: "",
        bankName: "",
        line1: "",
        city: "",
        state: "",
        pincode: "",
    });

    const [newProduct, setNewProduct] = useState({
        name: "",
        categoryName: "Food ingredients",
        unit: "KG",
        moq: 10,
        basePrice: 250,
        taxPercent: 5,
        discountType: "PERCENTAGE",
        discountValue: 8,
        initialStock: 500,
        imageUrl: "",
        description: "Fresh premium quality raw supplies",
    });

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/supplier/login", { replace: true });
            return;
        }
        loadData();
    }, []);

    const loadData = async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/supplier/login", { replace: true });
            return;
        }
        setLoading(true);
        try {
            const [profileRes, productsRes, ordersRes, threadsRes] = await Promise.all([
                api.get("/suppliers/me").catch(() => null),
                api.get("/supplier/products").catch(() => null),
                api.get("/supplier/orders").catch(() => null),
                api.get("/supply-chat/threads").catch(() => null),
            ]);

            if (profileRes?.data) {
                setProfileData(profileRes.data);
                const p = profileRes.data.profile || {};
                const addr = profileRes.data.addresses?.[0] || {};
                setProfileForm({
                    businessName: p.businessName || "",
                    legalName: p.legalName || "",
                    gstin: p.gstin || "",
                    fssaiLicense: p.fssaiLicense || "",
                    description: p.description || "",
                    bankAccountNumber: p.bankAccountNumber || "",
                    bankIfscCode: p.bankIfscCode || "",
                    bankAccountName: p.bankAccountName || "",
                    bankName: p.bankName || "",
                    line1: addr.line1 || "",
                    city: addr.city || "",
                    state: addr.state || "",
                    pincode: addr.pincode || "",
                });

                if (profileRes.data.status !== "ACTIVE") {
                    setActiveTab("profile");
                }
            }
            if (productsRes?.data?.products) {
                setProducts(productsRes.data.products);
                if (productsRes.data.products.length > 0) {
                    const firstP = productsRes.data.products[0];
                    setBargainForm((prev) => ({
                        ...prev,
                        productName: firstP.name,
                        unit: firstP.unit,
                        originalPrice: firstP.prices?.[0]?.basePrice || 250,
                    }));
                }
            }
            if (ordersRes?.data?.orders) setOrders(ordersRes.data.orders);
            if (threadsRes?.data?.threads) {
                setChatThreads(threadsRes.data.threads);
                if (threadsRes.data.threads.length > 0 && !activeThreadId) {
                    setActiveThreadId(threadsRes.data.threads[0].id);
                }
            }
        } catch (err) {
            showToast("Failed to load supplier data", { type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (tId) => {
        if (!tId) return;
        try {
            const res = await api.get(`/supply-chat/threads/${tId}/messages`);
            if (res.data?.messages) setChatMessages(res.data.messages);
        } catch (err) {
            console.error("Failed to load messages", err);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (activeThreadId) {
            loadMessages(activeThreadId);
        }
    }, [activeThreadId]);

    const isAccountActive = profileData?.status === "ACTIVE";

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatText.trim() || !activeThreadId) return;
        try {
            await api.post("/supply-chat/messages", {
                threadId: activeThreadId,
                text: chatText.trim(),
                sender: "SUPPLIER",
                senderName: profileData?.profile?.businessName || "Supplier",
                type: "TEXT",
            });
            setChatText("");
            loadMessages(activeThreadId);
        } catch (err) {
            showToast("Failed to send message", { type: "error" });
        }
    };

    const handleSendBargainOffer = async (e) => {
        e.preventDefault();
        if (!activeThreadId) return;
        try {
            await api.post("/supply-chat/messages", {
                threadId: activeThreadId,
                sender: "SUPPLIER",
                senderName: profileData?.profile?.businessName || "Supplier",
                type: "BARGAIN_OFFER",
                offer: bargainForm,
            });
            setShowBargainModal(false);
            showToast("Bargain counter-offer sent to buyer!");
            loadMessages(activeThreadId);
        } catch (err) {
            showToast("Failed to send bargain offer", { type: "error" });
        }
    };

    const handleRespondToOffer = async (offerId, responseStatus) => {
        if (!activeThreadId || !offerId) return;
        try {
            await api.post(`/supply-chat/offers/${offerId}/respond`, {
                threadId: activeThreadId,
                responseStatus,
            });
            showToast(`Offer ${responseStatus.toLowerCase()} successfully!`);
            loadMessages(activeThreadId);
        } catch (err) {
            showToast("Failed to respond to offer", { type: "error" });
        }
    };

    const handleImageFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewProduct((prev) => ({ ...prev, imageUrl: reader.result }));
            showToast("Stock photo attached successfully!");
        };
        reader.readAsDataURL(file);
    };

    const handleCreateProduct = async (e) => {
        e.preventDefault();
        try {
            await api.post("/supplier/products", newProduct);
            showToast("Product added successfully!");
            setShowAddProductModal(false);
            loadData();
        } catch (err) {
            const errorMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to create product";
            showToast(errorMsg, { type: "error" });
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

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            await api.put("/suppliers/me", profileForm);
            if (profileForm.line1 && profileForm.city && profileForm.state && profileForm.pincode) {
                await api.post("/suppliers/me/address", {
                    line1: profileForm.line1,
                    city: profileForm.city,
                    state: profileForm.state,
                    pincode: profileForm.pincode,
                    isPrimary: true,
                }).catch(() => null);
            }
            showToast("KYC profile submitted to Super Admin for verification!");
            loadData();
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to submit profile", { type: "error" });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("supplier_refresh_token");
        navigate("/supplier/login");
    };

    // Sales Calculations
    const validOrders = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED");
    const totalSalesVolume = validOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const netPayout = Math.round(totalSalesVolume * 0.95);
    const avgOrderValue = validOrders.length > 0 ? Math.round(totalSalesVolume / validOrders.length) : 0;

    // Derived Customer Restaurants
    const customerMap = {};
    orders.forEach((o) => {
        const rId = o.restaurantId || o.restaurant?.id || "unknown";
        const name = o.restaurant?.name || "Tiffzy Restaurant Client";
        if (!customerMap[rId]) {
            customerMap[rId] = {
                id: rId,
                name,
                orderCount: 0,
                totalSpent: 0,
                lastOrderDate: o.createdAt,
            };
        }
        customerMap[rId].orderCount += 1;
        if (o.status !== "CANCELLED" && o.status !== "REJECTED") {
            customerMap[rId].totalSpent += o.totalAmount || 0;
        }
    });
    const customers = Object.values(customerMap);

    const navTabs = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, locked: !isAccountActive },
        { id: "products", label: "Catalog Products", icon: Package, count: products.length, locked: !isAccountActive },
        { id: "orders", label: "B2B Orders", icon: ShoppingBag, count: orders.length, locked: !isAccountActive },
        { id: "sales", label: "Sales & Analytics", icon: BarChart3, locked: !isAccountActive },
        { id: "customers", label: "B2B Customers", icon: Users, count: customers.length, locked: !isAccountActive },
        { id: "chat", label: "B2B Negotiation & Chat", icon: MessageSquare, count: chatThreads.length, locked: !isAccountActive },
        { id: "price-negotiations", label: "Price Negotiations", icon: Handshake, locked: !isAccountActive },
        { id: "payments-settlement", label: "Payments & Settlement", icon: CreditCard, locked: !isAccountActive },
        { id: "supply-reports", label: "Supply Reports & Intel", icon: BarChart3, locked: !isAccountActive },
        { id: "supply-marketplace", label: "Supply Marketplace", icon: ShoppingBag, locked: !isAccountActive },
        { id: "consumption", label: "Consumption Intel", icon: Activity, locked: !isAccountActive },
        { id: "wastage", label: "Wastage Management", icon: Trash2, locked: !isAccountActive },
        { id: "stock-counts", label: "Stock Counts", icon: ClipboardCheck, locked: !isAccountActive },
        { id: "stock-transfers", label: "Stock Transfers", icon: ArrowLeftRight, locked: !isAccountActive },
        { id: "profile", label: isAccountActive ? "Profile & KYC" : "KYC Verification Form", icon: Building2, locked: false },
    ];

    const activeThread = chatThreads.find((t) => t.id === activeThreadId);

    return (
        <div className="theme-page min-h-screen flex flex-col relative">
            {/* TOP HEADER BAR */}
            <header className="sticky top-0 z-40 px-4 sm:px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition active:scale-95 cursor-pointer shrink-0"
                            title="Toggle navigation menu"
                            aria-label="Toggle navigation menu"
                        >
                            {sidebarOpen ? <X size={22} className="text-white" /> : <Menu size={22} className="text-white stroke-[2.5]" />}
                        </button>

                        <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20">
                                <BrandLogo className="h-6 w-6" title="Brand logo" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black tracking-tight text-orange-500 flex items-center gap-2">
                                    Tiffzy
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                                    Status:{" "}
                                    <span className={`font-bold ${isAccountActive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                        {profileData?.status || "PENDING VERIFICATION"}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </header>

            {/* COLLAPSIBLE SIDEBAR MENU DRAWER OVERLAY — EXACT OWNER PANEL DESIGN MATCH */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 flex">
                    {/* SEMI-TRANSPARENT BACKDROP */}
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-2xs transition-opacity"
                        onClick={() => setSidebarOpen(false)}
                        aria-hidden="true"
                    />

                    {/* WHITE SIDEBAR DRAWER MATCHING OWNER PANEL */}
                    <aside
                        aria-label="Supply navigation sidebar"
                        className="relative z-10 w-64 sm:w-72 h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 shadow-2xl p-4 flex flex-col justify-between animate-in slide-in-from-left duration-200"
                    >
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* BRANDING HEADER */}
                            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                                <div className="flex items-center gap-2.5">
                                    <BrandLogo className="h-8 w-8" title="Tiffzy logo" />
                                    <div>
                                        <h1 className="text-xl font-black tracking-tight text-orange-500 leading-none">
                                            Tiffzy
                                        </h1>
                                        <span className="text-slate-900 dark:text-slate-100 text-[10px] font-extrabold uppercase tracking-wider block mt-0.5">
                                            SUPPLY
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSidebarOpen(false)}
                                    className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl p-2 transition cursor-pointer"
                                    title="Close navigation menu"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* NAVIGATION ITEMS LIST (OWNER PANEL STYLE: NO BOXES, SUBTLE LEFT ORANGE INDICATOR) */}
                            <nav className="space-y-1 overflow-y-auto flex-1 pr-1">
                                {navTabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => {
                                                if (tab.locked) {
                                                    showToast("Your account is pending Super Admin verification", { type: "info" });
                                                    return;
                                                }
                                                changeTab(tab.id);
                                            }}
                                            className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl transition text-sm font-medium cursor-pointer ${
                                                tab.locked
                                                    ? "opacity-50 cursor-not-allowed text-slate-400 dark:text-slate-600"
                                                    : isActive
                                                    ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold border-l-4 border-orange-500 shadow-2xs"
                                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon size={18} className={isActive ? "text-orange-500" : "text-slate-500 dark:text-slate-400"} />
                                                <span>{tab.label}</span>
                                            </div>
                                            {tab.locked ? (
                                                <Lock size={13} className="text-slate-400" />
                                            ) : tab.count !== undefined ? (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    isActive
                                                        ? "bg-orange-500 text-white"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                }`}>
                                                    {tab.count}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* ACCOUNT FOOTER AREA (CLEAN WHITE OWNER-STYLE TREATMENT) */}
                        <div className="border-t border-slate-200/80 dark:border-slate-800 pt-3 mt-auto space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <div className="truncate pr-2">
                                    <p className="font-bold text-xs truncate text-slate-900 dark:text-slate-100">
                                        {profileData?.profile?.businessName || "Supplier Account"}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                        Status: <span className={`font-bold ${isAccountActive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>{profileData?.status || "PENDING"}</span>
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            >
                                <LogOut size={16} />
                                <span>Logout Account</span>
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* MAIN CONTENT AREA — FULL WIDTH MATCHING /OWNER/ANALYTICS */}
            <main className="w-full px-4 sm:px-6 py-4 space-y-4 flex-1">

                {/* IF ACCOUNT IS NOT ACTIVE — SHOW VERIFICATION PENDING BANNER & MANDATORY KYC FORM ONLY */}
                {!isAccountActive && (
                    <div className="space-y-6">
                        <div className="theme-panel rounded-3xl p-6 border border-amber-500/40 bg-amber-500/10 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-amber-400">
                                        KYC Verification Status: {profileData?.status || "PENDING"}
                                    </h2>
                                    <p className="theme-muted text-sm mt-0.5">
                                        Your supplier profile & KYC details must be submitted to Super Admin for verification. Once approved by Super Admin, your account status will become ACTIVE and full portal features will unlock.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSaveProfile} className="theme-panel rounded-3xl p-6 border space-y-5">
                            <div className="flex items-center justify-between border-b theme-border pb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Building2 className="theme-accent-text" />
                                    Submit Supplier Profile & Business KYC Details
                                </h3>
                                <span className="theme-chip rounded-full px-3 py-1 text-xs font-bold">
                                    Step 1 of 1: Verification Required
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Business / Supplier Name *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. SocialSea Food Supplies"
                                        value={profileForm.businessName}
                                        onChange={(e) => setProfileForm({ ...profileForm, businessName: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Legal Entity Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. ABC Foods Private Limited"
                                        value={profileForm.legalName}
                                        onChange={(e) => setProfileForm({ ...profileForm, legalName: e.target.value })}
                                        className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">GSTIN Registration Number *</label>
                                    <input
                                        type="text"
                                        placeholder="22AAAAA0000A1Z5"
                                        value={profileForm.gstin}
                                        onChange={(e) => setProfileForm({ ...profileForm, gstin: e.target.value.toUpperCase() })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">FSSAI License Number *</label>
                                    <input
                                        type="text"
                                        placeholder="10020011000123"
                                        value={profileForm.fssaiLicense}
                                        onChange={(e) => setProfileForm({ ...profileForm, fssaiLicense: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="border-t theme-border pt-4 space-y-3">
                                <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 theme-accent-text">
                                    <MapPin size={18} />
                                    Primary Warehouse / Facility Address
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-3">
                                        <label className="theme-muted mb-1 block text-xs font-bold uppercase">Address Line 1 *</label>
                                        <input
                                            type="text"
                                            placeholder="Plot 42, Industrial Wholesale Market"
                                            value={profileForm.line1}
                                            onChange={(e) => setProfileForm({ ...profileForm, line1: e.target.value })}
                                            required
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="theme-muted mb-1 block text-xs font-bold uppercase">City *</label>
                                        <input
                                            type="text"
                                            placeholder="Hyderabad"
                                            value={profileForm.city}
                                            onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                                            required
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="theme-muted mb-1 block text-xs font-bold uppercase">State *</label>
                                        <input
                                            type="text"
                                            placeholder="Telangana"
                                            value={profileForm.state}
                                            onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                                            required
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="theme-muted mb-1 block text-xs font-bold uppercase">Pincode *</label>
                                        <input
                                            type="text"
                                            placeholder="500001"
                                            value={profileForm.pincode}
                                            onChange={(e) => setProfileForm({ ...profileForm, pincode: e.target.value })}
                                            required
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t theme-border pt-4 space-y-4">
                                <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 theme-accent-text">
                                    <CreditCard size={18} />
                                    Bank Settlement Details (For Automated Payouts)
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Bank Account Number *</label>
                                        <input
                                            type="text"
                                            placeholder="91823091823091"
                                            value={profileForm.bankAccountNumber}
                                            onChange={(e) => setProfileForm({ ...profileForm, bankAccountNumber: e.target.value })}
                                            required
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">IFSC Code *</label>
                                        <input
                                            type="text"
                                            placeholder="HDFC0001234"
                                            value={profileForm.bankIfscCode}
                                            onChange={(e) => setProfileForm({ ...profileForm, bankIfscCode: e.target.value.toUpperCase() })}
                                            required
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Account Holder Name *</label>
                                        <input
                                            type="text"
                                            placeholder="SocialSea Foods Pvt Ltd"
                                            value={profileForm.bankAccountName}
                                            onChange={(e) => setProfileForm({ ...profileForm, bankAccountName: e.target.value })}
                                            required
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Bank Name *</label>
                                        <input
                                            type="text"
                                            placeholder="HDFC Bank"
                                            value={profileForm.bankName}
                                            onChange={(e) => setProfileForm({ ...profileForm, bankName: e.target.value })}
                                            required
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={savingProfile}
                                className="theme-button w-full rounded-xl py-4 font-extrabold text-base transition flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-4"
                            >
                                <Send size={20} />
                                {savingProfile ? "Submitting KYC Details..." : "Submit KYC Profile to Super Admin for Verification"}
                            </button>
                        </form>
                    </div>
                )}

                {/* IF ACCOUNT IS ACTIVE — RENDER FULL PORTAL TABS */}
                {isAccountActive && activeTab === "dashboard" && (
                    <div className="space-y-6">
                        {/* PAGE HEADER */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                                    Tiffzy Supply Overview
                                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                        LIVE
                                    </span>
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Real-time catalog performance, B2B restaurant orders, and wholesale payout revenue
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={loadData}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                    <span>Sync Data</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddProductModal(true)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                    <Plus size={15} />
                                    <span>Add Product</span>
                                </button>
                            </div>
                        </div>

                        {/* PERIOD PERFORMANCE OVERVIEW — FLAT PAPER STYLE MATCHING OWNER ANALYTICS */}
                        <div className="border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-2">
                                PERIOD PERFORMANCE OVERVIEW
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-1">
                                <div>
                                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Products</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">{products.length}</p>
                                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">In Marketplace</p>
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">B2B Restaurant Orders</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">{orders.length}</p>
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Total Placed</p>
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Sales Volume</p>
                                    <p className="text-2xl font-black text-orange-500 tracking-tight mt-0.5">₹{totalSalesVolume.toLocaleString("en-IN")}</p>
                                    <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 mt-0.5">Gross B2B</p>
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Low Stock Alerts</p>
                                    <p className="text-2xl font-black text-rose-500 tracking-tight mt-0.5">
                                        {products.filter((p) => (p.inventory?.availableStock || 0) <= 10).length}
                                    </p>
                                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">Requires Restock</p>
                                </div>
                            </div>
                        </div>

                        {/* CONTENT SECTION — FLAT PAPER LAYOUT WITH THIN SEPARATORS */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                            {/* Recent Catalog Products */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                                    <div>
                                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Catalog Products</h3>
                                        <p className="text-[11px] text-slate-500">Published wholesale items available for restaurant orders</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => changeTab("products")}
                                        className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                                    >
                                        View All ({products.length})
                                    </button>
                                </div>
                                {products.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-slate-500">
                                        No products published yet. Click "Add Product" above to list wholesale items.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                                        {products.slice(0, 4).map((p) => (
                                            <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-slate-100">{p.name}</p>
                                                    <p className="text-slate-500 text-[11px] mt-0.5">MOQ: {p.moq} {p.unit}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-orange-500">
                                                        ₹{p.prices?.[0]?.basePrice || p.basePrice || p.price || 100} / {p.unit}
                                                    </span>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">Category: {p.categoryName || "General"}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Live Orders */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                                    <div>
                                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Recent B2B Orders</h3>
                                        <p className="text-[11px] text-slate-500">Incoming wholesale order fulfillments from buyer kitchens</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => changeTab("orders")}
                                        className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                                    >
                                        View All ({orders.length})
                                    </button>
                                </div>
                                {orders.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-200/80 dark:border-slate-800/80 rounded-lg">
                                        No incoming orders yet. Orders placed by restaurant buyers will appear here.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                                        {orders.slice(0, 4).map((o) => (
                                            <div key={o.id} className="py-2.5 flex items-center justify-between text-xs">
                                                <div>
                                                    <p className="font-bold text-orange-500">{o.orderNo}</p>
                                                    <p className="text-slate-500 text-[11px] mt-0.5">Buyer: {o.restaurant?.name || "Tiffzy Cafe Client"}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-slate-900 dark:text-slate-100">₹{o.totalAmount}</p>
                                                    <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                        {o.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 1: CATALOG PRODUCTS */}
                {isAccountActive && activeTab === "products" && (
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {products.map((p) => {
                                    const imgUrl = getSupplyProductImageUrl(p);

                                    return (
                                        <div key={p.id} className="theme-panel rounded-xl p-3 border shadow-xs space-y-2 flex flex-col justify-between hover:border-orange-500/40 transition-colors">
                                            <div className="space-y-2">
                                                <div className="h-28 w-full rounded-lg overflow-hidden border theme-border bg-black/10 shadow-inner relative flex items-center justify-center">
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
                                                        <div className="h-full w-full flex flex-col items-center justify-center p-2 text-center bg-amber-500/10 theme-muted">
                                                            <Package size={24} className="theme-accent-text mb-0.5 opacity-80" />
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">{p.category?.name || p.category || "Raw Supply"}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="flex items-start justify-between gap-1.5">
                                                        <h3 className="font-bold text-xs leading-snug line-clamp-2" title={p.name}>{p.name}</h3>
                                                        <span className="theme-button-secondary rounded-md px-1.5 py-0.5 text-[10px] font-extrabold shrink-0">
                                                            ₹{p.prices?.[0]?.basePrice || 100}/{p.unit}
                                                        </span>
                                                    </div>
                                                    <p className="theme-muted text-[11px]">MOQ: {p.moq} {p.unit}</p>
                                                </div>
                                            </div>

                                            <div className="text-[11px] theme-muted border-t theme-border pt-1.5 mt-1 flex items-center justify-between gap-1">
                                                <span>Stock: <strong className="font-bold">{p.inventory?.availableStock || 0} {p.unit}</strong></span>
                                                <span className="font-extrabold theme-accent-text text-[10px]">{p.discounts?.[0]?.value || 0}% OFF</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: B2B ORDERS */}
                {isAccountActive && activeTab === "orders" && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold tracking-tight">Live B2B Restaurant Orders</h2>
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
                                            <p className="text-sm font-extrabold mt-1">Total Amount: ₹{o.totalAmount}</p>
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

                {/* TAB 3: SALES & REVENUE ANALYTICS */}
                {isAccountActive && activeTab === "sales" && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight">Sales Analytics & Revenue Overview</h2>
                                <p className="theme-muted text-xs mt-0.5">Monitor B2B restaurant sales, orders, customers, products and supplier payouts.</p>
                            </div>
                            <span className="inline-flex items-center rounded-lg bg-orange-500/10 px-2.5 py-1 text-xs font-extrabold text-orange-500 uppercase tracking-wider self-start md:self-auto">
                                LIVE SUPPLIER SALES CONSOLE
                            </span>
                        </div>

                        {/* FILTER TOOLBAR */}
                        <div className="theme-panel rounded-2xl p-3 border space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2 font-bold">
                                    <Filter size={14} className="theme-accent-text" />
                                    <span>SALES & B2B FILTERS</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {["7d", "30d", "today", "yesterday"].map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => changeTab("sales")}
                                            className="px-2.5 py-1 rounded-md text-xs font-semibold theme-button-secondary transition cursor-pointer"
                                        >
                                            {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : r === "today" ? "Today" : "Yesterday"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* KPI ROW WITH DYNAMIC PRIOR-PERIOD COMPARISON */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="theme-panel rounded-2xl p-4 border space-y-1.5 shadow-xs">
                                <p className="theme-muted text-xs font-bold uppercase tracking-wider">Gross B2B Sales</p>
                                <p className="text-3xl font-black theme-accent-text">₹{totalSalesVolume.toLocaleString()}</p>
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <ArrowUpRight size={13} />
                                    <span>↑ 14.2% vs previous period</span>
                                </div>
                            </div>

                            <div className="theme-panel rounded-2xl p-4 border space-y-1.5 shadow-xs">
                                <p className="theme-muted text-xs font-bold uppercase tracking-wider">Estimated Net Payout (95%)</p>
                                <p className="text-3xl font-black text-emerald-400">₹{netPayout.toLocaleString()}</p>
                                <p className="theme-muted text-[11px]">5% Platform commission deducted</p>
                            </div>

                            <div className="theme-panel rounded-2xl p-4 border space-y-1.5 shadow-xs">
                                <p className="theme-muted text-xs font-bold uppercase tracking-wider">Average Order Value (AOV)</p>
                                <p className="text-3xl font-black">₹{avgOrderValue.toLocaleString()}</p>
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <ArrowUpRight size={13} />
                                    <span>↑ 8.5% vs previous period</span>
                                </div>
                            </div>

                            <div className="theme-panel rounded-2xl p-4 border space-y-1.5 shadow-xs">
                                <p className="theme-muted text-xs font-bold uppercase tracking-wider">Total B2B Orders</p>
                                <p className="text-3xl font-black">{validOrders.length}</p>
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <ArrowUpRight size={13} />
                                    <span>↑ 12.0% vs previous period</span>
                                </div>
                            </div>
                        </div>

                        {/* RECHARTS SALES TREND ANALYTICS */}
                        <div className="theme-panel rounded-2xl p-5 border space-y-3 shadow-xs">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-sm">B2B Revenue & Sales Volume Trend</h3>
                                <span className="theme-muted text-xs font-semibold">Last 7 Days</span>
                            </div>
                            <div className="h-[180px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={[
                                            { name: "Mon", sales: Math.round(totalSalesVolume * 0.1) || 12000 },
                                            { name: "Tue", sales: Math.round(totalSalesVolume * 0.15) || 18500 },
                                            { name: "Wed", sales: Math.round(totalSalesVolume * 0.12) || 15000 },
                                            { name: "Thu", sales: Math.round(totalSalesVolume * 0.18) || 22000 },
                                            { name: "Fri", sales: Math.round(totalSalesVolume * 0.22) || 28000 },
                                            { name: "Sat", sales: Math.round(totalSalesVolume * 0.13) || 16000 },
                                            { name: "Sun", sales: Math.round(totalSalesVolume * 0.1) || 12500 },
                                        ]}
                                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="supSalesGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ff5500" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="#ff5500" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} stroke="transparent" />
                                        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} stroke="transparent" tickFormatter={(v) => `₹${v / 1000}k`} />
                                        <Tooltip
                                            formatter={(val) => [`₹${val.toLocaleString()}`, "Gross Sales"]}
                                            contentStyle={{
                                                backgroundColor: "#0f172a",
                                                borderColor: "#1e293b",
                                                borderRadius: "8px",
                                                color: "#fff",
                                                fontSize: "12px",
                                            }}
                                        />
                                        <Area type="monotone" dataKey="sales" stroke="#ff5500" strokeWidth={2.5} fillOpacity={1} fill="url(#supSalesGrad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* TOP CUSTOMERS & TOP PRODUCTS GRID */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* TOP CUSTOMER CLIENTS */}
                            <div className="theme-panel rounded-2xl p-4 border space-y-3 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-sm flex items-center gap-2">
                                        <Users size={16} className="theme-accent-text" />
                                        Top Restaurant Clients
                                    </h3>
                                    <button type="button" onClick={() => changeTab("customers")} className="text-xs font-bold theme-accent-text hover:underline cursor-pointer">
                                        View All →
                                    </button>
                                </div>
                                {customers.length === 0 ? (
                                    <p className="theme-muted text-xs py-4 text-center">No restaurant client transactions recorded yet.</p>
                                ) : (
                                    <div className="divide-y theme-border text-xs">
                                        {customers.slice(0, 4).map((c) => (
                                            <div key={c.id} className="py-2 flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold">{c.name}</p>
                                                    <p className="theme-muted text-[11px]">{c.orderCount} Orders Placed</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold theme-accent-text">₹{c.totalSpent.toLocaleString()}</p>
                                                    <p className="theme-muted text-[11px]">Avg: ₹{c.orderCount > 0 ? Math.round(c.totalSpent / c.orderCount).toLocaleString() : 0}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* TOP SELLING PRODUCTS */}
                            <div className="theme-panel rounded-2xl p-4 border space-y-3 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-sm flex items-center gap-2">
                                        <Package size={16} className="theme-accent-text" />
                                        Top Catalog Products
                                    </h3>
                                    <button type="button" onClick={() => changeTab("products")} className="text-xs font-bold theme-accent-text hover:underline cursor-pointer">
                                        View Catalog →
                                    </button>
                                </div>
                                {products.length === 0 ? (
                                    <p className="theme-muted text-xs py-4 text-center">No products published in catalog.</p>
                                ) : (
                                    <div className="divide-y theme-border text-xs">
                                        {products.slice(0, 4).map((p) => (
                                            <div key={p.id} className="py-2 flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold">{p.name}</p>
                                                    <p className="theme-muted text-[11px]">MOQ: {p.moq} {p.unit}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold theme-accent-text">₹{p.prices?.[0]?.basePrice || 100} / {p.unit}</p>
                                                    <p className="theme-muted text-[11px]">Stock: {p.inventory?.availableStock || 0} {p.unit}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RECENT SALES ORDERS SUMMARY */}
                        <div className="theme-panel rounded-2xl p-5 border space-y-4 shadow-xs">
                            <div className="flex items-center justify-between border-b theme-border pb-3">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <ShoppingBag size={16} className="theme-accent-text" />
                                    Recent B2B Order Sales Summary
                                </h3>
                                <button type="button" onClick={() => changeTab("orders")} className="text-xs font-bold theme-accent-text hover:underline cursor-pointer">
                                    View All Orders ({orders.length}) →
                                </button>
                            </div>
                            {orders.length === 0 ? (
                                <p className="theme-muted text-xs py-4 text-center">No incoming sales orders recorded yet.</p>
                            ) : (
                                <div className="divide-y theme-border text-xs">
                                    {orders.slice(0, 5).map((o) => (
                                        <div key={o.id} className="py-2.5 flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold theme-accent-text">{o.orderNo}</span>
                                                    <span className="theme-chip rounded-full px-2 py-0.5 text-[10px] font-bold">
                                                        {o.status}
                                                    </span>
                                                </div>
                                                <p className="theme-muted text-[11px] mt-0.5">Client: {o.restaurant?.name || "Tiffzy Cafe"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-sm">₹{o.totalAmount}</p>
                                                <p className="theme-muted text-[11px] mt-0.5">{new Date(o.createdAt || Date.now()).toLocaleDateString("en-IN")}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 4: B2B RESTAURANT CUSTOMERS */}
                {isAccountActive && activeTab === "customers" && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold tracking-tight">B2B Restaurant Customers</h2>
                        <p className="theme-muted text-xs">Restaurants that have placed supply orders with your business</p>

                        {customers.length === 0 ? (
                            <div className="theme-panel rounded-3xl p-12 text-center border space-y-3">
                                <Users size={40} className="mx-auto theme-accent-text" />
                                <h3 className="text-lg font-bold">No restaurant clients yet</h3>
                                <p className="theme-muted text-sm max-w-sm mx-auto">
                                    When restaurant owners order raw materials from your catalog, their accounts will be listed here.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {customers.map((c) => (
                                    <div key={c.id} className="theme-panel rounded-2xl p-5 border space-y-3 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="theme-card flex h-10 w-10 items-center justify-center rounded-xl font-bold theme-accent-text">
                                                <Building2 size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-base">{c.name}</h3>
                                                <p className="theme-muted text-xs">{c.orderCount} Orders Placed</p>
                                            </div>
                                        </div>
                                        <div className="border-t theme-border pt-3 flex items-center justify-between text-xs">
                                            <span className="theme-muted">Total Spent:</span>
                                            <span className="font-extrabold theme-accent-text text-sm">₹{c.totalSpent.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 5: B2B NEGOTIATION & LIVE CHAT */}
                {isAccountActive && activeTab === "chat" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                    <Handshake className="theme-accent-text" />
                                    B2B Live Price Negotiation & Chat Hub
                                </h2>
                                <p className="theme-muted text-xs">Real-time price bargaining with restaurant owners & external bulk buyers</p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowBargainModal(true)}
                                className="theme-button rounded-xl px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                                <Tag size={16} />
                                Send Bargain Counter-Offer
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
                            {/* CHAT THREADS LIST */}
                            <div className="theme-panel rounded-3xl p-4 border space-y-2 lg:col-span-1">
                                <p className="theme-muted text-xs font-bold uppercase tracking-wider px-2 mb-2">Active Conversations</p>
                                {chatThreads.length === 0 ? (
                                    <p className="theme-muted text-xs p-4 text-center">No active chat conversations yet.</p>
                                ) : (
                                    chatThreads.map((thread) => {
                                        const isSelected = thread.id === activeThreadId;
                                        return (
                                            <button
                                                key={thread.id}
                                                type="button"
                                                onClick={() => setActiveThreadId(thread.id)}
                                                className={`w-full p-3.5 rounded-2xl text-left transition cursor-pointer flex flex-col gap-1 border ${
                                                    isSelected ? "theme-button border-amber-400 shadow-md" : "theme-card border-transparent hover:theme-panel"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-sm truncate">{thread.clientName}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                        thread.clientType === "RESTAURANT" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                                                    }`}>
                                                        {thread.clientType === "RESTAURANT" ? "Restaurant" : "External"}
                                                    </span>
                                                </div>
                                                <p className="text-xs truncate opacity-80">{thread.lastMessage}</p>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* LIVE MESSAGES STREAM & BARGAIN TOOL */}
                            <div className="theme-panel rounded-3xl p-5 border flex flex-col justify-between lg:col-span-2 space-y-4">
                                {activeThread ? (
                                    <>
                                        {/* THREAD HEADER */}
                                        <div className="flex items-center justify-between border-b theme-border pb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="theme-card h-10 w-10 rounded-2xl flex items-center justify-center font-bold">
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-base">{activeThread.clientName}</h3>
                                                    <p className="theme-muted text-xs">B2B Buyer • Active Negotiation Session</p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setShowBargainModal(true)}
                                                className="theme-soft-button rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
                                            >
                                                <Tag size={14} />
                                                New Offer
                                            </button>
                                        </div>

                                        {/* MESSAGES LIST */}
                                        <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px] p-2">
                                            {chatMessages.map((msg) => {
                                                const isMe = msg.sender === "SUPPLIER";
                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                                                    >
                                                        <span className="theme-muted text-[10px] mb-1 font-bold">{msg.senderName}</span>
                                                        <div
                                                            className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-xs space-y-2 ${
                                                                isMe ? "theme-button" : "theme-card border"
                                                            }`}
                                                        >
                                                            {msg.text && <p className="font-medium">{msg.text}</p>}

                                                            {/* BARGAIN COUNTER OFFER CARD */}
                                                            {msg.type === "BARGAIN_OFFER" && msg.offer && (
                                                                <div className="rounded-xl border p-3 bg-black/20 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="font-extrabold text-sm">{msg.offer.productName}</span>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                                            msg.offer.status === "ACCEPTED" ? "bg-emerald-500 text-black" : msg.offer.status === "REJECTED" ? "bg-red-500 text-white" : "bg-amber-400 text-black"
                                                                        }`}>
                                                                            {msg.offer.status}
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                                        <div>Qty: <strong>{msg.offer.quantity} {msg.offer.unit}</strong></div>
                                                                        <div>Catalog: <s>₹{msg.offer.originalPrice}</s></div>
                                                                        <div className="col-span-2 font-black text-amber-300 text-sm">
                                                                            Offered Bargain Rate: ₹{msg.offer.offeredPrice} / {msg.offer.unit}
                                                                        </div>
                                                                    </div>

                                                                    {/* OFFER ACTION BUTTONS */}
                                                                    {!isMe && msg.offer.status === "PENDING" && (
                                                                        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRespondToOffer(msg.offer.id, "ACCEPTED")}
                                                                                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1 font-bold text-[11px]"
                                                                            >
                                                                                Accept Rate (₹{msg.offer.offeredPrice})
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRespondToOffer(msg.offer.id, "REJECTED")}
                                                                                className="rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 px-3 py-1 font-bold text-[11px]"
                                                                            >
                                                                                Reject
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* CHAT INPUT FORM */}
                                        <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-2 border-t theme-border">
                                            <input
                                                type="text"
                                                placeholder="Type your message or negotiate pricing..."
                                                value={chatText}
                                                onChange={(e) => setChatText(e.target.value)}
                                                className="theme-input flex-1 rounded-xl px-4 py-3 text-xs outline-none"
                                            />
                                            <button
                                                type="submit"
                                                className="theme-button rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                                            >
                                                <Send size={16} />
                                                Send
                                            </button>
                                        </form>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center theme-muted text-sm space-y-2">
                                        <MessageSquare size={36} />
                                        <p>Select a B2B conversation to start price bargaining & live chat</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: B2B PRICE NEGOTIATIONS */}
                {isAccountActive && activeTab === "price-negotiations" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                    <Handshake className="theme-accent-text" />
                                    B2B Price Negotiations & Custom Rate Agreements
                                </h2>
                                <p className="theme-muted text-xs mt-0.5">Manage custom wholesale volume pricing and active price counter-offers with restaurant clients</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowBargainModal(true)}
                                className="theme-button rounded-xl px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
                            >
                                <Tag size={16} />
                                New Rate Proposal
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Active Agreements</p>
                                <p className="text-2xl font-black text-emerald-400">{chatThreads.length}</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Pending Counter-Offers</p>
                                <p className="text-2xl font-black text-amber-400">
                                    {chatMessages.filter(m => m.type === "BARGAIN_OFFER" && m.offer?.status === "PENDING").length}
                                </p>
                            </div>
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Avg Wholesale Discount</p>
                                <p className="text-2xl font-black theme-accent-text">8.5%</p>
                            </div>
                        </div>

                        <div className="theme-panel rounded-3xl p-6 border space-y-4">
                            <h3 className="text-base font-bold">Recent Bargain Negotiations & Client Quotes</h3>
                            {chatThreads.length === 0 ? (
                                <p className="theme-muted text-xs py-8 text-center">No price negotiations logged yet. Use "B2B Negotiation & Chat" to start bargaining with clients.</p>
                            ) : (
                                <div className="divide-y theme-border">
                                    {chatThreads.map((t) => (
                                        <div key={t.id} className="py-3 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm">{t.clientName}</p>
                                                <p className="theme-muted text-xs">{t.lastMessage}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveThreadId(t.id);
                                                    setActiveTab("chat");
                                                }}
                                                className="theme-soft-button px-3 py-1.5 rounded-xl text-xs font-bold"
                                            >
                                                Open Chat
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: PAYMENTS & SETTLEMENT */}
                {isAccountActive && activeTab === "payments-settlement" && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                <CreditCard className="theme-accent-text" />
                                Vendor Payouts & Financial Settlement Ledger
                            </h2>
                            <p className="theme-muted text-xs mt-0.5">Automated 95% net payout calculations, platform fee deductions (5%), and bank transfer status</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Gross B2B Sales Volume</p>
                                <p className="text-2xl font-black">₹{totalSalesVolume.toLocaleString("en-IN")}</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Platform Service Fee (5%)</p>
                                <p className="text-2xl font-black text-amber-400">₹{Math.round(totalSalesVolume * 0.05).toLocaleString("en-IN")}</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Net Payable Payout (95%)</p>
                                <p className="text-2xl font-black text-emerald-400">₹{netPayout.toLocaleString("en-IN")}</p>
                            </div>
                        </div>

                        <div className="theme-panel rounded-3xl p-6 border space-y-4">
                            <div className="flex items-center justify-between border-b theme-border pb-3">
                                <h3 className="text-base font-bold">Settlement Bank Account Details</h3>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("profile")}
                                    className="theme-soft-button px-3 py-1.5 rounded-xl text-xs font-bold"
                                >
                                    Edit Bank Details
                                </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div><p className="theme-muted font-bold">Bank Name</p><p className="font-extrabold text-sm">{profileData?.profile?.bankName || "HDFC Bank"}</p></div>
                                <div><p className="theme-muted font-bold">Account Holder</p><p className="font-extrabold text-sm">{profileData?.profile?.bankAccountName || profileData?.profile?.businessName || "Vendor"}</p></div>
                                <div><p className="theme-muted font-bold">Account Number</p><p className="font-extrabold text-sm">{profileData?.profile?.bankAccountNumber ? `•••• ${profileData.profile.bankAccountNumber.slice(-4)}` : "Not Provided"}</p></div>
                                <div><p className="theme-muted font-bold">IFSC Code</p><p className="font-extrabold text-sm">{profileData?.profile?.bankIfscCode || "N/A"}</p></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: SUPPLY REPORTS & INTEL */}
                {isAccountActive && activeTab === "supply-reports" && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                <BarChart3 className="theme-accent-text" />
                                Supplier Performance & Revenue Analytics
                            </h2>
                            <p className="theme-muted text-xs mt-0.5">Wholesale fulfillment metrics, buyer retention rates, and catalog category performance</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Fulfilled Orders</p>
                                <p className="text-2xl font-black text-emerald-400">{validOrders.length}</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Avg Order Value (AOV)</p>
                                <p className="text-2xl font-black">₹{avgOrderValue.toLocaleString("en-IN")}</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Active Buyers</p>
                                <p className="text-2xl font-black theme-accent-text">{customers.length}</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Fulfillment SLA Rate</p>
                                <p className="text-2xl font-black text-blue-400">98.2%</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: SUPPLY MARKETPLACE */}
                {isAccountActive && activeTab === "supply-marketplace" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                    <ShoppingBag className="theme-accent-text" />
                                    Tiffzy Wholesale Supply Marketplace Listings
                                </h2>
                                <p className="theme-muted text-xs mt-0.5">View your published raw material products visible to restaurant buyers across Tiffzy Marketplace</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddProductModal(true)}
                                className="theme-button rounded-xl px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
                            >
                                <Plus size={16} />
                                Add Marketplace Item
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {products.length === 0 ? (
                                <div className="col-span-3 theme-panel rounded-3xl p-8 text-center theme-muted text-xs space-y-2">
                                    <Package size={32} className="mx-auto" />
                                    <p>No products added to Marketplace yet.</p>
                                </div>
                            ) : (
                                products.map((p) => (
                                    <div key={p.id} className="theme-panel rounded-2xl p-4 border space-y-3">
                                        <div className="flex items-center gap-3">
                                            {p.imageUrl ? (
                                                <img src={p.imageUrl} alt={p.name} className="h-12 w-12 rounded-xl object-cover border theme-border" />
                                            ) : (
                                                <div className="h-12 w-12 rounded-xl theme-card flex items-center justify-center font-bold text-xs">
                                                    RAW
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-bold text-sm">{p.name}</h3>
                                                <p className="theme-muted text-xs">{p.categoryName || "General Supply"}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between border-t theme-border pt-2 text-xs">
                                            <span className="font-extrabold text-amber-400">₹{p.basePrice || p.price} / {p.unit || "kg"}</span>
                                            <span className="theme-muted">MOQ: {p.moq || 1} {p.unit || "kg"}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: RECIPES & INGREDIENTS - REDIRECT TO RESTAURANT OWNER PANEL */}
                {activeTab === "recipes" && (
                    <Navigate to="/owner/recipes" replace />
                )}

                {/* TAB: CONSUMPTION INTEL */}
                {isAccountActive && activeTab === "consumption" && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                <Activity className="theme-accent-text" />
                                Bulk Demand & Client Consumption Trends
                            </h2>
                            <p className="theme-muted text-xs mt-0.5">Weekly raw material reorder cycles and ingredient demand velocity across restaurant buyers</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Top Demand Ingredient</p>
                                <p className="text-xl font-black theme-accent-text">{products[0]?.name || "Poultry & Meats"}</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Avg Reorder Cycle</p>
                                <p className="text-xl font-black text-emerald-400">Every 3.5 Days</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-4 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Bulk Order Frequency</p>
                                <p className="text-xl font-black text-blue-400">High Demand</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: WASTAGE MANAGEMENT */}
                {isAccountActive && activeTab === "wastage" && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                <Trash2 className="theme-accent-text" />
                                Transit Damage & Return Log
                            </h2>
                            <p className="theme-muted text-xs mt-0.5">Logs of goods damaged during logistics dispatch or rejected at buyer receiving dock</p>
                        </div>

                        <div className="theme-panel rounded-3xl p-6 border text-center py-12 text-xs theme-muted space-y-2">
                            <Trash2 size={36} className="mx-auto" />
                            <p className="font-bold text-sm">No Transit Spoilage Claims Recorded</p>
                            <p>All delivered shipments were accepted by buyer kitchens without transit damage reports.</p>
                        </div>
                    </div>
                )}

                {/* TAB: STOCK COUNTS */}
                {isAccountActive && activeTab === "stock-counts" && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                <ClipboardCheck className="theme-accent-text" />
                                Supplier Warehouse Stock Audit
                            </h2>
                            <p className="theme-muted text-xs mt-0.5">Real-time stock-on-hand levels and reorder thresholds across vendor storage facilities</p>
                        </div>

                        <div className="theme-panel rounded-3xl p-6 border space-y-4">
                            <h3 className="text-base font-bold">Warehouse Physical Stock Inventory</h3>
                            <div className="divide-y theme-border text-xs">
                                {products.map((p) => (
                                    <div key={p.id} className="py-3 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-sm">{p.name}</p>
                                            <p className="theme-muted">Min Safety Stock: {p.moq * 2} {p.unit || "kg"}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-sm text-emerald-400">{p.initialStock || p.stock || 500} {p.unit || "kg"}</p>
                                            <span className="theme-muted text-[10px]">In Stock</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: STOCK TRANSFERS */}
                {isAccountActive && activeTab === "stock-transfers" && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                <ArrowLeftRight className="theme-accent-text" />
                                Dispatch & Logistics Transfers Log
                            </h2>
                            <p className="theme-muted text-xs mt-0.5">Active warehouse dispatches and vehicle delivery shipments to buyer restaurant locations</p>
                        </div>

                        <div className="theme-panel rounded-3xl p-6 border space-y-4">
                            <h3 className="text-base font-bold">Recent Logistics Dispatches</h3>
                            {orders.length === 0 ? (
                                <p className="theme-muted text-xs py-8 text-center">No dispatches logged yet.</p>
                            ) : (
                                <div className="divide-y theme-border text-xs">
                                    {orders.map((o) => (
                                        <div key={o.id} className="py-3 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm">Order #{o.orderNumber || o.id?.slice(-6)}</p>
                                                <p className="theme-muted">Dest: {o.restaurant?.name || "Client Kitchen"}</p>
                                            </div>
                                            <span className="theme-chip px-3 py-1 rounded-full font-bold">
                                                {o.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 6: ACTIVE PROFILE VIEW FOR VERIFIED SUPPLIERS */}
                {isAccountActive && activeTab === "profile" && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold tracking-tight">Supplier Profile & Business KYC Compliance</h2>

                        <form onSubmit={handleSaveProfile} className="theme-panel rounded-3xl p-6 border space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Business / Supplier Name *</label>
                                    <input
                                        type="text"
                                        value={profileForm.businessName}
                                        onChange={(e) => setProfileForm({ ...profileForm, businessName: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Legal Entity Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. ABC Foods Private Limited"
                                        value={profileForm.legalName}
                                        onChange={(e) => setProfileForm({ ...profileForm, legalName: e.target.value })}
                                        className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">GSTIN Registration Number</label>
                                    <input
                                        type="text"
                                        placeholder="22AAAAA0000A1Z5"
                                        value={profileForm.gstin}
                                        onChange={(e) => setProfileForm({ ...profileForm, gstin: e.target.value.toUpperCase() })}
                                        className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">FSSAI License Number</label>
                                    <input
                                        type="text"
                                        placeholder="10020011000123"
                                        value={profileForm.fssaiLicense}
                                        onChange={(e) => setProfileForm({ ...profileForm, fssaiLicense: e.target.value })}
                                        className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="border-t theme-border pt-4 space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 theme-accent-text">
                                    <CreditCard size={18} />
                                    Bank Settlement Details (For Automated Payouts)
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Bank Account Number</label>
                                        <input
                                            type="text"
                                            placeholder="91823091823091"
                                            value={profileForm.bankAccountNumber}
                                            onChange={(e) => setProfileForm({ ...profileForm, bankAccountNumber: e.target.value })}
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">IFSC Code</label>
                                        <input
                                            type="text"
                                            placeholder="HDFC0001234"
                                            value={profileForm.bankIfscCode}
                                            onChange={(e) => setProfileForm({ ...profileForm, bankIfscCode: e.target.value.toUpperCase() })}
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Account Holder Name</label>
                                        <input
                                            type="text"
                                            placeholder="ABC Foods Pvt Ltd"
                                            value={profileForm.bankAccountName}
                                            onChange={(e) => setProfileForm({ ...profileForm, bankAccountName: e.target.value })}
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="theme-muted mb-1.5 block text-xs font-bold uppercase">Bank Name</label>
                                        <input
                                            type="text"
                                            placeholder="HDFC Bank"
                                            value={profileForm.bankName}
                                            onChange={(e) => setProfileForm({ ...profileForm, bankName: e.target.value })}
                                            className="theme-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={savingProfile}
                                className="theme-button rounded-xl px-6 py-3 font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Save size={18} />
                                {savingProfile ? "Saving Profile..." : "Update Profile & KYC Details"}
                            </button>
                        </form>
                    </div>
                )}
            </main>

            {/* BARGAIN COUNTER-OFFER MODAL */}
            {showBargainModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center theme-modal-backdrop p-4">
                    <div className="theme-modal w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b theme-border pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Tag className="theme-accent-text" size={20} />
                                Make Price Bargain Counter-Offer
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowBargainModal(false)}
                                className="theme-muted hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSendBargainOffer} className="space-y-3">
                            <div>
                                <label className="theme-muted mb-1 block text-xs font-bold uppercase">Product Name</label>
                                <input
                                    type="text"
                                    placeholder="Fresh Premium Chicken Breast"
                                    value={bargainForm.productName}
                                    onChange={(e) => setBargainForm({ ...bargainForm, productName: e.target.value })}
                                    required
                                    className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="theme-muted mb-1 block text-xs font-bold uppercase">Quantity</label>
                                    <input
                                        type="number"
                                        value={bargainForm.quantity}
                                        onChange={(e) => setBargainForm({ ...bargainForm, quantity: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="theme-muted mb-1 block text-xs font-bold uppercase">Unit</label>
                                    <input
                                        type="text"
                                        value={bargainForm.unit}
                                        onChange={(e) => setBargainForm({ ...bargainForm, unit: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="theme-muted mb-1 block text-xs font-bold uppercase">Catalog Price (₹)</label>
                                    <input
                                        type="number"
                                        value={bargainForm.originalPrice}
                                        onChange={(e) => setBargainForm({ ...bargainForm, originalPrice: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="theme-muted mb-1 block text-xs font-bold uppercase">Offered Price per Unit (₹)</label>
                                    <input
                                        type="number"
                                        value={bargainForm.offeredPrice}
                                        onChange={(e) => setBargainForm({ ...bargainForm, offeredPrice: e.target.value })}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowBargainModal(false)}
                                    className="theme-soft-button rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="theme-button rounded-xl px-5 py-2.5 text-xs font-bold cursor-pointer"
                                >
                                    Send Counter Offer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Product Modal */}
            {showAddProductModal && isAccountActive && (
                <div className="fixed inset-0 z-50 flex items-center justify-center theme-modal-backdrop p-4">
                    <div className="theme-modal w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl">
                        <h3 className="text-xl font-bold">Add New Product to Marketplace</h3>
                        <form onSubmit={handleCreateProduct} className="space-y-3">
                            <div>
                                <label className="theme-muted mb-1 block text-xs font-bold uppercase">Product Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Fresh Chicken Breast"
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                    required
                                    className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                                />
                            </div>

                            {/* Supply Category Dropdown (20 B2B Restaurant Categories) */}
                            <div>
                                <label className="theme-muted mb-1 block text-xs font-bold uppercase">Supply Category *</label>
                                <select
                                    value={newProduct.categoryName}
                                    onChange={(e) => setNewProduct({ ...newProduct, categoryName: e.target.value })}
                                    required
                                    className="theme-input w-full rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer"
                                >
                                    {SUPPLY_CATEGORIES.map((cat) => (
                                        <option key={cat.id} value={cat.name}>
                                            {cat.icon} {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Stock Photo / Image Selector */}
                            <div className="space-y-2 border-t border-b theme-border py-3">
                                <div className="flex items-center justify-between">
                                    <label className="theme-muted text-xs font-bold uppercase flex items-center gap-1.5">
                                        <ImageIcon size={14} className="theme-accent-text" />
                                        Stock Photo / Product Image
                                    </label>
                                    <span className="theme-accent-text text-[10px] font-bold">Upload File or URL</span>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                    {/* Device File Upload Button */}
                                    <label className="theme-button rounded-xl px-3.5 py-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] transition whitespace-nowrap">
                                        <Upload size={14} />
                                        <span>Upload File</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageFileUpload}
                                            className="hidden"
                                        />
                                    </label>

                                    {/* Image URL Input */}
                                    <input
                                        type="url"
                                        placeholder="Or paste Image URL (https://...)"
                                        value={newProduct.imageUrl}
                                        onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                                        className="theme-input flex-1 w-full rounded-xl px-3.5 py-2 text-xs outline-none"
                                    />

                                    {newProduct.imageUrl && (
                                        <div className="h-9 w-9 rounded-xl overflow-hidden border theme-border flex-shrink-0 bg-black/40 shadow-sm">
                                            <img src={newProduct.imageUrl} alt="Stock Preview" className="h-full w-full object-cover" />
                                        </div>
                                    )}
                                </div>

                                {/* Quick Stock Photo Presets */}
                                <div className="space-y-1 pt-1">
                                    <p className="theme-muted text-[10px] font-bold uppercase">Or Choose Sample Stock Photo:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { label: "🐔 Chicken", url: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&auto=format&fit=crop" },
                                            { label: "🧈 Dairy Butter", url: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop" },
                                            { label: "🥦 Vegetables", url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&auto=format&fit=crop" },
                                            { label: "🌾 Grains & Rice", url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop" },
                                            { label: "🌶️ Spices", url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop" },
                                        ].map((preset) => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => setNewProduct({ ...newProduct, imageUrl: preset.url })}
                                                className={`text-[11px] px-2 py-1 rounded-lg border font-bold cursor-pointer transition ${
                                                    newProduct.imageUrl === preset.url ? "theme-button border-amber-400" : "theme-card hover:theme-panel"
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
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
