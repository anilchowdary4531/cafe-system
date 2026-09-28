import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, Clock, LoaderCircle, User, Users, Utensils, X } from "lucide-react";
import axios from "axios";
import { API } from "../config";
import { showToast } from "../utils/toast";

const defaultTimes = [
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"
];

export default function ReservationModal({
    isOpen,
    onClose,
    restaurantId,
    reservationToEdit = null,
    tables = [],
    onSaved,
}) {
    if (!isOpen) return null;

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [reservationDate, setReservationDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [startTime, setStartTime] = useState("19:30");
    const [endTime, setEndTime] = useState("21:00");
    const [guestCount, setGuestCount] = useState(2);
    const [selectedTableId, setSelectedTableId] = useState("");
    const [notes, setNotes] = useState("");
    const [status, setStatus] = useState("CONFIRMED");

    // Availability checking state
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [availabilityResult, setAvailabilityResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (reservationToEdit) {
            setCustomerName(reservationToEdit.customerName || "");
            setCustomerPhone(reservationToEdit.customerPhone || "");
            setCustomerEmail(reservationToEdit.customerEmail || "");
            if (reservationToEdit.reservationDate) {
                setReservationDate(new Date(reservationToEdit.reservationDate).toISOString().split("T")[0]);
            }
            setStartTime(reservationToEdit.startTime || "19:30");
            setEndTime(reservationToEdit.endTime || "21:00");
            setGuestCount(reservationToEdit.guestCount || 2);
            setSelectedTableId(reservationToEdit.tableId ? String(reservationToEdit.tableId) : "");
            setNotes(reservationToEdit.notes || "");
            setStatus(reservationToEdit.status || "CONFIRMED");
        } else {
            setCustomerName("");
            setCustomerPhone("");
            setCustomerEmail("");
            setReservationDate(new Date().toISOString().split("T")[0]);
            setStartTime("19:30");
            setEndTime("21:00");
            setGuestCount(2);
            setSelectedTableId("");
            setNotes("");
            setStatus("CONFIRMED");
        }
        setAvailabilityResult(null);
    }, [reservationToEdit, isOpen]);

    // Check availability whenever table, date, start, or end time changes
    useEffect(() => {
        let isCancelled = false;
        if (!selectedTableId || !reservationDate || !startTime || !endTime) {
            setAvailabilityResult(null);
            return;
        }

        const runCheck = async () => {
            try {
                setCheckingAvailability(true);
                const rid = restaurantId || 1;
                const params = {
                    tableId: selectedTableId,
                    date: reservationDate,
                    startTime,
                    endTime,
                };
                if (reservationToEdit?.id) {
                    params.excludeReservationId = reservationToEdit.id;
                }

                const res = await axios.get(`${API}/owner/${rid}/reservations/availability`, { params });
                if (!isCancelled && res.data?.success) {
                    setAvailabilityResult(res.data.availability);
                }
            } catch (err) {
                console.error("Availability check failed:", err);
            } finally {
                if (!isCancelled) setCheckingAvailability(false);
            }
        };

        const timer = setTimeout(runCheck, 300);
        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [selectedTableId, reservationDate, startTime, endTime, restaurantId, reservationToEdit]);

    const targetTableObj = useMemo(() => {
        if (!selectedTableId) return null;
        return tables.find((t) => t.id === Number(selectedTableId));
    }, [selectedTableId, tables]);

    const isCapacityExceeded = useMemo(() => {
        if (!targetTableObj) return false;
        return Number(guestCount) > targetTableObj.seats;
    }, [targetTableObj, guestCount]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reservationDate || !startTime || !endTime) {
            showToast({ title: "Required Fields", message: "Fill date, start time, and end time.", variant: "warning" });
            return;
        }

        if (availabilityResult && !availabilityResult.available) {
            showToast({ title: "Table Unavailable", message: availabilityResult.message || "Table is already booked during this time.", variant: "error" });
            return;
        }

        try {
            setSubmitting(true);
            const rid = restaurantId || 1;
            const payload = {
                tableId: selectedTableId ? Number(selectedTableId) : null,
                reservationDate,
                startTime,
                endTime,
                guestCount: Number(guestCount || 1),
                customerName: customerName ? customerName.trim() : "Guest",
                customerPhone: customerPhone ? customerPhone.trim() : null,
                customerEmail: customerEmail ? customerEmail.trim() : null,
                notes: notes ? notes.trim() : null,
                status,
                clientOperationId: `RES-OP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            };

            let res;
            if (reservationToEdit?.id) {
                res = await axios.put(`${API}/owner/${rid}/reservations/${reservationToEdit.id}`, payload);
            } else {
                res = await axios.post(`${API}/owner/${rid}/reservations`, payload);
            }

            if (res.data?.success) {
                showToast({
                    title: reservationToEdit ? "Reservation Updated" : "Reservation Created",
                    message: res.data.message || "Reservation saved successfully.",
                    variant: "success",
                });
                if (onSaved) onSaved(res.data.reservation);
                onClose();
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || "Failed to save reservation.";
            showToast({ title: "Reservation Error", message: errMsg, variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2.5">
                        <div className="rounded-xl bg-orange-500/10 p-2 text-orange-500 border border-orange-500/20">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                {reservationToEdit ? `Edit Reservation ${reservationToEdit.reservationNo}` : "New Table Reservation"}
                            </h3>
                            <p className="text-[11px] theme-muted">Book table slots with real-time conflict check</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form - Flowing like words on paper */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
                    {/* Section 1: Guest Information */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-gray-100 dark:border-slate-800">
                            <User className="h-3.5 w-3.5" /> Guest Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Customer Name (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Rahul Kumar or Guest"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number (Optional)</label>
                                <input
                                    type="tel"
                                    placeholder="e.g. 9876543210"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Schedule & Time Slot */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-gray-100 dark:border-slate-800">
                            <Clock className="h-3.5 w-3.5" /> Schedule & Time Slot
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                                <input
                                    type="date"
                                    value={reservationDate}
                                    onChange={(e) => setReservationDate(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time *</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">End Time *</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Table Assignment & Guests */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-gray-100 dark:border-slate-800">
                            <Utensils className="h-3.5 w-3.5" /> Table Assignment & Guests
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Guest Count</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={guestCount}
                                    onChange={(e) => setGuestCount(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Assign Table (Optional)</label>
                                <select
                                    value={selectedTableId}
                                    onChange={(e) => setSelectedTableId(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition"
                                >
                                    <option value="">-- Unassigned / Flexible --</option>
                                    {tables.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            Table {t.tableNo} ({t.seats} Seats) - {t.section || "Main Area"}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Capacity Warning */}
                        {isCapacityExceeded && (
                            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-300">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>Guest count ({guestCount}) exceeds Table {targetTableObj?.tableNo} capacity ({targetTableObj?.seats} seats).</span>
                            </div>
                        )}

                        {/* Availability Feedback */}
                        {checkingAvailability && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Checking slot availability...
                            </div>
                        )}

                        {availabilityResult && !availabilityResult.available && (
                            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-2 text-xs text-red-700 dark:text-red-300 space-y-0.5">
                                <strong>⚠️ Slot Conflict:</strong> {availabilityResult.message}
                            </div>
                        )}

                        {availabilityResult && availabilityResult.available && selectedTableId && (
                            <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
                                <span>✓ Table {targetTableObj?.tableNo} is AVAILABLE for {startTime} – {endTime}.</span>
                            </div>
                        )}
                    </div>

                    {/* Section 4: Special Notes */}
                    <div className="pt-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Special Notes / Requests</label>
                        <input
                            type="text"
                            placeholder="e.g. High chair needed, Birthday celebration"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition"
                        />
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end items-center gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                        <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || (availabilityResult && !availabilityResult.available)}
                            className="rounded-xl bg-orange-500 px-5 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
                        >
                            {submitting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                            {reservationToEdit ? "Save Changes" : "Confirm Reservation"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
