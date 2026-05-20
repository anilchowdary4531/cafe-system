import { useState } from "react";
import {
    Home,
    Activity,
    BarChart3,
    MessageCircle,
    Settings,
    Palette,
    BookOpen,
    Plug,
    Menu,
    Search
} from "lucide-react";

export default function PremiumSidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const [active, setActive] = useState("Activity");

    const menu = [
        { name: "Home", icon: Home },
        { name: "Activity", icon: Activity, badge: 21 },
        { name: "Dashboard", icon: BarChart3 },
        { name: "Messages", icon: MessageCircle },
        { name: "Settings", icon: Settings },
    ];

    const extra = [
        { name: "Themes", icon: Palette },
        { name: "Tutorials", icon: BookOpen },
        { name: "Integrations", icon: Plug },
    ];

    return (
        <div
            className={`h-screen bg-[#1e2235] text-white flex flex-col p-4 transition-all duration-300
      ${collapsed ? "w-20" : "w-64"}`}
        >
            {/* TOP */}
            <div className="flex items-center justify-between mb-6">
                {!collapsed && <h1 className="text-lg font-semibold">Sidebar</h1>}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 rounded-lg bg-[#2a2f4a] hover:bg-[#343a5c]"
                >
                    <Menu size={18} />
                </button>
            </div>

            {/* SEARCH */}
            {!collapsed && (
                <div className="flex items-center gap-2 bg-[#2a2f4a] px-3 py-2 rounded-lg mb-6">
                    <Search size={16} className="text-gray-400" />
                    <input
                        placeholder="Search..."
                        className="bg-transparent outline-none text-sm w-full"
                    />
                </div>
            )}

            {/* MAIN MENU */}
            <div className="flex flex-col gap-2">
                {menu.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.name;

                    return (
                        <div
                            key={item.name}
                            onClick={() => setActive(item.name)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition
              ${
                                isActive
                                    ? "bg-white text-black"
                                    : "hover:bg-[#2a2f4a] text-gray-300"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Icon size={18} />
                                {!collapsed && <span>{item.name}</span>}
                            </div>

                            {!collapsed && item.badge && (
                                <span className="bg-red-500 text-xs px-2 py-0.5 rounded-full">
                  +{item.badge}
                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* DIVIDER */}
            <div className="border-t border-[#2a2f4a] my-6" />

            {/* EXTRA MENU */}
            <div className="flex flex-col gap-2">
                {extra.map((item) => {
                    const Icon = item.icon;

                    return (
                        <div
                            key={item.name}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2a2f4a] text-gray-300 cursor-pointer"
                        >
                            <Icon size={18} />
                            {!collapsed && <span>{item.name}</span>}
                        </div>
                    );
                })}
            </div>

            {/* PROFILE */}
            <div className="mt-auto">
                <div
                    className={`flex items-center gap-3 p-3 rounded-lg bg-[#2a2f4a] ${
                        collapsed ? "justify-center" : ""
                    }`}
                >
                    <img
                        src="https://i.pravatar.cc/100"
                        className="w-8 h-8 rounded-full"
                    />

                    {!collapsed && (
                        <div>
                            <p className="text-sm font-medium">Anil Kumar</p>
                            <p className="text-xs text-gray-400">admin@cafe.com</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}