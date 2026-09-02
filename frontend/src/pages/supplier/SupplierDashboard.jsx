import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import BrandLogo from "../../components/BrandLogo";

export default function SupplierDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'products' | 'orders' | 'sales' | 'customers' | 'chat' | 'profile'
    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState(null);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);

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

    const loadData = async () => {
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
        { id: "profile", label: isAccountActive ? "Profile & KYC" : "KYC Verification Form", icon: Building2, locked: false },
    ];

    const activeThread = chatThreads.find((t) => t.id === activeThreadId);

    return (
        <div className="theme-page min-h-screen flex flex-col relative">
            {/* TOP HEADER BAR */}
            <header className="theme-nav sticky top-0 z-40 px-4 sm:px-6 py-4 border-b shadow-sm">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="theme-button px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer shadow-md"
                        >
                            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                            <span>{sidebarOpen ? "Close Menu" : "Menu"}</span>
                        </button>

                        <div className="flex items-center gap-2.5">
                            <div className="theme-card flex h-10 w-10 items-center justify-center rounded-2xl shadow-md">
                                <BrandLogo className="h-7 w-7" title="Brand logo" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">
                                    {profileData?.profile?.businessName || "Supplier Portal"}
                                </h1>
                                <p className="theme-muted text-xs font-medium hidden sm:block">
                                    Status:{" "}
                                    <span className={`font-bold ${isAccountActive ? "text-emerald-400" : "text-amber-400"}`}>
                                        {profileData?.status || "PENDING VERIFICATION"}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={loadData}
                            className="theme-soft-button rounded-xl px-3.5 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <LogOut size={14} />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* COLLAPSIBLE SIDEBAR MENU DRAWER */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 flex">
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
                        onClick={() => setSidebarOpen(false)}
                    />

                    <aside className="theme-sidebar relative z-10 w-72 max-w-[85vw] h-full p-4 flex flex-col justify-between shadow-2xl border-r theme-border animate-in slide-in-from-left duration-200">
                        <div>
                            <div className="flex items-center justify-between px-2 py-3 mb-4 border-b theme-border">
                                <div className="flex items-center gap-3">
                                    <div className="theme-card flex h-10 w-10 items-center justify-center rounded-2xl">
                                        <BrandLogo className="h-7 w-7" title="Brand logo" />
                                    </div>
                                    <div>
                                        <h1 className="text-lg font-bold">Tiffzy Supply</h1>
                                        <p className="theme-muted text-[11px]">Navigation Menu</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSidebarOpen(false)}
                                    className="theme-soft-button p-2 rounded-xl"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <nav className="space-y-1.5">
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
                                                setActiveTab(tab.id);
                                                setSidebarOpen(false);
                                            }}
                                            className={`w-full px-4 py-3 rounded-2xl text-sm font-bold transition flex items-center justify-between cursor-pointer ${
                                                tab.locked
                                                    ? "opacity-50 cursor-not-allowed theme-soft-button"
                                                    : isActive
                                                    ? "theme-button font-extrabold shadow-lg shadow-amber-500/20"
                                                    : "theme-soft-button hover:theme-panel"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon size={18} />
                                                <span>{tab.label}</span>
                                            </div>
                                            {tab.locked ? (
                                                <Lock size={14} className="theme-muted" />
                                            ) : tab.count !== undefined ? (
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                                                    isActive ? "bg-black/20 text-black" : "theme-card"
                                                }`}>
                                                    {tab.count}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="border-t theme-border pt-4 px-1 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <div className="truncate pr-2">
                                    <p className="font-bold truncate">{profileData?.profile?.businessName || "Supplier"}</p>
                                    <p className="theme-muted text-[11px]">Status: <span className="theme-accent-text font-bold">{profileData?.status || "PENDING"}</span></p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                                    title="Logout"
                                >
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            <main className="mx-auto max-w-7xl w-full p-4 sm:p-6 space-y-6 flex-1">

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
                                <p className="text-3xl font-black theme-accent-text">₹{totalSalesVolume.toLocaleString()}</p>
                            </div>

                            <div className="theme-panel rounded-2xl p-5 space-y-1.5 border shadow-sm">
                                <p className="theme-muted text-xs font-bold uppercase tracking-wider">Low Stock Alerts</p>
                                <p className="text-3xl font-black text-red-400">
                                    {products.filter((p) => (p.inventory?.availableStock || 0) <= 10).length}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Recent Catalog Products */}
                            <div className="theme-panel rounded-3xl p-6 border space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg">Catalog Products</h3>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("products")}
                                        className="text-xs font-bold theme-accent-text hover:underline"
                                    >
                                        View All ({products.length})
                                    </button>
                                </div>
                                {products.length === 0 ? (
                                    <p className="theme-muted text-sm py-4 text-center">No products published yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {products.slice(0, 4).map((p) => (
                                            <div key={p.id} className="flex items-center justify-between border-b theme-border pb-3 text-sm">
                                                <div>
                                                    <p className="font-bold">{p.name}</p>
                                                    <p className="theme-muted text-xs">MOQ: {p.moq} {p.unit}</p>
                                                </div>
                                                <span className="font-bold theme-accent-text">₹{p.prices?.[0]?.basePrice || 100} / {p.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Live Orders */}
                            <div className="theme-panel rounded-3xl p-6 border space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg">Recent B2B Orders</h3>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("orders")}
                                        className="text-xs font-bold theme-accent-text hover:underline"
                                    >
                                        View All ({orders.length})
                                    </button>
                                </div>
                                {orders.length === 0 ? (
                                    <p className="theme-muted text-sm py-4 text-center">No incoming orders yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {orders.slice(0, 4).map((o) => (
                                            <div key={o.id} className="flex items-center justify-between border-b theme-border pb-3 text-sm">
                                                <div>
                                                    <p className="font-bold theme-accent-text">{o.orderNo}</p>
                                                    <p className="theme-muted text-xs">{o.restaurant?.name || "Tiffzy Cafe"}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold">₹{o.totalAmount}</p>
                                                    <p className="theme-muted text-xs">{o.status}</p>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {products.map((p) => {
                                    const imgUrl = p.images?.[0]?.imageUrl || p.imageUrl;
                                    return (
                                        <div key={p.id} className="theme-panel rounded-2xl p-4 space-y-3 border shadow-sm">
                                            {imgUrl ? (
                                                <div className="h-36 w-full rounded-xl overflow-hidden border theme-border bg-black/40 shadow-inner">
                                                    <img src={imgUrl} alt={p.name} className="h-full w-full object-cover hover:scale-105 transition duration-300" />
                                                </div>
                                            ) : null}

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
                        <h2 className="text-xl font-bold tracking-tight">Sales Analytics & Revenue Overview</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="theme-panel rounded-2xl p-5 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Gross B2B Sales</p>
                                <p className="text-3xl font-black theme-accent-text">₹{totalSalesVolume.toLocaleString()}</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-5 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Estimated Net Payout (95%)</p>
                                <p className="text-3xl font-black text-emerald-400">₹{netPayout.toLocaleString()}</p>
                                <p className="theme-muted text-[11px]">5% Platform commission deducted</p>
                            </div>
                            <div className="theme-panel rounded-2xl p-5 border space-y-1">
                                <p className="theme-muted text-xs font-bold uppercase">Average Order Value (AOV)</p>
                                <p className="text-3xl font-black">₹{avgOrderValue.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="theme-panel rounded-3xl p-6 border space-y-4">
                            <h3 className="text-lg font-bold">Recent Order Sales Summary</h3>
                            {validOrders.length === 0 ? (
                                <p className="theme-muted text-sm">No completed sales orders recorded yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {validOrders.map((o) => (
                                        <div key={o.id} className="flex items-center justify-between border-b theme-border pb-2 text-sm">
                                            <div>
                                                <p className="font-bold theme-accent-text">{o.orderNo}</p>
                                                <p className="theme-muted text-xs">Client: {o.restaurant?.name || "Restaurant Client"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold">₹{o.totalAmount}</p>
                                                <p className="theme-muted text-xs">{o.status}</p>
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
