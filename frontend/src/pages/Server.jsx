import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
    AlertTriangle,
    Bell,
    Calendar,
    Check,
    ChefHat,
    Clock,
    Filter,
    Grid,
    LayoutGrid,
    LoaderCircle,
    Lock,
    LogOut,
    MapPin,
    Minus,
    Plus,
    RefreshCw,
    Search,
    Settings2,
    ShoppingBag,
    Trash2,
    Unlock,
    UserCheck,
    UserPlus,
    Users,
    UtensilsCrossed,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import useCachedGet from "../hooks/useCachedGet";
import { API } from "../config";
import { api } from "../utils/apiClient";
import { resolveImageUrl } from "../utils/resolveImageUrl";
import { showToast } from "../utils/toast";
import { playNotificationSound } from "../utils/soundPlayer";
import ItemCustomizationModal from "../components/ItemCustomizationModal";
import WaitlistDrawer from "../components/WaitlistDrawer";
import TableBlockModal from "../components/TableBlockModal";
import MealShiftConfigModal from "../components/MealShiftConfigModal";
import ReservationModal from "../components/ReservationModal";
import OwnerMenuButton from "../components/OwnerMenuButton";
import BrandLogo from "../components/BrandLogo";
import ServerProfileView from "../components/ServerProfileView";
import ServerNotificationsView from "../components/ServerNotificationsView";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";

const formatMoney = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "₹0.00";
    return `₹${amount.toFixed(2)}`;
};

export const normalizeTableKey = (val) => {
    if (!val) return "";
    return String(val)
        .trim()
        .toLowerCase()
        .replace(/^table\s*[-_]?/i, "")
        .replace(/^t\s*[-_]?/i, "");
};

export default function Server() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, logout } = useAuth();
    const { socket } = useStaffSocket();

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        user?.restaurant_id ||
        localStorage.getItem("restaurantId") ||
        localStorage.getItem("selectedRestaurantId") ||
        1
    );
    const restaurantName = String(user?.restaurant?.name || "Tiffzy Restaurant").trim();

    // Time ticker for local clock
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Active View Mode: "FLOOR_PLAN" | "ORDERING" | "PROFILE" | "NOTIFICATIONS"
    const getInitialViewMode = () => {
        if (location.pathname.endsWith("/profile")) return "PROFILE";
        if (location.pathname.endsWith("/notifications")) return "NOTIFICATIONS";
        return "FLOOR_PLAN";
    };
    const [viewMode, setViewMode] = useState(getInitialViewMode);

    useEffect(() => {
        if (location.pathname.endsWith("/profile")) {
            setViewMode("PROFILE");
        } else if (location.pathname.endsWith("/notifications")) {
            setViewMode("NOTIFICATIONS");
        } else if (viewMode !== "ORDERING") {
            setViewMode("FLOOR_PLAN");
        }
    }, [location.pathname]);

    // Unread Notifications Badge
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const res = await api.get("/notifications/unread-count");
            if (res.data?.success) {
                setUnreadNotificationCount(res.data.count || 0);
            }
        } catch {
            // fallback silently
        }
    }, []);

    useEffect(() => {
        fetchUnreadCount();
    }, [fetchUnreadCount]);

    useEffect(() => {
        if (!socket) return;
        const handleNewNotif = () => {
            fetchUnreadCount();
        };
        socket.on("notification:new", handleNewNotif);
        return () => {
            socket.off("notification:new", handleNewNotif);
        };
    }, [socket, fetchUnreadCount]);

    // Meal Shift Selection: "BREAKFAST" | "LUNCH" | "DINNER"
    const [activeShift, setActiveShift] = useState("LUNCH");
    const [shiftConfig, setShiftConfig] = useState({
        breakfast: { start: "07:00", end: "11:30" },
        lunch: { start: "11:30", end: "16:00" },
        dinner: { start: "16:00", end: "23:00" },
    });

    // Group section filter: "ALL" | section name
    const [activeSectionFilter, setActiveSectionFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Modal & Drawer States
    const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
    const [waitlistSummary, setWaitlistSummary] = useState({ waitingCount: 0 });

    const [blockModalTable, setBlockModalTable] = useState(null);
    const [isShiftConfigOpen, setIsShiftConfigOpen] = useState(false);
    const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
    const [editingReservation, setEditingReservation] = useState(null);

    // Ordering / Selected Table state
    const [selectedTable, setSelectedTable] = useState(null);
    const [cart, setCart] = useState({});
    const [activeCategory, setActiveCategory] = useState("ALL");
    const [customizingItem, setCustomizingItem] = useState(null);
    const [placingOrder, setPlacingOrder] = useState(false);

    // Data fetching via useCachedGet
    const {
        data: tablesData,
        loading: tablesLoading,
        refresh: refreshTables,
    } = useCachedGet(restaurantId ? `/owner/${restaurantId}/tables` : "/owner/_/tables", {
        enabled: Boolean(restaurantId),
        ttlMs: 15_000,
        scope: `server-tables:${restaurantId}`,
    });

    const { data: menuData, loading: menuLoading } = useCachedGet(
        restaurantId ? `/owner/${restaurantId}/menu` : "/owner/_/menu",
        {
            enabled: Boolean(restaurantId),
            ttlMs: 60_000,
            scope: `server-menu:${restaurantId}`,
        }
    );

    const { data: reservationsData, refresh: refreshReservations } = useCachedGet(
        restaurantId ? `/owner/${restaurantId}/reservations` : "/owner/_/reservations",
        {
            enabled: Boolean(restaurantId),
            ttlMs: 15_000,
            scope: `server-reservations:${restaurantId}`,
        }
    );

    const { data: liveOrdersData, refresh: refreshLiveOrders } = useCachedGet(
        restaurantId ? `/owner/${restaurantId}/orders` : "/owner/_/orders",
        {
            enabled: Boolean(restaurantId),
            ttlMs: 5_000,
            scope: `server-live-orders:${restaurantId}`,
        }
    );

    const { data: readyKotsData, refresh: refreshReadyKots } = useCachedGet(
        restaurantId ? `/owner/${restaurantId}/kots?scope=live` : null,
        {
            enabled: Boolean(restaurantId),
            ttlMs: 4_000,
            scope: `server-ready-kots:${restaurantId}`,
        }
    );

    const tables = useMemo(() => {
        if (!tablesData) return [];
        return Array.isArray(tablesData.tables) ? tablesData.tables : Array.isArray(tablesData) ? tablesData : [];
    }, [tablesData]);

    const menuItems = useMemo(() => {
        if (!menuData) return [];
        return Array.isArray(menuData.items) ? menuData.items : Array.isArray(menuData) ? menuData : [];
    }, [menuData]);

    const reservations = useMemo(() => {
        if (!reservationsData) return [];
        return Array.isArray(reservationsData.reservations) ? reservationsData.reservations : [];
    }, [reservationsData]);

    // Unified List of Ready Items to Distribute (from KOTs and Orders)
    const readyItemsToDistribute = useMemo(() => {
        const list = [];
        const seenOrderIds = new Set();

        // 1. Collect from Ready KOTs or KOTs with ready items
        const rawKots = Array.isArray(readyKotsData?.kots) ? readyKotsData.kots : Array.isArray(readyKotsData) ? readyKotsData : [];
        rawKots.forEach((kot) => {
            const kotStatus = String(kot.status || "").toUpperCase();
            const rawItems = Array.isArray(kot.items) ? kot.items : [];
            const isKotReady = kotStatus === "READY";
            const readyItemsInKot = rawItems.filter((it) => String(it.status || "").toUpperCase() === "READY");

            if (isKotReady || readyItemsInKot.length > 0) {
                if (kot.orderId) seenOrderIds.add(Number(kot.orderId));
                const itemsToShow = isKotReady ? rawItems : readyItemsInKot;
                list.push({
                    key: `kot-${kot.id}`,
                    id: kot.id,
                    type: "KOT",
                    kotNo: kot.kotNo,
                    orderId: kot.orderId,
                    tableNo: String(kot.tableNo || kot.order?.tableNo || "N/A").trim(),
                    waiterName: kot.waiterName || kot.order?.customerName || null,
                    stationName: kot.stationName || "Kitchen",
                    readyAt: kot.updatedAt || kot.createdAt,
                    isPartial: !isKotReady && readyItemsInKot.length > 0,
                    itemsList: itemsToShow.map((it) => ({
                        name: it.itemName,
                        qty: it.qty,
                        notes: it.notes,
                        status: it.status,
                    })),
                });
            }
        });

        // 2. Collect from Ready Orders (if not already captured as a ready KOT)
        const rawOrders = Array.isArray(liveOrdersData?.orders) ? liveOrdersData.orders : Array.isArray(liveOrdersData) ? liveOrdersData : [];
        rawOrders.forEach((order) => {
            if (String(order.status || "").toUpperCase() === "READY" && !seenOrderIds.has(Number(order.id))) {
                list.push({
                    key: `order-${order.id}`,
                    id: order.id,
                    type: "ORDER",
                    orderNo: order.orderNo,
                    orderId: order.id,
                    tableNo: String(order.tableNo || "N/A").trim(),
                    waiterName: order.assignedWaiterName || order.waiterName || order.customerName || null,
                    stationName: "Kitchen",
                    readyAt: order.updatedAt || order.createdAt,
                    isPartial: false,
                    itemsList: Array.isArray(order.items)
                        ? order.items.map((it) => ({
                              name: it.itemName,
                              qty: it.qty,
                              notes: it.notes,
                          }))
                        : [],
                });
            }
        });

        return list;
    }, [readyKotsData, liveOrdersData]);

    // Map table number (and normalized key) to count of ready items waiting for pickup
    const readyItemsByTable = useMemo(() => {
        const map = new Map();
        readyItemsToDistribute.forEach((item) => {
            const raw = String(item.tableNo || "").trim();
            if (!raw || raw === "N/A") return;
            const norm = normalizeTableKey(raw);
            map.set(raw, (map.get(raw) || 0) + 1);
            map.set(raw.toLowerCase(), (map.get(raw.toLowerCase()) || 0) + 1);
            if (norm) {
                map.set(norm, (map.get(norm) || 0) + 1);
            }
        });
        return map;
    }, [readyItemsToDistribute]);

    const readyOrders = useMemo(() => {
        if (!liveOrdersData) return [];
        const raw = Array.isArray(liveOrdersData.orders) ? liveOrdersData.orders : Array.isArray(liveOrdersData) ? liveOrdersData : [];
        return raw.filter((o) => String(o.status || "").toUpperCase() === "READY");
    }, [liveOrdersData]);

    // Compute unique sections
    const sections = useMemo(() => {
        const set = new Set(["ALL"]);
        tables.forEach((t) => {
            const sec = String(t.section || "Main Hall").trim();
            if (sec) set.add(sec);
        });
        return Array.from(set);
    }, [tables]);

    // Socket real-time updates & Ready Order alerts
    useEffect(() => {
        if (!socket) return;
        const handleRealtimeUpdate = (data) => {
            refreshTables({ force: true });
            refreshReservations({ force: true });
            refreshLiveOrders({ force: true });
            refreshReadyKots({ force: true });

            const status = String(data?.status || data?.kot?.status || "").toUpperCase();
            if (status === "READY") {
                playNotificationSound();
                const tableNum = data?.tableNo || data?.kot?.tableNo || data?.order?.tableNo;
                const orderNum = data?.orderNo || data?.kot?.kotNo || data?.order?.orderNo;
                showToast({
                    title: "🔔 Food Ready to Distribute!",
                    message: `${tableNum ? `Table ${tableNum}: ` : ""}${orderNum ? `Ticket #${orderNum}` : "Items"} ready at kitchen pass!`,
                    variant: "success",
                });
            }
        };

        socket.on("table:updated", handleRealtimeUpdate);
        socket.on("table:waiter_assigned", handleRealtimeUpdate);
        socket.on("table:session_updated", handleRealtimeUpdate);
        socket.on("reservation:updated", handleRealtimeUpdate);
        socket.on("waitlist:updated", handleRealtimeUpdate);
        socket.on("kot:status_updated", handleRealtimeUpdate);
        socket.on("kot:item_updated", handleRealtimeUpdate);
        socket.on("order:updated", handleRealtimeUpdate);
        socket.on("order_created", handleRealtimeUpdate);
        socket.on("new_order", handleRealtimeUpdate);

        return () => {
            socket.off("table:updated", handleRealtimeUpdate);
            socket.off("table:waiter_assigned", handleRealtimeUpdate);
            socket.off("table:session_updated", handleRealtimeUpdate);
            socket.off("reservation:updated", handleRealtimeUpdate);
            socket.off("waitlist:updated", handleRealtimeUpdate);
            socket.off("kot:status_updated", handleRealtimeUpdate);
            socket.off("kot:item_updated", handleRealtimeUpdate);
            socket.off("order:updated", handleRealtimeUpdate);
            socket.off("order_created", handleRealtimeUpdate);
            socket.off("new_order", handleRealtimeUpdate);
        };
    }, [socket, refreshTables, refreshReservations, refreshLiveOrders, refreshReadyKots]);

    // Ordering Actions & Auto Server Assignment
    const handleSelectTableForOrder = useCallback(async (table) => {
        if (!table) return;
        if (table.isBlocked) {
            showToast({
                title: "Table Blocked 🔒",
                message: `Table ${table.tableNo} is BLOCKED (${table.blockReason || "Maintenance"}). Unblock table before placing orders.`,
                variant: "warning",
            });
            return;
        }

        const serverId = user?.id || user?.userId;
        const serverName = user?.name || user?.username || "Server";

        let activeTable = table;

        // Auto-assign authenticated server to selected table if unassigned
        const isUnassigned = !table?.assignedWaiterId;
        const isAssignedToOther = Boolean(table?.assignedWaiterId && Number(table.assignedWaiterId) !== Number(serverId));
        const isManagerOrOwner = user?.role === "OWNER" || user?.role === "MANAGER";

        if (serverId && table?.id && (isUnassigned || (isAssignedToOther && isManagerOrOwner))) {
            try {
                activeTable = {
                    ...table,
                    assignedWaiterId: Number(serverId),
                    assignedWaiterName: serverName,
                };
                setSelectedTable(activeTable);

                await axios.post(`${API}/owner/${restaurantId}/tables/${table.id}/assign-waiter`, {
                    waiterId: Number(serverId),
                    reason: "Assigned on table selection in Server Station",
                });

                refreshTables({ force: true });
            } catch (err) {
                console.error("Failed to assign server on table selection:", err);
            }
        } else {
            setSelectedTable(table);
        }

        setViewMode("ORDERING");
        setSearchParams({ table: activeTable.tableNo }, { replace: true });
    }, [user, restaurantId, refreshTables, setSearchParams]);

    // Auto-select table if query param ?table=X is provided
    const urlTableParam = searchParams.get("table");
    const autoSelectedRef = useRef(null);
    useEffect(() => {
        if (!urlTableParam) {
            autoSelectedRef.current = null;
            return;
        }
        if (tables.length === 0) return;
        if (autoSelectedRef.current === urlTableParam) return;

        const normParam = normalizeTableKey(urlTableParam);
        const matched = tables.find((t) => {
            const tNo = String(t.tableNo || "").trim();
            const normTNo = normalizeTableKey(tNo);
            return (
                tNo === String(urlTableParam).trim() ||
                String(t.id).trim() === String(urlTableParam).trim() ||
                (normParam && normTNo === normParam)
            );
        });
        if (matched) {
            autoSelectedRef.current = urlTableParam;
            handleSelectTableForOrder(matched);
        }
    }, [urlTableParam, tables, handleSelectTableForOrder]);

    // Keep selectedTable in sync with refreshed tables data
    useEffect(() => {
        if (!selectedTable) return;
        const fresh = tables.find(
            (t) => t.id === selectedTable.id || String(t.tableNo).trim() === String(selectedTable.tableNo).trim()
        );
        if (
            fresh &&
            (fresh.assignedWaiterId !== selectedTable.assignedWaiterId ||
                fresh.assignedWaiterName !== selectedTable.assignedWaiterName ||
                fresh.isOccupied !== selectedTable.isOccupied ||
                fresh.activeSession?.waiterName !== selectedTable.activeSession?.waiterName)
        ) {
            setSelectedTable(fresh);
        }
    }, [tables, selectedTable]);

    const handleMarkItemServed = async (item) => {
        try {
            if (item.type === "KOT") {
                await api.put(`/owner/${restaurantId}/kots/${item.id}/status`, {
                    status: "SERVED",
                });
            } else {
                await api.put(`/owner/${restaurantId}/orders/${item.id}/status`, {
                    status: "DELIVERED",
                    changedByName: user?.name || "Server",
                });
            }
            showToast({
                title: "Delivered 🍽️",
                message: `${item.tableNo ? `Table ${item.tableNo}: ` : ""}${item.kotNo ? `Ticket #${item.kotNo}` : `Order #${item.orderNo || ""}`} marked served!`,
                variant: "success",
            });
            refreshReadyKots();
            refreshLiveOrders();
            refreshTables();
        } catch (err) {
            showToast({
                title: "Error",
                message: err?.response?.data?.message || err?.message || "Failed to mark item served",
                variant: "error",
            });
        }
    };

    const handleMarkServed = async (orderId, tableNo) => {
        try {
            await api.put(`/owner/${restaurantId}/orders/${orderId}/status`, {
                status: "DELIVERED",
                changedByName: user?.name || "Server",
            });
            showToast({
                title: "Order Served 🍽️",
                message: `Order for Table ${tableNo || ""} marked as served.`,
                variant: "success",
            });
            refreshLiveOrders();
            refreshReadyKots();
            refreshTables();
        } catch (err) {
            showToast({
                title: "Error",
                message: err.response?.data?.message || err.message || "Failed to mark order served",
                variant: "error",
            });
        }
    };

    // Filter tables based on Section, Search query, and Shift time
    const filteredTables = useMemo(() => {
        return tables.filter((t) => {
            if (activeSectionFilter !== "ALL" && String(t.section || "Main Hall").trim() !== activeSectionFilter) {
                return false;
            }
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const tableNo = String(t.tableNo || "").toLowerCase();
                const waiter = String(t.assignedWaiterName || "").toLowerCase();
                const guestName = String(t.activeReservation?.customerName || "").toLowerCase();
                if (!tableNo.includes(q) && !waiter.includes(q) && !guestName.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    }, [tables, activeSectionFilter, searchQuery]);

    // Table Counts
    const statusCounts = useMemo(() => {
        let available = 0;
        let occupied = 0;
        let reserved = 0;
        let blocked = 0;

        tables.forEach((t) => {
            if (t.isBlocked) blocked++;
            else if (t.isOccupied) occupied++;
            else if (t.isReserved || t.activeReservation) reserved++;
            else available++;
        });

        return { total: tables.length, available, occupied, reserved, blocked };
    }, [tables]);

    const handleAddToCart = (item) => {
        const key = item.id;
        setCart((prev) => {
            const existing = prev[key];
            const newQty = existing ? existing.qty + 1 : 1;
            return {
                ...prev,
                [key]: {
                    ...item,
                    qty: newQty,
                },
            };
        });
    };

    const handleRemoveFromCart = (itemId) => {
        setCart((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
    };

    const cartTotal = useMemo(() => {
        return Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
    }, [cart]);

    const handleSendKOT = async () => {
        if (!selectedTable) return;
        const itemsList = Object.values(cart);
        if (itemsList.length === 0) {
            showToast({ title: "Cart Empty", message: "Add menu items to place order.", variant: "warning" });
            return;
        }

        try {
            setPlacingOrder(true);
            const assignedId = selectedTable.assignedWaiterId || selectedTable.activeSession?.waiterId || (user?.role === "WAITER" || user?.role === "SERVER" ? user?.id : null);
            const assignedName = selectedTable.assignedWaiterName || selectedTable.activeSession?.waiterName || (user?.role === "WAITER" || user?.role === "SERVER" ? user?.name : null);

            const payload = {
                tableNo: selectedTable.tableNo,
                tableId: selectedTable.id,
                waiterId: assignedId || null,
                waiterName: assignedName || null,
                items: itemsList.map((i) => ({
                    menuItemId: i.id,
                    qty: i.qty,
                    notes: i.notes || null,
                })),
                orderSource: "POS",
                fulfillment: "DINEIN",
            };

            const res = await axios.post(`${API}/owner/${restaurantId}/orders`, payload);
            if (res.data?.success) {
                showToast({
                    title: "KOT Sent to Kitchen! 🍳",
                    message: `Order for Table ${selectedTable.tableNo} placed successfully.`,
                    variant: "success",
                });
                setCart({});
                setViewMode("FLOOR_PLAN");
                setSelectedTable(null);
                setSearchParams({}, { replace: true });
                refreshTables();
            }
        } catch (err) {
            showToast({ title: "Order Error", message: err.message || "Failed to send KOT.", variant: "error" });
        } finally {
            setPlacingOrder(false);
        }
    };

    const handleClearTable = async (tableToClear, options = {}) => {
        const target = tableToClear || selectedTable;
        if (!target || !restaurantId) return;

        try {
            const res = await axios.post(`${API}/owner/${restaurantId}/tables/${target.id}/clear`, {
                force: options.force || false,
                reason: options.reason || "Customer left table - freed by server",
                performedByUserId: user?.id || null,
                performedByName: user?.name || user?.email || "Server",
                performedByUserRole: "SERVER",
            });

            if (res.data?.success) {
                showToast({
                    title: "Table Freed 🎉",
                    message: `Table ${target.tableNo} is now free and available.`,
                    variant: "success",
                });
                if (selectedTable?.id === target.id) {
                    setSelectedTable(null);
                    setCart({});
                    setViewMode("FLOOR_PLAN");
                }
                refreshTables();
            }
        } catch (err) {
            const data = err.response?.data;
            if (data?.requiresConfirmation && !options.force) {
                if (window.confirm(`${data.message}\n\nDo you want to FORCE-FREE Table ${target.tableNo}?`)) {
                    handleClearTable(target, { ...options, force: true });
                    return;
                }
            }
            showToast({
                title: "Error",
                message: data?.message || err.message || "Failed to free table.",
                variant: "error",
            });
        }
    };

    return (
        <div className="min-h-screen bg-[color:var(--app-bg,#f8fafc)] text-[color:var(--app-text,#0f172a)] font-sans flex flex-col">
            {/* Top Navigation & Status Bar */}
            <header className="sticky top-0 z-30 border-b border-[color:var(--app-border)]/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-xs flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 sm:gap-3">
                {/* Brand & Branch Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c3a3] bg-white p-1 shadow-[0_4px_14px_rgba(104,70,37,0.12)]">
                        <BrandLogo className="h-full w-full" title="Tiffzy logo" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                            <span className="text-sm sm:text-base font-black tracking-tight text-orange-500">
                                Tiffzy
                            </span>
                            <span className="text-xs font-extrabold text-[color:var(--app-muted)] hidden min-[360px]:inline">•</span>
                            <h1 className="text-xs sm:text-base font-extrabold tracking-tight text-[color:var(--app-text)] truncate max-w-[120px] min-[400px]:max-w-[180px] sm:max-w-[240px]">{restaurantName}</h1>
                            <span className="rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold border border-orange-500/30 whitespace-nowrap">
                                Server Station
                            </span>
                        </div>
                        <p className="text-[10px] sm:text-[11px] theme-muted flex items-center gap-1.5 flex-wrap">
                            <span>🕒 {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="hidden min-[360px]:inline">•</span>
                            <span>📅 {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </p>
                    </div>
                </div>

                {/* Meal Shift Selector */}
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[color:var(--app-border)]/40 overflow-x-auto scrollbar-none max-w-full shrink-0 my-0.5 sm:my-0">
                    {[
                        { id: "BREAKFAST", label: "🍳 Breakfast", time: `${shiftConfig.breakfast.start}-${shiftConfig.breakfast.end}` },
                        { id: "LUNCH", label: "🍱 Lunch", time: `${shiftConfig.lunch.start}-${shiftConfig.lunch.end}` },
                        { id: "DINNER", label: "🕯️ Dinner", time: `${shiftConfig.dinner.start}-${shiftConfig.dinner.end}` },
                    ].map((shift) => (
                        <button
                            key={shift.id}
                            onClick={() => setActiveShift(shift.id)}
                            className={`flex flex-col items-center rounded-lg px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold transition whitespace-nowrap ${
                                activeShift === shift.id
                                    ? "bg-orange-500 text-white shadow-xs"
                                    : "theme-muted hover:text-[color:var(--app-text)]"
                            }`}
                        >
                            <span>{shift.label}</span>
                            <span className="text-[8px] sm:text-[9px] opacity-80 font-normal">{shift.time}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => setIsShiftConfigOpen(true)}
                        className="p-1.5 text-slate-400 hover:text-orange-500 rounded-lg transition shrink-0"
                        title="Configure Shift Timings"
                    >
                        <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* Ready to Distribute Trigger Button */}
                    <button
                        onClick={() => {
                            const el = document.getElementById("ready-distribution-section");
                            if (el) {
                                el.scrollIntoView({ behavior: "smooth" });
                            } else {
                                showToast({
                                    title: "Kitchen Pass",
                                    message: readyItemsToDistribute.length > 0 ? `${readyItemsToDistribute.length} item(s) ready to distribute` : "No items waiting at the pass right now.",
                                    variant: "info",
                                });
                            }
                        }}
                        className={`relative flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-extrabold transition cursor-pointer whitespace-nowrap shadow-xs ${
                            readyItemsToDistribute.length > 0
                                ? "border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/25 animate-pulse"
                                : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                        title="Kitchen Pass / Ready to Distribute"
                    >
                        <Bell className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${readyItemsToDistribute.length > 0 ? "animate-bounce" : ""}`} />
                        <span>Ready to Distribute</span>
                        <span className={`rounded-full px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black ${
                            readyItemsToDistribute.length > 0 ? "bg-white text-emerald-700" : "bg-black/10 dark:bg-white/10"
                        }`}>
                            {readyItemsToDistribute.length}
                        </span>
                    </button>

                    {/* Waitlist Drawer Trigger */}
                    <button
                        onClick={() => setIsWaitlistOpen(true)}
                        className="relative flex items-center gap-1 sm:gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition cursor-pointer whitespace-nowrap"
                    >
                        <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden min-[450px]:inline">Waitlist</span>
                        {waitlistSummary.waitingCount > 0 && (
                            <span className="rounded-full bg-orange-500 text-white px-1.5 py-0.2 text-[9px] sm:text-[10px]">
                                {waitlistSummary.waitingCount}
                            </span>
                        )}
                    </button>

                    {/* New Reservation Trigger */}
                    <button
                        onClick={() => {
                            setEditingReservation(null);
                            setIsReservationModalOpen(true);
                        }}
                        className="flex items-center gap-1 sm:gap-1.5 rounded-xl bg-orange-500 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white hover:bg-orange-600 transition shadow-xs cursor-pointer whitespace-nowrap"
                    >
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span><span className="hidden min-[400px]:inline">New </span>Reservation</span>
                    </button>

                    {/* Notifications Button */}
                    <button
                        onClick={() => {
                            if (viewMode === "NOTIFICATIONS") {
                                setViewMode("FLOOR_PLAN");
                                navigate("/server");
                            } else {
                                setViewMode("NOTIFICATIONS");
                                navigate("/server/notifications");
                            }
                        }}
                        className={`relative flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-xs ${
                            viewMode === "NOTIFICATIONS"
                                ? "border-orange-500 bg-orange-500 text-white"
                                : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                        title="Server Notifications"
                    >
                        <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden min-[500px]:inline">Notifications</span>
                        {unreadNotificationCount > 0 && (
                            <span className="rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black animate-pulse">
                                {unreadNotificationCount}
                            </span>
                        )}
                    </button>

                    {/* Profile Button */}
                    <button
                        onClick={() => {
                            if (viewMode === "PROFILE") {
                                setViewMode("FLOOR_PLAN");
                                navigate("/server");
                            } else {
                                setViewMode("PROFILE");
                                navigate("/server/profile");
                            }
                        }}
                        className={`flex items-center gap-1.5 rounded-xl border px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-xs ${
                            viewMode === "PROFILE"
                                ? "border-orange-500 bg-orange-500 text-white"
                                : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                        title="My Profile"
                    >
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                            viewMode === "PROFILE" ? "bg-white text-orange-600" : "bg-orange-500 text-white"
                        }`}>
                            {(user?.name || user?.username || "S").charAt(0).toUpperCase()}
                        </div>
                        <span className="hidden sm:inline font-bold">{user?.name?.split(" ")[0] || "Profile"}</span>
                    </button>

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[color:var(--app-border)]/40">
                        <button
                            onClick={() => {
                                setViewMode("FLOOR_PLAN");
                                navigate("/server");
                            }}
                            className={`p-1.5 rounded-lg text-xs font-bold transition ${
                                viewMode === "FLOOR_PLAN" ? "bg-orange-500 text-white" : "theme-muted"
                            }`}
                            title="Floor Plan Grid View"
                        >
                            <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Body */}
            {viewMode === "PROFILE" ? (
                <div className="flex-1 p-3 sm:p-4 max-w-7xl mx-auto w-full">
                    <ServerProfileView
                        onBackToFloorPlan={() => {
                            setViewMode("FLOOR_PLAN");
                            navigate("/server");
                        }}
                    />
                </div>
            ) : viewMode === "NOTIFICATIONS" ? (
                <div className="flex-1 p-3 sm:p-4 max-w-7xl mx-auto w-full">
                    <ServerNotificationsView
                        onUnreadCountChange={(count) => setUnreadNotificationCount(count)}
                        onNavigateToTable={(tableNo) => {
                            setViewMode("FLOOR_PLAN");
                            navigate(`/server?table=${encodeURIComponent(tableNo)}`);
                        }}
                        onBackToFloorPlan={() => {
                            setViewMode("FLOOR_PLAN");
                            navigate("/server");
                        }}
                    />
                </div>
            ) : viewMode === "FLOOR_PLAN" ? (
                <div className="flex-1 p-3 sm:p-4 space-y-3 sm:space-y-4 max-w-7xl mx-auto w-full">
                    {/* Ready to Distribute Notification Banner & Grid */}
                    {readyItemsToDistribute.length > 0 && (
                        <div
                            id="ready-distribution-section"
                            className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 p-3.5 sm:p-4 text-xs shadow-md animate-in fade-in duration-300"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-500/20">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                                        <Bell className="h-4 w-4 animate-bounce" />
                                    </span>
                                    <div>
                                        <h3 className="font-black text-emerald-800 dark:text-emerald-300 text-sm sm:text-base flex items-center gap-2">
                                            <span>Ready for Distribution at Kitchen Pass</span>
                                            <span className="rounded-full bg-emerald-500 text-white px-2 py-0.5 text-[10px] font-extrabold">
                                                {readyItemsToDistribute.length} Ticket(s)
                                            </span>
                                        </h3>
                                        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium">
                                            Food & drinks ready to pick up and serve to guest tables
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-1 rounded-lg">
                                        🔴 Live Pass
                                    </span>
                                </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {readyItemsToDistribute.map((item) => (
                                    <div
                                        key={item.key}
                                        className="group relative flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-white dark:bg-slate-900 p-3 shadow-xs hover:shadow-md hover:border-emerald-500 transition-all duration-200"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-gray-100 dark:border-slate-800">
                                                <div>
                                                    <span className="inline-block text-xs font-black px-2 py-0.5 rounded-lg bg-orange-500 text-white shadow-xs">
                                                        Table {item.tableNo}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-emerald-600 font-bold ml-1.5">
                                                        #{item.kotNo || item.orderNo}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                    {item.stationName}
                                                </span>
                                            </div>

                                            <div className="py-2 space-y-1">
                                                {item.itemsList.map((food, fIdx) => (
                                                    <div key={fIdx} className="flex items-center justify-between text-xs">
                                                        <span className="font-extrabold text-[color:var(--app-text)] flex items-center gap-1.5">
                                                            <span className="text-emerald-600 font-mono font-black">{food.qty}x</span>
                                                            <span>{food.name}</span>
                                                        </span>
                                                        {food.notes && (
                                                            <span className="text-[9px] text-amber-600 italic">({food.notes})</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {item.waiterName && (
                                                <p className="text-[10px] theme-muted pt-1 border-t border-gray-100 dark:border-slate-800 flex items-center gap-1">
                                                    <span>👤 Assigned:</span> <strong className="text-[color:var(--app-text)]">{item.waiterName}</strong>
                                                </p>
                                            )}
                                        </div>

                                        <div className="pt-2 mt-2 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleMarkItemServed(item)}
                                                className="flex-1 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <Check className="h-3.5 w-3.5 stroke-[3]" /> Served / Distributed
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status Summary & Section Filters Bar */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 p-3 shadow-xs text-xs">
                        {/* Section Filter Tabs */}
                        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl overflow-x-auto scrollbar-none max-w-full shrink-0">
                            {sections.map((sec) => (
                                <button
                                    key={sec}
                                    onClick={() => setActiveSectionFilter(sec)}
                                    className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                                        activeSectionFilter === sec
                                            ? "bg-orange-500 text-white shadow-xs"
                                            : "theme-muted hover:text-[color:var(--app-text)]"
                                    }`}
                                >
                                    {sec}
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full md:w-60 lg:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 theme-muted" />
                            <input
                                type="text"
                                placeholder="Search table #, waiter, guest..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent pl-8 pr-3 py-1.5 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                            />
                        </div>

                        {/* Table Status Legend Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] overflow-x-auto scrollbar-none py-0.5 border-t md:border-t-0 border-gray-100 dark:border-slate-800 pt-2 md:pt-0">
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-white dark:bg-slate-800"></span> Available ({statusCounts.available})
                            </span>
                            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium whitespace-nowrap">
                                <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span> Reserved ({statusCounts.reserved})
                            </span>
                            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium whitespace-nowrap">
                                <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span> Occupied ({statusCounts.occupied})
                            </span>
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-500"></span> Blocked 🔒 ({statusCounts.blocked})
                            </span>
                        </div>
                    </div>

                    {/* Interactive Table Cards Grid */}
                    {tablesLoading ? (
                        <div className="flex justify-center p-12">
                            <LoaderCircle className="h-8 w-8 animate-spin text-orange-500" />
                        </div>
                    ) : filteredTables.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[color:var(--app-border)]/60 bg-white/40 dark:bg-slate-900/40 p-12 text-center theme-muted space-y-2">
                            <LayoutGrid className="h-8 w-8 mx-auto opacity-40 text-orange-500" />
                            <p className="font-bold text-xs">No dining tables match selected section or search filter.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {filteredTables.map((table) => {
                                const isBlocked = Boolean(table.isBlocked);
                                const isOccupied = Boolean(table.isOccupied);
                                const isReserved = !isOccupied && Boolean(table.isReserved || table.activeReservation);

                                return (
                                    <div
                                        key={table.id}
                                        onClick={() => handleSelectTableForOrder(table)}
                                        className={`group relative flex flex-col justify-between rounded-2xl border p-3 cursor-pointer transition-all duration-200 shadow-xs hover:-translate-y-0.5 min-h-[155px] sm:min-h-[165px] h-full text-xs bg-white dark:bg-slate-900 ${
                                            isBlocked
                                                ? "border-slate-500/40 bg-slate-500/10 dark:bg-slate-950/40 opacity-75"
                                                : isOccupied
                                                    ? "border-sky-500/40 bg-sky-500/5 dark:bg-sky-950/20"
                                                    : isReserved
                                                        ? "border-purple-500/40 bg-purple-500/5 dark:bg-purple-950/20"
                                                        : "border-gray-200 dark:border-slate-800 hover:border-orange-500/50"
                                        }`}
                                    >
                                        {/* Table Header: Table # & Seats */}
                                        <div className="flex justify-between items-start gap-1">
                                            <div>
                                                <h3 className="text-base sm:text-lg font-black tracking-tight text-[color:var(--app-text)]">
                                                    {table.tableNo}
                                                </h3>
                                                <p className="text-[10px] theme-muted">{table.seats} Seats • {table.section || "Main"}</p>
                                            </div>

                                            {/* Status Badge */}
                                            {isBlocked ? (
                                                <span className="flex items-center gap-1 rounded-full bg-slate-700 text-white px-2 py-0.5 text-[9px] font-bold shrink-0">
                                                    <Lock className="h-2.5 w-2.5" /> BLOCKED
                                                </span>
                                            ) : isOccupied ? (
                                                <span className="rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 px-2 py-0.5 text-[9px] font-bold border border-sky-500/30 shrink-0">
                                                    OCCUPIED
                                                </span>
                                            ) : isReserved ? (
                                                <span className="rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[9px] font-bold border border-purple-500/30 shrink-0">
                                                    RESERVED
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[9px] font-bold border border-emerald-500/30 shrink-0">
                                                    AVAILABLE
                                                </span>
                                            )}
                                        </div>

                                        {/* Table Content Details */}
                                        <div className="my-1.5 text-[11px] space-y-1">
                                            {/* Ready Items Alert for this Table */}
                                            {(() => {
                                                const rawNo = String(table.tableNo || "").trim();
                                                const count = readyItemsByTable.get(rawNo) || readyItemsByTable.get(rawNo.toLowerCase()) || readyItemsByTable.get(normalizeTableKey(rawNo)) || 0;
                                                if (count <= 0) return null;
                                                return (
                                                    <div className="flex items-center justify-between rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-extrabold animate-pulse">
                                                        <span className="flex items-center gap-1">
                                                            <Bell className="h-3 w-3 animate-bounce text-emerald-500" />
                                                            <span>Ready to Distribute!</span>
                                                        </span>
                                                        <span className="bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-black text-[9px]">
                                                            {count}
                                                        </span>
                                                    </div>
                                                );
                                            })()}

                                            {isBlocked ? (
                                                <p className="text-slate-600 dark:text-slate-400 italic text-[10px] truncate">
                                                    Reason: {table.blockReason || "Maintenance"}
                                                </p>
                                            ) : isOccupied ? (
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-sky-600 dark:text-sky-400">
                                                        {table.activeOrderCount || 1} Active Order(s)
                                                    </p>
                                                    {(table.assignedWaiterName || table.activeSession?.waiterName) ? (
                                                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1">
                                                            <span>👤</span> Server: <span className="font-bold">{table.assignedWaiterName || table.activeSession?.waiterName}</span>
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] theme-muted italic">No server assigned</p>
                                                    )}
                                                </div>
                                            ) : isReserved ? (
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-purple-600 dark:text-purple-400 truncate">
                                                        👤 {table.activeReservation?.customerName || "Reserved"}
                                                    </p>
                                                    <p className="text-[10px] theme-muted font-mono">
                                                        ⏰ {table.activeReservation?.startTime} – {table.activeReservation?.endTime}
                                                    </p>
                                                    {(table.assignedWaiterName || table.activeSession?.waiterName) && (
                                                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1">
                                                            <span>👤</span> Server: <span className="font-bold">{table.assignedWaiterName || table.activeSession?.waiterName}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] theme-muted opacity-75">Click to open table & take order</p>
                                                    {(table.assignedWaiterName || table.activeSession?.waiterName) ? (
                                                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1">
                                                            <span>👤</span> Server: <span className="font-bold">{table.assignedWaiterName || table.activeSession?.waiterName}</span>
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] theme-muted italic">Unassigned</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Footer Actions */}
                                        <div className="flex justify-between items-center pt-1.5 border-t border-[color:var(--app-border)]/30 text-[10px]">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setBlockModalTable(table);
                                                }}
                                                className="theme-muted hover:text-slate-900 dark:hover:text-white font-semibold flex items-center gap-1 py-0.5"
                                            >
                                                {isBlocked ? <Unlock className="h-3 w-3 text-emerald-500" /> : <Lock className="h-3 w-3 text-slate-400" />}
                                                {isBlocked ? "Unblock" : "Block"}
                                            </button>

                                            <div className="flex items-center gap-1.5">
                                                {isOccupied && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`Are you sure you want to free Table ${table.tableNo}?`)) {
                                                                handleClearTable(table);
                                                            }
                                                        }}
                                                        className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold transition flex items-center gap-1"
                                                        title="Free / Clear Table"
                                                    >
                                                        <Trash2 className="h-2.5 w-2.5" /> Free
                                                    </button>
                                                )}

                                                {!isBlocked && (
                                                    <span className="font-bold text-orange-500 group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                                                        Select →
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                /* Ordering View Mode (Active Table Order / Cart) */
                <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto w-full pb-20 lg:pb-4">
                    {/* Menu Studio Items Column */}
                    <div className="lg:col-span-2 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--app-border)]/40 pb-2">
                            <div>
                                <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                                    <span>Ordering for Table {selectedTable?.tableNo}</span>
                                    <span className="text-xs theme-muted">({selectedTable?.seats} Seats)</span>
                                </h2>
                                <div className="flex items-center gap-2 mt-1">
                                    {(selectedTable?.assignedWaiterName || selectedTable?.activeSession?.waiterName) ? (
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full shadow-xs">
                                            <span>👤 Assigned Server:</span>
                                            <strong className="font-extrabold">{selectedTable.assignedWaiterName || selectedTable.activeSession?.waiterName}</strong>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                                            <span>No server assigned</span>
                                        </span>
                                    )}
                                    <span className="text-[11px] theme-muted">• Section: {selectedTable?.section || "Main"}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`Are you sure you want to free Table ${selectedTable?.tableNo}?`)) {
                                            handleClearTable(selectedTable);
                                        }
                                    }}
                                    className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-2.5 sm:px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition flex items-center gap-1"
                                >
                                    <Trash2 className="h-3 w-3" /> Free Table
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedTable(null);
                                        setViewMode("FLOOR_PLAN");
                                        setSearchParams({}, { replace: true });
                                    }}
                                    className="rounded-xl border border-[color:var(--app-border)]/40 px-2.5 sm:px-3 py-1 text-xs font-bold theme-muted hover:bg-black/5"
                                >
                                    ← Floor Plan
                                </button>
                            </div>
                        </div>

                        {/* Ready Food Alert Banner for Selected Table */}
                        {(() => {
                            if (!selectedTable) return null;
                            const tRaw = String(selectedTable.tableNo || "").trim();
                            const tNorm = normalizeTableKey(tRaw);
                            const tableReadyItems = readyItemsToDistribute.filter((it) => {
                                const itRaw = String(it.tableNo || "").trim();
                                const itNorm = normalizeTableKey(itRaw);
                                return itRaw === tRaw || (tNorm && itNorm === tNorm);
                            });
                            if (tableReadyItems.length === 0) return null;
                            return (
                                <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/15 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in">
                                    <div className="flex items-center gap-2.5">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
                                            <Bell className="h-4 w-4 animate-bounce" />
                                        </span>
                                        <div>
                                            <h4 className="font-black text-xs sm:text-sm text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                                                <span>Food / Drinks Ready at Kitchen Pass for Table {selectedTable.tableNo}!</span>
                                                <span className="rounded-full bg-emerald-500 text-white px-2 py-0.2 text-[10px] font-black">
                                                    {tableReadyItems.length} Ticket(s)
                                                </span>
                                            </h4>
                                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold mt-0.5">
                                                {tableReadyItems
                                                    .map((it) =>
                                                        it.itemsList.map((f) => `${f.qty}x ${f.name}`).join(", ")
                                                    )
                                                    .join(" • ")}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleMarkItemServed(tableReadyItems[0])}
                                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition"
                                    >
                                        <Check className="h-3.5 w-3.5 stroke-[3]" /> Served / Distributed
                                    </button>
                                </div>
                            );
                        })()}

                        {/* Menu Categories */}
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                            {["ALL", "Coffee", "Breakfast", "Burgers", "Pizza", "Salads", "Desserts"].map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                                        activeCategory === cat ? "bg-orange-500 text-white" : "theme-muted bg-black/5 dark:bg-white/5"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Menu Items Grid */}
                        <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
                            {menuItems
                                .filter((i) => activeCategory === "ALL" || i.category === activeCategory)
                                .map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleAddToCart(item)}
                                        className="flex flex-col justify-between rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-left hover:border-orange-500 transition shadow-xs cursor-pointer active:scale-98"
                                    >
                                        <div>
                                            <p className="font-bold text-xs text-[color:var(--app-text)] line-clamp-2">{item.name}</p>
                                            <p className="text-[10px] theme-muted mt-0.5">{item.category}</p>
                                        </div>
                                        <div className="flex justify-between items-center mt-3 pt-1 border-t border-gray-100 dark:border-slate-800">
                                            <span className="font-extrabold text-xs text-orange-500">{formatMoney(item.price)}</span>
                                            <span className="rounded-lg bg-orange-500 text-white px-2 py-0.5 text-[10px] font-bold">
                                                + Add
                                            </span>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Cart & KOT Summary Column */}
                    <div id="kot-cart-section" className="rounded-2xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 p-3.5 sm:p-4 space-y-4 shadow-xs flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="border-b border-[color:var(--app-border)]/40 pb-2">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-sm">Table {selectedTable?.tableNo} Cart</h3>
                                    <span className="text-xs font-mono font-bold text-orange-500">{Object.keys(cart).length} Items</span>
                                </div>
                                {(selectedTable?.assignedWaiterName || selectedTable?.activeSession?.waiterName) && (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                                        <span>👤</span> Assigned Server: <strong>{selectedTable.assignedWaiterName || selectedTable.activeSession?.waiterName}</strong>
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2 max-h-[40vh] sm:max-h-[50vh] overflow-y-auto">
                                {Object.values(cart).length === 0 ? (
                                    <p className="text-xs theme-muted text-center py-8">Select menu items on the left to build order.</p>
                                ) : (
                                    Object.values(cart).map((item) => (
                                        <div key={item.id} className="flex justify-between items-center rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2 text-xs">
                                            <div className="min-w-0 flex-1 pr-2">
                                                <p className="font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                                                <p className="text-[10px] theme-muted">{formatMoney(item.price)} each</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="font-mono font-bold">x{item.qty}</span>
                                                <span className="font-bold text-orange-500">{formatMoney(item.price * item.qty)}</span>
                                                <button onClick={() => handleRemoveFromCart(item.id)} className="text-red-400 hover:text-red-500 p-1">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Cart Footer */}
                        <div className="space-y-3 pt-3 border-t border-[color:var(--app-border)]/40">
                            <div className="flex justify-between items-center text-sm font-bold">
                                <span>Subtotal:</span>
                                <span className="text-orange-500 font-mono text-base">{formatMoney(cartTotal)}</span>
                            </div>

                            <button
                                onClick={handleSendKOT}
                                disabled={placingOrder || Object.keys(cart).length === 0}
                                className="w-full rounded-xl bg-orange-500 py-3 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {placingOrder ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
                                Send KOT to Kitchen
                            </button>
                        </div>
                    </div>

                    {/* Mobile Floating Cart Action Bar (< lg) */}
                    {Object.keys(cart).length > 0 && (
                        <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-slate-900/95 dark:bg-slate-800/95 text-white backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
                            <div>
                                <p className="text-xs font-bold flex items-center gap-1.5">
                                    <ShoppingBag className="h-4 w-4 text-orange-400" />
                                    <span>{Object.values(cart).reduce((a, b) => a + b.qty, 0)} Items Selected</span>
                                </p>
                                <p className="text-[11px] font-mono font-bold text-orange-400">{formatMoney(cartTotal)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        document.getElementById("kot-cart-section")?.scrollIntoView({ behavior: "smooth" });
                                    }}
                                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold hover:bg-slate-700"
                                >
                                    View Cart
                                </button>
                                <button
                                    onClick={handleSendKOT}
                                    disabled={placingOrder}
                                    className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 shadow-md flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {placingOrder ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ChefHat className="h-3.5 w-3.5" />}
                                    Send KOT
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Integrated Modals & Drawers */}
            <WaitlistDrawer
                isOpen={isWaitlistOpen}
                onClose={() => setIsWaitlistOpen(false)}
                restaurantId={restaurantId}
                tables={tables}
                onWaitlistUpdated={() => refreshTables()}
            />

            <TableBlockModal
                isOpen={Boolean(blockModalTable)}
                onClose={() => setBlockModalTable(null)}
                table={blockModalTable}
                restaurantId={restaurantId}
                onSuccess={() => refreshTables()}
            />

            <MealShiftConfigModal
                isOpen={isShiftConfigOpen}
                onClose={() => setIsShiftConfigOpen(false)}
                restaurantId={restaurantId}
                initialShifts={shiftConfig}
                onSaved={(newShifts) => setShiftConfig(newShifts)}
            />

            <ReservationModal
                isOpen={isReservationModalOpen}
                onClose={() => {
                    setIsReservationModalOpen(false);
                    setEditingReservation(null);
                }}
                restaurantId={restaurantId}
                reservationToEdit={editingReservation}
                tables={tables}
                onSaved={() => {
                    refreshTables();
                    refreshReservations();
                }}
            />
        </div>
    );
}
