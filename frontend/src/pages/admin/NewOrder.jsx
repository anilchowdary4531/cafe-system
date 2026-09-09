import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    ArrowLeft,
    Banknote,
    CheckCircle2,
    Coffee,
    CreditCard,
    IceCream,
    LoaderCircle,
    Pause,
    Pizza,
    Play,
    Plus,
    Printer,
    QrCode,
    Receipt,
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

    const paymentMethod = order?.paymentMethod ? String(order.paymentMethod).toUpperCase() : "";
    const cashGiven = order?.cashGiven !== undefined && order?.cashGiven !== null ? Number(order.cashGiven) : null;
    const changeReturned = order?.changeReturned !== undefined && order?.changeReturned !== null ? Number(order.changeReturned) : null;

    const metaRows = [
        ["Order No", order?.orderNo || "-"],
        ["Bill No", order?.invoiceNo || order?.orderNo || "-"],
        ["Type", orderType],
        ...(paymentMethod ? [["Payment Mode", paymentMethod]] : []),
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
        ...(paymentMethod === "CASH" && cashGiven !== null ? [["Cash Given", cashGiven]] : []),
        ...(paymentMethod === "CASH" && changeReturned !== null ? [["Change Returned", changeReturned]] : []),
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
        <aside className="theme-panel self-start rounded-3xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_94%,#000_6%)] p-3 lg:sticky lg:top-4">
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
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-text)_6%,transparent)]">
                                <Icon size={16} className="theme-pos-choice-icon" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[color:var(--app-text)]">{cat.label}</span>
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
            className="group relative overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_94%,#000_6%)] p-2.5 sm:p-3 text-left transition active:scale-[0.98] hover:bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_85%,#000_15%)] hover:shadow-md"
        >
            <img
                src={imageSrc}
                alt={item.name}
                loading="lazy"
                className="mb-2 h-20 sm:h-22 w-full rounded-xl object-cover transition duration-300 group-hover:scale-[1.02]"
                onError={(event) => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                }}
            />
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-xs sm:text-sm font-bold text-[color:var(--app-text)]">{item.name}</p>
                    <p className="theme-muted mt-0.5 truncate text-[11px] font-semibold">
                        {item.category || "General"} - Rs {toInr(item.price)}
                    </p>
                </div>
                {qty > 0 && (
                    <span className="theme-pos-qty-badge inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-xl px-1.5 text-xs font-extrabold tabular-nums">
                        {qty}
                    </span>
                )}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
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
        <div className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_60%,transparent)] px-3.5 py-3">
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-[color:var(--app-text)] leading-tight">{item?.name || "Item"}</p>
                    <p className="theme-muted mt-0.5 text-[11px] font-semibold">
                        Rs {toInr(item?.price)} - Qty {qty}
                    </p>
                </div>
                <div className="inline-flex items-center gap-1.5 justify-self-center rounded-xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_80%,transparent)] p-0.5">
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
                    <p className="whitespace-nowrap text-[15px] font-bold text-[color:var(--app-text)] tabular-nums leading-none">Rs {toInr(Number(item?.price || 0) * qty)}</p>
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
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [cashGiven, setCashGiven] = useState("");
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

    const triggerPrintReceipt = useCallback((order) => {
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
    }, [restaurantName]);

    const handleOpenCheckoutModal = useCallback(() => {
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

        setCashGiven(String(subtotal));
        setShowCheckoutModal(true);
    }, [cartItems.length, connected, orderType, placing, socket, subtotal, tableNo]);

    const handleCompleteOrder = useCallback(({ printReceipt = true } = {}) => {
        if (!socket || !connected) {
            showToast({ title: "Offline", message: "Socket not connected", variant: "error" });
            return;
        }
        if (placing) return;
        if (cartItems.length === 0) {
            showToast({ title: "Cart empty", message: "Add at least one item", variant: "error" });
            return;
        }

        const cashGivenNum = paymentMethod === "CASH" ? (parseFloat(cashGiven) || 0) : subtotal;
        const changeReturnedNum = paymentMethod === "CASH" ? Math.max(0, cashGivenNum - subtotal) : 0;

        if (paymentMethod === "CASH" && cashGivenNum < subtotal) {
            showToast({
                title: "Insufficient Cash",
                message: `Customer gave Rs ${toInr(cashGivenNum)}, but total is Rs ${toInr(subtotal)}`,
                variant: "error",
            });
            return;
        }

        const paymentNotes = paymentMethod === "CASH"
            ? `Paid via CASH. Cash Given: Rs ${toInr(cashGivenNum)}, Change Returned: Rs ${toInr(changeReturnedNum)}.`
            : `Paid via ONLINE / UPI.`;

        const finalNotes = [notes ? String(notes).trim() : null, paymentNotes].filter(Boolean).join(" | ");

        setPlacing(true);
        socket.emit(
            "order:create",
            {
                orderType: String(orderType || "TAKEAWAY").toUpperCase(),
                tableNo: String(orderType || "").toUpperCase() === "DINE_IN" ? tableNo : null,
                notes: finalNotes,
                customerName: customerName ? String(customerName).trim() : null,
                phone: phone ? String(phone).trim() : null,
                items: cartItems.map((it) => ({ menuItemId: it.menuItemId, qty: it.qty })),
                paymentMethod,
                cashGiven: cashGivenNum,
                changeReturned: changeReturnedNum,
            },
            (ack) => {
                try {
                    if (ack?.ok) {
                        const createdOrder = {
                            ...ack.order,
                            paymentMethod,
                            cashGiven: cashGivenNum,
                            changeReturned: changeReturnedNum,
                        };

                        if (printReceipt) {
                            triggerPrintReceipt(createdOrder);
                        }

                        showToast({
                            title: "Order Completed",
                            message: `${ack?.order?.invoiceNo || ack?.order?.orderNo || "Bill"} processed successfully (${paymentMethod})`,
                            variant: "success",
                        });

                        setShowCheckoutModal(false);
                        setCashGiven("");
                        removeCompletedBill(activeBill.id);
                        return;
                    }

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
    }, [socket, connected, placing, cartItems, paymentMethod, cashGiven, subtotal, notes, orderType, tableNo, customerName, phone, activeBill.id, triggerPrintReceipt, removeCompletedBill]);

    return (
        <div className="theme-page min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_430px]">
            <div className="lg:min-h-screen lg:flex lg:flex-col">
                <header className="theme-nav border-b border-[color:var(--app-border)]">
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
                                <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[color:var(--app-text)]">
                                    <UtensilsCrossed size={18} className="theme-accent-text" />
                                    Billing Desk
                                </h1>
                                <p className="theme-muted mt-1 text-xs sm:text-sm truncate">
                                    {user?.restaurant?.name || "Restaurant"} - {connected ? "Live" : "Offline"}
                                    {socketError ? ` (${socketError})` : ""}
                                </p>
                            </div>

                            <div className="theme-panel flex w-full items-center gap-2 rounded-3xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_94%,#000_6%)] px-4 py-3 lg:mx-0 lg:max-w-[520px]">
                                <Search size={18} className="theme-muted" />
                                <input
                                    ref={searchRef}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search items, categories..."
                                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-muted)] sm:text-base"
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
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-[color:var(--app-border)]">
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
                                                    ? "is-active border-amber-500/60 bg-amber-500/15 text-[color:var(--app-text)] shadow-lg ring-1 ring-amber-500/30 font-bold"
                                                    : isHeld
                                                      ? "border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                                                      : "border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_60%,transparent)] text-[color:var(--app-text)] hover:bg-[color:color-mix(in_srgb,var(--app-text)_6%,transparent)]",
                                            ].join(" ")}
                                        >
                                            <span
                                                className={[
                                                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase border",
                                                    isHeld
                                                        ? "bg-amber-500/20 text-amber-500 border-amber-500/30"
                                                        : isActive
                                                          ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                                                          : "bg-[color:color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[color:var(--app-muted)] border-[color:var(--app-border)]",
                                                ].join(" ")}
                                            >
                                                {isHeld ? "HELD" : "ACTIVE"}
                                            </span>

                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-sm leading-tight flex items-center gap-1.5 text-[color:var(--app-text)]">
                                                    {bill.billNumber}
                                                    {bill.customerName && (
                                                        <span className="text-[11px] font-normal theme-muted truncate max-w-[80px]">
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
                                                    className="theme-soft-button inline-flex h-6 w-6 items-center justify-center rounded-full p-0 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]"
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
                                                    className="theme-soft-button inline-flex h-6 w-6 items-center justify-center rounded-full p-0 text-[color:var(--app-muted)] hover:text-red-500 hover:bg-red-500/20"
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

                    <section className="theme-panel rounded-3xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_94%,#000_6%)] p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Items</p>
                                <p className="mt-1 text-lg font-bold text-[color:var(--app-text)]">Tap to add</p>
                            </div>
                            <p className="theme-muted text-xs font-semibold">
                                {filteredMenu.length} shown | {menu.length} total
                            </p>
                        </div>

                        {menuError && (
                            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                                {menuError}
                            </div>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-3">
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
                <aside className="theme-panel self-start rounded-3xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_94%,#000_6%)] p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:rounded-none">
                    <div className="flex items-end justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Cart</p>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500">
                                    {activeBill.billNumber}
                                </span>
                            </div>
                            <p className="mt-1 text-lg font-bold text-[color:var(--app-text)]">
                                {totalItems} item{totalItems === 1 ? "" : "s"}
                            </p>
                        </div>
                        <p className="theme-muted text-sm font-semibold tabular-nums">Rs {toInr(subtotal)}</p>
                    </div>

                    {/* Optional Customer Information */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <input
                            type="text"
                            placeholder="Customer Name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="rounded-xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_80%,transparent)] px-3 py-1.5 font-semibold text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none focus:border-amber-500/50"
                        />
                        <input
                            type="text"
                            placeholder="Phone Number"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="rounded-xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_80%,transparent)] px-3 py-1.5 font-semibold text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none focus:border-amber-500/50"
                        />
                    </div>

                    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto pr-1 divide-y divide-[color:var(--app-border)]">
                        {cartItems.length === 0 ? (
                            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_50%,transparent)] p-6 text-center text-[color:var(--app-text)]">
                                <p className="text-sm font-bold text-[color:var(--app-text)]">No items yet</p>
                                <p className="theme-muted mt-1 text-xs">Tap items to add them to the cart.</p>
                            </div>
                        ) : (
                            cartItems.map((it) => (
                                <CartRow key={it.id} item={it} onAdd={add} onSub={sub} onRemove={removeItem} onSetQty={setQty} />
                            ))
                        )}
                    </div>

                    <div className="mt-4 shrink-0 space-y-3 border-t border-[color:var(--app-border)] pt-4">
                        <div className="new-order-dividerless mt-0 rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_60%,transparent)] p-3 text-[color:var(--app-text)]">
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
                                        ? "bg-emerald-600/30 border border-emerald-500/40 text-emerald-500 hover:bg-emerald-600/40"
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
                                onClick={handleOpenCheckoutModal}
                                className="theme-button rounded-2xl px-2 py-3 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow-md transition active:scale-[0.98]"
                                disabled={!connected || placing || cartItems.length === 0}
                                title="Complete Order & Checkout"
                            >
                                <CheckCircle2 size={16} />
                                Done
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Cancel Bill Confirmation Modal */}
            {billToClose && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                    <div className="theme-panel w-full max-w-md rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface,var(--app-bg))] p-6 text-[color:var(--app-text)] shadow-2xl">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-[color:var(--app-text)]">
                            <Trash2 className="text-red-500" size={20} />
                            Cancel {billToClose.billNumber}?
                        </h3>
                        <p className="theme-muted mt-2 text-sm">
                            This bill contains <strong className="text-[color:var(--app-text)]">{Object.values(billToClose.cart || {}).reduce((s, i) => s + Math.max(1, Number(i.qty || 1)), 0)} item(s)</strong> totaling <strong className="text-[color:var(--app-text)]">Rs {toInr(Object.values(billToClose.cart || {}).reduce((s, i) => s + Number(i.price || 0) * Math.max(1, Number(i.qty || 1)), 0))}</strong>.
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

            {/* PETPOOJA STYLE PAYMENT & CUSTOMER CHANGE CALCULATOR MODAL */}
            {showCheckoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
                    <div className="theme-panel w-full max-w-lg rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface,var(--app-bg))] p-6 text-[color:var(--app-text)] shadow-2xl space-y-5 max-h-[92vh] flex flex-col justify-between">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-[color:var(--app-border)]">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-600 border border-orange-500/20">
                                    <Receipt size={22} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[color:var(--app-text)] tracking-tight">
                                        Checkout & Payment
                                    </h3>
                                    <p className="theme-muted text-xs font-bold mt-0.5">
                                        {activeBill.billNumber} • {orderType === "DINE_IN" ? `Table ${tableNo}` : "Takeaway"}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCheckoutModal(false)}
                                className="theme-soft-button inline-flex h-8 w-8 items-center justify-center rounded-full"
                                aria-label="Close checkout modal"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-4 overflow-y-auto pr-1">
                            {/* Total Bill Section - High Contrast Hero Banner */}
                            <div className="rounded-2xl bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-4.5 shadow-md flex items-center justify-between border border-amber-500/30">
                                <div>
                                    <span className="text-amber-400 text-xs uppercase font-black tracking-widest block">
                                        Total Payable Amount
                                    </span>
                                    <p className="text-stone-300 text-xs font-medium mt-0.5">
                                        {totalItems} item{totalItems === 1 ? "" : "s"} in cart
                                    </p>
                                </div>
                                <span className="text-3xl sm:text-4xl font-black text-amber-300 tabular-nums">
                                    Rs {toInr(subtotal)}
                                </span>
                            </div>

                            {/* Customer Details Summary - High Visibility Input Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border-2 border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_80%,transparent)] p-2.5 focus-within:border-orange-500 transition shadow-xs">
                                    <label className="text-stone-800 dark:text-stone-200 block font-extrabold uppercase text-[10px] tracking-wider mb-1">
                                        Customer Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Walk-in Customer"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        className="w-full bg-transparent text-sm font-bold text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none"
                                    />
                                </div>
                                <div className="rounded-2xl border-2 border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_80%,transparent)] p-2.5 focus-within:border-orange-500 transition shadow-xs">
                                    <label className="text-stone-800 dark:text-stone-200 block font-extrabold uppercase text-[10px] tracking-wider mb-1">
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full bg-transparent text-sm font-bold text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none"
                                    />
                                </div>
                            </div>

                            {/* Payment Mode Selection - Vibrant High Contrast Pills */}
                            <div>
                                <label className="text-stone-900 dark:text-stone-100 block text-xs font-black uppercase tracking-wider mb-2">
                                    Select Payment Mode
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPaymentMethod("CASH");
                                            if (!cashGiven) setCashGiven(String(subtotal));
                                        }}
                                        className={[
                                            "flex items-center justify-center gap-2.5 rounded-2xl p-3.5 text-sm font-black transition border-2 shadow-sm",
                                            paymentMethod === "CASH"
                                                ? "bg-orange-500 text-white border-orange-600 shadow-orange-500/20 scale-[1.02]"
                                                : "bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_60%,transparent)] text-stone-700 dark:text-stone-300 border-[color:var(--app-border)] hover:border-orange-300",
                                        ].join(" ")}
                                    >
                                        <Banknote size={20} />
                                        <span>CASH</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod("ONLINE")}
                                        className={[
                                            "flex items-center justify-center gap-2.5 rounded-2xl p-3.5 text-sm font-black transition border-2 shadow-sm",
                                            paymentMethod === "ONLINE"
                                                ? "bg-orange-500 text-white border-orange-600 shadow-orange-500/20 scale-[1.02]"
                                                : "bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_60%,transparent)] text-stone-700 dark:text-stone-300 border-[color:var(--app-border)] hover:border-orange-300",
                                        ].join(" ")}
                                    >
                                        <CreditCard size={20} />
                                        <span>ONLINE / UPI</span>
                                    </button>
                                </div>
                            </div>

                            {/* CASH TENDER & CHANGE RETURN CALCULATOR */}
                            {paymentMethod === "CASH" && (
                                <div className="space-y-3 pt-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-stone-900 dark:text-stone-100 text-xs font-black uppercase tracking-wider">
                                            Cash Received from Customer
                                        </label>
                                        <span className="theme-muted text-xs font-bold">Tap preset or enter amount</span>
                                    </div>

                                    {/* High Contrast Input Box */}
                                    <div className="rounded-2xl border-2 border-orange-500 bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_90%,transparent)] px-4 py-2.5 shadow-md flex items-center justify-between focus-within:ring-2 focus-within:ring-orange-500/20">
                                        <span className="text-xl font-black text-orange-600 dark:text-orange-400">Rs</span>
                                        <input
                                            type="number"
                                            step="any"
                                            inputMode="decimal"
                                            placeholder={toInr(subtotal)}
                                            value={cashGiven}
                                            onChange={(e) => setCashGiven(e.target.value)}
                                            className="w-full bg-transparent text-right text-3xl font-black text-stone-900 dark:text-white outline-none tabular-nums"
                                        />
                                    </div>

                                    {/* Quick Cash Presets as High Contrast Chips */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setCashGiven(String(subtotal))}
                                            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-extrabold shadow-sm transition"
                                        >
                                            Exact (Rs {toInr(subtotal)})
                                        </button>
                                        {[100, 200, 500, 2000].map((amt) => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setCashGiven(String(amt))}
                                                className="rounded-xl border-2 border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_70%,transparent)] text-stone-900 dark:text-stone-100 hover:border-orange-500 hover:text-orange-600 px-3.5 py-2 text-xs font-extrabold shadow-xs transition"
                                            >
                                                Rs {amt}
                                            </button>
                                        ))}
                                        {Math.ceil(subtotal / 50) * 50 > subtotal && Math.ceil(subtotal / 50) * 50 !== 100 && Math.ceil(subtotal / 50) * 50 !== 200 && Math.ceil(subtotal / 50) * 50 !== 500 && Math.ceil(subtotal / 50) * 50 !== 2000 && (
                                            <button
                                                type="button"
                                                onClick={() => setCashGiven(String(Math.ceil(subtotal / 50) * 50))}
                                                className="rounded-xl border-2 border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_70%,transparent)] text-stone-900 dark:text-stone-100 hover:border-orange-500 hover:text-orange-600 px-3.5 py-2 text-xs font-extrabold shadow-xs transition"
                                            >
                                                Rs {Math.ceil(subtotal / 50) * 50}
                                            </button>
                                        )}
                                    </div>

                                    {/* LIVE RETURN CHANGE CALCULATOR DISPLAY - Striking Card Banner */}
                                    {(() => {
                                        const given = parseFloat(cashGiven) || 0;
                                        const change = given - subtotal;
                                        const isEnough = given >= subtotal;

                                        if (!cashGiven) return null;

                                        return isEnough ? (
                                            <div className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-500/15 p-4 flex items-center justify-between shadow-sm">
                                                <div>
                                                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                                                        Return Change to Customer
                                                    </span>
                                                    <span className="text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-300/80">
                                                        Cash tendered: Rs {toInr(given)}
                                                    </span>
                                                </div>
                                                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                    Rs {toInr(change)}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/15 p-4 flex items-center justify-between shadow-sm">
                                                <div>
                                                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                                                        Balance Shortage
                                                    </span>
                                                    <span className="text-[11px] font-semibold text-amber-800/80 dark:text-amber-300/80">
                                                        Total is Rs {toInr(subtotal)}
                                                    </span>
                                                </div>
                                                <span className="text-xl font-black text-amber-700 dark:text-amber-400 tabular-nums">
                                                    Rs {toInr(Math.abs(change))} remaining
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* ONLINE PAYMENT DISPLAY */}
                            {paymentMethod === "ONLINE" && (
                                <div className="rounded-2xl border-2 border-indigo-500/30 bg-indigo-500/10 p-5 text-center space-y-2">
                                    <QrCode size={36} className="mx-auto text-indigo-500 dark:text-indigo-400" />
                                    <p className="text-sm font-black text-stone-900 dark:text-stone-100">
                                        Accept UPI QR / Card POS Payment
                                    </p>
                                    <p className="theme-muted text-xs font-medium">
                                        Verify payment confirmation on your UPI QR or POS machine before completing order.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Actions - Bold High Contrast Buttons */}
                        <div className="pt-4 border-t border-[color:var(--app-border)] grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => handleCompleteOrder({ printReceipt: false })}
                                className="rounded-2xl py-3.5 px-4 text-xs sm:text-sm font-extrabold border-2 border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2,var(--app-bg))_80%,transparent)] text-stone-800 dark:text-stone-100 hover:bg-[color:color-mix(in_srgb,var(--app-text)_8%,transparent)] transition flex items-center justify-center gap-2 shadow-xs"
                                disabled={placing || (paymentMethod === "CASH" && (parseFloat(cashGiven) || 0) < subtotal)}
                            >
                                <CheckCircle2 size={16} />
                                Complete Only
                            </button>

                            <button
                                type="button"
                                onClick={() => handleCompleteOrder({ printReceipt: true })}
                                className="rounded-2xl py-3.5 px-4 text-xs sm:text-sm font-extrabold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition active:scale-[0.98]"
                                disabled={placing || (paymentMethod === "CASH" && (parseFloat(cashGiven) || 0) < subtotal)}
                            >
                                {placing ? (
                                    <span className="inline-flex items-center gap-1">
                                        <LoaderCircle size={16} className="animate-spin" />
                                        Processing...
                                    </span>
                                ) : (
                                    <>
                                        <Printer size={16} />
                                        Complete & Print
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
