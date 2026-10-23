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
            // Find existing task or complete it
            const existingTask = tasks.find((t) => t.tableId === table.id && !t.isCompleted);
            if (existingTask) {
                await handleMarkCleanAndReady(existingTask.id, table.tableNo);
            } else {
                // Create & complete instant task
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
        { id: "MY_WORK", label: "My In-Progress", icon: Play, badge: myActiveTasks.length },
        { id: "COMPLETED", label: "Cleaned Today", icon: CheckCircle2, badge: completedTasks.length },
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
                    className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition min-h-[44px] min-w-[44px] flex items-center justify-center border border-neutral-700/60"
                    title="Refresh data"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
            }
        >
            <div className="space-y-6">
                {/* KPI Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div
                        onClick={() => setActiveTab("TABLES")}
                        className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                            activeTab === "TABLES"
                                ? "bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/30"
                                : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                        }`}
                    >
                        <div className="text-xs font-semibold text-neutral-400 flex items-center justify-between">
                            <span>Dirty Tables</span>
                            <Sparkles className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                            {dirtyTables.length}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">Need busing & sanitize</div>
                    </div>

                    <div
                        onClick={() => setActiveTab("CHECKLIST")}
                        className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                            activeTab === "CHECKLIST"
                                ? "bg-orange-950/40 border-orange-500/60 shadow-lg shadow-orange-950/30"
                                : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                        }`}
                    >
                        <div className="text-xs font-semibold text-neutral-400 flex items-center justify-between">
                            <span>Cleaning Queue</span>
                            <Bell className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                            {pendingTasks.length}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">Spills & checklists</div>
                    </div>

                    <div
                        onClick={() => setActiveTab("MY_WORK")}
                        className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                            activeTab === "MY_WORK"
                                ? "bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-950/30"
                                : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                        }`}
                    >
                        <div className="text-xs font-semibold text-neutral-400 flex items-center justify-between">
                            <span>My Tasks</span>
                            <Play className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                            {myActiveTasks.length}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">Currently cleaning</div>
                    </div>

                    <div
                        onClick={() => setActiveTab("COMPLETED")}
                        className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                            activeTab === "COMPLETED"
                                ? "bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/30"
                                : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                        }`}
                    >
                        <div className="text-xs font-semibold text-neutral-400 flex items-center justify-between">
                            <span>Sanitized Today</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                            {completedTasks.length}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">Tables & areas clean</div>
                    </div>
                </div>

                {/* Tab 1: Dirty Tables (Strict Sanitation) */}
                {activeTab === "TABLES" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-amber-400" />
                                Tables Awaiting Sanitation ({dirtyTables.length})
                            </h2>
                            <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                                Strict Sanitation Active
                            </span>
                        </div>

                        {dirtyTables.length === 0 ? (
                            <div className="p-12 text-center bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                                <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-neutral-200">All Tables Sanitized & Ready</h3>
                                <p className="text-xs text-neutral-400 mt-1">
                                    No tables currently need cleaning. When dining sessions complete, dirty tables appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {dirtyTables.map((tbl) => (
                                    <div
                                        key={tbl.id}
                                        className="bg-neutral-900 border border-amber-500/40 rounded-2xl p-4 shadow-md flex flex-col justify-between gap-4"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="px-3 py-1 rounded-xl bg-orange-600 text-white font-extrabold text-sm">
                                                    Table {tbl.tableNo}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                                                    DIRTY
                                                </span>
                                            </div>
                                            <div className="text-xs text-neutral-300 mt-2">
                                                Section: {tbl.section || "Main Floor"} • {tbl.seats || 4} Seats
                                            </div>
                                            <p className="text-xs text-neutral-400 mt-1">
                                                Dining session completed. Clean and sanitize surface before new guests arrive.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleQuickSanitizeTable(tbl)}
                                            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 min-h-[44px]"
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
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <Bell className="w-5 h-5 text-orange-400" />
                                Cleaning Tasks & Sanitation Queue
                            </h2>
                            <span className="text-xs text-neutral-400">
                                {pendingTasks.length} pending
                            </span>
                        </div>

                        {pendingTasks.length === 0 ? (
                            <div className="p-12 text-center bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-neutral-200">Queue is Clear</h3>
                                <p className="text-xs text-neutral-400 mt-1">
                                    No pending spills, floor mops, or washroom tasks waiting.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                    {task.taskType || task.category || "CLEANING"}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-600 text-white">
                                                        Table {task.table.tableNo}
                                                    </span>
                                                )}
                                                {task.priority === "HIGH" || task.priority === "URGENT" ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                                        URGENT
                                                    </span>
                                                ) : null}
                                            </div>
                                            <h3 className="font-bold text-white text-base">{task.title}</h3>
                                            {task.description && (
                                                <p className="text-xs text-neutral-400">{task.description}</p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleAcceptTask(task.id)}
                                            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 min-h-[44px] shrink-0"
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
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <Play className="w-5 h-5 text-blue-400" />
                                Sanitation Tasks Claimed by Me
                            </h2>
                            <span className="text-xs text-neutral-400">
                                {myActiveTasks.length} active
                            </span>
                        </div>

                        {myActiveTasks.length === 0 ? (
                            <div className="p-12 text-center bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                                <Play className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-neutral-200">No Tasks in Progress</h3>
                                <p className="text-xs text-neutral-400 mt-1">
                                    Claim a dirty table or queue task to begin cleaning.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {myActiveTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    task.status === "IN_PROGRESS"
                                                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                                }`}>
                                                    {task.status}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-600 text-white">
                                                        Table {task.table.tableNo}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-white text-base">{task.title}</h3>
                                            {task.description && (
                                                <p className="text-xs text-neutral-400">{task.description}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {task.status === "ACCEPTED" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartTask(task.id)}
                                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition min-h-[44px]"
                                                >
                                                    Start Cleaning
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleMarkCleanAndReady(task.id, task.table?.tableNo)}
                                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5 min-h-[44px]"
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
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                Sanitized & Released Today
                            </h2>
                            <span className="text-xs text-neutral-400">
                                {completedTasks.length} completed
                            </span>
                        </div>

                        {completedTasks.length === 0 ? (
                            <div className="p-12 text-center bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                                <CheckCircle2 className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-neutral-200">No Cleaning Logs Today</h3>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {completedTasks.slice(0, 25).map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-neutral-300"
                                    >
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                            <div>
                                                <div className="font-semibold text-sm text-white">{task.title}</div>
                                                <div className="text-xs text-neutral-500">
                                                    {task.table?.tableNo ? `Table ${task.table.tableNo} • ` : ""}
                                                    {task.completedAt ? new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Today"}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
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
