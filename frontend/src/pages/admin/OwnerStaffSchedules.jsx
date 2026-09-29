import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Copy,
    Send,
    AlertTriangle,
    Clock,
    User,
    Check,
    Trash2,
    Repeat,
    Filter,
} from "lucide-react";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import StaffSubNav from "../../components/StaffSubNav";
import StaffDirectoryDrawer from "../../components/StaffDirectoryDrawer";
import { useAuth } from "../../context/AuthContext";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function OwnerStaffSchedules() {
    const { user } = useAuth();
    const restaurantId = Number(user?.restaurantId || 0);

    const [viewMode, setViewMode] = useState("weekly"); // "weekly" | "monthly"
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [shifts, setShifts] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [showDirectoryDrawer, setShowDirectoryDrawer] = useState(false);

    // Modal state
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [shiftForm, setShiftForm] = useState({
        userId: "",
        role: "WAITER",
        shiftDate: new Date().toISOString().split("T")[0],
        startTime: "09:00",
        endTime: "17:00",
        breakMins: 30,
        notes: "",
    });

    // Compute week dates (Monday to Sunday)
    const weekDates = useMemo(() => {
        const curr = new Date(currentDate);
        const day = curr.getDay();
        const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(curr.setDate(diff));

        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return d;
        });
    }, [currentDate]);

    const startDateStr = weekDates[0]?.toISOString().split("T")[0];
    const endDateStr = weekDates[6]?.toISOString().split("T")[0];

    const fetchSchedules = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const [resShifts, resStaff] = await Promise.all([
                axios.get(`${API}/api/v1/owner/${restaurantId}/schedules?startDate=${startDateStr}&endDate=${endDateStr}`),
                axios.get(`${API}/owner/${restaurantId}/staff`),
            ]);
            setShifts(resShifts.data?.shifts || []);
            setStaffList(resStaff.data?.users || resStaff.data || []);
        } catch {
            showToast("Failed to load staff schedules", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, [restaurantId, startDateStr, endDateStr]);

    const handlePrevPeriod = () => {
        setCurrentDate((prev) => {
            const d = new Date(prev);
            d.setDate(d.getDate() - (viewMode === "weekly" ? 7 : 30));
            return d;
        });
    };

    const handleNextPeriod = () => {
        setCurrentDate((prev) => {
            const d = new Date(prev);
            d.setDate(d.getDate() + (viewMode === "weekly" ? 7 : 30));
            return d;
        });
    };

    const handleOpenShiftModal = (staffMember = null, dateObj = null, shift = null) => {
        if (shift) {
            setEditingShift(shift);
            setShiftForm({
                userId: String(shift.userId),
                role: shift.role || "WAITER",
                shiftDate: new Date(shift.shiftDate).toISOString().split("T")[0],
                startTime: shift.startTime,
                endTime: shift.endTime,
                breakMins: shift.breakMins || 30,
                notes: shift.notes || "",
            });
        } else {
            setEditingShift(null);
            setShiftForm({
                userId: staffMember ? String(staffMember.id) : (staffList[0]?.id ? String(staffList[0].id) : ""),
                role: staffMember?.role || "WAITER",
                shiftDate: dateObj ? dateObj.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                startTime: "09:00",
                endTime: "17:00",
                breakMins: 30,
                notes: "",
            });
        }
        setShowShiftModal(true);
    };

    const handleSaveShift = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/v1/owner/${restaurantId}/schedules`, {
                shiftId: editingShift ? editingShift.id : null,
                ...shiftForm,
            });
            showToast(editingShift ? "Shift updated successfully!" : "Shift added successfully!", "success");
            setShowShiftModal(false);
            fetchSchedules();
        } catch (err) {
            showToast(err.response?.data?.message || "Error saving shift", "error");
        }
    };

    const handleDeleteShift = async (shiftId) => {
        if (!window.confirm("Are you sure you want to delete this shift?")) return;
        try {
            await axios.delete(`${API}/api/v1/owner/${restaurantId}/schedules/${shiftId}`);
            showToast("Shift deleted", "success");
            fetchSchedules();
        } catch {
            showToast("Failed to delete shift", "error");
        }
    };

    const handlePublishSchedules = async () => {
        setPublishing(true);
        try {
            const res = await axios.post(`${API}/api/v1/owner/${restaurantId}/schedules/publish`, {
                startDate: startDateStr,
                endDate: endDateStr,
            });
            showToast(res.data.message || "Schedules published & staff alerted!", "success");
            fetchSchedules();
        } catch {
            showToast("Failed to publish schedules", "error");
        } finally {
            setPublishing(false);
        }
    };

    const handleCopyPreviousWeek = async () => {
        const prevMon = new Date(weekDates[0]);
        prevMon.setDate(prevMon.getDate() - 7);
        const prevMonStr = prevMon.toISOString().split("T")[0];

        try {
            const res = await axios.post(`${API}/api/v1/owner/${restaurantId}/schedules/copy-week`, {
                sourceStartDate: prevMonStr,
                targetStartDate: startDateStr,
            });
            showToast(res.data.message || "Previous week's shifts copied!", "success");
            fetchSchedules();
        } catch {
            showToast("Failed to copy previous week", "error");
        }
    };

    return (
        <section data-testid="owner-staff" className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* Top Toolbar Header Console Bar */}
            <header className="pb-3 border-b border-[color:var(--app-border)]/50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
                                    Shift Schedules
                                </h2>
                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-primary)]">
                                    7SHIFTS PLANNER
                                </span>
                            </div>
                        </div>
                        <p className="theme-muted text-xs mt-0.5">
                            Plan and publish weekly & monthly staff shifts (7shifts style)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* View Switcher Pills */}
                        <div className="inline-flex items-center rounded-lg border border-[color:var(--app-border)] p-0.5 bg-[color:var(--app-bg)]/50">
                            <button
                                type="button"
                                onClick={() => setViewMode("weekly")}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                                    viewMode === "weekly"
                                        ? "bg-[var(--app-primary)] text-white shadow-sm"
                                        : "theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                                }`}
                            >
                                Weekly
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("monthly")}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                                    viewMode === "monthly"
                                        ? "bg-[var(--app-primary)] text-white shadow-sm"
                                        : "theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                                }`}
                            >
                                Monthly
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleCopyPreviousWeek}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all"
                            title="Copy shifts from last week"
                        >
                            <Copy size={13} />
                            Copy Last Week
                        </button>

                        <button
                            type="button"
                            onClick={handlePublishSchedules}
                            disabled={publishing}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 transition-all disabled:opacity-50"
                        >
                            <Send size={13} />
                            {publishing ? "Publishing..." : "Publish Schedule"}
                        </button>

                        <button
                            type="button"
                            onClick={() => handleOpenShiftModal()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition-all"
                        >
                            <Plus size={13} />
                            Add Shift
                        </button>
                    </div>
                </div>
            </header>

            <StaffSubNav
                onToggleDirectory={() => setShowDirectoryDrawer((prev) => !prev)}
                isDirectoryOpen={showDirectoryDrawer}
            />
            <StaffDirectoryDrawer
                isOpen={showDirectoryDrawer}
                onClose={() => setShowDirectoryDrawer(false)}
                restaurantId={restaurantId}
            />

            {/* Date Navigation & Period Label */}
            <div className="flex items-center justify-between py-1 text-xs theme-muted">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePrevPeriod}
                        className="p-1 hover:bg-[color:var(--app-border)]/30 rounded text-[color:var(--app-text)] transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleNextPeriod}
                        className="p-1 hover:bg-[color:var(--app-border)]/30 rounded text-[color:var(--app-text)] transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="font-semibold text-[color:var(--app-text)]">
                        {weekDates[0]?.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} - {" "}
                        {weekDates[6]?.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                </div>
                <div className="font-medium theme-muted">
                    Total Shifts: <strong className="text-[color:var(--app-text)]">{shifts.length}</strong>
                </div>
            </div>

            {/* 7shifts-inspired Weekly Grid View */}
            <div className="overflow-x-auto border-t border-b border-[color:var(--app-border)]/50">
                <table className="w-full min-w-[900px] border-collapse">
                    <thead>
                        <tr className="bg-[color:var(--app-bg)]/50 border-b border-[color:var(--app-border)]/50 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                            <th className="p-3 w-48 border-r border-[color:var(--app-border)]/40">Staff Member</th>
                            {weekDates.map((dateObj, idx) => (
                                <th key={idx} className="p-2.5 text-center border-r border-[color:var(--app-border)]/40 last:border-r-0">
                                    <div className="text-[color:var(--app-text)] font-bold">{DAYS_OF_WEEK[idx]}</div>
                                    <div className="text-[11px] theme-muted font-normal">
                                        {dateObj.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/70 text-sm">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-neutral-400">Loading schedules...</td>
                            </tr>
                        ) : staffList.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-neutral-400">No staff members found. Add staff first.</td>
                            </tr>
                        ) : (
                            staffList.map((staff) => (
                                <tr key={staff.id} className="hover:bg-neutral-50/40 transition-colors">
                                    <td className="p-4 border-r border-neutral-200 bg-white font-medium text-neutral-900">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                                                {staff.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold text-neutral-900">{staff.name}</div>
                                                <div className="text-[11px] text-neutral-500">{staff.designation || staff.role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    {weekDates.map((dateObj, dIdx) => {
                                        const dateStr = dateObj.toISOString().split("T")[0];
                                        const dayShifts = shifts.filter(
                                            (s) => s.userId === staff.id && new Date(s.shiftDate).toISOString().split("T")[0] === dateStr
                                        );

                                        return (
                                            <td key={dIdx} className="p-2 border-r border-neutral-200/60 last:border-r-0 vertical-top min-h-[90px]">
                                                <div className="space-y-1.5 min-h-[70px] group relative">
                                                    {dayShifts.map((shift) => (
                                                        <div
                                                            key={shift.id}
                                                            onClick={() => handleOpenShiftModal(staff, dateObj, shift)}
                                                            className={`p-2 rounded-xl text-xs cursor-pointer border shadow-2xs transition-all hover:scale-[1.02] ${
                                                                shift.status === "PUBLISHED"
                                                                    ? "bg-orange-50 border-orange-200/80 text-orange-900"
                                                                    : "bg-amber-50/90 border-amber-200/80 text-amber-900"
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between font-bold">
                                                                <span>{shift.startTime} - {shift.endTime}</span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteShift(shift.id);
                                                                    }}
                                                                    className="text-neutral-400 hover:text-rose-600 p-0.5"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <div className="text-[10px] opacity-80 flex items-center gap-1 mt-0.5">
                                                                <span>{shift.role}</span>
                                                                {shift.status === "DRAFT" && (
                                                                    <span className="bg-amber-200/80 text-amber-900 px-1 rounded text-[9px] font-semibold">
                                                                        Draft
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <button
                                                        onClick={() => handleOpenShiftModal(staff, dateObj)}
                                                        className="w-full py-1 text-[11px] text-neutral-400 hover:text-orange-600 hover:bg-orange-50/50 rounded-lg border border-dashed border-transparent hover:border-orange-300 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" /> Add Shift
                                                    </button>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Shift Modal */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-neutral-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                            <h3 className="text-lg font-bold text-neutral-900">
                                {editingShift ? "Edit Shift" : "Add New Shift"}
                            </h3>
                            <button
                                onClick={() => setShowShiftModal(false)}
                                className="text-neutral-400 hover:text-neutral-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveShift} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold text-neutral-700 mb-1">Staff Member</label>
                                <select
                                    value={shiftForm.userId}
                                    onChange={(e) => setShiftForm({ ...shiftForm, userId: e.target.value })}
                                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                    required
                                >
                                    {staffList.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.designation || s.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-neutral-700 mb-1">Shift Date</label>
                                    <input
                                        type="date"
                                        value={shiftForm.shiftDate}
                                        onChange={(e) => setShiftForm({ ...shiftForm, shiftDate: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold text-neutral-700 mb-1">Assigned Role</label>
                                    <select
                                        value={shiftForm.role}
                                        onChange={(e) => setShiftForm({ ...shiftForm, role: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="WAITER">Server / Waiter</option>
                                        <option value="CHEF">Chef / Kitchen</option>
                                        <option value="CASHIER">Cashier</option>
                                        <option value="MANAGER">Manager</option>
                                        <option value="STAFF">Staff</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-neutral-700 mb-1">Start Time</label>
                                    <input
                                        type="time"
                                        value={shiftForm.startTime}
                                        onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold text-neutral-700 mb-1">End Time</label>
                                    <input
                                        type="time"
                                        value={shiftForm.endTime}
                                        onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-neutral-700 mb-1">Break Duration (mins)</label>
                                <input
                                    type="number"
                                    value={shiftForm.breakMins}
                                    onChange={(e) => setShiftForm({ ...shiftForm, breakMins: Number(e.target.value) })}
                                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-neutral-700 mb-1">Shift Notes</label>
                                <textarea
                                    value={shiftForm.notes}
                                    onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                                    rows={2}
                                    placeholder="Optional notes for staff..."
                                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowShiftModal(false)}
                                    className="px-4 py-2 text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-xl font-semibold shadow-sm transition-all"
                                >
                                    Save Shift
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
