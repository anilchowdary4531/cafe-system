import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Clock,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    Calendar,
    RefreshCw,
    Search,
    Filter,
    Download,
    Eye,
    Trash2,
    ArrowRightLeft,
    RotateCcw,
    X,
    Check,
    Box,
    Building2,
    QrCode,
    FileText,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainExpiry() {
    const navigate = useNavigate();

    // Core States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [batches, setBatches] = useState([]);
    const [metrics, setMetrics] = useState({
        expiringToday: 0,
        expiring3Days: 0,
        expiring7Days: 0,
        expired: 0,
    });

    // Filters
    const [search, setSearch] = useState("");
    const [dateFilterPreset, setDateFilterPreset] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [supplierFilter, setSupplierFilter] = useState("ALL");
    const [locationFilter, setLocationFilter] = useState("ALL");

    // Modal States
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showWastageModal, setShowWastageModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Form States
    const [wastageForm, setWastageForm] = useState({
        quantity: 0,
        reason: "Expired / Quality Spoilage",
    });

    const [transferForm, setTransferForm] = useState({
        targetLocation: "Kitchen Prep Bay",
        quantity: 0,
        notes: "Batch transfer to kitchen prep station",
    });

    const [returnForm, setReturnForm] = useState({
        quantity: 0,
        reason: "Near Expiry / Vendor Return",
        notes: "",
    });

    const [toastMessage, setToastMessage] = useState(null);

    const showToast = (msg, type = "success") => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // 1. Fetch Batches from Backend API
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

            const res = await api.get(`/owner/${restaurantId}/inventory/batches`);
            const batchList = res.data?.batches || [];
            const resMetrics = res.data?.metrics || { expiringToday: 0, expiring3Days: 0, expiring7Days: 0, expired: 0 };

            setBatches(batchList);
            setMetrics(resMetrics);
        } catch (err) {
            console.error("Error fetching inventory batch expiry:", err);
            showToast("Failed to load inventory batch & expiry data", "error");
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

    // Extract Filter Options
    const categories = useMemo(() => {
        const set = new Set(batches.map((b) => b.category || "General"));
        return Array.from(set);
    }, [batches]);

    const suppliers = useMemo(() => {
        const set = new Set(batches.map((b) => b.supplier || "Tiffzy Direct Supplies"));
        return Array.from(set);
    }, [batches]);

    const locations = useMemo(() => {
        const set = new Set(batches.map((b) => b.storageLocation || "Main Dry Store"));
        return Array.from(set);
    }, [batches]);

    // Filtered Batches
    const filteredBatches = useMemo(() => {
        return batches.filter((b) => {
            const matchesSearch =
                !search ||
                b.itemName.toLowerCase().includes(search.toLowerCase()) ||
                b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
                b.supplier.toLowerCase().includes(search.toLowerCase());

            const matchesCategory = categoryFilter === "ALL" || b.category === categoryFilter;
            const matchesSupplier = supplierFilter === "ALL" || b.supplier === supplierFilter;
            const matchesLocation = locationFilter === "ALL" || b.storageLocation === locationFilter;

            let matchesDate = true;
            if (dateFilterPreset === "EXPIRED") matchesDate = b.daysRemaining < 0;
            else if (dateFilterPreset === "TODAY") matchesDate = b.daysRemaining === 0;
            else if (dateFilterPreset === "NEXT_3_DAYS") matchesDate = b.daysRemaining >= 0 && b.daysRemaining <= 3;
            else if (dateFilterPreset === "NEXT_7_DAYS") matchesDate = b.daysRemaining >= 0 && b.daysRemaining <= 7;

            return matchesSearch && matchesCategory && matchesSupplier && matchesLocation && matchesDate;
        });
    }, [batches, search, categoryFilter, supplierFilter, locationFilter, dateFilterPreset]);

    // Status Helper
    const getStatusBadge = (batch) => {
        if (batch.daysRemaining < 0) return { label: "Expired", color: "bg-red-100 text-red-800 border-red-300 font-extrabold" };
        if (batch.daysRemaining === 0) return { label: "Critical", color: "bg-rose-100 text-rose-800 border-rose-300 font-bold" };
        if (batch.daysRemaining <= 3) return { label: "Expiring Soon", color: "bg-amber-100 text-amber-800 border-amber-300 font-bold" };
        if (batch.daysRemaining <= 7) return { label: "Warning", color: "bg-yellow-100 text-yellow-800 border-yellow-300 font-medium" };
        return { label: "Healthy", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    };

    // Actions Handlers
    const openWastageModal = (batch) => {
        setSelectedBatch(batch);
        setWastageForm({ quantity: batch.quantity, reason: batch.daysRemaining < 0 ? "Expired Material Spoilage" : "Quality Assurance Spoilage" });
        setShowWastageModal(true);
    };

    const openTransferModal = (batch) => {
        setSelectedBatch(batch);
        setTransferForm({ targetLocation: "Kitchen Prep Bay", quantity: batch.quantity, notes: `Transfer batch ${batch.batchNumber} to prep station` });
        setShowTransferModal(true);
    };

    const openReturnModal = (batch) => {
        setSelectedBatch(batch);
        setReturnForm({ quantity: batch.quantity, reason: "Near Expiry / Vendor Return", notes: `Return batch ${batch.batchNumber} to supplier` });
        setShowReturnModal(true);
    };

    // Submit Wastage
    const handleWastageSubmit = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            const userStr = localStorage.getItem("user");
            let restaurantId = null;
            if (userStr) {
                const u = JSON.parse(userStr);
                restaurantId = u.restaurantId || u.restaurant?.id;
            }

            await api.post(`/owner/${restaurantId}/inventory/wastage`, {
                rawMaterialId: selectedBatch.rawMaterialId,
                quantity: Number(wastageForm.quantity),
                unit: selectedBatch.unit,
                reason: wastageForm.reason,
            });

            showToast(`Marked ${wastageForm.quantity} ${selectedBatch.unit} of ${selectedBatch.itemName} as Wastage`);
            setShowWastageModal(false);
            fetchData();
        } catch (err) {
            console.error("Error submitting wastage:", err);
            showToast("Failed to record wastage", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Submit Transfer
    const handleTransferSubmit = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            const userStr = localStorage.getItem("user");
            let restaurantId = null;
            if (userStr) {
                const u = JSON.parse(userStr);
                restaurantId = u.restaurantId || u.restaurant?.id;
            }

            await api.post(`/owner/${restaurantId}/inventory/adjustments`, {
                rawMaterialId: selectedBatch.rawMaterialId,
                quantity: Number(transferForm.quantity),
                unit: selectedBatch.unit,
                direction: "OUT",
                reason: `Inter-station transfer to ${transferForm.targetLocation}`,
            });

            showToast(`Transferred ${transferForm.quantity} ${selectedBatch.unit} to ${transferForm.targetLocation}`);
            setShowTransferModal(false);
            fetchData();
        } catch (err) {
            console.error("Error submitting transfer:", err);
            showToast("Failed to record transfer", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Submit Return to Supplier
    const handleReturnSubmit = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            showToast(`Vendor return initiated for ${returnForm.quantity} ${selectedBatch.unit} of ${selectedBatch.itemName}`);
            setShowReturnModal(false);
        } catch (err) {
            showToast("Failed to initiate vendor return", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Export CSV
    const exportCSV = () => {
        if (!filteredBatches || filteredBatches.length === 0) {
            showToast("No batch data to export", "error");
            return;
        }

        const headers = ["Item", "Batch Number", "Quantity", "Unit", "Received Date", "Expiry Date", "Days Remaining", "Storage Location", "Supplier", "Status"];
        const rows = filteredBatches.map((b) => [
            `"${b.itemName.replace(/"/g, '""')}"`,
            b.batchNumber,
            b.quantity,
            b.unit,
            new Date(b.receivedDate).toLocaleDateString("en-IN"),
            new Date(b.expiryDate).toLocaleDateString("en-IN"),
            b.daysRemaining,
            `"${b.storageLocation.replace(/"/g, '""')}"`,
            `"${b.supplier.replace(/"/g, '""')}"`,
            b.status,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Expiry_and_Batch_Management_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Batch & Expiry ledger exported as CSV");
    };

    if (loading && batches.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col justify-center items-center font-sans">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-600 font-medium text-xs">Evaluating batch shelf-life & expiry intelligence...</p>
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
                                <Clock size={28} className="text-amber-600" />
                                Expiry & Batch Management
                            </h1>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {metrics.expiringToday + metrics.expiring3Days + metrics.expired} Items Need Attention
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Track lot batch numbers, shelf-life expiration dates, storage rotation, and inventory spoilage risk.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
                            title="Refresh Data"
                        >
                            <RefreshCw size={16} className={refreshing ? "animate-spin text-amber-600" : ""} />
                        </button>
                    </div>
                </div>
            </div>

            {/* HORIZONTAL SUB-NAVIGATION BAR */}
            <SupplyChainSubNav />

            {/* TOP METRICS CARDS (4 Cards) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Expiring Today */}
                <div
                    onClick={() => setDateFilterPreset(dateFilterPreset === "TODAY" ? "ALL" : "TODAY")}
                    className={`bg-white rounded-2xl p-5 border shadow-sm flex items-center justify-between transition cursor-pointer ${
                        dateFilterPreset === "TODAY" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200/80 hover:border-rose-300"
                    }`}
                >
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiring Today</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-rose-600">{metrics.expiringToday}</div>
                        <p className="text-[11px] text-slate-500">Requires immediate usage or audit</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                        <AlertTriangle size={24} />
                    </div>
                </div>

                {/* Expiring in 3 Days */}
                <div
                    onClick={() => setDateFilterPreset(dateFilterPreset === "NEXT_3_DAYS" ? "ALL" : "NEXT_3_DAYS")}
                    className={`bg-white rounded-2xl p-5 border shadow-sm flex items-center justify-between transition cursor-pointer ${
                        dateFilterPreset === "NEXT_3_DAYS" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200/80 hover:border-amber-300"
                    }`}
                >
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiring in 3 Days</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">{metrics.expiring3Days}</div>
                        <p className="text-[11px] text-slate-500">Prioritize in kitchen prep FIFO</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                        <Clock size={24} />
                    </div>
                </div>

                {/* Expiring in 7 Days */}
                <div
                    onClick={() => setDateFilterPreset(dateFilterPreset === "NEXT_7_DAYS" ? "ALL" : "NEXT_7_DAYS")}
                    className={`bg-white rounded-2xl p-5 border shadow-sm flex items-center justify-between transition cursor-pointer ${
                        dateFilterPreset === "NEXT_7_DAYS" ? "border-yellow-500 ring-2 ring-yellow-500/20" : "border-slate-200/80 hover:border-yellow-300"
                    }`}
                >
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiring in 7 Days</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600">{metrics.expiring7Days}</div>
                        <p className="text-[11px] text-slate-500">Incoming expiry window</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-yellow-50 text-yellow-600 border border-yellow-100">
                        <Calendar size={24} />
                    </div>
                </div>

                {/* Expired */}
                <div
                    onClick={() => setDateFilterPreset(dateFilterPreset === "EXPIRED" ? "ALL" : "EXPIRED")}
                    className={`bg-white rounded-2xl p-5 border shadow-sm flex items-center justify-between transition cursor-pointer ${
                        dateFilterPreset === "EXPIRED" ? "border-red-500 ring-2 ring-red-500/20" : "border-slate-200/80 hover:border-red-300"
                    }`}
                >
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expired</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-red-700">{metrics.expired}</div>
                        <p className="text-[11px] text-slate-500">Unsafe for consumption - dispose</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-red-50 text-red-600 border border-red-100">
                        <AlertCircle size={24} />
                    </div>
                </div>
            </div>

            {/* FILTERS TOOLBAR */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search item, batch number, or supplier..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                    </div>

                    {/* Dropdown Filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Date Filter Preset */}
                        <select
                            value={dateFilterPreset}
                            onChange={(e) => setDateFilterPreset(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                        >
                            <option value="ALL">All Expiry Windows</option>
                            <option value="EXPIRED">Expired Items</option>
                            <option value="TODAY">Expiring Today</option>
                            <option value="NEXT_3_DAYS">Next 3 Days</option>
                            <option value="NEXT_7_DAYS">Next 7 Days</option>
                        </select>

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

                        {/* Location Filter */}
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

            {/* BATCH EXPIRY TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Box size={18} className="text-amber-600" />
                            Inventory Batch & Expiry Ledger ({filteredBatches.length})
                        </h2>
                        <p className="text-xs text-slate-500">Live stock lot balances sorted by expiration date (FIFO rotation)</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                                <th className="py-3 px-4">Item</th>
                                <th className="py-3 px-4">Batch Number</th>
                                <th className="py-3 px-4 text-center">Quantity</th>
                                <th className="py-3 px-4">Unit</th>
                                <th className="py-3 px-4">Received Date</th>
                                <th className="py-3 px-4">Expiry Date</th>
                                <th className="py-3 px-4 text-center">Days Remaining</th>
                                <th className="py-3 px-4">Storage Location</th>
                                <th className="py-3 px-4">Supplier</th>
                                <th className="py-3 px-4 text-center">Status</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filteredBatches.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-12 text-center text-slate-400">
                                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                                        <p className="font-bold text-slate-700 text-sm">No Inventory Batches Found!</p>
                                        <p className="text-xs text-slate-400 mt-1">No batch records match the selected search or filter criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredBatches.map((batch) => {
                                    const statusBadge = getStatusBadge(batch);

                                    return (
                                        <tr key={batch.id} className="hover:bg-amber-50/20 transition-colors">
                                            {/* Item */}
                                            <td className="py-3.5 px-4 font-bold text-slate-900">
                                                <Link
                                                    to={`/owner/supply-chain/inventory/${batch.rawMaterialId}`}
                                                    className="hover:text-amber-600 transition-colors block"
                                                >
                                                    {batch.itemName}
                                                </Link>
                                                <span className="text-[10px] text-slate-400 font-normal">{batch.category}</span>
                                            </td>

                                            {/* Batch Number */}
                                            <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-slate-800">{batch.batchNumber}</td>

                                            {/* Quantity */}
                                            <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">{batch.quantity}</td>

                                            {/* Unit */}
                                            <td className="py-3.5 px-4 text-slate-600 font-medium">{batch.unit}</td>

                                            {/* Received Date */}
                                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                                                {new Date(batch.receivedDate).toLocaleDateString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </td>

                                            {/* Expiry Date */}
                                            <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                                                {new Date(batch.expiryDate).toLocaleDateString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </td>

                                            {/* Days Remaining */}
                                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                        batch.daysRemaining < 0
                                                            ? "bg-red-100 text-red-800"
                                                            : batch.daysRemaining === 0
                                                            ? "bg-rose-100 text-rose-800"
                                                            : batch.daysRemaining <= 3
                                                            ? "bg-amber-100 text-amber-800"
                                                            : "bg-emerald-50 text-emerald-700"
                                                    }`}
                                                >
                                                    {batch.daysRemaining < 0 ? "Expired" : batch.daysRemaining === 0 ? "Today" : `${batch.daysRemaining} Days`}
                                                </span>
                                            </td>

                                            {/* Storage Location */}
                                            <td className="py-3.5 px-4 text-slate-700 font-medium">{batch.storageLocation}</td>

                                            {/* Supplier */}
                                            <td className="py-3.5 px-4 text-slate-700 truncate max-w-[140px]" title={batch.supplier}>
                                                {batch.supplier}
                                            </td>

                                            {/* Status */}
                                            <td className="py-3.5 px-4 text-center">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${statusBadge.color}`}>
                                                    {statusBadge.label}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1">
                                                    {/* View Batch */}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBatch(batch);
                                                            setShowViewModal(true);
                                                        }}
                                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
                                                        title="View Batch Details"
                                                    >
                                                        <Eye size={13} />
                                                    </button>

                                                    {/* Mark as Wastage */}
                                                    <button
                                                        onClick={() => openWastageModal(batch)}
                                                        className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition shadow-sm"
                                                        title="Mark as Wastage"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>

                                                    {/* Transfer */}
                                                    <button
                                                        onClick={() => openTransferModal(batch)}
                                                        className="p-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition shadow-sm"
                                                        title="Transfer Storage Location"
                                                    >
                                                        <ArrowRightLeft size={13} />
                                                    </button>

                                                    {/* Return to Supplier */}
                                                    <button
                                                        onClick={() => openReturnModal(batch)}
                                                        className="p-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 transition shadow-sm"
                                                        title="Return to Supplier"
                                                    >
                                                        <RotateCcw size={13} />
                                                    </button>
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

            {/* VIEW BATCH DETAILS MODAL */}
            {showViewModal && selectedBatch && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <QrCode size={18} className="text-amber-600" /> Batch Specification & Lot Details
                            </h3>
                            <button onClick={() => setShowViewModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 text-xs">
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batch Number</span>
                                    <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                        {selectedBatch.batchNumber}
                                    </span>
                                </div>
                                <h4 className="text-base font-bold text-slate-900">{selectedBatch.itemName}</h4>
                                <p className="text-slate-500">{selectedBatch.category} • Storage: {selectedBatch.storageLocation}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Available Lot Stock</span>
                                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                                        {selectedBatch.quantity} {selectedBatch.unit}
                                    </p>
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Unit Cost Price</span>
                                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                                        ₹{selectedBatch.costPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Received Date</span>
                                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                                        {new Date(selectedBatch.receivedDate).toLocaleDateString("en-IN")}
                                    </p>
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Expiration Date</span>
                                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                                        {new Date(selectedBatch.expiryDate).toLocaleDateString("en-IN")}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-1">
                                <span className="font-semibold text-slate-900">Preferred Supplier</span>
                                <p className="text-slate-600">{selectedBatch.supplier}</p>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                                <button
                                    onClick={() => setShowViewModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition"
                                >
                                    Close Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MARK AS WASTAGE MODAL */}
            {showWastageModal && selectedBatch && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Trash2 size={18} className="text-rose-600" /> Record Batch Spoilage / Wastage
                            </h3>
                            <button onClick={() => setShowWastageModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleWastageSubmit} className="p-6 space-y-4 text-xs">
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-1">
                                <span className="font-bold text-slate-900">{selectedBatch.itemName}</span>
                                <p className="text-[11px] text-slate-500">
                                    Batch Number: <strong className="font-mono text-slate-800">{selectedBatch.batchNumber}</strong>
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Wastage Quantity ({selectedBatch.unit})</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    required
                                    max={selectedBatch.quantity}
                                    value={wastageForm.quantity}
                                    onChange={(e) => setWastageForm({ ...wastageForm, quantity: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Wastage Reason</label>
                                <select
                                    value={wastageForm.reason}
                                    onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                >
                                    <option value="Expired Material Spoilage">Expired Material Spoilage</option>
                                    <option value="Quality Assurance Rejection">Quality Assurance Rejection</option>
                                    <option value="Storage Temperature Failure">Storage Temperature Failure</option>
                                    <option value="Packaging Damage">Packaging Damage</option>
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowWastageModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition"
                                >
                                    {actionLoading ? "Processing..." : "Confirm Wastage"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TRANSFER LOCATION MODAL */}
            {showTransferModal && selectedBatch && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <ArrowRightLeft size={18} className="text-blue-600" /> Transfer Batch Storage Location
                            </h3>
                            <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleTransferSubmit} className="p-6 space-y-4 text-xs">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                                <span className="font-bold text-slate-900">{selectedBatch.itemName}</span>
                                <p className="text-[11px] text-slate-500">
                                    Current Location: <strong className="text-slate-800">{selectedBatch.storageLocation}</strong>
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Target Storage Location</label>
                                <select
                                    value={transferForm.targetLocation}
                                    onChange={(e) => setTransferForm({ ...transferForm, targetLocation: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                >
                                    <option value="Kitchen Prep Bay">Kitchen Prep Bay</option>
                                    <option value="Cold Storage / Walk-in Freezer">Cold Storage / Walk-in Freezer</option>
                                    <option value="Main Dry Store">Main Dry Store</option>
                                    <option value="Bar & Beverage Store">Bar & Beverage Store</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Transfer Quantity ({selectedBatch.unit})</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    required
                                    max={selectedBatch.quantity}
                                    value={transferForm.quantity}
                                    onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowTransferModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition"
                                >
                                    {actionLoading ? "Transferring..." : "Confirm Transfer"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RETURN TO SUPPLIER MODAL */}
            {showReturnModal && selectedBatch && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <RotateCcw size={18} className="text-purple-600" /> Initiate Vendor Return
                            </h3>
                            <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleReturnSubmit} className="p-6 space-y-4 text-xs">
                            <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl space-y-1">
                                <span className="font-bold text-slate-900">{selectedBatch.itemName}</span>
                                <p className="text-[11px] text-slate-500">
                                    Supplier: <strong className="text-slate-800">{selectedBatch.supplier}</strong>
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Return Quantity ({selectedBatch.unit})</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    required
                                    max={selectedBatch.quantity}
                                    value={returnForm.quantity}
                                    onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Return Reason</label>
                                <select
                                    value={returnForm.reason}
                                    onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                >
                                    <option value="Near Expiry / Vendor Return">Near Expiry / Vendor Return</option>
                                    <option value="Substandard Quality on Delivery">Substandard Quality on Delivery</option>
                                    <option value="Incorrect Specification">Incorrect Specification</option>
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReturnModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm transition"
                                >
                                    {actionLoading ? "Submitting..." : "Initiate Return"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
