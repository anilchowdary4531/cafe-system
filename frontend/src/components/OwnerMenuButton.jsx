import React from "react";
import { useOutletContext } from "react-router-dom";
import { Menu } from "lucide-react";

export default function OwnerMenuButton({ onClick, className = "" }) {
    let contextSetSidebarOpen = null;
    try {
        const context = useOutletContext();
        contextSetSidebarOpen = context?.setSidebarOpen;
    } catch (e) {
        // Safe fallback if not inside Outlet
    }

    const handleOpen = onClick || contextSetSidebarOpen;

    return (
        <button
            type="button"
            onClick={() => handleOpen?.(true)}
            className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition active:scale-95 cursor-pointer shrink-0 ${className}`}
            aria-label="Open navigation menu"
            title="Open navigation menu"
        >
            <Menu size={20} className="text-white stroke-[2.5]" />
        </button>
    );
}

