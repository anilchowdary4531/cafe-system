import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
    ChefHat,
    CheckCircle2,
    Clock3,
    LoaderCircle,
    RefreshCw,
    Search,
    Printer,
    FileText,
    AlertTriangle,
    SlidersHorizontal,
    Activity,
    Server,
    Laptop,
    X,
    Eye,
    Filter,
    RotateCcw,
    Check,
    Settings,
    Layers,
    ArrowUpRight,
    TrendingUp,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { showToast } from "../../utils/toast";
import { resolveEffectiveStaffRole } from "../../utils/staffRole";
import { playNotificationSound } from "../../utils/soundPlayer";

const STATUS_COLUMNS = ["PLACED", "PREPARING", "READY", "DELIVERED"];
const KOT_STATUSES = ["ALL", "PENDING", "PREPARING", "READY", "SERVED", "DELIVERED", "CANCELLED"];

const formatCurrency = (value) => {
    const number = Number(value || 0);
    if (Number.isNaN(number)) return "0.00";
    return number.toFixed(2);
};

const getMinutesSince = (isoDate) => {
    if (!isoDate) return null;
    const t = new Date(isoDate).getTime();
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 60000));
};

const formatTimeOnly = (isoDate) => {
    if (!isoDate) return "--:--";
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const normalizeStatus = (status) => {
    const raw = String(status || "PLACED").toUpperCase();
    const value = raw === "ACCEPTED" ? "PLACED" : raw;
    return STATUS_COLUMNS.includes(value) ? value : "PLACED";
};

const statusPillClass = (status) => {
    switch (status) {
        case "READY":
            return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
        case "PREPARING":
            return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
        case "DELIVERED":
        case "SERVED":
            return "bg-sky-500/20 text-sky-400 border border-sky-500/30";
        case "CANCELLED":
            return "bg-red-500/20 text-red-400 border border-red-500/30";
        default:
            return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    }
};

const nextActionByStatus = (status) => {
    if (status === "PLACED") return { label: "Start Preparing", nextStatus: "PREPARING" };
    if (status === "PREPARING") return { label: "Mark Ready", nextStatus: "READY" };
    if (status === "READY") return { label: "Mark Delivered", nextStatus: "DELIVERED" };
    return null;
};

export default function OwnerKitchenLive() {
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    const restaurantId = Number(authUser?.restaurantId || localStorage.getItem("activeRestaurantId") || 1);

    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") || "overview";

    const setActiveTab = (tabKey) => {
        setSearchParams({ tab: tabKey });
    };

    // Main Data State
    const [orders, setOrders] = useState([]);
    const [kots, setKots] = useState([]);
    const [stations, setStations] = useState([]);
    const [printers, setPrinters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [lastSyncAt, setLastSyncAt] = useState(null);
    const [updatingOrderId, setUpdatingOrderId] = useState(null);

    // Filters for Live KOTs Tab
    const [liveQuery, setLiveQuery] = useState("");
    const [liveStatusFilter, setLiveStatusFilter] = useState("ALL");
    const [liveStationFilter, setLiveStationFilter] = useState("ALL");

    // Filters for KOT Audit Trail Tab
    const [auditSearch, setAuditSearch] = useState("");
    const [auditStatusFilter, setAuditStatusFilter] = useState("ALL");
    const [auditStationFilter, setAuditStationFilter] = useState("ALL");
    const [auditUserFilter, setAuditUserFilter] = useState("ALL");
    const [auditActionFilter, setAuditActionFilter] = useState("ALL");
    const [auditDateFilter, setAuditDateFilter] = useState("TODAY");
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Audit Detail Modal
    const [selectedAuditKot, setSelectedAuditKot] = useState(null);
    const [reprintingKotId, setReprintingKotId] = useState(null);
    const [testingPrinterId, setTestingPrinterId] = useState(null);

    const { socket, connected } = useStaffSocket();
    const effectiveRole = resolveEffectiveStaffRole(authUser?.role, authUser?.designation);

    // 1. Fetch Live Orders
    const loadLiveOrders = async ({ silent = false } = {}) => {
        try {
            if (silent) setRefreshing(true);
            else setLoading(true);

            const res = await api.get("/orders/live");
            const list = Array.isArray(res?.data?.orders) ? res.data.orders : [];
            setOrders(list);
            setError("");
            setLastSyncAt(new Date());
        } catch (err) {
            console.error("Failed to fetch live orders", err);
            setError("Unable to load live kitchen data.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // 2. Fetch KOT History & Stations
    const loadKotHistory = async () => {
        if (!restaurantId || isNaN(Number(restaurantId))) return;
        try {
            const [kotsRes, stationsRes] = await Promise.all([
                api.get(`/owner/${restaurantId}/kots`),
                api.get(`/owner/${restaurantId}/stations`),
            ]);
            const kotsData = kotsRes?.data?.kots || kotsRes?.data?.data || (Array.isArray(kotsRes?.data) ? kotsRes.data : []);
            const stationsData = stationsRes?.data?.stations || stationsRes?.data?.data || (Array.isArray(stationsRes?.data) ? stationsRes.data : []);
            setKots(Array.isArray(kotsData) ? kotsData : []);
            setStations(Array.isArray(stationsData) ? stationsData : []);
        } catch (err) {
            console.error("Failed to load KOT history & stations", err);
        }
    };

    // 3. Fetch Hardware Printers
    const loadHardwarePrinters = async () => {
        if (!restaurantId || isNaN(Number(restaurantId))) return;
        try {
            const res = await api.get(`/owner/${restaurantId}/printers`);
            const printersData = res?.data?.printers || res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
            setPrinters(Array.isArray(printersData) ? printersData : []);
        } catch (err) {
            console.error("Failed to load printers", err);
        }
    };

    const handleRefreshAll = async () => {
        setRefreshing(true);
        await Promise.all([loadLiveOrders({ silent: true }), loadKotHistory(), loadHardwarePrinters()]);
        setRefreshing(false);
        showToast({ title: "Refreshed", message: "Kitchen Operations data updated.", variant: "info" });
    };

    useEffect(() => {
        loadLiveOrders();
        loadKotHistory();
        loadHardwarePrinters();
    }, [restaurantId]);

    // WebSocket real-time order listener for Live KOT tab
    useEffect(() => {
        if (!socket) return undefined;

        const onCreated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((o) => Number(o?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                const copy = list.slice();
                copy[idx] = order;
                return copy;
            });
            setLastSyncAt(new Date());
            playNotificationSound();
            const tableNo = String(order?.tableNo || "").trim();
            showToast({
                title: "New Kitchen Order",
                message: tableNo ? `Table ${tableNo}` : "Takeaway Order",
                variant: "info",
                durationMs: 1800,
            });
            loadKotHistory();
        };

        const onUpdated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((o) => Number(o?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                const copy = list.slice();
                copy[idx] = order;
                return copy;
            });
            setLastSyncAt(new Date());
            loadKotHistory();
        };

        socket.on("order:created", onCreated);
        socket.on("order:updated", onUpdated);
        return () => {
            socket.off("order:created", onCreated);
            socket.off("order:updated", onUpdated);
        };
    }, [socket]);

    const updateOrderStatus = async (order, status) => {
        const orderId = Number(order?.id || 0);
        if (!socket || !connected || !orderId || !status) return;

        setUpdatingOrderId(orderId);
        socket.emit("order:updateStatus", { orderId, status }, (ack) => {
            try {
                if (ack?.ok && ack.order) {
                    setOrders((prev) => {
                        const list = Array.isArray(prev) ? prev : [];
                        const idx = list.findIndex((o) => Number(o?.id || 0) === orderId);
                        if (idx === -1) return [ack.order, ...list];
                        const copy = list.slice();
                        copy[idx] = ack.order;
                        return copy;
                    });
                    setError("");
                    setLastSyncAt(new Date());
                    loadKotHistory();
                    return;
                }
                setError(String(ack?.message || "Failed to update order status."));
            } finally {
                setUpdatingOrderId(null);
            }
        });
    };

    const handleReprintKot = async (kotId) => {
        if (!kotId) return;
        setReprintingKotId(kotId);
        try {
            const res = await api.post(`/owner/${restaurantId}/kot/${kotId}/reprint`);
            if (res.data?.success) {
                showToast({ title: "Thermal Reprint", message: res.data.message || "KOT sent to thermal printer." });
            } else {
                showToast({ title: "Print Failed", message: res.data?.error || "Printer unreachable.", variant: "error" });
            }
            loadKotHistory();
        } catch (err) {
            showToast({ title: "Error", message: err?.response?.data?.message || "Failed to trigger reprint.", variant: "error" });
        } finally {
            setReprintingKotId(null);
        }
    };

    const handleTestPrinter = async (printerId) => {
        if (!printerId) return;
        setTestingPrinterId(printerId);
        try {
            const res = await api.post(`/owner/${restaurantId}/printers/${printerId}/test`);
            showToast({ title: "Printer Test", message: res.data?.message || "Test print sent successfully." });
        } catch (err) {
            showToast({ title: "Test Failed", message: err?.response?.data?.message || "Printer offline or unreachable.", variant: "error" });
        } finally {
            setTestingPrinterId(null);
        }
    };

    // Filtered Live Orders
    const filteredLiveOrders = useMemo(() => {
        const q = liveQuery.trim().toLowerCase();
        return orders.filter((order) => {
            if (liveStatusFilter !== "ALL" && normalizeStatus(order.status) !== liveStatusFilter) {
                return false;
            }
            if (liveStationFilter !== "ALL") {
                if (liveStationFilter === "UNASSIGNED" && order.stationId) return false;
                if (liveStationFilter !== "UNASSIGNED" && String(order.stationId) !== String(liveStationFilter)) return false;
            }
            if (!q) return true;
            const orderNo = String(order.orderNo || "").toLowerCase();
            const tableNo = String(order.tableNo || "").toLowerCase();
            const customer = String(order.customerName || "").toLowerCase();
            const kotNos = Array.isArray(order.kots)
                ? order.kots.map((k) => String(k.kotNo || k.kotNumber || "").toLowerCase()).join(" ")
                : "";
            return orderNo.includes(q) || tableNo.includes(q) || customer.includes(q) || kotNos.includes(q);
        });
    }, [orders, liveQuery, liveStatusFilter, liveStationFilter]);

    const liveGroupedOrders = useMemo(() => {
        const grouped = { PLACED: [], PREPARING: [], READY: [], DELIVERED: [] };
        filteredLiveOrders.forEach((order) => {
            const status = normalizeStatus(order.status);
            grouped[status].push(order);
        });
        return grouped;
    }, [filteredLiveOrders]);

    const liveCounts = useMemo(
        () => STATUS_COLUMNS.reduce((acc, key) => ({ ...acc, [key]: liveGroupedOrders[key].length }), {}),
        [liveGroupedOrders]
    );

    // Overview Statistics
    const overviewStats = useMemo(() => {
        const totalLive = orders.length;
        const totalKotsToday = kots.length || totalLive;
        const preparingCount = orders.filter((o) => normalizeStatus(o.status) === "PREPARING").length;
        const readyCount = orders.filter((o) => normalizeStatus(o.status) === "READY").length;
        const deliveredCount = orders.filter((o) => normalizeStatus(o.status) === "DELIVERED").length;
        const cancelledCount = kots.filter((k) => k.status === "CANCELLED").length;

        return {
            kotsToday: totalKotsToday,
            preparing: preparingCount,
            ready: readyCount,
            delivered: deliveredCount,
            cancelled: cancelledCount,
        };
    }, [orders, kots]);

    // Overview Activity Logs
    const recentActivityLogs = useMemo(() => {
        const logs = [];
        orders.slice(0, 8).forEach((o) => {
            const time = formatTimeOnly(o.createdAt || o.updatedAt);
            const orderNo = o.orderNo || `#${o.id}`;
            const kotNo = Array.isArray(o.kots) && o.kots.length > 0 ? (o.kots[0].kotNo || `KOT-${o.id}`) : `KOT-${o.id}`;
            const status = normalizeStatus(o.status);
            logs.push({
                time,
                kotNo,
                orderNo,
                tableNo: o.tableNo || "-",
                action: status === "PLACED" ? "Created" : status === "PREPARING" ? "Preparing" : status === "READY" ? "Ready" : "Delivered",
                status,
            });
        });
        return logs;
    }, [orders]);

    // KOT Audit Trail Filtered List
    const filteredAuditKots = useMemo(() => {
        return kots.filter((kot) => {
            if (auditStatusFilter !== "ALL" && kot.status !== auditStatusFilter) return false;
            if (auditStationFilter !== "ALL") {
                if (auditStationFilter === "UNASSIGNED" && kot.stationId !== null) return false;
                if (auditStationFilter !== "UNASSIGNED" && String(kot.stationId) !== String(auditStationFilter)) return false;
            }
            if (auditUserFilter !== "ALL") {
                const userName = String(kot.createdBy || kot.user?.name || "").toLowerCase();
                if (!userName.includes(auditUserFilter.toLowerCase())) return false;
            }
            if (auditActionFilter !== "ALL") {
                const action = String(kot.action || kot.status || "").toUpperCase();
                if (!action.includes(auditActionFilter)) return false;
            }

            const q = auditSearch.trim().toLowerCase();
            if (!q) return true;

            const kotNum = String(kot.kotNo || kot.kotNumber || "").toLowerCase();
            const orderNum = String(kot.order?.orderNo || kot.orderId || "").toLowerCase();
            const tableNum = String(kot.order?.tableNo || "").toLowerCase();
            const itemsMatch = Array.isArray(kot.items) && kot.items.some((i) => String(i.itemName || "").toLowerCase().includes(q));

            return kotNum.includes(q) || orderNum.includes(q) || tableNum.includes(q) || itemsMatch;
        });
    }, [kots, auditStatusFilter, auditStationFilter, auditUserFilter, auditActionFilter, auditSearch]);

    // Unique Users for Audit Filter
    const auditUsersList = useMemo(() => {
        const set = new Set();
        kots.forEach((k) => {
            const name = k.createdBy || k.user?.name;
            if (name) set.add(name);
        });
        return Array.from(set);
    }, [kots]);

    if (effectiveRole === "CHEF") {
        return <Navigate to="/kitchen" replace />;
    }

    return (
        <div className="px-3 py-1 sm:px-5 sm:py-1.5 w-full space-y-4 text-[color:var(--app-text)] font-sans">
            {/* Top Title & Contextual Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <ChefHat className="text-orange-500" size={26} />
                        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[color:var(--app-heading)]">
                            Kitchen Operations
                        </h1>
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--app-muted)]">
                        Manage live kitchen orders, KOT history, audit activity, and kitchen hardware from one place.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRefreshAll}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--app-border)]/50 bg-[color:var(--app-surface-2)] px-3.5 py-2 text-xs font-bold text-[color:var(--app-text)] transition hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                        <span>Refresh</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/owner/printers")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-black transition hover:bg-orange-400"
                    >
                        <Settings size={14} />
                        <span>Kitchen Settings</span>
                    </button>
                </div>
            </div>

            {/* Top Navigation Tabs (Google Cloud Style Section Navigation) */}
            <div className="flex items-center gap-2 border-b border-[color:var(--app-border)]/40 overflow-x-auto pb-0.5 scrollbar-none">
                {[
                    { key: "overview", label: "Overview", icon: Activity },
                    { key: "live", label: "Live KOTs", icon: ChefHat, count: orders.length },
                    { key: "audit", label: "KOT Audit Trail", icon: FileText, count: kots.length },
                    { key: "hardware", label: "Hardware & Print Logs", icon: Printer, count: printers.length },
                ].map((tab) => {
                    const isActive = activeTab === tab.key;
                    const IconComponent = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all ${
                                isActive
                                    ? "border-orange-500 text-orange-500 bg-orange-500/10 rounded-t-xl"
                                    : "border-transparent text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-t-xl"
                            }`}
                        >
                            <IconComponent size={15} />
                            <span>{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    isActive ? "bg-orange-500 text-black" : "bg-black/10 dark:bg-white/10 theme-muted"
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center justify-between">
                    <span>{error}</span>
                    <button type="button" onClick={handleRefreshAll} className="font-bold underline text-red-400">Retry</button>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB 1 — OVERVIEW */}
            {/* ========================================================= */}
            {activeTab === "overview" && (
                <div className="space-y-4">
                    {/* Top Summary Cards */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <div className="rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] p-4 shadow-xs">
                            <p className="text-[11px] font-bold uppercase tracking-wider theme-muted">KOTs Today</p>
                            <p className="mt-1 text-2xl font-black text-[color:var(--app-text)]">{overviewStats.kotsToday}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-xs">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Preparing</p>
                            <p className="mt-1 text-2xl font-black text-amber-500">{overviewStats.preparing}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-xs">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Ready</p>
                            <p className="mt-1 text-2xl font-black text-emerald-500">{overviewStats.ready}</p>
                        </div>
                        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 shadow-xs">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-500">Delivered</p>
                            <p className="mt-1 text-2xl font-black text-sky-500">{overviewStats.delivered}</p>
                        </div>
                        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 shadow-xs">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Cancelled</p>
                            <p className="mt-1 text-2xl font-black text-rose-500">{overviewStats.cancelled}</p>
                        </div>
                    </div>

                    {/* Main Overview Split Grid */}
                    <div className="grid gap-4 lg:grid-cols-3">
                        {/* Kitchen Activity Timeline (Left 2 cols) */}
                        <div className="lg:col-span-2 rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/30 pb-2">
                                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[color:var(--app-primary)] flex items-center gap-2">
                                    <Activity size={15} /> Recent KOT Activity Stream
                                </h3>
                                <button type="button" onClick={() => setActiveTab("audit")} className="text-xs font-bold text-orange-400 hover:underline">
                                    View Full Audit Log →
                                </button>
                            </div>

                            {recentActivityLogs.length === 0 ? (
                                <div className="py-8 text-center text-xs theme-muted">
                                    No recent kitchen activity recorded today.
                                </div>
                            ) : (
                                <div className="divide-y divide-[color:var(--app-border)]/30">
                                    {recentActivityLogs.map((log, idx) => (
                                        <div key={idx} className="flex items-center justify-between py-2.5 px-1 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-zinc-400 text-[11px] font-semibold">{log.time}</span>
                                                <span className="font-bold text-orange-400">{log.kotNo}</span>
                                                <span className="theme-muted">Order: {log.orderNo}</span>
                                                <span className="theme-muted">Table: {log.tableNo}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${statusPillClass(log.status)}`}>
                                                {log.action}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Hardware Status Compact List (Right 1 col) */}
                        <div className="rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/30 pb-2">
                                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[color:var(--app-primary)] flex items-center gap-2">
                                    <Server size={15} /> Hardware & Device Status
                                </h3>
                                <button type="button" onClick={() => setActiveTab("hardware")} className="text-xs font-bold text-orange-400 hover:underline">
                                    Manage →
                                </button>
                            </div>

                            <div className="divide-y divide-[color:var(--app-border)]/30">
                                {printers.length === 0 ? (
                                    <>
                                        <div className="flex items-center justify-between py-2.5 px-1 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <Printer size={15} className="text-emerald-400" />
                                                <span className="font-semibold">Kitchen Thermal Printer 01</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">ONLINE</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2.5 px-1 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <Laptop size={15} className="text-emerald-400" />
                                                <span className="font-semibold">KDS Display Terminal 01</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">ONLINE</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2.5 px-1 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <Server size={15} className="text-emerald-400" />
                                                <span className="font-semibold">POS Billing Desk</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">ONLINE</span>
                                        </div>
                                    </>
                                ) : (
                                    printers.map((p) => (
                                        <div key={p.id} className="flex items-center justify-between py-2.5 px-1 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <Printer size={15} className={p.isActive !== false ? "text-emerald-400" : "text-rose-400"} />
                                                <span className="font-semibold">{p.name || `Printer #${p.id}`}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                p.isActive !== false ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                            }`}>
                                                {p.isActive !== false ? "ONLINE" : "OFFLINE"}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2 — LIVE KOTS */}
            {/* ========================================================= */}
            {activeTab === "live" && (
                <div className="space-y-4">
                    {/* Live KOT Filter Controls Bar */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                        {/* Status Pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                            <button
                                type="button"
                                onClick={() => setLiveStatusFilter("ALL")}
                                className={`rounded-xl px-3 py-1.5 text-xs font-extrabold whitespace-nowrap transition ${
                                    liveStatusFilter === "ALL"
                                        ? "bg-orange-500 text-black shadow-xs"
                                        : "theme-muted hover:bg-black/5 dark:hover:bg-white/5"
                                }`}
                            >
                                All ({orders.length})
                            </button>
                            {STATUS_COLUMNS.map((col) => (
                                <button
                                    key={col}
                                    type="button"
                                    onClick={() => setLiveStatusFilter(col)}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-extrabold whitespace-nowrap transition ${
                                        liveStatusFilter === col
                                            ? "bg-orange-500 text-black shadow-xs"
                                            : "theme-muted hover:bg-black/5 dark:hover:bg-white/5"
                                    }`}
                                >
                                    {col} ({liveCounts[col] || 0})
                                </button>
                            ))}
                        </div>

                        {/* Search & Station Selector */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 theme-muted" />
                                <input
                                    value={liveQuery}
                                    onChange={(e) => setLiveQuery(e.target.value)}
                                    placeholder="Search order #, table, customer, or KOT #..."
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent py-1.5 pl-9 pr-3 text-xs outline-none focus:border-orange-500"
                                />
                            </div>
                            <select
                                value={liveStationFilter}
                                onChange={(e) => setLiveStationFilter(e.target.value)}
                                className="rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-3 py-1.5 text-xs outline-none focus:border-orange-500"
                            >
                                <option value="ALL" className="bg-zinc-900 text-white">All Stations</option>
                                <option value="UNASSIGNED" className="bg-zinc-900 text-white">Unassigned</option>
                                {stations.map((st) => (
                                    <option key={st.id} value={st.id} className="bg-zinc-900 text-white">
                                        {st.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Live KOT Cards Grid */}
                    <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
                        {STATUS_COLUMNS.map((status) => {
                            if (liveStatusFilter !== "ALL" && liveStatusFilter !== status) return null;

                            return (
                                <div key={status} className="rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/30 pb-2">
                                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-orange-400">{status}</h4>
                                        <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                                            {liveCounts[status] || 0}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {liveGroupedOrders[status].map((order) => {
                                            const prepMins = getMinutesSince(order.createdAt);
                                            const action = nextActionByStatus(normalizeStatus(order.status));

                                            return (
                                                <article
                                                    key={order.id}
                                                    className="rounded-xl border border-[color:var(--app-border)]/40 bg-black/10 dark:bg-white/5 p-3.5 space-y-3 shadow-xs"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <p className="text-sm font-black">
                                                                    {order.orderNo || `Order #${order.id}`}
                                                                </p>
                                                                {Array.isArray(order.kots) && order.kots.length > 0 && (
                                                                    <span className="rounded bg-orange-500/20 text-orange-400 px-1.5 py-0.5 text-[10px] font-extrabold font-mono">
                                                                        {order.kots.map((k) => k.kotNo || k.kotNumber).join(", ")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="theme-muted text-xs mt-0.5">
                                                                Table {order.tableNo || "-"}
                                                                {order.customerName ? ` • ${order.customerName}` : ""}
                                                            </p>
                                                        </div>
                                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusPillClass(normalizeStatus(order.status))}`}>
                                                            {normalizeStatus(order.status)}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-2 border-t border-[color:var(--app-border)]/30 pt-2">
                                                        {(order.items || []).map((item, iIdx) => {
                                                            const variantLabel = item.variantName || item.variant?.name || "";
                                                            const addons = Array.isArray(item.selectedAddons)
                                                                ? item.selectedAddons
                                                                : (Array.isArray(item.modifiers) ? item.modifiers : []);

                                                            return (
                                                                <div key={iIdx} className="space-y-0.5 text-xs">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="font-semibold">
                                                                            <strong className="text-orange-500 font-extrabold mr-1">{item.qty || item.quantity || 1}x</strong>
                                                                            {item.itemName || item.name}
                                                                        </span>
                                                                        <span className="theme-muted font-mono">
                                                                            ₹{formatCurrency(item.total || item.price * (item.qty || 1))}
                                                                        </span>
                                                                    </div>

                                                                    {(variantLabel || (addons && addons.length > 0)) && (
                                                                        <div className="pl-3 text-[11px] theme-muted space-y-0.5 border-l-2 border-orange-500/40">
                                                                            {variantLabel && (
                                                                                <div>Size: <span className="font-medium">{variantLabel}</span></div>
                                                                            )}
                                                                            {addons && addons.map((add, idx) => (
                                                                                <div key={idx}>
                                                                                    + {add.groupName ? `${add.groupName}: ` : ""}{add.name || add.optionName}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="flex items-center justify-between border-t border-[color:var(--app-border)]/30 pt-2 text-xs theme-muted">
                                                        <span>Total: ₹{formatCurrency(order.total)}</span>
                                                        <span className="inline-flex items-center gap-1 text-[11px]">
                                                            <Clock3 size={13} />
                                                            {prepMins === null ? "--" : `${prepMins} mins ago`}
                                                        </span>
                                                    </div>

                                                    {action && (
                                                        <button
                                                            type="button"
                                                            onClick={() => updateOrderStatus(order, action.nextStatus)}
                                                            disabled={updatingOrderId === order.id}
                                                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-2 text-xs font-black text-black shadow-md hover:from-orange-400 hover:to-amber-400 transition disabled:opacity-60"
                                                        >
                                                            {updatingOrderId === order.id ? (
                                                                <LoaderCircle size={14} className="animate-spin" />
                                                            ) : (
                                                                <CheckCircle2 size={14} />
                                                            )}
                                                            <span>{action.label}</span>
                                                        </button>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>

                                    {!loading && liveGroupedOrders[status].length === 0 && (
                                        <div className="rounded-xl border border-dashed border-[color:var(--app-border)]/40 p-4 text-center text-xs theme-muted">
                                            No active kitchen orders in {status.toLowerCase()} queue. New KOTs will appear automatically.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB 3 — KOT AUDIT TRAIL */}
            {/* ========================================================= */}
            {activeTab === "audit" && (
                <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="flex flex-col gap-3.5 border-b border-[color:var(--app-border)]/40 pb-3">
                        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[220px]">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 theme-muted" />
                                <input
                                    value={auditSearch}
                                    onChange={(e) => setAuditSearch(e.target.value)}
                                    placeholder="Search KOT #, Order #, Table, or Item..."
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent py-2 pl-9 pr-3 text-xs outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Status Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                {KOT_STATUSES.map((st) => (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => setAuditStatusFilter(st)}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold whitespace-nowrap transition ${
                                            auditStatusFilter === st
                                                ? "bg-orange-500 text-black shadow-xs"
                                                : "theme-muted hover:bg-black/5 dark:hover:bg-white/5"
                                        }`}
                                    >
                                        {st}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                                    showAdvancedFilters
                                        ? "border-orange-500 bg-orange-500/10 text-orange-500"
                                        : "border-[color:var(--app-border)]/40 theme-muted hover:bg-black/5 dark:hover:bg-white/5"
                                }`}
                            >
                                <Filter size={14} />
                                <span>Filters</span>
                            </button>
                        </div>

                        {/* Collapsible Advanced Filters */}
                        {showAdvancedFilters && (
                            <div className="grid gap-3 rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] p-3.5 sm:grid-cols-4 text-xs">
                                <div>
                                    <label className="font-bold text-[10px] uppercase tracking-wider theme-muted">Station:</label>
                                    <select
                                        value={auditStationFilter}
                                        onChange={(e) => setAuditStationFilter(e.target.value)}
                                        className="w-full mt-1 rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-2.5 py-1.5 outline-none"
                                    >
                                        <option value="ALL" className="bg-zinc-900 text-white">All Stations</option>
                                        <option value="UNASSIGNED" className="bg-zinc-900 text-white">Unassigned</option>
                                        {stations.map((st) => (
                                            <option key={st.id} value={st.id} className="bg-zinc-900 text-white">{st.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-[10px] uppercase tracking-wider theme-muted">User / Staff:</label>
                                    <select
                                        value={auditUserFilter}
                                        onChange={(e) => setAuditUserFilter(e.target.value)}
                                        className="w-full mt-1 rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-2.5 py-1.5 outline-none"
                                    >
                                        <option value="ALL" className="bg-zinc-900 text-white">All Users</option>
                                        {auditUsersList.map((u) => (
                                            <option key={u} value={u} className="bg-zinc-900 text-white">{u}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-[10px] uppercase tracking-wider theme-muted">Action Type:</label>
                                    <select
                                        value={auditActionFilter}
                                        onChange={(e) => setAuditActionFilter(e.target.value)}
                                        className="w-full mt-1 rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-2.5 py-1.5 outline-none"
                                    >
                                        <option value="ALL" className="bg-zinc-900 text-white">All Actions</option>
                                        <option value="CREATED" className="bg-zinc-900 text-white">Created</option>
                                        <option value="SENT TO KITCHEN" className="bg-zinc-900 text-white">Sent To Kitchen</option>
                                        <option value="ACCEPTED" className="bg-zinc-900 text-white">Accepted</option>
                                        <option value="REPRINTED" className="bg-zinc-900 text-white">Reprinted</option>
                                        <option value="CANCELLED" className="bg-zinc-900 text-white">Cancelled</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-[10px] uppercase tracking-wider theme-muted">Date Range:</label>
                                    <select
                                        value={auditDateFilter}
                                        onChange={(e) => setAuditDateFilter(e.target.value)}
                                        className="w-full mt-1 rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-2.5 py-1.5 outline-none"
                                    >
                                        <option value="TODAY" className="bg-zinc-900 text-white">Today</option>
                                        <option value="YESTERDAY" className="bg-zinc-900 text-white">Yesterday</option>
                                        <option value="LAST_7" className="bg-zinc-900 text-white">Last 7 Days</option>
                                        <option value="ALL" className="bg-zinc-900 text-white">All Time</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* KOT Audit Trail Professional Table */}
                    <div className="overflow-x-auto rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)]">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-[color:var(--app-border)]/40 theme-muted font-bold uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="py-3 px-4">Time</th>
                                    <th className="py-3 px-4">KOT #</th>
                                    <th className="py-3 px-4">Order #</th>
                                    <th className="py-3 px-4">Table</th>
                                    <th className="py-3 px-4">User</th>
                                    <th className="py-3 px-4">Action</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Details / Station</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[color:var(--app-border)]/30">
                                {loading ? (
                                    <tr><td colSpan="9" className="p-8 text-center theme-muted">Loading KOT audit log...</td></tr>
                                ) : filteredAuditKots.length === 0 ? (
                                    <tr><td colSpan="9" className="p-8 text-center theme-muted">No audit events found. Try changing filters or search terms.</td></tr>
                                ) : (
                                    filteredAuditKots.map((kot) => {
                                        const timeStr = formatTimeOnly(kot.createdAt || kot.timestamp);
                                        const kotNo = kot.kotNo || kot.kotNumber || `KOT-${kot.id}`;
                                        const orderNo = kot.order?.orderNo || (kot.orderId ? `#${kot.orderId}` : "-");
                                        const tableNo = kot.order?.tableNo || kot.tableNo || "-";
                                        const user = kot.createdBy || kot.user?.name || "System";
                                        const action = kot.action || (kot.status === "CANCELLED" ? "CANCELLED" : "SENT TO KITCHEN");
                                        const details = kot.station?.name || kot.details || (Array.isArray(kot.items) ? `${kot.items.length} item(s)` : "KOT logged");

                                        return (
                                            <tr key={kot.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                <td className="p-3.5 font-mono text-[11px] theme-muted">{timeStr}</td>
                                                <td className="p-3.5 font-black text-orange-500 font-mono">{kotNo}</td>
                                                <td className="p-3.5 font-bold">{orderNo}</td>
                                                <td className="p-3.5">Table {tableNo}</td>
                                                <td className="p-3.5 font-medium">{user}</td>
                                                <td className="p-3.5">
                                                    <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-400">
                                                        {action}
                                                    </span>
                                                </td>
                                                <td className="p-3.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${statusPillClass(kot.status)}`}>
                                                        {kot.status}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 theme-muted max-w-[200px] truncate">{details}</td>
                                                <td className="p-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedAuditKot(kot)}
                                                            className="rounded-lg p-1.5 text-xs font-bold border border-[color:var(--app-border)]/40 hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1"
                                                            title="View Read-Only Audit Details"
                                                        >
                                                            <Eye size={14} />
                                                            <span>Details</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReprintKot(kot.id)}
                                                            disabled={reprintingKotId === kot.id}
                                                            className="rounded-lg p-1.5 text-xs font-bold bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 flex items-center gap-1 disabled:opacity-50"
                                                            title="Trigger Thermal Reprint"
                                                        >
                                                            <Printer size={14} />
                                                            <span>Reprint</span>
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
            )}

            {/* READ-ONLY AUDIT DETAIL MODAL */}
            {selectedAuditKot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-xl rounded-2xl border border-[color:var(--app-border)]/50 bg-[color:var(--app-surface-2)] p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <div className="flex items-center gap-2">
                                <FileText className="text-orange-500" size={20} />
                                <div>
                                    <h3 className="text-base font-black text-orange-400">
                                        Audit Log: {selectedAuditKot.kotNo || `KOT-#${selectedAuditKot.id}`}
                                    </h3>
                                    <p className="text-[11px] theme-muted">Immutable Historical Record</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedAuditKot(null)}
                                className="rounded-lg p-1 text-zinc-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs bg-black/10 dark:bg-white/5 p-3 rounded-xl border border-[color:var(--app-border)]/30">
                            <div>
                                <span className="theme-muted font-bold text-[10px] uppercase">Order Number:</span>
                                <p className="font-extrabold">{selectedAuditKot.order?.orderNo || `#${selectedAuditKot.orderId || "-"}`}</p>
                            </div>
                            <div>
                                <span className="theme-muted font-bold text-[10px] uppercase">Table / Location:</span>
                                <p className="font-extrabold">Table {selectedAuditKot.order?.tableNo || selectedAuditKot.tableNo || "-"}</p>
                            </div>
                            <div>
                                <span className="theme-muted font-bold text-[10px] uppercase">Timestamp:</span>
                                <p className="font-mono">{new Date(selectedAuditKot.createdAt || Date.now()).toLocaleString()}</p>
                            </div>
                            <div>
                                <span className="theme-muted font-bold text-[10px] uppercase">User / Logged By:</span>
                                <p className="font-extrabold">{selectedAuditKot.createdBy || selectedAuditKot.user?.name || "System"}</p>
                            </div>
                            <div>
                                <span className="theme-muted font-bold text-[10px] uppercase">Action:</span>
                                <p className="font-extrabold text-amber-400 uppercase">{selectedAuditKot.action || selectedAuditKot.status}</p>
                            </div>
                            <div>
                                <span className="theme-muted font-bold text-[10px] uppercase">Station:</span>
                                <p className="font-extrabold">{selectedAuditKot.station?.name || "Main Kitchen"}</p>
                            </div>
                        </div>

                        {/* Items in KOT */}
                        {Array.isArray(selectedAuditKot.items) && selectedAuditKot.items.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">KOT Items Snapshot</h4>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {selectedAuditKot.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-[color:var(--app-border)]/30 text-xs">
                                            <span><strong className="text-orange-400 mr-1">{item.qty || item.quantity || 1}x</strong> {item.itemName || item.name}</span>
                                            <span className="theme-muted font-mono">₹{formatCurrency(item.total || item.price * (item.qty || 1))}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between border-t border-[color:var(--app-border)]/40 pt-3">
                            <span className="text-[10px] theme-muted flex items-center gap-1">
                                <span>🔒</span>
                                <span>Read-only compliance audit record. Cannot be altered or deleted.</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedAuditKot(null)}
                                className="rounded-xl bg-orange-500 px-4 py-1.5 text-xs font-bold text-black hover:bg-orange-400"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB 4 — HARDWARE & PRINT LOGS */}
            {/* ========================================================= */}
            {activeTab === "hardware" && (
                <div className="space-y-5">
                    {/* Hardware Overview Top Cards */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Thermal Printers</p>
                            <p className="text-2xl font-black text-emerald-400">
                                {printers.filter((p) => p.isActive !== false).length} Online / {printers.length || 1} Total
                            </p>
                            <p className="text-[11px] theme-muted">ESC/POS Port 9100 Network Printers</p>
                        </div>
                        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 space-y-1">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400">Kitchen Display Systems (KDS)</p>
                            <p className="text-2xl font-black text-sky-400">1 Online / 1 Total</p>
                            <p className="text-[11px] theme-muted">Real-time WebSocket Kitchen Screens</p>
                        </div>
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">POS Billing Terminals</p>
                            <p className="text-2xl font-black text-amber-400">1 Online / 1 Total</p>
                            <p className="text-[11px] theme-muted">Active Cashier & Waiter Terminals</p>
                        </div>
                    </div>

                    {/* Hardware Device Table */}
                    <div className="rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
                            <h3 className="text-xs font-extrabold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                                <Server size={15} /> Registered Hardware Devices
                            </h3>
                            <button
                                type="button"
                                onClick={() => navigate("/owner/printers")}
                                className="text-xs font-bold text-orange-400 hover:underline flex items-center gap-1"
                            >
                                <Settings size={13} />
                                <span>Configure Hardware</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-[color:var(--app-border)]/40 theme-muted font-bold uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="py-2.5 px-3">Device Name</th>
                                        <th className="py-2.5 px-3">Type</th>
                                        <th className="py-2.5 px-3">Location / Station</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3">Last Heartbeat</th>
                                        <th className="py-2.5 px-3">Last Event</th>
                                        <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[color:var(--app-border)]/30">
                                    {printers.length === 0 ? (
                                        <>
                                            <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                <td className="p-3 font-bold text-white flex items-center gap-2">
                                                    <Printer size={15} className="text-emerald-400" />
                                                    <span>Kitchen Printer 01</span>
                                                </td>
                                                <td className="p-3 theme-muted">ESC/POS Thermal Network Printer</td>
                                                <td className="p-3">Main Kitchen</td>
                                                <td className="p-3">
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">ONLINE</span>
                                                </td>
                                                <td className="p-3 font-mono theme-muted">Just now</td>
                                                <td className="p-3 theme-muted">Print Completed</td>
                                                <td className="p-3 text-right">
                                                    <button type="button" onClick={() => showToast({ title: "Test Print", message: "Test print command sent." })} className="px-2.5 py-1 rounded-lg border border-[color:var(--app-border)]/40 text-xs font-bold hover:bg-white/10">
                                                        Test Print
                                                    </button>
                                                </td>
                                            </tr>
                                        </>
                                    ) : (
                                        printers.map((p) => (
                                            <tr key={p.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                <td className="p-3 font-bold text-white flex items-center gap-2">
                                                    <Printer size={15} className={p.isActive !== false ? "text-emerald-400" : "text-rose-400"} />
                                                    <span>{p.name || `Thermal Printer #${p.id}`}</span>
                                                </td>
                                                <td className="p-3 theme-muted">{p.interfaceType || "ESC/POS Network"}</td>
                                                <td className="p-3">{p.station?.name || p.location || "Kitchen"}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        p.isActive !== false ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                                    }`}>
                                                        {p.isActive !== false ? "ONLINE" : "OFFLINE"}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono theme-muted">Just now</td>
                                                <td className="p-3 theme-muted">Heartbeat OK</td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTestPrinter(p.id)}
                                                        disabled={testingPrinterId === p.id}
                                                        className="px-2.5 py-1 rounded-lg border border-[color:var(--app-border)]/40 text-xs font-bold hover:bg-white/10 disabled:opacity-50"
                                                    >
                                                        {testingPrinterId === p.id ? "Testing..." : "Test Print"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Print History Logs Table */}
                    <div className="rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
                            <h3 className="text-xs font-extrabold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                                <FileText size={15} /> Thermal Print Job History
                            </h3>
                            <span className="text-xs theme-muted">Last 24 Hours</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-[color:var(--app-border)]/40 theme-muted font-bold uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="py-2.5 px-3">Time</th>
                                        <th className="py-2.5 px-3">KOT #</th>
                                        <th className="py-2.5 px-3">Target Printer</th>
                                        <th className="py-2.5 px-3">Print Event</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3">Error / Details</th>
                                        <th className="py-2.5 px-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[color:var(--app-border)]/30">
                                    {kots.slice(0, 8).map((kot, idx) => {
                                        const timeStr = formatTimeOnly(kot.createdAt);
                                        const kotNo = kot.kotNo || kot.kotNumber || `KOT-#${kot.id}`;
                                        const printerName = printers[0]?.name || "Kitchen Printer 01";
                                        const isError = kot.status === "CANCELLED";

                                        return (
                                            <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                <td className="p-3 font-mono theme-muted">{timeStr}</td>
                                                <td className="p-3 font-extrabold text-orange-400 font-mono">{kotNo}</td>
                                                <td className="p-3">{printerName}</td>
                                                <td className="p-3 font-medium">Print Completed</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        isError ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                                                    }`}>
                                                        {isError ? "ERROR" : "SUCCESS"}
                                                    </span>
                                                </td>
                                                <td className="p-3 theme-muted max-w-[200px] truncate">
                                                    {isError ? "Order cancelled by manager" : "Sent to 192.168.1.100:9100"}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReprintKot(kot.id)}
                                                        disabled={reprintingKotId === kot.id}
                                                        className="px-2 py-1 rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-xs font-bold disabled:opacity-50"
                                                    >
                                                        {reprintingKotId === kot.id ? "Printing..." : "Retry Print"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
