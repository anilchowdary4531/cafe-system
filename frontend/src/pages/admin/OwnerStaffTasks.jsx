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
import { useAuth } from "../../context/AuthContext";

export default function OwnerStaffTasks() {
    const { user } = useAuth();
    const restaurantId = Number(user?.restaurantId || 0);

    const [tasks, setTasks] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("CHECKLIST"); // "CHECKLIST" | "ADHOC"

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
        <div className="min-h-screen bg-neutral-50/60 p-4 sm:p-6 lg:p-8 space-y-6">
            <StaffSubNav />
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-neutral-200/80">
                <div className="flex items-center gap-3">
                    <OwnerMenuButton />
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 flex items-center gap-2">
                            <CheckSquare className="w-6 h-6 text-orange-600" />
                            Tasks & Shift Checklists
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500">
                            Opening, Mid-day, Closing checklists & staff ad-hoc task board
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" /> Add Task / Checklist Item
                    </button>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex border-b border-neutral-200 bg-white rounded-2xl p-2 px-4 shadow-xs gap-4 text-sm font-semibold">
                <button
                    onClick={() => setActiveTab("CHECKLIST")}
                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                        activeTab === "CHECKLIST" ? "bg-orange-50 text-orange-600" : "text-neutral-600 hover:text-neutral-900"
                    }`}
                >
                    <ListTodo className="w-4 h-4" /> Shift Checklists
                </button>
                <button
                    onClick={() => setActiveTab("ADHOC")}
                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                        activeTab === "ADHOC" ? "bg-orange-50 text-orange-600" : "text-neutral-600 hover:text-neutral-900"
                    }`}
                >
                    <CheckSquare className="w-4 h-4" /> Ad-hoc Tasks ({adhocTasks.length})
                </button>
            </div>

            {activeTab === "CHECKLIST" ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Opening Checklist */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                            <Sun className="w-5 h-5 text-amber-500" />
                            <h2 className="font-bold text-neutral-900 text-base">Opening Checklist</h2>
                        </div>
                        <div className="space-y-2">
                            {openingTasks.length === 0 ? (
                                <div className="text-xs text-neutral-400 py-4 text-center">No opening checklist items.</div>
                            ) : (
                                openingTasks.map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => handleToggleComplete(t.id, t.isCompleted)}
                                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                            t.isCompleted
                                                ? "bg-neutral-50 border-neutral-200 text-neutral-400 line-through"
                                                : "bg-white border-neutral-200/80 text-neutral-800 hover:border-orange-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={t.isCompleted} readOnly className="rounded text-orange-600" />
                                            <span className="font-medium">{t.title}</span>
                                        </div>
                                        <button
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
                    <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                            <Sunset className="w-5 h-5 text-orange-500" />
                            <h2 className="font-bold text-neutral-900 text-base">Mid-Day Checklist</h2>
                        </div>
                        <div className="space-y-2">
                            {middayTasks.length === 0 ? (
                                <div className="text-xs text-neutral-400 py-4 text-center">No mid-day checklist items.</div>
                            ) : (
                                middayTasks.map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => handleToggleComplete(t.id, t.isCompleted)}
                                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                            t.isCompleted
                                                ? "bg-neutral-50 border-neutral-200 text-neutral-400 line-through"
                                                : "bg-white border-neutral-200/80 text-neutral-800 hover:border-orange-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={t.isCompleted} readOnly className="rounded text-orange-600" />
                                            <span className="font-medium">{t.title}</span>
                                        </div>
                                        <button
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
                    <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                            <Moon className="w-5 h-5 text-indigo-500" />
                            <h2 className="font-bold text-neutral-900 text-base">Closing Checklist</h2>
                        </div>
                        <div className="space-y-2">
                            {closingTasks.length === 0 ? (
                                <div className="text-xs text-neutral-400 py-4 text-center">No closing checklist items.</div>
                            ) : (
                                closingTasks.map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => handleToggleComplete(t.id, t.isCompleted)}
                                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                            t.isCompleted
                                                ? "bg-neutral-50 border-neutral-200 text-neutral-400 line-through"
                                                : "bg-white border-neutral-200/80 text-neutral-800 hover:border-orange-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={t.isCompleted} readOnly className="rounded text-orange-600" />
                                            <span className="font-medium">{t.title}</span>
                                        </div>
                                        <button
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
                <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-sm space-y-3">
                    {adhocTasks.length === 0 ? (
                        <div className="text-center py-8 text-neutral-400 text-sm">No ad-hoc tasks created yet.</div>
                    ) : (
                        adhocTasks.map((t) => (
                            <div key={t.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={t.isCompleted}
                                        onChange={() => handleToggleComplete(t.id, t.isCompleted)}
                                        className="w-4 h-4 rounded text-orange-600"
                                    />
                                    <div>
                                        <div className={`font-bold text-sm text-neutral-900 ${t.isCompleted ? "line-through text-neutral-400" : ""}`}>
                                            {t.title}
                                        </div>
                                        {t.description && <div className="text-xs text-neutral-500 mt-0.5">{t.description}</div>}
                                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-neutral-600">
                                            {t.assignedUser && <span>Assigned to: <strong>{t.assignedUser.name}</strong></span>}
                                            <span className={`px-2 py-0.5 rounded font-semibold ${
                                                t.priority === "HIGH" ? "bg-rose-100 text-rose-800" : "bg-neutral-200 text-neutral-700"
                                            }`}>
                                                {t.priority}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
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
        </div>
    );
}
