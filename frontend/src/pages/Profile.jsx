import { memo, useMemo } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ClipboardList, Heart, LayoutGrid, Settings, UserCircle2, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import useCustomerProfile from "../hooks/useCustomerProfile";
import OverviewSection from "./customer/profile/OverviewSection";
import OrdersSection from "./customer/profile/OrdersSection";
import OrderDetailsPage from "./customer/profile/OrderDetailsPage";
import WalletSection from "./customer/profile/WalletSection";
import FavoritesSection from "./customer/profile/FavoritesSection";
import SettingsSection from "./customer/profile/SettingsSection";

export default function Profile() {
    const { user, customer } = useAuth();

    if (user) {
        return <StaffProfile user={user} />;
    }

    if (!customer) {
        return (
            <div className="theme-page min-h-screen px-4 py-14">
                <div className="theme-panel mx-auto max-w-3xl rounded-3xl p-8 text-center">
                    <h1 className="text-3xl font-bold">Profile</h1>
                    <p className="theme-muted mt-3">No active customer session found. Log in with OTP first.</p>
                    <NavLink
                        to="/login?mode=customer"
                        className="theme-button mt-6 inline-block rounded-2xl px-5 py-3 font-semibold"
                    >
                        Login With OTP
                    </NavLink>
                </div>
            </div>
        );
    }

    return <CustomerProfileLayout />;
}

function CustomerProfileLayout() {
    const profileState = useCustomerProfile();
    const { profile, customerToken, loading, saving, error, updateProfile, setError } = profileState;

    const sidebarMeta = useMemo(() => {
        const phone = String(profile?.phone || "").trim();
        const title = String(profile?.name || "Customer").trim();
        const subtitle = profile?.email ? String(profile.email) : phone;
        return { title, subtitle, phone };
    }, [profile?.email, profile?.name, profile?.phone]);

    return (
        <div className="theme-page min-h-screen px-4 py-10 md:px-8">
            <div className="mx-auto w-full max-w-6xl">
                <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
                    <aside className="theme-panel rounded-[32px] p-6">
                        <div className="flex items-start gap-4">
                            <div className="theme-button flex h-12 w-12 items-center justify-center rounded-2xl">
                                <UserCircle2 size={26} />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-lg font-semibold">{sidebarMeta.title}</p>
                                <p className="theme-muted mt-1 truncate text-sm">{sidebarMeta.subtitle}</p>
                            </div>
                        </div>

                        <nav className="mt-6 space-y-2">
                            <SidebarLink to="/profile" end icon={<LayoutGrid size={18} />} label="Overview" />
                            <SidebarLink to="/profile/orders" icon={<ClipboardList size={18} />} label="Orders" />
                            <SidebarLink to="/profile/wallet" icon={<Wallet size={18} />} label="Wallet" />
                            <SidebarLink to="/profile/favorites" icon={<Heart size={18} />} label="Favorites" />
                            <SidebarLink to="/profile/settings" icon={<Settings size={18} />} label="Settings" />
                        </nav>

                        {error && (
                            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}
                    </aside>

                    <main className="min-w-0">
                        <Routes>
                            <Route
                                index
                                element={
                                    <OverviewSection
                                        profile={profile}
                                        customerToken={customerToken}
                                        profileLoading={loading}
                                        profileError={error}
                                    />
                                }
                            />
                            <Route path="orders/:id" element={<OrderDetailsPage />} />
                            <Route path="orders" element={<OrdersSection />} />
                            <Route path="wallet" element={<WalletSection profile={profile} customerToken={customerToken} />} />
                            <Route path="favorites" element={<FavoritesSection />} />
                            <Route
                                path="settings"
                                element={
                                    <SettingsSection
                                        profile={profile}
                                        customerToken={customerToken}
                                        loading={loading}
                                        saving={saving}
                                        error={error}
                                        updateProfile={updateProfile}
                                        setError={setError}
                                    />
                                }
                            />
                            <Route path="*" element={<Navigate to="/profile" replace />} />
                        </Routes>
                    </main>
                </div>
            </div>
        </div>
    );
}

const SidebarLink = memo(function SidebarLink({ to, icon, label, end }) {
    return (
        <NavLink
            to={to}
            end={Boolean(end)}
            className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive ? "theme-button" : "theme-soft-button hover:opacity-95"
                }`
            }
        >
            <span className="shrink-0">{icon}</span>
            <span className="min-w-0 truncate">{label}</span>
        </NavLink>
    );
});

function StaffProfile({ user }) {
    const role = String(user?.role || "STAFF").toUpperCase();
    const restaurant = user?.restaurant?.name || user?.restaurantName || "Not set";

    return (
        <div className="theme-page min-h-screen px-4 py-12 md:px-8">
            <div className="mx-auto w-full max-w-4xl space-y-6">
                <header className="theme-panel rounded-[32px] p-6 md:p-8">
                    <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Staff profile</p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{user?.name || "Staff"}</h1>
                    <p className="theme-muted mt-2 text-sm">{user?.email}</p>
                </header>
                <div className="grid gap-4 md:grid-cols-2">
                    <InfoCard label="Role" value={role} />
                    <InfoCard label="Restaurant" value={restaurant} />
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
