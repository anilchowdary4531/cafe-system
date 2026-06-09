import { memo, useMemo } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import { ArrowLeft, Gift, Heart, IndianRupee, MapPin, Settings, Sparkles, Star, UserCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import useCustomerProfile from "../hooks/useCustomerProfile";
import useCachedGet from "../hooks/useCachedGet";
import { getCustomerProfileExtras } from "../utils/customerProfileExtras";
import OrdersSection from "./customer/profile/OrdersSection";
import AddressesSection from "./customer/profile/AddressesSection";
import OrderDetailsPage from "./customer/profile/OrderDetailsPage";
import WalletSection from "./customer/profile/WalletSection";
import FavoritesSection from "./customer/profile/FavoritesSection";
import SettingsSection from "./customer/profile/SettingsSection";
import EditProfileSection from "./customer/profile/EditProfileSection";

const formatMoney = (value) => `Rs ${Math.round(Number(value || 0))}`;
const formatStatus = (status) => {
    const value = String(status || "PLACED").toUpperCase();
    return value.charAt(0) + value.slice(1).toLowerCase();
};

export default function Profile({ section = "overview" }) {
    const { user, customer, staffToken } = useAuth();
    const [searchParams] = useSearchParams();
    const forceCustomerMode = searchParams.get("scope") === "customer";
    const buildProfilePath = (path) => (forceCustomerMode ? `${path}?scope=customer` : path);
    const hasStaffSession = Boolean(user && staffToken);

    if (hasStaffSession && !forceCustomerMode) {
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

    return <CustomerProfileLayout section={section} buildProfilePath={buildProfilePath} />;
}

function CustomerProfileLayout({ section, buildProfilePath }) {
    const profileState = useCustomerProfile();
    const { profile, customerToken, loading, saving, error, updateProfile, setError } = profileState;

    const sidebarMeta = useMemo(() => {
        const phone = String(profile?.phone || "").trim();
        const title = String(profile?.name || "Customer").trim();
        const subtitle = profile?.email ? String(profile.email) : phone;
        return { title, subtitle, phone };
    }, [profile?.email, profile?.name, profile?.phone]);
    const profileExtras = useMemo(() => getCustomerProfileExtras(sidebarMeta.phone), [sidebarMeta.phone]);
    const avatarDataUrl = String(profileExtras?.avatarDataUrl || "").trim();

    const activeSection = String(section || "overview").toLowerCase();
    const isOverviewPage = activeSection === "overview";
    const sectionLabel =
        activeSection === "ordersdetail"
            ? "Order details"
            : activeSection === "orders"
            ? "Orders"
            : activeSection === "addresses"
            ? "Address"
            : activeSection === "wallet"
            ? "Wallet"
            : activeSection === "edit"
            ? "Edit profile"
            : activeSection === "favorites"
            ? "Favorites"
            : activeSection === "settings"
            ? "Settings"
            : "Profile";

    const sectionNode = (() => {
        if (activeSection === "ordersdetail") return <OrderDetailsPage />;
        if (activeSection === "orders") return <OrdersSection />;
        if (activeSection === "addresses") {
            return <AddressesSection profile={profile} customerToken={customerToken} />;
        }
        if (activeSection === "wallet") return <WalletSection profile={profile} customerToken={customerToken} />;
        if (activeSection === "edit") {
            return (
                <EditProfileSection
                    profile={profile}
                    customerToken={customerToken}
                    loading={loading}
                    saving={saving}
                    error={error}
                    updateProfile={updateProfile}
                    setError={setError}
                />
            );
        }
        if (activeSection === "favorites") return <FavoritesSection />;
        if (activeSection === "settings") {
            return (
                <SettingsSection
                    profile={profile}
                    customerToken={customerToken}
                    loading={loading}
                    saving={saving}
                    error={error}
                    updateProfile={updateProfile}
                    setError={setError}
                />
            );
        }

        return null;
    })();

    if (isOverviewPage) {
        return (
            <div className="theme-page profile-overview-flat min-h-screen px-4 py-10 md:px-8">
                <div className="mx-auto w-full max-w-6xl space-y-6">
                    <header className="theme-panel rounded-[32px] p-6">
                        <div className="flex items-start gap-4">
                            <div className="theme-button flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
                                {avatarDataUrl ? (
                                    <img src={avatarDataUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <UserCircle2 size={26} />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-lg font-semibold">{sidebarMeta.title}</p>
                                <p className="theme-muted mt-1 truncate text-sm">{sidebarMeta.subtitle}</p>
                            </div>
                        </div>

                        <nav className="mt-4 flex flex-wrap items-center gap-2.5">
                            <OverviewActionCard
                                to={buildProfilePath("/profile/edit")}
                                icon={<UserCircle2 size={19} />}
                                label="Edit profile"
                                caption="Photo, name, number"
                            />
                            <OverviewActionCard
                                to={buildProfilePath("/profile/addresses")}
                                icon={<MapPin size={19} />}
                                label="Address"
                                caption="Saved delivery locations"
                            />
                            <OverviewActionCard
                                to={buildProfilePath("/profile/favorites")}
                                icon={<Heart size={19} />}
                                label="Favorites"
                                caption="Your liked dishes"
                            />
                            <OverviewActionCard
                                to={buildProfilePath("/profile/settings")}
                                icon={<Settings size={19} />}
                                label="Settings"
                                caption="Profile preferences"
                            />
                        </nav>

                        <RecentOrdersSection profile={profile} customerToken={customerToken} buildProfilePath={buildProfilePath} />

                        <section className="mt-4 rounded-3xl p-1">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="theme-accent-text text-[11px] font-semibold uppercase tracking-[0.26em]">
                                        Wallet preview
                                    </p>
                                    <h2 className="mt-1 text-lg font-semibold">Rewards at a glance</h2>
                                </div>
                                <span className="theme-soft-button inline-flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-semibold">
                                    <Sparkles size={14} />
                                    Coming soon
                                </span>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
                                <ProfileValueCard
                                    icon={<IndianRupee size={18} />}
                                    label="Wallet balance"
                                    hint="Coming soon"
                                    value="Rs 0"
                                    toneClass="from-orange-500/18 to-amber-500/8"
                                />
                                <ProfileValueCard
                                    icon={<Star size={18} />}
                                    label="Reward points"
                                    hint="1 point per Rs 10"
                                    value="399"
                                    toneClass="from-yellow-500/18 to-lime-500/8"
                                />
                                <ProfileValueCard
                                    icon={<Gift size={18} />}
                                    label="Offers"
                                    hint="Coming soon"
                                    value="Coming soon"
                                    toneClass="from-fuchsia-500/14 to-rose-500/8"
                                />
                            </div>
                        </section>

                        {error && (
                            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}
                    </header>
                </div>
            </div>
        );
    }

    return (
        <div className="theme-page min-h-screen px-4 py-10 md:px-8">
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="flex items-center gap-3 px-1">
                    <NavLink
                        to={buildProfilePath("/profile/overview")}
                        reloadDocument
                        aria-label="Back to overview"
                        title="Back to overview"
                        className="theme-soft-button inline-flex h-10 w-10 items-center justify-center rounded-2xl hover:opacity-95"
                    >
                        <ArrowLeft size={18} />
                    </NavLink>
                    <p className="theme-muted text-sm font-semibold">{sectionLabel}</p>
                </header>

                <main className="min-w-0">{sectionNode}</main>
            </div>
        </div>
    );
}

const OverviewActionCard = memo(function OverviewActionCard({ to, icon, label, caption, end }) {
    return (
        <NavLink
            to={to}
            reloadDocument
            end={Boolean(end)}
            className={({ isActive }) =>
                `theme-soft-button profile-no-shadow-card inline-flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:-translate-y-0.5 ${
                    isActive ? "ring-1 ring-[var(--app-border-strong)]" : "opacity-95 hover:opacity-100"
                }`
            }
        >
            <span className="theme-soft-button inline-flex h-8 w-8 items-center justify-center rounded-lg">{icon}</span>
            <span className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{label}</p>
                <p className="theme-muted text-[11px] leading-tight">{caption}</p>
            </span>
        </NavLink>
    );
});

function ProfileValueCard({ icon, label, hint, value, toneClass }) {
    return (
        <article className={`profile-no-shadow-card rounded-2xl bg-gradient-to-br ${toneClass} px-3 py-3 backdrop-blur-sm`}>
            <div className="theme-soft-button inline-flex h-7 w-7 items-center justify-center rounded-lg">{icon}</div>
            <p className="theme-muted mt-2 text-[10px] font-semibold uppercase tracking-[0.2em]">{label}</p>
            <p className="theme-muted mt-1 text-[11px]">{hint}</p>
            <p className="mt-2 text-base font-semibold tabular-nums md:text-lg">{value}</p>
        </article>
    );
}

function RecentOrdersSection({ profile, customerToken, buildProfilePath }) {
    const phone = String(profile?.phone || "").trim();
    const enabled = Boolean(phone || customerToken);
    const params = useMemo(() => (phone ? { phone } : undefined), [phone]);

    const { data, loading, error } = useCachedGet("/customer/orders", {
        enabled,
        params,
        ttlMs: 15_000,
        staleMs: 2 * 60_000,
        scope: phone ? `customer:${phone}` : "customer:session",
    });

    const recentOrders = useMemo(() => {
        const groups = Array.isArray(data?.groups) ? data.groups : [];
        return groups
            .flatMap((group) => {
                const restaurant = group?.restaurant || null;
                const orders = Array.isArray(group?.orders) ? group.orders : [];
                return orders.map((order) => ({ order, restaurant }));
            })
            .sort((a, b) => new Date(b?.order?.createdAt).getTime() - new Date(a?.order?.createdAt).getTime())
            .slice(0, 3);
    }, [data?.groups]);

    return (
        <section className="mt-5 rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="theme-accent-text text-[11px] font-semibold uppercase tracking-[0.22em]">Recent orders</p>
                    <h2 className="mt-1 text-lg font-semibold">Latest activity</h2>
                </div>
                <NavLink
                    to={buildProfilePath("/profile/order-history")}
                    reloadDocument
                    className="theme-soft-button inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                    <span className="inline-block h-2 w-2 rounded-full bg-[var(--app-accent)]" />
                    Order History
                </NavLink>
            </div>

            {!enabled && <p className="theme-muted mt-3 text-xs">Login session required to load recent orders.</p>}
            {enabled && loading && <p className="theme-muted mt-3 text-xs">Loading recent orders...</p>}
            {enabled && error && (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
            )}

            {enabled && !loading && !error && (
                <>
                    {!recentOrders.length ? (
                        <p className="theme-muted mt-3 text-xs">No recent orders found.</p>
                    ) : (
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                            {recentOrders.map(({ order, restaurant }) => {
                                const createdAt = new Date(order?.createdAt);
                                const createdLabel = Number.isNaN(createdAt.getTime()) ? "Unknown date" : createdAt.toLocaleString();
                                const restaurantName = String(restaurant?.name || restaurant?.slug || "Restaurant");
                                const table = String(order?.tableNo || "").trim() || "Takeaway";
                                const orderId = String(order?.id || "").trim();
                                const cardNode = (
                                    <>
                                        <p className="theme-muted text-[10px] font-semibold uppercase tracking-[0.18em]">{restaurantName}</p>
                                        <p className="mt-1 text-sm font-semibold">Order #{order?.orderNo || order?.id}</p>
                                        <p className="theme-muted mt-1 text-[11px]">{createdLabel}</p>
                                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                            <span className="theme-pill rounded-full px-2 py-1">{formatStatus(order?.status)}</span>
                                            <span className="theme-pill rounded-full px-2 py-1">{table}</span>
                                            <span className="theme-pill rounded-full px-2 py-1">{formatMoney(order?.total)}</span>
                                        </div>
                                    </>
                                );

                                return (
                                    orderId ? (
                                        <Link
                                            key={String(order?.id)}
                                            to={buildProfilePath(`/profile/orders/${encodeURIComponent(orderId)}`)}
                                            state={{
                                                order,
                                                restaurant: {
                                                    name: restaurantName,
                                                    slug: String(restaurant?.slug || ""),
                                                },
                                            }}
                                            className="block rounded-xl bg-white/[0.03] px-3 py-3 transition hover:-translate-y-0.5 hover:bg-white/[0.05]"
                                        >
                                            {cardNode}
                                        </Link>
                                    ) : (
                                        <article key={String(`${restaurantName}-${createdLabel}`)} className="rounded-xl bg-white/[0.03] px-3 py-3">
                                            {cardNode}
                                        </article>
                                    )
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

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
