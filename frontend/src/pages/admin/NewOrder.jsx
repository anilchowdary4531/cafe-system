import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Clock3,
    Coffee,
    IceCream,
    LoaderCircle,
    Minus,
    Pizza,
    Plus,
    Salad,
    Sandwich,
    Search,
    ShoppingBag,
    Soup,
    Sparkles,
    Store,
    Tags,
    Truck,
    UtensilsCrossed,
    Volume2,
    VolumeX,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useStaffSocket } from "../../context/StaffSocketContext";
import useCachedGet from "../../hooks/useCachedGet";
import TableSelector from "../../components/TableSelector";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { showToast } from "../../utils/toast";

const ORDER_TYPES = /** @type {const} */ (["DINE_IN", "TAKEAWAY", "DELIVERY"]);

const ORDER_TYPE_META = {
    DINE_IN: { label: "Dine-in", Icon: Store },
    TAKEAWAY: { label: "Takeaway", Icon: ShoppingBag },
    DELIVERY: { label: "Delivery", Icon: Truck },
};

const toInr = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
};

const formatElapsed = (ms) => {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const hh = h > 0 ? String(h).padStart(2, "0") + ":" : "";
    return `${hh}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const categoryIconFor = (category) => {
    const c = String(category || "").toLowerCase();
    if (!c) return Tags;
    if (c.includes("coffee") || c.includes("latte") || c.includes("espresso") || c.includes("cappuccino")) return Coffee;
    if (c.includes("pizza")) return Pizza;
    if (c.includes("burger") || c.includes("sandwich") || c.includes("wrap")) return Sandwich;
    if (c.includes("salad")) return Salad;
    if (c.includes("soup")) return Soup;
    if (c.includes("dessert") || c.includes("ice") || c.includes("sweet")) return IceCream;
    return Tags;
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";

const mergeQty = (prev, menuItem, delta) => {
    const next = { ...(prev || {}) };
    const id = Number(menuItem?.id || 0);
    if (!id) return next;

    const existing = next[id] || null;
    const qty = Math.max(0, Number(existing?.qty || 0) + Number(delta || 0));

    if (qty <= 0) {
        delete next[id];
        return next;
    }

    next[id] = {
        id,
        menuItemId: id,
        name: String(menuItem?.name || "").trim(),
        price: Number(menuItem?.price || 0),
        qty,
    };
    return next;
};

const OrderTimer = memo(function OrderTimer({ startedAt }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div className="theme-panel inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm font-semibold">
            <Clock3 size={16} className="theme-muted" />
            <span className="tabular-nums">{formatElapsed(now - Number(startedAt || 0))}</span>
        </div>
    );
});

const OrderTypeToggle = memo(function OrderTypeToggle({ value, onChange }) {
    return (
        <div className="theme-panel inline-flex overflow-hidden rounded-2xl border border-white/10 bg-black/10 p-1">
            {ORDER_TYPES.map((type) => {
                const active = type === value;
                const meta = ORDER_TYPE_META[type];
                const Icon = meta.Icon;
                return (
                    <button
                        key={type}
                        type="button"
                        onClick={() => onChange(type)}
                        className={[
                            "theme-pos-choice inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                            active ? "is-active" : "",
                        ].join(" ")}
                        aria-pressed={active}
                    >
                        <Icon size={16} />
                        <span className="hidden sm:inline">{meta.label}</span>
                    </button>
                );
            })}
        </div>
    );
});

const CategorySidebar = memo(function CategorySidebar({ categories, activeKey, onSelect }) {
    return (
        <aside className="theme-panel self-start rounded-3xl border border-white/10 bg-black/10 p-3 lg:sticky lg:top-4">
            <p className="theme-muted px-2 pt-2 text-xs font-extrabold uppercase tracking-[0.24em]">Categories</p>
            <div className="mt-2 flex max-h-[calc(100vh-180px)] flex-col gap-1 overflow-auto px-1 pb-1">
                {categories.map((cat) => {
                    const active = cat.key === activeKey;
                    const Icon = cat.Icon;
                    return (
                        <button
                            key={cat.key}
                            type="button"
                            onClick={() => onSelect(cat.key)}
                            className={[
                                "theme-pos-choice flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-semibold transition",
                                active ? "is-active" : "",
                            ].join(" ")}
                            aria-current={active ? "page" : undefined}
                        >
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                                <Icon size={16} className="theme-pos-choice-icon" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{cat.label}</span>
                            {typeof cat.count === "number" && (
                                <span className="theme-pos-count-badge rounded-full px-2 py-0.5 text-xs tabular-nums">
                                    {cat.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </aside>
    );
});

const ItemCard = memo(function ItemCard({ item, qty, onAdd }) {
    const imageSrc = resolveImageUrl(item.image) || FALLBACK_IMAGE;
    return (
        <button
            type="button"
            onClick={() => onAdd(item)}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/10 p-4 text-left transition active:scale-[0.99] hover:bg-black/20"
        >
            <img
                src={imageSrc}
                alt={item.name}
                loading="lazy"
                className="mb-3 h-28 w-full rounded-2xl object-cover transition duration-300 group-hover:scale-[1.02]"
                onError={(event) => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                }}
            />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold sm:text-base">{item.name}</p>
                    <p className="theme-muted mt-1 truncate text-xs">
                        {item.category || "General"} - Rs {toInr(item.price)}
                    </p>
                </div>
                {qty > 0 && (
                    <span className="theme-pos-qty-badge inline-flex h-8 min-w-8 items-center justify-center rounded-2xl px-2 text-sm font-bold tabular-nums">
                        {qty}
                    </span>
                )}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition group-hover:opacity-100" />
        </button>
    );
});

const CartRow = memo(function CartRow({ item, onAdd, onSub, onRemove }) {
    const qty = Math.max(0, Number(item?.qty || 0));
    return (
        <div className="rounded-xl border border-white/10 bg-black/10 px-2.5 py-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold leading-tight">{item?.name || "Item"}</p>
                    <p className="theme-muted mt-0.5 text-[11px]">
                        Rs {toInr(item?.price)} - Qty {qty}
                    </p>
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/10 p-0.5 justify-self-center">
                    <button
                        type="button"
                        onClick={() => onSub(item)}
                        className="theme-soft-button rounded-lg p-1.5"
                        disabled={qty <= 0}
                        aria-label="Decrease quantity"
                    >
                        <Minus size={13} />
                    </button>
                    <span className="w-7 text-center text-[15px] font-bold tabular-nums leading-none">{qty}</span>
                    <button
                        type="button"
                        onClick={() => onAdd(item)}
                        className="theme-button rounded-lg p-1.5"
                        aria-label="Increase quantity"
                    >
                        <Plus size={13} />
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => onRemove(item)}
                    className="theme-soft-button justify-self-end rounded-xl px-2.5 py-1.5 text-[11px] font-semibold leading-none"
                >
                    Remove
                </button>
            </div>

            <div className="mt-1 flex justify-end">
                <p className="text-[15px] font-semibold tabular-nums leading-none">Rs {toInr(Number(item?.price || 0) * qty)}</p>
            </div>
        </div>
    );
});

export default function NewOrder() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const slug = String(user?.restaurant?.slug || "").trim();

    const [cart, setCart] = useState({});
    const [notes, setNotes] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [phone, setPhone] = useState("");
    const [search, setSearch] = useState("");
    const [placing, setPlacing] = useState(false);
    const [activeCategory, setActiveCategory] = useState("ALL");
    const [orderType, setOrderType] = useState(() => "TAKEAWAY");
    const [soundOn, setSoundOn] = useState(() => {
        try {
            return localStorage.getItem("pos:sound") === "1";
        } catch {
            return false;
        }
    });

    const [startedAt] = useState(() => Date.now());
    const searchRef = useRef(null);
    const lastTableRef = useRef("");
    const audioRef = useRef(null);

    const tableNo = String(searchParams.get("table") || "").trim() || null;

    const { data: menuData, loading: menuLoading, error: menuError } = useCachedGet(
        slug ? `/r/${slug}/menu` : "/r/_/menu",
        {
            enabled: Boolean(slug),
            ttlMs: 30_000,
            staleMs: 10 * 60_000,
            scope: `menu:${slug || "none"}`,
        }
    );

    const { data: aiData } = useCachedGet("/ai/recommendations", {
        enabled: Boolean(user),
        ttlMs: 60_000,
        staleMs: 5 * 60_000,
        scope: `ai:${user?.restaurantId || "none"}`,
    });

    const menu = useMemo(() => {
        const list = Array.isArray(menuData?.menu) ? menuData.menu : [];
        return list.map((m) => ({
            id: Number(m.id),
            name: String(m.name || "").trim(),
            category: String(m.category || "").trim() || "General",
            price: Number(m.price || 0),
            image: m.image || "",
        }));
    }, [menuData]);

    const recommendations = useMemo(() => {
        const items = Array.isArray(aiData?.topItems) ? aiData.topItems : [];
        const byId = new Map(menu.map((m) => [m.id, m]));
        return items
            .map((it) => byId.get(Number(it.menuItemId || 0)))
            .filter(Boolean)
            .slice(0, 6);
    }, [aiData, menu]);

    const filteredMenu = useMemo(() => {
        const q = search.trim().toLowerCase();
        const categoryKey = String(activeCategory || "ALL").trim().toUpperCase();
        const activeLabel = categoryKey === "ALL" ? "" : categoryKey;

        return menu.filter((m) => {
            if (activeLabel) {
                const cat = String(m.category || "").trim().toUpperCase();
                if (cat !== activeLabel) return false;
            }
            if (!q) return true;
            return m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
        });
    }, [activeCategory, menu, search]);

    const cartItems = useMemo(() => Object.values(cart || {}), [cart]);

    const subtotal = useMemo(() => {
        return cartItems.reduce((sum, it) => sum + Number(it.price || 0) * Math.max(1, Number(it.qty || 1)), 0);
    }, [cartItems]);

    const totalItems = useMemo(() => cartItems.reduce((sum, it) => sum + Math.max(1, Number(it.qty || 1)), 0), [cartItems]);

    const add = useCallback((item) => setCart((prev) => mergeQty(prev, item, +1)), []);
    const sub = useCallback((item) => setCart((prev) => mergeQty(prev, item, -1)), []);
    const removeItem = useCallback(
        (item) =>
            setCart((prev) => {
                const id = Number(item?.id || 0);
                if (!id) return prev || {};
                const next = { ...(prev || {}) };
                delete next[id];
                return next;
            }),
        []
    );

    const playTap = useCallback(() => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            let ctx = audioRef.current;
            if (!ctx) {
                ctx = new AudioContext();
                audioRef.current = ctx;
            }
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = 520;
            gain.gain.value = 0.03;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.04);
        } catch {
            // ignore
        }
    }, []);

    const addWithFeedback = useCallback(
        (item) => {
            add(item);
            if (soundOn) playTap();
        },
        [add, playTap, soundOn]
    );

    const clear = useCallback(() => {
        setCart({});
        setNotes("");
        setCustomerName("");
        setPhone("");
    }, []);

    const setOrderTypeSafe = useCallback(
        (next) => {
            const value = String(next || "").trim().toUpperCase();
            if (!ORDER_TYPES.includes(value)) return;

            if (value === "DINE_IN") {
                const last = String(lastTableRef.current || "").trim();
                if (!tableNo && last) {
                    setSearchParams(
                        (prev) => {
                            prev.set("table", last);
                            return prev;
                        },
                        { replace: true }
                    );
                }
            } else {
                if (tableNo) lastTableRef.current = tableNo;
                setSearchParams(
                    (prev) => {
                        prev.delete("table");
                        return prev;
                    },
                    { replace: true }
                );
            }

            setOrderType(value);
        },
        [setSearchParams, tableNo]
    );

    const categories = useMemo(() => {
        const counts = new Map();
        for (const m of menu) {
            const key = String(m.category || "").trim() || "General";
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        const list = [...counts.entries()]
            .map(([label, count]) => {
                const Icon = categoryIconFor(label);
                return { key: String(label).trim().toUpperCase(), label, count, Icon };
            })
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

        return [{ key: "ALL", label: "All Items", count: menu.length, Icon: Tags }, ...list];
    }, [menu]);

    useEffect(() => {
        if (!categories.some((c) => c.key === String(activeCategory || "").toUpperCase())) {
            setActiveCategory("ALL");
        }
    }, [activeCategory, categories]);

    useEffect(() => {
        const inferred = tableNo ? "DINE_IN" : orderType || "TAKEAWAY";
        if (!ORDER_TYPES.includes(inferred)) return;
        if (inferred !== orderType) setOrderType(inferred);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableNo]);

    useEffect(() => {
        try {
            localStorage.setItem("pos:sound", soundOn ? "1" : "0");
        } catch {
            // ignore
        }
    }, [soundOn]);

    useEffect(() => {
        if (!searchRef.current) return;
        searchRef.current.focus();
    }, []);

    const placeOrder = useCallback(() => {
        if (!socket || !connected) {
            showToast({ title: "Offline", message: "Socket not connected", variant: "error" });
            return;
        }
        if (placing) return;
        if (cartItems.length === 0) {
            showToast({ title: "Cart empty", message: "Add at least one item", variant: "error" });
            return;
        }
        if (String(orderType || "").toUpperCase() === "DINE_IN" && !tableNo) {
            showToast({ title: "Select table", message: "Choose a table for dine-in orders", variant: "error" });
            return;
        }

        setPlacing(true);
        socket.emit(
            "order:create",
            {
                orderType: String(orderType || "TAKEAWAY").toUpperCase(),
                tableNo: String(orderType || "").toUpperCase() === "DINE_IN" ? tableNo : null,
                notes: notes ? String(notes).trim() : null,
                customerName: customerName ? String(customerName).trim() : null,
                phone: phone ? String(phone).trim() : null,
                items: cartItems.map((it) => ({ menuItemId: it.menuItemId, qty: it.qty })),
            },
            (ack) => {
                try {
                    if (ack?.ok) {
                        showToast({
                            title: "Order placed",
                            message: ack?.order?.orderNo || "Ticket created",
                            variant: "success",
                        });
                        clear();
                        return;
                    }
                    showToast({
                        title: "Order failed",
                        message: String(ack?.message || "Unable to place order"),
                        variant: "error",
                    });
                } finally {
                    setPlacing(false);
                }
            }
        );
    }, [cartItems, clear, connected, customerName, notes, orderType, phone, placing, socket, tableNo]);

    // Reset cart between restaurant switches.
    useEffect(() => {
        clear();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    return (
        <div className="theme-page min-h-screen">
            <header className="theme-nav border-b px-4 py-4">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <p className="theme-muted text-xs uppercase tracking-[0.28em]">POS</p>
                        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
                            <UtensilsCrossed size={18} className="theme-accent-text" />
                            New Order
                        </h1>
                        <p className="theme-muted mt-1 text-xs sm:text-sm truncate">
                            {user?.restaurant?.name || "Restaurant"} - {connected ? "Live" : "Offline"}
                            {socketError ? ` (${socketError})` : ""}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <TableSelector slug={slug} variant="pos" disabled={String(orderType || "").toUpperCase() !== "DINE_IN"} />
                        <OrderTypeToggle value={String(orderType || "").toUpperCase()} onChange={setOrderTypeSafe} />
                        <OrderTimer startedAt={startedAt} />

                        <button
                            type="button"
                            onClick={() => setSoundOn((v) => !v)}
                            className="theme-panel inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm font-semibold hover:bg-black/20"
                        >
                            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                            <span className="hidden sm:inline">Sound</span>
                        </button>

                        <div className="theme-panel inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm font-semibold">
                            <span className="theme-muted">Waiter</span>
                            <span className="max-w-[160px] truncate">{user?.name || user?.email || user?.username || "Staff"}</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate("/waiter")}
                            className="theme-soft-button rounded-2xl px-4 py-2 text-sm font-semibold"
                        >
                            Waiter View
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/kitchen")}
                            className="theme-soft-button rounded-2xl px-4 py-2 text-sm font-semibold"
                        >
                            Kitchen View
                        </button>
                    </div>
                </div>

                <div className="mx-auto mt-3 flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="theme-panel flex w-full items-center gap-2 rounded-3xl border border-white/10 bg-black/10 px-4 py-3 sm:max-w-xl">
                        <Search size={18} className="theme-muted" />
                        <input
                            ref={searchRef}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search items, categories..."
                            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:opacity-60 sm:text-base"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setSearch("");
                                searchRef.current?.focus?.();
                            }}
                            className="theme-soft-button rounded-2xl px-3 py-2 text-xs font-semibold"
                        >
                            Clear Search
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[220px,1fr,380px]">
                <CategorySidebar
                    categories={categories}
                    activeKey={String(activeCategory || "ALL").toUpperCase()}
                    onSelect={setActiveCategory}
                />

                <section className="theme-panel rounded-3xl border border-white/10 bg-black/10 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Items</p>
                            <p className="mt-1 text-lg font-semibold">Tap to add</p>
                        </div>
                        <p className="theme-muted text-xs">
                            {filteredMenu.length} shown | {menu.length} total
                        </p>
                    </div>

                    {menuError && (
                        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                            {menuError}
                        </div>
                    )}

                    {recommendations.length > 0 && (
                        <div className="mt-4 rounded-3xl border border-white/10 bg-black/10 p-4">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="theme-accent-text" />
                                <p className="text-sm font-semibold">AI Picks</p>
                                <p className="theme-muted text-xs">Fast add</p>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {recommendations.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => addWithFeedback(item)}
                                        className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-left transition active:scale-[0.99] hover:bg-black/20"
                                    >
                                        <p className="text-sm font-semibold truncate">{item.name}</p>
                                        <p className="theme-muted text-xs">Rs {toInr(item.price)}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                        {menuLoading ? (
                            <div className="theme-muted text-sm">Loading menu...</div>
                        ) : (
                            filteredMenu.map((item) => (
                                <ItemCard
                                    key={item.id}
                                    item={item}
                                    qty={Number(cart?.[item.id]?.qty || 0)}
                                    onAdd={addWithFeedback}
                                />
                            ))
                        )}
                    </div>
                </section>

                <aside className="theme-panel self-start rounded-3xl border border-white/10 bg-black/10 p-4 lg:sticky lg:top-4">
                    <div className="flex items-end justify-between gap-2">
                        <div>
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Cart</p>
                            <p className="mt-1 text-lg font-semibold">
                                {totalItems} item{totalItems === 1 ? "" : "s"}
                            </p>
                        </div>
                        <p className="theme-muted text-sm tabular-nums">Rs {toInr(subtotal)}</p>
                    </div>

                    <div className="mt-4 flex max-h-[calc(100vh-360px)] flex-col gap-1.5 overflow-auto pr-1">
                        {cartItems.length === 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-black/10 p-6 text-center">
                                <p className="text-sm font-semibold">No items yet</p>
                                <p className="theme-muted mt-1 text-xs">Tap items to add them to the cart.</p>
                            </div>
                        ) : (
                            cartItems.map((it) => (
                                <CartRow key={it.id} item={it} onAdd={add} onSub={sub} onRemove={removeItem} />
                            ))
                        )}
                    </div>

                    <div className="mt-4 space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.2em]">Receipt</p>
                            {cartItems.length === 0 ? (
                                <p className="theme-muted mt-2 text-xs">Tap items to generate a receipt preview.</p>
                            ) : (
                                <div className="mt-2 space-y-1">
                                    {cartItems.map((it) => {
                                        const qty = Math.max(1, Number(it?.qty || 1));
                                        const lineTotal = Number(it?.price || 0) * qty;
                                        return (
                                            <div key={`receipt-${it.id}`} className="py-1">
                                                <div className="flex items-start justify-between gap-2 text-xs">
                                                    <p className="min-w-0 truncate font-semibold">{it?.name || "Item"}</p>
                                                    <p className="font-semibold tabular-nums">Rs {toInr(lineTotal)}</p>
                                                </div>
                                                <p className="theme-muted text-[11px]">{qty} x Rs {toInr(it?.price)}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="mt-3 border-t border-white/10 pt-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="theme-muted">Items</span>
                                    <span className="font-semibold tabular-nums">{totalItems}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-sm">
                                    <span className="font-semibold">Total</span>
                                    <span className="font-bold tabular-nums">Rs {toInr(subtotal)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={clear}
                                className="theme-soft-button rounded-2xl px-4 py-3 text-sm font-semibold"
                                disabled={placing}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={placeOrder}
                                className="theme-button rounded-2xl px-4 py-3 text-sm font-semibold"
                                disabled={!connected || placing}
                            >
                                {placing ? (
                                    <span className="inline-flex items-center gap-2">
                                        <LoaderCircle size={16} className="animate-spin" />
                                        Placing...
                                    </span>
                                ) : (
                                    "Place Order"
                                )}
                            </button>
                        </div>
                    </div>

                    <p className="theme-muted mt-3 text-xs">
                        Tax/service charge is calculated on the server after placing the order.
                    </p>
                </aside>
            </main>
        </div>
    );
}
