import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Activity,
    Search,
    Download,
    RefreshCw,
    User,
    TrendingUp,
    TrendingDown,
    ArrowRightLeft,
    SlidersHorizontal,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    Eye,
    X,
    Layers,
    ShieldCheck,
    Tag,
    ChevronDown,
    ChevronUp,
    Clock,
    Box,
    Building2,
    Calendar
} from "lucide-react";
import { api } from "../../utils/apiClient";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

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

    // Inline Expandable Row State
    const [expandedRowId, setExpandedRowId] = useState(null);

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
        link.setAttribute("download", `Stock_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Stock Audit Logs exported as CSV");
    };

    const toggleRowExpand = (id) => {
        setExpandedRowId(expandedRowId === id ? null : id);
    };

    if (loading && movements.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col justify-center items-center font-sans text-slate-800">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-600 font-medium text-xs">Loading supply chain audit logs & stock movement ledger...</p>
            </div>
        );
    }

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    className={`fixed top-5 right-5 z-50 px-3.5 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 ${
                        toastMessage.type === "error" ? "bg-rose-900 text-rose-100 border-rose-700" : "bg-emerald-900 text-emerald-100 border-emerald-700"
                    }`}
                >
                    {toastMessage.type === "error" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                    <span>{toastMessage.msg}</span>
                </div>
            )}

            {/* Global Horizontal Sub-Nav */}
            <SupplyChainSubNav />

            {/* Header Console */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 print:hidden">
                <div className="flex items-center gap-2">
                    <OwnerMenuButton />
                    <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span>Audit Logs & Stock Ledger</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2 mt-0.5">
                            <Activity size={20} className="text-orange-500" />
                            Supply Chain Audit Logs
                            <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-200/60">
                                {filteredMovements.length} Events
                            </span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-3 py-1.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : "text-slate-500"} />
                        <span>Refresh</span>
                    </button>

                    <button
                        onClick={exportCSV}
                        className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                        <Download size={13} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* COMPACT AUDIT SUMMARY (Line-style, Analytics-like) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 overflow-hidden">
                {/* Opening Stock */}
                <button
                    onClick={() => setTypeFilter(typeFilter === "OPENING" ? "ALL" : "OPENING")}
                    className={`p-3 text-left transition cursor-pointer hover:bg-slate-50/80 ${
                        typeFilter === "OPENING" ? "bg-orange-50/60 border-l-2 border-orange-500" : ""
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Opening Stock</span>
                        <Layers size={13} className="text-slate-400" />
                    </div>
                    <div className="text-base font-extrabold text-slate-900 font-mono">{metrics.openingStock}</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">Initial setups</div>
                </button>

                {/* Purchases */}
                <button
                    onClick={() => setTypeFilter(typeFilter === "PURCHASE" ? "ALL" : "PURCHASE")}
                    className={`p-3 text-left transition cursor-pointer hover:bg-slate-50/80 ${
                        typeFilter === "PURCHASE" ? "bg-orange-50/60 border-l-2 border-orange-500" : ""
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Purchases</span>
                        <TrendingUp size={13} className="text-emerald-500" />
                    </div>
                    <div className="text-base font-extrabold text-emerald-600 font-mono">+{metrics.purchases}</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">Vendor stock-ins</div>
                </button>

                {/* Consumption */}
                <button
                    onClick={() => setTypeFilter(typeFilter === "CONSUMPTION" ? "ALL" : "CONSUMPTION")}
                    className={`p-3 text-left transition cursor-pointer hover:bg-slate-50/80 ${
                        typeFilter === "CONSUMPTION" ? "bg-orange-50/60 border-l-2 border-orange-500" : ""
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Consumption</span>
                        <TrendingDown size={13} className="text-amber-500" />
                    </div>
                    <div className="text-base font-extrabold text-amber-600 font-mono">-{metrics.consumption}</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">POS recipe sales</div>
                </button>

                {/* Transfers */}
                <button
                    onClick={() => setTypeFilter(typeFilter === "TRANSFER" ? "ALL" : "TRANSFER")}
                    className={`p-3 text-left transition cursor-pointer hover:bg-slate-50/80 ${
                        typeFilter === "TRANSFER" ? "bg-orange-50/60 border-l-2 border-orange-500" : ""
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Transfers</span>
                        <ArrowRightLeft size={13} className="text-blue-500" />
                    </div>
                    <div className="text-base font-extrabold text-blue-600 font-mono">{metrics.transfers}</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">Inter-station moves</div>
                </button>

                {/* Adjustments */}
                <button
                    onClick={() => setTypeFilter(typeFilter === "ADJUSTMENT" ? "ALL" : "ADJUSTMENT")}
                    className={`p-3 text-left transition cursor-pointer hover:bg-slate-50/80 ${
                        typeFilter === "ADJUSTMENT" ? "bg-orange-50/60 border-l-2 border-orange-500" : ""
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Adjustments</span>
                        <SlidersHorizontal size={13} className="text-purple-500" />
                    </div>
                    <div className="text-base font-extrabold text-purple-600 font-mono">{metrics.adjustments}</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">Audit count diffs</div>
                </button>

                {/* Wastage */}
                <button
                    onClick={() => setTypeFilter(typeFilter === "WASTAGE" ? "ALL" : "WASTAGE")}
                    className={`p-3 text-left transition cursor-pointer hover:bg-slate-50/80 ${
                        typeFilter === "WASTAGE" ? "bg-orange-50/60 border-l-2 border-orange-500" : ""
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Wastage</span>
                        <Trash2 size={13} className="text-rose-500" />
                    </div>
                    <div className="text-base font-extrabold text-rose-600 font-mono">-{metrics.wastage}</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">Spoilage & loss</div>
                </button>
            </div>

            {/* AUDIT SEARCH & FILTERS BAR */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs space-y-2">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by item name, reference code, user, or audit notes..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                            className="bg-slate-50 border border-slate-200/80 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-semibold"
                        >
                            <option value="ALL">All Time</option>
                            <option value="TODAY">Today</option>
                            <option value="YESTERDAY">Yesterday</option>
                            <option value="7_DAYS">Last 7 Days</option>
                            <option value="30_DAYS">Last 30 Days</option>
                            <option value="CUSTOM">Custom Dates</option>
                        </select>

                        {/* Custom Date Pickers */}
                        {datePreset === "CUSTOM" && (
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="text-slate-700 text-[11px] bg-transparent focus:outline-none"
                                />
                                <span className="text-slate-400 text-xs">-</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="text-slate-700 text-[11px] bg-transparent focus:outline-none"
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
                            className="bg-slate-50 border border-slate-200/80 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-semibold max-w-[160px] truncate"
                        >
                            <option value="ALL">All Items</option>
                            {materials.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </select>

                        {/* Movement Action Filter */}
                        <select
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-slate-50 border border-slate-200/80 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-semibold"
                        >
                            <option value="ALL">All Actions</option>
                            <option value="PURCHASE">PURCHASE (Stock-In)</option>
                            <option value="CONSUMPTION">CONSUMPTION (Sales)</option>
                            <option value="TRANSFER">TRANSFER</option>
                            <option value="ADJUSTMENT">ADJUSTMENT</option>
                            <option value="WASTAGE">WASTAGE (Spoilage)</option>
                            <option value="RETURN">RETURN</option>
                            <option value="OPENING">OPENING</option>
                        </select>

                        {/* User Filter */}
                        <select
                            value={userFilter}
                            onChange={(e) => {
                                setUserFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-slate-50 border border-slate-200/80 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none font-semibold"
                        >
                            <option value="ALL">All Staff/Users</option>
                            {userNames.map((u) => (
                                <option key={u} value={u}>
                                    {u}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* AUDIT LOG TABLE WITH EXPANDABLE ROWS */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-orange-500" />
                        Audit Trail Records ({filteredMovements.length})
                    </h2>
                    <span className="text-[11px] text-slate-400 font-medium">Click any row to expand audit details</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-2.5 px-3"></th>
                                <th className="py-2.5 px-3">Timestamp</th>
                                <th className="py-2.5 px-3">Item & Category</th>
                                <th className="py-2.5 px-3">Reference</th>
                                <th className="py-2.5 px-3">Action Type</th>
                                <th className="py-2.5 px-3 text-right">Quantity</th>
                                <th className="py-2.5 px-3 text-right">Before Balance</th>
                                <th className="py-2.5 px-3 text-right">After Balance</th>
                                <th className="py-2.5 px-3">User</th>
                                <th className="py-2.5 px-3">Location</th>
                                <th className="py-2.5 px-3 text-center">Inspect</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {paginatedMovements.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-12 text-center text-slate-400">
                                        <Box size={28} className="mx-auto mb-2 opacity-50" />
                                        <p className="font-bold text-slate-700 text-xs">No Audit Logs Found</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">No movement records match the active filter criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedMovements.map((m) => {
                                    const isPositive = m.quantity > 0;
                                    const isExpanded = expandedRowId === m.id;

                                    let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";

                                    if (m.normalizedType === "PURCHASE") badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold";
                                    else if (m.normalizedType === "CONSUMPTION") badgeStyle = "bg-amber-50 text-amber-700 border-amber-200 font-bold";
                                    else if (m.normalizedType === "TRANSFER") badgeStyle = "bg-blue-50 text-blue-700 border-blue-200 font-bold";
                                    else if (m.normalizedType === "ADJUSTMENT") badgeStyle = "bg-purple-50 text-purple-700 border-purple-200 font-bold";
                                    else if (m.normalizedType === "WASTAGE") badgeStyle = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
                                    else if (m.normalizedType === "RETURN") badgeStyle = "bg-yellow-50 text-yellow-800 border-yellow-200 font-bold";

                                    return (
                                        <React.Fragment key={m.id}>
                                            <tr
                                                onClick={() => toggleRowExpand(m.id)}
                                                className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                                                    isExpanded ? "bg-orange-50/30" : ""
                                                }`}
                                            >
                                                {/* Expand Chevron */}
                                                <td className="py-2.5 px-2 text-slate-400">
                                                    {isExpanded ? <ChevronUp size={14} className="text-orange-500" /> : <ChevronDown size={14} />}
                                                </td>

                                                {/* Highly Readable Timestamp */}
                                                <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={12} className="text-slate-400" />
                                                        <span>
                                                            {new Date(m.createdAt).toLocaleString("en-IN", {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Item */}
                                                <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                                                    {m.rawMaterial?.id ? (
                                                        <Link
                                                            to={`/owner/supply-chain/inventory/${m.rawMaterial.id}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="hover:text-orange-600 transition-colors"
                                                        >
                                                            {m.rawMaterial.name}
                                                        </Link>
                                                    ) : (
                                                        m.rawMaterial?.name || "Raw Material"
                                                    )}
                                                    <span className="block text-[10px] text-slate-400 font-normal">
                                                        {m.rawMaterial?.category || "General"}
                                                    </span>
                                                </td>

                                                {/* Reference */}
                                                <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-700 whitespace-nowrap">
                                                    <span className="flex items-center gap-1">
                                                        <Tag size={11} className="text-slate-400" />
                                                        {m.reference}
                                                    </span>
                                                </td>

                                                {/* Action Type */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] border uppercase ${badgeStyle}`}>
                                                        {m.normalizedType}
                                                    </span>
                                                </td>

                                                {/* Quantity */}
                                                <td
                                                    className={`py-2.5 px-3 text-right font-bold font-mono whitespace-nowrap ${
                                                        isPositive ? "text-emerald-600" : "text-slate-900"
                                                    }`}
                                                >
                                                    {isPositive ? `+${m.quantity}` : m.quantity} <span className="text-[10px] font-normal text-slate-400">{m.unit}</span>
                                                </td>

                                                {/* Before Balance */}
                                                <td className="py-2.5 px-3 text-right font-medium text-slate-500 font-mono whitespace-nowrap">
                                                    {m.beforeBalance} <span className="text-[10px] text-slate-400">{m.unit}</span>
                                                </td>

                                                {/* After Balance */}
                                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                                                    {m.afterBalance} <span className="text-[10px] font-normal text-slate-400">{m.unit}</span>
                                                </td>

                                                {/* User */}
                                                <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                                                    <div className="flex items-center gap-1">
                                                        <User size={12} className="text-slate-400" />
                                                        <span>{m.performedBy}</span>
                                                    </div>
                                                </td>

                                                {/* Location */}
                                                <td className="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap text-[11px]">
                                                    {m.storageLocation}
                                                </td>

                                                {/* Audit Modal Button */}
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedMovement(m);
                                                            setShowAuditModal(true);
                                                        }}
                                                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                                        title="View Source Transaction Audit"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* EXPANDABLE DETAIL ROW */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/90">
                                                    <td colSpan={11} className="p-3 border-l-2 border-orange-500">
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Source Record</span>
                                                                <p className="font-semibold text-slate-800">
                                                                    Type: <span className="font-bold text-orange-600">{m.sourceType || "SYSTEM"}</span>
                                                                </p>
                                                                <p className="text-[11px] font-mono text-slate-600">ID: {m.sourceId || m.id}</p>
                                                            </div>

                                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Valuation Impact</span>
                                                                <p className="font-bold text-slate-900 font-mono">
                                                                    Unit Cost: ₹{(m.unitCost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                                </p>
                                                                <p className="text-[11px] font-mono text-slate-600">
                                                                    Total Value: ₹{(m.totalCost || Math.abs(m.quantity || 0) * (m.unitCost || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                                </p>
                                                            </div>

                                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Audit Context & Notes</span>
                                                                <p className="text-slate-700 italic text-[11px]">
                                                                    {m.notes ? `"${m.notes}"` : "No extra audit notes specified."}
                                                                </p>
                                                                {m.idempotencyKey && (
                                                                    <p className="text-[10px] text-slate-400 font-mono truncate">Key: {m.idempotencyKey}</p>
                                                                )}
                                                            </div>

                                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex flex-col justify-between">
                                                                <div className="space-y-0.5">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Audit Metadata</span>
                                                                    <p className="text-[11px] text-slate-600">
                                                                        Logged by <strong>{m.performedBy}</strong> on {new Date(m.createdAt).toLocaleString("en-IN")}
                                                                    </p>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedMovement(m);
                                                                        setShowAuditModal(true);
                                                                    }}
                                                                    className="mt-2 text-left font-bold text-orange-600 hover:text-orange-700 text-[11px] flex items-center gap-1"
                                                                >
                                                                    <Eye size={12} /> Open Full Audit Modal &rarr;
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                <div className="px-4 py-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                    <div>
                        Showing <span className="font-semibold text-slate-800">{filteredMovements.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{" "}
                        <span className="font-semibold text-slate-800">{Math.min(currentPage * pageSize, filteredMovements.length)}</span> of{" "}
                        <span className="font-semibold text-slate-800">{filteredMovements.length}</span> records
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 font-semibold cursor-pointer"
                        >
                            Previous
                        </button>
                        <span className="px-2.5 py-1 text-slate-700 font-bold text-[11px]">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 font-semibold cursor-pointer"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* FULL AUDIT DETAIL MODAL */}
            {showAuditModal && selectedMovement && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                                <ShieldCheck size={16} className="text-orange-500" />
                                Source Transaction Audit Detail
                            </h3>
                            <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-3.5 text-xs">
                            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reference Code</span>
                                    <span className="font-mono font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 text-[11px]">
                                        {selectedMovement.reference}
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-900">{selectedMovement.rawMaterial?.name || "Raw Material"}</h4>
                                <p className="text-slate-500 text-[11px]">
                                    Source Type: <strong className="text-slate-800">{selectedMovement.sourceType}</strong> • ID:{" "}
                                    <strong className="font-mono text-slate-800">{selectedMovement.sourceId || selectedMovement.id}</strong>
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Action Type</span>
                                    <p className="text-xs font-bold text-slate-900">{selectedMovement.normalizedType}</p>
                                </div>

                                <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Quantity Delta</span>
                                    <p className={`text-xs font-bold ${selectedMovement.quantity > 0 ? "text-emerald-600" : "text-slate-900"}`}>
                                        {selectedMovement.quantity > 0 ? `+${selectedMovement.quantity}` : selectedMovement.quantity} {selectedMovement.unit}
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Balance Before</span>
                                    <p className="text-xs font-bold text-slate-900 font-mono">
                                        {selectedMovement.beforeBalance} {selectedMovement.unit}
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Balance After</span>
                                    <p className="text-xs font-bold text-slate-900 font-mono">
                                        {selectedMovement.afterBalance} {selectedMovement.unit}
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Unit Cost</span>
                                    <p className="text-xs font-bold text-slate-900 font-mono">
                                        ₹{(selectedMovement.unitCost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg space-y-0.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Valuation Impact</span>
                                    <p className="text-xs font-bold text-slate-900 font-mono">
                                        ₹{(selectedMovement.totalCost || Math.abs(selectedMovement.quantity || 0) * (selectedMovement.unitCost || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                                <span className="font-bold text-slate-800 text-[11px]">Audit Execution Record</span>
                                <p className="text-slate-600 text-[11px]">
                                    User: <strong>{selectedMovement.performedBy}</strong> (ID: {selectedMovement.performedById || "SYS"})
                                </p>
                                <p className="text-slate-600 text-[11px]">
                                    Recorded: {new Date(selectedMovement.createdAt).toLocaleString("en-IN")}
                                </p>
                                {selectedMovement.idempotencyKey && (
                                    <p className="text-slate-500 font-mono text-[10px] truncate">
                                        Idempotency Key: {selectedMovement.idempotencyKey}
                                    </p>
                                )}
                                {selectedMovement.notes && (
                                    <p className="text-slate-700 italic border-t border-slate-200/80 pt-1.5 mt-1 text-[11px]">
                                        "{selectedMovement.notes}"
                                    </p>
                                )}
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                                <button
                                    onClick={() => setShowAuditModal(false)}
                                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                                >
                                    Close Audit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
