import { Calendar, Clock, Users, MapPin } from "lucide-react";
import useCachedGet from "../../../hooks/useCachedGet";

export default function CustomerReservationsSection() {
    const { data, loading, error } = useCachedGet("/customer/reservations", {
        ttlMs: 20_000,
    });

    const reservations = Array.isArray(data?.reservations) ? data.reservations : [];

    const getStatusBadge = (status) => {
        const s = String(status || "PENDING").toUpperCase();
        if (s === "CONFIRMED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
        if (s === "CANCELLED" || s === "REJECTED") return "border-rose-500/30 bg-rose-500/10 text-rose-400";
        if (s === "COMPLETED") return "border-blue-500/30 bg-blue-500/10 text-blue-400";
        return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    };

    return (
        <div className="space-y-6">
            <header className="theme-panel rounded-3xl p-6">
                <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.26em]">Table Reservations</p>
                <h1 className="mt-1 text-2xl font-bold md:text-3xl">My Reservations</h1>
                <p className="theme-muted mt-2 text-sm">View your upcoming and past dining reservations across restaurants.</p>
            </header>

            {loading ? (
                <div className="py-12 text-center text-sm theme-muted">Loading reservations...</div>
            ) : error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">{error}</div>
            ) : !reservations.length ? (
                <div className="theme-panel rounded-3xl p-8 text-center text-sm theme-muted">
                    No table reservations found.
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {reservations.map((res) => {
                        const dateObj = new Date(res.reservationTime);
                        return (
                            <div key={res.id} className="theme-panel rounded-3xl p-5 border border-white/10 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm flex items-center gap-1.5">
                                        <MapPin size={14} className="text-[color:var(--app-accent)]" />
                                        {res.restaurant?.name || "Restaurant"}
                                    </span>
                                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${getStatusBadge(res.status)}`}>
                                        {res.status || "PENDING"}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs theme-muted pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} />
                                        <span>{dateObj.toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={14} />
                                        <span>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Users size={14} />
                                        <span>{res.guestCount || 1} Guests</span>
                                    </div>
                                    {res.table?.tableNo && (
                                        <div className="font-semibold text-white">
                                            Table: #{res.table.tableNo}
                                        </div>
                                    )}
                                </div>

                                {res.specialRequest && (
                                    <p className="text-xs theme-muted italic pt-1">
                                        Notes: "{res.specialRequest}"
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
