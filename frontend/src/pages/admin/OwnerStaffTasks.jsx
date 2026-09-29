import { useEffect, useState } from "react";
import axios from "axios";
import {
    CheckSquare,
    Plus,
    Trash2,
    CheckCircle2,
    Clock,
    AlertCircle,
    User,
    ListTodo,
    Sun,
    Sunset,
    Moon,
} from "lucide-react";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import StaffSubNav from "../../components/StaffSubNav";
import StaffDirectoryDrawer from "../../components/StaffDirectoryDrawer";
import { useAuth } from "../../context/AuthContext";

export default function OwnerStaffTasks() {
    const { user } = useAuth();
    const restaurantId = Number(user?.restaurantId || 0);

    const [tasks, setTasks] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("CHECKLIST"); // "CHECKLIST" | "ADHOC"
    const [showDirectoryDrawer, setShowDirectoryDrawer] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [taskForm, setTaskForm] = useState({
        title: "",
        description: "",
        category: "CHECKLIST_OPENING",
        assignedTo: "",
        roleTarget: "WAITER",
        priority: "MEDIUM",
        dueDate: "",
    });

    const fetchTasks = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const [resTasks, resStaff] = await Promise.all([
                axios.get(`${API}/api/v1/owner/${restaurantId}/tasks`),
                axios.get(`${API}/owner/${restaurantId}/staff`),
            ]);
            setTasks(resTasks.data?.tasks || []);
            setStaffList(resStaff.data?.users || resStaff.data || []);
        } catch {
            showToast("Failed to load tasks", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [restaurantId]);

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/v1/owner/${restaurantId}/tasks`, taskForm);
            showToast("Task created successfully!", "success");
            setShowModal(false);
            setTaskForm({
                title: "",
                description: "",
                category: "CHECKLIST_OPENING",
                assignedTo: "",
                roleTarget: "WAITER",
                priority: "MEDIUM",
                dueDate: "",
            });
            fetchTasks();
        } catch {
            showToast("Failed to create task", "error");
        }
    };

    const handleToggleComplete = async (taskId, isCompleted) => {
        try {
            await axios.put(`${API}/api/v1/staff/tasks/${taskId}/complete`, { isCompleted: !isCompleted });
            fetchTasks();
        } catch {
            showToast("Failed to update task status", "error");
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Delete this task?")) return;
        try {
            await axios.delete(`${API}/api/v1/owner/${restaurantId}/tasks/${taskId}`);
            showToast("Task deleted", "success");
            fetchTasks();
        } catch {
            showToast("Failed to delete task", "error");
        }
    };

    const openingTasks = tasks.filter((t) => t.category === "CHECKLIST_OPENING");
    const middayTasks = tasks.filter((t) => t.category === "CHECKLIST_MIDDAY");
    const closingTasks = tasks.filter((t) => t.category === "CHECKLIST_CLOSING");
    const adhocTasks = tasks.filter((t) => t.category === "ADHOC");

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
                                    Tasks & Shift Checklists
                                </h2>
                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-primary)]">
                                    DAILY TASKS
                                </span>
                            </div>
                        </div>
                        <p className="theme-muted text-xs mt-0.5">
                            Opening, Mid-day, Closing checklists & staff ad-hoc task board
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 transition-all"
                        >
                            <Plus size={13} /> Add Task / Checklist Item
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

            {/* Category Tabs */}
            <div className="flex border-b border-[color:var(--app-border)]/50 gap-4 text-xs font-semibold">
                <button
                    type="button"
                    onClick={() => setActiveTab("CHECKLIST")}
                    className={`py-2 border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === "CHECKLIST" ? "border-orange-500 text-orange-600 font-bold" : "border-transparent theme-muted hover:text-[color:var(--app-text)]"
                    }`}
                >
                    <ListTodo size={14} /> Shift Checklists
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("ADHOC")}
                    className={`py-2 border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === "ADHOC" ? "border-orange-500 text-orange-600 font-bold" : "border-transparent theme-muted hover:text-[color:var(--app-text)]"
                    }`}
                >
                    <CheckSquare size={14} /> Ad-hoc Tasks ({adhocTasks.length})
                </button>
            </div>

            {activeTab === "CHECKLIST" ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Opening Checklist */}
                    <div className="p-4 rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-bg)]/50 space-y-3">
                        <div className="flex items-center gap-2 border-b border-[color:var(--app-border)]/40 pb-2">
                            <Sun className="w-4 h-4 text-amber-500" />
                            <h2 className="font-bold text-[color:var(--app-text)] text-xs uppercase tracking-wider">Opening Checklist</h2>
                        </div>
                        <div className="space-y-1.5">
                            {openingTasks.length === 0 ? (
                                <div className="text-xs theme-muted py-4 text-center">No opening checklist items.</div>
                            ) : (
                                openingTasks.map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => handleToggleComplete(t.id, t.isCompleted)}
                                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                            t.isCompleted
                                                ? "bg-[color:var(--app-bg)]/30 border-[color:var(--app-border)]/30 theme-muted line-through"
                                                : "bg-[color:var(--app-bg)] border-[color:var(--app-border)]/60 text-[color:var(--app-text)] hover:border-orange-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={t.isCompleted} readOnly className="rounded text-orange-600" />
                                            <span className="font-medium">{t.title}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTask(t.id);
                                            }}
                                            className="text-neutral-300 hover:text-rose-600"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Mid-day Checklist */}
                    <div className="p-4 rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-bg)]/50 space-y-3">
                        <div className="flex items-center gap-2 border-b border-[color:var(--app-border)]/40 pb-2">
                            <Sunset className="w-4 h-4 text-orange-500" />
                            <h2 className="font-bold text-[color:var(--app-text)] text-xs uppercase tracking-wider">Mid-Day Checklist</h2>
                        </div>
                        <div className="space-y-1.5">
                            {middayTasks.length === 0 ? (
                                <div className="text-xs theme-muted py-4 text-center">No mid-day checklist items.</div>
                            ) : (
                                middayTasks.map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => handleToggleComplete(t.id, t.isCompleted)}
                                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                            t.isCompleted
                                                ? "bg-[color:var(--app-bg)]/30 border-[color:var(--app-border)]/30 theme-muted line-through"
                                                : "bg-[color:var(--app-bg)] border-[color:var(--app-border)]/60 text-[color:var(--app-text)] hover:border-orange-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={t.isCompleted} readOnly className="rounded text-orange-600" />
                                            <span className="font-medium">{t.title}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTask(t.id);
                                            }}
                                            className="text-neutral-300 hover:text-rose-600"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Closing Checklist */}
                    <div className="p-4 rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-bg)]/50 space-y-3">
                        <div className="flex items-center gap-2 border-b border-[color:var(--app-border)]/40 pb-2">
                            <Moon className="w-4 h-4 text-indigo-500" />
                            <h2 className="font-bold text-[color:var(--app-text)] text-xs uppercase tracking-wider">Closing Checklist</h2>
                        </div>
                        <div className="space-y-1.5">
                            {closingTasks.length === 0 ? (
                                <div className="text-xs theme-muted py-4 text-center">No closing checklist items.</div>
                            ) : (
                                closingTasks.map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => handleToggleComplete(t.id, t.isCompleted)}
                                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                            t.isCompleted
                                                ? "bg-[color:var(--app-bg)]/30 border-[color:var(--app-border)]/30 theme-muted line-through"
                                                : "bg-[color:var(--app-bg)] border-[color:var(--app-border)]/60 text-[color:var(--app-text)] hover:border-orange-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={t.isCompleted} readOnly className="rounded text-orange-600" />
                                            <span className="font-medium">{t.title}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTask(t.id);
                                            }}
                                            className="text-neutral-300 hover:text-rose-600"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-2 space-y-2">
                    {adhocTasks.length === 0 ? (
                        <div className="text-center py-8 theme-muted text-xs">No ad-hoc tasks created yet.</div>
                    ) : (
                        adhocTasks.map((t) => (
                            <div key={t.id} className="p-3 rounded-lg border border-[color:var(--app-border)]/40 bg-[color:var(--app-bg)]/50 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={t.isCompleted}
                                        onChange={() => handleToggleComplete(t.id, t.isCompleted)}
                                        className="w-4 h-4 rounded text-orange-600"
                                    />
                                    <div>
                                        <div className={`font-bold text-xs text-[color:var(--app-text)] ${t.isCompleted ? "line-through theme-muted" : ""}`}>
                                            {t.title}
                                        </div>
                                        {t.description && <div className="text-xs theme-muted mt-0.5">{t.description}</div>}
                                        <div className="flex items-center gap-2 mt-1 text-[11px] theme-muted">
                                            {t.assignedUser && <span>Assigned: <strong>{t.assignedUser.name}</strong></span>}
                                            <span className={`px-1.5 py-0.2 rounded font-semibold ${
                                                t.priority === "HIGH" ? "bg-rose-100 text-rose-800" : "bg-neutral-200 text-neutral-700"
                                            }`}>
                                                {t.priority}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteTask(t.id)}
                                    className="text-neutral-400 hover:text-rose-600"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Create Task Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-neutral-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                            <h3 className="text-lg font-bold text-neutral-900">Add Task or Checklist Item</h3>
                            <button onClick={() => setShowModal(false)} className="text-neutral-400 font-bold">✕</button>
                        </div>

                        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold text-neutral-700 mb-1">Task Title</label>
                                <input
                                    type="text"
                                    value={taskForm.title}
                                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                                    placeholder="e.g. Sanitize prep tables"
                                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-neutral-700 mb-1">Category</label>
                                <select
                                    value={taskForm.category}
                                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    <option value="CHECKLIST_OPENING">Opening Checklist</option>
                                    <option value="CHECKLIST_MIDDAY">Mid-Day Checklist</option>
                                    <option value="CHECKLIST_CLOSING">Closing Checklist</option>
                                    <option value="ADHOC">Ad-hoc Task</option>
                                </select>
                            </div>

                            <div>
                                <label className="block font-semibold text-neutral-700 mb-1">Assign to Staff Member (Optional)</label>
                                <select
                                    value={taskForm.assignedTo}
                                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    <option value="">-- Unassigned (Role wide) --</option>
                                    {staffList.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.designation || s.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-xl font-semibold shadow-sm transition-all"
                                >
                                    Create Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
