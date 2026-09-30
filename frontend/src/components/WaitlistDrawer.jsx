import { useEffect, useState } from "react";
import {
    AlertCircle,
    BellRing,
    Clock,
    LoaderCircle,
    Plus,
    Search,
    UserCheck,
    UserPlus,
    Users,
    Utensils,
    X,
} from "lucide-react";
import axios from "axios";
import { API } from "../config";
import { showToast } from "../utils/toast";

export default function WaitlistDrawer({
    isOpen,
    onClose,
    restaurantId,
    tables = [],
    onSeatCustomer,
    onWaitlistUpdated,
}) {
    if (!isOpen) return null;

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | WAITING | NOTIFIED

    // Add Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [guestCount, setGuestCount] = useState(2);
    const [preferredSection, setPreferredSection] = useState("Main Floor");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Seating dropdown state
    const [seatingEntryId, setSeatingEntryId] = useState(null);
    const [selectedTableId, setSelectedTableId] = useState("");

    const fetchWaitlist = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API}/owner/${restaurantId}/waitlist`, {
                params: {
                    status: statusFilter,
                    search: searchQuery || undefined,
                },
            });
            if (res.data?.success) {
                setEntries(res.data.waitlist || []);
            }
        } catch (err) {
            console.error("Failed to load waitlist:", err);
            showToast({ title: "Waitlist Error", message: err.message || "Failed to load waitlist", variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWaitlist();
    }, [restaurantId, statusFilter, searchQuery]);

    const handleAddWaitlist = async (e) => {
        e.preventDefault();
        if (!customerName || !customerPhone) {
            showToast({ title: "Required", message: "Enter name and phone number.", variant: "warning" });
            return;
        }

        try {
            setSubmitting(true);
            const res = await axios.post(`${API}/owner/${restaurantId}/waitlist`, {
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                guestCount: Number(guestCount || 2),
                preferredSection,
                notes: notes ? notes.trim() : null,
            });

            if (res.data?.success) {
                showToast({
                    title: "Added to Waitlist",
                    message: res.data.message || `${customerName} added to waitlist.`,
                    variant: "success",
                });
                setCustomerName("");
                setCustomerPhone("");
                setGuestCount(2);
                setNotes("");
                setShowAddForm(false);
                fetchWaitlist();
                if (onWaitlistUpdated) onWaitlistUpdated();
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || "Failed to add to waitlist.";
            showToast({ title: "Error", message: errMsg, variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleNotifyCustomer = async (entry) => {
        try {
            const res = await axios.post(`${API}/owner/${restaurantId}/waitlist/${entry.id}/notify`);
            if (res.data?.success) {
                showToast({
                    title: "Notification Sent",
                    message: `Notified ${entry.customerName} that their table is ready!`,
                    variant: "success",
                });
                fetchWaitlist();
                if (onWaitlistUpdated) onWaitlistUpdated();
            }
        } catch (err) {
            showToast({ title: "Error", message: err.message || "Failed to notify customer.", variant: "error" });
        }
    };

    const handleSeatConfirm = async (entry) => {
        if (!selectedTableId) {
            showToast({ title: "Select Table", message: "Select a table to seat the guest.", variant: "warning" });
            return;
        }

        try {
            const res = await axios.post(`${API}/owner/${restaurantId}/waitlist/${entry.id}/seat`, {
                tableId: Number(selectedTableId),
            });
            if (res.data?.success) {
                showToast({
                    title: "Guest Seated!",
                    message: res.data.message || `${entry.customerName} seated.`,
                    variant: "success",
                });
                setSeatingEntryId(null);
                setSelectedTableId("");
                fetchWaitlist();
                if (onSeatCustomer) onSeatCustomer(selectedTableId);
                if (onWaitlistUpdated) onWaitlistUpdated();
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || "Seating failed.";
            showToast({ title: "Seating Error", message: errMsg, variant: "error" });
        }
    };

    const handleCancelEntry = async (entry) => {
        if (!window.confirm(`Remove ${entry.customerName} from waitlist?`)) return;

        try {
            const res = await axios.post(`${API}/owner/${restaurantId}/waitlist/${entry.id}/cancel`);
            if (res.data?.success) {
                showToast({ title: "Waitlist Updated", message: `${entry.customerName} removed from queue.`, variant: "info" });
                fetchWaitlist();
                if (onWaitlistUpdated) onWaitlistUpdated();
            }
        } catch (err) {
            showToast({ title: "Error", message: err.message || "Failed to cancel entry.", variant: "error" });
        }
    };

    const availableTables = tables.filter((t) => !t.isOccupied && !t.isBlocked);

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity">
            <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 px-5 py-4 bg-slate-50/70 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2.5">
                        <div className="rounded-xl bg-orange-500/10 p-2 text-orange-500 border border-orange-500/20">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold tracking-tight">Host Waitlist Queue</h3>
                            <p className="text-[11px] theme-muted">Manage waiting guests & seat when tables free up</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search waitlist name, phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-orange-500"
                            />
                        </div>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-1 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition shrink-0"
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            {showAddForm ? "Cancel" : "Add Guest"}
                        </button>
                    </div>

                    {/* Add Guest Form Panel */}
                    {showAddForm && (
                        <form onSubmit={handleAddWaitlist} className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 space-y-2.5 text-xs">
                            <div className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                                <Plus className="h-3.5 w-3.5" /> New Waitlist Entry
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-medium mb-0.5">Guest Name *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Rahul Sharma"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        required
                                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium mb-0.5">Phone *</label>
                                    <input
                                        type="tel"
                                        placeholder="e.g. 9876543210"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        required
                                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-medium mb-0.5">Party Size</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={guestCount}
                                        onChange={(e) => setGuestCount(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium mb-0.5">Preferred Area</label>
                                    <select
                                        value={preferredSection}
                                        onChange={(e) => setPreferredSection(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                                    >
                                        <option value="Main Floor">Main Floor</option>
                                        <option value="Main Hall">Main Hall</option>
                                        <option value="Patio">Patio</option>
                                        <option value="Roof Top">Roof Top</option>
                                        <option value="Section T">Section T</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-medium mb-0.5">Notes (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Needs high chair, birthday booth"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                />
                            </div>

                            <div className="flex justify-end gap-1.5 pt-1">
                                <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg px-3 py-1 text-xs theme-muted">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                                >
                                    {submitting ? <LoaderCircle className="h-3 w-3 animate-spin" /> : "Save Entry"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Queue List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <LoaderCircle className="h-6 w-6 animate-spin text-orange-500" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 p-8 text-center theme-muted space-y-1">
                            <Users className="h-7 w-7 mx-auto opacity-40 text-orange-500" />
                            <p className="font-bold text-xs">No active waitlist entries.</p>
                            <p className="text-[11px]">Click "Add Guest" above when customers arrive at host stand.</p>
                        </div>
                    ) : (
                        entries.map((entry) => {
                            const isNotified = entry.status === "NOTIFIED";
                            const isSeatingThis = seatingEntryId === entry.id;

                            return (
                                <div
                                    key={entry.id}
                                    className={`rounded-xl border p-3 space-y-2 text-xs transition shadow-xs ${
                                        isNotified
                                            ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20"
                                            : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                <span>{entry.customerName}</span>
                                                <span className="text-[10px] font-normal theme-muted">📞 {entry.customerPhone}</span>
                                            </h4>
                                            <p className="text-[11px] theme-muted flex items-center gap-2 mt-0.5">
                                                <span>🪑 {entry.guestCount} Guests</span>
                                                <span>•</span>
                                                <span>📍 {entry.preferredSection || "Main Floor"}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                isNotified
                                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                            }`}>
                                                {isNotified ? "NOTIFIED" : `~${entry.estimatedWaitMinutes || 15} MIN WAIT`}
                                            </span>
                                        </div>
                                    </div>

                                    {entry.notes && (
                                        <div className="text-[11px] theme-muted bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-gray-100 dark:border-slate-800">
                                            Note: {entry.notes}
                                        </div>
                                    )}

                                    {/* Inline Table Selection for Seating */}
                                    {isSeatingThis ? (
                                        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2 space-y-2">
                                            <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                                Select Available Table to Seat {entry.customerName}:
                                            </label>
                                            <select
                                                value={selectedTableId}
                                                onChange={(e) => setSelectedTableId(e.target.value)}
                                                className="w-full rounded-lg border border-emerald-400 bg-white dark:bg-slate-800 px-2 py-1 text-xs outline-none"
                                            >
                                                <option value="">-- Choose Available Table --</option>
                                                {availableTables.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        Table {t.tableNo} ({t.seats} Seats) - {t.section || "Main Area"}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSeatingEntryId(null)}
                                                    className="rounded-md px-2 py-1 text-[11px] theme-muted"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSeatConfirm(entry)}
                                                    disabled={!selectedTableId}
                                                    className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                                                >
                                                    Confirm Seating
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-slate-800/80">
                                            <button
                                                onClick={() => handleNotifyCustomer(entry)}
                                                className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 text-[11px] font-bold hover:bg-emerald-500/20 flex items-center justify-center gap-1"
                                            >
                                                <BellRing className="h-3 w-3" /> Notify
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSeatingEntryId(entry.id);
                                                    setSelectedTableId("");
                                                }}
                                                className="flex-1 rounded-lg bg-orange-500 text-white px-2 py-1 text-[11px] font-bold hover:bg-orange-600 flex items-center justify-center gap-1"
                                            >
                                                <UserCheck className="h-3 w-3" /> Seat Guest
                                            </button>
                                            <button
                                                onClick={() => handleCancelEntry(entry)}
                                                className="rounded-lg border border-red-500/20 text-red-500 px-2 py-1 text-[11px] hover:bg-red-500/10"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
