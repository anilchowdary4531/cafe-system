import { useEffect, useState } from "react";
import axios from "axios";
import {
    Clock,
    MapPin,
    Calendar,
    CheckSquare,
    RefreshCw,
    LogOut,
    User,
    CheckCircle2,
    AlertCircle,
    ArrowRightLeft,
} from "lucide-react";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import BrandLogo from "../../components/BrandLogo";

export default function StaffDashboard() {
    const { user, logout } = useAuth();
    const restaurantId = Number(user?.restaurantId || 0);

    const [activeAttendance, setActiveAttendance] = useState(null);
    const [myShifts, setMyShifts] = useState([]);
    const [myTasks, setMyTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clocking, setClocking] = useState(false);

    // Swap modal state
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [swapShiftId, setSwapShiftId] = useState(null);
    const [swapTargetUserId, setSwapTargetUserId] = useState("");
    const [staffList, setStaffList] = useState([]);

    const fetchStaffPortalData = async () => {
        if (!restaurantId || !user?.id) return;
        setLoading(true);
        try {
            const todayStr = new Date().toISOString().split("T")[0];
            const [resAtt, resShifts, resTasks, resStaff] = await Promise.all([
                axios.get(`${API}/api/v1/owner/${restaurantId}/attendance?userId=${user.id}&status=ON_DUTY`),
                axios.get(`${API}/api/v1/owner/${restaurantId}/schedules?userId=${user.id}`),
                axios.get(`${API}/api/v1/owner/${restaurantId}/tasks?assignedTo=${user.id}`),
                axios.get(`${API}/owner/${restaurantId}/staff`),
            ]);

            const activeLog = (resAtt.data?.logs || []).find((l) => l.status === "ON_DUTY");
            setActiveAttendance(activeLog || null);
            setMyShifts(resShifts.data?.shifts || []);
            setMyTasks(resTasks.data?.tasks || []);
            setStaffList((resStaff.data?.users || resStaff.data || []).filter((s) => s.id !== user.id));
        } catch {
            showToast("Failed to sync staff portal", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaffPortalData();
    }, [restaurantId, user?.id]);

    const handleClockToggle = async () => {
        setClocking(true);

        const executeClock = async (lat = null, lng = null) => {
            try {
                if (activeAttendance) {
                    // Clock Out
                    await axios.post(`${API}/api/v1/staff/clock-out`, { lat, lng });
                    showToast("Clocked out successfully!", "success");
                } else {
                    // Clock In
                    await axios.post(`${API}/api/v1/staff/clock-in`, { lat, lng });
                    showToast("Clocked in successfully! Have a great shift.", "success");
                }
                fetchStaffPortalData();
            } catch (err) {
                showToast(err.response?.data?.message || "Clock action failed", "error");
            } finally {
                setClocking(false);
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => executeClock(pos.coords.latitude, pos.coords.longitude),
                () => executeClock(null, null),
                { timeout: 8000 }
            );
        } else {
            executeClock(null, null);
        }
    };

    const handleInitiateSwap = (shiftId) => {
        setSwapShiftId(shiftId);
        setShowSwapModal(true);
    };

    const handleSendSwapRequest = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/v1/staff/shifts/${swapShiftId}/swap`, {
                targetUserId: Number(swapTargetUserId),
            });
            showToast("Shift swap request sent to peer!", "success");
            setShowSwapModal(false);
            fetchStaffPortalData();
        } catch {
            showToast("Failed to request shift swap", "error");
        }
    };

    const handleToggleTask = async (taskId, isCompleted) => {
        try {
            await axios.put(`${API}/api/v1/staff/tasks/${taskId}/complete`, { isCompleted: !isCompleted });
            fetchStaffPortalData();
        } catch {
            showToast("Failed to update task", "error");
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-4 sm:p-6 max-w-md mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                    <BrandLogo />
                    <div>
                        <h1 className="font-bold text-base text-white">{user?.name}</h1>
                        <p className="text-xs text-orange-400 font-semibold">{user?.designation || user?.role}</p>
                    </div>
                </div>

                <button
                    onClick={logout}
                    className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-400 hover:text-white transition-colors"
                    title="Logout"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>

            {/* Giant Clock In / Clock Out Button */}
            <div className="bg-neutral-800 p-6 rounded-3xl border border-neutral-700/60 shadow-xl text-center space-y-4">
                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    {activeAttendance ? "Active Duty Session" : "Ready for Shift?"}
                </div>

                {activeAttendance ? (
                    <div className="space-y-1">
                        <div className="text-3xl font-black text-emerald-400 flex items-center justify-center gap-2">
                            <Clock className="w-8 h-8 animate-pulse" /> ON DUTY
                        </div>
                        <div className="text-xs text-neutral-400">
                            Clocked in at {new Date(activeAttendance.clockInTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                        </div>
                    </div>
                ) : (
                    <div className="text-2xl font-bold text-neutral-300">Off Duty</div>
                )}

                <button
                    onClick={handleClockToggle}
                    disabled={clocking}
                    className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                        activeAttendance
                            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/30"
                            : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-900/30"
                    }`}
                >
                    <MapPin className="w-5 h-5" />
                    {clocking ? "Verifying Geofence..." : activeAttendance ? "CLOCK OUT NOW" : "CLOCK IN NOW"}
                </button>
            </div>

            {/* My Upcoming Shifts */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-bold text-neutral-200">
                    <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-orange-500" /> My Shifts</span>
                    <span className="text-xs text-neutral-500">{myShifts.length} assigned</span>
                </div>

                <div className="space-y-2">
                    {myShifts.length === 0 ? (
                        <div className="p-4 bg-neutral-800/50 rounded-2xl border border-neutral-800 text-xs text-neutral-500 text-center">
                            No shifts scheduled this week.
                        </div>
                    ) : (
                        myShifts.map((shift) => (
                            <div key={shift.id} className="p-3.5 bg-neutral-800 rounded-2xl border border-neutral-700/50 flex items-center justify-between gap-3 text-xs">
                                <div>
                                    <div className="font-bold text-white">
                                        {new Date(shift.shiftDate).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
                                    </div>
                                    <div className="text-neutral-400 font-semibold mt-0.5">
                                        {shift.startTime} - {shift.endTime} ({shift.role})
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleInitiateSwap(shift.id)}
                                    className="px-2.5 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-orange-400 rounded-xl font-semibold transition-colors flex items-center gap-1 text-[11px]"
                                >
                                    <ArrowRightLeft className="w-3 h-3" /> Swap
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* My Checklist & Tasks */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-bold text-neutral-200">
                    <span className="flex items-center gap-2"><CheckSquare className="w-4 h-4 text-orange-500" /> My Tasks</span>
                    <span className="text-xs text-neutral-500">{myTasks.length} total</span>
                </div>

                <div className="space-y-2">
                    {myTasks.length === 0 ? (
                        <div className="p-4 bg-neutral-800/50 rounded-2xl border border-neutral-800 text-xs text-neutral-500 text-center">
                            No assigned tasks.
                        </div>
                    ) : (
                        myTasks.map((t) => (
                            <div
                                key={t.id}
                                onClick={() => handleToggleTask(t.id, t.isCompleted)}
                                className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                    t.isCompleted
                                        ? "bg-neutral-800/40 border-neutral-800 text-neutral-500 line-through"
                                        : "bg-neutral-800 border-neutral-700 text-neutral-200 hover:border-orange-500"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" checked={t.isCompleted} readOnly className="rounded text-orange-600" />
                                    <span className="font-semibold">{t.title}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Shift Swap Modal */}
            {showSwapModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-neutral-800 rounded-3xl max-w-xs w-full p-5 border border-neutral-700 space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-700 pb-3">
                            <h3 className="font-bold text-sm text-white">Swap Shift with Peer</h3>
                            <button onClick={() => setShowSwapModal(false)} className="text-neutral-400 font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSendSwapRequest} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold text-neutral-300 mb-1">Select Peer</label>
                                <select
                                    value={swapTargetUserId}
                                    onChange={(e) => setSwapTargetUserId(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-neutral-700 bg-neutral-900 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                    required
                                >
                                    <option value="">-- Choose Staff Member --</option>
                                    {staffList.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.designation || s.role})</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-sm transition-all"
                            >
                                Send Swap Request
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
