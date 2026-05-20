import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Search,
    Star,
    ShoppingCart,
    Flame,
    Clock3,
    Heart,
    Plus,
    ReceiptText,
    UserRound,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useRestaurantContext } from "../context/RestaurantContext";
import { cachedGet } from "../utils/apiClient";

const categoryData = [
    { name: "All", image: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png" },
    { name: "Coffee", image: "https://cdn-icons-png.flaticon.com/512/2935/2935307.png" },
    { name: "Latte", image: "https://cdn-icons-png.flaticon.com/512/924/924514.png" },
    { name: "Espresso", image: "https://cdn-icons-png.flaticon.com/512/590/590685.png" },
    { name: "Burger", image: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png" },
    { name: "Pizza", image: "https://cdn-icons-png.flaticon.com/512/3595/3595458.png" },
];

const STATUS_STYLES = {
    PLACED: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    ACCEPTED: "border-blue-400/20 bg-blue-400/10 text-blue-200",
    PREPARING: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    READY: "border-orange-400/20 bg-orange-400/10 text-orange-200",
    DELIVERED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    CANCELLED: "border-red-400/20 bg-red-400/10 text-red-200",
};

const ACTIVE_STATUSES = new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]);

const getImage = (item) => {
    if (item.image) return item.image;

    const map = {
        "veg biryani": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d",
        pizza: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3",
        burger: "https://images.unsplash.com/photo-1550547660-d9450f859349",
        pasta: "https://images.unsplash.com/photo-1521389508051-d7ffb5dc8f70",
        cappuccino: "https://images.unsplash.com/photo-1509042239860-f550ce710b93",
        latte: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735",
        espresso: "https://images.unsplash.com/photo-1511920170033-f8396924c348",
    };

    return map[item.name?.toLowerCase()] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";
};

const formatMoney = (value) => `₹${Math.round(Number(value || 0))}`;

const formatStatus = (status) => {
    const value = String(status || "PLACED").toUpperCase();
    return value.charAt(0) + value.slice(1).toLowerCase();
};

export default function Menu() {
    const navigate = useNavigate();
    const { addToCart, cart } = useCart();
    const { customer } = useAuth();
    const { restaurantContext } = useRestaurantContext();
    const phone = String(customer?.phone || "").trim();
    const slug = String(restaurantContext?.slug || "").trim();
    const [items, setItems] = useState([]);
    const [active, setActive] = useState("All");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [ordersError, setOrdersError] = useState("");

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const data = await cachedGet("/menu", { ttlMs: 60_000, staleMs: 15 * 60_000 });
                setItems(data || []);
            } catch (err) {
                console.error("Menu fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMenu();
    }, []);

    useEffect(() => {
        if (!phone || !slug) {
            setOrders([]);
            return undefined;
        }

        let alive = true;

        const fetchOrders = async () => {
            try {
                if (alive) setOrdersLoading(true);
                const data = await cachedGet(`/r/${slug}/orders`, {
                    params: { phone },
                    ttlMs: 12_000,
                    staleMs: 0,
                    scope: `customer:${phone}`,
                    revalidate: false,
                });
                if (!alive) return;
                setOrders(Array.isArray(data) ? data : []);
                setOrdersError("");
            } catch (err) {
                if (!alive) return;
                setOrdersError(err.response?.data?.message || "Failed to load your orders");
            } finally {
                if (alive) setOrdersLoading(false);
            }
        };

        fetchOrders();

        return () => {
            alive = false;
        };
    }, [phone, slug]);

    const filtered = useMemo(() => {
        return items.filter((item) => {
            const matchCategory =
                active === "All" ||
                item.category?.toLowerCase() === active.toLowerCase() ||
                item.name?.toLowerCase().includes(active.toLowerCase());

            const matchSearch =
                item.name?.toLowerCase().includes(search.toLowerCase()) ||
                item.description?.toLowerCase().includes(search.toLowerCase());

            return matchCategory && matchSearch;
        });
    }, [items, active, search]);

    const visibleOrders = orders.filter((order) => String(order.status || "").toUpperCase() !== "DELIVERED");
    const activeOrders = visibleOrders.filter((order) => ACTIVE_STATUSES.has(String(order.status || "").toUpperCase()));
    return (
        <div id="menu" className="theme-page min-h-screen">
            <div className="theme-nav sticky top-0 z-40 border-b">
                <div className="mx-auto max-w-7xl px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="theme-muted text-sm">
                                {customer?.name ? `Welcome back, ${customer.name}` : "Welcome 👋"}
                            </p>
                            <h1 className="text-2xl font-bold">Discover Great Taste</h1>
                        </div>

                        <button
                            onClick={() => navigate("/cart")}
                            className="theme-icon-button relative rounded-xl p-3"
                            aria-label="Open cart"
                        >
                            <ShoppingCart size={20} />
                            {cart?.length > 0 && (
                                <span className="theme-count-badge absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs">
                                    {cart.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="relative mt-4">
                        <Search
                            size={18}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search food, coffee, burger..."
                            className="theme-input w-full rounded-2xl py-3 pl-11 pr-4 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 py-6">
                <div className="theme-promo mb-8 rounded-3xl p-6">
                    <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                        <div>
                            <p className="font-semibold">🔥 Today Special Offer</p>
                            <h2 className="mt-1 text-3xl font-bold">Buy 1 Get 1 Free Coffee</h2>
                            <p className="theme-muted-strong mt-2">
                                Premium handcrafted beverages for your day.
                            </p>
                        </div>

                        <button
                            onClick={() => window.scrollTo({ top: 540, behavior: "smooth" })}
                            className="theme-dark-button rounded-xl px-6 py-3 font-semibold transition hover:scale-105"
                        >
                            Order Now
                        </button>
                    </div>
                </div>

                {customer?.phone && (
                    <section className="theme-panel mb-8 rounded-3xl p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="theme-accent-text flex items-center gap-2">
                                    <ReceiptText size={18} />
                                    <p className="text-sm font-semibold uppercase tracking-[0.28em]">My Orders</p>
                                </div>
                                <h2 className="mt-3 text-2xl font-bold">Track your current and recent orders</h2>
                                <p className="theme-muted mt-2 max-w-2xl text-sm">
                                    Your order status updates here after the admin, staff, or kitchen team changes it.
                                    Active orders show a default 5 minute prep estimate.
                                </p>
                            </div>

                            <button
                                onClick={() => navigate("/orders/history")}
                                className="theme-soft-button rounded-2xl px-4 py-3 text-sm font-semibold"
                            >
                                Order History
                            </button>
                        </div>

                        {ordersLoading && <p className="theme-muted mt-5 text-sm">Loading your orders...</p>}
                        {ordersError && <p className="mt-5 text-sm text-red-300">{ordersError}</p>}

                        {!ordersLoading && !visibleOrders.length && !ordersError && (
                            <div className="theme-empty mt-5 rounded-2xl p-5 text-sm">
                                No orders found for {customer.phone}. Place an order to start tracking it here.
                            </div>
                        )}

                        {!!visibleOrders.length && (
                            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                                {visibleOrders.map((order) => (
                                    <article
                                        key={order.id}
                                        className="theme-card rounded-2xl p-5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="theme-muted text-xs uppercase tracking-[0.2em]">
                                                    Order #{order.orderNo || order.id}
                                                </p>
                                                <h3 className="mt-2 text-xl font-semibold">
                                                    {formatMoney(order.total)} total
                                                </h3>
                                                <p className="theme-muted mt-1 text-sm">
                                                    Table {order.tableNo || "--"}
                                                    {ACTIVE_STATUSES.has(String(order.status || "").toUpperCase()) ? " • ETA 5 min" : ""}
                                                </p>
                                            </div>
                                            <span
                                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[String(order.status || "").toUpperCase()] || STATUS_STYLES.PLACED}`}
                                            >
                                                {formatStatus(order.status)}
                                            </span>
                                        </div>

                                        <div className="theme-muted-strong mt-4 space-y-2 text-sm">
                                            {(order.items || []).map((item) => (
                                                <div key={item.id} className="flex items-center justify-between">
                                                    <span>{item.itemName} x{item.qty}</span>
                                                    <span>{formatMoney(item.total)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                    </section>
                )}

                <div className="mb-8 flex gap-4 overflow-x-auto pb-3 no-scrollbar">
                    {categoryData.map((cat) => (
                        <button
                            key={cat.name}
                            onClick={() => setActive(cat.name)}
                            className={`min-w-[90px] rounded-2xl border p-3 transition ${
                                active === cat.name
                                    ? "theme-chip-active"
                                    : "theme-chip"
                            }`}
                        >
                            <img src={cat.image} alt={cat.name} className="mx-auto mb-2 h-8 w-8" />
                            <p className="text-sm font-medium">{cat.name}</p>
                        </button>
                    ))}
                </div>

                <div className="mb-8">
                    <div className="mb-4 flex items-center gap-2">
                        <Flame className="theme-accent-text" size={18} />
                        <h2 className="text-xl font-bold">Trending Now</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {items.slice(0, 3).map((item, index) => (
                            <div key={item.id} className="theme-card overflow-hidden rounded-3xl">
                                <img src={getImage(item)} alt={item.name} className="h-48 w-full object-cover" />
                                <div className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold">{item.name}</h3>
                                            <p className="theme-muted text-sm">Bestseller Choice</p>
                                        </div>
                                        <Heart size={18} className="theme-muted" />
                                    </div>

                                    <div className="theme-muted-strong mt-3 flex items-center gap-4 text-sm">
                                        <span className="flex items-center gap-1">
                                            <Star size={14} className="text-yellow-400" />
                                            {Number(item.rating || (4.2 + (index % 4) * 0.15)).toFixed(1)}
                                        </span>

                                        <span className="flex items-center gap-1">
                                            <Clock3 size={14} />
                                            15 min
                                        </span>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <span className="theme-price text-xl font-bold">{formatMoney(item.price)}</span>
                                        <button
                                            onClick={() => addToCart(item)}
                                            className="theme-button rounded-xl px-4 py-2 font-semibold"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mb-8">
                    <div className="mb-4 flex items-center gap-2">
                        <UserRound className="theme-accent-text" size={18} />
                        <h2 className="text-xl font-bold">Full Menu</h2>
                    </div>

                    {loading ? (
                        <div className="theme-panel rounded-3xl p-8 theme-muted">
                            Loading menu...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {filtered.map((item) => (
                                <div
                                    key={item.id}
                                    className="theme-card overflow-hidden rounded-3xl transition"
                                >
                                    <img
                                        src={getImage(item)}
                                        alt={item.name}
                                        className="h-52 w-full object-cover"
                                    />

                                    <div className="p-5">
                                        <div className="flex justify-between">
                                            <h3 className="text-xl font-bold">{item.name}</h3>
                                            <span className="theme-pill rounded-lg px-2 py-1 text-xs">
                                                ⭐ {item.rating || 4.5}
                                            </span>
                                        </div>

                                        <p className="theme-muted mt-2 text-sm">
                                            {item.description || "Freshly prepared premium quality."}
                                        </p>

                                        <div className="mt-5 flex items-center justify-between">
                                            <span className="theme-price text-xl font-bold">
                                                {formatMoney(item.price)}
                                            </span>

                                            <button
                                                onClick={() => addToCart(item)}
                                                className="theme-button flex h-11 w-11 items-center justify-center rounded-2xl"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!filtered.length && !loading && (
                        <div className="theme-muted mt-16 text-center">No items found</div>
                    )}
                </div>
            </div>
        </div>
    );
}
