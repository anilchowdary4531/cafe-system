import { NavLink } from "react-router-dom";
import { Users, Calendar, Clock, CheckSquare } from "lucide-react";

export default function StaffSubNav({ onToggleDirectory, isDirectoryOpen }) {
    return (
        <nav className="border-b border-[color:var(--app-border)]/50 overflow-x-auto scrollbar-none">
            <div className="flex min-w-max gap-1">
                {onToggleDirectory ? (
                    <button
                        type="button"
                        onClick={onToggleDirectory}
                        className={`relative px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                            isDirectoryOpen
                                ? "text-[var(--app-primary)] border-b-2 border-[var(--app-primary)] font-bold"
                                : "theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                    >
                        <Users size={14} />
                        {isDirectoryOpen ? "Hide Staff Directory" : "Staff Directory"}
                    </button>
                ) : (
                    <NavLink
                        to="/owner/staff"
                        end
                        className={({ isActive }) =>
                            `relative px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                isActive
                                    ? "text-[var(--app-primary)] border-b-2 border-[var(--app-primary)] font-bold"
                                    : "theme-muted hover:text-[color:var(--app-text)]"
                            }`
                        }
                    >
                        <Users size={14} />
                        Staff Directory
                    </NavLink>
                )}

                <NavLink
                    to="/owner/staff"
                    className={({ isActive }) =>
                        `relative px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                            isActive || window.location.pathname.startsWith("/owner/staff-schedules")
                                ? "text-[var(--app-primary)] border-b-2 border-[var(--app-primary)] font-bold"
                                : "theme-muted hover:text-[color:var(--app-text)]"
                        }`
                    }
                >
                    <Calendar size={14} />
                    Shift Schedules (7shifts)
                </NavLink>

                <NavLink
                    to="/owner/staff-attendance"
                    className={({ isActive }) =>
                        `relative px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                            isActive
                                ? "text-[var(--app-primary)] border-b-2 border-[var(--app-primary)] font-bold"
                                : "theme-muted hover:text-[color:var(--app-text)]"
                        }`
                    }
                >
                    <Clock size={14} />
                    Attendance & Time Clock
                </NavLink>

                <NavLink
                    to="/owner/staff-tasks"
                    className={({ isActive }) =>
                        `relative px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                            isActive
                                ? "text-[var(--app-primary)] border-b-2 border-[var(--app-primary)] font-bold"
                                : "theme-muted hover:text-[color:var(--app-text)]"
                        }`
                    }
                >
                    <CheckSquare size={14} />
                    Tasks & Checklists
                </NavLink>
            </div>
        </nav>
    );
}
