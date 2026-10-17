import { memo, useMemo } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import { ArrowLeft, Gift, Heart, IndianRupee, MapPin, Settings, Sparkles, Star, UserCircle2, Bell, Wallet, Calendar, RefreshCcw } from "lucide-react";
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
import PayLaterSection from "./customer/profile/PayLaterSection";
import PayLaterDetailSection from "./customer/profile/PayLaterDetailSection";
import CustomerNotifications from "./customer/profile/CustomerNotifications";
import DeleteAccountSection from "./customer/profile/DeleteAccountSection";
import CustomerLoyaltySection from "./customer/profile/CustomerLoyaltySection";
import CustomerOffersSection from "./customer/profile/CustomerOffersSection";
import CustomerReservationsSection from "./customer/profile/CustomerReservationsSection";
import CustomerProfileHeader from "../components/CustomerProfileHeader";


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
            <div className="theme-page min-h-screen px-4 sm:px-6 md:px-8 lg:px-10 py-3 sm:py-4 font-sans text-sm text-[color:var(--app-text)]">
                <div className="w-full max-w-[1440px] mx-auto space-y-4">
                    <CustomerProfileHeader
                        isOverview={false}
                        sectionLabel="Profile"
                        backTo="/"
                        title="Guest"
                    />
                    <div className="theme-panel mx-auto max-w-2xl rounded-2xl p-6 sm:p-8 text-center border border-[color:var(--app-border)]/40 mt-4">
                        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-orange-500/10 text-[var(--app-primary)] mb-3">
                            <UserCircle2 size={32} />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold">Customer Profile</h1>
                        <p className="theme-muted mt-2 text-xs sm:text-sm">No active customer session found. Log in with OTP to view your orders, wallet, and settings.</p>
                        <NavLink
                            to="/login?mode=customer"
                            className="inline-flex items-center justify-center gap-2 mt-5 rounded-xl bg-[var(--app-primary)] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:opacity-95 transition-all cursor-pointer"
                        >
                            Login With OTP
                        </NavLink>
                    </div>
                </div>
            </div>
        );
    }

    return <CustomerProfileLayout section={section} buildProfilePath={buildProfilePath} />;
}

function CustomerProfileLayout({ section, buildProfilePath }) {
    const profileState = useCustomerProfile();
    const { profile, customerToken, loading, saving, error, updateProfile, setError } = profileState;

    const { data: walletData } = useCachedGet("/api/wallet", {
        enabled: Boolean(customerToken),
        ttlMs: 15_000,
    });
    const walletBalance = walletData?.wallet?.balance !== undefined ? `Rs ${walletData.wallet.balance.toFixed(2)}` : "Rs 0.00";

    const sidebarMeta = useMemo(() => {
        const phone = String(profile?.phone || "").trim();
        const title = String(profile?.name || "Guest").trim();
        const subtitle = profile?.email ? String(profile.email) : phone;
        return { title, subtitle, phone };
    }, [profile?.email, profile?.name, profile?.phone]);
    const profileExtras = useMemo(() => getCustomerProfileExtras(sidebarMeta.phone), [sidebarMeta.phone]);
    const avatarDataUrl = String(profile?.avatarUrl || profileExtras?.avatarDataUrl || "").trim();

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
            : activeSection === "pay-later"
            ? "Pay Later Accounts"
            : activeSection === "pay-later-detail"
            ? "Pay Later Transactions"
            : activeSection === "notifications"
            ? "Notifications"
            : activeSection === "edit"
            ? "Edit profile"
            : activeSection === "favorites"
            ? "Favorites"
            : activeSection === "settings"
            ? "Settings"
            : activeSection === "delete-account"
            ? "Delete account"
            : "Profile";

    const sectionNode = (() => {
        if (activeSection === "loyalty") return <CustomerLoyaltySection />;
        if (activeSection === "offers") return <CustomerOffersSection />;
        if (activeSection === "reservations") return <CustomerReservationsSection />;
        if (activeSection === "delete-account") return <DeleteAccountSection />;

        if (activeSection === "ordersdetail") return <OrderDetailsPage />;
        if (activeSection === "orders") return <OrdersSection />;
        if (activeSection === "addresses") {
            return <AddressesSection profile={profile} customerToken={customerToken} />;
        }
        if (activeSection === "wallet") return <WalletSection profile={profile} customerToken={customerToken} />;
        if (activeSection === "pay-later") return <PayLaterSection />;
        if (activeSection === "pay-later-detail") return <PayLaterDetailSection />;
        if (activeSection === "notifications") return <CustomerNotifications />;
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
            <div className="theme-page min-h-screen px-4 sm:px-6 md:px-8 lg:px-10 py-3 sm:py-4 font-sans text-sm text-[color:var(--app-text)]">
                <div className="w-full max-w-[1440px] mx-auto space-y-3.5 sm:space-y-4">
                    {/* CUSTOMER PROFILE HEADER - Compact Tiffzy Brand Header + Profile Identity */}
                    <CustomerProfileHeader
                        isOverview={true}
                        title={sidebarMeta.title}
                        subtitle={sidebarMeta.subtitle}
                        phone={sidebarMeta.phone}
                        avatarDataUrl={avatarDataUrl}
                    />

                    {/* PROFILE NAVIGATION - Borderless compact grid, subtle orange hover */}
                    <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5 pb-4 border-b border-[color:var(--app-border)]/40">
                        <OverviewActionCard
                            to={buildProfilePath("/profile/wallet")}
                            icon={<Wallet size={18} />}
                            label="Wallet"
                            caption="Prepaid balance & top-up"
                        />
                        <OverviewActionCard
                            to={buildProfilePath("/profile/edit")}
                            icon={<UserCircle2 size={18} />}
                            label="Edit profile"
                            caption="Photo, name, number"
                        />
                        <OverviewActionCard
                            to={buildProfilePath("/profile/addresses")}
                            icon={<MapPin size={18} />}
                            label="Address"
                            caption="Saved delivery locations"
                        />
                        <OverviewActionCard
                            to={buildProfilePath("/profile/favorites")}
                            icon={<Heart size={18} />}
                            label="Favorites"
                            caption="Your liked dishes"
                        />
                        <OverviewActionCard
                            to={buildProfilePath("/profile/pay-later")}
                            icon={<IndianRupee size={18} />}
                            label="Pay Later"
                            caption="Manage restaurant credits"
                        />
                        <OverviewActionCard
                            to={buildProfilePath("/profile/notifications")}
                            icon={<Bell size={18} />}
                            label="Notifications"
                            caption="View updates & alerts"
                        />
                        <OverviewActionCard
                            to={buildProfilePath("/profile/settings")}
                            icon={<Settings size={18} />}
                            label="Settings"
                            caption="Profile preferences"
                        />
                    </nav>

                    {/* RECENT ORDERS SECTION */}
                    <RecentOrdersSection profile={profile} customerToken={customerToken} buildProfilePath={buildProfilePath} />

                    {/* WALLET PREVIEW SECTION - Horizontal 3-column KPI metrics */}
                    <section className="pt-1 space-y-3.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">
                                    WALLET PREVIEW
                                </div>
                                <h2 className="text-base sm:text-lg font-bold text-[color:var(--app-text)] mt-0.5">
                                    Rewards & Wallet
                                </h2>
                            </div>
                            <NavLink
                                to={buildProfilePath("/profile/wallet")}
                                reloadDocument
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-95 transition-all cursor-pointer"
                            >
                                <Wallet size={14} />
                                Manage Wallet
                            </NavLink>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 pt-1">
                            <Link to={buildProfilePath("/profile/wallet")} className="block group">
                                <ProfileValueCard
                                    icon={<Wallet size={18} />}
                                    label="Wallet balance"
                                    hint="Click to top-up"
                                    value={walletBalance}
                                    isHighlighted
                                />
                            </Link>
                            <ProfileValueCard
                                icon={<Star size={18} />}
                                label="Reward points"
                                hint="1 point per Rs 10"
                                value={profile?.rewardPoints !== undefined ? String(profile.rewardPoints) : "0"}
                            />
                            <ProfileValueCard
                                icon={<Gift size={18} />}
                                label="Offers"
                                hint="Special member discounts"
                                value="Coming soon"
                            />
                        </div>
                    </section>

                    {error && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="theme-page min-h-screen px-4 sm:px-6 md:px-8 lg:px-10 py-3 sm:py-4 font-sans text-sm text-[color:var(--app-text)]">
            <div className="w-full max-w-[1440px] mx-auto space-y-3.5 sm:space-y-4">
                <CustomerProfileHeader
                    isOverview={false}
                    sectionLabel={sectionLabel}
                    backTo={buildProfilePath("/profile/overview")}
                    title={sidebarMeta.title}
                    subtitle={sidebarMeta.subtitle}
                    phone={sidebarMeta.phone}
                    avatarDataUrl={avatarDataUrl}
                />

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
                `group flex items-start gap-3 rounded-lg p-2 text-left transition-all hover:bg-orange-500/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)] ${
                    isActive ? "bg-orange-500/[0.08]" : ""
                }`
            }
        >
            <span className="mt-0.5 text-[var(--app-primary)] group-hover:scale-110 transition-transform shrink-0">
                {icon}
            </span>
            <span className="min-w-0">
                <p className="text-sm font-bold text-[color:var(--app-text)] leading-tight group-hover:text-[var(--app-primary)] transition-colors">
                    {label}
                </p>
                <p className="theme-muted text-xs leading-normal mt-0.5">
                    {caption}
                </p>
            </span>
        </NavLink>
    );
});

function ProfileValueCard({ icon, label, hint, value, isHighlighted }) {
    if (isHighlighted) {
        return (
            <article className="rounded-xl p-3.5 bg-orange-500/[0.05] hover:bg-orange-500/[0.09] transition-all border border-orange-500/25">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">
                        {label}
                    </span>
                    <span className="text-[var(--app-primary)]">{icon}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[color:var(--app-text)] mt-1.5">
                    {value}
                </div>
                <div className="theme-muted text-xs mt-1">{hint}</div>
            </article>
        );
    }

    return (
        <article className="rounded-xl p-3.5 border border-[color:var(--app-border)]/30 bg-transparent sm:border-0 sm:border-l sm:border-[color:var(--app-border)]/40 sm:rounded-none sm:pl-6 transition-all">
            <div className="flex items-center justify-between">
                <span className="theme-muted text-xs font-medium uppercase tracking-wide">
                    {label}
                </span>
                <span className="theme-muted text-stone-400">{icon}</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[color:var(--app-text)] mt-1.5">
                {value}
            </div>
            <div className="theme-muted text-xs mt-1">{hint}</div>
        </article>
    );
}

function RecentOrdersSection({ profile, customerToken, buildProfilePath }) {
    const phone = String(profile?.phone || "").trim();
    const enabled = Boolean(phone || customerToken);
    const params = useMemo(() => (phone ? { phone } : undefined), [phone]);

    const { data, loading, error, refresh } = useCachedGet("/customer/orders", {
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
        <section className="pb-4 sm:pb-4.5 border-b border-[color:var(--app-border)]/40 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">
                        RECENT ORDERS
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-[color:var(--app-text)] mt-0.5">
                        Latest activity
                    </h2>
                </div>
                <NavLink
                    to={buildProfilePath("/profile/order-history")}
                    reloadDocument
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all shadow-sm"
                >
                    <span className="h-2 w-2 rounded-full bg-[var(--app-primary)]" />
                    Order History
                </NavLink>
            </div>

            {!enabled && <p className="theme-muted text-xs py-2">Login session required to load recent orders.</p>}
            {enabled && loading && <p className="theme-muted text-xs py-2">Loading recent orders...</p>}
            {enabled && error && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => {
                            if (!loading) {
                                refresh({ force: true });
                            }
                        }}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--app-primary)] px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
                    >
                        <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
                        {loading ? "Retrying..." : "Retry"}
                    </button>
                </div>
            )}

            {enabled && !loading && !error && (
                <>
                    {!recentOrders.length ? (
                        <p className="theme-muted text-xs py-2">No recent orders found.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 pt-1">
                            {recentOrders.map(({ order, restaurant }) => {
                                const createdAt = new Date(order?.createdAt);
                                const createdLabel = Number.isNaN(createdAt.getTime()) ? "Unknown date" : createdAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
                                const restaurantName = String(restaurant?.name || restaurant?.slug || "Restaurant");
                                const table = String(order?.tableNo || "").trim() || "Takeaway";
                                const orderId = String(order?.id || "").trim();
                                const cardNode = (
                                    <div className="rounded-xl border border-[color:var(--app-border)]/40 p-3.5 hover:border-orange-500/40 hover:bg-orange-500/[0.03] transition-all">
                                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)] truncate">
                                            {restaurantName}
                                        </div>
                                        <div className="text-sm font-bold text-[color:var(--app-text)] mt-1">
                                            Order #{order?.orderNo || order?.id}
                                        </div>
                                        <div className="theme-muted text-xs mt-0.5">
                                            {createdLabel}
                                        </div>
                                        <div className="mt-3 pt-2.5 border-t border-[color:var(--app-border)]/30 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-primary)]">
                                                    {formatStatus(order?.status)}
                                                </span>
                                                <span className="theme-muted text-[11px] font-medium">{table}</span>
                                            </div>
                                            <span className="font-bold text-[color:var(--app-text)] text-sm">
                                                {formatMoney(order?.total)}
                                            </span>
                                        </div>
                                    </div>
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
                                            className="block group"
                                        >
                                            {cardNode}
                                        </Link>
                                    ) : (
                                        <article key={String(`${restaurantName}-${createdLabel}`)}>
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
