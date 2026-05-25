import { Mail, Phone, ShieldCheck, UserCircle2 } from "lucide-react";

export default function OverviewSection({ profile, profileLoading, profileError }) {
    return (
        <div className="space-y-6">
            <section className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Overview</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Customer profile</h1>
                <p className="theme-muted mt-3 text-sm md:text-base">
                    This is your overview page. Use the options above to open Orders, Wallet, Favorites, or Settings pages.
                </p>

                {profileError && (
                    <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {profileError}
                    </div>
                )}
            </section>

            <section className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Account</p>
                <h2 className="mt-2 text-2xl font-semibold">Profile details</h2>

                {profileLoading ? (
                    <p className="theme-muted mt-4 text-sm">Loading profile...</p>
                ) : (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <InfoCard
                            icon={<UserCircle2 size={18} />}
                            label="Name"
                            value={String(profile?.name || "Not provided")}
                        />
                        <InfoCard
                            icon={<Mail size={18} />}
                            label="Email"
                            value={String(profile?.email || "Not provided")}
                        />
                        <InfoCard
                            icon={<Phone size={18} />}
                            label="Phone"
                            value={String(profile?.phone || "Not provided")}
                        />
                        <InfoCard icon={<ShieldCheck size={18} />} label="Status" value="OTP verified" />
                    </div>
                )}
            </section>
        </div>
    );
}

function InfoCard({ icon, label, value }) {
    return (
        <div className="theme-card rounded-3xl p-5">
            <div className="theme-muted flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em]">
                <span className="theme-accent-text">{icon}</span>
                <span>{label}</span>
            </div>
            <p className="mt-3 break-words text-lg font-semibold">{value}</p>
        </div>
    );
}
