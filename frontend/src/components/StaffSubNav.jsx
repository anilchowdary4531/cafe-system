import { NavLink } from "react-router-dom";
import { Users, Calendar, Clock, CheckSquare } from "lucide-react";

export default function StaffSubNav() {
    return (
        <nav className="border-b border-[#E7E5E4] overflow-x-auto scrollbar-none">
            <div className="flex min-w-max gap-1">
                <NavLink
                    to="/owner/staff"
                    end
                    className={({ isActive }) =>
                        `relative px-3.5 py-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 rounded-t-lg ${
                            isActive
                                ? "text-[#F97316] border-b-2 border-[#F97316] font-bold bg-[#FFF7ED]"
                                : "text-[#57534E] hover:text-[#EA580C] hover:bg-[#FFF7ED]/70"
                        }`
                    }
                >
                    <Users size={14} />
                    Staff Directory
                </NavLink>

                <NavLink
                    to="/owner/staff-schedules"
                    className={({ isActive }) =>
                        `relative px-3.5 py-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 rounded-t-lg ${
                            isActive
                                ? "text-[#F97316] border-b-2 border-[#F97316] font-bold bg-[#FFF7ED]"
                                : "text-[#57534E] hover:text-[#EA580C] hover:bg-[#FFF7ED]/70"
                        }`
                    }
                >
                    <Calendar size={14} />
                    Shift Schedules (7shifts)
                </NavLink>

                <NavLink
                    to="/owner/staff-attendance"
                    className={({ isActive }) =>
                        `relative px-3.5 py-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 rounded-t-lg ${
                            isActive
                                ? "text-[#F97316] border-b-2 border-[#F97316] font-bold bg-[#FFF7ED]"
                                : "text-[#57534E] hover:text-[#EA580C] hover:bg-[#FFF7ED]/70"
                        }`
                    }
                >
                    <Clock size={14} />
                    Attendance & Time Clock
                </NavLink>

                <NavLink
                    to="/owner/staff-tasks"
                    className={({ isActive }) =>
                        `relative px-3.5 py-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 rounded-t-lg ${
                            isActive
                                ? "text-[#F97316] border-b-2 border-[#F97316] font-bold bg-[#FFF7ED]"
                                : "text-[#57534E] hover:text-[#EA580C] hover:bg-[#FFF7ED]/70"
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
