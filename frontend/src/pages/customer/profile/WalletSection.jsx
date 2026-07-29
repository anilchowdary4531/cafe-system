import { Gift, IndianRupee, Sparkles, Star } from "lucide-react";

const METRICS = [
    {
        key: "wallet",
        icon: <IndianRupee size={19} />,
        label: "Wallet balance",
        hint: "Coming soon",
        value: "Rs 0",
        toneClass: "from-orange-500/20 to-amber-500/10",
    },
    {
        key: "points",
        icon: <Star size={19} />,
        label: "Reward points",
        hint: "1 point per Rs 10",
        value: "399",
        toneClass: "from-yellow-500/20 to-lime-500/10",
    },
    {
        key: "offers",
        icon: <Gift size={19} />,
        label: "Offers",
        hint: "Coming soon",
        value: "Coming soon",
        toneClass: "from-fuchsia-500/15 to-rose-500/10",
    },
];

export default function WalletSection({ profile }) {
    const pointsValue = profile?.rewardPoints !== undefined ? String(profile.rewardPoints) : "0";

    const metrics = [
        {
            key: "wallet",
            icon: <IndianRupee size={19} />,
            label: "Wallet balance",
            hint: "Coming soon",
            value: "Rs 0",
            toneClass: "from-orange-500/20 to-amber-500/10",
        },
        {
            key: "points",
            icon: <Star size={19} />,
            label: "Reward points",
            hint: "1 point per Rs 10",
            value: pointsValue,
            toneClass: "from-yellow-500/20 to-lime-500/10",
        },
        {
            key: "offers",
            icon: <Gift size={19} />,
            label: "Offers",
            hint: "Coming soon",
            value: "Coming soon",
            toneClass: "from-fuchsia-500/15 to-rose-500/10",
        },
    ];

    return (
        <div className="space-y-4">
            <div className="space-y-2 px-1">
                <p className="theme-accent-text text-[11px] font-semibold uppercase tracking-[0.28em]">Wallet</p>
                <h1 className="text-2xl font-bold tracking-tight md:text-[2rem]">Wallet & rewards</h1>
                <p className="theme-muted text-xs md:text-sm">Track balance, points, and upcoming offers.</p>
            </div>

            <div className="grid gap-3 px-1 md:grid-cols-3">
                {metrics.map((metric) => (
                    <WalletCard
                        key={metric.key}
                        icon={metric.icon}
                        label={metric.label}
                        hint={metric.hint}
                        value={metric.value}
                        toneClass={metric.toneClass}
                    />
                ))}
            </div>

            <div className="theme-card mx-1 rounded-3xl border border-[var(--app-border)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles size={17} className="theme-accent-text" />
                    Loyalty update
                </div>
                <p className="theme-muted mt-2 text-xs md:text-sm">
                    You earn <span className="font-semibold">1 point for every Rs 10</span> spent. Redemption options will
                    be unlocked soon.
                </p>
            </div>
        </div>
    );
}

function WalletCard({ icon, label, value, hint, toneClass }) {
    return (
        <article className={`rounded-2xl border border-[var(--app-border)] bg-gradient-to-br ${toneClass} p-4`}>
            <div className="theme-soft-button inline-flex h-9 w-9 items-center justify-center rounded-xl">{icon}</div>
            <p className="theme-muted mt-3 text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</p>
            {hint && <p className="theme-muted mt-1 text-xs">{hint}</p>}
            <p className="mt-3 text-lg font-semibold tabular-nums md:text-xl">{value}</p>
        </article>
    );
}
