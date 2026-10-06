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
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

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
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col justify-center items-center font-sans">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-600 font-medium text-xs">Loading physical stock adjustment ledger & permissions...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 ${
                        toastMessage.type === "error" ? "bg-red-50 text-red-900 border-red-200" : "bg-emerald-50 text-emerald-900 border-emerald-200"
                    }`}
                >
                    {toastMessage.type === "error" ? <AlertTriangle size={16} className="text-red-600" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
                    <span>{toastMessage.msg}</span>
                </div>
            )}

            {/* HEADER CONSOLE BAR */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-2xs">
                <div className="w-full px-3 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <OwnerMenuButton />
                                <Link
                                    to="/owner/supply-chain/inventory"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 hover:text-amber-700 transition-colors"
                                >
                                    <ArrowLeft size={13} /> Back to Master Inventory
                                </Link>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                                    <SlidersHorizontal size={20} className="text-orange-500" />
                                    Stock Adjustment Management
                                </h1>
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                                        canAdjust ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-900 border-amber-200"
                                    }`}
                                >
                                    {canAdjust ? "Authorized Access" : "View-Only Access"}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Reconcile physical inventory counts against system records with audit tracking and reason enforcement.
                            </p>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
                                title="Refresh Ledger"
                            >
                                <RefreshCw size={15} className={refreshing ? "animate-spin text-orange-500" : ""} />
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
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer ${
                                    canAdjust
                                        ? "bg-orange-500 hover:bg-orange-600 text-white"
                                        : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                                }`}
                            >
                                {canAdjust ? <Plus size={15} /> : <Lock size={14} />}
                                <span>Create Stock Adjustment</span>
                            </button>
                        </div>
                    </div>

                    {!canAdjust && (
                        <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center gap-2 font-medium">
                            <ShieldAlert size={15} className="text-amber-700 shrink-0" />
                            <span>
                                <strong>Role Restriction Notice:</strong> You are logged in with read-only access. Stock modifications require <strong>Owner</strong> or <strong>Manager</strong> credentials.
                            </span>
                        </div>
                    )}
                </div>
            </header>

            <main className="w-full px-3 py-4 space-y-4">
                <SupplyChainSubNav />

                {/* ADJUSTMENT METRICS ROW (Flat Horizontal Analytics Layout) */}
                <div className="border-b border-slate-200/80 pb-4 space-y-2">
                    <p className="text-[11px] font-bold text-orange-500 uppercase tracking-wider">ADJUSTMENT PERFORMANCE OVERVIEW</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ADJUSTMENTS TODAY</span>
                            <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">{metrics.adjustmentsToday}</div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Audit events logged today</p>
                        </div>

                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">STOCK INCREASES</span>
                            <div className="text-2xl font-black text-emerald-600 tracking-tight mt-0.5">+{metrics.positiveCount}</div>
                            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Surplus physical stock added</p>
                        </div>

                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">STOCK DECREASES</span>
                            <div className="text-2xl font-black text-rose-600 tracking-tight mt-0.5">-{metrics.negativeCount}</div>
                            <p className="text-[11px] text-rose-600 font-medium mt-0.5">Deficit, waste & loss removals</p>
                        </div>

                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">FINANCIAL IMPACT</span>
                            <div className={`text-2xl font-black tracking-tight mt-0.5 ${metrics.totalNetValuationChange < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                {metrics.totalNetValuationChange < 0 ? "-" : "+"}₹{Math.abs(metrics.totalNetValuationChange).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Net inventory asset variance</p>
                        </div>
                    </div>
                </div>

                {/* FILTERS & SEARCH TOOLBAR */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search item name, reference ID, reason text, or staff member..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                            {search && (
                                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Dropdown Filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Direction Filter */}
                            <select
                                value={directionFilter}
                                onChange={(e) => setDirectionFilter(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50/50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            >
                                <option value="ALL">All Directions (+/-)</option>
                                <option value="POSITIVE">Increases (+Surplus)</option>
                                <option value="NEGATIVE">Decreases (-Deficit)</option>
                            </select>

                            {/* Reason Filter */}
                            <select
                                value={reasonFilter}
                                onChange={(e) => setReasonFilter(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50/50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                                className="px-3 py-1.5 bg-slate-50/50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            >
                                <option value="ALL">All Performers</option>
                                {performers.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>

                            {/* Export Button */}
                            <button
                                onClick={exportCSV}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer"
                            >
                                <Download size={14} className="text-slate-500" />
                                <span>Export CSV</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ADJUSTMENT AUDIT TABLE */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                    <div className="p-4 bg-slate-50/60 border-b border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Stock Adjustment Audit Trail</h3>
                            <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                                {filteredAdjustments.length} records
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">Historical records of stock physical reconciliations</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-2.5 px-3.5">Date & Time</th>
                                    <th className="py-2.5 px-3.5">Item & Category</th>
                                    <th className="py-2.5 px-3.5">Reference ID</th>
                                    <th className="py-2.5 px-3.5 text-right">Variance Qty</th>
                                    <th className="py-2.5 px-3.5 text-right">Financial Impact</th>
                                    <th className="py-2.5 px-3.5">Reason & Audit Context</th>
                                    <th className="py-2.5 px-3.5">Storage Location</th>
                                    <th className="py-2.5 px-3.5">Performed By</th>
                                    <th className="py-2.5 px-3.5 text-center">Audit Detail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
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
                                            <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                                                {/* Date/Time */}
                                                <td className="py-2 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                                                    {new Date(m.createdAt).toLocaleString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </td>

                                                {/* Item */}
                                                <td className="py-2 px-3.5 whitespace-nowrap">
                                                    {m.rawMaterial?.id ? (
                                                        <Link
                                                            to={`/owner/supply-chain/inventory/${m.rawMaterial.id}`}
                                                            className="font-bold text-slate-900 hover:text-orange-600 transition-colors text-[13px]"
                                                        >
                                                            {m.rawMaterial.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-bold text-slate-900 text-[13px]">{m.rawMaterial?.name || "Raw Material"}</span>
                                                    )}
                                                    <span className="block text-[10px] text-slate-400 font-medium">{m.rawMaterial?.category || "General"}</span>
                                                </td>

                                                {/* Reference */}
                                                <td className="py-2 px-3.5 font-mono text-[11px] font-bold text-amber-900 whitespace-nowrap">
                                                    {m.sourceId || `ADJ-${m.id}`}
                                                </td>

                                                {/* Variance Qty Color Coded (Green for Increase, Red for Decrease, Amber for Pending) */}
                                                <td className="py-2 px-3.5 text-right whitespace-nowrap">
                                                    {m.status === "PENDING" ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200">
                                                            <AlertTriangle size={11} className="text-amber-600" />
                                                            <span>Pending ({m.quantity} {m.unit})</span>
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                                            m.isPositive 
                                                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                                                                : "bg-rose-50 text-rose-800 border border-rose-200"
                                                        }`}>
                                                            {m.isPositive ? `+${m.quantity}` : m.quantity} {m.unit}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Financial Impact */}
                                                <td className="py-2 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap text-[13px]">
                                                    ₹{m.financialVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                </td>

                                                {/* Reason / Notes */}
                                                <td className="py-2 px-3.5 text-slate-700 max-w-xs truncate">
                                                    <span className="font-semibold">{m.reasonText}</span>
                                                </td>

                                                {/* Storage Location */}
                                                <td className="py-2 px-3.5 text-slate-600 font-medium whitespace-nowrap">{m.storageLocation}</td>

                                                {/* Performed By */}
                                                <td className="py-2 px-3.5 whitespace-nowrap font-medium text-slate-700">
                                                    <div className="flex items-center gap-1.5">
                                                        <User size={13} className="text-slate-400 shrink-0" />
                                                        <span>{m.performedBy}</span>
                                                    </div>
                                                </td>

                                                {/* Audit Action */}
                                                <td className="py-2 px-3.5 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedAuditMovement(m);
                                                            setShowAuditModal(true);
                                                        }}
                                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition shadow-2xs cursor-pointer"
                                                        title="View Audit Detail"
                                                    >
                                                        <Eye size={13} />
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
            </main>

            {/* CREATE STOCK ADJUSTMENT WORKFLOW MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <SlidersHorizontal size={16} className="text-orange-500" /> Create Physical Stock Adjustment
                            </h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateAdjustmentSubmit} className="p-5 space-y-3.5 text-xs">
                            {/* 1. Select Item */}
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700">1. Select Inventory Item *</label>
                                <select
                                    required
                                    value={selectedMaterialId}
                                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50/50 text-xs font-semibold text-slate-900"
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
                            <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                <div>
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">System Stock</span>
                                    <p className="text-xs font-black text-slate-900 mt-0.5">
                                        {systemQty} <span className="text-[10px] font-normal text-slate-500">{materialUnit}</span>
                                    </p>
                                </div>

                                <div>
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">Physical Input</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        min="0"
                                        placeholder="0.0"
                                        value={physicalQty}
                                        onChange={(e) => setPhysicalQty(e.target.value)}
                                        className="w-full px-2 py-1 mt-0.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                                    />
                                </div>

                                <div>
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">Variance Qty</span>
                                    <p
                                        className={`text-xs font-black mt-0.5 ${
                                            variance > 0 ? "text-emerald-700" : variance < 0 ? "text-rose-700" : "text-slate-500"
                                        }`}
                                    >
                                        {variance > 0 ? `+${variance}` : variance} <span className="text-[10px] font-normal text-slate-400">{materialUnit}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Financial Impact Banner */}
                            {selectedMaterial && variance !== 0 && (
                                <div
                                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between font-bold ${
                                        variance > 0
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                            : "bg-rose-50 border-rose-200 text-rose-900"
                                    }`}
                                >
                                    <span>Financial Valuation Impact:</span>
                                    <span className="font-black text-xs">₹{financialImpact.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {/* 2. Reason Dropdown (Mandatory) */}
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700">2. Adjustment Reason (Required) *</label>
                                <select
                                    required
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50/50 text-xs font-semibold text-slate-900"
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
                                    <label className="font-bold text-slate-700">3. Storage Location</label>
                                    <select
                                        value={storageLocation}
                                        onChange={(e) => setStorageLocation(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50/50 text-xs font-medium text-slate-900"
                                    >
                                        <option value="Main Dry Store">Main Dry Store</option>
                                        <option value="Cold Storage / Walk-in Freezer">Cold Storage / Walk-in Freezer</option>
                                        <option value="Kitchen Prep Bay">Kitchen Prep Bay</option>
                                        <option value="Bar & Beverage Store">Bar & Beverage Store</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">4. Logged-in User</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={user?.name || user?.userName || "Staff / Manager"}
                                        className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-xl text-slate-600 text-xs font-semibold cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            {/* 5. Notes */}
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700">5. Operational Audit Notes</label>
                                <textarea
                                    rows={2}
                                    placeholder="Add any additional context or audit comments..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50/50 text-xs font-medium text-slate-900"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition"
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
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Info size={16} className="text-orange-500" /> Stock Adjustment Audit Detail
                            </h3>
                            <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3.5 text-xs">
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                                <span className="font-mono text-xs font-bold text-amber-900">{selectedAuditMovement.sourceId || `ADJ-${selectedAuditMovement.id}`}</span>
                                <h4 className="text-sm font-bold text-slate-900">{selectedAuditMovement.rawMaterial?.name}</h4>
                                <p className="text-slate-500 text-[11px] font-medium">{selectedAuditMovement.rawMaterial?.category || "General"}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Variance Change</span>
                                    <p className={`text-xs font-extrabold mt-0.5 ${selectedAuditMovement.isPositive ? "text-emerald-700" : "text-rose-700"}`}>
                                        {selectedAuditMovement.isPositive ? `+${selectedAuditMovement.quantity}` : selectedAuditMovement.quantity} {selectedAuditMovement.unit}
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Financial Impact</span>
                                    <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                                        ₹{selectedAuditMovement.financialVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                <span className="font-bold text-slate-900">Reason & Audit Trail</span>
                                <p className="text-slate-700 font-medium">{selectedAuditMovement.reasonText}</p>
                                <p className="text-slate-500 text-[11px] pt-1">
                                    Performed by: <strong>{selectedAuditMovement.performedBy}</strong> on {new Date(selectedAuditMovement.createdAt).toLocaleString("en-IN")}
                                </p>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                                <button
                                    onClick={() => setShowAuditModal(false)}
                                    className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
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
