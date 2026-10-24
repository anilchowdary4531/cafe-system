import { useState, useEffect, useCallback } from "react";
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    Bell,
    ChevronRight,
    Play,
    Check,
    ChefHat,
    RefreshCw,
    Search,
    Utensils,
    GlassWater,
} from "lucide-react";
import axios from "axios";
import StaffShell from "../../components/StaffShell";
import { useAuth } from "../../context/AuthContext";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import { playNotificationSound, triggerNotificationVibration } from "../../utils/soundPlayer";
import { getActiveStaffToken } from "../../utils/staffSessionStorage";

export default function StewardStation() {
    const { user, staffToken, token: authContextToken } = useAuth();
    const { socket } = useStaffSocket();

    const [activeTab, setActiveTab] = useState("RUNNER"); // RUNNER | TASKS | MY_WORK | COMPLETED
    const [tasks, setTasks] = useState([]);
    const [readyItems, setReadyItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const token = staffToken || authContextToken || getActiveStaffToken() || (typeof localStorage !== "undefined" ? localStorage.getItem("token") : null);

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("restaurantId") : 1) ||
        1
    );

    const fetchTasks = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/api/v1/staff/tasks`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { restaurantId, roleTarget: "STEWARD" },
            });
            if (res.data?.success) {
                setTasks(res.data.tasks || []);
            }
        } catch (err) {
            console.error("Failed to fetch steward tasks:", err);
        }
    }, [token, restaurantId]);

    const fetchFoodRunnerItems = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/api/v1/staff/food-runner-items`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { restaurantId },
            });
            if (res.data?.success) {
                setReadyItems(res.data.items || []);
            }
        } catch (err) {
            console.error("Failed to fetch food runner items:", err);
        }
    }, [token, restaurantId]);

    const refreshAll = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchTasks(), fetchFoodRunnerItems()]);
        setRefreshing(false);
        setLoading(false);
    }, [fetchTasks, fetchFoodRunnerItems]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // Realtime listeners
    useEffect(() => {
        if (!socket) return;

        const onStewardEvent = () => {
            fetchTasks();
            playNotificationSound();
            triggerNotificationVibration();
            setUnreadCount((c) => c + 1);
        };

        const onFoodReady = () => {
            fetchFoodRunnerItems();
            playNotificationSound();
            triggerNotificationVibration();
            showToast({
                title: "Food Ready to Run!",
                message: "A new dish is ready at the kitchen pass.",
                variant: "info",
            });
        };

        const onFoodDelivered = () => {
            fetchFoodRunnerItems();
        };

        const onTableOrOrderUpdate = () => {
            fetchTasks();
            fetchFoodRunnerItems();
        };

        socket.on("steward:assistance_requested", onStewardEvent);
        socket.on("steward:task_created", onStewardEvent);
        socket.on("cleaner:table_dirty", onStewardEvent);
        socket.on("cleaner:task_created", onStewardEvent);
        socket.on("task:assigned", onStewardEvent);
        socket.on("task:updated", fetchTasks);
        socket.on("task:completed", fetchTasks);
        socket.on("kitchen:item_ready", onFoodReady);
        socket.on("food:delivered", onFoodDelivered);
        socket.on("kot:updated", fetchFoodRunnerItems);
        socket.on("kot:item_updated", fetchFoodRunnerItems);
        socket.on("kot:status_updated", fetchFoodRunnerItems);
        socket.on("table:updated", onTableOrOrderUpdate);
        socket.on("order:updated", onTableOrOrderUpdate);

        return () => {
            socket.off("steward:assistance_requested", onStewardEvent);
            socket.off("steward:task_created", onStewardEvent);
            socket.off("cleaner:table_dirty", onStewardEvent);
            socket.off("cleaner:task_created", onStewardEvent);
            socket.off("task:assigned", onStewardEvent);
            socket.off("task:updated", fetchTasks);
            socket.off("task:completed", fetchTasks);
            socket.off("kitchen:item_ready", onFoodReady);
            socket.off("food:delivered", onFoodDelivered);
            socket.off("kot:updated", fetchFoodRunnerItems);
            socket.off("kot:item_updated", fetchFoodRunnerItems);
            socket.off("kot:status_updated", fetchFoodRunnerItems);
            socket.off("table:updated", onTableOrOrderUpdate);
            socket.off("order:updated", onTableOrOrderUpdate);
        };
    }, [socket, fetchTasks, fetchFoodRunnerItems]);

    // Task Actions
    const handleAcceptTask = async (taskId) => {
        try {
            await axios.put(
                `${API}/api/v1/staff/tasks/${taskId}/accept`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showToast({ title: "Task Accepted", message: "Task assigned to you.", variant: "success" });
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
            showToast({ title: "Task In Progress", message: "Task marked in progress.", variant: "info" });
            fetchTasks();
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.message || "Failed to start task", variant: "error" });
        }
    };

    const handleCompleteTask = async (taskId) => {
        try {
            await axios.put(
                `${API}/api/v1/staff/tasks/${taskId}/finish`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showToast({ title: "Task Completed", message: "Service task marked complete.", variant: "success" });
            fetchTasks();
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.message || "Failed to complete task", variant: "error" });
        }
    };

    const handleDeliverFood = async (itemId, tableNo) => {
        try {
            await axios.put(
                `${API}/api/v1/staff/food-runner-items/${itemId}/delivered`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showToast({
                title: "Food Delivered",
                message: `Order served to Table ${tableNo || ""}.`,
                variant: "success",
            });
            fetchFoodRunnerItems();
        } catch (err) {
            showToast({ title: "Error", message: "Failed to mark item delivered", variant: "error" });
        }
    };

    const staffId = user?.id;
    const pendingTasks = tasks.filter((t) => t.status === "PENDING");
    const myActiveTasks = tasks.filter(
        (t) => (t.status === "ACCEPTED" || t.status === "IN_PROGRESS") && t.assignedTo === staffId
    );
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED");

    const tabs = [
        { id: "RUNNER", label: "Food Runner", icon: ChefHat, badge: readyItems.length },
        { id: "TASKS", label: "Service Queue", icon: Bell, badge: pendingTasks.length },
        { id: "MY_WORK", label: "My Active", icon: Play, badge: myActiveTasks.length },
        { id: "COMPLETED", label: "Completed", icon: CheckCircle2, badge: completedTasks.length },
    ];

    return (
        <StaffShell
            title="Steward Station — Floor Service & Food Runner"
            designation="STEWARD"
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabs}
            unreadNotificationCount={unreadCount}
            actions={
                <button
                    type="button"
                    onClick={refreshAll}
                    disabled={refreshing}
                    className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-200 dark:border-slate-700/60"
                    title="Refresh data"
                    aria-label="Refresh steward workstation data"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
            }
        >
            <div className="space-y-3.5 sm:space-y-4">
                {/* Status KPI summary banner */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    <div
                        onClick={() => setActiveTab("RUNNER")}
                        className={`cursor-pointer p-2.5 sm:p-3 rounded-xl border transition-all ${
                            activeTab === "RUNNER"
                                ? "bg-orange-500/10 border-orange-500 text-orange-950 dark:text-orange-100 shadow-xs ring-1 ring-orange-500/30"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                    >
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span className="truncate">Ready to Run</span>
                            <ChefHat className="w-4 h-4 text-orange-500 shrink-0" />
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                            {readyItems.length}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Kitchen pass dishes</div>
                    </div>

                    <div
                        onClick={() => setActiveTab("TASKS")}
                        className={`cursor-pointer p-2.5 sm:p-3 rounded-xl border transition-all ${
                            activeTab === "TASKS"
                                ? "bg-amber-500/10 border-amber-500 text-amber-950 dark:text-amber-100 shadow-xs ring-1 ring-amber-500/30"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                    >
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span className="truncate">Pending Requests</span>
                            <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                            {pendingTasks.length}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Water, cutlery, setup</div>
                    </div>

                    <div
                        onClick={() => setActiveTab("MY_WORK")}
                        className={`cursor-pointer p-2.5 sm:p-3 rounded-xl border transition-all ${
                            activeTab === "MY_WORK"
                                ? "bg-blue-500/10 border-blue-500 text-blue-950 dark:text-blue-100 shadow-xs ring-1 ring-blue-500/30"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                    >
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span className="truncate">My In-Progress</span>
                            <Play className="w-4 h-4 text-blue-500 shrink-0" />
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                            {myActiveTasks.length}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Assigned to me</div>
                    </div>

                    <div
                        onClick={() => setActiveTab("COMPLETED")}
                        className={`cursor-pointer p-2.5 sm:p-3 rounded-xl border transition-all ${
                            activeTab === "COMPLETED"
                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-xs ring-1 ring-emerald-500/30"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                    >
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span className="truncate">Done Today</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                            {completedTasks.length}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Services delivered</div>
                    </div>
                </div>

                {/* Tab 1: Food Runner Queue */}
                {activeTab === "RUNNER" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800/80">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <ChefHat className="w-4 h-4 text-orange-500" />
                                <span>Kitchen Pass — Ready Food to Run</span>
                            </h2>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {readyItems.length} {readyItems.length === 1 ? "dish ready" : "dishes ready"}
                            </span>
                        </div>

                        {readyItems.length === 0 ? (
                            <div className="py-7 px-4 text-center bg-white/60 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <ChefHat className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Food Waiting</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm mx-auto">
                                    All prepared food has been delivered to tables. New ready dishes will alert in realtime.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                                {readyItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between gap-3 hover:border-orange-500/50 transition"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="px-2 py-0.5 rounded-lg bg-orange-600 text-white font-black text-xs shadow-xs">
                                                    Table {item.kot?.tableNo || "N/A"}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    KOT #{item.kot?.kotNo || item.kot?.tokenNo || item.kotId}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base mt-2">
                                                {item.qty || item.quantity || 1}x {item.itemName || item.name}
                                            </h3>
                                            {item.notes && (
                                                <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 mt-1.5">
                                                    Note: {item.notes}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDeliverFood(item.id, item.kot?.tableNo)}
                                            className="w-full py-2 sm:py-2.5 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 min-h-[42px] shadow-xs active:scale-[0.99]"
                                        >
                                            <Check className="w-4 h-4" />
                                            Deliver to Table {item.kot?.tableNo}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 2: Service Tasks Queue (Pending Requests) */}
                {activeTab === "TASKS" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800/80">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Bell className="w-4 h-4 text-amber-500" />
                                <span>Service & Table Assistance Requests</span>
                            </h2>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {pendingTasks.length} {pendingTasks.length === 1 ? "request" : "requests"} pending
                            </span>
                        </div>

                        {pendingTasks.length === 0 ? (
                            <div className="py-7 px-4 text-center bg-white/60 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Pending Requests</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm mx-auto">
                                    All floor assistance requests are claimed or completed.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {pendingTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/40 transition"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                                    {task.category || "SERVICE"}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-600 text-white shadow-xs">
                                                        Table {task.table.tableNo}
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    Requested by: {task.requestedByUser?.name || "Server"}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                                                {task.title}
                                            </h3>
                                            {task.description && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{task.description}</p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleAcceptTask(task.id)}
                                            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 min-h-[42px] shrink-0 shadow-xs active:scale-[0.99] w-full sm:w-auto"
                                        >
                                            <Play className="w-4 h-4" />
                                            Accept Task
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 3: My Active Tasks */}
                {activeTab === "MY_WORK" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800/80">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Play className="w-4 h-4 text-blue-500" />
                                <span>Tasks Claimed by Me</span>
                            </h2>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {myActiveTasks.length} {myActiveTasks.length === 1 ? "task" : "tasks"} active
                            </span>
                        </div>

                        {myActiveTasks.length === 0 ? (
                            <div className="py-7 px-4 text-center bg-white/60 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <Play className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Active Tasks Claimed</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm mx-auto">
                                    Claim a task from the Service Queue or deliver ready food dishes.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {myActiveTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                    task.status === "IN_PROGRESS"
                                                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                                                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                                }`}>
                                                    {task.status}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-600 text-white shadow-xs">
                                                        Table {task.table.tableNo}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{task.title}</h3>
                                            {task.description && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{task.description}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {task.status === "ACCEPTED" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartTask(task.id)}
                                                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition min-h-[42px] shadow-xs"
                                                >
                                                    Start Working
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleCompleteTask(task.id)}
                                                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 min-h-[42px] shadow-xs"
                                            >
                                                <Check className="w-4 h-4" />
                                                Mark Completed
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 4: Completed Tasks */}
                {activeTab === "COMPLETED" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800/80">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span>Tasks Completed Today</span>
                            </h2>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {completedTasks.length} {completedTasks.length === 1 ? "task" : "tasks"} finished
                            </span>
                        </div>

                        {completedTasks.length === 0 ? (
                            <div className="py-7 px-4 text-center bg-white/60 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <CheckCircle2 className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Completed Tasks Yet</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm mx-auto">
                                    Completed services and deliveries will be logged here for today's shift.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {completedTasks.slice(0, 30).map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <div>
                                                <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">{task.title}</div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    {task.table?.tableNo ? `Table ${task.table.tableNo} • ` : ""}
                                                    {task.completedAt ? new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Today"}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                            Done
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
