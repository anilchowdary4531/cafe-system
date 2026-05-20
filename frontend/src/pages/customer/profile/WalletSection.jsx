import { useMemo } from "react";
import { Gift, IndianRupee, Star } from "lucide-react";
import useCachedGet from "../../../hooks/useCachedGet";

const formatMoney = (value) => `₹${Math.round(Number(value || 0))}`;

export default function WalletSection({ profile, customerToken }) {
    const phone = String(profile?.phone || "").trim();
    const enabled = Boolean(phone || customerToken);
    const params = useMemo(() => (phone ? { phone } : undefined), [phone]);

    const { data, loading, error } = useCachedGet("/customer/orders", {
        enabled,
        params,
        ttlMs: 20_000,
        staleMs: 5 * 60_000,
        scope: phone ? `customer:${phone}` : "customer:session",
    });

    const allOrders = useMemo(() => {
        const groups = Array.isArray(data?.groups) ? data.groups : [];
        return groups.flatMap((g) => g?.orders || []);
    }, [data?.groups]);

    const totalSpend = useMemo(() => allOrders.reduce((sum, o) => sum + Number(o?.total || 0), 0), [allOrders]);

    // Loyalty placeholder: 1 point per ₹10 spent.
    const points = Math.floor(totalSpend / 10);
    const walletBalance = 0;
    const offers = 0;

    return (
        <div className="space-y-6">
            <div className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Wallet</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Wallet & rewards</h1>
                <p className="theme-muted mt-3 text-sm md:text-base">Points, offers and spending summary.</p>
                {error && (
                    <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <WalletCard
                    icon={<IndianRupee size={20} />}
                    label="Wallet balance"
                    value={formatMoney(walletBalance)}
                    hint="Coming soon"
                />
                <WalletCard
                    icon={<Star size={20} />}
                    label="Reward points"
                    value={loading ? "..." : String(points)}
                    hint="1 point per ₹10"
                />
                <WalletCard
                    icon={<Gift size={20} />}
                    label="Offers"
                    value={String(offers)}
                    hint="Coming soon"
                />
            </div>
        </div>
    );
}

function WalletCard({ icon, label, value, hint }) {
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
