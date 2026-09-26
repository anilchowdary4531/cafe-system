import { useOutletContext } from "react-router-dom";
import { Menu } from "lucide-react";

export default function OwnerMenuButton({ className = "" }) {
    const context = useOutletContext();
    const setSidebarOpen = context?.setSidebarOpen;

    return (
        <button
            type="button"
            onClick={() => setSidebarOpen?.(true)}
            className={`theme-icon-button theme-icon-button-primary shrink-0 inline-flex items-center justify-center rounded-xl p-2.5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer ${className}`}
            aria-label="Open navigation menu"
            title="Open navigation menu"
        >
            <Menu size={20} />
        </button>
    );
}
