import { useEffect, useState } from "react";
import axios from "axios";
import {
    X,
    Search,
    UserPlus,
    Phone,
    Mail,
    Shield,
    Copy,
    Send,
    Pencil,
    UserCheck,
    UserX,
} from "lucide-react";
import { API } from "../config";
import { showToast } from "../utils/toast";

export default function StaffDirectoryDrawer({ isOpen, onClose, restaurantId }) {
    const [staffUsers, setStaffUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    const loadStaff = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API}/owner/${restaurantId}/staff`);
            setStaffUsers(res.data?.users || res.data || []);
        } catch {
            showToast("Failed to load staff directory", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadStaff();
        }
    }, [isOpen, restaurantId]);

    if (!isOpen) return null;

    const filtered = staffUsers.filter((u) => {
        const q = query.toLowerCase().trim();
        if (!q) return true;
        return (
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.phone?.toLowerCase().includes(q) ||
            u.role?.toLowerCase().includes(q) ||
            u.designation?.toLowerCase().includes(q)
        );
    });

    const copyLoginLink = (user) => {
        const link = `${window.location.origin}/login?mode=staff&email=${encodeURIComponent(user.email)}`;
        navigator.clipboard.writeText(link);
        showToast(`Staff login link copied for ${user.name}!`, "success");
    };

    const shareWhatsApp = (user) => {
        const link = `${window.location.origin}/login?mode=staff&email=${encodeURIComponent(user.email)}`;
        const text = `Hi ${user.name}, here is your login link for Tiffzy: ${link}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-neutral-900/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-neutral-200 animation-slide-left">
                {/* Header */}
                <div className="p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                            Staff Directory
                        </h2>
                        <p className="text-xs text-neutral-500">View and manage staff accounts & details</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-neutral-100 bg-white">
                    <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl border border-neutral-200">
                        <Search className="w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search staff name, role, phone..."
                            className="w-full bg-transparent text-xs outline-none text-neutral-800"
                        />
                    </div>
                </div>

                {/* Staff Cards List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="text-center py-8 text-neutral-400 text-xs">Loading staff list...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-8 text-neutral-400 text-xs">No staff members match your search.</div>
                    ) : (
                        filtered.map((u) => (
                            <div key={u.id} className="p-4 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2.5 hover:border-orange-300 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 font-bold text-sm flex items-center justify-center">
                                            {u.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-neutral-900">{u.name}</div>
                                            <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                                                <span className="bg-neutral-100 px-2 py-0.5 rounded font-semibold text-neutral-700">
                                                    {u.designation || u.role}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    u.isActive !== false ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                }`}>
                                                    {u.isActive !== false ? "ACTIVE" : "INACTIVE"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs text-neutral-600 space-y-1 pt-1 border-t border-neutral-100">
                                    {u.phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3.5 h-3.5 text-neutral-400" />
                                            <span>{u.phone}</span>
                                        </div>
                                    )}
                                    {u.email && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5 text-neutral-400" />
                                            <span className="truncate">{u.email}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 text-xs">
                                    <button
                                        onClick={() => copyLoginLink(u)}
                                        className="px-2.5 py-1 text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors flex items-center gap-1"
                                        title="Copy Login Link"
                                    >
                                        <Copy className="w-3 h-3" /> Copy Link
                                    </button>
                                    <button
                                        onClick={() => shareWhatsApp(u)}
                                        className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                                        title="Share on WhatsApp"
                                    >
                                        <Send className="w-3 h-3" /> WhatsApp
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
