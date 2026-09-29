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
import { useAuth } from "../../context/AuthContext";

export default function OwnerStaffAttendance() {
    const { user } = useAuth();
    const restaurantId = Number(user?.restaurantId || 0);

    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("live"); // "live" | "corrections"

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
        <div className="min-h-screen bg-neutral-50/60 p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-neutral-200/80">
                <div className="flex items-center gap-3">
                    <OwnerMenuButton />
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 flex items-center gap-2">
                            <Clock className="w-6 h-6 text-orange-600" />
                            Attendance & Time Clock
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500">
                            Track live staff clock-ins, GPS verification, and correction requests
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={exportToExcel}
                        className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                        <FileSpreadsheet className="w-4 h-4" /> Export Excel
                    </button>
                    <button
                        onClick={exportToPDF}
                        className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                        <FileText className="w-4 h-4" /> Export PDF
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 font-bold">
                        <UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-neutral-900">{onDutyCount}</div>
                        <div className="text-xs text-neutral-500 font-medium">Currently On Duty</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-100 text-amber-700 font-bold">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-neutral-900">{pendingCorrections.length}</div>
                        <div className="text-xs text-neutral-500 font-medium">Pending Corrections</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-orange-100 text-orange-700 font-bold">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-neutral-900">
                            {(attendanceLogs.reduce((acc, l) => acc + (l.totalMinutes || 0), 0) / 60).toFixed(1)} hrs
                        </div>
                        <div className="text-xs text-neutral-500 font-medium">Total Hours Tracked</div>
                    </div>
                </div>
            </div>

            {/* Tabs & Table Container */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
                <div className="flex border-b border-neutral-200 px-6 pt-4 gap-6 text-sm font-semibold">
                    <button
                        onClick={() => setActiveTab("live")}
                        className={`pb-3 border-b-2 transition-all ${
                            activeTab === "live" ? "border-orange-600 text-orange-600" : "border-transparent text-neutral-500 hover:text-neutral-900"
                        }`}
                    >
                        Live Attendance Logs ({attendanceLogs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("corrections")}
                        className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
                            activeTab === "corrections" ? "border-orange-600 text-orange-600" : "border-transparent text-neutral-500 hover:text-neutral-900"
                        }`}
                    >
                        Correction Requests
                        {pendingCorrections.length > 0 && (
                            <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {pendingCorrections.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === "live" ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-neutral-50/80 border-b border-neutral-200 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                                    <th className="p-4">Staff Member</th>
                                    <th className="p-4">Clock In</th>
                                    <th className="p-4">Clock Out</th>
                                    <th className="p-4">Duration</th>
                                    <th className="p-4">GPS Geofence</th>
                                    <th className="p-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200/70 text-xs sm:text-sm">
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
                                        <tr key={log.id} className="hover:bg-neutral-50/50">
                                            <td className="p-4 font-semibold text-neutral-900">
                                                <div>{log.user?.name}</div>
                                                <div className="text-xs font-normal text-neutral-500">{log.user?.designation || log.user?.role}</div>
                                            </td>
                                            <td className="p-4 text-neutral-700 font-medium">
                                                {new Date(log.clockInTime).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}
                                            </td>
                                            <td className="p-4 text-neutral-700 font-medium">
                                                {log.clockOutTime
                                                    ? new Date(log.clockOutTime).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })
                                                    : <span className="text-emerald-600 font-bold">Active On Duty</span>}
                                            </td>
                                            <td className="p-4 font-semibold text-neutral-800">
                                                {(log.totalMinutes / 60).toFixed(2)} hrs
                                            </td>
                                            <td className="p-4">
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
                                            <td className="p-4">
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
                    <div className="p-6 space-y-4">
                        {pendingCorrections.length === 0 ? (
                            <div className="text-center py-8 text-neutral-400 text-sm">No pending correction requests.</div>
                        ) : (
                            pendingCorrections.map((corr) => (
                                <div key={corr.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="font-bold text-neutral-900 text-sm">{corr.user?.name}</div>
                                        <div className="text-xs text-neutral-600 mt-0.5">
                                            Requested: {new Date(corr.requestedIn).toLocaleTimeString()} - {new Date(corr.requestedOut).toLocaleTimeString()}
                                        </div>
                                        <div className="text-xs italic text-neutral-500 mt-1">Reason: "{corr.reason}"</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleReviewCorrection(corr.id, true)}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleReviewCorrection(corr.id, false)}
                                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
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
        </div>
    );
}
