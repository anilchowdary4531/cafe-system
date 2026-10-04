import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    SlidersHorizontal,
    Plus,
    Minus,
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
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    Eye,
    X,
    Info,
    DollarSign,
    Layers,
    Lock,
    Check,
} from "lucide-react";
import { api } from "../../utils/apiClient";

export default function OwnerSupplyChainAdjustments() {
    const navigate = useNavigate();

    // User & Permission States
    const [user, setUser] = useState(null);
    const [canAdjust, setCanAdjust] = useState(false);

    // Core Data States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [movements, setMovements] = useState([]);

    // Filters
    const [search, setSearch] = useState("");
    const [reasonFilter, setReasonFilter] = useState("ALL");
    const [directionFilter, setDirectionFilter] = useState("ALL");
    const [userFilter, setUserFilter] = useState("ALL");

    // Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedAuditMovement, setSelectedAuditMovement] = useState(null);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Create Adjustment Form State
    const [selectedMaterialId, setSelectedMaterialId] = useState("");
    const [physicalQty, setPhysicalQty] = useState("");
    const [reason, setReason] = useState("Physical Count");
    const [notes, setNotes] = useState("");
    const [storageLocation, setStorageLocation] = useState("Main Dry Store");

    const [toastMessage, setToastMessage] = useState(null);

    const showToast = (msg, type = "success") => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Check Role-Based Permissions
    useEffect(() => {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            try {
                const u = JSON.parse(userStr);
                setUser(u);
                const role = (u.role || u.user?.role || "").toUpperCase();
                // Owner, Manager, Super Admin, Store Manager have full adjustment permissions
                const authorized = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN", "STORE_MANAGER"].includes(role);
                setCanAdjust(authorized);
            } catch (err) {
                console.error("Error parsing user role:", err);
            }
        }
    }, []);

    // 1. Fetch Materials & Adjustment History
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

            // Fetch materials list
            const matRes = await api.get(`/owner/${restaurantId}/inventory/materials`);
            const matList = Array.isArray(matRes.data) ? matRes.data : matRes.data?.materials || [];
            setMaterials(matList);

            // Fetch adjustment ledger movements
            const ledgerRes = await api.get(`/owner/${restaurantId}/inventory/ledger`, {
                params: {
                    movementType: "ALL",
                    limit: 300,
                },
            });

            const allMovements = ledgerRes.data?.movements || [];
            // Filter movements containing ADJUSTMENT or OPENING
            const adjMovements = allMovements.filter((m) => {
                const mType = (m.movementType || "").toUpperCase();
                return mType.includes("ADJUSTMENT") || mType.includes("OPENING") || m.sourceType === "ADJUSTMENT";
            });

            setMovements(adjMovements);
        } catch (err) {
            console.error("Error fetching adjustment data:", err);
            showToast("Failed to load inventory adjustment history", "error");
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

    // Currently Selected Material in Adjustment Form
    const selectedMaterial = useMemo(() => {
        return materials.find((m) => String(m.id) === String(selectedMaterialId)) || null;
    }, [materials, selectedMaterialId]);

    const systemQty = selectedMaterial ? selectedMaterial.displayStock ?? selectedMaterial.currentStock ?? 0 : 0;
    const materialUnit = selectedMaterial ? selectedMaterial.displayUnit || selectedMaterial.baseUnit || "Kg" : "Kg";
    const parsedPhysicalQty = physicalQty === "" ? 0 : Number(physicalQty);
    const variance = selectedMaterial ? Math.round((parsedPhysicalQty - systemQty) * 100) / 100 : 0;
    const direction = variance >= 0 ? "IN" : "OUT";
    const unitCost = selectedMaterial ? selectedMaterial.unitCost ?? selectedMaterial.costPerBaseUnit ?? 0 : 0;
    const financialImpact = Math.abs(variance * unitCost);

    // Process Adjustment Movements for Table & Metrics
    const processedAdjustments = useMemo(() => {
        const todayStr = new Date().toDateString();

        return movements.map((m) => {
            const qty = m.quantity || 0;
            const isPositive = qty > 0;
            const unit = m.rawMaterial?.displayUnit || m.rawMaterial?.baseUnit || "Kg";
            const cost = m.unitCost || m.rawMaterial?.costPerBaseUnit || 0;
            const val = Math.abs(qty * cost);

            const mDate = new Date(m.createdAt);
            const isToday = mDate.toDateString() === todayStr;

            return {
                ...m,
                isPositive,
                unit,
                cost,
                financialVal: val,
                isToday,
                performedBy: m.performedByName || "Staff",
                reasonText: m.notes || "Physical count correction",
                storageLocation: m.rawMaterial?.storageLocation || "Main Dry Store",
            };
        });
    }, [movements]);

    // Top Metrics Calculations
    const metrics = useMemo(() => {
        let adjustmentsToday = 0;
        let positiveCount = 0;
        let negativeCount = 0;
        let totalValue = 0;

        processedAdjustments.forEach((m) => {
            if (m.isToday) adjustmentsToday++;
            if (m.isPositive) positiveCount++;
            else negativeCount++;
            totalValue += m.financialVal;
        });

        return {
            adjustmentsToday,
            positiveCount,
            negativeCount,
            totalValue: Math.round(totalValue),
        };
    }, [processedAdjustments]);

    // Unique Performers for Filter
    const performers = useMemo(() => {
        const set = new Set(processedAdjustments.map((m) => m.performedBy));
        return Array.from(set);
    }, [processedAdjustments]);

    // Filtered Table Data
    const filteredAdjustments = useMemo(() => {
        return processedAdjustments.filter((m) => {
            const matchesSearch =
                !search ||
                (m.rawMaterial?.name && m.rawMaterial.name.toLowerCase().includes(search.toLowerCase())) ||
                (m.sourceId && m.sourceId.toLowerCase().includes(search.toLowerCase())) ||
                (m.reasonText && m.reasonText.toLowerCase().includes(search.toLowerCase())) ||
                m.performedBy.toLowerCase().includes(search.toLowerCase());

            const matchesReason = reasonFilter === "ALL" || m.reasonText.toLowerCase().includes(reasonFilter.toLowerCase());
            const matchesDirection =
                directionFilter === "ALL" ||
                (directionFilter === "POSITIVE" && m.isPositive) ||
                (directionFilter === "NEGATIVE" && !m.isPositive);
            const matchesUser = userFilter === "ALL" || m.performedBy === userFilter;

            return matchesSearch && matchesReason && matchesDirection && matchesUser;
        });
    }, [processedAdjustments, search, reasonFilter, directionFilter, userFilter]);

    // Submit New Stock Adjustment
    const handleCreateAdjustmentSubmit = async (e) => {
        e.preventDefault();

        if (!canAdjust) {
            showToast("Role permission denied. Only Authorized Owners/Managers can adjust stock.", "error");
            return;
        }

        if (!selectedMaterialId) {
            showToast("Please select an inventory item to adjust", "error");
            return;
        }

        if (!reason) {
            showToast("Please select a valid adjustment reason", "error");
            return;
        }

        if (variance === 0) {
            showToast("Physical quantity matches system stock. No variance to record.", "error");
            return;
        }

        try {
            setActionLoading(true);
            const userStr = localStorage.getItem("user");
            let restaurantId = null;
            if (userStr) {
                const u = JSON.parse(userStr);
                restaurantId = u.restaurantId || u.restaurant?.id;
            }

            const adjustmentQty = Math.abs(variance);
            const fullReason = `${reason}: ${notes ? notes.trim() : "Stock physical audit"}`;

            await api.post(`/owner/${restaurantId}/inventory/adjustments`, {
                rawMaterialId: Number(selectedMaterialId),
                quantity: adjustmentQty,
                unit: materialUnit,
                direction: direction,
                reason: fullReason,
            });

            showToast(
                `Recorded ${direction === "IN" ? "+" : "-"}${adjustmentQty} ${materialUnit} adjustment for ${selectedMaterial.name}!`
            );

            setShowCreateModal(false);
            setSelectedMaterialId("");
            setPhysicalQty("");
            setNotes("");
            fetchData();
        } catch (err) {
            console.error("Error submitting stock adjustment:", err);
            showToast(err?.response?.data?.message || "Failed to submit stock adjustment", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Export CSV
    const exportCSV = () => {
        if (!filteredAdjustments || filteredAdjustments.length === 0) {
            showToast("No adjustment history to export", "error");
            return;
        }

        const headers = ["Date & Time", "Item", "Reference", "Variance Qty", "Unit", "Financial Impact", "Reason", "Location", "User"];
        const rows = filteredAdjustments.map((m) => [
            new Date(m.createdAt).toLocaleString("en-IN"),
            `"${(m.rawMaterial?.name || "Item").replace(/"/g, '""')}"`,
            m.sourceId || `ADJ-${m.id}`,
            m.quantity,
            m.unit,
            `INR ${m.financialVal}`,
            `"${(m.reasonText || "").replace(/"/g, '""')}"`,
            `"${(m.storageLocation || "").replace(/"/g, '""')}"`,
            `"${m.performedBy.replace(/"/g, '""')}"`,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Stock_Adjustments_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Stock Adjustments exported as CSV");
    };

    if (loading && materials.length === 0) {
        return (
            <div className="min-h-screen bg-[#faf9f6] p-6 flex flex-col justify-center items-center font-sans">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-600 font-medium text-sm">Evaluating physical stock adjustment ledger & permissions...</p>
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
                                <SlidersHorizontal size={28} className="text-amber-600" />
                                Stock Adjustment Management
                            </h1>
                            <span
                                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                    canAdjust ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                                }`}
                            >
                                {canAdjust ? "Authorized Access" : "View-Only Access"}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Reconcile physical stock counts against system records with audit tracking and reason enforcement.
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

                        <button
                            onClick={() => {
                                if (!canAdjust) {
                                    showToast("Role permission denied. Only Owners and Managers can adjust stock.", "error");
                                    return;
                                }
                                setShowCreateModal(true);
                            }}
                            disabled={!canAdjust}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition ${
                                canAdjust
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white cursor-pointer"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                            }`}
                        >
                            {canAdjust ? <Plus size={16} /> : <Lock size={15} />}
                            Create Stock Adjustment
                        </button>
                    </div>
                </div>

                {!canAdjust && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                        <ShieldAlert size={16} className="text-amber-700 shrink-0" />
                        <span>
                            <strong>Role Restriction Notice:</strong> You are currently logged in with limited privileges. Stock modification operations require <strong>Owner</strong> or <strong>Manager</strong> credentials.
                        </span>
                    </div>
                )}
            </div>

            {/* TOP METRIC CARDS (4 Cards) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Adjustments Today */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-amber-200 transition">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adjustments Today</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{metrics.adjustmentsToday}</div>
                        <p className="text-[11px] text-slate-500">Physical count audit events today</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                        <Calendar size={24} />
                    </div>
                </div>

                {/* Positive Adjustments */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-emerald-200 transition">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Positive Adjustments</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">+{metrics.positiveCount}</div>
                        <p className="text-[11px] text-slate-500">Surplus physical stock found</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <TrendingUp size={24} />
                    </div>
                </div>

                {/* Negative Adjustments */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-rose-200 transition">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Negative Adjustments</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-rose-600">-{metrics.negativeCount}</div>
                        <p className="text-[11px] text-slate-500">Deficit & spoilage stock-outs</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                        <TrendingDown size={24} />
                    </div>
                </div>

                {/* Adjustment Value */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-purple-200 transition">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adjustment Value</span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-purple-700">
                            ₹{metrics.totalValue.toLocaleString("en-IN")}
                        </div>
                        <p className="text-[11px] text-slate-500">Total financial valuation impact</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
                        <DollarSign size={24} />
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
                            placeholder="Search item, adjustment reference, reason, or staff user..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                    </div>

                    {/* Dropdown Filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Direction Filter */}
                        <select
                            value={directionFilter}
                            onChange={(e) => setDirectionFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                        >
                            <option value="ALL">All Directions (+/-)</option>
                            <option value="POSITIVE">Positive (+Surplus)</option>
                            <option value="NEGATIVE">Negative (-Deficit)</option>
                        </select>

                        {/* Reason Filter */}
                        <select
                            value={reasonFilter}
                            onChange={(e) => setReasonFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="ALL">All Reasons</option>
                            <option value="Physical Count">Physical Count</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Spoilage">Spoilage</option>
                            <option value="Data Correction">Data Correction</option>
                            <option value="Unknown Variance">Unknown Variance</option>
                            <option value="Other">Other</option>
                        </select>

                        {/* User Filter */}
                        <select
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="ALL">All Users</option>
                            {performers.map((p) => (
                                <option key={p} value={p}>
                                    {p}
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

            {/* ADJUSTMENT HISTORY TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Box size={18} className="text-amber-600" />
                            Stock Adjustment Ledger ({filteredAdjustments.length})
                        </h2>
                        <p className="text-xs text-slate-500">Historical records of stock physical reconciliations and variance reasons</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                                <th className="py-3 px-4">Date & Time</th>
                                <th className="py-3 px-4">Item</th>
                                <th className="py-3 px-4">Reference</th>
                                <th className="py-3 px-4 text-right">Variance Qty</th>
                                <th className="py-3 px-4 text-right">Financial Impact</th>
                                <th className="py-3 px-4">Reason / Notes</th>
                                <th className="py-3 px-4">Storage Location</th>
                                <th className="py-3 px-4">Performed By</th>
                                <th className="py-3 px-4 text-center">Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filteredAdjustments.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                                        <p className="font-bold text-slate-700 text-sm">No Stock Adjustments Found!</p>
                                        <p className="text-xs text-slate-400 mt-1">No adjustment history matching the current filter options.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAdjustments.map((m) => {
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
                                                {m.sourceId || `ADJ-${m.id}`}
                                            </td>

                                            {/* Variance Qty */}
                                            <td
                                                className={`py-3.5 px-4 text-right font-extrabold whitespace-nowrap ${
                                                    m.isPositive ? "text-emerald-600" : "text-rose-600"
                                                }`}
                                            >
                                                {m.isPositive ? `+${m.quantity}` : m.quantity} <span className="text-[10px] font-normal text-slate-400">{m.unit}</span>
                                            </td>

                                            {/* Financial Impact */}
                                            <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                                                ₹{m.financialVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Reason / Notes */}
                                            <td className="py-3.5 px-4 text-slate-800">
                                                <span className="font-semibold block">{m.reasonText}</span>
                                            </td>

                                            {/* Storage Location */}
                                            <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">{m.storageLocation}</td>

                                            {/* Performed By */}
                                            <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    <User size={13} className="text-slate-400" />
                                                    <span>{m.performedBy}</span>
                                                </div>
                                            </td>

                                            {/* Audit Action */}
                                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => {
                                                        setSelectedAuditMovement(m);
                                                        setShowAuditModal(true);
                                                    }}
                                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
                                                    title="View Audit Detail"
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
            </div>

            {/* CREATE STOCK ADJUSTMENT WORKFLOW MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <SlidersHorizontal size={18} className="text-amber-600" /> Create Physical Stock Adjustment
                            </h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateAdjustmentSubmit} className="p-6 space-y-4 text-xs">
                            {/* 1. Select Item */}
                            <div className="space-y-1">
                                <label className="font-bold text-slate-800">1. Select Inventory Item *</label>
                                <select
                                    required
                                    value={selectedMaterialId}
                                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white font-medium"
                                >
                                    <option value="">-- Choose Inventory Item --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} ({m.category || "General"}) • Current System: {m.displayStock ?? m.currentStock ?? 0} {m.displayUnit || m.baseUnit || "Kg"}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Stock Comparison Grid */}
                            <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">System Stock</span>
                                    <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                                        {systemQty} <span className="text-[10px] font-normal text-slate-500">{materialUnit}</span>
                                    </p>
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Physical Input</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        min="0"
                                        placeholder="0.0"
                                        value={physicalQty}
                                        onChange={(e) => setPhysicalQty(e.target.value)}
                                        className="w-full px-2 py-1 mt-0.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                    />
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Variance Qty</span>
                                    <p
                                        className={`text-sm font-black mt-0.5 ${
                                            variance > 0 ? "text-emerald-600" : variance < 0 ? "text-rose-600" : "text-slate-500"
                                        }`}
                                    >
                                        {variance > 0 ? `+${variance}` : variance} <span className="text-[10px] font-normal text-slate-400">{materialUnit}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Financial Impact Banner */}
                            {selectedMaterial && variance !== 0 && (
                                <div
                                    className={`p-3 rounded-xl border text-xs flex items-center justify-between font-semibold ${
                                        variance > 0
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                            : "bg-rose-50 border-rose-200 text-rose-900"
                                    }`}
                                >
                                    <span>Financial Valuation Impact:</span>
                                    <span className="font-extrabold text-sm">₹{financialImpact.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {/* 2. Reason Dropdown (Mandatory) */}
                            <div className="space-y-1">
                                <label className="font-bold text-slate-800">2. Adjustment Reason (Required) *</label>
                                <select
                                    required
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white font-semibold text-slate-800"
                                >
                                    <option value="Physical Count">Physical Count Audit Correction</option>
                                    <option value="Damaged">Damaged Packaging / Delivery Loss</option>
                                    <option value="Spoilage">Kitchen Spoilage / Quality Loss</option>
                                    <option value="Data Correction">System Entry Data Correction</option>
                                    <option value="Unknown Variance">Unknown Unexplained Variance</option>
                                    <option value="Other">Other Specific Operational Reason</option>
                                </select>
                            </div>

                            {/* 3. Storage Location */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-800">3. Storage Location</label>
                                    <select
                                        value={storageLocation}
                                        onChange={(e) => setStorageLocation(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                    >
                                        <option value="Main Dry Store">Main Dry Store</option>
                                        <option value="Cold Storage / Walk-in Freezer">Cold Storage / Walk-in Freezer</option>
                                        <option value="Kitchen Prep Bay">Kitchen Prep Bay</option>
                                        <option value="Bar & Beverage Store">Bar & Beverage Store</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-800">4. Logged-in User</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={user?.name || user?.userName || "Staff / Manager"}
                                        className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-xl text-slate-600 font-semibold cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            {/* 5. Notes */}
                            <div className="space-y-1">
                                <label className="font-bold text-slate-800">5. Operational Audit Notes</label>
                                <textarea
                                    rows={2}
                                    placeholder="Add any additional context or audit comments..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm transition"
                                >
                                    {actionLoading ? "Recording..." : "Record Adjustment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AUDIT DETAIL MODAL */}
            {showAuditModal && selectedAuditMovement && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Info size={18} className="text-amber-600" /> Stock Adjustment Audit Detail
                            </h3>
                            <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 text-xs">
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                <span className="font-mono text-xs font-bold text-amber-700">{selectedAuditMovement.sourceId || `ADJ-${selectedAuditMovement.id}`}</span>
                                <h4 className="text-base font-bold text-slate-900">{selectedAuditMovement.rawMaterial?.name}</h4>
                                <p className="text-slate-500">{selectedAuditMovement.rawMaterial?.category || "General"}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Variance Change</span>
                                    <p className={`text-sm font-bold mt-0.5 ${selectedAuditMovement.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                                        {selectedAuditMovement.isPositive ? `+${selectedAuditMovement.quantity}` : selectedAuditMovement.quantity} {selectedAuditMovement.unit}
                                    </p>
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Financial Impact</span>
                                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                                        ₹{selectedAuditMovement.financialVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                <span className="font-semibold text-slate-900">Reason & Audit Trail</span>
                                <p className="text-slate-700 font-medium">{selectedAuditMovement.reasonText}</p>
                                <p className="text-slate-500 text-[11px] pt-1">
                                    Performed by: <strong>{selectedAuditMovement.performedBy}</strong> on {new Date(selectedAuditMovement.createdAt).toLocaleString("en-IN")}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
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
