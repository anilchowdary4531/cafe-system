import { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    Filter,
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

const toInr = (val) => Number(val || 0).toFixed(2);

export default function OwnerReservations() {
    const { socket } = useStaffSocket();
    const restaurantId = 1; // Default or context restaurant ID

    const [dateFilter, setDateFilter] = useState("TODAY"); // TODAY | TOMORROW | THIS_WEEK | CUSTOM
    const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    const [reservations, setReservations] = useState([]);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReservation, setEditingReservation] = useState(null);

    // Compute effective ISO Date for API query
    const targetDateStr = useMemo(() => {
        const d = new Date();
        if (dateFilter === "TODAY") {
            return d.toISOString().split("T")[0];
        }
        if (dateFilter === "TOMORROW") {
            d.setDate(d.getDate() + 1);
            return d.toISOString().split("T")[0];
        }
        if (dateFilter === "CUSTOM") {
            return customDate;
        }
        return d.toISOString().split("T")[0];
    }, [dateFilter, customDate]);

    // Fetch Tables and Reservations
    const fetchReservationsAndTables = async () => {
        try {
            setLoading(true);
            const [resResponse, tablesResponse] = await Promise.all([
                axios.get(`${API}/owner/${restaurantId}/reservations`, {
                    params: {
                        date: targetDateStr,
                        status: statusFilter,
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
    }, [targetDateStr, statusFilter, searchQuery]);

    // Socket.IO realtime updates listener
    useEffect(() => {
        if (!socket) return;
        const handleReservationUpdated = (updated) => {
            fetchReservationsAndTables();
        };
        socket.on("reservation:updated", handleReservationUpdated);
        return () => {
            socket.off("reservation:updated", handleReservationUpdated);
        };
    }, [socket, targetDateStr]);

    // Summary Metrics
    const metrics = useMemo(() => {
        const total = reservations.length;
        const confirmed = reservations.filter((r) => r.status === "CONFIRMED").length;
        const checkedIn = reservations.filter((r) => r.status === "CHECKED_IN").length;
        const seated = reservations.filter((r) => r.status === "SEATED").length;
        const completed = reservations.filter((r) => r.status === "COMPLETED").length;
        const cancelled = reservations.filter((r) => r.status === "CANCELLED").length;
        const noShow = reservations.filter((r) => r.status === "NO_SHOW").length;

        return { total, confirmed, checkedIn, seated, completed, cancelled, noShow };
    }, [reservations]);

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
                <p><strong>Status:</strong> ${res.status}</p>
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
        <div className="min-h-screen bg-[#090d16] text-white p-6 space-y-6">
            {/* Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-orange-400" />
                        Table Reservation Management
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        Manage table bookings, check-in guests, seat reservations, and prevent double booking conflicts.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingReservation(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-extrabold text-black shadow-lg hover:bg-orange-400 transition"
                >
                    <Plus className="h-5 w-5" />
                    + New Reservation
                </button>
            </div>

            {/* Metrics Dashboard Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                    { label: "Total", val: metrics.total, color: "text-gray-200", border: "border-white/10" },
                    { label: "Confirmed", val: metrics.confirmed, color: "text-amber-400", border: "border-amber-500/30" },
                    { label: "Checked In", val: metrics.checkedIn, color: "text-sky-400", border: "border-sky-500/30" },
                    { label: "Seated", val: metrics.seated, color: "text-emerald-400", border: "border-emerald-500/30" },
                    { label: "Completed", val: metrics.completed, color: "text-purple-400", border: "border-purple-500/30" },
                    { label: "Cancelled", val: metrics.cancelled, color: "text-red-400", border: "border-red-500/30" },
                    { label: "No-Show", val: metrics.noShow, color: "text-rose-400", border: "border-rose-500/30" },
                ].map((m, idx) => (
                    <div key={idx} className={`rounded-2xl border bg-slate-900/60 p-3.5 text-center ${m.border}`}>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{m.label}</div>
                        <div className={`text-2xl font-black mt-1 ${m.color}`}>{m.val}</div>
                    </div>
                ))}
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                {/* Date Quick Tabs */}
                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                    {[
                        { id: "TODAY", label: "Today" },
                        { id: "TOMORROW", label: "Tomorrow" },
                        { id: "CUSTOM", label: "Custom Date" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setDateFilter(tab.id)}
                            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${dateFilter === tab.id ? "bg-orange-500 text-black" : "text-gray-400 hover:text-white"}`}
                        >
                            {tab.label}
                        </button>
                    ))}

                    {dateFilter === "CUSTOM" && (
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="bg-[#111827] px-2.5 py-1 rounded-lg text-xs font-bold text-white outline-none border border-white/10"
                        />
                    )}
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1 text-xs overflow-x-auto">
                    {["ALL", "CONFIRMED", "CHECKED_IN", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((st) => (
                        <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`rounded-lg px-2.5 py-1 font-semibold transition ${statusFilter === st ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
                        >
                            {st}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search name, phone, RES#..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#111827] pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-orange-400"
                    />
                </div>
            </div>

            {/* Reservations List */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <LoaderCircle className="h-8 w-8 animate-spin text-orange-400" />
                </div>
            ) : reservations.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-gray-400 space-y-2">
                    <Calendar className="h-10 w-10 mx-auto text-gray-500" />
                    <p className="font-bold text-sm">No reservations found for selected date/filter.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reservations.map((res) => {
                        const isConfirmed = res.status === "CONFIRMED";
                        const isCheckedIn = res.status === "CHECKED_IN";
                        const isSeated = res.status === "SEATED";
                        const isCancelled = res.status === "CANCELLED";
                        const isNoShow = res.status === "NO_SHOW";

                        return (
                            <div
                                key={res.id}
                                className={`flex flex-col justify-between rounded-2xl border p-4 transition space-y-3 ${
                                    isSeated
                                        ? "border-emerald-500/40 bg-emerald-500/5"
                                        : isCheckedIn
                                            ? "border-sky-500/40 bg-sky-500/5"
                                            : isConfirmed
                                                ? "border-amber-500/40 bg-amber-500/5"
                                                : isCancelled || isNoShow
                                                    ? "opacity-60 border-red-500/30 bg-red-500/5"
                                                    : "border-white/10 bg-slate-900/60"
                                }`}
                            >
                                <div className="space-y-2">
                                    {/* Top Row: Ref# & Status Badge */}
                                    <div className="flex justify-between items-center">
                                        <strong className="text-sm font-mono text-orange-400">{res.reservationNo}</strong>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            isSeated ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                                            isCheckedIn ? "bg-sky-500/20 text-sky-400 border-sky-500/30" :
                                            isConfirmed ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                                            "bg-red-500/20 text-red-400 border-red-500/30"
                                        }`}>
                                            {res.status}
                                        </span>
                                    </div>

                                    {/* Customer & Guest Info */}
                                    <div>
                                        <h4 className="text-base font-bold text-white flex items-center gap-2">
                                            {res.customerName}
                                            <span className="text-xs font-normal text-gray-400">({res.guestCount} Guests)</span>
                                        </h4>
                                        <p className="text-xs text-gray-400">📞 {res.customerPhone}</p>
                                    </div>

                                    {/* Time & Table Info */}
                                    <div className="rounded-xl border border-white/5 bg-black/30 p-2.5 text-xs space-y-1">
                                        <div className="flex justify-between text-gray-300">
                                            <span>Time Slot:</span>
                                            <strong className="text-amber-300">{res.startTime} – {res.endTime}</strong>
                                        </div>
                                        <div className="flex justify-between text-gray-300">
                                            <span>Assigned Table:</span>
                                            <strong className="text-emerald-400">{res.table ? `Table ${res.table.tableNo} (${res.table.seats} seats)` : "Unassigned"}</strong>
                                        </div>
                                        {res.notes && (
                                            <div className="text-[11px] text-gray-400 pt-1 border-t border-white/5">
                                                Note: {res.notes}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons Footer */}
                                <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                                    {isConfirmed && (
                                        <button
                                            onClick={() => handleCheckIn(res)}
                                            className="flex-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500"
                                        >
                                            Check In
                                        </button>
                                    )}

                                    {(isConfirmed || isCheckedIn) && (
                                        <button
                                            onClick={() => handleSeatGuest(res)}
                                            className="flex-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                                        >
                                            Seat Guest
                                        </button>
                                    )}

                                    {!isCancelled && !isNoShow && (
                                        <button
                                            onClick={() => {
                                                setEditingReservation(res);
                                                setIsModalOpen(true);
                                            }}
                                            className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                                        >
                                            Edit
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handlePrintSlip(res)}
                                        className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                                        title="Print Slip"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                    </button>

                                    {!isCancelled && !isNoShow && !isSeated && (
                                        <>
                                            <button
                                                onClick={() => handleCancel(res)}
                                                className="rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleNoShow(res)}
                                                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20"
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
