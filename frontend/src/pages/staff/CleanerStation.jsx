import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useCanonicalTables } from "../../context/TableStateContext";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import { playNotificationSound, triggerNotificationVibration } from "../../utils/soundPlayer";
import useStaffCapabilities from "../../hooks/useStaffCapabilities";

export default function CleanerStation() {
    const { user, token, staffToken } = useAuth();
    const { socket } = useStaffSocket();
    const effectiveToken = token || staffToken || (typeof window !== "undefined" ? localStorage.getItem("token") || sessionStorage.getItem("token") : null);

    const { tables: canonicalTables, refreshTables } = useCanonicalTables();

    const [activeTab, setActiveTab] = useState("TABLES"); // TABLES | CHECKLIST | MY_WORK | COMPLETED
    const [tasks, setTasks] = useState([]);
    const [fetchedDirtyTables, setFetchedDirtyTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        localStorage.getItem("restaurantId") ||
        1
    );

    const { hasCleaner } = useStaffCapabilities(restaurantId);

    const fetchTasks = useCallback(async () => {
        try {
            const headers = effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {};
            const res = await axios.get(`${API}/api/v1/staff/tasks`, {
                headers,
                params: { restaurantId, roleTarget: "CLEANER" },
            });
            if (res.data?.success) {
                setTasks(res.data.tasks || []);
            }
        } catch (err) {
            console.error("Failed to fetch cleaner tasks:", err);
        }
    }, [effectiveToken, restaurantId]);

    const fetchTables = useCallback(async () => {
        try {
            // First attempt to refresh canonical tables if TableStateProvider is available
            if (typeof refreshTables === "function") {
                const refreshed = await refreshTables({ force: true });
                if (Array.isArray(refreshed) && refreshed.length > 0) {
                    const dirty = refreshed.filter((t) => t.cleaningStatus === "DIRTY" || t.status === "DIRTY");
                    setFetchedDirtyTables(dirty);
                    return;
                }
            }

            // Direct fallback to /owner/:restaurantId/tables or /tables
            const headers = effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {};
            let list = [];
            try {
                const ownerRes = await axios.get(`${API}/owner/${restaurantId}/tables`, { headers });
                list = Array.isArray(ownerRes.data?.tables) ? ownerRes.data.tables : Array.isArray(ownerRes.data) ? ownerRes.data : [];
            } catch {
                const publicRes = await axios.get(`${API}/tables`, { headers, params: { restaurantId } });
                list = Array.isArray(publicRes.data?.tables) ? publicRes.data.tables : Array.isArray(publicRes.data) ? publicRes.data : [];
            }
            const dirty = list.filter((t) => t.cleaningStatus === "DIRTY" || t.status === "DIRTY");
            setFetchedDirtyTables(dirty);
        } catch (err) {
            console.error("Failed to fetch dirty tables:", err);
        }
    }, [effectiveToken, restaurantId, refreshTables]);

    const dirtyTables = useMemo(() => {
        if (canonicalTables && canonicalTables.length > 0) {
            return canonicalTables.filter(
                (t) => t.cleaningStatus === "DIRTY" || t.status === "DIRTY"
            );
        }
        return fetchedDirtyTables;
    }, [canonicalTables, fetchedDirtyTables]);

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
            if (typeof refreshTables === "function") refreshTables({ force: true });
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
            if (typeof refreshTables === "function") refreshTables({ force: true });
        };

        socket.on("cleaner:table_dirty", onCleaningAlert);
        socket.on("cleaner:table_cleaned", onTableUpdated);
        socket.on("cleaner:task_created", onCleaningAlert);
        socket.on("cleaner:task_completed", onTableUpdated);
        socket.on("cleaner:urgent_alert", onCleaningAlert);
        socket.on("table:updated", onTableUpdated);
        socket.on("task:updated", fetchTasks);
        socket.on("task:completed", fetchTasks);

        return () => {
            socket.off("cleaner:table_dirty", onCleaningAlert);
            socket.off("cleaner:table_cleaned", onTableUpdated);
            socket.off("cleaner:task_created", onCleaningAlert);
            socket.off("cleaner:task_completed", onTableUpdated);
            socket.off("cleaner:urgent_alert", onCleaningAlert);
            socket.off("table:updated", onTableUpdated);
            socket.off("task:updated", fetchTasks);
            socket.off("task:completed", fetchTasks);
        };
    }, [socket, fetchTasks, fetchTables, refreshTables]);

    // Cleaner Actions
    const handleAcceptTask = async (taskId) => {
        try {
            await axios.put(
                `${API}/api/v1/staff/tasks/${taskId}/accept`,
                {},
                { headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {} }
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
                { headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {} }
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
                { headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {} }
            );
            showToast({
                title: "Table Cleaned & Ready!",
                message: `Table ${tableNo || ""} is now sanitized and available for guests.`,
                variant: "success",
            });
            fetchTasks();
            fetchTables();
            if (typeof refreshTables === "function") refreshTables({ force: true });
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.message || "Failed to complete cleaning", variant: "error" });
        }
    };

    // Quick direct sanitation if table is dirty but task not claimed
    const handleQuickSanitizeTable = async (table) => {
        try {
            // First attempt direct authoritative sanitation endpoint
            const headers = effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {};
            await axios.post(
                `${API}/api/v1/staff/tables/${table.id}/clean`,
                { restaurantId },
                { headers }
            );
            showToast({
                title: "Table Cleaned & Ready!",
                message: `Table ${table.tableNo || ""} is now sanitized and available for guests.`,
                variant: "success",
            });
            fetchTasks();
            fetchTables();
            if (typeof refreshTables === "function") refreshTables({ force: true });
        } catch (directErr) {
            // Fallback to task-based sanitize
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
                        { headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {} }
                    );
                    const createdTask = createRes.data?.task;
                    if (createdTask?.id) {
                        await handleMarkCleanAndReady(createdTask.id, table.tableNo);
                    }
                }
            } catch (err) {
                showToast({ title: "Error", message: "Failed to sanitize table", variant: "error" });
            }
        }
    };

    const isToday = (dateVal) => {
        if (!dateVal) return false;
        const d = new Date(dateVal);
        if (Number.isNaN(d.getTime())) return false;
        const now = new Date();
        return (
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
        );
    };

    const formatCleaningDate = (dateVal) => {
        if (!dateVal) return "Unknown Date";
        const d = new Date(dateVal);
        if (Number.isNaN(d.getTime())) return "Unknown Date";
        if (isToday(d)) return "Today";
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (
            d.getDate() === yesterday.getDate() &&
            d.getMonth() === yesterday.getMonth() &&
            d.getFullYear() === yesterday.getFullYear()
        ) {
            return "Yesterday";
        }
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const formatCleaningTime = (dateVal) => {
        if (!dateVal) return "";
        const d = new Date(dateVal);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    };

    const staffId = user?.id;
    const pendingTasks = tasks.filter((t) => t.status === "PENDING");
    const myActiveTasks = tasks.filter(
        (t) => (t.status === "ACCEPTED" || t.status === "IN_PROGRESS") && t.assignedTo === staffId
    );
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED");
    const sanitizedTodayTasks = useMemo(() => {
        return completedTasks.filter((t) => isToday(t.completedAt || t.updatedAt || t.createdAt));
    }, [completedTasks]);

    const groupedHistory = useMemo(() => {
        const groups = {};
        completedTasks.forEach((task) => {
            const dateStr = formatCleaningDate(task.completedAt || task.updatedAt || task.createdAt);
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(task);
        });
        return Object.entries(groups);
    }, [completedTasks]);

    const tabs = [
        { id: "TABLES", label: "Dirty Tables", icon: Sparkles, badge: dirtyTables.length },
        { id: "CHECKLIST", label: "Cleaning Queue", icon: Bell, badge: pendingTasks.length },
        { id: "MY_WORK", label: "My Tasks", icon: Play, badge: myActiveTasks.length },
        { id: "COMPLETED", label: "Sanitized Today", icon: CheckCircle2, badge: sanitizedTodayTasks.length },
        { id: "HISTORY", label: "History", icon: Clock, badge: completedTasks.length },
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
            <div className="space-y-4 max-w-7xl mx-auto w-full min-w-0">
                {!hasCleaner && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 p-4 rounded-xl mb-4 shadow-xs" role="alert">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <div>
                                <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">Cleaner Station Inactive</h4>
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    No active staff members with <strong>Cleaner</strong> or <strong>Housekeeping</strong> designation are currently configured for this restaurant. Tables will automatically release to Clean upon settlement.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* KPI Overview - Compact operational metrics (hidden when viewing History to eliminate duplicate navigation) */}
                {activeTab !== "HISTORY" && (
                    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setActiveTab("TABLES")}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("TABLES"); } }}
                            className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all min-h-[80px] flex flex-col justify-between ${
                                activeTab === "TABLES"
                                    ? "bg-[#FFFBEB] border-[#D97706]/50 shadow-xs ring-1 ring-[#D97706]/30"
                                    : "bg-white border-[#E7E5E4] hover:border-[#D97706]/40 hover:bg-[#FFFBEB]/40"
                            }`}
                        >
                            <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between gap-1">
                                <span className="truncate">Dirty Tables</span>
                                <Sparkles className="w-4 h-4 text-[#D97706] shrink-0" />
                            </div>
                            <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                                {dirtyTables.length}
                            </div>
                            <div className="text-[11px] text-[#78716C] mt-0.5 truncate">Need busing & sanitize</div>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setActiveTab("CHECKLIST")}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("CHECKLIST"); } }}
                            className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all min-h-[80px] flex flex-col justify-between ${
                                activeTab === "CHECKLIST"
                                    ? "bg-[#FFF7ED] border-[#F97316]/50 shadow-xs ring-1 ring-[#F97316]/30"
                                    : "bg-white border-[#E7E5E4] hover:border-[#F97316]/40 hover:bg-[#FFF7ED]/40"
                            }`}
                        >
                            <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between gap-1">
                                <span className="truncate">Cleaning Queue</span>
                                <Bell className="w-4 h-4 text-[#F97316] shrink-0" />
                            </div>
                            <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                                {pendingTasks.length}
                            </div>
                            <div className="text-[11px] text-[#78716C] mt-0.5 truncate">Spills & checklists</div>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setActiveTab("MY_WORK")}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("MY_WORK"); } }}
                            className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all min-h-[80px] flex flex-col justify-between ${
                                activeTab === "MY_WORK"
                                    ? "bg-[#F0F9FF] border-[#0284C7]/50 shadow-xs ring-1 ring-[#0284C7]/30"
                                    : "bg-white border-[#E7E5E4] hover:border-[#0284C7]/40 hover:bg-[#F0F9FF]/40"
                            }`}
                        >
                            <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between gap-1">
                                <span className="truncate">My Tasks</span>
                                <Play className="w-4 h-4 text-[#0284C7] shrink-0" />
                            </div>
                            <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                                {myActiveTasks.length}
                            </div>
                            <div className="text-[11px] text-[#78716C] mt-0.5 truncate">Currently cleaning</div>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setActiveTab("COMPLETED")}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("COMPLETED"); } }}
                            className={`cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all min-h-[80px] flex flex-col justify-between ${
                                activeTab === "COMPLETED"
                                    ? "bg-[#ECFDF5] border-[#059669]/50 shadow-xs ring-1 ring-[#059669]/30"
                                    : "bg-white border-[#E7E5E4] hover:border-[#059669]/40 hover:bg-[#ECFDF5]/40"
                            }`}
                        >
                            <div className="text-xs font-semibold text-[#57534E] flex items-center justify-between gap-1">
                                <span className="truncate">Sanitized Today</span>
                                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                            </div>
                            <div className="text-2xl sm:text-3xl font-extrabold text-[#171717] mt-1">
                                {sanitizedTodayTasks.length}
                            </div>
                            <div className="text-[11px] text-[#78716C] mt-0.5 truncate">Tables & areas clean</div>
                        </div>
                    </div>
                )}

                {/* Tab 1: Dirty Tables (Strict Sanitation) */}
                {activeTab === "TABLES" && (
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <h2 className="text-sm min-[380px]:text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2 min-w-0">
                                <Sparkles className="w-5 h-5 text-[#D97706] shrink-0" />
                                <span className="truncate">Tables Awaiting Sanitation ({dirtyTables.length})</span>
                            </h2>
                            <span className="text-[11px] sm:text-xs text-[#D97706] font-bold bg-[#FFFBEB] px-2.5 py-1 rounded-full border border-[#D97706]/30 self-start sm:self-auto shrink-0">
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
                            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                                {dirtyTables.map((tbl) => (
                                    <div
                                        key={tbl.id}
                                        className="bg-white border border-[#E7E5E4] hover:border-[#D97706]/40 rounded-xl p-3.5 shadow-xs flex flex-col justify-between gap-3 transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <span className="px-2.5 py-1 rounded-lg bg-[#F97316] text-white font-extrabold text-xs sm:text-sm shadow-xs shrink-0">
                                                    Table {tbl.tableNo}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30 animate-pulse shrink-0">
                                                    DIRTY
                                                </span>
                                            </div>
                                            <div className="text-xs font-semibold text-[#57534E] mt-2.5 truncate">
                                                Section: {tbl.section || "Main Hall"} · {tbl.seats || 4} Seats
                                            </div>
                                            <p className="text-xs text-[#78716C] mt-1 break-words">
                                                Dining session completed. Clean and sanitize surface before new guests arrive.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleQuickSanitizeTable(tbl)}
                                            className="w-full py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 min-h-[42px] shadow-xs cursor-pointer active:scale-[0.99]"
                                        >
                                            <Check className="w-4 h-4 shrink-0" />
                                            <span>Mark Clean & Available</span>
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                            <h2 className="text-sm min-[380px]:text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2 min-w-0">
                                <Bell className="w-5 h-5 text-[#F97316] shrink-0" />
                                <span className="truncate">Cleaning Tasks & Sanitation Queue</span>
                            </h2>
                            <span className="text-xs font-semibold text-[#57534E] self-start sm:self-auto shrink-0">
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
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30 shrink-0">
                                                    {task.taskType || task.category || "CLEANING"}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F97316] text-white shrink-0">
                                                        Table {task.table.tableNo}{task.table?.section ? ` (${task.table.section})` : ""}
                                                    </span>
                                                )}
                                                {task.priority === "HIGH" || task.priority === "URGENT" ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/30 shrink-0">
                                                        URGENT
                                                    </span>
                                                ) : null}
                                            </div>
                                            <h3 className="font-bold text-[#171717] text-sm sm:text-base break-words">{task.title}</h3>
                                            {task.description && (
                                                <p className="text-xs text-[#57534E] break-words">{task.description}</p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleAcceptTask(task.id)}
                                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 min-h-[40px] shrink-0 shadow-xs cursor-pointer active:scale-[0.99]"
                                        >
                                            <Play className="w-4 h-4 shrink-0" />
                                            <span>Claim Task</span>
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                            <h2 className="text-sm min-[380px]:text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2 min-w-0">
                                <Play className="w-5 h-5 text-[#0284C7] shrink-0" />
                                <span className="truncate">Sanitation Tasks Claimed by Me</span>
                            </h2>
                            <span className="text-xs font-semibold text-[#57534E] self-start sm:self-auto shrink-0">
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
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                                                    task.status === "IN_PROGRESS"
                                                        ? "bg-[#F0F9FF] text-[#0284C7] border border-[#0284C7]/30"
                                                        : "bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30"
                                                }`}>
                                                    {task.status}
                                                </span>
                                                {task.table?.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F97316] text-white shrink-0">
                                                        Table {task.table.tableNo}{task.table?.section ? ` (${task.table.section})` : ""}
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
                                                    className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 min-h-[40px] shadow-xs cursor-pointer active:scale-[0.99]"
                                                >
                                                    <Play className="w-4 h-4 shrink-0" />
                                                    <span>Start Cleaning</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleMarkCleanAndReady(task.id, task.table?.tableNo)}
                                                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 min-h-[40px] shadow-xs cursor-pointer active:scale-[0.99]"
                                            >
                                                <Check className="w-4 h-4 shrink-0" />
                                                <span>Mark Clean & Available</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 4: Completed Cleaning Tasks (Strictly Today) */}
                {activeTab === "COMPLETED" && (
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                            <h2 className="text-sm min-[380px]:text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0" />
                                <span className="truncate">Sanitized & Released Today</span>
                            </h2>
                            <span className="text-xs font-semibold text-[#57534E] self-start sm:self-auto shrink-0">
                                {sanitizedTodayTasks.length} completed today
                            </span>
                        </div>

                        {sanitizedTodayTasks.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <CheckCircle2 className="w-12 h-12 text-[#78716C] mx-auto mb-3 opacity-50" />
                                <h3 className="text-base font-bold text-[#171717]">No Cleaning Logs Today</h3>
                                <p className="text-xs text-[#57534E] mt-1">
                                    Sanitation tasks completed today will appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sanitizedTodayTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white border border-[#E7E5E4] rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-[#57534E] shadow-xs hover:border-[#059669]/30 transition"
                                    >
                                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                                            <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0 mt-0.5 sm:mt-0" />
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm text-[#171717] break-words">
                                                    {task.table?.tableNo ? `Table ${task.table.tableNo}${task.table?.section ? ` (${task.table.section})` : ""}` : task.title}
                                                </div>
                                                <div className="text-xs text-[#78716C] flex items-center gap-1.5 flex-wrap">
                                                    <span>Cleaned by {task.assignedUser?.name || "Staff"}</span>
                                                    <span>·</span>
                                                    <span>{formatCleaningTime(task.completedAt || task.updatedAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-[#059669] px-2.5 py-1 rounded-full bg-[#ECFDF5] border border-[#059669]/20 self-start sm:self-center shrink-0">
                                            Sanitized Today
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 5: Complete Cleaning History */}
                {activeTab === "HISTORY" && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                            <h2 className="text-sm min-[380px]:text-base sm:text-lg font-bold text-[#171717] flex items-center gap-2 min-w-0">
                                <Clock className="w-5 h-5 text-[#F97316] shrink-0" />
                                <span className="truncate">Sanitation & Cleaning History</span>
                            </h2>
                            <span className="text-xs font-semibold text-[#57534E] self-start sm:self-auto shrink-0">
                                {completedTasks.length} total records
                            </span>
                        </div>

                        {completedTasks.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl shadow-xs">
                                <Clock className="w-12 h-12 text-[#78716C] mx-auto mb-3 opacity-50" />
                                <h3 className="text-base font-bold text-[#171717]">No Cleaning History</h3>
                                <p className="text-xs text-[#57534E] mt-1">
                                    Historical sanitation and cleaning logs will be preserved here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {groupedHistory.map(([dateGroup, groupTasks]) => (
                                    <div key={dateGroup} className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <h3 className="text-xs font-bold text-[#57534E] uppercase tracking-wider">
                                                {dateGroup}
                                            </h3>
                                            <span className="text-[11px] font-semibold text-[#78716C]">
                                                {groupTasks.length} {groupTasks.length === 1 ? "record" : "records"}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {groupTasks.map((task) => (
                                                <div
                                                    key={task.id}
                                                    className="bg-white border border-[#E7E5E4] rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[#57534E] shadow-xs hover:border-[#059669]/30 transition"
                                                >
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
                                                        <div className="min-w-0 space-y-0.5">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-sm text-[#171717]">
                                                                    {task.table?.tableNo ? `Table ${task.table.tableNo}` : (task.title || "Sanitation Task")}
                                                                </span>
                                                                {task.table?.section && (
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F5F5F4] text-[#78716C]">
                                                                        {task.table.section}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs text-[#78716C]">
                                                                    · {formatCleaningTime(task.completedAt || task.updatedAt || task.createdAt)}
                                                                </span>
                                                            </div>

                                                            <div className="text-xs text-[#57534E] flex items-center gap-2 flex-wrap">
                                                                <span>
                                                                    Cleaned by: <strong>{task.assignedUser?.name || "Cleaner"}</strong>
                                                                </span>
                                                                {task.description && (
                                                                    <span className="text-[#78716C] break-words">
                                                                        ({task.description})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                                        <span className="text-xs font-bold text-[#059669] px-2.5 py-1 rounded-full bg-[#ECFDF5] border border-[#059669]/20 flex items-center gap-1">
                                                            <Check className="w-3.5 h-3.5" />
                                                            Sanitized & Ready
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
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
