import { NavLink } from "react-router-dom";
import { Users, Calendar, Clock, CheckSquare } from "lucide-react";

export default function StaffSubNav({ onToggleDirectory, isDirectoryOpen }) {
    return (
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-neutral-200/80 shadow-xs mb-5">
            {onToggleDirectory ? (
                <button
                    type="button"
                    onClick={onToggleDirectory}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                        isDirectoryOpen
                            ? "bg-orange-600 text-white shadow-sm"
                            : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200"
                    }`}
                >
                    <Users size={16} />
                    {isDirectoryOpen ? "Hide Staff Directory" : "Staff Directory"}
                </button>
            ) : (
                <NavLink
                    to="/owner/staff"
                    end
                    className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                            isActive
                                ? "bg-orange-600 text-white shadow-sm"
                                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                        }`
                    }
                >
                    <Users size={16} />
                    Staff Directory
                </NavLink>
            )}

            <NavLink
                to="/owner/staff-schedules"
                className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                        isActive
                            ? "bg-orange-600 text-white shadow-sm"
                            : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                    }`
                }
            >
                <Calendar size={16} />
                Shift Schedules (7shifts)
            </NavLink>

            <NavLink
                to="/owner/staff-attendance"
                className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                        isActive
                            ? "bg-orange-600 text-white shadow-sm"
                            : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                    }`
                }
            >
                <Clock size={16} />
                Attendance & Time Clock
            </NavLink>

            <NavLink
                to="/owner/staff-tasks"
                className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                        isActive
                            ? "bg-orange-600 text-white shadow-sm"
                            : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                    }`
                }
            >
                <CheckSquare size={16} />
                Tasks & Checklists
            </NavLink>
        </div>
    );
}
