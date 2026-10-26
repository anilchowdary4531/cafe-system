import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
    AlertTriangle,
    Bell,
    Calendar,
    Check,
    ChefHat,
    Clock,
    Filter,
    Grid,
    History as HistoryIcon,
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
    Sparkles,
    Trash2,
    Unlock,
    User,
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
import { useCanonicalTables } from "../context/TableStateContext";
import TablePaymentSettlementModal from "../components/TablePaymentSettlementModal";
import ServerProfileView from "../components/ServerProfileView";
import ServerNotificationsView from "../components/ServerNotificationsView";
import ServerHistoryView from "../components/ServerHistoryView";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";

const formatMoney = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "₹0.00";
    return `₹${amount.toFixed(2)}`;
};

export const normalizeTableKey = (val) => {
    if (!val) return "";
    return String(val).trim().toLowerCase();
};

export const ORDER_STATUS_CONFIG = {
    PLACED: {
        label: "PLACED",
        icon: "🔵",
        className: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30",
    },
    ACCEPTED: {
        label: "ACCEPTED",
        icon: "🟡",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
    },
    PREPARING: {
        label: "PREPARING",
        icon: "🟠",
        className: "bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-500/30",
    },
    READY: {
        label: "READY",
        icon: "🟣",
        className: "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30",
    },
    SERVED: {
        label: "SERVED",
        icon: "🟢",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    },
    OUT_FOR_DELIVERY: {
        label: "OUT FOR DELIVERY",
        icon: "🚚",
        className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30",
    },
    DELIVERED: {
        label: "DELIVERED",
        icon: "📦",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    },
    PAYMENT_PENDING: {
        label: "PAYMENT_PENDING",
        icon: "💳",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
    },
    PAID: {
        label: "PAID",
        icon: "✅",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    },
    SETTLED: {
        label: "SETTLED",
        icon: "✅",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    },
    CANCELLED: {
        label: "CANCELLED",
        icon: "⚪",
        className: "bg-slate-500/10 text-slate-500 border-slate-500/30",
    },
};

export const isTablePaymentPending = (table) => {
    if (!table) return false;

    // A table that is explicitly AVAILABLE, not occupied, or has a CLOSED session cannot be PAYMENT_PENDING
    const tableStatus = String(table.status || "").toUpperCase();
    if (tableStatus === "AVAILABLE") return false;
    if (table.isOccupied === false) return false;
    if (table.session?.status === "CLOSED" || table.activeSession?.status === "CLOSED") return false;

    // Explicit payment pending statuses
    const activeStatus = String(resolveTableActiveOrderStatus(table) || "").toUpperCase();
    if (activeStatus === "PAYMENT_PENDING") return true;

    const rawActiveStatus = String(table.activeOrderStatus || table.orderStatus || "").toUpperCase();
    if (rawActiveStatus === "PAYMENT_PENDING" || rawActiveStatus === "BILLING") return true;

    if (tableStatus === "PAYMENT_PENDING" || tableStatus === "BILLING") return true;

    const sessionStatus = String(table.activeSession?.status || table.session?.status || "").toUpperCase();
    if (sessionStatus === "BILLING" || sessionStatus === "PAYMENT_PENDING") return true;

    const payStatus = String(table.paymentStatus || "").toUpperCase();
    if (payStatus === "PENDING" || payStatus === "PAYMENT_PENDING") return true;

    const activeOrders = Array.isArray(table.activeOrders) ? table.activeOrders : [];
    if (activeOrders.length > 0) {
        const hasUnpaid = activeOrders.some((o) => {
            const ps = String(o?.paymentStatus || "").toUpperCase();
            return ps !== "PAID" && ps !== "SUCCESS";
        });
        const hasServedOrDelivered = activeOrders.some((o) => {
            const st = String(o?.status || "").toUpperCase();
            return ["DELIVERED", "SERVED", "READY", "COMPLETED", "PAYMENT_PENDING"].includes(st);
        });
        if (hasUnpaid && hasServedOrDelivered) return true;
    }

    // Only inspect historical lastOrderStatus if table is actually occupied
    if (table.isOccupied && table.lastOrderStatus) {
        const lastSt = String(table.lastOrderStatus).toUpperCase();
        const lastPay = String(table.lastPaymentStatus || "").toUpperCase();
        if (["DELIVERED", "SERVED", "COMPLETED"].includes(lastSt) && lastPay !== "PAID" && lastPay !== "SUCCESS") {
            return true;
        }
    }

    return false;
};

export const resolveTableActiveOrderStatus = (table) => {
    if (!table) return null;

    const tableStatus = String(table.status || "").toUpperCase();
    if (tableStatus === "AVAILABLE") return null;
    if (table.isOccupied === false) return null;
    if (table.session?.status === "CLOSED" || table.activeSession?.status === "CLOSED") return null;

    if (table.activeOrderStatus) {
        return String(table.activeOrderStatus).toUpperCase();
    }
    if (table.orderStatus) {
        return String(table.orderStatus).toUpperCase();
    }

    const activeOrders = Array.isArray(table.activeOrders) ? table.activeOrders : [];
    if (activeOrders.length === 0) {
        if (table.isOccupied && table.lastOrderStatus) {
            const lastStatus = String(table.lastOrderStatus).toUpperCase();
            if (["DELIVERED", "SERVED", "COMPLETED", "PAYMENT_PENDING"].includes(lastStatus)) {
                const lastPay = String(table.lastPaymentStatus || "").toUpperCase();
                if (lastPay !== "PAID" && lastPay !== "SUCCESS") return "PAYMENT_PENDING";
                return "PAID";
            }
            return lastStatus;
        }
        return null;
    }

    // Canonical priority rule: In-flight kitchen action > Delivered > Paid
    if (activeOrders.some((o) => String(o?.status || "").toUpperCase() === "READY")) return "READY";
    if (activeOrders.some((o) => String(o?.status || "").toUpperCase() === "PREPARING")) return "PREPARING";
    if (activeOrders.some((o) => String(o?.status || "").toUpperCase() === "ACCEPTED")) return "ACCEPTED";
    if (activeOrders.some((o) => String(o?.status || "").toUpperCase() === "PLACED")) return "PLACED";

    const allDelivered = activeOrders.every((o) => {
        const s = String(o?.status || "").toUpperCase();
        return s === "DELIVERED" || s === "SERVED" || s === "COMPLETED";
    });

    if (allDelivered) {
        const anyUnpaid = activeOrders.some((o) => {
            const ps = String(o?.paymentStatus || "").toUpperCase();
            return ps !== "PAID" && ps !== "SUCCESS";
        });
        if (anyUnpaid) return "PAYMENT_PENDING";
        return "PAID";
    }

    if (activeOrders.some((o) => ["PAYMENT_PENDING", "BILLING"].includes(String(o?.status || "").toUpperCase()))) {
        return "PAYMENT_PENDING";
    }

    return String(activeOrders[activeOrders.length - 1]?.status || "").toUpperCase();
};

const globalHandledNotificationKeys = new Map();

export default function Server() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, token, logout } = useAuth();
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

    // Active View Mode: "FLOOR_PLAN" | "ORDERING" | "PROFILE" | "NOTIFICATIONS" | "HISTORY"
    const getInitialViewMode = () => {
        if (location.pathname.endsWith("/history")) return "HISTORY";
        if (location.pathname.endsWith("/profile") || location.pathname.endsWith("/settings")) return "PROFILE";
        if (location.pathname.endsWith("/notifications")) return "NOTIFICATIONS";
        return "FLOOR_PLAN";
    };
    const [viewMode, setViewMode] = useState(getInitialViewMode);

    useEffect(() => {
        if (location.pathname.endsWith("/history")) {
            setViewMode("HISTORY");
        } else if (location.pathname.endsWith("/profile") || location.pathname.endsWith("/settings")) {
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
            const res = await api.get("/api/notifications/unread-count");
            if (res.data?.success) {
                setUnreadNotificationCount(res.data.count || 0);
                return;
            }
        } catch {
            // fallback to alias
        }
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
    const [settlementTable, setSettlementTable] = useState(null);
    const [isShiftConfigOpen, setIsShiftConfigOpen] = useState(false);
    const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
    const [editingReservation, setEditingReservation] = useState(null);

    // Ordering / Selected Table state
    const [selectedTable, setSelectedTable] = useState(null);
    const [cart, setCart] = useState({});
    const [activeCategory, setActiveCategory] = useState("ALL");
    const [customizingItem, setCustomizingItem] = useState(null);
    const [placingOrder, setPlacingOrder] = useState(false);

    // Authoritative table state overrides driven by realtime events & immediate releases
    const [tableOverrides, setTableOverrides] = useState({});
    const tableReleasedTimestampsRef = useRef(new Map());

    const applyTableRelease = useCallback((target) => {
        if (!target) return;
        const targetId = target.tableId || target.id;
        const targetNo = target.tableNo || target.table_no;
        const now = Date.now();

        const idKey = targetId ? String(targetId) : null;
        const noKey = targetNo ? String(targetNo).trim().toLowerCase() : null;

        if (idKey) tableReleasedTimestampsRef.current.set(`id:${idKey}`, now);
        if (noKey) tableReleasedTimestampsRef.current.set(`no:${noKey}`, now);

        const releasePatch = {
            status: "AVAILABLE",
            isOccupied: false,
            activeOrderCount: 0,
            activeOrders: [],
            activeOrderStatus: null,
            paymentStatus: null,
            occupiedSince: null,
            assignedServer: null,
            assignedWaiterId: null,
            assignedWaiterName: null,
            session: { status: "CLOSED" },
            activeSession: null,
            lastOrderStatus: null,
            lastPaymentStatus: null,
            releasedAt: now,
        };

        setTableOverrides((prev) => {
            const next = { ...prev };
            if (idKey) next[idKey] = releasePatch;
            else if (noKey) next[noKey] = releasePatch;
            return next;
        });

        setSelectedTable((prev) => {
            if (!prev) return prev;
            const matchesPrev =
                (targetId && (Number(prev.id) === Number(targetId) || String(prev.id) === String(targetId))) ||
                (targetNo && String(prev.tableNo).trim().toLowerCase() === String(targetNo).trim().toLowerCase());
            if (matchesPrev) {
                return {
                    ...prev,
                    ...releasePatch,
                };
            }
            return prev;
        });
    }, []);

    // Canonical Global Table State
    const { tables: canonicalTables, refreshTables: refreshCanonicalTables } = useCanonicalTables();

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

    const combinedRefreshTables = useCallback((opts) => {
        refreshTables?.(opts);
        refreshCanonicalTables?.(opts);
    }, [refreshTables, refreshCanonicalTables]);

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

    const { data: readyRunnerData, refresh: refreshReadyRunnerData } = useCachedGet(
        restaurantId ? `/api/v1/staff/food-runner-items?restaurantId=${restaurantId}` : null,
        {
            enabled: Boolean(restaurantId),
            ttlMs: 3_000,
            scope: `server-ready-runner:${restaurantId}`,
        }
    );

    const [distributingItemIds, setDistributingItemIds] = useState({});
    const [realtimeAddedReadyItems, setRealtimeAddedReadyItems] = useState([]);
    const [realtimeRemovedItemIds, setRealtimeRemovedItemIds] = useState(new Set());

    const tables = useMemo(() => {
        const rawTables = canonicalTables.length > 0
            ? canonicalTables
            : (!tablesData ? [] : Array.isArray(tablesData.tables) ? tablesData.tables : Array.isArray(tablesData) ? tablesData : []);
        if (!rawTables.length) return [];

        // Canonical Table Deduplication: Ensure each database table ID appears exactly once
        const seenIds = new Set();
        const uniqueRawTables = [];
        for (const t of rawTables) {
            const tid = t?.id ? Number(t.id) : null;
            if (tid) {
                if (seenIds.has(tid)) continue;
                seenIds.add(tid);
            }
            uniqueRawTables.push(t);
        }

        return uniqueRawTables.map((t) => {
            const idKey = t.id ? String(t.id) : null;
            const noKey = t.tableNo ? String(t.tableNo).trim().toLowerCase() : null;
            const override = (idKey && tableOverrides[idKey]) ? tableOverrides[idKey] : (!idKey && noKey && tableOverrides[noKey] ? tableOverrides[noKey] : null);

            if (override) {
                // Stale HTTP response rejection:
                // Only allow HTTP response to supersede if it has a newer active session opened strictly AFTER the release timestamp
                const incomingOpenedAt = t.activeSession?.openedAt || t.session?.openedAt || t.occupiedSince;
                const isNewerSession = incomingOpenedAt && new Date(incomingOpenedAt).getTime() > override.releasedAt;

                if (!isNewerSession) {
                    return {
                        ...t,
                        ...override,
                    };
                }
            }

            // Check for strict sanitation DIRTY state
            const isDirty = t.cleaningStatus === "DIRTY" || t.status === "DIRTY";
            if (isDirty) {
                return {
                    ...t,
                    status: "DIRTY",
                    cleaningStatus: "DIRTY",
                    isOccupied: false,
                    activeOrderCount: 0,
                    activeOrders: [],
                    activeOrderStatus: null,
                    paymentStatus: null,
                    occupiedSince: null,
                    session: { status: "CLOSED" },
                    activeSession: null,
                };
            }

            // If canonical backend status is AVAILABLE, not occupied, or closed session:
            // Ensure no stale occupied/order/payment/server fields leak through
            const isExplicitlyFree = t.status === "AVAILABLE" || t.isOccupied === false || t.session?.status === "CLOSED" || t.activeSession?.status === "CLOSED";
            if (isExplicitlyFree) {
                return {
                    ...t,
                    status: "AVAILABLE",
                    cleaningStatus: "CLEAN",
                    isOccupied: false,
                    activeOrderCount: 0,
                    activeOrders: [],
                    activeOrderStatus: null,
                    paymentStatus: null,
                    occupiedSince: null,
                    assignedServer: t.assignedServer || t.assignedWaiterName || null,
                    assignedWaiterId: t.assignedWaiterId || null,
                    assignedWaiterName: t.assignedWaiterName || null,
                    session: { status: "CLOSED" },
                    activeSession: null,
                    lastOrderStatus: null,
                    lastPaymentStatus: null,
                };
            }

            return t;
        });
    }, [tablesData, tableOverrides, canonicalTables]);

    const menuItems = useMemo(() => {
        if (!menuData) return [];
        return Array.isArray(menuData.items) ? menuData.items : Array.isArray(menuData) ? menuData : [];
    }, [menuData]);

    const reservations = useMemo(() => {
        if (!reservationsData) return [];
        return Array.isArray(reservationsData.reservations) ? reservationsData.reservations : [];
    }, [reservationsData]);

    // Unified Authoritative Item-Level Queue of Ready Items to Distribute (from KOTItems)
    const readyItemsToDistribute = useMemo(() => {
        const list = [];
        const seenItemIds = new Set();

        // 1. Primary Source of Truth: Canonical food runner / ready distribution items
        const rawRunner = Array.isArray(readyRunnerData?.items) ? readyRunnerData.items : [];
        const runnerItems = rawRunner
            .concat(realtimeAddedReadyItems)
            .filter((it) => !realtimeRemovedItemIds.has(Number(it.id || it.kotItemId)));

        runnerItems.forEach((it) => {
            const itemId = Number(it.id || it.kotItemId);
            if (!itemId || seenItemIds.has(itemId)) return;
            seenItemIds.add(itemId);

            list.push({
                key: `ready-kotitem-${itemId}`,
                id: itemId, // Canonical KOTItem.id
                kotItemId: itemId,
                orderItemId: it.orderItemId || null,
                orderId: it.orderId || it.kot?.orderId || null,
                kotId: it.kotId || it.kot?.id || null,
                restaurantId: it.restaurantId || restaurantId,
                type: "KOT_ITEM",
                kotNo: it.kotNo || it.kot?.kotNo || "",
                orderNo: it.orderNo || it.kot?.order?.orderNo || "",
                tableNo: String(it.tableNo || it.kot?.tableNo || it.kot?.order?.tableNo || "N/A").trim(),
                waiterName: it.waiterName || it.kot?.waiterName || it.kot?.order?.assignedWaiterName || it.kot?.order?.customerName || null,
                stationName: it.stationName || it.kot?.stationName || "Kitchen",
                readyAt: it.readyAt || it.createdAt,
                name: it.itemName || it.name,
                itemName: it.itemName || it.name,
                qty: it.qty || it.quantity || 1,
                variantName: it.variantName || null,
                notes: it.notes || null,
                preparedByName: it.preparedByName || null,
                status: "READY",
                itemsList: [
                    {
                        id: itemId,
                        orderItemId: it.orderItemId,
                        name: it.itemName || it.name,
                        itemName: it.itemName || it.name,
                        qty: it.qty || it.quantity || 1,
                        notes: it.notes,
                        status: "READY",
                    },
                ],
            });
        });

        // 2. Compatibility Fallback: If runner items endpoint is empty or in test mocks that only mock readyKotsData
        if (list.length === 0) {
            const rawKots = Array.isArray(readyKotsData?.kots) ? readyKotsData.kots : Array.isArray(readyKotsData) ? readyKotsData : [];
            rawKots.forEach((kot) => {
                const kotStatus = String(kot.status || "").toUpperCase();
                const rawItems = Array.isArray(kot.items) ? kot.items : [];
                const isKotReady = kotStatus === "READY";
                const readyItemsInKot = rawItems.filter((it) => String(it.status || "").toUpperCase() === "READY");
                const itemsToInclude = isKotReady ? (readyItemsInKot.length > 0 ? readyItemsInKot : rawItems) : readyItemsInKot;

                itemsToInclude.forEach((it) => {
                    const itemId = Number(it.id);
                    if (itemId && (seenItemIds.has(itemId) || realtimeRemovedItemIds.has(itemId))) return;
                    if (itemId) seenItemIds.add(itemId);

                    list.push({
                        key: `ready-kotitem-${itemId || `synth-${kot.id}-${it.itemName}`}`,
                        id: itemId || kot.id,
                        kotItemId: itemId || null,
                        orderItemId: it.orderItemId || null,
                        orderId: kot.orderId,
                        kotId: kot.id,
                        restaurantId: kot.restaurantId || restaurantId,
                        type: "KOT_ITEM",
                        kotNo: kot.kotNo || "",
                        orderNo: kot.order?.orderNo || "",
                        tableNo: String(kot.tableNo || kot.order?.tableNo || "N/A").trim(),
                        waiterName: kot.waiterName || kot.order?.customerName || null,
                        stationName: kot.stationName || "Kitchen",
                        readyAt: it.readyAt || kot.updatedAt || kot.createdAt,
                        name: it.itemName || it.name,
                        itemName: it.itemName || it.name,
                        qty: it.qty || it.quantity || 1,
                        variantName: it.variantName || null,
                        notes: it.notes || null,
                        preparedByName: it.preparedByName || null,
                        status: "READY",
                        itemsList: [
                            {
                                id: itemId || kot.id,
                                orderItemId: it.orderItemId,
                                name: it.itemName || it.name,
                                itemName: it.itemName || it.name,
                                qty: it.qty || it.quantity || 1,
                                notes: it.notes,
                                status: "READY",
                            },
                        ],
                    });
                });
            });
        }

        return list;
    }, [readyRunnerData, readyKotsData, restaurantId, realtimeAddedReadyItems, realtimeRemovedItemIds]);

    // Map table number (and normalized key) to count of ready items waiting for pickup
    const readyItemsByTable = useMemo(() => {
        const map = new Map();
        readyItemsToDistribute.forEach((item) => {
            const raw = String(item.tableNo || "").trim();
            if (!raw || raw === "N/A") return;
            const norm = normalizeTableKey(raw);
            const keysToIncrement = new Set([raw]);
            if (norm) keysToIncrement.add(norm);
            keysToIncrement.forEach((k) => {
                map.set(k, (map.get(k) || 0) + 1);
            });
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
            const sec = String(t.section || "Location not configured").trim();
            if (sec) set.add(sec);
        });
        return Array.from(set);
    }, [tables]);

    const handledNotificationIdsRef = useRef(new Map());
    const callbacksRef = useRef({
        refreshTables: combinedRefreshTables,
        refreshReservations,
        refreshLiveOrders,
        refreshReadyKots,
        refreshReadyRunnerData,
        fetchUnreadCount,
        handleViewAssignedTable: null,
        user,
        applyTableRelease,
    });
    useEffect(() => {
        callbacksRef.current = {
            refreshTables: combinedRefreshTables,
            refreshReservations,
            refreshLiveOrders,
            refreshReadyKots,
            refreshReadyRunnerData,
            fetchUnreadCount,
            handleViewAssignedTable,
            user,
            applyTableRelease,
        };
    });

    // Socket real-time updates & Ready Order alerts
    useEffect(() => {
        if (!socket) return;
        const handleRealtimeUpdate = (data) => {
            const isReleaseEvent =
                data &&
                (data.status === "AVAILABLE" ||
                    data.isOccupied === false ||
                    data.status === "CLOSED" ||
                    data.session?.status === "CLOSED" ||
                    data.activeSession?.status === "CLOSED" ||
                    (data.status === "PAID" && (data.tableId || data.tableNo)));

            if (isReleaseEvent) {
                callbacksRef.current.applyTableRelease?.(data);
            }

            callbacksRef.current.refreshTables?.({ force: true });
            callbacksRef.current.refreshReservations?.({ force: true });
            callbacksRef.current.refreshLiveOrders?.({ force: true });
            callbacksRef.current.refreshReadyKots?.({ force: true });
            callbacksRef.current.refreshReadyRunnerData?.({ force: true });

            // Instant Realtime Ready-Item Queue Synchronization
            const readyItem = data?.item || (data?.status === "READY" ? data : null);
            if (readyItem && (readyItem.status === "READY" || data?.action === "READY")) {
                const itemId = Number(readyItem.id || readyItem.kotItemId);
                if (itemId) {
                    setRealtimeRemovedItemIds((prev) => {
                        if (!prev.has(itemId)) return prev;
                        const next = new Set(prev);
                        next.delete(itemId);
                        return next;
                    });
                    setRealtimeAddedReadyItems((prev) => {
                        if (prev.some((it) => Number(it.id || it.kotItemId) === itemId)) return prev;
                        return [...prev, readyItem];
                    });
                }
            }

            const deliveredItemId = Number(data?.itemId || data?.kotItemId || (data?.status === "SERVED" || data?.status === "DELIVERED" ? data?.id : 0));
            if (deliveredItemId) {
                setRealtimeRemovedItemIds((prev) => {
                    const next = new Set(prev);
                    next.add(deliveredItemId);
                    return next;
                });
                setRealtimeAddedReadyItems((prev) => prev.filter((it) => Number(it.id || it.kotItemId) !== deliveredItemId));
            }

            if (data?.tableId) {
                setSelectedTable((prev) => {
                    if (!prev || (prev.id !== data.tableId && String(prev.tableNo) !== String(data.tableNo))) {
                        return prev;
                    }
                    if (isReleaseEvent) {
                        return {
                            ...prev,
                            status: "AVAILABLE",
                            isOccupied: false,
                            activeOrderCount: 0,
                            activeOrders: [],
                            activeOrderStatus: null,
                            paymentStatus: null,
                            assignedWaiterId: null,
                            assignedWaiterName: null,
                            assignedServer: null,
                            occupiedSince: null,
                            session: { status: "CLOSED" },
                            activeSession: null,
                        };
                    }
                    return {
                        ...prev,
                        assignedWaiterId: data.assignedWaiterId !== undefined ? data.assignedWaiterId : prev.assignedWaiterId,
                        assignedWaiterName: data.assignedWaiterName !== undefined ? data.assignedWaiterName : prev.assignedWaiterName,
                    };
                });
            }

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

        const handleNewNotification = (notif) => {
            if (!notif) return;

            // Defense in depth: Verify recipient if specified in notification payload
            const currentUid = Number(callbacksRef.current.user?.id || callbacksRef.current.user?.userId || 0);
            const targetUid = Number(notif.recipientId || notif.data?.waiterId || notif.data?.recipientId || 0);
            if (targetUid && currentUid && targetUid !== currentUid) {
                return;
            }

            // Defensive deduplication using stable identifier (id or idempotencyKey or table+action)
            const notifKey = notif.id
                ? `id:${notif.id}`
                : (notif.idempotencyKey || notif.data?.idempotencyKey)
                    ? `idem:${notif.idempotencyKey || notif.data?.idempotencyKey}`
                    : (notif.tableId || notif.data?.tableId) && (notif.data?.action || notif.notificationType)
                        ? `table:${notif.tableId || notif.data?.tableId}:${notif.data?.action || notif.notificationType}`
                        : null;

            if (notifKey) {
                const now = Date.now();
                const lastSeen = handledNotificationIdsRef.current.get(notifKey) || globalHandledNotificationKeys.get(notifKey);

                // Periodic eviction of IDs older than 30s to keep map bounded
                if (handledNotificationIdsRef.current.size > 100) {
                    for (const [k, timestamp] of handledNotificationIdsRef.current.entries()) {
                        if (now - timestamp > 30000) {
                            handledNotificationIdsRef.current.delete(k);
                        }
                    }
                }
                if (globalHandledNotificationKeys.size > 100) {
                    for (const [k, timestamp] of globalHandledNotificationKeys.entries()) {
                        if (now - timestamp > 30000) {
                            globalHandledNotificationKeys.delete(k);
                        }
                    }
                }

                if (lastSeen && now - lastSeen < 10000) {
                    // Duplicate event arriving within 10s dedupe window; suppress duplicate toast/sound/count
                    return;
                }
                handledNotificationIdsRef.current.set(notifKey, now);
                globalHandledNotificationKeys.set(notifKey, now);
            }

            callbacksRef.current.fetchUnreadCount?.();
            const typeUpper = String(notif?.notificationType || notif?.type || "").toUpperCase();
            const isAssigned = typeUpper === "TABLE_ASSIGNMENT" || notif?.data?.action === "ASSIGNED" || notif?.data?.action === "REASSIGNED";
            const isUnassigned = typeUpper === "TABLE_UNASSIGNED" || notif?.data?.action === "UNASSIGNED";
            const isKotSent = typeUpper === "KOT_SENT" || notif?.data?.action === "KOT_SENT";

            if (isAssigned || isUnassigned || isKotSent) {
                playNotificationSound();
                const targetTableNo = notif.tableNo || notif.data?.tableNo || "";
                const targetTableId = notif.tableId || notif.data?.tableId || null;

                showToast({
                    title: notif.title || (isAssigned ? (targetTableNo ? `📋 Table Assigned — Table ${targetTableNo}` : "📋 Table Assigned") : isKotSent ? (targetTableNo ? `🍳 Order Sent to Kitchen — Table ${targetTableNo}` : "🍳 Order Sent to Kitchen") : "Table Unassigned"),
                    message: notif.message || (isAssigned
                        ? (targetTableNo ? `Table ${targetTableNo} has been assigned to you. Please check/attend Table ${targetTableNo}.` : "A table has been assigned to you.")
                        : isKotSent
                            ? (targetTableNo ? `Order sent to kitchen for Table ${targetTableNo}` : "Order sent to kitchen")
                            : (targetTableNo ? `Table ${targetTableNo} assignment updated.` : "Table assignment updated.")),
                    variant: isAssigned || isKotSent ? "success" : "info",
                    actionLabel: (isAssigned || isKotSent) && (targetTableNo || targetTableId) ? "View Table" : undefined,
                    durationMs: (isAssigned || isKotSent) ? 8000 : 4000,
                    onAction: (isAssigned || isKotSent) && (targetTableNo || targetTableId) ? () => {
                        callbacksRef.current.handleViewAssignedTable?.(targetTableNo, targetTableId);
                    } : undefined,
                });
                callbacksRef.current.refreshTables?.({ force: true });
            }
        };

        const handleConnect = () => {
            setRealtimeAddedReadyItems([]);
            setRealtimeRemovedItemIds(new Set());
            callbacksRef.current.refreshTables?.({ force: true });
            callbacksRef.current.refreshLiveOrders?.({ force: true });
            callbacksRef.current.refreshReadyKots?.({ force: true });
            callbacksRef.current.refreshReadyRunnerData?.({ force: true });
        };

        socket.on("connect", handleConnect);
        socket.on("table:updated", handleRealtimeUpdate);
        socket.on("table:waiter_assigned", handleRealtimeUpdate);
        socket.on("table:session_updated", handleRealtimeUpdate);
        socket.on("reservation:updated", handleRealtimeUpdate);
        socket.on("waitlist:updated", handleRealtimeUpdate);
        socket.on("kot:status_updated", handleRealtimeUpdate);
        socket.on("kot:item_updated", handleRealtimeUpdate);
        socket.on("kitchen:item_ready", handleRealtimeUpdate);
        socket.on("food:delivered", handleRealtimeUpdate);
        socket.on("kitchen:item_status_updated", handleRealtimeUpdate);
        socket.on("order:updated", handleRealtimeUpdate);
        socket.on("order:status_updated", handleRealtimeUpdate);
        socket.on("order:created", handleRealtimeUpdate);
        socket.on("order_created", handleRealtimeUpdate);
        socket.on("payment:updated", handleRealtimeUpdate);
        socket.on("new_order", handleRealtimeUpdate);
        socket.on("notification:new", handleNewNotification);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("table:updated", handleRealtimeUpdate);
            socket.off("table:waiter_assigned", handleRealtimeUpdate);
            socket.off("table:session_updated", handleRealtimeUpdate);
            socket.off("reservation:updated", handleRealtimeUpdate);
            socket.off("waitlist:updated", handleRealtimeUpdate);
            socket.off("kot:status_updated", handleRealtimeUpdate);
            socket.off("kot:item_updated", handleRealtimeUpdate);
            socket.off("kitchen:item_ready", handleRealtimeUpdate);
            socket.off("food:delivered", handleRealtimeUpdate);
            socket.off("kitchen:item_status_updated", handleRealtimeUpdate);
            socket.off("order:updated", handleRealtimeUpdate);
            socket.off("order:status_updated", handleRealtimeUpdate);
            socket.off("order:created", handleRealtimeUpdate);
            socket.off("order_created", handleRealtimeUpdate);
            socket.off("payment:updated", handleRealtimeUpdate);
            socket.off("new_order", handleRealtimeUpdate);
            socket.off("notification:new", handleNewNotification);
        };
    }, [socket]);

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

        if (table.cleaningStatus === "DIRTY" || table.status === "DIRTY") {
            showToast({
                title: "Table Needs Cleaning 🧹",
                message: `Table ${table.tableNo} is awaiting sanitation. Cleaner has been alerted. Please wait until table is cleaned.`,
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

    const handleViewAssignedTable = useCallback((tableNo, tableId) => {
        if (!tableNo && !tableId) return;
        setViewMode("FLOOR_PLAN");
        autoSelectedRef.current = null;

        const normNo = normalizeTableKey(tableNo);
        const matched = tables.find((t) => {
            if (tableId && (t.id === Number(tableId) || String(t.id) === String(tableId))) return true;
            if (tableNo && (String(t.tableNo).trim() === String(tableNo).trim() || normalizeTableKey(t.tableNo) === normNo)) return true;
            return false;
        });

        if (matched) {
            handleSelectTableForOrder(matched);
        } else if (tableNo) {
            navigate(`/server?table=${encodeURIComponent(tableNo)}`);
        }
    }, [tables, handleSelectTableForOrder, navigate]);
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
        if (!item) return;
        const itemId = Number(item.kotItemId || item.id);
        if (itemId) {
            setDistributingItemIds((prev) => ({ ...prev, [itemId]: true }));
            setRealtimeRemovedItemIds((prev) => {
                const next = new Set(prev);
                next.add(itemId);
                return next;
            });
            setRealtimeAddedReadyItems((prev) => prev.filter((existing) => Number(existing.id || existing.kotItemId) !== itemId));
        }
        try {
            if (item.type === "ORDER") {
                await api.put(`/owner/${restaurantId}/orders/${item.id}/status`, {
                    status: "DELIVERED",
                    changedByName: user?.name || "Server",
                });
            } else {
                // Authoritative KOTItem delivery
                try {
                    await api.put(`/api/v1/staff/food-runner-items/${itemId}/delivered`);
                } catch (runnerErr) {
                    if (item.kotId) {
                        await api.put(`/owner/${restaurantId}/kitchen/items/${itemId}/status`, {
                            status: "SERVED",
                        });
                    } else if (item.type === "KOT") {
                        await api.put(`/owner/${restaurantId}/kots/${item.id}/status`, {
                            status: "SERVED",
                        });
                    } else {
                        throw runnerErr;
                    }
                }
            }

            showToast({
                title: "Delivered 🍽️",
                message: `${item.tableNo ? `Table ${item.tableNo}: ` : ""}${item.name || item.itemName || (item.kotNo ? `Ticket #${item.kotNo}` : "Item")} marked served!`,
                variant: "success",
            });
            refreshReadyRunnerData?.({ force: true });
            refreshReadyKots?.({ force: true });
            refreshLiveOrders?.({ force: true });
            refreshTables?.({ force: true });
        } catch (err) {
            showToast({
                title: "Error",
                message: err?.response?.data?.message || err?.message || "Failed to mark item served",
                variant: "error",
            });
        } finally {
            if (itemId) {
                setDistributingItemIds((prev) => ({ ...prev, [itemId]: false }));
            }
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
            if (activeSectionFilter !== "ALL" && String(t.section || "Location not configured").trim() !== activeSectionFilter) {
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
        let dirty = 0;

        tables.forEach((t) => {
            const isBlocked = Boolean(t.isBlocked);
            const isDirty = t.cleaningStatus === "DIRTY" || t.status === "DIRTY";
            const isExplicitlyFree = !isDirty && (t.status === "AVAILABLE" || t.isOccupied === false || t.session?.status === "CLOSED" || t.activeSession?.status === "CLOSED");
            const isPendingPayment = !isBlocked && !isExplicitlyFree && !isDirty && isTablePaymentPending(t);
            const isOcc = !isBlocked && !isExplicitlyFree && !isDirty && Boolean(t.isOccupied || isPendingPayment || t.status === "OCCUPIED" || (Array.isArray(t.activeOrders) && t.activeOrders.length > 0));

            if (isBlocked) blocked++;
            else if (isDirty) dirty++;
            else if (isOcc) occupied++;
            else if (t.isReserved || t.activeReservation) reserved++;
            else available++;
        });

        return { total: tables.length, available, occupied, reserved, blocked, dirty };
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

            const canonicalTableSessionId = selectedTable.tableSessionId || selectedTable.sessionId || selectedTable.activeSession?.id || null;
            const payload = {
                tableNo: selectedTable.tableNo,
                tableId: selectedTable.id,
                tableSessionId: canonicalTableSessionId,
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

            const res = token
                ? await axios.post(`${API}/owner/${restaurantId}/orders`, payload, {
                      headers: { Authorization: `Bearer ${token}` },
                      withCredentials: true,
                  })
                : await axios.post(`${API}/owner/${restaurantId}/orders`, payload);
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
            <header className="sticky top-0 z-30 border-b border-[color:var(--app-border)]/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2.5 sm:px-4 h-14 sm:h-[60px] max-h-[64px] shadow-xs flex items-center justify-between gap-1.5 sm:gap-2.5 overflow-x-auto lg:overflow-visible scrollbar-none">
                {/* Brand & Branch Info — Owner Panel Branding */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
                    <Link
                        to="/server"
                        className="flex items-center gap-1.5 shrink-0 group focus:outline-none"
                        title="Tiffzy Server Station"
                    >
                        <BrandLogo className="theme-brand-logo h-6 w-6 sm:h-7 sm:w-7 shrink-0" title="Tiffzy logo" />
                        <span className="theme-brand-text text-base sm:text-lg font-bold tracking-tight group-hover:opacity-90 transition-opacity">
                            Tiffzy
                        </span>
                    </Link>
                    <div className="min-w-0 flex items-center gap-1 sm:gap-1.5">
                        <span className="text-xs font-extrabold text-[color:var(--app-muted)] hidden min-[360px]:inline">•</span>
                        <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-[color:var(--app-text)] truncate max-w-[90px] min-[400px]:max-w-[130px] lg:max-w-[160px]">
                            {restaurantName}
                        </h1>
                        <span className="rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border border-orange-500/30 whitespace-nowrap">
                            Server Station
                        </span>
                    </div>
                </div>

                {/* Meal Shift Selector */}
                <div className="flex items-center gap-0.5 bg-black/5 dark:bg-white/5 p-0.5 sm:p-1 rounded-xl border border-[color:var(--app-border)]/40 shrink-0">
                    {[
                        { id: "BREAKFAST", label: "🍳 Breakfast", time: `${shiftConfig.breakfast.start}-${shiftConfig.breakfast.end}` },
                        { id: "LUNCH", label: "🍱 Lunch", time: `${shiftConfig.lunch.start}-${shiftConfig.lunch.end}` },
                        { id: "DINNER", label: "🕯️ Dinner", time: `${shiftConfig.dinner.start}-${shiftConfig.dinner.end}` },
                    ].map((shift) => (
                        <button
                            key={shift.id}
                            type="button"
                            onClick={() => setActiveShift(shift.id)}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] sm:text-xs font-bold transition whitespace-nowrap h-7 sm:h-8 ${
                                activeShift === shift.id
                                    ? "bg-orange-500 text-white shadow-xs"
                                    : "theme-muted hover:text-[color:var(--app-text)]"
                            }`}
                        >
                            <span>{shift.label}</span>
                            <span className={`text-[8.5px] sm:text-[9.5px] font-normal hidden xl:inline ${activeShift === shift.id ? "text-white/85" : "opacity-70"}`}>
                                {shift.time}
                            </span>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setIsShiftConfigOpen(true)}
                        className="p-1 text-slate-400 hover:text-orange-500 rounded-lg transition shrink-0"
                        title="Configure Shift Timings"
                        aria-label="Configure Shift Timings"
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* Ready to Distribute Trigger Button */}
                    <button
                        type="button"
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
                        className={`relative flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border px-2 sm:px-2.5 h-8 sm:h-9 text-[11px] sm:text-xs font-extrabold transition cursor-pointer whitespace-nowrap shadow-xs ${
                            readyItemsToDistribute.length > 0
                                ? "border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/25 animate-pulse"
                                : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                        title="Kitchen Pass / Ready to Distribute"
                        aria-label="Kitchen Pass / Ready to Distribute"
                    >
                        <Bell className={`h-3.5 w-3.5 ${readyItemsToDistribute.length > 0 ? "animate-bounce" : ""}`} />
                        <span>Ready to Distribute</span>
                        <span className={`rounded-full px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black ${
                            readyItemsToDistribute.length > 0 ? "bg-white text-emerald-700" : "bg-black/10 dark:bg-white/10"
                        }`}>
                            {readyItemsToDistribute.length}
                        </span>
                    </button>

                    {/* Waitlist Drawer Trigger */}
                    <button
                        type="button"
                        onClick={() => setIsWaitlistOpen(true)}
                        className="relative flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border border-orange-500/30 bg-orange-500/10 px-2 sm:px-2.5 h-8 sm:h-9 text-[11px] sm:text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition cursor-pointer whitespace-nowrap"
                        aria-label="Waitlist"
                    >
                        <Users className="h-3.5 w-3.5" />
                        <span className="hidden min-[450px]:inline">Waitlist</span>
                        {waitlistSummary.waitingCount > 0 && (
                            <span className="rounded-full bg-orange-500 text-white px-1.5 py-0.2 text-[9px] sm:text-[10px]">
                                {waitlistSummary.waitingCount}
                            </span>
                        )}
                    </button>

                    {/* New Reservation Trigger */}
                    <button
                        type="button"
                        onClick={() => {
                            setEditingReservation(null);
                            setIsReservationModalOpen(true);
                        }}
                        className="flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl bg-orange-500 px-2 sm:px-2.5 h-8 sm:h-9 text-[11px] sm:text-xs font-bold text-white hover:bg-orange-600 transition shadow-xs cursor-pointer whitespace-nowrap"
                        aria-label="New Reservation"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span><span className="hidden min-[400px]:inline">New </span>Reservation</span>
                    </button>

                    {/* Active Service Tab/Button */}
                    <button
                        type="button"
                        data-testid="server-active-service-nav-btn"
                        onClick={() => {
                            setViewMode("FLOOR_PLAN");
                            navigate("/server");
                        }}
                        className={`flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border px-2 sm:px-2.5 h-8 sm:h-9 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-xs ${
                            viewMode === "FLOOR_PLAN" || viewMode === "ORDERING"
                                ? "border-orange-500 bg-orange-500 text-white shadow-xs shadow-orange-500/20"
                                : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                        title="Active Service Floor Plan"
                        aria-label="Active Service Floor Plan"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Active Service</span>
                    </button>

                    {/* History Button */}
                    <button
                        type="button"
                        data-testid="server-history-nav-btn"
                        onClick={() => {
                            if (viewMode === "HISTORY") {
                                setViewMode("FLOOR_PLAN");
                                navigate("/server");
                            } else {
                                setViewMode("HISTORY");
                                navigate("/server/history");
                            }
                        }}
                        className={`relative flex items-center justify-center rounded-lg sm:rounded-xl border w-8 h-8 sm:w-9 sm:h-9 transition cursor-pointer shrink-0 shadow-xs ${
                            viewMode === "HISTORY"
                                ? "border-orange-500 bg-orange-500 text-white shadow-xs shadow-orange-500/20"
                                : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                        title="History"
                        aria-label="History"
                    >
                        <HistoryIcon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                    </button>

                    {/* Notifications Button */}
                    <button
                        type="button"
                        data-testid="server-notifications-nav-btn"
                        onClick={() => {
                            if (viewMode === "NOTIFICATIONS") {
                                setViewMode("FLOOR_PLAN");
                                navigate("/server");
                            } else {
                                setViewMode("NOTIFICATIONS");
                                navigate("/server/notifications");
                            }
                        }}
                        className={`relative flex items-center justify-center rounded-lg sm:rounded-xl border w-8 h-8 sm:w-9 sm:h-9 transition cursor-pointer shrink-0 shadow-xs ${
                            viewMode === "NOTIFICATIONS"
                                ? "border-orange-500 bg-orange-500 text-white shadow-xs shadow-orange-500/20"
                                : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                        title="Notifications"
                        aria-label="Notifications"
                    >
                        <Bell className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        {unreadNotificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] sm:text-[10px] font-black text-white shadow-xs animate-pulse">
                                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                            </span>
                        )}
                    </button>

                    {/* Staff Profile Area with Time & Date aligned horizontally on the same baseline */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Time & Date Display (Authoritative) */}
                        <div className="text-right leading-none select-none flex flex-col items-end justify-center py-0.5" data-testid="server-station-clock">
                            <span className="text-[10px] sm:text-[11px] font-bold text-[color:var(--app-text,#0f172a)] tabular-nums tracking-tight">
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[8.5px] sm:text-[9.5px] font-medium text-[color:var(--app-muted,#64748b)] whitespace-nowrap mt-0.5">
                                {currentTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '')}
                            </span>
                        </div>

                        {/* Settings Button */}
                        <button
                            type="button"
                            data-testid="server-settings-btn"
                            onClick={() => {
                                if (viewMode === "PROFILE" && location.pathname.endsWith("/settings")) {
                                    setViewMode("FLOOR_PLAN");
                                    navigate("/server");
                                } else {
                                    setViewMode("PROFILE");
                                    navigate("/server/settings");
                                }
                            }}
                            className={`flex items-center justify-center rounded-lg sm:rounded-xl border w-8 h-8 sm:w-9 sm:h-9 transition cursor-pointer shrink-0 shadow-xs ${
                                viewMode === "PROFILE" && location.pathname.endsWith("/settings")
                                    ? "border-orange-500 bg-orange-500 text-white shadow-xs shadow-orange-500/20"
                                    : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                            }`}
                            title="Settings"
                            aria-label="Settings"
                        >
                            <Settings2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        </button>

                        {/* Profile Button */}
                        <button
                            type="button"
                            data-testid="server-profile-btn"
                            onClick={() => {
                                if (viewMode === "PROFILE" && !location.pathname.endsWith("/settings")) {
                                    setViewMode("FLOOR_PLAN");
                                    navigate("/server");
                                } else {
                                    setViewMode("PROFILE");
                                    navigate("/server/profile");
                                }
                            }}
                            className={`flex items-center justify-center rounded-lg sm:rounded-xl border w-8 h-8 sm:w-9 sm:h-9 transition cursor-pointer shrink-0 shadow-xs ${
                                viewMode === "PROFILE" && !location.pathname.endsWith("/settings")
                                    ? "border-orange-500 bg-orange-500 text-white shadow-xs shadow-orange-500/20"
                                    : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                            }`}
                            title="Profile"
                            aria-label="Server Profile"
                        >
                            <User className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
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
                        onUnreadCountChange={setUnreadNotificationCount}
                        onNavigateToTable={(tableNo, tableId) => {
                            if (tableId) {
                                handleViewAssignedTable(tableNo, tableId);
                            } else {
                                setViewMode("FLOOR_PLAN");
                                navigate(`/server?table=${encodeURIComponent(tableNo)}`);
                            }
                        }}
                        onBackToFloorPlan={() => {
                            setViewMode("FLOOR_PLAN");
                            navigate("/server");
                        }}
                    />
                </div>
            ) : viewMode === "HISTORY" ? (
                <div className="flex-1 p-3 sm:p-4 max-w-7xl mx-auto w-full">
                    <ServerHistoryView
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
                                                {readyItemsToDistribute.length} Ready Item(s)
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
                                                    <span className="text-[10px] font-mono text-emerald-600 font-bold ml-1.5" title="Authoritative KOTItem ID">
                                                        Item #{item.kotItemId || item.id}
                                                    </span>
                                                    {(item.kotNo || item.orderNo) && (
                                                        <span className="text-[10px] font-mono text-emerald-600 font-bold ml-1">
                                                            #{item.kotNo || item.orderNo}
                                                        </span>
                                                    )}
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
                                    type="button"
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
                                id="server-table-search"
                                name="serverTableSearch"
                                aria-label="Search tables, waiters, guests"
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
                            {statusCounts.dirty > 0 && (
                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap">
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span> Cleaning Needed ({statusCounts.dirty})
                                </span>
                            )}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                            {filteredTables.map((table) => {
                                const isBlocked = Boolean(table.isBlocked);
                                const isDirty = table.cleaningStatus === "DIRTY" || table.status === "DIRTY";
                                const isExplicitlyFree = !isDirty && (table.status === "AVAILABLE" || table.isOccupied === false || table.session?.status === "CLOSED" || table.activeSession?.status === "CLOSED");
                                const hasPendingPayment = !isBlocked && !isExplicitlyFree && !isDirty && isTablePaymentPending(table);
                                const isOccupied = !isBlocked && !isExplicitlyFree && !isDirty && Boolean(table.isOccupied || hasPendingPayment || table.status === "OCCUPIED" || (Array.isArray(table.activeOrders) && table.activeOrders.length > 0));
                                const isReserved = !isBlocked && !isOccupied && !isDirty && Boolean(table.isReserved || table.activeReservation);

                                return (
                                    <div
                                        key={table.id}
                                        data-testid={`table-card-${table.id}`}
                                        onClick={() => handleSelectTableForOrder(table)}
                                        className={`group relative flex flex-col justify-between rounded-2xl border p-3 cursor-pointer transition-all duration-200 shadow-xs hover:-translate-y-0.5 min-h-[155px] sm:min-h-[165px] h-full text-xs bg-white dark:bg-slate-900 ${
                                            isBlocked
                                                ? "border-slate-500/40 bg-slate-500/10 dark:bg-slate-950/40 opacity-75"
                                                : isDirty
                                                    ? "border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/20 shadow-xs shadow-amber-500/10"
                                                    : isOccupied
                                                        ? "border-sky-500/40 bg-sky-500/5 dark:bg-sky-950/20"
                                                        : isReserved
                                                            ? "border-purple-500/40 bg-purple-500/5 dark:purple-950/20"
                                                            : "border-gray-200 dark:border-slate-800 hover:border-orange-500/50"
                                        }`}
                                    >
                                        {/* Table Header: Table # & Seats */}
                                        <div className="flex justify-between items-start gap-1">
                                            <div>
                                                <h3 className="text-base sm:text-lg font-black tracking-tight text-[color:var(--app-text)]">
                                                    {table.tableNo}
                                                </h3>
                                                <p className="text-[10px] theme-muted">{table.seats} Seats • {table.section || "Location not configured"}</p>
                                            </div>

                                            {/* Status Badge */}
                                            {isBlocked ? (
                                                <span className="flex items-center gap-1 rounded-full bg-slate-700 text-white px-2 py-0.5 text-[9px] font-bold shrink-0">
                                                    <Lock className="h-2.5 w-2.5" /> BLOCKED
                                                </span>
                                            ) : isDirty ? (
                                                <span className="rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[9px] font-bold border border-amber-500/30 shrink-0 flex items-center gap-1 animate-pulse">
                                                    <Sparkles className="h-2.5 w-2.5" /> CLEANING
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
                                                <div className="space-y-1">
                                                    {Array.isArray(table.activeOrders) && table.activeOrders.length > 0 ? (
                                                        <div className="space-y-0.5">
                                                            <p className="font-bold text-sky-600 dark:text-sky-400">
                                                                {table.activeOrders.length} Active Order(s)
                                                            </p>
                                                            {table.activeOrders.slice(0, 1).map((ord) => (
                                                                <p key={ord.id || ord.orderNo} className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                                                                    <span className="font-bold text-slate-700 dark:text-slate-200">#{ord.orderNo || ord.id}:</span>{" "}
                                                                    {Array.isArray(ord.items) && ord.items.length > 0
                                                                        ? ord.items.map((it) => `${it.qty || 1}x ${it.itemName}`).join(", ")
                                                                        : `${ord.status}`}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="font-bold text-sky-600 dark:text-sky-400">
                                                            {table.activeOrderCount || 1} Active Order(s)
                                                        </p>
                                                    )}
                                                    {(() => {
                                                        const activeStatus = hasPendingPayment ? "PAYMENT_PENDING" : resolveTableActiveOrderStatus(table);
                                                        if (!activeStatus) return null;
                                                        const cfg = ORDER_STATUS_CONFIG[activeStatus] || {
                                                            label: activeStatus,
                                                            icon: "📋",
                                                            className: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
                                                        };
                                                        return (
                                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold py-0.5">
                                                                <span className="theme-muted text-[10px]">Order Status:</span>
                                                                <span
                                                                    data-testid={`order-status-${table.id || table.tableNo}`}
                                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border ${cfg.className}`}
                                                                >
                                                                    {cfg.icon && <span className="mr-1">{cfg.icon}</span>}
                                                                    {cfg.label}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                    {(table.assignedWaiterName || table.activeSession?.waiterName) ? (
                                                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1">
                                                            <span>👤</span> Server: <span className="font-bold">{table.assignedWaiterName || table.activeSession?.waiterName}</span>
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] theme-muted italic">No server assigned</p>
                                                    )}
                                                    {hasPendingPayment && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSettlementTable(table);
                                                            }}
                                                            className="w-full mt-2 py-1.5 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-xs shadow-sm shadow-orange-500/25 flex items-center justify-center gap-1.5 transition cursor-pointer"
                                                            data-testid={`settle-payment-btn-${table.id || table.tableNo}`}
                                                        >
                                                            💳 Settle Payment
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                await axios.post(
                                                                    `${API}/api/v1/staff/tasks/request`,
                                                                    {
                                                                        restaurantId,
                                                                        tableId: table.id,
                                                                        tableNo: table.tableNo,
                                                                        title: `Service Assistance - Table ${table.tableNo}`,
                                                                        description: "Water, cutlery, or guest assistance requested by server",
                                                                        category: "SERVICE",
                                                                        taskType: "SERVICE",
                                                                        roleTarget: "STEWARD",
                                                                        priority: "MEDIUM",
                                                                    },
                                                                    { headers: { Authorization: `Bearer ${token}` } }
                                                                );
                                                                showToast({
                                                                    title: "Steward Called 🛎️",
                                                                    message: `Service request dispatched for Table ${table.tableNo}.`,
                                                                    variant: "success",
                                                                });
                                                            } catch (err) {
                                                                showToast({ title: "Error", message: "Failed to dispatch steward request", variant: "error" });
                                                            }
                                                        }}
                                                        className="w-full mt-1.5 py-1 px-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1 transition"
                                                        title="Call floor steward for water, cutlery or table assistance"
                                                    >
                                                        🛎️ Call Steward
                                                    </button>
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
                                            ) : isDirty ? (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-amber-500 font-bold">Needs cleaning before seating</p>
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                                                        <Sparkles className="h-3 w-3" /> Cleaner alerted
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] theme-muted opacity-75">Click to open table & take order</p>
                                                    {(table.assignedWaiterName || (!isExplicitlyFree && table.activeSession?.waiterName)) ? (
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
                                    <span className="text-[11px] theme-muted">• Section: {selectedTable?.section || "Location not configured"}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {isTablePaymentPending(selectedTable) && (
                                    <button
                                        type="button"
                                        onClick={() => setSettlementTable(selectedTable)}
                                        className="rounded-xl border border-orange-500 bg-orange-500 hover:bg-orange-600 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-orange-500/25 transition flex items-center gap-1 cursor-pointer"
                                        data-testid={`settle-payment-selected-btn-${selectedTable?.id || selectedTable?.tableNo}`}
                                    >
                                        💳 Settle Payment
                                    </button>
                                )}
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
                                    type="button"
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
                                    type="button"
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
                                        type="button"
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

                            {Array.isArray(selectedTable?.activeOrders) && selectedTable.activeOrders.length > 0 && (
                                <div className="rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 p-2.5 space-y-2">
                                    <div className="flex justify-between items-center text-xs font-bold text-sky-800 dark:text-sky-300">
                                        <span>Active Placed Order(s)</span>
                                        <span className="text-[10px] bg-sky-200/80 dark:bg-sky-800 text-sky-900 dark:text-sky-100 px-1.5 py-0.2 rounded-full font-mono">
                                            {selectedTable.activeOrders.length}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 max-h-[25vh] overflow-y-auto">
                                        {selectedTable.activeOrders.map((ord) => (
                                            <div key={ord.id || ord.orderNo} className="text-xs bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-sky-100 dark:border-sky-900/40">
                                                <div className="flex justify-between items-center font-bold text-[11px]">
                                                    <span className="text-slate-900 dark:text-white">#{ord.orderNo || ord.id}</span>
                                                    <span className="text-sky-600 dark:text-sky-400 font-extrabold">{ord.status}</span>
                                                </div>
                                                {Array.isArray(ord.items) && ord.items.length > 0 && (
                                                    <ul className="mt-1 space-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                                                        {ord.items.map((it) => (
                                                            <li key={it.id} className="flex justify-between items-center">
                                                                <span>{it.qty || 1}× {it.itemName}</span>
                                                                {it.preparedByName && (
                                                                    <span className="text-emerald-600 dark:text-emerald-400 text-[9px]">Chef: {it.preparedByName}</span>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFromCart(item.id)}
                                                    className="text-red-400 hover:text-red-500 p-1"
                                                    title={`Remove ${item.name}`}
                                                    aria-label={`Remove ${item.name} from cart`}
                                                >
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
                                type="button"
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
                                    type="button"
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

            <TablePaymentSettlementModal
                isOpen={Boolean(settlementTable)}
                onClose={() => setSettlementTable(null)}
                table={settlementTable}
                restaurantId={restaurantId}
                serverName={user?.name || user?.email || "Staff"}
                restaurantInfo={user?.restaurant || null}
                onSettled={async () => {
                    applyTableRelease(settlementTable);
                    await refreshTables?.({ force: true });
                    await refreshLiveOrders?.({ force: true });
                }}
            />
        </div>
    );
}
