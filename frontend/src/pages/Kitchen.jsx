import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
    AlertTriangle,
    Bell,
    BellOff,
    CheckCircle2,
    ChefHat,
    Clock3,
    Flame,
    Filter,
    LoaderCircle,
    LogOut,
    Printer,
    RefreshCw,
    Search,
    Sparkles,
    UtensilsCrossed,
    Volume2,
    VolumeX,
    X,
    Users,
    UserCheck,
    CheckSquare,
    Square,
    Zap,
    ShieldAlert,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { api } from "../utils/apiClient";
import NotificationSoundPicker from "../components/NotificationSoundPicker";
import { playNotificationSound } from "../utils/soundPlayer";
import { resolveEffectiveStaffRole, isSeniorChef as isSeniorChefCheck } from "../utils/staffRole";
import { showToast } from "../utils/toast";
import ServerProfileView from "../components/ServerProfileView";
import ServerNotificationsView from "../components/ServerNotificationsView";
import ChefWorkloadPanel from "../components/ChefWorkloadPanel";
import KitchenAssignmentDrawer from "../components/KitchenAssignmentDrawer";

const KOT_STATUSES = ["ALL", "PENDING", "PREPARING", "READY", "SERVED", "CANCELLED"];
const PRIORITIES = ["ALL", "NORMAL", "HIGH", "URGENT"];

const formatAge = (minutes) => {
    if (minutes === null || minutes === undefined) return "-";
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const getSlaStatus = (createdAtIso, estPrepMins = 15) => {
    if (!createdAtIso) return { label: "ON TIME", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", elapsed: 0 };
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAtIso).getTime()) / 60000));
    const est = Math.max(1, Number(estPrepMins || 15));
    const ratio = elapsedMinutes / est;

    if (ratio > 1.0) {
        return { label: "OVERDUE", badgeClass: "bg-red-50 text-red-700 border-red-200 font-semibold", elapsed: elapsedMinutes };
    }
    if (ratio >= 0.8) {
        return { label: "WARNING", badgeClass: "bg-amber-50 text-amber-700 border-amber-200 font-semibold", elapsed: elapsedMinutes };
    }
    return { label: "ON TIME", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", elapsed: elapsedMinutes };
};

const priorityBadgeClass = (priority) => {
    switch (String(priority || "").toUpperCase()) {
        case "URGENT":
            return "bg-red-50 text-red-700 border border-red-200 font-bold";
        case "HIGH":
            return "bg-amber-50 text-amber-700 border border-amber-200 font-semibold";
        default:
            return "bg-slate-100 text-slate-600 border border-slate-200 font-medium";
    }
};

const sourceBadgeClass = (source) => {
    switch (String(source || "").toUpperCase()) {
        case "POS":
            return "bg-blue-50 text-blue-700 border border-blue-200";
        case "QR":
            return "bg-purple-50 text-purple-700 border border-purple-200";
        case "DELIVERY":
            return "bg-amber-50 text-amber-700 border border-amber-200";
        case "TAKEAWAY":
            return "bg-emerald-50 text-emerald-700 border border-emerald-200";
        default:
            return "bg-slate-100 text-slate-600 border border-slate-200";
    }
};

export default function Kitchen() {
    const { user, logout } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        user?.restaurant_id ||
        localStorage.getItem("restaurantId") ||
        localStorage.getItem("selectedRestaurantId") ||
        1
    );

    const restaurantName = String(user?.restaurant?.name || "Restaurant").trim() || "Restaurant";
    const effectiveRole = resolveEffectiveStaffRole(user?.role, user?.designation);
    const isSeniorChefUser = isSeniorChefCheck(user?.role, user?.designation);
    const titleLabel = "Senior Chef Command Center";

    // Role-specific navigation: Line chef must be routed to their individual Chef Station
    if (user && effectiveRole === "CHEF" && !isSeniorChefUser) {
        const targetId = user?.id || user?.userId;
        return <Navigate to={targetId ? `/kitchen/chef/${targetId}` : "/"} replace />;
    }

    const location = useLocation();
    const navigate = useNavigate();

    // Active View Mode: "KDS" | "PROFILE" | "NOTIFICATIONS"
    const getInitialViewMode = () => {
        if (location.pathname.endsWith("/profile")) return "PROFILE";
        if (location.pathname.endsWith("/notifications")) return "NOTIFICATIONS";
        return "KDS";
    };
    const [viewMode, setViewMode] = useState(getInitialViewMode);

    useEffect(() => {
        if (location.pathname.endsWith("/profile")) {
            setViewMode("PROFILE");
        } else if (location.pathname.endsWith("/notifications")) {
            setViewMode("NOTIFICATIONS");
        } else {
            setViewMode("KDS");
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
            // fallback
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

    const handledNotificationIdsRef = useRef(new Map());
    const fetchUnreadCountRef = useRef(fetchUnreadCount);
    useEffect(() => {
        fetchUnreadCountRef.current = fetchUnreadCount;
    }, [fetchUnreadCount]);

    const [kots, setKots] = useState([]);
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [lastSyncAt, setLastSyncAt] = useState(null);

    // Kitchen Config & Workload
    const [kitchenConfig, setKitchenConfig] = useState({ mode: "DISPATCHER", scope: "ITEMS" });
    const [workload, setWorkload] = useState({ chefs: [] });
    const [selectedChefFilter, setSelectedChefFilter] = useState("ALL"); // "ALL" | "UNASSIGNED" | chefId
    const [updatingConfig, setUpdatingConfig] = useState(false);

    // Assignment Drawer State
    const [drawerKot, setDrawerKot] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

    // Filters
    const [selectedStationId, setSelectedStationId] = useState("ALL");
    const [selectedStatus, setSelectedStatus] = useState("ALL");
    const [selectedPriority, setSelectedPriority] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Audio & Action states
    const [updatingKotId, setUpdatingKotId] = useState(null);
    const [reprintingKotId, setReprintingKotId] = useState(null);
    const [soundModalOpen, setSoundModalOpen] = useState(false);
    const [soundMuted, setSoundMuted] = useState(() => {
        try {
            return localStorage.getItem("tiffzy_kitchen_sound_muted") === "true";
        } catch {
            return false;
        }
    });

    const toggleSoundMute = () => {
        setSoundMuted((prev) => {
            const next = !prev;
            try {
                localStorage.setItem("tiffzy_kitchen_sound_muted", String(next));
                if (!next) playNotificationSound();
            } catch {}
            return next;
        });
    };

    // Timer tick to trigger live timer re-renders
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick((t) => t + 1), 10000);
        return () => clearInterval(timer);
    }, []);

    // Load Stations
    const loadStations = useCallback(async () => {
        if (!restaurantId) return;
        try {
            const res = await api.get(`/owner/${restaurantId}/stations`);
            const list = Array.isArray(res?.data?.stations) ? res.data.stations : [];
            setStations(list);
        } catch (err) {
            console.error("Failed to load stations:", err);
        }
    }, [restaurantId]);

    // Load KOTs
    const loadKots = useCallback(async ({ silent = false } = {}) => {
        if (!restaurantId) return;
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await api.get(`/owner/${restaurantId}/kots?limit=100`);
            const list = Array.isArray(res?.data?.kots) ? res.data.kots : [];
            setKots(list);
            setError("");
            setLastSyncAt(new Date());
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to load kitchen tickets.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [restaurantId]);

    // Load Kitchen Config (Mode & Scope)
    const loadKitchenConfig = useCallback(async () => {
        if (!restaurantId) return;
        try {
            const res = await api.get(`/owner/${restaurantId}/kitchen/config`);
            if (res.data?.ok) {
                setKitchenConfig({ mode: res.data.mode, scope: res.data.scope });
            }
        } catch (err) {
            console.error("Failed to load kitchen config:", err);
        }
    }, [restaurantId]);

    // Load Kitchen Workload
    const loadWorkload = useCallback(async () => {
        if (!restaurantId) return;
        try {
            const res = await api.get(`/owner/${restaurantId}/kitchen/workload`);
            if (res.data?.ok) {
                setWorkload({ chefs: res.data.chefs || [] });
            }
        } catch (err) {
            console.error("Failed to load kitchen workload:", err);
        }
    }, [restaurantId]);

    useEffect(() => {
        if (!restaurantId) return;
        loadStations();
        loadKots();
        loadKitchenConfig();
        loadWorkload();
    }, [loadStations, loadKots, loadKitchenConfig, loadWorkload, restaurantId]);

    // Change Assignment Mode (DISPATCHER | SELF_PICK)
    const handleUpdateMode = async (newMode) => {
        setUpdatingConfig(true);
        try {
            const res = await api.put(`/owner/${restaurantId}/kitchen/config`, { mode: newMode });
            if (res.data?.ok) {
                setKitchenConfig((prev) => ({ ...prev, mode: res.data.mode }));
                showToast(`Kitchen mode changed to ${newMode}`, "success");
            }
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to update kitchen mode", "error");
        } finally {
            setUpdatingConfig(false);
        }
    };

    // Change Self-Pick Scope (ITEMS | KOTS | BOTH)
    const handleUpdateScope = async (newScope) => {
        setUpdatingConfig(true);
        try {
            const res = await api.put(`/owner/${restaurantId}/kitchen/config`, { scope: newScope });
            if (res.data?.ok) {
                setKitchenConfig((prev) => ({ ...prev, scope: res.data.scope }));
                showToast(`Self-Pick scope changed to ${newScope}`, "success");
            }
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to update self-pick scope", "error");
        } finally {
            setUpdatingConfig(false);
        }
    };

    // Socket Event Handlers
    useEffect(() => {
        if (!socket) return undefined;

        const onKotCreated = (kot) => {
            setKots((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(kot?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((k) => Number(k?.id || 0) === id);
                if (idx === -1) return [kot, ...list];
                const copy = list.slice();
                copy[idx] = kot;
                return copy;
            });
            setLastSyncAt(new Date());

            if (!soundMuted) playNotificationSound();
            showToast({
                title: `New Ticket ${kot?.kotNo || ""}`,
                message: `Station: ${kot?.stationName || "Kitchen"} • Table: ${kot?.tableNo || "Takeaway"}`,
                variant: "info",
                durationMs: 2200,
            });
            loadWorkload();
        };

        const onKotUpdated = (kot) => {
            setKots((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(kot?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((k) => Number(k?.id || 0) === id);
                if (idx === -1) return [kot, ...list];
                const copy = list.slice();
                copy[idx] = kot;
                return copy;
            });
            setLastSyncAt(new Date());
        };

        const onKotItemUpdated = ({ kot }) => {
            if (kot) onKotUpdated(kot);
        };

        const handleKitchenConfigUpdated = (cfg) => {
            if (cfg?.ok) {
                setKitchenConfig({ mode: cfg.mode, scope: cfg.scope });
                showToast(`Kitchen config updated: ${cfg.mode}`, "info");
            }
        };

        const handleKitchenWorkloadUpdated = (data) => {
            if (data?.ok && Array.isArray(data.chefs)) {
                setWorkload({ chefs: data.chefs });
            }
        };

        const handleKitchenAssignmentEvent = () => {
            loadKots({ silent: true });
            loadWorkload();
        };

        const handleNewNotification = (notif) => {
            if (!notif) return;
            const notifKey = notif.id
                ? `id:${notif.id}`
                : (notif.idempotencyKey || notif.data?.idempotencyKey)
                ? `idem:${notif.idempotencyKey || notif.data?.idempotencyKey}`
                : null;

            if (notifKey) {
                const now = Date.now();
                const lastSeen = handledNotificationIdsRef.current.get(notifKey);
                if (handledNotificationIdsRef.current.size > 100) {
                    for (const [k, timestamp] of handledNotificationIdsRef.current.entries()) {
                        if (now - timestamp > 30000) {
                            handledNotificationIdsRef.current.delete(k);
                        }
                    }
                }
                if (lastSeen && now - lastSeen < 10000) {
                    return;
                }
                handledNotificationIdsRef.current.set(notifKey, now);
            }

            fetchUnreadCountRef.current?.();

            if (!soundMuted) {
                playNotificationSound();
            }

            if (notif.title || notif.message) {
                showToast({
                    title: notif.title || "New Notification",
                    message: notif.message || "",
                    variant: "info",
                    durationMs: 3000,
                });
            }
        };

        socket.on("kot_created", onKotCreated);
        socket.on("kot:status_updated", onKotUpdated);
        socket.on("kot:item_updated", onKotItemUpdated);
        socket.on("kot:priority_updated", onKotUpdated);
        socket.on("notification:new", handleNewNotification);

        socket.on("kitchen:config_updated", handleKitchenConfigUpdated);
        socket.on("kitchen:workload_updated", handleKitchenWorkloadUpdated);
        socket.on("kitchen:item_assigned", handleKitchenAssignmentEvent);
        socket.on("kitchen:item_reassigned", handleKitchenAssignmentEvent);
        socket.on("kitchen:item_self_picked", handleKitchenAssignmentEvent);
        socket.on("kitchen:item_status_updated", handleKitchenAssignmentEvent);

        return () => {
            socket.off("kot_created", onKotCreated);
            socket.off("kot:status_updated", onKotUpdated);
            socket.off("kot:item_updated", onKotItemUpdated);
            socket.off("kot:priority_updated", onKotUpdated);
            socket.off("notification:new", handleNewNotification);

            socket.off("kitchen:config_updated", handleKitchenConfigUpdated);
            socket.off("kitchen:workload_updated", handleKitchenWorkloadUpdated);
            socket.off("kitchen:item_assigned", handleKitchenAssignmentEvent);
            socket.off("kitchen:item_reassigned", handleKitchenAssignmentEvent);
            socket.off("kitchen:item_self_picked", handleKitchenAssignmentEvent);
            socket.off("kitchen:item_status_updated", handleKitchenAssignmentEvent);
        };
    }, [socket, soundMuted, loadWorkload, loadKots]);

    // Update KOT Status
    const handleUpdateKotStatus = async (kotId, status) => {
        try {
            setUpdatingKotId(kotId);
            const res = await api.put(`/owner/${restaurantId}/kots/${kotId}/status`, { status });
            if (res.data?.ok && res.data.kot) {
                setKots((prev) => prev.map((k) => (k.id === kotId ? res.data.kot : k)));
                showToast({
                    title: `Ticket ${res.data.kot.kotNo}`,
                    message: `Status updated to ${status}`,
                    variant: "success",
                });
                loadWorkload();
            }
        } catch (err) {
            showToast({
                title: "Status Update Failed",
                message: err?.response?.data?.message || err?.message || "Failed to update KOT status",
                variant: "error",
            });
        } finally {
            setUpdatingKotId(null);
        }
    };

    // Update KOT Item Status
    const handleUpdateItemStatus = async (kotId, itemId, status) => {
        try {
            const res = await api.put(`/owner/${restaurantId}/kots/${kotId}/items/${itemId}/status`, { status });
            if (res.data?.ok && res.data.kot) {
                setKots((prev) => prev.map((k) => (k.id === kotId ? res.data.kot : k)));
                loadWorkload();
            }
        } catch (err) {
            showToast({
                title: "Item Update Failed",
                message: err?.response?.data?.message || err?.message || "Failed to update item status",
                variant: "error",
            });
        }
    };

    // Update Priority
    const handleUpdatePriority = async (kotId, priority) => {
        try {
            const res = await api.put(`/owner/${restaurantId}/kots/${kotId}/priority`, { priority });
            if (res.data?.ok && res.data.kot) {
                setKots((prev) => prev.map((k) => (k.id === kotId ? res.data.kot : k)));
                showToast({
                    title: `Ticket ${res.data.kot.kotNo}`,
                    message: `Priority set to ${priority}`,
                    variant: "info",
                });
            }
        } catch (err) {
            showToast({
                title: "Priority Update Failed",
                message: err?.response?.data?.message || err?.message || "Failed to update priority",
                variant: "error",
            });
        }
    };

    // Reprint KOT
    const handleReprintKot = async (kotId) => {
        try {
            setReprintingKotId(kotId);
            const res = await api.post(`/owner/${restaurantId}/kots/${kotId}/reprint`);
            if (res.data?.ok) {
                showToast({
                    title: "Print Dispatched",
                    message: `KOT #${kotId} print job sent to station printer`,
                    variant: "success",
                });
                loadKots({ silent: true });
            }
        } catch (err) {
            showToast({
                title: "Reprint Failed",
                message: err?.response?.data?.message || err?.message || "Thermal printer communication failed",
                variant: "error",
            });
        } finally {
            setReprintingKotId(null);
        }
    };

    // Drawer Assignment Handlers
    const handleOpenAssignDrawer = (kot) => {
        setDrawerKot(kot);
        setIsDrawerOpen(true);
    };

    const handleAssignItem = async (itemId, chefId) => {
        setIsSubmittingAssignment(true);
        try {
            const res = await api.post(`/owner/${restaurantId}/kitchen/items/${itemId}/assign`, { chefId });
            if (res.data?.ok) {
                showToast("Item assigned successfully", "success");
                await Promise.all([loadKots({ silent: true }), loadWorkload()]);
                // Update active drawer kot items
                setDrawerKot((prev) => {
                    if (!prev) return prev;
                    const items = (prev.items || []).map((it) =>
                        it.id === itemId
                            ? { ...it, assignedChefId: chefId, assignedChefName: res.data.item?.assignedChefName }
                            : it
                    );
                    return { ...prev, items };
                });
            }
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to assign item", "error");
        } finally {
            setIsSubmittingAssignment(false);
        }
    };

    const handleBulkAssign = async (itemIds, chefId) => {
        setIsSubmittingAssignment(true);
        try {
            const res = await api.post(`/owner/${restaurantId}/kitchen/items/bulk-assign`, { itemIds, chefId });
            if (res.data?.ok) {
                showToast(`Assigned ${res.data.count} items`, "success");
                await Promise.all([loadKots({ silent: true }), loadWorkload()]);
                setIsDrawerOpen(false);
            }
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to assign items", "error");
        } finally {
            setIsSubmittingAssignment(false);
        }
    };

    const handleAssignKot = async (kotId, chefId, overwrite) => {
        setIsSubmittingAssignment(true);
        try {
            const res = await api.post(`/owner/${restaurantId}/kitchen/kots/${kotId}/assign`, { chefId, overwriteAssigned: overwrite });
            if (res.data?.ok) {
                showToast(`Assigned ${res.data.count} items in KOT`, "success");
                await Promise.all([loadKots({ silent: true }), loadWorkload()]);
                setIsDrawerOpen(false);
            }
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to assign KOT", "error");
        } finally {
            setIsSubmittingAssignment(false);
        }
    };

    const handleReassignItem = async (itemId, newChefId) => {
        setIsSubmittingAssignment(true);
        try {
            const res = await api.post(`/owner/${restaurantId}/kitchen/items/${itemId}/reassign`, { newChefId });
            if (res.data?.ok) {
                showToast("Item reassigned successfully", "success");
                await Promise.all([loadKots({ silent: true }), loadWorkload()]);
                setIsDrawerOpen(false);
            }
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to reassign item", "error");
        } finally {
            setIsSubmittingAssignment(false);
        }
    };

    // Calculate unassigned items and list for prominent queue
    const unassignedItemsList = useMemo(() => {
        const list = [];
        (kots || []).forEach((k) => {
            if (k.status !== "CANCELLED" && k.status !== "SERVED") {
                (k.items || []).forEach((it) => {
                    if (!it.assignedChefId && it.status !== "CANCELLED" && it.status !== "SERVED") {
                        const elapsedMins = k.createdAt
                            ? Math.max(0, Math.floor((Date.now() - new Date(k.createdAt).getTime()) / 60000))
                            : 0;
                        list.push({
                            ...it,
                            orderId: k.orderId,
                            kotId: k.id,
                            kotNo: k.kotNo,
                            tableNo: k.tableNo,
                            priority: k.priority || "NORMAL",
                            stationName: k.stationName || "Kitchen",
                            elapsedMinutes: elapsedMins,
                        });
                    }
                });
            }
        });
        return list;
    }, [kots]);

    const unassignedItemsCount = unassignedItemsList.length;

    // Total Chef Capacity and Kitchen Utilization
    const totalCapacity = useMemo(() => {
        return (workload.chefs || []).reduce((acc, c) => acc + (Number(c.capacity) || 10), 0) || 10;
    }, [workload.chefs]);

    const totalAssignedItems = useMemo(() => {
        return (workload.chefs || []).reduce((acc, c) => acc + (Number(c.assigned) || 0), 0);
    }, [workload.chefs]);

    const kitchenUtilizationPercent = useMemo(() => {
        return Math.min(100, Math.round((totalAssignedItems / Math.max(1, totalCapacity)) * 100));
    }, [totalAssignedItems, totalCapacity]);

    // Quick Bulk Assignment state & handler
    const [selectedUnassignedItemIds, setSelectedUnassignedItemIds] = useState([]);
    const [bulkTargetChefId, setBulkTargetChefId] = useState("");
    const [isBulkAssigning, setIsBulkAssigning] = useState(false);

    const handleQuickBulkAssign = async () => {
        if (!bulkTargetChefId) {
            showToast("Please select a target chef to assign to", "warning");
            return;
        }
        if (!selectedUnassignedItemIds.length) {
            showToast("Please select at least one unassigned item", "warning");
            return;
        }
        setIsBulkAssigning(true);
        try {
            await handleBulkAssign(selectedUnassignedItemIds, Number(bulkTargetChefId));
            setSelectedUnassignedItemIds([]);
            setBulkTargetChefId("");
        } catch (err) {
            showToast(err?.message || "Failed to bulk assign items", "error");
        } finally {
            setIsBulkAssigning(false);
        }
    };

    // Filter KOTs
    const filteredKots = useMemo(() => {
        let list = Array.isArray(kots) ? kots : [];

        // Station Filter
        if (selectedStationId !== "ALL") {
            list = list.filter((k) => String(k.stationId || "") === String(selectedStationId));
        }

        // Priority Filter
        if (selectedPriority !== "ALL") {
            list = list.filter((k) => String(k.priority || "NORMAL").toUpperCase() === selectedPriority);
        }

        // Status Filter
        if (selectedStatus !== "ALL") {
            list = list.filter((k) => String(k.status || "").toUpperCase() === selectedStatus);
        }

        // Chef Filter (ALL | UNASSIGNED | specific chefId)
        if (selectedChefFilter === "UNASSIGNED") {
            list = list.filter((k) =>
                (k.items || []).some((it) => !it.assignedChefId && it.status !== "CANCELLED" && it.status !== "SERVED")
            );
        } else if (selectedChefFilter !== "ALL") {
            list = list.filter((k) =>
                (k.items || []).some((it) => String(it.assignedChefId) === String(selectedChefFilter))
            );
        }

        // Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter((k) => {
                const matchNo = String(k.kotNo || "").toLowerCase().includes(q);
                const matchTable = String(k.tableNo || "").toLowerCase().includes(q);
                const matchOrder = String(k.orderId || "").toLowerCase().includes(q);
                const matchItem = Array.isArray(k.items) && k.items.some((it) =>
                    String(it.itemName || it.name || "").toLowerCase().includes(q) ||
                    String(it.assignedChefName || "").toLowerCase().includes(q)
                );
                return matchNo || matchTable || matchOrder || matchItem;
            });
        }

        return list;
    }, [kots, selectedStationId, selectedPriority, selectedStatus, selectedChefFilter, searchQuery]);

    // Group filtered KOTs into NEW, PREPARING, READY columns
    const groupedKots = useMemo(() => {
        const groups = { NEW: [], PREPARING: [], READY: [] };
        filteredKots.forEach((kot) => {
            const status = String(kot.status || "").toUpperCase();
            if (status === "PENDING" || status === "ACCEPTED" || status === "PRINTED" || status === "PRINT_FAILED") {
                groups.NEW.push(kot);
            } else if (status === "PREPARING") {
                groups.PREPARING.push(kot);
            } else if (status === "READY") {
                groups.READY.push(kot);
            }
        });
        return groups;
    }, [filteredKots]);

    // Quick Metrics
    const metrics = useMemo(() => {
        const list = Array.isArray(kots) ? kots : [];
        const newCount = list.filter((k) => ["PENDING", "ACCEPTED", "PRINTED"].includes(k.status)).length;
        const prepCount = list.filter((k) => k.status === "PREPARING").length;
        const readyCount = list.filter((k) => k.status === "READY").length;
        const urgentCount = list.filter((k) => k.priority === "URGENT" && k.status !== "SERVED" && k.status !== "CANCELLED").length;

        let pendingItemsCount = 0;
        let overdueCount = 0;
        let delayedItemsCount = 0;
        list.forEach((k) => {
            if (["PENDING", "ACCEPTED", "PRINTED"].includes(k.status)) {
                pendingItemsCount += (k.items || []).filter((it) => it.status !== "CANCELLED" && it.status !== "SERVED").length;
            }
            if (k.status !== "SERVED" && k.status !== "CANCELLED") {
                const sla = getSlaStatus(k.createdAt, k.estimatedPrepTimeMinutes);
                if (sla.label === "OVERDUE") {
                    overdueCount += 1;
                    delayedItemsCount += (k.items || []).filter((it) => it.status !== "CANCELLED" && it.status !== "SERVED").length;
                }
            }
        });

        const activeChefsCount = (workload.chefs || []).filter((c) => (c.assigned || 0) > 0 || (c.preparing || 0) > 0).length;

        return {
            newCount,
            pendingItemsCount,
            prepCount,
            readyCount,
            urgentCount,
            overdueCount,
            delayedItemsCount,
            activeChefsCount,
        };
    }, [kots, workload.chefs]);

    return (
        <div className="min-h-screen bg-slate-50/40 text-slate-900 font-sans">
            {/* Top Bar Header */}
            <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <ChefHat className="text-orange-500 shrink-0" size={24} />
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl flex items-center gap-2">
                                        <span>Senior Chef Command Center</span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                                            Senior Chef Dashboard
                                        </span>
                                    </h1>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                                        {restaurantName}
                                    </span>
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        LIVE OPERATIONS
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    Kitchen Operations KDS · Authoritative Chef Dispatcher · Dynamic Self-Pick · Live Workloads & SLAs
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mode Toggle & Header Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Assignment Mode Controls */}
                        <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs">
                            <button
                                type="button"
                                disabled={updatingConfig}
                                onClick={() => handleUpdateMode("DISPATCHER")}
                                className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                                    kitchenConfig.mode === "DISPATCHER"
                                        ? "bg-orange-500 text-white shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                DISPATCHER
                            </button>
                            <button
                                type="button"
                                disabled={updatingConfig}
                                onClick={() => handleUpdateMode("SELF_PICK")}
                                className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                                    kitchenConfig.mode === "SELF_PICK"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                SELF-PICK
                            </button>
                        </div>

                        {/* Scope Controls when SELF_PICK */}
                        {kitchenConfig.mode === "SELF_PICK" && (
                            <div className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50/60 p-0.5 text-xs animate-fade-in">
                                <span className="text-[10px] font-bold text-emerald-800 px-1.5 uppercase">Scope:</span>
                                {["ITEMS", "KOTS", "BOTH"].map((scp) => (
                                    <button
                                        key={scp}
                                        type="button"
                                        disabled={updatingConfig}
                                        onClick={() => handleUpdateScope(scp)}
                                        className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold transition ${
                                            kitchenConfig.scope === scp
                                                ? "bg-emerald-600 text-white shadow-xs"
                                                : "text-emerald-700 hover:bg-emerald-200/50"
                                        }`}
                                    >
                                        {scp}
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                loadKots({ silent: true });
                                loadWorkload();
                            }}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
                        >
                            <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : "text-slate-500"} />
                            Refresh
                        </button>

                        <button
                            type="button"
                            onClick={() => setSoundModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        >
                            {soundMuted ? <BellOff size={13} className="text-slate-400" /> : <Bell size={13} className="text-orange-500" />}
                            {soundMuted ? "Muted" : "Alert On"}
                        </button>

                        {/* Notifications Button */}
                        <button
                            type="button"
                            onClick={() => {
                                if (viewMode === "NOTIFICATIONS") {
                                    setViewMode("KDS");
                                    navigate("/kitchen");
                                } else {
                                    setViewMode("NOTIFICATIONS");
                                    navigate("/kitchen/notifications");
                                }
                            }}
                            className={`relative flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-xs ${
                                viewMode === "NOTIFICATIONS"
                                    ? "border-orange-500 bg-orange-500 text-white"
                                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                            }`}
                            title="Kitchen Notifications"
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
                            type="button"
                            onClick={() => {
                                if (viewMode === "PROFILE") {
                                    setViewMode("KDS");
                                    navigate("/kitchen");
                                } else {
                                    setViewMode("PROFILE");
                                    navigate("/kitchen/profile");
                                }
                            }}
                            className={`flex items-center gap-1.5 rounded-xl border px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-xs ${
                                viewMode === "PROFILE"
                                    ? "border-orange-500 bg-orange-500 text-white"
                                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                            }`}
                            title="My Profile"
                        >
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                                viewMode === "PROFILE" ? "bg-white text-orange-600" : "bg-orange-500 text-white"
                            }`}>
                                {(user?.name || user?.username || "C").charAt(0).toUpperCase()}
                            </div>
                            <span className="hidden sm:inline font-bold">{user?.name?.split(" ")[0] || "Profile"}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Body */}
            {viewMode === "PROFILE" ? (
                <div className="flex-1 p-3 sm:p-4 max-w-7xl mx-auto w-full">
                    <ServerProfileView
                        onBackToFloorPlan={() => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                        }}
                        onBack={() => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                        }}
                        backLabel="Kitchen"
                        title="Kitchen Profile"
                    />
                </div>
            ) : viewMode === "NOTIFICATIONS" ? (
                <div className="flex-1 p-3 sm:p-4 max-w-7xl mx-auto w-full">
                    <ServerNotificationsView
                        onUnreadCountChange={setUnreadNotificationCount}
                        onNavigateToTable={(tableNo) => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                            if (tableNo) setSearchQuery(String(tableNo));
                        }}
                        onBackToFloorPlan={() => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                        }}
                        onBack={() => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                        }}
                        backLabel="Kitchen"
                    />
                </div>
            ) : (
                <>
                    {/* TOP KPI / SUMMARY AREA */}
                    <div className="px-4 pt-4 sm:px-6">
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                            {/* 1. New Orders / Pending Items */}
                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                                <div className="flex items-center justify-between text-slate-500 mb-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">New Orders</span>
                                    <Clock3 size={15} className="text-blue-500" />
                                </div>
                                <div className="text-xl font-black text-slate-900">{metrics.newCount}</div>
                                <div className="text-[10px] text-slate-400 font-medium truncate">
                                    {metrics.pendingItemsCount} pending items
                                </div>
                            </div>

                            {/* 2. Unassigned Items */}
                            <div className={`rounded-xl border p-3 shadow-xs transition-all ${
                                unassignedItemsCount > 0
                                    ? "border-amber-300 bg-amber-50/60 ring-1 ring-amber-300/50"
                                    : "border-slate-200 bg-white"
                            }`}>
                                <div className="flex items-center justify-between text-slate-500 mb-1">
                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${
                                        unassignedItemsCount > 0 ? "text-amber-800" : "text-slate-500"
                                    }`}>
                                        Unassigned
                                    </span>
                                    <UserCheck size={15} className={unassignedItemsCount > 0 ? "text-amber-600" : "text-slate-400"} />
                                </div>
                                <div className={`text-xl font-black ${
                                    unassignedItemsCount > 0 ? "text-amber-900" : "text-slate-900"
                                }`}>
                                    {unassignedItemsCount}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium truncate">
                                    {unassignedItemsCount > 0 ? "Needs Dispatch" : "All Assigned"}
                                </div>
                            </div>

                            {/* 3. Preparing */}
                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                                <div className="flex items-center justify-between text-slate-500 mb-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Preparing</span>
                                    <Flame size={15} className="text-orange-500" />
                                </div>
                                <div className="text-xl font-black text-slate-900">{metrics.prepCount}</div>
                                <div className="text-[10px] text-slate-400 font-medium truncate">Active on line</div>
                            </div>

                            {/* 4. Ready */}
                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                                <div className="flex items-center justify-between text-slate-500 mb-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Ready</span>
                                    <CheckCircle2 size={15} className="text-emerald-500" />
                                </div>
                                <div className="text-xl font-black text-slate-900">{metrics.readyCount}</div>
                                <div className="text-[10px] text-slate-400 font-medium truncate">Awaiting pickup</div>
                            </div>

                            {/* 5. Overdue */}
                            <div className={`rounded-xl border p-3 shadow-xs transition-all ${
                                metrics.overdueCount > 0
                                    ? "border-red-300 bg-red-50/70 ring-1 ring-red-300/50"
                                    : "border-slate-200 bg-white"
                            }`}>
                                <div className="flex items-center justify-between text-slate-500 mb-1">
                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${
                                        metrics.overdueCount > 0 ? "text-red-800" : "text-slate-500"
                                    }`}>
                                        Overdue
                                    </span>
                                    <AlertTriangle size={15} className={metrics.overdueCount > 0 ? "text-red-600" : "text-slate-400"} />
                                </div>
                                <div className={`text-xl font-black ${
                                    metrics.overdueCount > 0 ? "text-red-900" : "text-slate-900"
                                }`}>
                                    {metrics.overdueCount}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium truncate">
                                    {metrics.overdueCount > 0 ? "Exceeded SLA" : "Within target"}
                                </div>
                            </div>

                            {/* 6. Active Chefs */}
                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                                <div className="flex items-center justify-between text-slate-500 mb-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Active Chefs</span>
                                    <Users size={15} className="text-indigo-500" />
                                </div>
                                <div className="text-xl font-black text-slate-900">
                                    {workload.chefs?.length || 0}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium truncate">
                                    {metrics.activeChefsCount} cooking now
                                </div>
                            </div>

                            {/* 7. Chef Capacity */}
                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                                <div className="flex items-center justify-between text-slate-500 mb-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Capacity</span>
                                    <Zap size={15} className="text-purple-500" />
                                </div>
                                <div className="text-xl font-black text-slate-900">
                                    {totalAssignedItems}/{totalCapacity}
                                </div>
                                <div className="mt-1 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                            kitchenUtilizationPercent >= 90
                                                ? "bg-rose-500"
                                                : kitchenUtilizationPercent >= 70
                                                ? "bg-amber-500"
                                                : "bg-emerald-500"
                                        }`}
                                        style={{ width: `${Math.min(100, kitchenUtilizationPercent)}%` }}
                                    />
                                </div>
                            </div>

                            {/* 8. SLA / Delayed Work */}
                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                                <div className="flex items-center justify-between text-slate-500 mb-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">SLA Delays</span>
                                    <ShieldAlert size={15} className={metrics.delayedItemsCount > 0 ? "text-amber-500" : "text-emerald-500"} />
                                </div>
                                <div className="text-xl font-black text-slate-900">
                                    {metrics.delayedItemsCount}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium truncate">
                                    {metrics.urgentCount} urgent tickets
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CHEF WORKLOAD PANEL */}
                    <div className="px-4 pt-3 sm:px-6">
                        <ChefWorkloadPanel
                            chefs={workload.chefs}
                            selectedChefId={selectedChefFilter}
                            onSelectChef={setSelectedChefFilter}
                            unassignedCount={unassignedItemsCount}
                            loading={loading}
                        />
                    </div>

                    {/* DEDICATED UNASSIGNED WORK QUEUE */}
                    <div className="px-4 pt-3 sm:px-6">
                        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                            <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/70">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                                        Unassigned Work Queue
                                    </h2>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800 border border-amber-200">
                                        {unassignedItemsCount} items
                                    </span>
                                </div>

                                {unassignedItemsCount > 0 && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedUnassignedItemIds.length === unassignedItemsList.length) {
                                                    setSelectedUnassignedItemIds([]);
                                                } else {
                                                    setSelectedUnassignedItemIds(unassignedItemsList.map((it) => it.id));
                                                }
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                                        >
                                            {selectedUnassignedItemIds.length === unassignedItemsList.length ? (
                                                <>
                                                    <CheckSquare size={13} className="text-orange-600" /> Deselect All
                                                </>
                                            ) : (
                                                <>
                                                    <Square size={13} className="text-slate-400" /> Select All
                                                </>
                                            )}
                                        </button>

                                        <select
                                            value={bulkTargetChefId}
                                            onChange={(e) => setBulkTargetChefId(e.target.value)}
                                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">Select Target Chef...</option>
                                            {(workload.chefs || []).map((c) => (
                                                <option key={c.chefId} value={String(c.chefId)}>
                                                    {c.chefName} ({c.assigned} active)
                                                </option>
                                            ))}
                                        </select>

                                        <button
                                            type="button"
                                            disabled={!selectedUnassignedItemIds.length || !bulkTargetChefId || isBulkAssigning}
                                            onClick={handleQuickBulkAssign}
                                            className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1 text-xs font-black text-white hover:bg-orange-700 disabled:opacity-40 transition shadow-xs"
                                        >
                                            {isBulkAssigning ? <LoaderCircle size={13} className="animate-spin" /> : <UserCheck size={13} />}
                                            BULK DISPATCH ({selectedUnassignedItemIds.length})
                                        </button>
                                    </div>
                                )}
                            </div>

                            {unassignedItemsList.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400 font-medium">
                                    All kitchen items are currently assigned to chefs. Great job!
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            <tr>
                                                <th className="py-2 px-3 w-8">
                                                    <input
                                                        type="checkbox"
                                                        aria-label="Select all unassigned items"
                                                        checked={
                                                            selectedUnassignedItemIds.length > 0 &&
                                                            selectedUnassignedItemIds.length === unassignedItemsList.length
                                                        }
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedUnassignedItemIds(unassignedItemsList.map((it) => it.id));
                                                            } else {
                                                                setSelectedUnassignedItemIds([]);
                                                            }
                                                        }}
                                                        className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                    />
                                                </th>
                                                <th className="py-2 px-3">Ticket / Order</th>
                                                <th className="py-2 px-3">Table</th>
                                                <th className="py-2 px-3">Item</th>
                                                <th className="py-2 px-3">Qty</th>
                                                <th className="py-2 px-3">Priority</th>
                                                <th className="py-2 px-3">Wait Time</th>
                                                <th className="py-2 px-3">Station</th>
                                                <th className="py-2 px-3">Status</th>
                                                <th className="py-2 px-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {unassignedItemsList.map((it) => {
                                                const isSelected = selectedUnassignedItemIds.includes(it.id);
                                                return (
                                                    <tr
                                                        key={`unassigned-${it.id}`}
                                                        className={`hover:bg-slate-50/80 transition-colors ${
                                                            isSelected ? "bg-orange-50/40" : ""
                                                        }`}
                                                    >
                                                        <td className="py-2.5 px-3">
                                                            <input
                                                                type="checkbox"
                                                                aria-label={`Select ${it.itemName || it.name}`}
                                                                checked={isSelected}
                                                                onChange={() => {
                                                                    setSelectedUnassignedItemIds((prev) =>
                                                                        isSelected ? prev.filter((id) => id !== it.id) : [...prev, it.id]
                                                                    );
                                                                }}
                                                                className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                                            <span>#{it.kotNo || it.kotId}</span>
                                                            <span className="text-[10px] text-slate-400 block font-normal">
                                                                Order #{it.orderId}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                                                            Table {it.tableNo || "-"}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-bold text-slate-900">
                                                            {it.itemName || it.name || "Item"}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-black text-slate-700">
                                                            {it.quantity || it.qty || 1}x
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold ${priorityBadgeClass(it.priority)}`}>
                                                                {it.priority}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-medium">
                                                            {formatAge(it.elapsedMinutes)}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                                            {it.stationName || "Kitchen"}
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                                                {it.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (bulkTargetChefId) {
                                                                        handleAssignItem(it.id, Number(bulkTargetChefId));
                                                                    } else {
                                                                        const targetKot = kots.find((k) => k.id === it.kotId);
                                                                        if (targetKot) handleOpenAssignDrawer(targetKot);
                                                                        else showToast("Select a chef or open KOT drawer", "info");
                                                                    }
                                                                }}
                                                                className="inline-flex items-center gap-1 rounded bg-orange-100 hover:bg-orange-200 text-orange-800 font-bold px-2 py-0.5 text-[11px] transition"
                                                            >
                                                                Dispatch
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Filter Bar & Controls */}
                    <div className="border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6 mt-3">
                        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                {/* Station Filter */}
                                <div className="flex items-center gap-1 text-slate-500 font-semibold">
                                    Station:
                                </div>
                                <select
                                    value={selectedStationId}
                                    onChange={(e) => setSelectedStationId(e.target.value)}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
                                >
                                    <option value="ALL">ALL STATIONS ({kots.length})</option>
                                    {stations.map((st) => (
                                        <option key={st.id} value={String(st.id)}>
                                            {st.name}
                                        </option>
                                    ))}
                                </select>

                                <span className="text-slate-300">|</span>

                                {/* Chef Filter Dropdown */}
                                <div className="flex items-center gap-1 text-slate-500 font-semibold">
                                    <UserCheck size={13} className="text-orange-500" /> Chef:
                                </div>
                                <select
                                    value={selectedChefFilter}
                                    onChange={(e) => setSelectedChefFilter(e.target.value)}
                                    className={`rounded-lg border px-2 py-1 text-xs font-bold outline-none ${
                                        selectedChefFilter === "UNASSIGNED"
                                            ? "border-amber-400 bg-amber-50 text-amber-800"
                                            : selectedChefFilter !== "ALL"
                                            ? "border-orange-400 bg-orange-50 text-orange-800"
                                            : "border-slate-200 bg-slate-50 text-slate-700"
                                    }`}
                                >
                                    <option value="ALL">ALL CHEFS</option>
                                    <option value="UNASSIGNED">UNASSIGNED ONLY ({unassignedItemsCount})</option>
                                    {workload.chefs.map((c) => (
                                        <option key={c.chefId} value={String(c.chefId)}>
                                            {c.chefName} ({c.assigned} assigned)
                                        </option>
                                    ))}
                                </select>

                                <span className="text-slate-300">|</span>

                                {/* Priority Filter */}
                                <div className="flex items-center gap-1 text-slate-500 font-semibold">
                                    <Filter size={13} /> Priority:
                                </div>
                                <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                    {PRIORITIES.map((prio) => (
                                        <button
                                            key={prio}
                                            type="button"
                                            onClick={() => setSelectedPriority(prio)}
                                            className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-all ${
                                                selectedPriority === prio
                                                    ? "bg-orange-500 text-white shadow-xs"
                                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                            }`}
                                        >
                                            {prio}
                                        </button>
                                    ))}
                                </div>

                                <span className="text-slate-300">|</span>

                                {/* Status Filter */}
                                <div className="flex items-center gap-1 text-slate-500 font-semibold">
                                    Status:
                                </div>
                                <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                    {KOT_STATUSES.map((st) => (
                                        <button
                                            key={st}
                                            type="button"
                                            onClick={() => setSelectedStatus(st)}
                                            className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-all ${
                                                selectedStatus === st
                                                    ? "bg-orange-500 text-white shadow-xs"
                                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Instant Search Input */}
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-xs sm:w-64 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500">
                                <Search size={14} className="text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search KOT#, Table#, Chef..."
                                    className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
                                />
                                {searchQuery && (
                                    <button type="button" onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main KDS Columns View */}
                    <main className="p-4 sm:p-6">
                        {error && (
                            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-20 text-slate-500 text-sm">
                                <LoaderCircle size={20} className="animate-spin text-orange-500" />
                                Loading Kitchen Display System...
                            </div>
                        ) : filteredKots.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-16 text-slate-500 shadow-sm">
                                <UtensilsCrossed size={32} className="text-slate-400" />
                                <p className="text-sm font-semibold text-slate-700">No active kitchen tickets match this filter</p>
                                <p className="text-xs text-slate-400">Try switching your chef filter, priority, or search parameters.</p>
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-3 items-start">
                                {/* COLUMN 1: NEW / PENDING */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                                            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-800">NEW ORDERS</h2>
                                        </div>
                                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                                            {groupedKots.NEW.length}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {groupedKots.NEW.map((kot) => (
                                            <KotCard
                                                key={kot.id}
                                                kot={kot}
                                                updatingKotId={updatingKotId}
                                                reprintingKotId={reprintingKotId}
                                                onUpdateKotStatus={handleUpdateKotStatus}
                                                onUpdateItemStatus={handleUpdateItemStatus}
                                                onUpdatePriority={handleUpdatePriority}
                                                onReprintKot={handleReprintKot}
                                                onOpenAssignDrawer={handleOpenAssignDrawer}
                                            />
                                        ))}
                                        {groupedKots.NEW.length === 0 && (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400 italic">
                                                No new tickets waiting
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* COLUMN 2: PREPARING */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Flame size={14} className="text-orange-500" />
                                            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-800">PREPARING</h2>
                                        </div>
                                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700 border border-orange-200">
                                            {groupedKots.PREPARING.length}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {groupedKots.PREPARING.map((kot) => (
                                            <KotCard
                                                key={kot.id}
                                                kot={kot}
                                                updatingKotId={updatingKotId}
                                                reprintingKotId={reprintingKotId}
                                                onUpdateKotStatus={handleUpdateKotStatus}
                                                onUpdateItemStatus={handleUpdateItemStatus}
                                                onUpdatePriority={handleUpdatePriority}
                                                onReprintKot={handleReprintKot}
                                                onOpenAssignDrawer={handleOpenAssignDrawer}
                                            />
                                        ))}
                                        {groupedKots.PREPARING.length === 0 && (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400 italic">
                                                No tickets in preparation
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* COLUMN 3: READY */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={14} className="text-emerald-500" />
                                            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-800">READY</h2>
                                        </div>
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                            {groupedKots.READY.length}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {groupedKots.READY.map((kot) => (
                                            <KotCard
                                                key={kot.id}
                                                kot={kot}
                                                updatingKotId={updatingKotId}
                                                reprintingKotId={reprintingKotId}
                                                onUpdateKotStatus={handleUpdateKotStatus}
                                                onUpdateItemStatus={handleUpdateItemStatus}
                                                onUpdatePriority={handleUpdatePriority}
                                                onReprintKot={handleReprintKot}
                                                onOpenAssignDrawer={handleOpenAssignDrawer}
                                            />
                                        ))}
                                        {groupedKots.READY.length === 0 && (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400 italic">
                                                No tickets marked ready
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                </>
            )}

            {/* Kitchen Assignment Drawer */}
            <KitchenAssignmentDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                kot={drawerKot}
                chefs={workload.chefs}
                onAssignItem={handleAssignItem}
                onBulkAssign={handleBulkAssign}
                onAssignKot={handleAssignKot}
                onReassign={handleReassignItem}
                isSubmitting={isSubmittingAssignment}
            />

            {/* Sound Notification Modal */}
            {soundModalOpen ? (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
                    onClick={() => setSoundModalOpen(false)}
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                                    <Bell size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Kitchen Order Audio Alerts</h3>
                                    <p className="text-xs text-slate-500">Sound notification setup for new incoming tickets</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSoundModalOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-3">
                                    {soundMuted ? <VolumeX size={20} className="text-slate-400" /> : <Volume2 size={20} className="text-orange-600" />}
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{soundMuted ? "Audio Chime Muted" : "Audio Chime Active"}</p>
                                        <p className="text-xs text-slate-500">Plays automatically when KOT arrives</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleSoundMute}
                                    className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                                        soundMuted
                                            ? "bg-orange-500 text-white hover:bg-orange-600 shadow-sm"
                                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                    }`}
                                >
                                    {soundMuted ? "Unmute" : "Mute"}
                                </button>
                            </div>

                            <NotificationSoundPicker />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/**
 * Individual KOT Card Component with Item-Level Chef Assignment UI
 */
function KotCard({
    kot,
    updatingKotId,
    reprintingKotId,
    onUpdateKotStatus,
    onUpdateItemStatus,
    onUpdatePriority,
    onReprintKot,
    onOpenAssignDrawer,
}) {
    const sla = getSlaStatus(kot.createdAt, kot.estimatedPrepTimeMinutes);
    const orderSource = kot.order?.orderSource || "POS";
    const items = Array.isArray(kot.items) ? kot.items : [];
    const isUrgent = kot.priority === "URGENT";

    const assignedCount = items.filter((it) => it.assignedChefId).length;
    const allAssigned = items.length > 0 && assignedCount === items.length;

    return (
        <article
            className={`relative rounded-xl border transition-all shadow-sm ${
                isUrgent
                    ? "border-red-300 bg-red-50/20 ring-1 ring-red-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
            }`}
        >
            {/* Header: Ticket No, Station, Priority, Source & Assignment Badge */}
            <div className="border-b border-slate-100 p-3.5 pb-2.5">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-base font-bold text-slate-900">{kot.kotNo}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${sourceBadgeClass(orderSource)}`}>
                                {orderSource}
                            </span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityBadgeClass(kot.priority)}`}>
                                {kot.priority || "NORMAL"}
                            </span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                                allAssigned
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : assignedCount > 0
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}>
                                {assignedCount}/{items.length} Assigned
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 font-medium">
                            Station: <strong className="text-slate-900">{kot.stationName || "MAIN KITCHEN"}</strong>
                            {kot.tableNo ? ` • Table ${kot.tableNo}` : " • Takeaway"}
                        </p>
                    </div>

                    {/* SLA Prep Timer Badge & Assign Button */}
                    <div className="text-right flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sla.badgeClass}`}>
                            <Clock3 size={11} />
                            {sla.label} ({sla.elapsed}m / {kot.estimatedPrepTimeMinutes || 15}m)
                        </span>

                        <button
                            type="button"
                            onClick={() => onOpenAssignDrawer && onOpenAssignDrawer(kot)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 py-0.5 rounded transition border border-orange-200"
                        >
                            <ChefHat size={12} />
                            Assign
                        </button>
                    </div>
                </div>

                {kot.reprintCount > 0 && (
                    <div className="mt-2 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                        *** REPRINT #{kot.reprintCount} ***
                    </div>
                )}
            </div>

            {/* Items Checklist with Chef Assignment Chips */}
            <div className="divide-y divide-slate-100 px-3.5 py-1">
                {items.map((it) => {
                    const isCancelled = it.status === "CANCELLED";
                    const isReady = it.status === "READY";
                    const isPrep = it.status === "PREPARING";
                    const isAssigned = Boolean(it.assignedChefId);

                    return (
                        <div
                            key={it.id}
                            className={`py-2 transition text-xs flex items-start justify-between gap-2 ${
                                isCancelled ? "opacity-50" : ""
                            }`}
                        >
                            <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 text-sm flex-wrap">
                                    <span className="text-orange-600 font-bold">{it.qty || it.quantity || 1}×</span>
                                    <span className={`text-slate-900 font-medium ${isCancelled ? "line-through text-slate-400" : ""}`}>
                                        {it.itemName || it.name}
                                    </span>

                                    {/* Assignment Chip */}
                                    {isAssigned ? (
                                        <button
                                            type="button"
                                            onClick={() => onOpenAssignDrawer && onOpenAssignDrawer(kot)}
                                            className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 hover:bg-orange-100 hover:text-orange-800 transition flex items-center gap-1 border border-slate-200"
                                            title="Click to reassign"
                                        >
                                            <ChefHat size={10} className="text-orange-500" />
                                            <span>{it.assignedChefName || `Chef #${it.assignedChefId}`}</span>
                                            <span className="text-[9px] text-slate-400">({it.assignmentSource === "SELF_PICKED" ? "SELF" : "DISP"})</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onOpenAssignDrawer && onOpenAssignDrawer(kot)}
                                            className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                                            title="Click to assign"
                                        >
                                            UNASSIGNED
                                        </button>
                                    )}
                                </div>

                                {(it.variantName || it.variant) && (
                                    <div className="text-[11px] text-slate-500">
                                        Variant: <span className="text-slate-700 font-medium">{it.variantName || it.variant}</span>
                                    </div>
                                )}

                                {Array.isArray(it.selectedModifiers) && it.selectedModifiers.length > 0 && (
                                    <div className="text-[11px] text-slate-500 space-y-0.5 pl-2 border-l border-slate-200">
                                        {it.selectedModifiers.map((mod, idx) => (
                                            <div key={idx}>+ {typeof mod === "string" ? mod : mod.name || mod.modifierName}</div>
                                        ))}
                                    </div>
                                )}

                                {it.notes && (
                                    <div className="text-[11px] text-amber-700 font-medium italic">
                                        Note: {it.notes}
                                    </div>
                                )}
                            </div>

                            {/* Item Status Toggle Action */}
                            <button
                                type="button"
                                disabled={isCancelled}
                                onClick={() => {
                                    const next = isPrep ? "READY" : isReady ? "PENDING" : "PREPARING";
                                    onUpdateItemStatus(kot.id, it.id, next);
                                }}
                                className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition shrink-0 ${
                                    isCancelled
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                        : isReady
                                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                        : isPrep
                                        ? "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                }`}
                            >
                                {it.status || "PENDING"}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Actions Bar */}
            <div className="border-t border-slate-100 p-3 bg-slate-50/70 rounded-b-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                    {/* Status Transition Action Buttons */}
                    {kot.status !== "READY" && (
                        <button
                            type="button"
                            disabled={updatingKotId === kot.id}
                            onClick={() => {
                                const next = kot.status === "PREPARING" ? "READY" : "PREPARING";
                                onUpdateKotStatus(kot.id, next);
                            }}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600 transition shadow-sm disabled:opacity-50"
                        >
                            {updatingKotId === kot.id ? (
                                <LoaderCircle size={14} className="animate-spin" />
                            ) : kot.status === "PREPARING" ? (
                                <>
                                    <CheckCircle2 size={14} /> MARK ALL READY
                                </>
                            ) : (
                                <>
                                    <Flame size={14} /> START PREPARING
                                </>
                            )}
                        </button>
                    )}

                    {kot.status === "READY" && (
                        <button
                            type="button"
                            disabled={updatingKotId === kot.id}
                            onClick={() => onUpdateKotStatus(kot.id, "SERVED")}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
                        >
                            {updatingKotId === kot.id ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            SERVE / PASS
                        </button>
                    )}

                    {/* Reprint Action */}
                    <button
                        type="button"
                        disabled={reprintingKotId === kot.id}
                        onClick={() => onReprintKot(kot.id)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        title="Reprint KOT Ticket"
                    >
                        {reprintingKotId === kot.id ? <LoaderCircle size={13} className="animate-spin text-orange-500" /> : <Printer size={13} className="text-slate-500" />}
                        Print
                    </button>
                </div>

                {/* Priority Selector Dropdown */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>Change Priority:</span>
                    <div className="flex items-center gap-1">
                        {["NORMAL", "HIGH", "URGENT"].map((prio) => (
                            <button
                                key={prio}
                                type="button"
                                onClick={() => onUpdatePriority(kot.id, prio)}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                                    kot.priority === prio
                                        ? "bg-orange-500 text-white shadow-sm"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                }`}
                            >
                                {prio}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </article>
    );
}
