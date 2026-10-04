import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Activity,
    Search,
    Filter,
    Download,
    RefreshCw,
    Calendar,
    Box,
    User,
    FileText,
    TrendingUp,
    TrendingDown,
    ArrowRightLeft,
    SlidersHorizontal,
    Trash2,
    RotateCcw,
    CheckCircle2,
    AlertTriangle,
    Eye,
    Info,
    X,
    Layers,
    DollarSign,
    ShieldCheck,
    Tag,
} from "lucide-react";
import { api } from "../../utils/apiClient";

export default function OwnerSupplyChainMovements() {
    const navigate = useNavigate();

    // Core States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [movements, setMovements] = useState([]);
    const [materials, setMaterials] = useState([]);

    // Filters
    const [search, setSearch] = useState("");
    const [datePreset, setDatePreset] = useState("30_DAYS");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [itemFilter, setItemFilter] = useState("ALL");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [userFilter, setUserFilter] = useState("ALL");

    // Audit Modal
    const [selectedMovement, setSelectedMovement] = useState(null);
    const [showAuditModal, setShowAuditModal] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    const [toastMessage, setToastMessage] = useState(null);

    const showToast = (msg, type = "success") => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // 1. Fetch Movements and Raw Materials
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

            // Fetch materials for filter list
            const matRes = await api.get(`/owner/${restaurantId}/inventory/materials`);
            const matList = Array.isArray(matRes.data) ? matRes.data : matRes.data?.materials || [];
            setMaterials(matList);

            // Fetch ledger movements (up to 500 for full audit analysis)
            const ledgerRes = await api.get(`/owner/${restaurantId}/inventory/ledger`, {
                params: {
                    limit: 500,
                },
            });

            const fetchedMovements = ledgerRes.data?.movements || [];
            setMovements(fetchedMovements);
        } catch (err) {
            console.error("Error fetching stock movements:", err);
            showToast("Failed to load stock movement ledger", "error");
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

    // Unique Users for Filter
    const userNames = useMemo(() => {
        const set = new Set(movements.map((m) => m.performedByName || "Staff"));
        return Array.from(set);
    }, [movements]);

    // Derived Processed Movements
    const processedMovements = useMemo(() => {
        return movements.map((m) => {
            const qty = m.quantity || 0;
            const afterBalance = m.balanceAfter ?? 0;
            const beforeBalance = Math.round((afterBalance - qty) * 100) / 100;

            const mType = (m.movementType || "").toUpperCase();
            let normalizedType = "ADJUSTMENT";
            if (mType.includes("OPENING")) normalizedType = "OPENING";
            else if (mType.includes("PURCHASE") || mType.includes("RECEIPT")) normalizedType = "PURCHASE";
            else if (mType.includes("SALE") || mType.includes("CONSUMPTION") || mType.includes("OUT")) normalizedType = "CONSUMPTION";
            else if (mType.includes("TRANSFER")) normalizedType = "TRANSFER";
            else if (mType.includes("WASTAGE") || mType.includes("SPOILAGE")) normalizedType = "WASTAGE";
            else if (mType.includes("RETURN") || mType.includes("REVERSAL")) normalizedType = "RETURN";
            else if (mType.includes("ADJUSTMENT")) normalizedType = "ADJUSTMENT";

            const unit = m.rawMaterial?.displayUnit || m.rawMaterial?.baseUnit || "Kg";
            const storageLocation = m.rawMaterial?.storageLocation || "Main Dry Store";

            return {
                ...m,
                normalizedType,
                beforeBalance,
                afterBalance,
                unit,
                storageLocation,
                reference: m.sourceId || `TRX-${m.id}`,
                performedBy: m.performedByName || "System Engine",
            };
        });
    }, [movements]);

    // Metric Counters (6 Top Metrics)
    const metrics = useMemo(() => {
        let openingStock = 0;
        let purchases = 0;
        let consumption = 0;
        let transfers = 0;
        let adjustments = 0;
        let wastage = 0;

        processedMovements.forEach((m) => {
            const absQty = Math.abs(m.quantity || 0);
            if (m.normalizedType === "OPENING") openingStock += absQty;
            else if (m.normalizedType === "PURCHASE") purchases += absQty;
            else if (m.normalizedType === "CONSUMPTION") consumption += absQty;
            else if (m.normalizedType === "TRANSFER") transfers += absQty;
            else if (m.normalizedType === "ADJUSTMENT") adjustments += absQty;
            else if (m.normalizedType === "WASTAGE") wastage += absQty;
        });

        return {
            openingStock: Math.round(openingStock * 10) / 10,
            purchases: Math.round(purchases * 10) / 10,
            consumption: Math.round(consumption * 10) / 10,
            transfers: Math.round(transfers * 10) / 10,
            adjustments: Math.round(adjustments * 10) / 10,
            wastage: Math.round(wastage * 10) / 10,
        };
    }, [processedMovements]);

    // Filtered Movements
    const filteredMovements = useMemo(() => {
        const now = new Date();

        return processedMovements.filter((m) => {
            const matchesSearch =
                !search ||
                (m.rawMaterial?.name && m.rawMaterial.name.toLowerCase().includes(search.toLowerCase())) ||
                (m.reference && m.reference.toLowerCase().includes(search.toLowerCase())) ||
                (m.notes && m.notes.toLowerCase().includes(search.toLowerCase())) ||
                (m.performedBy && m.performedBy.toLowerCase().includes(search.toLowerCase()));

            const matchesItem = itemFilter === "ALL" || String(m.rawMaterialId) === String(itemFilter);
            const matchesType = typeFilter === "ALL" || m.normalizedType === typeFilter;
            const matchesUser = userFilter === "ALL" || m.performedBy === userFilter;

            // Date filtering
            let matchesDate = true;
            const mDate = new Date(m.createdAt);

            if (datePreset === "TODAY") {
                matchesDate = mDate.toDateString() === now.toDateString();
            } else if (datePreset === "YESTERDAY") {
                const yest = new Date(now);
                yest.setDate(yest.getDate() - 1);
                matchesDate = mDate.toDateString() === yest.toDateString();
            } else if (datePreset === "7_DAYS") {
                const seven = new Date(now);
                seven.setDate(seven.getDate() - 7);
                matchesDate = mDate >= seven;
            } else if (datePreset === "30_DAYS") {
                const thirty = new Date(now);
                thirty.setDate(thirty.getDate() - 30);
                matchesDate = mDate >= thirty;
            } else if (datePreset === "CUSTOM") {
                if (startDate) matchesDate = matchesDate && mDate >= new Date(startDate);
                if (endDate) matchesDate = matchesDate && mDate <= new Date(endDate + "T23:59:59");
            }

            return matchesSearch && matchesItem && matchesType && matchesUser && matchesDate;
        });
    }, [processedMovements, search, itemFilter, typeFilter, userFilter, datePreset, startDate, endDate]);

    // Pagination
    const paginatedMovements = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredMovements.slice(start, start + pageSize);
    }, [filteredMovements, currentPage]);

    const totalPages = Math.ceil(filteredMovements.length / pageSize) || 1;

    // Export CSV
    const exportCSV = () => {
        if (!filteredMovements || filteredMovements.length === 0) {
            showToast("No movement data to export", "error");
            return;
        }

        const headers = ["Date & Time", "Item", "Reference", "Movement Type", "Quantity", "Unit", "Before Balance", "After Balance", "User", "Location", "Notes"];
        const rows = filteredMovements.map((m) => [
            new Date(m.createdAt).toLocaleString("en-IN"),
            `"${(m.rawMaterial?.name || "Item").replace(/"/g, '""')}"`,
            m.reference,
            m.normalizedType,
            m.quantity,
            m.unit,
            m.beforeBalance,
            m.afterBalance,
            `"${m.performedBy.replace(/"/g, '""')}"`,
            `"${m.storageLocation.replace(/"/g, '""')}"`,
            `"${(m.notes || "").replace(/"/g, '""')}"`,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Stock_Movement_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Stock Movement Ledger exported as CSV");
    };

    if (loading && movements.length === 0) {
        return (
            <div className="min-h-screen bg-[#faf9f6] p-6 flex flex-col justify-center items-center font-sans">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-600 font-medium text-sm">Loading stock movement ledger & audit trails...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf9f6] text-slate-800 font-sans p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
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
                        <Link
                            to="/owner/supply-chain/inventory"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors mb-1"
                        >
                            <ArrowLeft size={14} /> Back to Master Inventory
                        </Link>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                <Activity size={28} className="text-amber-600" />
                                Stock Movement Ledger
                            </h1>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {filteredMovements.length} Total Movements Recorded
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Immutable, real-time audit trail of all purchases, kitchen sales issues, wastage, transfers, and stock adjustments.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
                            title="Refresh Ledger"
                        >
                            <RefreshCw size={16} className={refreshing ? "animate-spin text-amber-600" : ""} />
                        </button>
                    </div>
                </div>
            </div>

            {/* TOP METRIC CARDS (6 Metrics) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Opening Stock */}
                <div
                    onClick={() => setTypeFilter(typeFilter === "OPENING" ? "ALL" : "OPENING")}
                    className={`bg-white rounded-2xl p-4 border shadow-sm flex flex-col justify-between cursor-pointer transition ${
                        typeFilter === "OPENING" ? "border-slate-800 ring-2 ring-slate-800/10" : "border-slate-200/80 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Opening Stock</span>
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                            <Layers size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="text-xl font-extrabold text-slate-900">{metrics.openingStock}</div>
                        <p className="text-[11px] text-slate-400 mt-1">Initial stock setups</p>
                    </div>
                </div>

                {/* Purchases */}
                <div
                    onClick={() => setTypeFilter(typeFilter === "PURCHASE" ? "ALL" : "PURCHASE")}
                    className={`bg-white rounded-2xl p-4 border shadow-sm flex flex-col justify-between cursor-pointer transition ${
                        typeFilter === "PURCHASE" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200/80 hover:border-emerald-300"
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Purchases</span>
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="text-xl font-extrabold text-emerald-700">+{metrics.purchases}</div>
                        <p className="text-[11px] text-slate-400 mt-1">Vendor stock-ins</p>
                    </div>
                </div>

                {/* Consumption */}
                <div
                    onClick={() => setTypeFilter(typeFilter === "CONSUMPTION" ? "ALL" : "CONSUMPTION")}
                    className={`bg-white rounded-2xl p-4 border shadow-sm flex flex-col justify-between cursor-pointer transition ${
                        typeFilter === "CONSUMPTION" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200/80 hover:border-amber-300"
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Consumption</span>
                        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                            <TrendingDown size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="text-xl font-extrabold text-amber-700">-{metrics.consumption}</div>
                        <p className="text-[11px] text-slate-400 mt-1">POS Order recipe sales</p>
                    </div>
                </div>

                {/* Transfers */}
                <div
                    onClick={() => setTypeFilter(typeFilter === "TRANSFER" ? "ALL" : "TRANSFER")}
                    className={`bg-white rounded-2xl p-4 border shadow-sm flex flex-col justify-between cursor-pointer transition ${
                        typeFilter === "TRANSFER" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200/80 hover:border-blue-300"
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Transfers</span>
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                            <ArrowRightLeft size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="text-xl font-extrabold text-blue-700">{metrics.transfers}</div>
                        <p className="text-[11px] text-slate-400 mt-1">Inter-station transfers</p>
                    </div>
                </div>

                {/* Adjustments */}
                <div
                    onClick={() => setTypeFilter(typeFilter === "ADJUSTMENT" ? "ALL" : "ADJUSTMENT")}
                    className={`bg-white rounded-2xl p-4 border shadow-sm flex flex-col justify-between cursor-pointer transition ${
                        typeFilter === "ADJUSTMENT" ? "border-purple-500 ring-2 ring-purple-500/20" : "border-slate-200/80 hover:border-purple-300"
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Adjustments</span>
                        <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                            <SlidersHorizontal size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="text-xl font-extrabold text-purple-700">{metrics.adjustments}</div>
                        <p className="text-[11px] text-slate-400 mt-1">Physical audit count diffs</p>
                    </div>
                </div>

                {/* Wastage */}
                <div
                    onClick={() => setTypeFilter(typeFilter === "WASTAGE" ? "ALL" : "WASTAGE")}
                    className={`bg-white rounded-2xl p-4 border shadow-sm flex flex-col justify-between cursor-pointer transition ${
                        typeFilter === "WASTAGE" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200/80 hover:border-rose-300"
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Wastage</span>
                        <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                            <Trash2 size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="text-xl font-extrabold text-rose-700">-{metrics.wastage}</div>
                        <p className="text-[11px] text-slate-400 mt-1">Spoilage & kitchen loss</p>
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
                            placeholder="Search item, reference ID, notes, user..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Date Range Preset */}
                        <select
                            value={datePreset}
                            onChange={(e) => {
                                setDatePreset(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                        >
                            <option value="ALL">All Dates</option>
                            <option value="TODAY">Today</option>
                            <option value="YESTERDAY">Yesterday</option>
                            <option value="7_DAYS">Last 7 Days</option>
                            <option value="30_DAYS">Last 30 Days</option>
                            <option value="CUSTOM">Custom Date Range</option>
                        </select>

                        {/* Custom Date Pickers */}
                        {datePreset === "CUSTOM" && (
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
                                />
                                <span className="text-slate-400 text-xs">to</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
                                />
                            </div>
                        )}

                        {/* Item Filter */}
                        <select
                            value={itemFilter}
                            onChange={(e) => {
                                setItemFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="ALL">All Items</option>
                            {materials.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </select>

                        {/* Movement Type Filter */}
                        <select
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="ALL">All Movement Types</option>
                            <option value="PURCHASE">PURCHASE / Stock-In</option>
                            <option value="CONSUMPTION">SALE / Consumption</option>
                            <option value="TRANSFER">TRANSFER</option>
                            <option value="ADJUSTMENT">ADJUSTMENT</option>
                            <option value="WASTAGE">WASTAGE / Spoilage</option>
                            <option value="RETURN">RETURN / Reversal</option>
                            <option value="OPENING">OPENING Stock</option>
                        </select>

                        {/* User Filter */}
                        <select
                            value={userFilter}
                            onChange={(e) => {
                                setUserFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="ALL">All Users</option>
                            {userNames.map((u) => (
                                <option key={u} value={u}>
                                    {u}
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

            {/* MAIN MOVEMENTS TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Activity size={18} className="text-amber-600" />
                            Stock Movement Audit Trail ({filteredMovements.length})
                        </h2>
                        <p className="text-xs text-slate-500">Every stock movement is traceable to its source transaction ID & user</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                                <th className="py-3 px-4">Date & Time</th>
                                <th className="py-3 px-4">Item</th>
                                <th className="py-3 px-4">Reference</th>
                                <th className="py-3 px-4">Movement Type</th>
                                <th className="py-3 px-4 text-right">Quantity</th>
                                <th className="py-3 px-4 text-right">Before Balance</th>
                                <th className="py-3 px-4 text-right">After Balance</th>
                                <th className="py-3 px-4">User</th>
                                <th className="py-3 px-4">Location</th>
                                <th className="py-3 px-4 text-center">Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {paginatedMovements.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-400">
                                        <Box size={32} className="mx-auto mb-2 opacity-50" />
                                        <p className="font-bold text-slate-700 text-sm">No Stock Movements Found!</p>
                                        <p className="text-xs text-slate-400 mt-1">No movement records match the selected filters.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedMovements.map((m) => {
                                    const isPositive = m.quantity > 0;
                                    let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";

                                    if (m.normalizedType === "PURCHASE") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold";
                                    else if (m.normalizedType === "CONSUMPTION") badgeColor = "bg-amber-50 text-amber-700 border-amber-200 font-bold";
                                    else if (m.normalizedType === "TRANSFER") badgeColor = "bg-blue-50 text-blue-700 border-blue-200 font-bold";
                                    else if (m.normalizedType === "ADJUSTMENT") badgeColor = "bg-purple-50 text-purple-700 border-purple-200 font-bold";
                                    else if (m.normalizedType === "WASTAGE") badgeColor = "bg-rose-100 text-rose-800 border-rose-200 font-bold";
                                    else if (m.normalizedType === "RETURN") badgeColor = "bg-yellow-50 text-yellow-800 border-yellow-200 font-bold";

                                    return (
                                        <tr key={m.id} className="hover:bg-amber-50/20 transition-colors">
                                            {/* Date/Time */}
                                            <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                                                {new Date(m.createdAt).toLocaleString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </td>

                                            {/* Item */}
                                            <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                                                {m.rawMaterial?.id ? (
                                                    <Link
                                                        to={`/owner/supply-chain/inventory/${m.rawMaterial.id}`}
                                                        className="hover:text-amber-600 transition-colors"
                                                    >
                                                        {m.rawMaterial.name}
                                                    </Link>
                                                ) : (
                                                    m.rawMaterial?.name || "Raw Material"
                                                )}
                                                <span className="block text-[10px] text-slate-400 font-normal">{m.rawMaterial?.category || "General"}</span>
                                            </td>

                                            {/* Reference */}
                                            <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-amber-800 whitespace-nowrap">
                                                <button
                                                    onClick={() => {
                                                        setSelectedMovement(m);
                                                        setShowAuditModal(true);
                                                    }}
                                                    className="hover:underline flex items-center gap-1"
                                                >
                                                    <Tag size={12} className="text-amber-600" />
                                                    {m.reference}
                                                </button>
                                            </td>

                                            {/* Movement Type */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] border uppercase ${badgeColor}`}>
                                                    {m.normalizedType}
                                                </span>
                                            </td>

                                            {/* Quantity */}
                                            <td className={`py-3.5 px-4 text-right font-extrabold whitespace-nowrap ${isPositive ? "text-emerald-600" : "text-slate-900"}`}>
                                                {isPositive ? `+${m.quantity}` : m.quantity} <span className="text-[10px] font-normal text-slate-400">{m.unit}</span>
                                            </td>

                                            {/* Before Balance */}
                                            <td className="py-3.5 px-4 text-right font-medium text-slate-500 whitespace-nowrap">
                                                {m.beforeBalance} <span className="text-[10px] text-slate-400">{m.unit}</span>
                                            </td>

                                            {/* After Balance */}
                                            <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                                                {m.afterBalance} <span className="text-[10px] font-normal text-slate-400">{m.unit}</span>
                                            </td>

                                            {/* User */}
                                            <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    <User size={13} className="text-slate-400" />
                                                    <span>{m.performedBy}</span>
                                                </div>
                                            </td>

                                            {/* Location */}
                                            <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">{m.storageLocation}</td>

                                            {/* Audit Button */}
                                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => {
                                                        setSelectedMovement(m);
                                                        setShowAuditModal(true);
                                                    }}
                                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
                                                    title="View Source Transaction Audit"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    <div>
                        Showing <span className="font-semibold text-slate-800">{filteredMovements.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{" "}
                        <span className="font-semibold text-slate-800">{Math.min(currentPage * pageSize, filteredMovements.length)}</span> of{" "}
                        <span className="font-semibold text-slate-800">{filteredMovements.length}</span> movements
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition font-medium"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 text-slate-700 font-semibold">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition font-medium"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* SOURCE TRANSACTION AUDIT MODAL */}
            {showAuditModal && selectedMovement && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <ShieldCheck size={18} className="text-amber-600" /> Source Transaction Audit
                            </h3>
                            <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 text-xs">
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reference Code</span>
                                    <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                        {selectedMovement.reference}
                                    </span>
                                </div>
                                <h4 className="text-base font-bold text-slate-900">{selectedMovement.rawMaterial?.name || "Raw Material"}</h4>
                                <p className="text-slate-500">
                                    Source Type: <strong className="text-slate-800">{selectedMovement.sourceType}</strong> • ID:{" "}
                                    <strong className="font-mono text-slate-800">{selectedMovement.sourceId || selectedMovement.id}</strong>
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Movement Type</span>
                                    <p className="text-xs font-bold text-slate-900">{selectedMovement.normalizedType}</p>
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Quantity Changed</span>
                                    <p className={`text-xs font-bold ${selectedMovement.quantity > 0 ? "text-emerald-600" : "text-slate-900"}`}>
                                        {selectedMovement.quantity > 0 ? `+${selectedMovement.quantity}` : selectedMovement.quantity} {selectedMovement.unit}
                                    </p>
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Balance Before</span>
                                    <p className="text-xs font-bold text-slate-900">
                                        {selectedMovement.beforeBalance} {selectedMovement.unit}
                                    </p>
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Balance After</span>
                                    <p className="text-xs font-bold text-slate-900">
                                        {selectedMovement.afterBalance} {selectedMovement.unit}
                                    </p>
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Unit Cost</span>
                                    <p className="text-xs font-bold text-slate-900">
                                        ₹{(selectedMovement.unitCost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Valuation Cost</span>
                                    <p className="text-xs font-bold text-slate-900">
                                        ₹{(selectedMovement.totalCost || Math.abs(selectedMovement.quantity || 0) * (selectedMovement.unitCost || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                <span className="font-semibold text-slate-900">Audit Metadata</span>
                                <p className="text-slate-600 text-[11px]">
                                    Performed By: <strong>{selectedMovement.performedBy}</strong> (ID: {selectedMovement.performedById || "SYS"})
                                </p>
                                <p className="text-slate-600 text-[11px]">
                                    Recorded Date: {new Date(selectedMovement.createdAt).toLocaleString("en-IN")}
                                </p>
                                {selectedMovement.idempotencyKey && (
                                    <p className="text-slate-500 font-mono text-[10px] truncate">
                                        Idempotency Key: {selectedMovement.idempotencyKey}
                                    </p>
                                )}
                                {selectedMovement.notes && (
                                    <p className="text-slate-700 italic border-t border-slate-200 pt-1.5 mt-1 text-[11px]">
                                        "{selectedMovement.notes}"
                                    </p>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => setShowAuditModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition"
                                >
                                    Close Audit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
