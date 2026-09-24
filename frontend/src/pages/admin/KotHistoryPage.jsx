import { useEffect, useMemo, useState } from "react";
import {
    FileText,
    Printer,
    RefreshCw,
    Search,
    Clock3,
    CheckCircle2,
    XCircle,
    LoaderCircle,
    AlertTriangle,
    RotateCcw,
    SlidersHorizontal,
    Utensils,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

const KOT_STATUSES = ["ALL", "PENDING", "PREPARING", "READY", "SERVED", "DELIVERED", "CANCELLED"];

const statusBadgeClass = (status) => {
    switch (status) {
        case "READY":
            return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30";
        case "PREPARING":
            return "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30";
        case "DELIVERED":
        case "SERVED":
            return "bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/30";
        case "CANCELLED":
            return "bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/30";
        default:
            return "bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30";
    }
};

export default function KotHistoryPage() {
    const { user } = useAuth();
    const restaurantId = Number(user?.restaurantId || localStorage.getItem("activeRestaurantId") || 1);

    const [kots, setKots] = useState([]);
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("ALL");
    const [selectedStation, setSelectedStation] = useState("ALL");
    const [reprintingId, setReprintingId] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);

    const loadData = async ({ silent = false } = {}) => {
        if (!restaurantId || isNaN(Number(restaurantId))) return;
        if (silent) setRefreshing(true);
        else setLoading(true);

        try {
            const [kotsRes, stationsRes] = await Promise.all([
                api.get(`/owner/${restaurantId}/kots`),
                api.get(`/owner/${restaurantId}/stations`),
            ]);
            const kotsData = kotsRes?.data?.kots || kotsRes?.data?.data || (Array.isArray(kotsRes?.data) ? kotsRes.data : []);
            const stationsData = stationsRes?.data?.stations || stationsRes?.data?.data || (Array.isArray(stationsRes?.data) ? stationsRes.data : []);
            setKots(Array.isArray(kotsData) ? kotsData : []);
            setStations(Array.isArray(stationsData) ? stationsData : []);
        } catch (err) {
            console.error("Failed to fetch KOT history", err);
            // Only fire error toast if there's an actual HTTP 4xx/5xx error or network failure
            showToast({
                title: "Error",
                message: err?.response?.data?.message || "Failed to load Kitchen Order Tickets.",
                variant: "error",
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [restaurantId]);

    const filteredKots = useMemo(() => {
        return kots.filter((kot) => {
            // Status match
            if (selectedStatus !== "ALL" && kot.status !== selectedStatus) return false;

            // Station match
            if (selectedStation !== "ALL") {
                if (selectedStation === "UNASSIGNED" && kot.stationId !== null) return false;
                if (selectedStation !== "UNASSIGNED" && String(kot.stationId) !== String(selectedStation)) return false;
            }

            // Search query match
            const q = searchQuery.trim().toLowerCase();
            if (!q) return true;

            const kotNum = String(kot.kotNo || kot.kotNumber || "").toLowerCase();
            const orderNum = String(kot.order?.orderNo || kot.orderId || "").toLowerCase();
            const tableNum = String(kot.order?.tableNo || "").toLowerCase();

            return (
                kotNum.includes(q) ||
                orderNum.includes(q) ||
                tableNum.includes(q) ||
                (Array.isArray(kot.items) && kot.items.some((i) => String(i.itemName || "").toLowerCase().includes(q)))
            );
        });
    }, [kots, selectedStatus, selectedStation, searchQuery]);

    // Handle Manual Thermal Reprint
    const handleReprint = async (kotId) => {
        setReprintingId(kotId);
        try {
            const res = await api.post(`/owner/${restaurantId}/kot/${kotId}/reprint`);
            if (res.data?.success) {
                showToast({ title: "Thermal Reprint", message: res.data.message || "KOT sent to thermal printer." });
            } else {
                showToast({ title: "Print Failed", message: res.data?.error || "Printer unreachable.", variant: "error" });
            }
            loadData({ silent: true });
        } catch (err) {
            showToast({ title: "Error", message: err?.response?.data?.message || "Failed to trigger reprint.", variant: "error" });
        } finally {
            setReprintingId(null);
        }
    };

    // Handle Cancel KOT
    const handleCancelKot = async (kotId) => {
        if (!window.confirm("Are you sure you want to cancel this Kitchen Ticket?")) return;
        setCancellingId(kotId);
        try {
            await api.post(`/owner/${restaurantId}/kot/${kotId}/cancel`, { reason: "Manager Cancelled" });
            showToast({ title: "Cancelled", message: "Kitchen Order Ticket cancelled." });
            loadData({ silent: true });
        } catch (err) {
            showToast({ title: "Error", message: err?.response?.data?.message || "Failed to cancel KOT.", variant: "error" });
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="theme-muted text-sm font-medium">Audit & Print History</p>
                    <h3 className="text-3xl font-bold flex items-center gap-2">
                        <FileText className="text-orange-500" size={28} />
                        KOT Audit Trail & Hardware Logs
                    </h3>
                    <p className="theme-muted mt-1 text-sm">
                        View sequential Kitchen Order Tickets, routing logs, thermal print status, and trigger manual reprints.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => loadData({ silent: true })}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    disabled={refreshing}
                >
                    <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                    Refresh KOT Log
                </button>
            </div>

            {/* Filter Bar */}
            <div className="pb-2 space-y-2.5 border-b border-[color:var(--app-border)]/40">
                <div className="flex flex-col gap-2.5 md:flex-row md:items-center justify-between">
                    {/* Status Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {KOT_STATUSES.map((st) => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => setSelectedStatus(st)}
                                className={`rounded-lg px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors ${
                                    selectedStatus === st
                                        ? "bg-[color:var(--app-primary)] text-white"
                                        : "theme-muted hover:text-[color:var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5"
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>

                    {/* Station Selector */}
                    <div className="flex items-center gap-2 text-xs">
                        <SlidersHorizontal size={14} className="theme-muted" />
                        <select
                            value={selectedStation}
                            onChange={(e) => setSelectedStation(e.target.value)}
                            className="rounded-lg border border-[color:var(--app-border)]/40 bg-transparent px-2.5 py-1 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                        >
                            <option value="ALL">All Stations</option>
                            <option value="UNASSIGNED">Default Main Kitchen</option>
                            {stations.map((st) => (
                                <option key={st.id} value={st.id}>
                                    {st.name} ({st.code})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Search Field */}
                <div className="flex items-center gap-2 rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-3.5 py-1.5">
                    <Search size={16} className="theme-muted" />
                    <input
                        type="text"
                        placeholder="Search KOT number (e.g. KOT-101), Order #, Table #, or Item..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent text-xs sm:text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-muted)]"
                    />
                </div>
            </div>

            {/* KOT Tickets Grid */}
            {loading ? (
                <div className="py-12 text-center theme-muted text-sm flex items-center justify-center gap-2">
                    <LoaderCircle size={20} className="animate-spin" /> Loading Kitchen Order Tickets...
                </div>
            ) : filteredKots.length === 0 ? (
                <div className="py-14 text-center rounded-xl border border-dashed border-[color:var(--app-border)]/40 p-6 my-2">
                    <Utensils size={36} className="mx-auto theme-muted mb-2 opacity-40" />
                    <p className="font-bold text-sm">No Kitchen Order Tickets found</p>
                    <p className="theme-muted text-xs mt-1">Try resetting filters or search criteria.</p>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {filteredKots.map((kot) => {
                        const tableNo = kot.order?.tableNo || "-";
                        const orderNo = kot.order?.orderNo || `#${kot.orderId}`;
                        const formattedTime = new Date(kot.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                        return (
                            <div
                                key={kot.id}
                                className="rounded-xl border border-[color:var(--app-border)]/40 p-3.5 flex flex-col justify-between space-y-2.5 transition hover:bg-black/5 dark:hover:bg-white/5"
                            >
                                <div>
                                    {/* Ticket Header */}
                                    <div className="flex items-start justify-between border-b border-[color:var(--app-border)]/30 pb-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-base text-orange-500 font-mono">
                                                    {kot.kotNo || kot.kotNumber || `KOT #${kot.sequenceNumber || kot.id}`}
                                                </h4>
                                                {kot.reprintCount > 0 && (
                                                    <span className="rounded-md bg-amber-500/20 text-amber-500 text-[10px] px-1.5 py-0.5 font-bold">
                                                        Reprinted x{kot.reprintCount}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="theme-muted text-xs mt-0.5">
                                                Order: <strong>{orderNo}</strong> • Table: <strong>{tableNo}</strong>
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${statusBadgeClass(kot.status)}`}>
                                                {kot.status}
                                            </span>
                                            <p className="theme-muted text-[11px] mt-1 flex items-center justify-end gap-1">
                                                <Clock3 size={11} /> {formattedTime}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Station & Thermal Print Status */}
                                    <div className="py-1.5 flex items-center justify-between text-xs border-b border-[color:var(--app-border)]/20">
                                        <span className="theme-muted">
                                            Station: <strong className="text-[color:var(--app-text)]">{kot.station?.name || "Main Kitchen"}</strong>
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {kot.printed ? (
                                                <span className="text-emerald-500 font-semibold flex items-center gap-1 text-[11px]">
                                                    <CheckCircle2 size={12} /> Thermal Printed
                                                </span>
                                            ) : (
                                                <span className="text-red-500 font-semibold flex items-center gap-1 text-[11px]">
                                                    <AlertTriangle size={12} /> Print Pending/Failed
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ticket Items List */}
                                    <div className="py-2 space-y-1.5">
                                        {(Array.isArray(kot.items) ? kot.items : []).map((item) => {
                                            const qty = item.qty || item.quantity || 1;
                                            const mods = Array.isArray(item.selectedModifiers)
                                                ? item.selectedModifiers
                                                : Array.isArray(item.modifiers)
                                                ? item.modifiers
                                                : [];
                                            return (
                                                <div key={item.id} className="text-xs space-y-0.5">
                                                    <div className="flex items-start justify-between font-medium">
                                                        <span className="text-[color:var(--app-text)]">
                                                            <strong className="text-orange-500 font-bold">{qty}x</strong> {item.itemName}
                                                        </span>
                                                    </div>

                                                    {/* Variant & Modifiers Details */}
                                                    {(item.variantName || mods.length > 0) && (
                                                        <div className="pl-3.5 text-[11px] theme-muted space-y-0.5 border-l-2 border-orange-500/40">
                                                            {item.variantName && (
                                                                <div>Option: <span className="text-[color:var(--app-text)] font-medium">{item.variantName}</span></div>
                                                            )}
                                                            {mods.map((mod, idx) => (
                                                                <div key={idx}>
                                                                    + {mod.groupName ? `${mod.groupName}: ` : ""}<span className="text-[color:var(--app-text)]">{mod.optionName || mod.name || mod}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {item.notes && (
                                                        <p className="pl-3.5 text-[10px] italic text-amber-500">Note: {item.notes}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-2 border-t border-[color:var(--app-border)]/30 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleReprint(kot.id)}
                                        disabled={reprintingId === kot.id}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/15 text-orange-500 px-2.5 py-1 text-xs font-semibold hover:bg-orange-500/25 disabled:opacity-50"
                                    >
                                        {reprintingId === kot.id ? (
                                            <LoaderCircle size={13} className="animate-spin" />
                                        ) : (
                                            <Printer size={13} />
                                        )}
                                        Thermal Reprint
                                    </button>

                                    {kot.status !== "CANCELLED" && kot.status !== "DELIVERED" && (
                                        <button
                                            type="button"
                                            onClick={() => handleCancelKot(kot.id)}
                                            disabled={cancellingId === kot.id}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 text-red-500 px-2.5 py-1 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50"
                                        >
                                            {cancellingId === kot.id ? (
                                                <LoaderCircle size={13} className="animate-spin" />
                                            ) : (
                                                <XCircle size={13} />
                                            )}
                                            Cancel KOT
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
