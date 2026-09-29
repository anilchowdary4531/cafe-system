import { useEffect, useState } from "react";
import axios from "axios";
import {
    Clock,
    UserCheck,
    AlertCircle,
    CheckCircle2,
    XCircle,
    FileSpreadsheet,
    FileText,
    MapPin,
    Calendar,
} from "lucide-react";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import StaffSubNav from "../../components/StaffSubNav";
import StaffDirectoryDrawer from "../../components/StaffDirectoryDrawer";
import { useAuth } from "../../context/AuthContext";

export default function OwnerStaffAttendance() {
    const { user } = useAuth();
    const restaurantId = Number(user?.restaurantId || 0);

    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("live"); // "live" | "corrections"
    const [showDirectoryDrawer, setShowDirectoryDrawer] = useState(false);

    const fetchAttendance = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API}/api/v1/owner/${restaurantId}/attendance`);
            setAttendanceLogs(res.data?.logs || []);
        } catch {
            showToast("Failed to fetch attendance logs", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance();
    }, [restaurantId]);

    const onDutyCount = attendanceLogs.filter((l) => l.status === "ON_DUTY").length;
    const pendingCorrections = attendanceLogs.flatMap((l) => l.corrections || []).filter((c) => c.status === "PENDING");

    const handleReviewCorrection = async (correctionId, approve) => {
        try {
            await axios.put(`${API}/api/v1/owner/${restaurantId}/attendance/correction/${correctionId}`, {
                approve,
            });
            showToast(`Correction request ${approve ? "approved" : "rejected"}!`, "success");
            fetchAttendance();
        } catch {
            showToast("Failed to review correction", "error");
        }
    };

    const exportToExcel = () => {
        const headers = ["Employee", "Role", "Clock In", "Clock Out", "Total Hours", "Geofenced", "Status"];
        const rows = attendanceLogs.map((log) => [
            `"${(log.user?.name || "N/A").replace(/"/g, '""')}"`,
            `"${(log.user?.designation || log.user?.role || "N/A").replace(/"/g, '""')}"`,
            `"${new Date(log.clockInTime).toLocaleString("en-IN")}"`,
            `"${log.clockOutTime ? new Date(log.clockOutTime).toLocaleString("en-IN") : "On Duty"}"`,
            `"${(log.totalMinutes / 60).toFixed(2)}"`,
            `"${log.isGeofenced ? "Yes" : "No"}"`,
            `"${log.status}"`,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Staff_Attendance_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("CSV attendance report downloaded!", "success");
    };

    const exportToPDF = () => {
        window.print();
    };

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* Header Console Bar */}
            <header className="pb-3 border-b border-[color:var(--app-border)]/50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
                                    Attendance & Time Clock
                                </h2>
                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-primary)]">
                                    LIVE MONITOR
                                </span>
                            </div>
                        </div>
                        <p className="theme-muted text-xs mt-0.5">
                            Track live staff clock-ins, GPS verification, and correction requests
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={exportToExcel}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 transition-all"
                        >
                            <FileSpreadsheet size={13} /> Export Excel
                        </button>
                        <button
                            type="button"
                            onClick={exportToPDF}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50/50 transition-all"
                        >
                            <FileText size={13} /> Export PDF
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

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-[color:var(--app-border)]/40 bg-[color:var(--app-bg)]/50 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-medium theme-muted">Currently On Duty</div>
                        <div className="text-xl font-bold text-[color:var(--app-text)]">{onDutyCount}</div>
                    </div>
                    <UserCheck className="w-5 h-5 text-emerald-500" />
                </div>

                <div className="p-3 rounded-lg border border-[color:var(--app-border)]/40 bg-[color:var(--app-bg)]/50 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-medium theme-muted">Pending Corrections</div>
                        <div className="text-xl font-bold text-[color:var(--app-text)]">{pendingCorrections.length}</div>
                    </div>
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                </div>

                <div className="p-3 rounded-lg border border-[color:var(--app-border)]/40 bg-[color:var(--app-bg)]/50 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-medium theme-muted">Total Hours Tracked</div>
                        <div className="text-xl font-bold text-[color:var(--app-text)]">
                            {(attendanceLogs.reduce((acc, l) => acc + (l.totalMinutes || 0), 0) / 60).toFixed(1)} hrs
                        </div>
                    </div>
                    <Clock className="w-5 h-5 text-orange-500" />
                </div>
            </div>

            {/* Sub-tabs & Table Container */}
            <div className="border-t border-b border-[color:var(--app-border)]/50 overflow-hidden">
                <div className="flex border-b border-[color:var(--app-border)]/40 gap-4 text-xs font-semibold">
                    <button
                        type="button"
                        onClick={() => setActiveTab("live")}
                        className={`py-2 border-b-2 transition-all ${
                            activeTab === "live" ? "border-orange-500 text-orange-600 font-bold" : "border-transparent theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                    >
                        Live Attendance Logs ({attendanceLogs.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("corrections")}
                        className={`py-2 border-b-2 transition-all flex items-center gap-1.5 ${
                            activeTab === "corrections" ? "border-orange-500 text-orange-600 font-bold" : "border-transparent theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                    >
                        Correction Requests
                        {pendingCorrections.length > 0 && (
                            <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                {pendingCorrections.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === "live" ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[color:var(--app-bg)]/50 border-b border-[color:var(--app-border)]/50 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                                    <th className="p-3">Staff Member</th>
                                    <th className="p-3">Clock In</th>
                                    <th className="p-3">Clock Out</th>
                                    <th className="p-3">Duration</th>
                                    <th className="p-3">GPS Geofence</th>
                                    <th className="p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[color:var(--app-border)]/30 text-xs sm:text-sm">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-neutral-400">Loading attendance...</td>
                                    </tr>
                                ) : attendanceLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-neutral-400">No attendance logs found.</td>
                                    </tr>
                                ) : (
                                    attendanceLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-[color:var(--app-bg)]/40">
                                            <td className="p-3 font-semibold text-[color:var(--app-text)]">
                                                <div>{log.user?.name}</div>
                                                <div className="text-xs font-normal theme-muted">{log.user?.designation || log.user?.role}</div>
                                            </td>
                                            <td className="p-3 theme-muted font-medium">
                                                {new Date(log.clockInTime).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}
                                            </td>
                                            <td className="p-3 theme-muted font-medium">
                                                {log.clockOutTime
                                                    ? new Date(log.clockOutTime).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })
                                                    : <span className="text-emerald-600 font-bold">Active On Duty</span>}
                                            </td>
                                            <td className="p-3 font-semibold text-[color:var(--app-text)]">
                                                {(log.totalMinutes / 60).toFixed(2)} hrs
                                            </td>
                                            <td className="p-3">
                                                {log.isGeofenced ? (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-xs font-semibold border border-emerald-200">
                                                        <MapPin className="w-3 h-3" /> Geofenced
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md text-xs font-semibold">
                                                        Manual
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                    log.status === "ON_DUTY"
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : "bg-neutral-100 text-neutral-700"
                                                }`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-4 space-y-3">
                        {pendingCorrections.length === 0 ? (
                            <div className="text-center py-8 text-neutral-400 text-sm">No pending correction requests.</div>
                        ) : (
                            pendingCorrections.map((corr) => (
                                <div key={corr.id} className="p-3 rounded-lg border border-[color:var(--app-border)]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="font-bold text-[color:var(--app-text)] text-xs">{corr.user?.name}</div>
                                        <div className="text-xs theme-muted mt-0.5">
                                            Requested: {new Date(corr.requestedIn).toLocaleTimeString()} - {new Date(corr.requestedOut).toLocaleTimeString()}
                                        </div>
                                        <div className="text-xs italic theme-muted mt-0.5">Reason: "{corr.reason}"</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleReviewCorrection(corr.id, true)}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleReviewCorrection(corr.id, false)}
                                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                        >
                                            <XCircle className="w-3.5 h-3.5" /> Reject
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
