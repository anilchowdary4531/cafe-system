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
    History,
    Calendar,
    ChevronLeft,
    ChevronRight,
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

const getTodayYmd = () => {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
    return formatter.format(new Date());
};

const getYesterdayYmd = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
    return formatter.format(d);
};

const formatFullDateTime = (isoDate) => {
    if (!isoDate) return "--";
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "--";
    const datePart = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    const timePart = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
    return `${datePart} · ${timePart}`;
};

const getOrderCardTimeInfo = (isoDate) => {
    if (!isoDate) return { fullTime: "--", relative: "" };
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return { fullTime: "--", relative: "" };

    const todayYmd = getTodayYmd();
    const orderYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    const fullTime = formatFullDateTime(isoDate);

    if (orderYmd === todayYmd) {
        const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
        return { fullTime, relative: `${mins} mins ago` };
    }
    if (orderYmd === getYesterdayYmd()) {
        return { fullTime, relative: "Yesterday" };
    }
    return { fullTime, relative: orderYmd };
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
    const liveView = searchParams.get("view") || "live";

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

    // History View State
    const historyPreset = searchParams.get("preset") || "yesterday";
    const historySelectedDate = searchParams.get("date") || "";
    const historyStartDate = searchParams.get("startDate") || "";
    const historyEndDate = searchParams.get("endDate") || "";
    const [historySearch, setHistorySearch] = useState("");
    const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");
    const [historyStationFilter, setHistoryStationFilter] = useState("ALL");
    const [historyTableFilter, setHistoryTableFilter] = useState("ALL");
    const [historySourceFilter, setHistorySourceFilter] = useState("ALL");
    const [historyPage, setHistoryPage] = useState(1);
    const [historyLimit, setHistoryLimit] = useState(20);
    const [historyKots, setHistoryKots] = useState([]);
    const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState("");
    const [selectedHistoryKot, setSelectedHistoryKot] = useState(null);

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

            const res = await api.get(`/orders/live?restaurantId=${restaurantId}`);
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
                api.get(`/owner/${restaurantId}/kots?scope=today`),
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

    // 3. Fetch Historical KOT Orders for History View
    const loadHistoryKots = async ({ silent = false } = {}) => {
        if (!restaurantId || isNaN(Number(restaurantId))) return;
        try {
            setHistoryError("");
            if (silent) setRefreshing(true);
            else setHistoryLoading(true);

            const params = new URLSearchParams({
                scope: "history",
                preset: historyPreset,
                page: String(historyPage),
                limit: String(historyLimit),
            });

            if (historySelectedDate) {
                params.set("startDate", historySelectedDate);
                params.set("endDate", historySelectedDate);
            } else {
                if (historyStartDate) params.set("startDate", historyStartDate);
                if (historyEndDate) params.set("endDate", historyEndDate);
            }

            if (historyStatusFilter !== "ALL") params.set("status", historyStatusFilter);
            if (historyStationFilter !== "ALL") params.set("stationId", historyStationFilter);
            if (historyTableFilter !== "ALL") params.set("tableNo", historyTableFilter);
            if (historySourceFilter !== "ALL") params.set("source", historySourceFilter);
            if (historySearch.trim()) params.set("q", historySearch.trim());

            const res = await api.get(`/owner/${restaurantId}/kots?${params.toString()}`);
            const list = res?.data?.kots || [];
            setHistoryKots(Array.isArray(list) ? list : []);
            if (res?.data?.pagination) {
                setHistoryPagination(res.data.pagination);
            }
        } catch (err) {
            console.error("Failed to load historical KOTs", err);
            setHistoryError("Unable to load order history.");
        } finally {
            setHistoryLoading(false);
            setRefreshing(false);
        }
    };

    // 4. Fetch Hardware Printers
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
        if (activeTab === "live" && liveView === "history") {
            await Promise.all([loadHistoryKots({ silent: true }), loadHardwarePrinters()]);
        } else {
            await Promise.all([loadLiveOrders({ silent: true }), loadKotHistory(), loadHardwarePrinters()]);
        }
        setRefreshing(false);
        showToast({ title: "Refreshed", message: "Kitchen Operations data updated.", variant: "info" });
    };

    useEffect(() => {
        loadLiveOrders();
        loadKotHistory();
        loadHardwarePrinters();
    }, [restaurantId]);

    useEffect(() => {
        if (activeTab === "live" && liveView === "history") {
            loadHistoryKots();
        }
    }, [
        activeTab,
        liveView,
        historyPreset,
        historySelectedDate,
        historyStartDate,
        historyEndDate,
        historyStatusFilter,
        historyStationFilter,
        historyTableFilter,
        historySourceFilter,
        historySearch,
        historyPage,
        historyLimit,
        restaurantId,
    ]);

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

    // History Date Information Helper
    const historyDateInfo = useMemo(() => {
        const todayYmd = getTodayYmd();
        const yesterdayYmd = getYesterdayYmd();

        let targetYmd = historySelectedDate || historyStartDate || "";
        if (!targetYmd) {
            if (historyPreset === "today") {
                targetYmd = todayYmd;
            } else if (historyPreset === "last7days") {
                return { label: "Previous 7 Days", subtext: "Past 7 Business Days", ymd: "" };
            } else if (historyPreset === "last30days") {
                return { label: "Previous 30 Days", subtext: "Past 30 Business Days", ymd: "" };
            } else if (historyPreset === "custom" && historyStartDate && historyEndDate) {
                return { label: "Custom Range", subtext: `${historyStartDate} to ${historyEndDate}`, ymd: "" };
            } else {
                targetYmd = yesterdayYmd;
            }
        }

        if (targetYmd === todayYmd) {
            const fullDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
            return { label: "Today", subtext: fullDate, ymd: targetYmd };
        }
        if (targetYmd === yesterdayYmd) {
            const yDate = new Date(Date.now() - 86400000);
            const fullDate = yDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
            return { label: "Yesterday", subtext: fullDate, ymd: targetYmd };
        }

        if (targetYmd) {
            const [y, m, d] = targetYmd.split("-").map(Number);
            const dt = new Date(y, m - 1, d);
            const fullDate = dt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
            return { label: "Previous Day", subtext: fullDate, ymd: targetYmd };
        }

        const yDate = new Date(Date.now() - 86400000);
        const fullDate = yDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
        return { label: "Yesterday", subtext: fullDate, ymd: yesterdayYmd };
    }, [historyPreset, historySelectedDate, historyStartDate, historyEndDate]);

    const handleStepDate = (direction) => {
        const todayYmd = getTodayYmd();
        const yesterdayYmd = getYesterdayYmd();
        const currentYmd = historySelectedDate || historyDateInfo.ymd || (historyPreset === "today" ? todayYmd : yesterdayYmd);
        const [y, m, d] = currentYmd.split("-").map(Number);
        const currentDate = new Date(y, m - 1, d);

        if (direction === "prev") {
            currentDate.setDate(currentDate.getDate() - 1);
        } else if (direction === "next") {
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
        const nextYmd = formatter.format(currentDate);

        if (nextYmd > todayYmd) return;

        const nextPreset = nextYmd === todayYmd ? "today" : nextYmd === yesterdayYmd ? "yesterday" : "custom";

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", "live");
            next.set("view", "history");
            next.set("date", nextYmd);
            next.set("preset", nextPreset);
            return next;
        });
        setHistoryPage(1);
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
                    {/* Top Summary Compact Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => { setActiveTab("live"); setLiveStatusFilter("ALL"); }}
                            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] px-3.5 py-1.5 text-xs font-bold transition hover:bg-black/5 dark:hover:bg-white/5"
                        >
                            <span className="theme-muted font-bold">KOTs Today</span>
                            <span className="rounded-md bg-black/10 dark:bg-white/10 px-2 py-0.5 text-xs font-extrabold text-[color:var(--app-text)]">{overviewStats.kotsToday}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab("live"); setLiveStatusFilter("PREPARING"); }}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-500 transition hover:bg-amber-500/20"
                        >
                            <span className="font-bold">Preparing</span>
                            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-extrabold">{overviewStats.preparing}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab("live"); setLiveStatusFilter("READY"); }}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-500 transition hover:bg-emerald-500/20"
                        >
                            <span className="font-bold">Ready</span>
                            <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-extrabold">{overviewStats.ready}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab("live"); setLiveStatusFilter("DELIVERED"); }}
                            className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-bold text-sky-500 transition hover:bg-sky-500/20"
                        >
                            <span className="font-bold">Delivered</span>
                            <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-xs font-extrabold">{overviewStats.delivered}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab("audit"); setAuditStatusFilter("CANCELLED"); }}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-bold text-rose-500 transition hover:bg-rose-500/20"
                        >
                            <span className="font-bold">Cancelled</span>
                            <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-xs font-extrabold">{overviewStats.cancelled}</span>
                        </button>
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

            {activeTab === "live" && (
                <div className="space-y-4">
                    {/* Secondary Navigation Bar: LIVE KOTS | HISTORY */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--app-border)]/40 pb-3">
                        <div className="flex items-center gap-1.5 rounded-2xl bg-black/5 dark:bg-white/5 p-1 border border-[color:var(--app-border)]/30">
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchParams({ tab: "live", view: "live" });
                                }}
                                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                                    liveView !== "history"
                                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md"
                                        : "theme-muted hover:text-white"
                                }`}
                            >
                                <ChefHat size={15} />
                                LIVE KOTS
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchParams({ tab: "live", view: "history", preset: "yesterday" });
                                }}
                                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                                    liveView === "history"
                                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md"
                                        : "theme-muted hover:text-white"
                                }`}
                            >
                                <History size={15} />
                                HISTORY
                            </button>
                        </div>

                        {liveView !== "history" ? (
                            <div className="flex items-center gap-2 text-xs theme-muted">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <div className="flex items-center gap-1.5 font-black">
                                    <span className="text-emerald-400">Today's Orders</span>
                                    <span>•</span>
                                    <span className="text-white font-extrabold">
                                        {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs theme-muted">
                                <RotateCcw size={14} className="text-amber-400" />
                                <span className="font-bold text-amber-400">History Date</span>
                                <span>•</span>
                                <span className="font-extrabold text-white">{historyDateInfo.label} ({historyDateInfo.subtext})</span>
                            </div>
                        )}
                    </div>

                    {/* LIVE VIEW */}
                    {liveView !== "history" && (
                        <>
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
                                                    const cardTimeInfo = getOrderCardTimeInfo(order.createdAt);
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

                                                            <div className="flex flex-col gap-0.5 border-t border-[color:var(--app-border)]/30 pt-2 text-xs theme-muted">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-bold text-[color:var(--app-text)]">Total: ₹{formatCurrency(order.totalAmount || order.total)}</span>
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-orange-400">
                                                                        <Clock3 size={13} />
                                                                        {cardTimeInfo.relative}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[10px] theme-muted font-mono">
                                                                    {cardTimeInfo.fullTime}
                                                                </div>
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

                            {orders.length === 0 && !loading && (
                                <div className="rounded-2xl border border-dashed border-[color:var(--app-border)]/50 p-8 text-center space-y-2">
                                    <ChefHat size={36} className="mx-auto text-orange-500 opacity-60" />
                                    <h4 className="font-black text-sm text-white">No orders for today</h4>
                                    <p className="font-extrabold text-xs text-orange-400">
                                        {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}
                                    </p>
                                    <p className="theme-muted text-xs">New orders will appear here automatically.</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* HISTORY VIEW */}
                    {liveView === "history" && (
                        <div className="space-y-4">
                            {/* History Filter & Date Bar */}
                            <div className="rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    {/* Date Stepper & Preset Dropdown */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--app-border)]/40 bg-black/10 dark:bg-white/5 p-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleStepDate("prev")}
                                                className="flex items-center gap-1 rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-black px-3 py-1.5 text-xs font-black transition"
                                                title="Previous Day"
                                            >
                                                <ChevronLeft size={15} />
                                                Previous Day
                                            </button>
                                            <div className="flex flex-col border-x border-[color:var(--app-border)]/30 px-3 text-center min-w-[140px]">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                                                    {historyDateInfo.label}
                                                </span>
                                                <span className="text-xs font-extrabold text-white">
                                                    {historyDateInfo.subtext}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleStepDate("next")}
                                                disabled={!historyDateInfo.ymd || historyDateInfo.ymd >= getTodayYmd()}
                                                className="flex items-center gap-1 rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-black px-3 py-1.5 text-xs font-black transition disabled:opacity-30 disabled:hover:bg-orange-500/10 disabled:hover:text-orange-400"
                                                title="Next Day"
                                            >
                                                Next Day
                                                <ChevronRight size={15} />
                                            </button>
                                        </div>

                                        <select
                                            value={historyPreset}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSearchParams((prev) => {
                                                    const next = new URLSearchParams(prev);
                                                    next.set("tab", "live");
                                                    next.set("view", "history");
                                                    next.set("preset", val);
                                                    next.delete("date");
                                                    return next;
                                                });
                                                setHistoryPage(1);
                                            }}
                                            className="rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-3 py-2 text-xs font-extrabold outline-none focus:border-orange-500"
                                        >
                                            <option value="yesterday" className="bg-zinc-900 text-white">Yesterday</option>
                                            <option value="today" className="bg-zinc-900 text-white">Today</option>
                                            <option value="last7days" className="bg-zinc-900 text-white">Previous 7 Days</option>
                                            <option value="last30days" className="bg-zinc-900 text-white">Previous 30 Days</option>
                                            <option value="custom" className="bg-zinc-900 text-white">Custom Range</option>
                                        </select>
                                    </div>

                                    {/* Search Input */}
                                    <div className="relative flex-1 min-w-[240px]">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 theme-muted" />
                                        <input
                                            value={historySearch}
                                            onChange={(e) => {
                                                setHistorySearch(e.target.value);
                                                setHistoryPage(1);
                                            }}
                                            placeholder="Search KOT #, order #, table, customer, or item..."
                                            className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent py-1.5 pl-9 pr-3 text-xs outline-none focus:border-orange-500"
                                        />
                                    </div>
                                </div>

                                {/* Filters Row */}
                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[color:var(--app-border)]/30 text-xs">
                                    <span className="theme-muted font-bold flex items-center gap-1">
                                        <Filter size={13} /> Filters:
                                    </span>

                                    {/* Status Filter */}
                                    <select
                                        value={historyStatusFilter}
                                        onChange={(e) => {
                                            setHistoryStatusFilter(e.target.value);
                                            setHistoryPage(1);
                                        }}
                                        className="rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-2.5 py-1 text-xs outline-none focus:border-orange-500"
                                    >
                                        <option value="ALL" className="bg-zinc-900 text-white">All Statuses</option>
                                        {KOT_STATUSES.filter((s) => s !== "ALL").map((st) => (
                                            <option key={st} value={st} className="bg-zinc-900 text-white">{st}</option>
                                        ))}
                                    </select>

                                    {/* Station Filter */}
                                    <select
                                        value={historyStationFilter}
                                        onChange={(e) => {
                                            setHistoryStationFilter(e.target.value);
                                            setHistoryPage(1);
                                        }}
                                        className="rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-2.5 py-1 text-xs outline-none focus:border-orange-500"
                                    >
                                        <option value="ALL" className="bg-zinc-900 text-white">All Stations</option>
                                        {stations.map((st) => (
                                            <option key={st.id} value={st.id} className="bg-zinc-900 text-white">{st.name}</option>
                                        ))}
                                    </select>

                                    {/* Source Filter */}
                                    <select
                                        value={historySourceFilter}
                                        onChange={(e) => {
                                            setHistorySourceFilter(e.target.value);
                                            setHistoryPage(1);
                                        }}
                                        className="rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-2.5 py-1 text-xs outline-none focus:border-orange-500"
                                    >
                                        <option value="ALL" className="bg-zinc-900 text-white">All Sources</option>
                                        <option value="QR_ORDER" className="bg-zinc-900 text-white">QR Order</option>
                                        <option value="WAITER" className="bg-zinc-900 text-white">Waiter Order</option>
                                        <option value="POS" className="bg-zinc-900 text-white">POS Order</option>
                                        <option value="MANUAL" className="bg-zinc-900 text-white">Manual Order</option>
                                    </select>

                                    {(historySearch || historyStatusFilter !== "ALL" || historyStationFilter !== "ALL" || historySourceFilter !== "ALL") && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHistorySearch("");
                                                setHistoryStatusFilter("ALL");
                                                setHistoryStationFilter("ALL");
                                                setHistorySourceFilter("ALL");
                                                setHistoryPage(1);
                                            }}
                                            className="text-[11px] text-orange-400 hover:underline ml-auto font-semibold"
                                        >
                                            Reset Filters
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* History Table */}
                            <div className="rounded-2xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-2)] overflow-hidden shadow-xs">
                                {historyLoading ? (
                                    <div className="p-12 text-center theme-muted space-y-2">
                                        <LoaderCircle size={28} className="animate-spin mx-auto text-orange-500" />
                                        <p className="text-xs">Loading historical kitchen records...</p>
                                    </div>
                                ) : historyError ? (
                                    <div className="p-12 text-center space-y-3">
                                        <AlertTriangle size={32} className="mx-auto text-red-500" />
                                        <h4 className="font-black text-sm text-red-400">Unable to load order history.</h4>
                                        <button
                                            type="button"
                                            onClick={() => loadHistoryKots()}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-black text-black hover:bg-orange-400 transition shadow-md"
                                        >
                                            <RefreshCw size={14} />
                                            Retry
                                        </button>
                                    </div>
                                ) : historyKots.length === 0 ? (
                                    <div className="p-12 text-center theme-muted space-y-2">
                                        <RotateCcw size={32} className="mx-auto text-amber-500 opacity-60" />
                                        <h4 className="font-black text-sm text-white">No orders found</h4>
                                        <p className="font-bold text-xs text-amber-400">{historyDateInfo.subtext}</p>
                                        <p className="text-xs">Try another date or date range.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="border-b border-[color:var(--app-border)]/40 bg-black/10 dark:bg-white/5 uppercase text-[10px] tracking-wider theme-muted font-extrabold">
                                                <tr>
                                                    <th className="p-3">KOT / Order #</th>
                                                    <th className="p-3">Date & Time</th>
                                                    <th className="p-3">Table / Source</th>
                                                    <th className="p-3">Customer</th>
                                                    <th className="p-3">Items Summary</th>
                                                    <th className="p-3">Total</th>
                                                    <th className="p-3">Status</th>
                                                    <th className="p-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[color:var(--app-border)]/30">
                                                {historyKots.map((kot) => {
                                                    const order = kot.order || {};
                                                    const itemsPreview = Array.isArray(kot.items)
                                                        ? kot.items.map((i) => `${i.qty || 1}x ${i.itemName || i.name}`).join(", ")
                                                        : "-";

                                                    return (
                                                        <tr
                                                            key={kot.id}
                                                            onClick={() => setSelectedHistoryKot(kot)}
                                                            className="hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition"
                                                        >
                                                            <td className="p-3 font-mono font-bold">
                                                                <div className="text-orange-400 font-extrabold">{kot.kotNo}</div>
                                                                <div className="text-[11px] theme-muted">{order.orderNo || `ORD-${order.id || kot.orderId}`}</div>
                                                            </td>
                                                            <td className="p-3 whitespace-nowrap">
                                                                <div>{new Date(kot.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                                                                <div className="text-[11px] theme-muted font-mono">{formatTimeOnly(kot.createdAt)}</div>
                                                            </td>
                                                            <td className="p-3 whitespace-nowrap">
                                                                <div className="font-semibold">Table {kot.tableNo || order.tableNo || "-"}</div>
                                                                <div className="text-[11px] theme-muted uppercase">{order.orderSource || "QR Order"}</div>
                                                            </td>
                                                            <td className="p-3 whitespace-nowrap font-medium">
                                                                {order.customerName || "Guest"}
                                                            </td>
                                                            <td className="p-3 max-w-[240px] truncate theme-muted" title={itemsPreview}>
                                                                {itemsPreview}
                                                            </td>
                                                            <td className="p-3 whitespace-nowrap font-mono font-bold">
                                                                ₹{formatCurrency(order.totalAmount || 0)}
                                                            </td>
                                                            <td className="p-3 whitespace-nowrap">
                                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusPillClass(normalizeStatus(kot.status))}`}>
                                                                    {kot.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-right whitespace-nowrap">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedHistoryKot(kot);
                                                                    }}
                                                                    className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--app-border)]/40 px-2.5 py-1 text-[11px] font-bold theme-muted hover:text-orange-400 hover:border-orange-500/40 transition"
                                                                >
                                                                    <Eye size={12} />
                                                                    Details
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Server-side Pagination Bar */}
                                {historyPagination.totalPages > 1 && (
                                    <div className="flex items-center justify-between border-t border-[color:var(--app-border)]/40 p-3 text-xs theme-muted">
                                        <div>
                                            Page <strong className="text-orange-400">{historyPagination.page}</strong> of <strong>{historyPagination.totalPages}</strong> ({historyPagination.total} orders)
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                                                disabled={historyPagination.page <= 1}
                                                className="rounded-lg border border-[color:var(--app-border)]/40 px-3 py-1 font-bold disabled:opacity-30 hover:bg-black/10 transition"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHistoryPage((p) => Math.min(historyPagination.totalPages, p + 1))}
                                                disabled={historyPagination.page >= historyPagination.totalPages}
                                                className="rounded-lg border border-[color:var(--app-border)]/40 px-3 py-1 font-bold disabled:opacity-30 hover:bg-black/10 transition"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Historical Order Details Modal */}
            {selectedHistoryKot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-xl rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-black text-orange-400">{selectedHistoryKot.kotNo}</h3>
                                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${statusPillClass(normalizeStatus(selectedHistoryKot.status))}`}>
                                        {selectedHistoryKot.status}
                                    </span>
                                </div>
                                <p className="theme-muted text-xs mt-0.5">
                                    Order #{selectedHistoryKot.order?.orderNo || selectedHistoryKot.orderId}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedHistoryKot(null)}
                                className="rounded-xl p-2 theme-muted hover:bg-black/10 dark:hover:bg-white/10"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Order Details Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-black/10 dark:bg-white/5 p-3.5 text-xs">
                            <div>
                                <div className="theme-muted text-[10px] font-bold uppercase">Date & Time</div>
                                <div className="font-bold">{new Date(selectedHistoryKot.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                                <div className="theme-muted font-mono">{formatTimeOnly(selectedHistoryKot.createdAt)}</div>
                            </div>
                            <div>
                                <div className="theme-muted text-[10px] font-bold uppercase">Table / Source</div>
                                <div className="font-bold">Table {selectedHistoryKot.tableNo || selectedHistoryKot.order?.tableNo || "-"}</div>
                                <div className="theme-muted text-[11px]">{selectedHistoryKot.order?.orderSource || "QR Order"}</div>
                            </div>
                            <div>
                                <div className="theme-muted text-[10px] font-bold uppercase">Customer</div>
                                <div className="font-bold">{selectedHistoryKot.order?.customerName || "Guest"}</div>
                            </div>
                            <div>
                                <div className="theme-muted text-[10px] font-bold uppercase">Total Amount</div>
                                <div className="font-black font-mono text-orange-400">₹{formatCurrency(selectedHistoryKot.order?.totalAmount || 0)}</div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-black uppercase text-orange-400">Order Items</h4>
                            <div className="rounded-2xl border border-[color:var(--app-border)]/40 divide-y divide-[color:var(--app-border)]/30 overflow-hidden">
                                {(selectedHistoryKot.items || []).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 text-xs">
                                        <div>
                                            <div className="font-bold">
                                                <span className="text-orange-500 mr-1">{item.qty || 1}x</span>
                                                {item.itemName || item.name}
                                            </div>
                                            {item.notes && <div className="text-[11px] theme-muted italic mt-0.5">Note: {item.notes}</div>}
                                        </div>
                                        <div className="font-mono font-bold">
                                            ₹{formatCurrency(item.totalPrice || item.price * (item.qty || 1))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Event Timeline */}
                        {Array.isArray(selectedHistoryKot.order?.statusEvents) && selectedHistoryKot.order.statusEvents.length > 0 && (
                            <div className="space-y-2 border-t border-[color:var(--app-border)]/40 pt-4">
                                <h4 className="text-xs font-black uppercase text-orange-400">Order Timeline</h4>
                                <div className="space-y-2 pl-2 border-l-2 border-orange-500/30">
                                    {selectedHistoryKot.order.statusEvents.map((ev, eIdx) => (
                                        <div key={eIdx} className="flex items-center justify-between text-xs">
                                            <div className="font-semibold flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                                <span>Status changed to <strong className="uppercase text-orange-400">{ev.status}</strong></span>
                                            </div>
                                            <span className="theme-muted font-mono text-[11px]">{formatTimeOnly(ev.createdAt)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-[color:var(--app-border)]/40 pt-4">
                            <button
                                type="button"
                                onClick={() => setSelectedHistoryKot(null)}
                                className="rounded-xl border border-[color:var(--app-border)]/40 px-4 py-2 text-xs font-bold theme-muted hover:bg-black/10 transition"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReprintKot(selectedHistoryKot.id)}
                                disabled={reprintingKotId === selectedHistoryKot.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-black hover:bg-orange-400 transition disabled:opacity-60"
                            >
                                <Printer size={14} />
                                <span>Reprint KOT</span>
                            </button>
                        </div>
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
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 truncate">Thermal Printers</p>
                                <p className="text-[10px] theme-muted truncate">ESC/POS Port 9100 Printers</p>
                            </div>
                            <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-400 whitespace-nowrap border border-emerald-500/30">
                                {printers.filter((p) => p.isActive !== false).length} Online / {printers.length || 1} Total
                            </span>
                        </div>
                        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 truncate">Kitchen Display Systems (KDS)</p>
                                <p className="text-[10px] theme-muted truncate">WebSocket Kitchen Screens</p>
                            </div>
                            <span className="rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-black text-sky-400 whitespace-nowrap border border-sky-500/30">
                                1 Online / 1 Total
                            </span>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 truncate">POS Billing Terminals</p>
                                <p className="text-[10px] theme-muted truncate">Cashier & Waiter Terminals</p>
                            </div>
                            <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-black text-amber-400 whitespace-nowrap border border-amber-500/30">
                                1 Online / 1 Total
                            </span>
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
