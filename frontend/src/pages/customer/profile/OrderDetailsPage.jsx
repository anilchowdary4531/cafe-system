import { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useRestaurantContext } from "../../../context/RestaurantContext";
import useCachedGet from "../../../hooks/useCachedGet";
import { useCart } from "../../../context/CartContext";
import { showToast } from "../../../utils/toast";
import OrderTrackingTimeline from "../../../components/OrderTrackingTimeline";
import BrandLogo from "../../../components/BrandLogo";
import { reorderOrderToCart } from "../../OrderHistory";

const formatMoney = (value) => `₹${Math.round(Number(value || 0))}`;

const formatStatus = (status) => {
    const value = String(status || "PLACED").toUpperCase();
    return value.charAt(0) + value.slice(1).toLowerCase();
};

const safeDateTime = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
};

const DELIVERY_TRACKING_STEPS = [
    { key: "PLACED", label: "Placed", hint: "Order received" },
    { key: "PREPARING", label: "Preparing", hint: "Kitchen is working on it" },
    { key: "READY", label: "Ready", hint: "Out for delivery" },
    { key: "DELIVERED", label: "Delivered", hint: "Order delivered" },
];

const PICKUP_TRACKING_STEPS = [
    { key: "PLACED", label: "Placed", hint: "Order received" },
    { key: "PREPARING", label: "Preparing", hint: "Kitchen is working on it" },
    { key: "READY", label: "Ready", hint: "Ready for pickup" },
    { key: "PICKED_UP", label: "Picked Up", hint: "Collected by customer" },
];

export default function OrderDetailsPage() {
    const { id } = useParams();
    const orderId = Number(id || 0);
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { customer, customerToken } = useAuth();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const { addToCart } = useCart();
    const isCustomerScope = searchParams.get("scope") === "customer";
    const buildProfilePath = (path) => (isCustomerScope ? `${path}?scope=customer` : path);

    const stateOrder = location?.state?.order || null;
    const stateRestaurant = location?.state?.restaurant || null;
    const stateOrderMatches = Boolean(stateOrder && Number(stateOrder?.id || 0) === orderId);

    const phone = String(customer?.phone || "").trim();
    const enabled = Boolean((phone || customerToken) && orderId && !stateOrderMatches);
    const params = useMemo(() => (phone ? { phone } : undefined), [phone]);

    const { data, loading, error, refresh } = useCachedGet("/customer/orders", {
        enabled,
        params,
        ttlMs: 10_000,
        staleMs: 5 * 60_000,
        scope: phone ? `customer:${phone}` : "customer:session",
    });

    useEffect(() => {
        if (!enabled) return;
        refresh({ force: true });
    }, [enabled, refresh]);

    const resolved = useMemo(() => {
        const groups = Array.isArray(data?.groups) ? data.groups : [];
        for (const g of groups) {
            const restaurant = g?.restaurant || null;
            const orders = Array.isArray(g?.orders) ? g.orders : [];
            const match = orders.find((o) => Number(o?.id || 0) === orderId);
            if (match) {
                return {
                    order: match,
                    restaurant: {
                        slug: String(restaurant?.slug || "").trim(),
                        name: String(restaurant?.name || restaurant?.slug || "").trim(),
                    },
                };
            }
        }

        if (stateOrderMatches) {
            const slug = String(stateRestaurant?.slug || stateOrder?.restaurant?.slug || "").trim();
            const name = String(stateRestaurant?.name || stateOrder?.restaurant?.name || "").trim();
            return { order: stateOrder, restaurant: { slug, name } };
        }

        return { order: null, restaurant: { slug: "", name: "" } };
    }, [data?.groups, orderId, stateOrder, stateOrderMatches, stateRestaurant?.name, stateRestaurant?.slug]);

    const order = resolved.order;
    const restaurantSlug = String(resolved.restaurant?.slug || "").trim();
    const restaurantName = String(resolved.restaurant?.name || restaurantSlug || "Restaurant").trim();

    const items = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order?.items]);
    const status = String(order?.status || "PLACED").toUpperCase();
    const fulfillmentHint = String(location?.state?.fulfillment || searchParams.get("fulfillment") || "").trim().toLowerCase();
    const orderSource = String(order?.orderSource || stateOrder?.orderSource || "").trim().toUpperCase();
    const orderFulfillment = String(order?.fulfillment || stateOrder?.fulfillment || "").trim().toUpperCase();
    const isPickupOrder =
        fulfillmentHint === "pickup" ||
        orderFulfillment === "PICKUP" ||
        ["PICKUP", "POS", "COUNTER", "TAKEAWAY", "TAKE_AWAY"].includes(orderSource) ||
        (orderSource === "ONLINE" && !order?.deliveryAddress);
    const isDeliveryOrder =
        fulfillmentHint === "delivery" ||
        orderFulfillment === "DELIVERY" ||
        Boolean(order?.deliveryAddress) ||
        ["DELIVERY", "HOME_DELIVERY", "DOOR_DELIVERY"].includes(orderSource) ||
        orderSource === "ONLINE";
    const orderFlowLabel = isPickupOrder
        ? "Pickup order"
        : isDeliveryOrder
            ? "Delivery order"
            : order?.tableNo
                ? `Table ${order.tableNo}`
                : "Dine-in order";
    const trackingSteps = isPickupOrder ? PICKUP_TRACKING_STEPS : isDeliveryOrder ? DELIVERY_TRACKING_STEPS : undefined;

    const handleReorder = () => {
        if (!order || !restaurantSlug) return;
        const addedCount = reorderOrderToCart({
            restaurantSlug,
            order,
            addToCart,
            setRestaurantContext,
            navigate,
            tableNo: restaurantContext?.tableNo || "",
        });
        if (addedCount > 0) {
            showToast({
                title: "Cart updated",
                message: `Added ${addedCount} item${addedCount === 1 ? "" : "s"} from this order.`,
                variant: "success",
            });
        }
    };

    return (
        <div className="space-y-6">
            <header className="theme-panel rounded-[32px] p-6 md:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Order Details</p>
                        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                            Order #{order?.orderNo || orderId || "—"}
                        </h1>
                        <p className="theme-muted mt-3 text-sm md:text-base">
                            <span className="inline-flex items-center gap-2">
                                <BrandLogo className="h-4 w-4" title="Restaurant logo" />
                                {restaurantName}
                            </span>
                            <span className="mx-2 opacity-50">•</span>
                            <span className="font-semibold">{formatStatus(status)}</span>
                            <span className="mx-2 opacity-50">•</span>
                            <span className="font-semibold">{orderFlowLabel}</span>
                            <span className="mx-2 opacity-50">•</span>
                            <span className="tabular-nums">{safeDateTime(order?.createdAt)}</span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            to={buildProfilePath("/profile/order-history")}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                        >
                            <ArrowLeft size={16} />
                            Back to Orders
                        </Link>
                        {restaurantSlug && (
                            <button
                                type="button"
                                onClick={handleReorder}
                                className="theme-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                                disabled={!order}
                            >
                                <ClipboardList size={16} />
                                Reorder
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-6 rounded-3xl border border-white/10 bg-black/10 p-6">
                    <OrderTrackingTimeline
                        status={status}
                        steps={trackingSteps}
                        compact
                    />
                </div>

                {loading && <p className="theme-muted mt-6 text-sm">Loading order…</p>}
                {error && (
                    <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}
                {!loading && !error && !order && (
                    <div className="theme-empty mt-6 rounded-3xl p-6">Order not found.</div>
                )}
            </header>

            {!!order && (
                <div className="grid gap-6 lg:grid-cols-3">
                    <section className="theme-panel rounded-[32px] p-6 lg:col-span-2">
                        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Items</p>
                        <h2 className="mt-2 text-2xl font-semibold">Order items</h2>

                        {!items.length ? (
                            <div className="theme-empty mt-6 rounded-3xl p-6">No items found for this order.</div>
                        ) : (
                            <div className="mt-6 space-y-3">
                                {items.map((item) => {
                                    const qty = Math.max(1, Number(item?.qty || 1));
                                    return (
                                        <div
                                            key={item.id || `${item.menuItemId || ""}:${item.itemName || ""}`}
                                            className="rounded-3xl border border-white/10 bg-black/10 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold">{String(item?.itemName || "Item")}</p>
                                                    <p className="theme-muted mt-2 text-xs">
                                                        Qty <span className="font-semibold tabular-nums">{qty}</span> •{" "}
                                                        <span className="tabular-nums">{formatMoney(item?.price)}</span> each
                                                    </p>
                                                </div>
                                                <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(item?.total)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <aside className="theme-panel self-start rounded-[32px] p-6 lg:sticky lg:top-4">
                        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Billing</p>
                        <h2 className="mt-2 text-2xl font-semibold">Summary</h2>

                        <div className="mt-6 space-y-2 rounded-3xl border border-white/10 bg-black/10 p-5 text-sm">
                            <Row label="Subtotal" value={formatMoney(order?.subtotal)} />
                            <Row label="Tax" value={formatMoney(order?.taxAmount)} />
                            <Row label="Service charge" value={formatMoney(order?.serviceChargeAmount)} />
                            <div className="my-2 h-px bg-white/10" />
                            <Row label="Total" value={formatMoney(order?.total)} strong />
                        </div>

                        {isDeliveryOrder && order?.deliveryAddress ? (
                            <div className="mt-6 rounded-3xl border border-white/10 bg-black/10 p-5">
                                <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Delivery Address</p>
                                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{order.deliveryAddress}</p>
                            </div>
                        ) : isPickupOrder ? (
                            <div className="mt-6 rounded-3xl border border-white/10 bg-black/10 p-5">
                                <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Pickup Order</p>
                                <p className="mt-3 text-sm leading-relaxed">
                                    Collect this order from the counter when the status reaches Ready.
                                </p>
                            </div>
                        ) : null}
                    </aside>
                </div>
            )}
        </div>
    );
}

function Row({ label, value, strong }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="theme-muted">{label}</span>
            <span className={strong ? "font-semibold" : ""}>{value}</span>
        </div>
    );
}
