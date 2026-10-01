import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";

const formatMoney = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "₹0.00";
    return `₹${amount.toFixed(2)}`;
};

export default function Server() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, logout } = useAuth();
    const { socket } = useStaffSocket();

    const restaurantId = Number(user?.restaurantId || localStorage.getItem("restaurantId") || 1);
    const restaurantName = String(user?.restaurant?.name || "Tiffzy Restaurant").trim();

    // Time ticker for local clock
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Active View Mode: "FLOOR_PLAN" | "ORDERING"
    const [viewMode, setViewMode] = useState("FLOOR_PLAN");

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

    // Compute unique sections
    const sections = useMemo(() => {
        const set = new Set(["ALL"]);
        tables.forEach((t) => {
            const sec = String(t.section || "Main Hall").trim();
            if (sec) set.add(sec);
        });
        return Array.from(set);
    }, [tables]);

    // Socket real-time updates
    useEffect(() => {
        if (!socket) return;
        const handleRealtimeUpdate = () => {
            refreshTables();
            refreshReservations();
        };

        socket.on("table:updated", handleRealtimeUpdate);
        socket.on("table:session_updated", handleRealtimeUpdate);
        socket.on("reservation:updated", handleRealtimeUpdate);
        socket.on("waitlist:updated", handleRealtimeUpdate);

        return () => {
            socket.off("table:updated", handleRealtimeUpdate);
            socket.off("table:session_updated", handleRealtimeUpdate);
            socket.off("reservation:updated", handleRealtimeUpdate);
            socket.off("waitlist:updated", handleRealtimeUpdate);
        };
    }, [socket, refreshTables, refreshReservations]);

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

    // Ordering Actions
    const handleSelectTableForOrder = (table) => {
        if (table.isBlocked) {
            showToast({
                title: "Table Blocked 🔒",
                message: `Table ${table.tableNo} is BLOCKED (${table.blockReason || "Maintenance"}). Unblock table before placing orders.`,
                variant: "warning",
            });
            return;
        }
        setSelectedTable(table);
        setViewMode("ORDERING");
    };

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
            const payload = {
                tableNo: selectedTable.tableNo,
                tableId: selectedTable.id,
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
            <header className="sticky top-0 z-30 border-b border-[color:var(--app-border)]/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                {/* Brand & Branch Info */}
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c3a3] bg-white p-1 shadow-[0_4px_14px_rgba(104,70,37,0.12)]">
                        <BrandLogo className="h-full w-full" title="Tiffzy logo" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-base font-black tracking-tight text-orange-500">
                                Tiffzy
                            </span>
                            <span className="text-sm font-extrabold text-[color:var(--app-muted)]">•</span>
                            <h1 className="text-base font-extrabold tracking-tight text-[color:var(--app-text)]">{restaurantName}</h1>
                            <span className="rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-0.5 text-[10px] font-bold border border-orange-500/30">
                                Server Station
                            </span>
                        </div>
                        <p className="text-[11px] theme-muted flex items-center gap-2">
                            <span>🕒 {currentTime.toLocaleTimeString()}</span>
                            <span>•</span>
                            <span>📅 {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </p>
                    </div>
                </div>

                {/* Meal Shift Selector */}
                <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[color:var(--app-border)]/40">
                    {[
                        { id: "BREAKFAST", label: "🍳 Breakfast", time: `${shiftConfig.breakfast.start}-${shiftConfig.breakfast.end}` },
                        { id: "LUNCH", label: "🍱 Lunch", time: `${shiftConfig.lunch.start}-${shiftConfig.lunch.end}` },
                        { id: "DINNER", label: "🕯️ Dinner", time: `${shiftConfig.dinner.start}-${shiftConfig.dinner.end}` },
                    ].map((shift) => (
                        <button
                            key={shift.id}
                            onClick={() => setActiveShift(shift.id)}
                            className={`flex flex-col items-center rounded-lg px-3 py-1 text-xs font-bold transition ${
                                activeShift === shift.id
                                    ? "bg-orange-500 text-white shadow-sm"
                                    : "theme-muted hover:text-[color:var(--app-text)]"
                            }`}
                        >
                            <span>{shift.label}</span>
                            <span className="text-[9px] opacity-80 font-normal">{shift.time}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => setIsShiftConfigOpen(true)}
                        className="p-1.5 text-slate-400 hover:text-orange-500 rounded-lg transition"
                        title="Configure Shift Timings"
                    >
                        <Settings2 className="h-4 w-4" />
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    {/* Waitlist Drawer Trigger */}
                    <button
                        onClick={() => setIsWaitlistOpen(true)}
                        className="relative flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3.5 py-2 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition cursor-pointer"
                    >
                        <Users className="h-4 w-4" />
                        <span>Waitlist</span>
                        {waitlistSummary.waitingCount > 0 && (
                            <span className="rounded-full bg-orange-500 text-white px-1.5 py-0.2 text-[10px]">
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
                        className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-600 transition shadow-xs cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        <span>New Reservation</span>
                    </button>

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[color:var(--app-border)]/40">
                        <button
                            onClick={() => setViewMode("FLOOR_PLAN")}
                            className={`p-1.5 rounded-lg text-xs font-bold transition ${
                                viewMode === "FLOOR_PLAN" ? "bg-orange-500 text-white" : "theme-muted"
                            }`}
                            title="Floor Plan Grid View"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Body */}
            {viewMode === "FLOOR_PLAN" ? (
                <div className="flex-1 p-4 space-y-4 max-w-7xl mx-auto w-full">
                    {/* Status Summary & Section Filters Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 p-3 shadow-xs text-xs">
                        {/* Section Filter Tabs */}
                        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl overflow-x-auto">
                            {sections.map((sec) => (
                                <button
                                    key={sec}
                                    onClick={() => setActiveSectionFilter(sec)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
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
                        <div className="relative w-full sm:w-60">
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
                        <div className="flex items-center gap-2 text-[11px] overflow-x-auto py-0.5">
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-white dark:bg-slate-800"></span> Available ({statusCounts.available})
                            </span>
                            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span> Reserved ({statusCounts.reserved})
                            </span>
                            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
                                <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span> Occupied ({statusCounts.occupied})
                            </span>
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {filteredTables.map((table) => {
                                const isBlocked = Boolean(table.isBlocked);
                                const isOccupied = Boolean(table.isOccupied);
                                const isReserved = !isOccupied && Boolean(table.isReserved || table.activeReservation);

                                return (
                                    <div
                                        key={table.id}
                                        onClick={() => handleSelectTableForOrder(table)}
                                        className={`group relative flex flex-col justify-between rounded-2xl border p-3 cursor-pointer transition-all duration-200 shadow-xs hover:-translate-y-0.5 aspect-square text-xs bg-white dark:bg-slate-900 ${
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
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-lg font-black tracking-tight text-[color:var(--app-text)]">
                                                    {table.tableNo}
                                                </h3>
                                                <p className="text-[10px] theme-muted">{table.seats} Seats • {table.section || "Main"}</p>
                                            </div>

                                            {/* Status Badge */}
                                            {isBlocked ? (
                                                <span className="flex items-center gap-1 rounded-full bg-slate-700 text-white px-2 py-0.5 text-[9px] font-bold">
                                                    <Lock className="h-2.5 w-2.5" /> BLOCKED
                                                </span>
                                            ) : isOccupied ? (
                                                <span className="rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 px-2 py-0.5 text-[9px] font-bold border border-sky-500/30">
                                                    OCCUPIED
                                                </span>
                                            ) : isReserved ? (
                                                <span className="rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[9px] font-bold border border-purple-500/30">
                                                    RESERVED
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[9px] font-bold border border-emerald-500/30">
                                                    AVAILABLE
                                                </span>
                                            )}
                                        </div>

                                        {/* Table Content Details */}
                                        <div className="my-1 text-[11px] space-y-1">
                                            {isBlocked ? (
                                                <p className="text-slate-600 dark:text-slate-400 italic text-[10px] truncate">
                                                    Reason: {table.blockReason || "Maintenance"}
                                                </p>
                                            ) : isOccupied ? (
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-sky-600 dark:text-sky-400">
                                                        {table.activeOrderCount || 1} Active Order(s)
                                                    </p>
                                                    {table.assignedWaiterName && (
                                                        <p className="text-[10px] theme-muted truncate">Waiter: {table.assignedWaiterName}</p>
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
                                                </div>
                                            ) : (
                                                <p className="text-[10px] theme-muted opacity-75">Click to open table & take order</p>
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
                                                className="theme-muted hover:text-slate-900 dark:hover:text-white font-semibold flex items-center gap-1"
                                            >
                                                {isBlocked ? <Unlock className="h-3 w-3 text-emerald-500" /> : <Lock className="h-3 w-3 text-slate-400" />}
                                                {isBlocked ? "Unblock" : "Block"}
                                            </button>

                                            <div className="flex items-center gap-2">
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
                                                    <span className="font-bold text-orange-500 group-hover:translate-x-0.5 transition">
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
                <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto w-full">
                    {/* Menu Studio Items Column */}
                    <div className="lg:col-span-2 space-y-3">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
                            <div>
                                <h2 className="text-base font-bold flex items-center gap-2">
                                    <span>Ordering for Table {selectedTable?.tableNo}</span>
                                    <span className="text-xs theme-muted">({selectedTable?.seats} Seats)</span>
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`Are you sure you want to free Table ${selectedTable?.tableNo}?`)) {
                                            handleClearTable(selectedTable);
                                        }
                                    }}
                                    className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition flex items-center gap-1"
                                >
                                    <Trash2 className="h-3 w-3" /> Free Table
                                </button>
                                <button
                                    onClick={() => setViewMode("FLOOR_PLAN")}
                                    className="rounded-xl border border-[color:var(--app-border)]/40 px-3 py-1 text-xs font-bold theme-muted hover:bg-black/5"
                                >
                                    ← Back to Floor Plan
                                </button>
                            </div>
                        </div>

                        {/* Menu Categories */}
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                            {menuItems
                                .filter((i) => activeCategory === "ALL" || i.category === activeCategory)
                                .map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleAddToCart(item)}
                                        className="flex flex-col justify-between rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-left hover:border-orange-500 transition shadow-xs"
                                    >
                                        <div>
                                            <p className="font-bold text-xs text-[color:var(--app-text)]">{item.name}</p>
                                            <p className="text-[10px] theme-muted mt-0.5">{item.category}</p>
                                        </div>
                                        <div className="flex justify-between items-center mt-3 pt-1 border-t border-gray-100 dark:border-slate-800">
                                            <span className="font-extrabold text-xs text-orange-500">{formatMoney(item.price)}</span>
                                            <span className="rounded-lg bg-orange-500 text-white p-1 text-[10px] font-bold">
                                                + Add
                                            </span>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Cart & KOT Summary Column */}
                    <div className="rounded-2xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 p-4 space-y-4 shadow-xs flex flex-col justify-between">
                        <div className="space-y-3">
                            <h3 className="font-bold text-sm border-b border-[color:var(--app-border)]/40 pb-2 flex justify-between items-center">
                                <span>Table {selectedTable?.tableNo} Cart</span>
                                <span className="text-xs font-mono font-bold text-orange-500">{Object.keys(cart).length} Items</span>
                            </h3>

                            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                                {Object.values(cart).length === 0 ? (
                                    <p className="text-xs theme-muted text-center py-8">Select menu items on the left to build order.</p>
                                ) : (
                                    Object.values(cart).map((item) => (
                                        <div key={item.id} className="flex justify-between items-center rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2 text-xs">
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                                                <p className="text-[10px] theme-muted">{formatMoney(item.price)} each</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold">x{item.qty}</span>
                                                <span className="font-bold text-orange-500">{formatMoney(item.price * item.qty)}</span>
                                                <button onClick={() => handleRemoveFromCart(item.id)} className="text-red-400 hover:text-red-500">
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
