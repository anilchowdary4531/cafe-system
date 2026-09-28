import { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    Filter,
    History,
    LoaderCircle,
    Plus,
    Printer,
    Search,
    UserCheck,
    UserX,
    Users,
    UtensilsCrossed,
    X,
} from "lucide-react";
import axios from "axios";
import { API } from "../../config";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { showToast } from "../../utils/toast";
import ReservationModal from "../../components/ReservationModal";
import OwnerMenuButton from "../../components/OwnerMenuButton";

export function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return 0;
    const str = timeStr.trim().toUpperCase();
    const isPM = str.includes("PM");
    const isAM = str.includes("AM");
    const cleaned = str.replace(/[^\d:]/g, "");
    const parts = cleaned.split(":");
    let h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
}

export function getEffectiveStatus(res, now = new Date()) {
    if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(res.status)) {
        return res.status;
    }

    const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
    const resDateObj = new Date(res.reservationDate);
    const resDateStr = new Date(resDateObj.getFullYear(), resDateObj.getMonth(), resDateObj.getDate()).toISOString().split("T")[0];

    // Past date
    if (resDateStr < todayStr) {
        return res.status === "SEATED" ? "SEATED" : "EXPIRED";
    }

    // Future date
    if (resDateStr > todayStr) {
        return res.status;
    }

    // Today's date:
    if (res.status === "SEATED") {
        return "SEATED";
    }

    const currentMin = now.getHours() * 60 + now.getMinutes();
    const startMin = timeToMinutes(res.startTime);
    let endMin = timeToMinutes(res.endTime);
    if (endMin <= startMin) endMin += 1440;

    if (currentMin >= endMin) {
        return "EXPIRED";
    }

    return res.status;
}

const readStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
        return {};
    }
};

export default function OwnerReservations() {
    const { socket } = useStaffSocket();
    const user = useMemo(() => readStoredUser(), []);
    const restaurantId = Number(user?.restaurantId || localStorage.getItem("restaurantId") || 1);

    // View Tab: "ACTIVE" | "HISTORY"
    const [viewTab, setViewTab] = useState("ACTIVE");

    // Filter states
    const [activeDateFilter, setActiveDateFilter] = useState("TODAY"); // TODAY | TOMORROW | CUSTOM
    const [historyDateFilter, setHistoryDateFilter] = useState("TODAY"); // TODAY | YESTERDAY | PAST_7_DAYS | ALL_TIME | CUSTOM
    const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);

    const [activeStatusFilter, setActiveStatusFilter] = useState("ALL"); // ALL | CONFIRMED | CHECKED_IN | SEATED
    const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL"); // ALL | EXPIRED | COMPLETED | CANCELLED | NO_SHOW

    const [searchQuery, setSearchQuery] = useState("");

    const [reservations, setReservations] = useState([]);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Current clock ticker for real-time expiry calculation
    const [nowTime, setNowTime] = useState(() => new Date());

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReservation, setEditingReservation] = useState(null);

    // Timer ticker every 15 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setNowTime(new Date());
        }, 15000);
        return () => clearInterval(timer);
    }, []);

    // Compute effective ISO Date or filter param for API query based on active view Tab
    const targetDateParam = useMemo(() => {
        if (viewTab === "ACTIVE") {
            const d = new Date();
            if (activeDateFilter === "TODAY") return d.toISOString().split("T")[0];
            if (activeDateFilter === "TOMORROW") {
                d.setDate(d.getDate() + 1);
                return d.toISOString().split("T")[0];
            }
            if (activeDateFilter === "CUSTOM") return customDate;
            return d.toISOString().split("T")[0];
        } else {
            // HISTORY view
            if (historyDateFilter === "TODAY") return new Date().toISOString().split("T")[0];
            if (historyDateFilter === "YESTERDAY") return "YESTERDAY";
            if (historyDateFilter === "PAST_7_DAYS") return "PAST_7_DAYS";
            if (historyDateFilter === "ALL_TIME") return "ALL_TIME";
            if (historyDateFilter === "CUSTOM") return customDate;
            return new Date().toISOString().split("T")[0];
        }
    }, [viewTab, activeDateFilter, historyDateFilter, customDate]);

    // Fetch Tables and Reservations
    const fetchReservationsAndTables = async () => {
        try {
            setLoading(true);
            const [resResponse, tablesResponse] = await Promise.all([
                axios.get(`${API}/owner/${restaurantId}/reservations`, {
                    params: {
                        date: targetDateParam,
                        search: searchQuery || undefined,
                    },
                }),
                axios.get(`${API}/owner/${restaurantId}/tables`),
            ]);

            if (resResponse.data?.success) {
                setReservations(resResponse.data.reservations || []);
            }
            if (tablesResponse.data) {
                const list = Array.isArray(tablesResponse.data.tables)
                    ? tablesResponse.data.tables
                    : Array.isArray(tablesResponse.data)
                        ? tablesResponse.data
                        : [];
                setTables(list);
            }
        } catch (err) {
            console.error("Failed to fetch reservations:", err);
            setError(err.message || "Failed to load reservations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReservationsAndTables();
    }, [viewTab, targetDateParam, searchQuery]);

    // Socket.IO realtime updates listener
    useEffect(() => {
        if (!socket) return;
        const handleReservationUpdated = () => {
            fetchReservationsAndTables();
        };
        socket.on("reservation:updated", handleReservationUpdated);
        return () => {
            socket.off("reservation:updated", handleReservationUpdated);
        };
    }, [socket, targetDateParam, viewTab]);

    // Compute effective status for all items & split into Active and History lists
    const { activeList, historyList, metrics } = useMemo(() => {
        const active = [];
        const history = [];

        let confirmed = 0;
        let checkedIn = 0;
        let seated = 0;
        let completed = 0;
        let cancelled = 0;
        let noShow = 0;
        let expired = 0;

        for (const res of reservations) {
            const effStatus = getEffectiveStatus(res, nowTime);
            const resWithEff = { ...res, effectiveStatus: effStatus };

            if (effStatus === "CONFIRMED") confirmed++;
            else if (effStatus === "CHECKED_IN") checkedIn++;
            else if (effStatus === "SEATED") seated++;
            else if (effStatus === "COMPLETED") completed++;
            else if (effStatus === "CANCELLED") cancelled++;
            else if (effStatus === "NO_SHOW") noShow++;
            else if (effStatus === "EXPIRED") expired++;

            const isHistory = ["COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"].includes(effStatus);
            if (isHistory) {
                history.push(resWithEff);
            } else {
                active.push(resWithEff);
            }
        }

        return {
            activeList: active,
            historyList: history,
            metrics: {
                total: reservations.length,
                activeCount: active.length,
                historyCount: history.length,
                confirmed,
                checkedIn,
                seated,
                completed,
                cancelled,
                noShow,
                expired,
            },
        };
    }, [reservations, nowTime]);

    // Displayed list based on selected viewTab and status filters
    const displayedReservations = useMemo(() => {
        const baseList = viewTab === "ACTIVE" ? activeList : historyList;
        const statusFilter = viewTab === "ACTIVE" ? activeStatusFilter : historyStatusFilter;

        if (statusFilter === "ALL") return baseList;
        return baseList.filter((r) => r.effectiveStatus === statusFilter);
    }, [viewTab, activeList, historyList, activeStatusFilter, historyStatusFilter]);

    // Action Handlers
    const handleCheckIn = async (res) => {
        try {
            const apiRes = await axios.post(`${API}/owner/${restaurantId}/reservations/${res.id}/check-in`);
            if (apiRes.data?.success) {
                showToast({ title: "Checked In", message: `${res.customerName} checked in.`, variant: "success" });
                fetchReservationsAndTables();
            }
        } catch (err) {
            showToast({ title: "Error", message: err.message || "Check in failed.", variant: "error" });
        }
    };

    const handleSeatGuest = async (res) => {
        if (!res.tableId) {
            showToast({ title: "No Table", message: "Assign a table before seating guest.", variant: "warning" });
            return;
        }

        try {
            const apiRes = await axios.post(`${API}/owner/${restaurantId}/reservations/${res.id}/seat`);
            if (apiRes.data?.success) {
                showToast({
                    title: "Guest Seated!",
                    message: `Seated at Table ${res.table?.tableNo || ""}. Table session active.`,
                    variant: "success",
                });
                fetchReservationsAndTables();
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || "Seating failed.";
            showToast({ title: "Seating Error", message: errMsg, variant: "error" });
        }
    };

    const handleCancel = async (res) => {
        const reason = window.prompt("Reason for cancellation (optional):");
        if (reason === null) return;

        try {
            const apiRes = await axios.post(`${API}/owner/${restaurantId}/reservations/${res.id}/cancel`, {
                cancelReason: reason || null,
            });
            if (apiRes.data?.success) {
                showToast({ title: "Reservation Cancelled", message: `${res.reservationNo} cancelled.`, variant: "info" });
                fetchReservationsAndTables();
            }
        } catch (err) {
            showToast({ title: "Error", message: err.message || "Cancellation failed.", variant: "error" });
        }
    };

    const handleNoShow = async (res) => {
        const confirmed = window.confirm(`Mark ${res.customerName} (${res.reservationNo}) as No-Show?`);
        if (!confirmed) return;

        try {
            const apiRes = await axios.post(`${API}/owner/${restaurantId}/reservations/${res.id}/no-show`);
            if (apiRes.data?.success) {
                showToast({ title: "Marked No-Show", message: `${res.reservationNo} marked as No-Show.`, variant: "warning" });
                fetchReservationsAndTables();
            }
        } catch (err) {
            showToast({ title: "Error", message: err.message || "No-show update failed.", variant: "error" });
        }
    };

    const handlePrintSlip = (res) => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reservation ${res.reservationNo}</title>
                <style>
                    body { font-family: monospace; padding: 20px; max-width: 300px; margin: auto; }
                    .center { text-align: center; }
                    .line { border-bottom: 1px dashed #000; margin: 10px 0; }
                    .flex { display: flex; justify-content: space-between; }
                </style>
            </head>
            <body>
                <div class="center">
                    <h2>TIFFZY RESTAURANT</h2>
                    <h3>RESERVATION SLIP</h3>
                    <p><strong>${res.reservationNo}</strong></p>
                </div>
                <div class="line"></div>
                <p><strong>Customer:</strong> ${res.customerName}</p>
                <p><strong>Phone:</strong> ${res.customerPhone}</p>
                <p><strong>Date:</strong> ${new Date(res.reservationDate).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${res.startTime} - ${res.endTime}</p>
                <p><strong>Guests:</strong> ${res.guestCount}</p>
                <p><strong>Table:</strong> Table ${res.table?.tableNo || "Unassigned"}</p>
                <p><strong>Status:</strong> ${res.effectiveStatus || res.status}</p>
                ${res.notes ? `<p><strong>Notes:</strong> ${res.notes}</p>` : ""}
                <div class="line"></div>
                <p class="center">Thank you for dining with us!</p>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);
    };

    return (
        <div className="min-h-screen bg-[color:var(--app-bg,#f8fafc)] text-[color:var(--app-text,#0f172a)] p-4 space-y-4">
            {/* Page Header with Main Active / History Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--app-border)]/40 pb-3">
                <div className="flex items-center gap-2.5">
                    <OwnerMenuButton />
                    <div className="rounded-xl bg-orange-500/10 p-2 text-orange-500 border border-orange-500/20">
                        <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-[color:var(--app-text)]">
                            Table Reservation Management
                        </h1>
                        <p className="text-xs theme-muted">
                            Manage live table bookings or view past reservation history.
                        </p>
                    </div>
                </div>

                {/* Primary View Mode Tabs: Active vs History */}
                <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[color:var(--app-border)]/40">
                    <button
                        onClick={() => setViewTab("ACTIVE")}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                            viewTab === "ACTIVE"
                                ? "bg-orange-500 text-white shadow-md"
                                : "theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Live Active
                        <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.2 text-[10px]">
                            {metrics.activeCount}
                        </span>
                    </button>

                    <button
                        onClick={() => setViewTab("HISTORY")}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                            viewTab === "HISTORY"
                                ? "bg-orange-500 text-white shadow-md"
                                : "theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                    >
                        <History className="h-3.5 w-3.5" />
                        Reservation History
                        <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.2 text-[10px]">
                            {metrics.historyCount}
                        </span>
                    </button>
                </div>

                {/* New Reservation Button */}
                <button
                    onClick={() => {
                        setEditingReservation(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-600 transition"
                >
                    <Plus className="h-4 w-4" />
                    + New Reservation
                </button>
            </div>

            {/* Metrics Dashboard Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {[
                    { label: "Total", val: metrics.total, color: "text-[color:var(--app-text)]", border: "border-[color:var(--app-border)]/40" },
                    { label: "Confirmed", val: metrics.confirmed, color: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
                    { label: "Checked In", val: metrics.checkedIn, color: "text-sky-600 dark:text-sky-400", border: "border-sky-500/30" },
                    { label: "Seated", val: metrics.seated, color: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
                    { label: "Completed", val: metrics.completed, color: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
                    { label: "Cancelled", val: metrics.cancelled, color: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
                    { label: "No-Show", val: metrics.noShow, color: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
                    { label: "Expired", val: metrics.expired, color: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
                ].map((m, idx) => (
                    <div key={idx} className={`rounded-xl border bg-white dark:bg-slate-900 p-2 text-center shadow-sm ${m.border}`}>
                        <div className="text-[10px] font-bold theme-muted uppercase tracking-wider">{m.label}</div>
                        <div className={`text-lg font-extrabold mt-0.5 ${m.color}`}>{m.val}</div>
                    </div>
                ))}
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 p-2.5 shadow-sm text-xs">
                {/* Date Quick Tabs */}
                <div className="flex flex-wrap items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg border border-[color:var(--app-border)]/40">
                    {viewTab === "ACTIVE" ? (
                        [
                            { id: "TODAY", label: "Today" },
                            { id: "TOMORROW", label: "Tomorrow" },
                            { id: "CUSTOM", label: "Custom Date" },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveDateFilter(tab.id)}
                                className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                                    activeDateFilter === tab.id ? "bg-orange-500 text-white shadow-sm" : "theme-muted hover:text-[color:var(--app-text)]"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))
                    ) : (
                        [
                            { id: "TODAY", label: "Today" },
                            { id: "YESTERDAY", label: "Yesterday" },
                            { id: "PAST_7_DAYS", label: "Past 7 Days" },
                            { id: "ALL_TIME", label: "All Time" },
                            { id: "CUSTOM", label: "Custom Date" },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setHistoryDateFilter(tab.id)}
                                className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                                    historyDateFilter === tab.id ? "bg-orange-500 text-white shadow-sm" : "theme-muted hover:text-[color:var(--app-text)]"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))
                    )}

                    {((viewTab === "ACTIVE" && activeDateFilter === "CUSTOM") || (viewTab === "HISTORY" && historyDateFilter === "CUSTOM")) && (
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="bg-transparent px-2 py-0.5 rounded text-xs font-bold text-[color:var(--app-text)] outline-none border border-[color:var(--app-border)]/40"
                        />
                    )}
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1 text-[11px] overflow-x-auto py-0.5">
                    {viewTab === "ACTIVE"
                        ? ["ALL", "CONFIRMED", "CHECKED_IN", "SEATED"].map((st) => (
                              <button
                                  key={st}
                                  onClick={() => setActiveStatusFilter(st)}
                                  className={`rounded-md px-2 py-1 font-semibold transition ${
                                      activeStatusFilter === st ? "bg-orange-500 text-white shadow-sm" : "theme-muted hover:text-[color:var(--app-text)]"
                                  }`}
                              >
                                  {st}
                              </button>
                          ))
                        : ["ALL", "EXPIRED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((st) => (
                              <button
                                  key={st}
                                  onClick={() => setHistoryStatusFilter(st)}
                                  className={`rounded-md px-2 py-1 font-semibold transition ${
                                      historyStatusFilter === st ? "bg-orange-500 text-white shadow-sm" : "theme-muted hover:text-[color:var(--app-text)]"
                                  }`}
                              >
                                  {st}
                              </button>
                          ))}
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-56">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 theme-muted" />
                    <input
                        type="text"
                        placeholder="Search name, phone, RES#..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-[color:var(--app-border)]/40 bg-transparent pl-8 pr-3 py-1.5 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                    />
                </div>
            </div>

            {/* Reservations Grid Layout */}
            {loading ? (
                <div className="flex justify-center p-10">
                    <LoaderCircle className="h-7 w-7 animate-spin text-orange-500" />
                </div>
            ) : displayedReservations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--app-border)]/60 bg-white/40 dark:bg-slate-900/40 p-10 text-center theme-muted space-y-2">
                    {viewTab === "ACTIVE" ? (
                        <>
                            <Calendar className="h-8 w-8 mx-auto opacity-50 text-emerald-500" />
                            <p className="font-bold text-xs">No active or upcoming reservations found.</p>
                            <p className="text-[11px] opacity-75">All past/expired reservations are available in the Reservation History tab.</p>
                        </>
                    ) : (
                        <>
                            <History className="h-8 w-8 mx-auto opacity-50 text-orange-500" />
                            <p className="font-bold text-xs">No reservation history found for selected date/filter.</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {displayedReservations.map((res) => {
                        const st = res.effectiveStatus || res.status;
                        const isConfirmed = st === "CONFIRMED";
                        const isCheckedIn = st === "CHECKED_IN";
                        const isSeated = st === "SEATED";
                        const isCompleted = st === "COMPLETED";
                        const isCancelled = st === "CANCELLED";
                        const isNoShow = st === "NO_SHOW";
                        const isExpired = st === "EXPIRED";

                        return (
                            <div
                                key={res.id}
                                className={`flex flex-col justify-between rounded-xl border p-3 transition shadow-sm space-y-2 text-xs bg-white dark:bg-slate-900 ${
                                    isSeated
                                        ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20"
                                        : isCheckedIn
                                            ? "border-sky-500/40 bg-sky-500/5 dark:bg-sky-950/20"
                                            : isConfirmed
                                                ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20"
                                                : isCompleted
                                                    ? "border-purple-500/40 bg-purple-500/5 dark:bg-purple-950/20"
                                                    : isExpired
                                                        ? "border-orange-500/40 bg-orange-500/5 dark:bg-orange-950/20 opacity-80"
                                                        : isCancelled || isNoShow
                                                            ? "opacity-60 border-red-500/30 bg-red-500/5 dark:bg-red-950/20"
                                                            : "border-[color:var(--app-border)]/40"
                                }`}
                            >
                                <div className="space-y-1.5">
                                    {/* Top Row: Ref# & Status Badge */}
                                    <div className="flex justify-between items-center">
                                        <strong className="text-xs font-mono text-orange-500 font-bold">{res.reservationNo}</strong>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                            isSeated ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" :
                                            isCheckedIn ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30" :
                                            isConfirmed ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" :
                                            isCompleted ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" :
                                            isExpired ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" :
                                            "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                                        }`}>
                                            {isExpired ? "TIME EXPIRED" : st}
                                        </span>
                                    </div>

                                    {/* Customer & Guest Info */}
                                    <div>
                                        <h4 className="text-sm font-bold text-[color:var(--app-text)] flex items-center justify-between">
                                            <span className="truncate max-w-[150px]">{res.customerName}</span>
                                            <span className="text-[11px] font-normal theme-muted">🪑 {res.guestCount} Guests</span>
                                        </h4>
                                        <p className="text-[11px] theme-muted">📞 {res.customerPhone || "N/A"}</p>
                                    </div>

                                    {/* Time & Table Info Box */}
                                    <div className="rounded-lg border border-[color:var(--app-border)]/40 bg-black/5 dark:bg-white/5 p-2 text-[11px] space-y-0.5">
                                        <div className="flex justify-between theme-muted">
                                            <span>Time Slot:</span>
                                            <strong className="text-orange-500 font-bold">{res.startTime} – {res.endTime}</strong>
                                        </div>
                                        <div className="flex justify-between theme-muted">
                                            <span>Table:</span>
                                            <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{res.table ? `Table ${res.table.tableNo} (${res.table.seats} seats)` : "Unassigned"}</strong>
                                        </div>
                                        {res.notes && (
                                            <div className="text-[10px] theme-muted truncate pt-0.5 border-t border-[color:var(--app-border)]/30">
                                                Note: {res.notes}
                                            </div>
                                        )}
                                        {res.cancelReason && (
                                            <div className="text-[10px] text-red-500 truncate pt-0.5 border-t border-red-500/20">
                                                Reason: {res.cancelReason}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons Footer */}
                                <div className="pt-1.5 border-t border-[color:var(--app-border)]/40 flex flex-wrap gap-1">
                                    {viewTab === "ACTIVE" && isConfirmed && (
                                        <button
                                            onClick={() => handleCheckIn(res)}
                                            className="flex-1 rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-sky-500"
                                        >
                                            Check In
                                        </button>
                                    )}

                                    {viewTab === "ACTIVE" && (isConfirmed || isCheckedIn) && (
                                        <button
                                            onClick={() => handleSeatGuest(res)}
                                            className="flex-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-500"
                                        >
                                            Seat Guest
                                        </button>
                                    )}

                                    {!isCancelled && !isNoShow && !isCompleted && (
                                        <button
                                            onClick={() => {
                                                setEditingReservation(res);
                                                setIsModalOpen(true);
                                            }}
                                            className="rounded-lg border border-[color:var(--app-border)]/40 px-2 py-1 text-[11px] theme-muted hover:bg-black/5 dark:hover:bg-white/5"
                                        >
                                            Edit
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handlePrintSlip(res)}
                                        className="rounded-lg border border-[color:var(--app-border)]/40 px-2 py-1 text-[11px] theme-muted hover:bg-black/5 dark:hover:bg-white/5"
                                        title="Print Slip"
                                    >
                                        <Printer className="h-3 w-3" />
                                    </button>

                                    {viewTab === "ACTIVE" && !isCancelled && !isNoShow && !isSeated && (
                                        <>
                                            <button
                                                onClick={() => handleCancel(res)}
                                                className="rounded-lg border border-red-500/30 text-red-500 px-2 py-1 text-[11px] hover:bg-red-500/10"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleNoShow(res)}
                                                className="rounded-lg border border-rose-500/30 text-rose-500 px-2 py-1 text-[11px] hover:bg-rose-500/10"
                                            >
                                                No-Show
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            <ReservationModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingReservation(null);
                }}
                restaurantId={restaurantId}
                reservationToEdit={editingReservation}
                tables={tables}
                onSaved={() => fetchReservationsAndTables()}
            />
        </div>
    );
}
