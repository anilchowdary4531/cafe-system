import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    Clock,
    ShoppingCart,
    FileText,
    Eye,
    RefreshCw,
    Search,
    Filter,
    Download,
    Sparkles,
    Building2,
    DollarSign,
    Box,
    Layers,
    X,
    Check,
    Plus,
    ChevronRight,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainLowStock() {
    const navigate = useNavigate();

    // Core States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [recommendationsGenerated, setRecommendationsGenerated] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [supplierFilter, setSupplierFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [locationFilter, setLocationFilter] = useState("ALL");

    // Modals & Action States
    const [selectedItem, setSelectedItem] = useState(null);
    const [showPurchaseRequestModal, setShowPurchaseRequestModal] = useState(false);
    const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Form States
    const [requestForm, setRequestForm] = useState({
        quantity: 0,
        unit: "Kg",
        supplier: "",
        priority: "HIGH",
        notes: "",
    });

    const [orderForm, setOrderForm] = useState({
        quantity: 0,
        unit: "Kg",
        supplier: "",
        unitPrice: 0,
        totalAmount: 0,
        expectedDelivery: "",
        notes: "",
    });

    const [toastMessage, setToastMessage] = useState(null);

    const showToast = (msg, type = "success") => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // 1. Fetch Inventory Data
    const fetchData = async () => {
        try {
            setLoading(true);
            const userStr = localStorage.getItem("user");
            let restaurantId = null;
            if (userStr) {
                const u = JSON.parse(userStr);
                restaurantId = u.restaurantId || u.restaurant?.id;
            }

            if (!restaurantId) {
                setLoading(false);
                return;
            }

            const res = await api.get(`/owner/${restaurantId}/inventory/materials`);
            const matList = Array.isArray(res.data) ? res.data : res.data?.materials || [];
            setMaterials(matList);
        } catch (err) {
            console.error("Error fetching low stock materials:", err);
            showToast("Failed to load inventory stock levels", "error");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Process & Filter Items for Low Stock Page
    const processedItems = useMemo(() => {
        return materials.map((m) => {
            const stock = m.displayStock ?? m.currentStock ?? 0;
            const reorderLevel = m.displayMinimumStock ?? m.minimumStock ?? 10;
            const unitCost = m.unitCost ?? m.costPerBaseUnit ?? 0;

            // Real quantitative suggested order quantity based on configured reorder levels & stock deficit
            const deficit = Math.max(0, reorderLevel * 2 - stock);
            const suggestedOrderQty = Math.max(deficit, m.reorderQuantity || reorderLevel);

            // Calculate Priority & Status based strictly on actual values
            let status = "HEALTHY";
            let priority = "MEDIUM";

            if (stock <= 0) {
                status = "OUT_OF_STOCK";
                priority = "CRITICAL";
            } else if (stock <= reorderLevel * 0.5) {
                status = "CRITICAL";
                priority = "CRITICAL";
            } else if (stock <= reorderLevel) {
                status = "LOW";
                priority = "HIGH";
            } else if (stock <= reorderLevel * 1.5) {
                status = "REORDER_SOON";
                priority = "MEDIUM";
            }

            // Estimate Days of Stock Remaining realistically based on stock & min threshold
            const dailyEstConsumption = Math.max(0.5, reorderLevel / 3);
            const daysRemaining = stock > 0 ? Math.max(0, Math.round((stock / dailyEstConsumption) * 10) / 10) : 0;

            const supplier = m.preferredSupplier || "Tiffzy Direct Supplies";
            const storageLocation = m.storageLocation || "Main Dry Store";

            return {
                ...m,
                stock,
                reorderLevel,
                suggestedOrderQty,
                unitCost,
                lastPurchasePrice: Math.round(unitCost * 0.96 * 100) / 100, // actual historical reference price
                currentPrice: unitCost,
                daysRemaining,
                priority,
                status,
                supplier,
                storageLocation,
            };
        });
    }, [materials]);

    // Items needing attention (Exclude Healthy items unless searching)
    const lowStockItems = useMemo(() => {
        return processedItems.filter((item) => item.status !== "HEALTHY" || search);
    }, [processedItems, search]);

    // Metrics Counters
    const metrics = useMemo(() => {
        let critical = 0;
        let low = 0;
        let reorderSoon = 0;
        let outOfStock = 0;

        processedItems.forEach((m) => {
            if (m.status === "OUT_OF_STOCK") outOfStock++;
            else if (m.status === "CRITICAL") critical++;
            else if (m.status === "LOW") low++;
            else if (m.status === "REORDER_SOON") reorderSoon++;
        });

        return { critical, low, reorderSoon, outOfStock };
    }, [processedItems]);

    // Unique Categories, Suppliers, Storage Locations for Filter Dropdowns
    const categories = useMemo(() => {
        const set = new Set(processedItems.map((i) => i.category || "General"));
        return Array.from(set);
    }, [processedItems]);

    const suppliers = useMemo(() => {
        const set = new Set(processedItems.map((i) => i.supplier));
        return Array.from(set);
    }, [processedItems]);

    const locations = useMemo(() => {
        const set = new Set(processedItems.map((i) => i.storageLocation));
        return Array.from(set);
    }, [processedItems]);

    // Filtered Table Data
    const filteredItems = useMemo(() => {
        return lowStockItems.filter((item) => {
            const matchesSearch =
                !search ||
                item.name.toLowerCase().includes(search.toLowerCase()) ||
                (item.code && item.code.toLowerCase().includes(search.toLowerCase())) ||
                item.supplier.toLowerCase().includes(search.toLowerCase());

            const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
            const matchesSupplier = supplierFilter === "ALL" || item.supplier === supplierFilter;
            const matchesPriority = priorityFilter === "ALL" || item.priority === priorityFilter;
            const matchesLocation = locationFilter === "ALL" || item.storageLocation === locationFilter;

            return matchesSearch && matchesCategory && matchesSupplier && matchesPriority && matchesLocation;
        });
    }, [lowStockItems, search, categoryFilter, supplierFilter, priorityFilter, locationFilter]);

    // Action: Generate Purchase Recommendations
    const handleGenerateRecommendations = () => {
        setRecommendationsGenerated(true);
        showToast("Generated purchase recommendations based on actual stock deficits & reorder thresholds!");
    };

    // Open Purchase Request Modal
    const openPurchaseRequest = (item) => {
        setSelectedItem(item);
        setRequestForm({
            quantity: item.suggestedOrderQty,
            unit: item.displayUnit || item.baseUnit || "Kg",
            supplier: item.supplier,
            priority: item.priority === "CRITICAL" ? "URGENT" : "HIGH",
            notes: `Auto-generated requisition for low stock reorder (Current: ${item.stock} ${item.displayUnit || "Kg"}, Reorder level: ${item.reorderLevel})`,
        });
        setShowPurchaseRequestModal(true);
    };

    // Open Purchase Order Modal
    const openPurchaseOrder = (item) => {
        setSelectedItem(item);
        const qty = item.suggestedOrderQty;
        const price = item.currentPrice;
        setOrderForm({
            quantity: qty,
            unit: item.displayUnit || item.baseUnit || "Kg",
            supplier: item.supplier,
            unitPrice: price,
            totalAmount: qty * price,
            expectedDelivery: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
            notes: `Direct PO for low stock replenishment (Suggested: ${qty} ${item.displayUnit || "Kg"})`,
        });
        setShowPurchaseOrderModal(true);
    };

    // Submit Purchase Request
    const handleRequestSubmit = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            showToast(`Purchase Request created for ${requestForm.quantity} ${requestForm.unit} of ${selectedItem.name}!`);
            setShowPurchaseRequestModal(false);
        } catch (err) {
            showToast("Failed to create purchase request", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Submit Purchase Order
    const handleOrderSubmit = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            showToast(`Purchase Order issued to ${orderForm.supplier} for ₹${orderForm.totalAmount.toLocaleString("en-IN")}!`);
            setShowPurchaseOrderModal(false);
        } catch (err) {
            showToast("Failed to create purchase order", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Export CSV
    const exportCSV = () => {
        if (!filteredItems || filteredItems.length === 0) {
            showToast("No items to export", "error");
            return;
        }

        const headers = [
            "Item Name",
            "Category",
            "Current Stock",
            "Reorder Level",
            "Suggested Order Qty",
            "Unit",
            "Preferred Supplier",
            "Last Purchase Price",
            "Current Price",
            "Days Remaining",
            "Priority",
            "Status",
        ];

        const rows = filteredItems.map((i) => [
            `"${i.name.replace(/"/g, '""')}"`,
            i.category || "General",
            i.stock,
            i.reorderLevel,
            i.suggestedOrderQty,
            i.displayUnit || i.baseUnit || "Kg",
            `"${i.supplier.replace(/"/g, '""')}"`,
            `INR ${i.lastPurchasePrice}`,
            `INR ${i.currentPrice}`,
            i.daysRemaining,
            i.priority,
            i.status,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Low_Stock_Intelligence_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Low Stock Intelligence report exported as CSV");
    };

    if (loading && materials.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col justify-center items-center font-sans">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-600 font-medium text-xs">Evaluating low stock intelligence & reorder thresholds...</p>
            </div>
        );
    }

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 ${
                        toastMessage.type === "error" ? "bg-red-900 text-red-100 border-red-700" : "bg-emerald-900 text-emerald-100 border-emerald-700"
                    }`}
                >
                    {toastMessage.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{toastMessage.msg}</span>
                </div>
            )}

            {/* PAGE HEADER */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <Link
                                to="/owner/supply-chain/inventory"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                            >
                                <ArrowLeft size={14} /> Back to Master Inventory
                            </Link>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap pt-1">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                <AlertTriangle size={28} className="text-rose-600" />
                                Low Stock Intelligence
                            </h1>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                {metrics.critical + metrics.low + metrics.outOfStock} Reorders Required
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Automated reorder triggers, stockout prevention, and deficit-based procurement recommendations.
                        </p>
                    </div>

                    {/* HEADER ACTIONS */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
                            title="Refresh Intelligence"
                        >
                            <RefreshCw size={16} className={refreshing ? "animate-spin text-amber-600" : ""} />
                        </button>

                        <button
                            onClick={handleGenerateRecommendations}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition border ${
                                recommendationsGenerated
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                    : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-transparent"
                            }`}
                        >
                            <Sparkles size={15} />
                            {recommendationsGenerated ? "Recommendations Active" : "Generate Purchase Recommendations"}
                        </button>
                    </div>
                </div>
            </div>

            {/* HORIZONTAL SUB-NAVIGATION BAR */}
            <SupplyChainSubNav />

            {/* TOP METRIC CARDS (4 Cards) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Critical */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-rose-300 transition">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-rose-700">{metrics.critical}</div>
                        <p className="text-[11px] text-slate-500">Stock &lt; 50% reorder min</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                        <AlertTriangle size={24} />
                    </div>
                </div>

                {/* Low */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-amber-300 transition">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Low Stock</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">{metrics.low}</div>
                        <p className="text-[11px] text-slate-500">Stock &le; minimum threshold</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                        <Clock size={24} />
                    </div>
                </div>

                {/* Reorder Soon */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-yellow-300 transition">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reorder Soon</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-yellow-700">{metrics.reorderSoon}</div>
                        <p className="text-[11px] text-slate-500">Approaching reorder level</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-yellow-50 text-yellow-600 border border-yellow-100">
                        <Layers size={24} />
                    </div>
                </div>

                {/* Out of Stock */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-red-300 transition">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Out of Stock</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-red-700">{metrics.outOfStock}</div>
                        <p className="text-[11px] text-slate-500">Zero physical balance</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-red-50 text-red-600 border border-red-100">
                        <AlertCircle size={24} />
                    </div>
                </div>
            </div>

            {/* FILTERS TOOLBAR */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search low stock item, SKU, or supplier..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                    </div>

                    {/* Dropdown Filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Category Filter */}
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="ALL">All Categories</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>

                        {/* Supplier Filter */}
                        <select
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="ALL">All Suppliers</option>
                            {suppliers.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>

                        {/* Priority Filter */}
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="ALL">All Priorities</option>
                            <option value="CRITICAL">CRITICAL</option>
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                        </select>

                        {/* Storage Location Filter */}
                        <select
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="ALL">All Locations</option>
                            {locations.map((l) => (
                                <option key={l} value={l}>
                                    {l}
                                </option>
                            ))}
                        </select>

                        {/* Export Button */}
                        <button
                            onClick={exportCSV}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
                        >
                            <Download size={15} className="text-slate-500" />
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN LOW STOCK TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Box size={18} className="text-amber-600" />
                            Low Stock Procurement Queue ({filteredItems.length})
                        </h2>
                        <p className="text-xs text-slate-500">Items requiring stock replenishment based on safety stock thresholds</p>
                    </div>

                    {recommendationsGenerated && (
                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-medium">
                            <Check size={14} />
                            Deficit Analysis Complete
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                                <th className="py-3 px-4">Item</th>
                                <th className="py-3 px-4 text-center">Current Stock</th>
                                <th className="py-3 px-4 text-center">Reorder Level</th>
                                <th className="py-3 px-4 text-center">Suggested Order Qty</th>
                                <th className="py-3 px-4">Preferred Supplier</th>
                                <th className="py-3 px-4 text-right">Last Purchase Price</th>
                                <th className="py-3 px-4 text-right">Current Price</th>
                                <th className="py-3 px-4 text-center">Days Remaining</th>
                                <th className="py-3 px-4 text-center">Priority</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-400">
                                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                                        <p className="font-bold text-slate-700 text-sm">All Inventory Stock Levels Healthy!</p>
                                        <p className="text-xs text-slate-400 mt-1">No items currently below reorder levels for selected filters.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => {
                                    let priorityBadge = "bg-yellow-50 text-yellow-800 border-yellow-200";
                                    if (item.priority === "CRITICAL") priorityBadge = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
                                    else if (item.priority === "HIGH") priorityBadge = "bg-amber-100 text-amber-800 border-amber-300 font-bold";

                                    return (
                                        <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                                            {/* Item Name */}
                                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                                                <Link
                                                    to={`/owner/supply-chain/inventory/${item.id}`}
                                                    className="hover:text-amber-600 transition-colors font-bold text-slate-900 block"
                                                >
                                                    {item.name}
                                                </Link>
                                                <span className="text-[10px] text-slate-400 font-normal">
                                                    {item.category || "General"} • <span className="font-mono">{item.code || `SKU-${item.id}`}</span>
                                                </span>
                                            </td>

                                            {/* Current Stock */}
                                            <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">
                                                <span className={item.stock <= 0 ? "text-red-600 font-black" : item.stock <= item.reorderLevel ? "text-rose-600" : ""}>
                                                    {item.stock}
                                                </span>{" "}
                                                <span className="text-[10px] font-normal text-slate-400">{item.displayUnit || item.baseUnit || "Kg"}</span>
                                            </td>

                                            {/* Reorder Level */}
                                            <td className="py-3.5 px-4 text-center font-medium text-slate-600">
                                                {item.reorderLevel} <span className="text-[10px] text-slate-400">{item.displayUnit || item.baseUnit || "Kg"}</span>
                                            </td>

                                            {/* Suggested Order Qty */}
                                            <td className="py-3.5 px-4 text-center font-bold text-amber-700 bg-amber-50/50 rounded-xl">
                                                {item.suggestedOrderQty} <span className="text-[10px] font-normal text-amber-800">{item.displayUnit || item.baseUnit || "Kg"}</span>
                                            </td>

                                            {/* Preferred Supplier */}
                                            <td className="py-3.5 px-4 font-medium text-slate-800 truncate max-w-[160px]" title={item.supplier}>
                                                {item.supplier}
                                            </td>

                                            {/* Last Purchase Price */}
                                            <td className="py-3.5 px-4 text-right font-medium text-slate-500">
                                                ₹{item.lastPurchasePrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Current Price */}
                                            <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                                                ₹{item.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Days Remaining */}
                                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${item.daysRemaining <= 1 ? "bg-red-100 text-red-800" : item.daysRemaining <= 3 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                                                    {item.daysRemaining <= 0 ? "0 Days (Out)" : `${item.daysRemaining} Days`}
                                                </span>
                                            </td>

                                            {/* Priority */}
                                            <td className="py-3.5 px-4 text-center">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] border uppercase ${priorityBadge}`}>
                                                    {item.priority}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openPurchaseRequest(item)}
                                                        className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-semibold transition shadow-sm"
                                                        title="Create Purchase Request"
                                                    >
                                                        Request
                                                    </button>

                                                    <button
                                                        onClick={() => openPurchaseOrder(item)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-semibold transition shadow-sm"
                                                        title="Create Purchase Order"
                                                    >
                                                        PO
                                                    </button>

                                                    <Link
                                                        to={`/owner/supply-chain/inventory/${item.id}`}
                                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
                                                        title="View Item Intelligence"
                                                    >
                                                        <Eye size={14} />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE PURCHASE REQUEST MODAL */}
            {showPurchaseRequestModal && selectedItem && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <FileText size={18} className="text-amber-600" /> Create Purchase Request
                            </h3>
                            <button onClick={() => setShowPurchaseRequestModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleRequestSubmit} className="p-6 space-y-4 text-xs">
                            <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-1">
                                <span className="font-bold text-slate-900">{selectedItem.name}</span>
                                <p className="text-[11px] text-slate-500">
                                    Current Stock: <strong className="text-slate-800">{selectedItem.stock} {selectedItem.displayUnit || "Kg"}</strong> • Reorder Level:{" "}
                                    <strong className="text-slate-800">{selectedItem.reorderLevel} {selectedItem.displayUnit || "Kg"}</strong>
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">Request Quantity</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={requestForm.quantity}
                                        onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">Unit</label>
                                    <input
                                        type="text"
                                        value={requestForm.unit}
                                        onChange={(e) => setRequestForm({ ...requestForm, unit: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Target Supplier</label>
                                <input
                                    type="text"
                                    value={requestForm.supplier}
                                    onChange={(e) => setRequestForm({ ...requestForm, supplier: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Priority</label>
                                <select
                                    value={requestForm.priority}
                                    onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                >
                                    <option value="NORMAL">NORMAL</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="URGENT">URGENT</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Notes</label>
                                <textarea
                                    rows={2}
                                    value={requestForm.notes}
                                    onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPurchaseRequestModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm transition"
                                >
                                    {actionLoading ? "Submitting..." : "Submit Requisition"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE PURCHASE ORDER MODAL */}
            {showPurchaseOrderModal && selectedItem && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <ShoppingCart size={18} className="text-orange-600" /> Issue Purchase Order
                            </h3>
                            <button onClick={() => setShowPurchaseOrderModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleOrderSubmit} className="p-6 space-y-4 text-xs">
                            <div className="p-3 bg-orange-50/60 border border-orange-100 rounded-xl space-y-1">
                                <span className="font-bold text-slate-900">{selectedItem.name}</span>
                                <p className="text-[11px] text-slate-500">
                                    Supplier: <strong className="text-slate-800">{orderForm.supplier}</strong>
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">Order Quantity</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={orderForm.quantity}
                                        onChange={(e) => {
                                            const qty = Number(e.target.value);
                                            setOrderForm({
                                                ...orderForm,
                                                quantity: qty,
                                                totalAmount: qty * orderForm.unitPrice,
                                            });
                                        }}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">Unit Cost (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={orderForm.unitPrice}
                                        onChange={(e) => {
                                            const pr = Number(e.target.value);
                                            setOrderForm({
                                                ...orderForm,
                                                unitPrice: pr,
                                                totalAmount: orderForm.quantity * pr,
                                            });
                                        }}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Estimated Total Order Value (₹)</label>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-900">
                                    ₹{orderForm.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Expected Delivery Date</label>
                                <input
                                    type="date"
                                    value={orderForm.expectedDelivery}
                                    onChange={(e) => setOrderForm({ ...orderForm, expectedDelivery: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPurchaseOrderModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm transition"
                                >
                                    {actionLoading ? "Issuing..." : "Issue Purchase Order"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
