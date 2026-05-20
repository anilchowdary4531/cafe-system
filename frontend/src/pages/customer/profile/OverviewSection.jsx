import { useMemo } from "react";
import { Activity, ClipboardList, Heart, IndianRupee, Settings, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useRestaurantContext } from "../../../context/RestaurantContext";
import useCachedGet from "../../../hooks/useCachedGet";

const ACTIVE_STATUSES = new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]);
const formatMoney = (value) => `₹${Math.round(Number(value || 0))}`;
const formatDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function OverviewSection({ profile, customerToken, profileLoading, profileError }) {
    const { restaurantContext } = useRestaurantContext();
    const phone = String(profile?.phone || "").trim();
    const enabled = Boolean(phone || customerToken);
    const params = useMemo(() => (phone ? { phone } : undefined), [phone]);

    const { data: ordersData, loading: ordersLoading, error: ordersError } = useCachedGet("/customer/orders", {
        enabled,
        params,
        ttlMs: 12_000,
        staleMs: 5 * 60_000,
        scope: phone ? `customer:${phone}` : "customer:session",
    });

    const groups = useMemo(() => (Array.isArray(ordersData?.groups) ? ordersData.groups : []), [ordersData?.groups]);
    const allOrders = useMemo(() => groups.flatMap((g) => g?.orders || []), [groups]);

    const stats = useMemo(() => {
        const totalOrders = allOrders.length;
        const totalSpend = allOrders.reduce((sum, o) => sum + Number(o?.total || 0), 0);
        const avgOrderValue = totalOrders ? totalSpend / totalOrders : 0;
        const activeOrders = allOrders.reduce((sum, o) => {
            const s = String(o?.status || "").toUpperCase();
            return sum + (ACTIVE_STATUSES.has(s) ? 1 : 0);
        }, 0);
        const lastVisitMs = allOrders.reduce((max, o) => {
            const t = new Date(o?.createdAt).getTime();
            return Number.isFinite(t) ? Math.max(max, t) : max;
        }, 0);
        return { totalOrders, totalSpend, avgOrderValue, activeOrders, lastVisitMs };
    }, [allOrders]);

    return (
        <div className="space-y-6">
            <div className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Overview</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Customer profile</h1>
                <p className="theme-muted mt-3 text-sm md:text-base">Your account summary and activity.</p>

                {(profileError || ordersError) && (
                    <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {profileError || ordersError}
                    </div>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <StatCard
                    icon={<ClipboardList size={20} />}
                    label="Orders"
                    value={ordersLoading ? "..." : String(stats.totalOrders)}
                    hint={stats.activeOrders ? `${stats.activeOrders} active` : "All time"}
                />
                <StatCard
                    icon={<IndianRupee size={20} />}
                    label="Total spent"
                    value={ordersLoading ? "..." : formatMoney(stats.totalSpend)}
                    hint="All restaurants"
                />
                <StatCard
                    icon={<Activity size={20} />}
                    label="Avg order value"
                    value={ordersLoading ? "..." : formatMoney(stats.avgOrderValue)}
                    hint="All time"
                />
                <StatCard
                    icon={<ShieldCheck size={20} />}
                    label="Last visit"
                    value={ordersLoading ? "..." : stats.lastVisitMs ? formatDate(stats.lastVisitMs) : "—"}
                    hint={restaurantContext?.name ? String(restaurantContext.name) : "Across restaurants"}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <QuickNavCard
                    to="/profile/orders"
                    icon={<ClipboardList size={18} />}
                    label="Orders"
                    hint="History, status, reorder"
                />
                <QuickNavCard to="/profile/favorites" icon={<Heart size={18} />} label="Favorites" hint="Saved dishes" />
                <QuickNavCard to="/profile/settings" icon={<Settings size={18} />} label="Settings" hint="Profile, logout" />
            </div>

            <div className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Account</p>
                <h2 className="mt-2 text-2xl font-semibold">Profile details</h2>

                {profileLoading ? (
                    <p className="theme-muted mt-4 text-sm">Loading profile...</p>
                ) : (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <InfoCard label="Name" value={profile?.name || "Not provided"} />
                        <InfoCard label="Email" value={profile?.email || "Not provided"} />
                        <InfoCard label="Phone" value={profile?.phone || "Not provided"} />
                        <div className="theme-card rounded-3xl p-5">
                            <div className="theme-muted flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em]">
                                <span className="theme-accent-text">
                                    <ShieldCheck size={18} />
                                </span>
                                <span>Status</span>
                            </div>
                            <p className="mt-3 break-words text-lg font-semibold">OTP verified</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, hint }) {
    return (
        <div className="theme-panel rounded-[28px] p-6">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">{label}</p>
                    <p className="mt-3 break-words text-3xl font-black">{value}</p>
                    {hint && <p className="theme-muted mt-2 text-sm">{hint}</p>}
                </div>
                <div className="theme-card flex h-12 w-12 items-center justify-center rounded-2xl">
                    <span className="theme-accent-text">{icon}</span>
                </div>
            </div>
        </div>
    );
}

function InfoCard({ label, value }) {
    return (
        <div className="theme-card rounded-3xl p-5">
            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">{label}</p>
            <p className="mt-3 break-words text-lg font-semibold">{value}</p>
        </div>
    );
}

function QuickNavCard({ to, icon, label, hint }) {
    return (
        <Link to={to} className="theme-panel rounded-[28px] p-6 transition hover:bg-black/20">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Quick</p>
                    <p className="mt-3 text-lg font-semibold">{label}</p>
                    {hint && <p className="theme-muted mt-2 text-sm">{hint}</p>}
                </div>
                <div className="theme-card flex h-12 w-12 items-center justify-center rounded-2xl">
                    <span className="theme-accent-text">{icon}</span>
                </div>
            </div>
        </Link>
    );
}
