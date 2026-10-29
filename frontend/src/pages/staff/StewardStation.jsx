import { useState, useEffect, useCallback } from "react";
import {
    Utensils,
    GlassWater,
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
    Send,
    AlertTriangle,
    Layers,
} from "lucide-react";
import axios from "axios";
import StaffShell from "../../components/StaffShell";
import { useAuth } from "../../context/AuthContext";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import { playNotificationSound, triggerNotificationVibration } from "../../utils/soundPlayer";
import useStaffCapabilities from "../../hooks/useStaffCapabilities";

export default function StewardStation() {
    const { user, token } = useAuth();
    const { socket } = useStaffSocket();

    const [activeTab, setActiveTab] = useState("RUNNER"); // RUNNER | TASKS | MY_WORK | COMPLETED
    const [tasks, setTasks] = useState([]);
    const [readyItems, setReadyItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        localStorage.getItem("restaurantId") ||
        1
    );

    const { hasSteward } = useStaffCapabilities(restaurantId);

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

        socket.on("steward:assistance_requested", onStewardEvent);
        socket.on("steward:task_created", onStewardEvent);
        socket.on("task:assigned", onStewardEvent);
        socket.on("task:updated", fetchTasks);
        socket.on("task:completed", fetchTasks);
        socket.on("kitchen:item_ready", onFoodReady);
        socket.on("kot:updated", fetchFoodRunnerItems);

        return () => {
            socket.off("steward:assistance_requested", onStewardEvent);
            socket.off("steward:task_created", onStewardEvent);
            socket.off("task:assigned", onStewardEvent);
            socket.off("task:updated", fetchTasks);
            socket.off("task:completed", fetchTasks);
            socket.off("kitchen:item_ready", onFoodReady);
            socket.off("kot:updated", fetchFoodRunnerItems);
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
                    className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition min-h-[44px] min-w-[44px] flex items-center justify-center border border-neutral-700/60"
                    title="Refresh data"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
            }
        >
            <div className="space-y-4 max-w-7xl mx-auto w-full min-w-0">
                {!hasSteward && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 p-4 rounded-xl mb-4 shadow-xs" role="alert">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <div>
                                <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">Steward Station Inactive</h4>
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    No active staff members with <strong>Steward</strong> designation are currently configured for this restaurant. Operational food running and table assistance are handled directly by Servers.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status KPI summary banner */}
                <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveTab("RUNNER")}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("RUNNER"); } }}
                        className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all min-h-[80px] flex flex-col justify-between ${
                            activeTab === "RUNNER"
                                ? "bg-[#FFF7ED] border-[#F97316] shadow-xs ring-1 ring-[#F97316]/30"
                                : "bg-white border-[#E7E5E4] hover:border-[#F97316]/40 hover:bg-[#FFF7ED]/30"
                        }`}
                    >
                        <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between gap-1">
                            <span className="truncate">Ready to Run</span>
                            <ChefHat className="w-4 h-4 text-[#EA580C] shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                            {readyItems.length}
                        </div>
                        <div className="text-[11px] text-[#78716C] mt-0.5 truncate">Kitchen pass dishes</div>
                    </div>

                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveTab("TASKS")}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("TASKS"); } }}
                        className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all min-h-[80px] flex flex-col justify-between ${
                            activeTab === "TASKS"
                                ? "bg-[#FFF7ED] border-[#F97316] shadow-xs ring-1 ring-[#F97316]/30"
                                : "bg-white border-[#E7E5E4] hover:border-[#F97316]/40 hover:bg-[#FFF7ED]/30"
                        }`}
                    >
                        <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between gap-1">
                            <span className="truncate">Pending Requests</span>
                            <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                            {pendingTasks.length}
                        </div>
                        <div className="text-[11px] text-[#78716C] mt-0.5 truncate">Water, cutlery, setup</div>
                    </div>

                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveTab("MY_WORK")}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("MY_WORK"); } }}
                        className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all min-h-[80px] flex flex-col justify-between ${
                            activeTab === "MY_WORK"
                                ? "bg-[#FFF7ED] border-[#F97316] shadow-xs ring-1 ring-[#F97316]/30"
                                : "bg-white border-[#E7E5E4] hover:border-[#F97316]/40 hover:bg-[#FFF7ED]/30"
                        }`}
                    >
                        <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between gap-1">
                            <span className="truncate">My In-Progress</span>
                            <Play className="w-4 h-4 text-sky-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                            {myActiveTasks.length}
                        </div>
                        <div className="text-[11px] text-[#78716C] mt-0.5 truncate">Assigned to me</div>
                    </div>

                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveTab("COMPLETED")}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("COMPLETED"); } }}
                        className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all min-h-[80px] flex flex-col justify-between ${
                            activeTab === "COMPLETED"
                                ? "bg-[#FFF7ED] border-[#F97316] shadow-xs ring-1 ring-[#F97316]/30"
                                : "bg-white border-[#E7E5E4] hover:border-[#F97316]/40 hover:bg-[#FFF7ED]/30"
                        }`}
                    >
                        <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between gap-1">
                            <span className="truncate">Done Today</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                            {completedTasks.length}
                        </div>
                        <div className="text-[11px] text-[#78716C] mt-0.5 truncate">Services delivered</div>
                    </div>
                </div>

                {/* Tab 1: Food Runner Queue */}
                {activeTab === "RUNNER" && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                            <h2 className="text-sm min-[380px]:text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2 min-w-0">
                                <ChefHat className="w-5 h-5 text-[#EA580C] shrink-0" />
                                <span className="truncate">Kitchen Pass — Ready Food to Run</span>
                            </h2>
                            <span className="text-xs text-[#57534E] self-start sm:self-auto shrink-0">
                                {readyItems.length} {readyItems.length === 1 ? "item" : "items"} ready
                            </span>
                        </div>

                        {readyItems.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <ChefHat className="w-12 h-12 text-[#78716C] mx-auto mb-3" />
                                <h3 className="text-base font-bold text-[#171717]">No Food Waiting</h3>
                                <p className="text-xs text-[#57534E] mt-1">
                                    All prepared food has been delivered to tables. New ready items will alert in realtime.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {readyItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white border border-[#E7E5E4] rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-orange-300 transition"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <span className="px-2.5 py-1 rounded-xl bg-[#F97316] text-white font-extrabold text-xs shrink-0">
                                                    Table {item.kot?.tableNo || "N/A"}
                                                </span>
                                                <span className="text-xs text-[#57534E] shrink-0">
                                                    KOT #{item.kot?.kotNo || item.kot?.tokenNo || item.kotId}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-[#171717] text-sm sm:text-base mt-2 break-words">
                                                {item.qty || item.quantity || 1}x {item.itemName || item.name}
                                            </h3>
                                            {item.notes && (
                                                <p className="text-xs text-amber-800 mt-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 break-words">
                                                    Note: {item.notes}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDeliverFood(item.id, item.kot?.tableNo)}
                                            className="w-full py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 min-h-[42px] shadow-xs cursor-pointer active:scale-[0.99]"
                                        >
                                            <Check className="w-4 h-4 shrink-0" />
                                            <span>Deliver to Table {item.kot?.tableNo}</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 2: Service Tasks Queue (Pending Requests) */}
                {activeTab === "TASKS" && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                            <h2 className="text-sm min-[380px]:text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2 min-w-0">
                                <Bell className="w-5 h-5 text-amber-600 shrink-0" />
                                <span className="truncate">Service & Table Assistance Requests</span>
                            </h2>
                            <span className="text-xs text-[#57534E] self-start sm:self-auto shrink-0">
                                {pendingTasks.length} pending
                            </span>
                        </div>

                        {pendingTasks.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-[#171717]">No Pending Requests</h3>
                                <p className="text-xs text-[#57534E] mt-1">
                                    All floor assistance requests are claimed or completed.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white border border-[#E7E5E4] rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-stone-300 transition"
                                    >
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                                    {task.category || "SERVICE"}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F97316] text-white shrink-0">
                                                        Table {task.table.tableNo}
                                                    </span>
                                                )}
                                                <span className="text-xs text-[#57534E] shrink-0">
                                                    Requested by: {task.requestedByUser?.name || "Server"}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-[#171717] text-sm sm:text-base break-words">
                                                {task.title}
                                            </h3>
                                            {task.description && (
                                                <p className="text-xs text-[#57534E] break-words">{task.description}</p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleAcceptTask(task.id)}
                                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 min-h-[40px] shrink-0 shadow-xs cursor-pointer active:scale-[0.99]"
                                        >
                                            <Play className="w-4 h-4 shrink-0" />
                                            <span>Accept Task</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 3: My Active Tasks */}
                {activeTab === "MY_WORK" && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                            <h2 className="text-sm min-[380px]:text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2 min-w-0">
                                <Play className="w-5 h-5 text-sky-600 shrink-0" />
                                <span className="truncate">Tasks Claimed by Me</span>
                            </h2>
                            <span className="text-xs text-[#57534E] self-start sm:self-auto shrink-0">
                                {myActiveTasks.length} in progress
                            </span>
                        </div>

                        {myActiveTasks.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <Play className="w-12 h-12 text-[#78716C] mx-auto mb-3" />
                                <h3 className="text-base font-bold text-[#171717]">No Active Tasks Claimed</h3>
                                <p className="text-xs text-[#57534E] mt-1">
                                    Claim a task from the Service Queue or deliver ready food dishes.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {myActiveTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white border border-[#E7E5E4] rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                    >
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                                                    task.status === "IN_PROGRESS"
                                                        ? "bg-sky-50 text-sky-800 border border-sky-200"
                                                        : "bg-amber-50 text-amber-800 border border-amber-200"
                                                }`}>
                                                    {task.status}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F97316] text-white shrink-0">
                                                        Table {task.table.tableNo}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-[#171717] text-sm sm:text-base break-words">{task.title}</h3>
                                            {task.description && (
                                                <p className="text-xs text-[#57534E] break-words">{task.description}</p>
                                            )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                                            {task.status === "ACCEPTED" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartTask(task.id)}
                                                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs sm:text-sm transition min-h-[40px] cursor-pointer"
                                                >
                                                    Start Working
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleCompleteTask(task.id)}
                                                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 min-h-[40px] shadow-xs cursor-pointer"
                                            >
                                                <Check className="w-4 h-4 shrink-0" />
                                                <span>Mark Completed</span>
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
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                            <h2 className="text-sm min-[380px]:text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                <span className="truncate">Tasks Completed Today</span>
                            </h2>
                            <span className="text-xs text-[#57534E] self-start sm:self-auto shrink-0">
                                {completedTasks.length} finished
                            </span>
                        </div>

                        {completedTasks.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <CheckCircle2 className="w-12 h-12 text-[#78716C] mx-auto mb-3" />
                                <h3 className="text-base font-bold text-[#171717]">No Completed Tasks Yet</h3>
                                <p className="text-xs text-[#57534E] mt-1">
                                    Completed services will be logged here for today's shift.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {completedTasks.slice(0, 25).map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white border border-[#E7E5E4] rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-[#171717] shadow-xs hover:border-emerald-300 transition"
                                    >
                                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                                            <div className="min-w-0">
                                                <div className="font-semibold text-sm text-[#171717] break-words">{task.title}</div>
                                                <div className="text-xs text-[#78716C]">
                                                    {task.table?.tableNo ? `Table ${task.table.tableNo} • ` : ""}
                                                    {task.completedAt ? new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Today"}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-semibold text-emerald-700 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 self-start sm:self-center shrink-0">
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
