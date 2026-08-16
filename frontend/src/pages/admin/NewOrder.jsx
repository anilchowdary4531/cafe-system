import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    ArrowLeft,
    Coffee,
    IceCream,
    LoaderCircle,
    Pause,
    Pizza,
    Play,
    Plus,
    Salad,
    Sandwich,
    Search,
    Soup,
    Tags,
    Trash2,
    UtensilsCrossed,
    X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useStaffSocket } from "../../context/StaffSocketContext";
import useCachedGet from "../../hooks/useCachedGet";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { showToast } from "../../utils/toast";

const toInr = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
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
const STORAGE_KEY_PREFIX = "tiffzy_pos_active_bills_";

const createDefaultBill = (counter = 1) => {
    const id = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const billNumber = `Bill #${String(counter).padStart(3, "0")}`;
    return {
        id,
        billNumber,
        cart: {},
        customerName: "",
        phone: "",
        notes: "",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
};

const normalizeBills = (billsList) => {
    if (!Array.isArray(billsList) || billsList.length === 0) {
        const fresh = createDefaultBill(1);
        return [fresh];
    }
    return billsList.map((bill, index) => ({
        ...bill,
        billNumber: `Bill #${String(index + 1).padStart(3, "0")}`,
    }));
};

const loadStoredBills = (slug) => {
    try {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${slug || "default"}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.bills) && parsed.bills.length > 0) {
                const normalized = normalizeBills(parsed.bills);
                const activeIdExists = normalized.some((b) => b.id === parsed.activeBillId);
                return {
                    bills: normalized,
                    activeBillId: activeIdExists ? parsed.activeBillId : normalized[0].id,
                    nextBillCounter: normalized.length + 1,
                };
            }
        }
    } catch {
        // Fallback to default
    }
    const initial = createDefaultBill(1);
    return {
        bills: [initial],
        activeBillId: initial.id,
        nextBillCounter: 2,
    };
};

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

const escapeReceiptText = (value) =>
    String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

const formatReceiptAmount = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "Rs 0.00";
    const amount = toInr(Math.abs(n));
    return n < 0 ? `- Rs ${amount}` : `Rs ${amount}`;
};

const buildBillPrintMarkup = ({ restaurantName, order } = {}) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    const subtotal = Number(order?.subtotal || 0);
    const taxAmount = Number(order?.taxAmount || 0);
    const serviceChargeAmount = Number(order?.serviceChargeAmount || 0);
    const discountAmount = Number(order?.discountAmount || 0);
    const total = Number(order?.total || 0);
    const createdAt = new Date(order?.createdAt || Date.now()).toLocaleString();
    const fulfillment = String(order?.fulfillment || "").trim().toUpperCase();
    const orderType = fulfillment === "DINE_IN" || String(order?.tableNo || "").trim()
        ? "Dine In"
        : "Takeaway";

    const metaRows = [
        ["Order No", order?.orderNo || "-"],
        ["Bill No", order?.invoiceNo || order?.orderNo || "-"],
        ["Type", orderType],
        ...(String(order?.tableNo || "").trim() ? [["Table", order.tableNo]] : []),
        ...(String(order?.customerName || "").trim() ? [["Customer", order.customerName]] : []),
        ...(String(order?.phone || "").trim() ? [["Phone", order.phone]] : []),
        ...(String(order?.notes || "").trim() ? [["Notes", order.notes]] : []),
    ];

    const itemRows = items.length
        ? items
              .map((item) => {
                  const qty = Math.max(1, Number(item?.qty || 1));
                  const unitPrice = Number(item?.price || 0);
                  const lineTotalValue = item?.total ?? unitPrice * qty;
                  const lineTotal = Number(lineTotalValue || 0);
                  return `
                    <tr>
                        <td>
                            <div class="item-name">${escapeReceiptText(item?.itemName || "Item")}</div>
                            <div class="item-meta">${qty} x ${formatReceiptAmount(unitPrice)}</div>
                        </td>
                        <td class="amount">${formatReceiptAmount(lineTotal)}</td>
                    </tr>
                `;
              })
              .join("")
        : `<tr><td colspan="2" class="empty-row">No items found.</td></tr>`;

    const summaryRows = [
        ["Subtotal", subtotal],
        ...(taxAmount > 0 ? [["Tax", taxAmount]] : []),
        ...(serviceChargeAmount > 0 ? [["Service Charge", serviceChargeAmount]] : []),
        ...(discountAmount > 0 ? [["Discount", -discountAmount]] : []),
    ]
        .map(
            ([label, amount]) => `
                <div class="summary-row">
                    <span>${escapeReceiptText(label)}</span>
                    <strong>${formatReceiptAmount(amount)}</strong>
                </div>
            `
        )
        .join("");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeReceiptText(restaurantName || "Bill")} - ${escapeReceiptText(order?.invoiceNo || order?.orderNo || "Receipt")}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 12px; }
    .receipt { width: 320px; margin: 0 auto; }
    .header {
      text-align: center;
      padding-bottom: 10px;
      margin-bottom: 10px;
      border-bottom: 1px dashed #999;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.1;
    }
    .header p {
      margin: 4px 0 0;
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #555;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 10px;
      font-size: 11px;
      margin-bottom: 10px;
    }
    .meta-item { min-width: 0; }
    .meta-label {
      display: block;
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 2px;
    }
    .meta-value {
      display: block;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.25;
      word-break: break-word;
    }
    .items {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0 8px;
      font-size: 12px;
    }
    .items td {
      padding: 4px 0;
      vertical-align: top;
      border-bottom: 1px dotted #ddd;
    }
    .items td.amount {
      text-align: right;
      white-space: nowrap;
      padding-left: 10px;
      font-weight: 700;
    }
    .item-name { font-weight: 700; line-height: 1.25; }
    .item-meta { margin-top: 2px; font-size: 10px; color: #666; }
    .empty-row {
      padding: 8px 0 !important;
      text-align: center;
      color: #666;
    }
    .summary {
      border-top: 1px dashed #999;
      padding-top: 8px;
      margin-top: 6px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      margin: 3px 0;
    }
    .summary-row strong { white-space: nowrap; }
    .total-row {
      border-top: 1px solid #333;
      margin-top: 8px;
      padding-top: 8px;
      font-size: 14px;
      font-weight: 800;
    }
    .footer {
      margin-top: 12px;
      text-align: center;
      font-size: 11px;
      color: #666;
    }
    @media print {
      body { padding: 0; }
      .receipt { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>${escapeReceiptText(restaurantName || "Bill")}</h1>
      <p>Bill</p>
    </div>

    <div class="meta">
      ${metaRows
          .map(
              ([label, value]) => `
                <div class="meta-item">
                  <span class="meta-label">${escapeReceiptText(label)}</span>
                  <span class="meta-value">${escapeReceiptText(value)}</span>
                </div>
              `
          )
          .join("")}
      <div class="meta-item">
        <span class="meta-label">Created At</span>
        <span class="meta-value">${escapeReceiptText(createdAt)}</span>
      </div>
    </div>

    <table class="items">
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="summary">
      ${summaryRows}
      <div class="summary-row total-row">
        <span>Total</span>
        <strong>${formatReceiptAmount(total)}</strong>
      </div>
    </div>

    <div class="footer">Thank you for your order</div>
  </div>
</body>
</html>`;
};

const CategorySidebar = memo(function CategorySidebar({ categories, activeKey, onSelect }) {
    return (
        <aside className="theme-panel new-order-borderless self-start rounded-3xl border border-white/10 bg-black/10 p-3 lg:sticky lg:top-4">
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
            className="group new-order-borderless relative overflow-hidden rounded-3xl border border-white/10 bg-black/10 p-4 text-left transition active:scale-[0.99] hover:bg-black/20"
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

const CartRow = memo(function CartRow({ item, onAdd, onSub, onRemove, onSetQty }) {
    const qty = Math.max(0, Number(item?.qty || 0));
    const [draftQty, setDraftQty] = useState(String(qty));

    useEffect(() => {
        setDraftQty(String(qty));
    }, [qty]);

    const handleDraftChange = useCallback(
        (value) => {
            const next = String(value || "").replace(/[^\d]/g, "");
            setDraftQty(next);
            if (next === "") return;
            onSetQty?.(item, next);
        },
        [item, onSetQty]
    );

    const handleDraftBlur = useCallback(() => {
        if (draftQty === "") {
            setDraftQty(String(qty));
            return;
        }
        onSetQty?.(item, draftQty);
    }, [draftQty, item, onSetQty, qty]);

    return (
        <div className="new-order-borderless w-full rounded-xl border border-white/10 bg-black/10 px-3.5 py-3">
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold leading-tight">{item?.name || "Item"}</p>
                    <p className="theme-muted mt-0.5 text-[11px]">
                        Rs {toInr(item?.price)} - Qty {qty}
                    </p>
                </div>
                <div className="inline-flex items-center gap-1.5 justify-self-center rounded-xl border border-white/10 bg-black/10 p-0.5">
                    <button
                        type="button"
                        onClick={() => onSub?.(item)}
                        className="theme-soft-button rounded-lg px-2.5 py-1 text-sm font-bold leading-none"
                        aria-label={`Decrease quantity of ${item?.name || "item"}`}
                        title="Decrease quantity"
                    >
                        -
                    </button>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={draftQty}
                        onChange={(event) => handleDraftChange(event.target.value)}
                        onBlur={handleDraftBlur}
                        onFocus={(event) => event.currentTarget.select()}
                        className="theme-soft-button w-12 rounded-lg px-1.5 py-1 text-center text-sm font-bold leading-none outline-none [appearance:textfield]"
                        aria-label={`Quantity for ${item?.name || "item"}`}
                        title="Edit quantity"
                    />
                    <button
                        type="button"
                        onClick={() => onAdd?.(item)}
                        className="theme-button rounded-lg px-2.5 py-1 text-sm font-bold leading-none"
                        aria-label={`Increase quantity of ${item?.name || "item"}`}
                        title="Increase quantity"
                    >
                        +
                    </button>
                </div>

                <div className="flex shrink-0 items-center gap-2 justify-self-end">
                    <p className="whitespace-nowrap text-[15px] font-semibold tabular-nums leading-none">Rs {toInr(Number(item?.price || 0) * qty)}</p>
                    <button
                        type="button"
                        onClick={() => onRemove?.(item)}
                        className="theme-soft-button inline-flex h-7 w-7 items-center justify-center rounded-full"
                        aria-label={`Remove ${item?.name || "item"} from cart`}
                        title="Remove item"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
});

export default function NewOrder() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const slug = String(user?.restaurant?.slug || "").trim();
    const restaurantName = String(user?.restaurant?.name || "Restaurant").trim() || "Restaurant";

    const [billState, setBillState] = useState(() => loadStoredBills(slug));
    const [search, setSearch] = useState("");
    const [placing, setPlacing] = useState(false);
    const [activeCategory, setActiveCategory] = useState("ALL");
    const [billToClose, setBillToClose] = useState(null);
    const searchRef = useRef(null);

    const tableNo = String(searchParams.get("table") || "").trim() || null;
    const orderType = tableNo ? "DINE_IN" : "TAKEAWAY";

    // Reload bills when slug changes
    useEffect(() => {
        setBillState(loadStoredBills(slug));
    }, [slug]);

    // Persist active bills to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(
                `${STORAGE_KEY_PREFIX}${slug || "default"}`,
                JSON.stringify(billState)
            );
        } catch {
            // ignore storage errors
        }
    }, [billState, slug]);

    const { bills, activeBillId } = billState;

    const activeBill = useMemo(() => {
        return bills.find((b) => b.id === activeBillId) || bills[0] || createDefaultBill(1);
    }, [bills, activeBillId]);

    const cart = activeBill?.cart || {};
    const customerName = activeBill?.customerName || "";
    const phone = activeBill?.phone || "";
    const notes = activeBill?.notes || "";
    const isCurrentHeld = activeBill?.status === "HELD";

    const updateActiveBill = useCallback((updater) => {
        setBillState((prev) => {
            const activeId = prev.activeBillId;
            const nextBills = prev.bills.map((b) => {
                if (b.id !== activeId) return b;
                const updated = typeof updater === "function" ? updater(b) : { ...b, ...updater };
                return {
                    ...updated,
                    updatedAt: new Date().toISOString(),
                };
            });
            return { ...prev, bills: nextBills };
        });
    }, []);

    const createNewBill = useCallback(() => {
        setBillState((prev) => {
            const newBill = createDefaultBill(prev.bills.length + 1);
            const normalized = normalizeBills([...prev.bills, newBill]);
            const newlyCreated = normalized[normalized.length - 1];
            return {
                ...prev,
                bills: normalized,
                activeBillId: newlyCreated.id,
                nextBillCounter: normalized.length + 1,
            };
        });
    }, []);

    const switchBill = useCallback((billId) => {
        setBillState((prev) => ({
            ...prev,
            activeBillId: billId,
        }));
    }, []);

    const toggleHoldBill = useCallback((targetBillId) => {
        setBillState((prev) => {
            const idToToggle = targetBillId || prev.activeBillId;
            const nextBills = prev.bills.map((b) => {
                if (b.id !== idToToggle) return b;
                const newStatus = b.status === "HELD" ? "ACTIVE" : "HELD";
                return { ...b, status: newStatus, updatedAt: new Date().toISOString() };
            });
            return { ...prev, bills: nextBills };
        });
    }, []);

    const deleteBill = useCallback((billId) => {
        setBillState((prev) => {
            const filtered = prev.bills.filter((b) => b.id !== billId);
            const normalized = normalizeBills(filtered);
            let newActiveId = prev.activeBillId;
            if (prev.activeBillId === billId) {
                const index = prev.bills.findIndex((b) => b.id === billId);
                const nextActive = normalized[Math.max(0, index - 1)] || normalized[0];
                newActiveId = nextActive.id;
            }
            return {
                ...prev,
                bills: normalized,
                activeBillId: newActiveId,
                nextBillCounter: normalized.length + 1,
            };
        });
        setBillToClose(null);
    }, []);

    const removeCompletedBill = useCallback((completedBillId) => {
        setBillState((prev) => {
            const targetId = completedBillId || prev.activeBillId;
            const filtered = prev.bills.filter((b) => b.id !== targetId);
            const normalized = normalizeBills(filtered);
            let newActiveId = prev.activeBillId;
            if (prev.activeBillId === targetId) {
                newActiveId = normalized[0].id;
            }
            return {
                ...prev,
                bills: normalized,
                activeBillId: newActiveId,
                nextBillCounter: normalized.length + 1,
            };
        });
    }, []);

    const setCustomerName = useCallback((name) => {
        updateActiveBill({ customerName: name });
    }, [updateActiveBill]);

    const setPhone = useCallback((ph) => {
        updateActiveBill({ phone: ph });
    }, [updateActiveBill]);

    const setNotes = useCallback((n) => {
        updateActiveBill({ notes: n });
    }, [updateActiveBill]);

    const { data: menuData, loading: menuLoading, error: menuError } = useCachedGet(
        slug ? `/r/${slug}/menu` : "/r/_/menu",
        {
            enabled: Boolean(slug),
            ttlMs: 30_000,
            staleMs: 10 * 60_000,
            scope: `menu:${slug || "none"}`,
        }
    );

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

    const add = useCallback((item) => {
        updateActiveBill((bill) => ({
            ...bill,
            cart: mergeQty(bill.cart, item, +1),
        }));
    }, [updateActiveBill]);

    const sub = useCallback((item) => {
        updateActiveBill((bill) => ({
            ...bill,
            cart: mergeQty(bill.cart, item, -1),
        }));
    }, [updateActiveBill]);

    const setQty = useCallback((item, nextQty) => {
        updateActiveBill((bill) => {
            const id = Number(item?.id || 0);
            if (!id) return bill;

            const parsed = Number(nextQty);
            const qty = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
            const nextCart = { ...(bill.cart || {}) };
            nextCart[id] = {
                ...(nextCart[id] || {}),
                id,
                menuItemId: Number(item?.menuItemId || id),
                name: String(item?.name || "").trim(),
                price: Number(item?.price || 0),
                qty,
            };
            return { ...bill, cart: nextCart };
        });
    }, [updateActiveBill]);

    const removeItem = useCallback((item) => {
        updateActiveBill((bill) => {
            const id = Number(item?.id || 0);
            if (!id) return bill;
            const nextCart = { ...(bill.cart || {}) };
            delete nextCart[id];
            return { ...bill, cart: nextCart };
        });
    }, [updateActiveBill]);

    const clear = useCallback(() => {
        updateActiveBill({
            cart: {},
            notes: "",
            customerName: "",
            phone: "",
        });
    }, [updateActiveBill]);

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
        if (!searchRef.current) return;
        searchRef.current.focus();
    }, []);

    const handlePrintBill = useCallback(() => {
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

        const printFrame = document.createElement("iframe");
        printFrame.setAttribute("aria-hidden", "true");
        printFrame.style.position = "fixed";
        printFrame.style.right = "0";
        printFrame.style.bottom = "0";
        printFrame.style.width = "0";
        printFrame.style.height = "0";
        printFrame.style.border = "0";
        printFrame.style.opacity = "0";
        printFrame.style.pointerEvents = "none";

        const cleanupPrintFrame = () => {
            try {
                printFrame.remove();
            } catch {
                // ignore
            }
        };

        const printBill = (order) => {
            const markup = buildBillPrintMarkup({
                restaurantName,
                order,
            });

            printFrame.onload = () => {
                setTimeout(() => {
                    try {
                        printFrame.contentWindow?.focus?.();
                        printFrame.contentWindow?.print?.();
                    } catch {
                        // ignore print errors so the order flow can still complete
                    } finally {
                        setTimeout(cleanupPrintFrame, 750);
                    }
                }, 200);
            };

            printFrame.srcdoc = markup;
            document.body.appendChild(printFrame);
        };

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
                        printBill(ack?.order);
                        showToast({
                            title: "Bill ready",
                            message: ack?.order?.invoiceNo || ack?.order?.orderNo || "Receipt opened for printing",
                            variant: "success",
                        });
                        removeCompletedBill(activeBill.id);
                        return;
                    }
                    cleanupPrintFrame();
                    showToast({
                        title: "Bill failed",
                        message: String(ack?.message || "Unable to create bill"),
                        variant: "error",
                    });
                } finally {
                    setPlacing(false);
                }
            }
        );
    }, [activeBill?.id, cartItems, connected, customerName, notes, orderType, phone, placing, removeCompletedBill, restaurantName, socket, tableNo]);

    return (
        <div className="theme-page new-order-paper new-order-no-boxes min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_430px]">
            <div className="lg:min-h-screen lg:flex lg:flex-col">
                <header className="theme-nav border-b border-white/10 bg-black/10">
                    <div className="px-4 py-3 space-y-3">
                        <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:items-center">
                            <div className="min-w-0">
                                <button
                                    type="button"
                                    onClick={() => navigate("/owner")}
                                    className="theme-soft-button inline-flex h-8 w-8 items-center justify-center rounded-full"
                                    aria-label="Go to dashboard"
                                    title="Go to dashboard"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                                <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
                                    <UtensilsCrossed size={18} className="theme-accent-text" />
                                    Billing Desk
                                </h1>
                                <p className="theme-muted mt-1 text-xs sm:text-sm truncate">
                                    {user?.restaurant?.name || "Restaurant"} - {connected ? "Live" : "Offline"}
                                    {socketError ? ` (${socketError})` : ""}
                                </p>
                            </div>

                            <div className="theme-panel new-order-borderless flex w-full items-center gap-2 rounded-3xl border border-white/10 bg-black/10 px-4 py-3 lg:mx-0 lg:max-w-[520px]">
                                <Search size={18} className="theme-muted" />
                                <input
                                    ref={searchRef}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search items, categories..."
                                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:opacity-60 sm:text-base"
                                />
                                {search.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch("");
                                            searchRef.current?.focus?.();
                                        }}
                                        className="theme-soft-button inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                                        aria-label="Clear search"
                                        title="Clear search"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Active Bills / Tabs Section */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-white/10">
                            <button
                                type="button"
                                onClick={createNewBill}
                                className="theme-button flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold shadow-md transition hover:scale-[1.02] active:scale-[0.98]"
                                title="Create a new independent bill"
                            >
                                <Plus size={16} />
                                <span>New Bill</span>
                            </button>

                            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar py-0.5">
                                {bills.map((bill) => {
                                    const isActive = bill.id === activeBillId;
                                    const isHeld = bill.status === "HELD";
                                    const bItems = Object.values(bill.cart || {});
                                    const bItemCount = bItems.reduce((sum, it) => sum + Math.max(1, Number(it.qty || 1)), 0);
                                    const bTotal = bItems.reduce((sum, it) => sum + Number(it.price || 0) * Math.max(1, Number(it.qty || 1)), 0);

                                    return (
                                        <div
                                            key={bill.id}
                                            onClick={() => switchBill(bill.id)}
                                            className={[
                                                "group relative flex shrink-0 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2 text-xs font-semibold transition select-none",
                                                isActive
                                                    ? "is-active border-amber-500/60 bg-amber-500/10 text-white shadow-lg ring-1 ring-amber-500/30"
                                                    : isHeld
                                                      ? "border-amber-400/30 bg-amber-950/20 text-amber-200/90 hover:bg-amber-900/30"
                                                      : "border-white/10 bg-black/20 text-white/80 hover:bg-white/5 hover:text-white",
                                            ].join(" ")}
                                        >
                                            <span
                                                className={[
                                                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase",
                                                    isHeld
                                                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                                        : isActive
                                                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                          : "bg-white/10 text-white/60",
                                                ].join(" ")}
                                            >
                                                {isHeld ? "HELD" : "ACTIVE"}
                                            </span>

                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-sm leading-tight flex items-center gap-1.5">
                                                    {bill.billNumber}
                                                    {bill.customerName && (
                                                        <span className="text-[11px] font-normal opacity-70 truncate max-w-[80px]">
                                                            ({bill.customerName})
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="theme-muted text-[11px] tabular-nums">
                                                    {bItemCount} item{bItemCount === 1 ? "" : "s"} • Rs {toInr(bTotal)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1 ml-1 opacity-80 group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleHoldBill(bill.id);
                                                    }}
                                                    className="theme-soft-button inline-flex h-6 w-6 items-center justify-center rounded-full p-0 text-white/70 hover:text-white hover:bg-white/20"
                                                    title={isHeld ? "Resume bill" : "Hold bill"}
                                                >
                                                    {isHeld ? <Play size={11} className="fill-current" /> : <Pause size={11} />}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (bItemCount > 0) {
                                                            setBillToClose(bill);
                                                        } else {
                                                            deleteBill(bill.id);
                                                        }
                                                    }}
                                                    className="theme-soft-button inline-flex h-6 w-6 items-center justify-center rounded-full p-0 text-white/60 hover:text-red-400 hover:bg-red-500/20"
                                                    title="Close / Cancel bill"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="grid w-full gap-4 px-4 py-3 lg:flex-1 lg:grid-cols-[220px_minmax(0,1fr)] lg:pr-4">
                    <CategorySidebar
                        categories={categories}
                        activeKey={String(activeCategory || "ALL").toUpperCase()}
                        onSelect={setActiveCategory}
                    />

                    <section className="theme-panel new-order-borderless rounded-3xl border border-white/10 bg-black/10 p-4">
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

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                            {menuLoading ? (
                                <div className="theme-muted text-sm">Loading menu...</div>
                            ) : (
                                filteredMenu.map((item) => (
                                    <ItemCard
                                        key={item.id}
                                        item={item}
                                        qty={Number(cart?.[item.id]?.qty || 0)}
                                        onAdd={add}
                                    />
                                ))
                            )}
                        </div>
                    </section>
                </main>
            </div>

            <div className="lg:pl-4">
                <aside className="theme-panel new-order-borderless self-start rounded-3xl border border-white/10 bg-black/10 p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:rounded-none">
                    <div className="flex items-end justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Cart</p>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                                    {activeBill.billNumber}
                                </span>
                            </div>
                            <p className="mt-1 text-lg font-semibold">
                                {totalItems} item{totalItems === 1 ? "" : "s"}
                            </p>
                        </div>
                        <p className="theme-muted text-sm tabular-nums">Rs {toInr(subtotal)}</p>
                    </div>

                    {/* Optional Customer Information */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <input
                            type="text"
                            placeholder="Customer Name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 font-semibold text-white placeholder:text-white/40 outline-none focus:border-amber-500/50"
                        />
                        <input
                            type="text"
                            placeholder="Phone Number"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 font-semibold text-white placeholder:text-white/40 outline-none focus:border-amber-500/50"
                        />
                    </div>

                    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto pr-1 divide-y divide-[#cdb99a]/60">
                        {cartItems.length === 0 ? (
                            <div className="new-order-borderless rounded-2xl border border-white/10 bg-black/10 p-6 text-center">
                                <p className="text-sm font-semibold">No items yet</p>
                                <p className="theme-muted mt-1 text-xs">Tap items to add them to the cart.</p>
                            </div>
                        ) : (
                            cartItems.map((it) => (
                                <CartRow key={it.id} item={it} onAdd={add} onSub={sub} onRemove={removeItem} onSetQty={setQty} />
                            ))
                        )}
                    </div>

                    <div className="mt-4 shrink-0 space-y-3 border-t border-[#cdb99a] pt-4">
                        <div className="new-order-dividerless mt-0 rounded-2xl border border-white/10 bg-black/10 p-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="theme-muted">Items</span>
                                <span className="font-semibold tabular-nums">{totalItems}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-sm">
                                <span className="font-semibold">Total</span>
                                <span className="font-bold tabular-nums">Rs {toInr(subtotal)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => toggleHoldBill(activeBill.id)}
                                className={[
                                    "rounded-2xl px-2 py-3 text-xs font-bold transition flex items-center justify-center gap-1",
                                    isCurrentHeld
                                        ? "bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/40"
                                        : "theme-soft-button",
                                ].join(" ")}
                                disabled={placing}
                                title={isCurrentHeld ? "Resume this bill" : "Put this bill on hold"}
                            >
                                {isCurrentHeld ? <Play size={14} /> : <Pause size={14} />}
                                {isCurrentHeld ? "Resume" : "Hold"}
                            </button>
                            <button
                                type="button"
                                onClick={clear}
                                className="theme-soft-button rounded-2xl px-2 py-3 text-xs font-semibold"
                                disabled={placing}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={handlePrintBill}
                                className="theme-button rounded-2xl px-2 py-3 text-xs font-semibold"
                                disabled={!connected || placing}
                            >
                                {placing ? (
                                    <span className="inline-flex items-center gap-1">
                                        <LoaderCircle size={14} className="animate-spin" />
                                        Printing...
                                    </span>
                                ) : (
                                    "Print Bill"
                                )}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Cancel Bill Confirmation Modal */}
            {billToClose && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                    <div className="theme-panel new-order-borderless w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 text-white shadow-2xl">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Trash2 className="text-red-400" size={20} />
                            Cancel {billToClose.billNumber}?
                        </h3>
                        <p className="theme-muted mt-2 text-sm">
                            This bill contains <strong className="text-white">{Object.values(billToClose.cart || {}).reduce((s, i) => s + Math.max(1, Number(i.qty || 1)), 0)} item(s)</strong> totaling <strong className="text-white">Rs {toInr(Object.values(billToClose.cart || {}).reduce((s, i) => s + Number(i.price || 0) * Math.max(1, Number(i.qty || 1)), 0))}</strong>.
                        </p>
                        <p className="theme-muted mt-1 text-xs">
                            Are you sure you want to cancel this bill? All items in this cart will be deleted.
                        </p>
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setBillToClose(null)}
                                className="theme-soft-button rounded-xl px-4 py-2 text-sm font-semibold"
                            >
                                Keep Bill
                            </button>
                            <button
                                type="button"
                                onClick={() => deleteBill(billToClose.id)}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition"
                            >
                                Cancel Bill
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
