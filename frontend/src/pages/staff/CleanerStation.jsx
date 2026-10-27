import { useState, useEffect, useCallback } from "react";
import {
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Play,
    Check,
    RefreshCw,
    Wrench,
    Trash2,
    ShieldCheck,
    Bell,
} from "lucide-react";
import axios from "axios";
import StaffShell from "../../components/StaffShell";
import { useAuth } from "../../context/AuthContext";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import { playNotificationSound, triggerNotificationVibration } from "../../utils/soundPlayer";

export default function CleanerStation() {
    const { user, token } = useAuth();
    const { socket } = useStaffSocket();

    const [activeTab, setActiveTab] = useState("TABLES"); // TABLES | CHECKLIST | MY_WORK | COMPLETED
    const [tasks, setTasks] = useState([]);
    const [dirtyTables, setDirtyTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        localStorage.getItem("restaurantId") ||
        1
    );

    const fetchTasks = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/api/v1/staff/tasks`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { restaurantId, roleTarget: "CLEANER" },
            });
            if (res.data?.success) {
                setTasks(res.data.tasks || []);
            }
        } catch (err) {
            console.error("Failed to fetch cleaner tasks:", err);
        }
    }, [token, restaurantId]);

    const fetchTables = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/tables`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { restaurantId },
            });
            const list = res.data?.tables || res.data || [];
            const dirty = list.filter((t) => t.cleaningStatus === "DIRTY" || t.status === "DIRTY");
            setDirtyTables(dirty);
        } catch (err) {
            console.error("Failed to fetch dirty tables:", err);
        }
    }, [token, restaurantId]);

    const refreshAll = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchTasks(), fetchTables()]);
        setRefreshing(false);
        setLoading(false);
    }, [fetchTasks, fetchTables]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // Socket realtime listeners
    useEffect(() => {
        if (!socket) return;

        const onCleaningAlert = (data) => {
            fetchTasks();
            fetchTables();
            playNotificationSound();
            triggerNotificationVibration();
            setUnreadCount((c) => c + 1);
            showToast({
                title: "Cleaning Alert!",
                message: `Table ${data?.tableNo || ""} requires sanitation.`,
                variant: "error",
            });
        };

        const onTableUpdated = () => {
            fetchTasks();
            fetchTables();
        };

        socket.on("cleaner:table_dirty", onCleaningAlert);
        socket.on("cleaner:task_created", onCleaningAlert);
        socket.on("cleaner:urgent_alert", onCleaningAlert);
        socket.on("table:updated", onTableUpdated);
        socket.on("task:updated", fetchTasks);
        socket.on("task:completed", fetchTasks);

        return () => {
            socket.off("cleaner:table_dirty", onCleaningAlert);
            socket.off("cleaner:task_created", onCleaningAlert);
            socket.off("cleaner:urgent_alert", onCleaningAlert);
            socket.off("table:updated", onTableUpdated);
            socket.off("task:updated", fetchTasks);
            socket.off("task:completed", fetchTasks);
        };
    }, [socket, fetchTasks, fetchTables]);

    // Cleaner Actions
    const handleAcceptTask = async (taskId) => {
        try {
            await axios.put(
                `${API}/api/v1/staff/tasks/${taskId}/accept`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showToast({ title: "Task Claimed", message: "Sanitation task claimed by you.", variant: "success" });
            fetchTasks();
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.message || "Failed to accept task", variant: "error" });
        }
    };

    const handleStartTask = async (taskId) => {
        try {
            await axios.put(
                `${API}/api/v1/staff/tasks/${taskId}/start`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showToast({ title: "Cleaning In Progress", message: "Cleaning started.", variant: "info" });
            fetchTasks();
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.message || "Failed to start task", variant: "error" });
        }
    };

    const handleMarkCleanAndReady = async (taskId, tableNo) => {
        try {
            await axios.put(
                `${API}/api/v1/staff/tasks/${taskId}/finish`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showToast({
                title: "Table Cleaned & Ready!",
                message: `Table ${tableNo || ""} is now sanitized and available for guests.`,
                variant: "success",
            });
            fetchTasks();
            fetchTables();
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.message || "Failed to complete cleaning", variant: "error" });
        }
    };

    // Quick direct sanitation if table is dirty but task not claimed
    const handleQuickSanitizeTable = async (table) => {
        try {
            const existingTask = tasks.find((t) => t.tableId === table.id && !t.isCompleted);
            if (existingTask) {
                await handleMarkCleanAndReady(existingTask.id, table.tableNo);
            } else {
                const createRes = await axios.post(
                    `${API}/api/v1/staff/tasks/request`,
                    {
                        restaurantId,
                        tableId: table.id,
                        title: `Clean Table ${table.tableNo}`,
                        category: "CLEANING",
                        taskType: "TABLE_BUS_AND_SANITIZE",
                        roleTarget: "CLEANER",
                        priority: "HIGH",
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const createdTask = createRes.data?.task;
                if (createdTask?.id) {
                    await handleMarkCleanAndReady(createdTask.id, table.tableNo);
                }
            }
        } catch (err) {
            showToast({ title: "Error", message: "Failed to sanitize table", variant: "error" });
        }
    };

    const staffId = user?.id;
    const pendingTasks = tasks.filter((t) => t.status === "PENDING");
    const myActiveTasks = tasks.filter(
        (t) => (t.status === "ACCEPTED" || t.status === "IN_PROGRESS") && t.assignedTo === staffId
    );
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED");

    const tabs = [
        { id: "TABLES", label: "Dirty Tables", icon: Sparkles, badge: dirtyTables.length },
        { id: "CHECKLIST", label: "Cleaning Queue", icon: Bell, badge: pendingTasks.length },
        { id: "MY_WORK", label: "My Tasks", icon: Play, badge: myActiveTasks.length },
        { id: "COMPLETED", label: "Sanitized Today", icon: CheckCircle2, badge: completedTasks.length },
    ];

    return (
        <StaffShell
            title="Cleaner Station — Sanitation & Table Turnover"
            designation="CLEANER"
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabs}
            unreadNotificationCount={unreadCount}
            actions={
                <button
                    type="button"
                    onClick={refreshAll}
                    disabled={refreshing}
                    className="p-2 sm:p-2.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#57534E] hover:text-[#171717] transition min-h-[38px] min-w-[38px] flex items-center justify-center border border-[#E7E5E4] shadow-xs cursor-pointer"
                    title="Refresh data"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
            }
        >
            <div className="space-y-4">
                {/* KPI Overview - Compact operational metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                    <div
                        onClick={() => setActiveTab("TABLES")}
                        className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all ${
                            activeTab === "TABLES"
                                ? "bg-[#FFFBEB] border-[#D97706]/50 shadow-xs ring-1 ring-[#D97706]/30"
                                : "bg-white border-[#E7E5E4] hover:border-[#D97706]/40 hover:bg-[#FFFBEB]/40"
                        }`}
                    >
                        <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between">
                            <span>Dirty Tables</span>
                            <Sparkles className="w-4 h-4 text-[#D97706]" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                            {dirtyTables.length}
                        </div>
                        <div className="text-[11px] text-[#78716C] mt-0.5">Need busing & sanitize</div>
                    </div>

                    <div
                        onClick={() => setActiveTab("CHECKLIST")}
                        className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all ${
                            activeTab === "CHECKLIST"
                                ? "bg-[#FFF7ED] border-[#F97316]/50 shadow-xs ring-1 ring-[#F97316]/30"
                                : "bg-white border-[#E7E5E4] hover:border-[#F97316]/40 hover:bg-[#FFF7ED]/40"
                        }`}
                    >
                        <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between">
                            <span>Cleaning Queue</span>
                            <Bell className="w-4 h-4 text-[#F97316]" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                            {pendingTasks.length}
                        </div>
                        <div className="text-[11px] text-[#78716C] mt-0.5">Spills & checklists</div>
                    </div>

                    <div
                        onClick={() => setActiveTab("MY_WORK")}
                        className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all ${
                            activeTab === "MY_WORK"
                                ? "bg-[#F0F9FF] border-[#0284C7]/50 shadow-xs ring-1 ring-[#0284C7]/30"
                                : "bg-white border-[#E7E5E4] hover:border-[#0284C7]/40 hover:bg-[#F0F9FF]/40"
                        }`}
                    >
                        <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between">
                            <span>My Tasks</span>
                            <Play className="w-4 h-4 text-[#0284C7]" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                            {myActiveTasks.length}
                        </div>
                        <div className="text-[11px] text-[#78716C] mt-0.5">Currently cleaning</div>
                    </div>

                    <div
                        onClick={() => setActiveTab("COMPLETED")}
                        className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all ${
                            activeTab === "COMPLETED"
                                ? "bg-[#ECFDF5] border-[#059669]/50 shadow-xs ring-1 ring-[#059669]/30"
                                : "bg-white border-[#E7E5E4] hover:border-[#059669]/40 hover:bg-[#ECFDF5]/40"
                        }`}
                    >
                        <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between">
                            <span>Sanitized Today</span>
                            <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                            {completedTasks.length}
                        </div>
                        <div className="text-[11px] text-[#78716C] mt-0.5">Tables & areas clean</div>
                    </div>
                </div>

                {/* Tab 1: Dirty Tables (Strict Sanitation) */}
                {activeTab === "TABLES" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-[#D97706]" />
                                Tables Awaiting Sanitation ({dirtyTables.length})
                            </h2>
                            <span className="text-xs text-[#D97706] font-bold bg-[#FFFBEB] px-2.5 py-1 rounded-full border border-[#D97706]/30">
                                Strict Sanitation Active
                            </span>
                        </div>

                        {dirtyTables.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <ShieldCheck className="w-12 h-12 text-[#059669] mx-auto mb-3" />
                                <h3 className="text-base font-bold text-[#171717]">All Tables Sanitized & Ready</h3>
                                <p className="text-xs text-[#57534E] mt-1">
                                    No tables currently need cleaning. When dining sessions complete, dirty tables appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                {dirtyTables.map((tbl) => (
                                    <div
                                        key={tbl.id}
                                        className="bg-white border border-[#E7E5E4] hover:border-[#D97706]/40 rounded-xl p-3.5 shadow-xs flex flex-col justify-between gap-3 transition-colors"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="px-2.5 py-1 rounded-lg bg-[#F97316] text-white font-extrabold text-xs sm:text-sm shadow-xs">
                                                    Table {tbl.tableNo}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30 animate-pulse">
                                                    DIRTY
                                                </span>
                                            </div>
                                            <div className="text-xs font-semibold text-[#57534E] mt-2.5">
                                                Section: {tbl.section || "Main Hall"} · {tbl.seats || 4} Seats
                                            </div>
                                            <p className="text-xs text-[#78716C] mt-1">
                                                Dining session completed. Clean and sanitize surface before new guests arrive.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleQuickSanitizeTable(tbl)}
                                            className="w-full py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 min-h-[40px] shadow-xs cursor-pointer"
                                        >
                                            <Check className="w-4 h-4" />
                                            Mark Clean & Available
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 2: Cleaning Queue / Requests */}
                {activeTab === "CHECKLIST" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2">
                                <Bell className="w-5 h-5 text-[#F97316]" />
                                Cleaning Tasks & Sanitation Queue
                            </h2>
                            <span className="text-xs font-semibold text-[#57534E]">
                                {pendingTasks.length} pending
                            </span>
                        </div>

                        {pendingTasks.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <CheckCircle2 className="w-12 h-12 text-[#059669]/50 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-[#171717]">Queue is Clear</h3>
                                <p className="text-xs text-[#57534E] mt-1">
                                    No pending spills, floor mops, or washroom tasks waiting.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {pendingTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white border border-[#E7E5E4] hover:border-[#F97316]/30 rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30">
                                                    {task.taskType || task.category || "CLEANING"}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F97316] text-white">
                                                        Table {task.table.tableNo}
                                                    </span>
                                                )}
                                                {task.priority === "HIGH" || task.priority === "URGENT" ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/30">
                                                        URGENT
                                                    </span>
                                                ) : null}
                                            </div>
                                            <h3 className="font-bold text-[#171717] text-sm sm:text-base">{task.title}</h3>
                                            {task.description && (
                                                <p className="text-xs text-[#57534E]">{task.description}</p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleAcceptTask(task.id)}
                                            className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 min-h-[38px] shrink-0 shadow-xs cursor-pointer"
                                        >
                                            <Play className="w-4 h-4" />
                                            Claim Task
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 3: My In-Progress Tasks */}
                {activeTab === "MY_WORK" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2">
                                <Play className="w-5 h-5 text-[#0284C7]" />
                                Sanitation Tasks Claimed by Me
                            </h2>
                            <span className="text-xs font-semibold text-[#57534E]">
                                {myActiveTasks.length} active
                            </span>
                        </div>

                        {myActiveTasks.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <Play className="w-12 h-12 text-[#78716C] mx-auto mb-3" />
                                <h3 className="text-base font-bold text-[#171717]">No Tasks in Progress</h3>
                                <p className="text-xs text-[#57534E] mt-1">
                                    Claim a dirty table or queue task to begin cleaning.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {myActiveTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white border border-[#E7E5E4] hover:border-[#0284C7]/30 rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    task.status === "IN_PROGRESS"
                                                        ? "bg-[#F0F9FF] text-[#0284C7] border border-[#0284C7]/30"
                                                        : "bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30"
                                                }`}>
                                                    {task.status}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F97316] text-white">
                                                        Table {task.table.tableNo}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-[#171717] text-sm sm:text-base">{task.title}</h3>
                                            {task.description && (
                                                <p className="text-xs text-[#57534E]">{task.description}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {task.status === "ACCEPTED" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartTask(task.id)}
                                                    className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs transition min-h-[38px] shadow-xs cursor-pointer"
                                                >
                                                    Start Cleaning
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleMarkCleanAndReady(task.id, task.table?.tableNo)}
                                                className="px-3.5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs transition flex items-center gap-1.5 min-h-[38px] shadow-xs cursor-pointer"
                                            >
                                                <Check className="w-4 h-4" />
                                                Mark Clean & Available
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 4: Completed Cleaning Tasks */}
                {activeTab === "COMPLETED" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-[#059669]" />
                                Sanitized & Released Today
                            </h2>
                            <span className="text-xs font-semibold text-[#57534E]">
                                {completedTasks.length} completed
                            </span>
                        </div>

                        {completedTasks.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <CheckCircle2 className="w-12 h-12 text-[#78716C] mx-auto mb-3" />
                                <h3 className="text-base font-bold text-[#171717]">No Cleaning Logs Today</h3>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {completedTasks.slice(0, 25).map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white border border-[#E7E5E4] rounded-xl p-3 flex items-center justify-between gap-3 text-[#57534E] shadow-xs"
                                    >
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0" />
                                            <div>
                                                <div className="font-bold text-sm text-[#171717]">{task.title}</div>
                                                <div className="text-xs text-[#78716C]">
                                                    {task.table?.tableNo ? `Table ${task.table.tableNo} · ` : ""}
                                                    {task.completedAt ? new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Today"}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-[#059669] px-2.5 py-0.5 rounded-full bg-[#ECFDF5] border border-[#059669]/20">
                                            Cleaned
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </StaffShell>
    );
}
