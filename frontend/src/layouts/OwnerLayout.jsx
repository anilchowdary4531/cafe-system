import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    ShoppingBag,
    ClipboardPlus,
    UtensilsCrossed,
    TableProperties,
    ChefHat,
    BarChart3,
    Globe2,
    Users,
    User,
    LogOut,
    Bell,
    Wallet,
    Menu,
    X,
    MoreHorizontal,
    Printer,
    FileText,
    IndianRupee,
    Truck,
    Package,
    PackageCheck,
    Activity,
    SlidersHorizontal,
    AlertTriangle,
    Tag,
    Award,
    ZoomIn,
    ZoomOut,
    Eye,
    EyeOff,
    Calendar,
    Clock,
    CheckSquare,
    Edit2,
    Link2,
    Move,
    Unlock,
    Undo2,
    Trash2,
    Receipt,
    CreditCard,
    Warehouse,
    ArrowLeftRight,
    ClipboardCheck,
    Handshake,
    Boxes,
    ShoppingCart,
    ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { resolveRestaurantName, resolveAuthoritativeRestaurantId } from "../utils/restaurantContext";
import BrandLogo from "../components/BrandLogo";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { resolveEffectiveStaffRole } from "../utils/staffRole";
import { showToast } from "../utils/toast";
import tiffzyLogo from "../assets/tiffzy-logo.png";
import NewOrderPopup from "../components/NewOrderPopup";
import {
    getOwnerUnreadCount,
    subscribeOwnerNotifications,
} from "../utils/ownerNotifications";
import { API } from "../config";
import { api } from "../utils/apiClient";
import { useStaffSocket } from "../context/StaffSocketContext";
import { playNotificationSound } from "../utils/soundPlayer";
import {
    getStoredTableGroups,
    getStoredGroupCatalog,
    writeStoredTableGroups,
    resolveTableGroup,
    TABLE_GROUPS_SYNC_EVENT,
    toTitleCase,
} from "../utils/tableGrouping";

const MODULES = [
    "dashboard",
    "billing",
    "orders",
    "menu",
    "inventory",
    "recipes",
    "tables",
    "kitchen",
    "printers",
    "analytics",
    "reports",
    "paylater",
    "shifts",
    "supply",
    "delivery",
    "delivery_partners",
    "customers",
    "discounts",
    "loyalty",
    "staff",
    "settings",
    "notifications",
    "audit",
];

const defaultAccessByRole = (role) => {
    const r = String(role || "OWNER").toUpperCase();

    if (r === "OWNER") {
        return MODULES.reduce((acc, key) => ({ ...acc, [key]: true }), {});
    }

    return {
        dashboard: true,
        billing: true,
        orders: true,
        menu: true,
        inventory: true,
        recipes: true,
        tables: true,
        kitchen: true,
        printers: true,
        analytics: true,
        reports: true,
        paylater: false,
        shifts: false,
        supply: true,
        delivery: true,
        delivery_partners: true,
        customers: true,
        discounts: true,
        loyalty: true,
        staff: false,
        settings: false,
        notifications: true,
    };
};

const hasModuleAccess = (access, accessKey, fallbackKey) => {
    if (!access) return false;
    if (access[accessKey] !== undefined) return Boolean(access[accessKey]);
    if (fallbackKey && access[fallbackKey] !== undefined) return Boolean(access[fallbackKey]);
    return false;
};

const normalizeAccess = (rawAccess, role) => {
    const fallback = defaultAccessByRole(role);

    if (!rawAccess || typeof rawAccess !== "object") return fallback;

    return MODULES.reduce((acc, key) => {
        acc[key] =
            rawAccess[key] === undefined ? fallback[key] : Boolean(rawAccess[key]);
        return acc;
    }, {});
};

const TABLE_STAFF_ASSIGNMENTS_PREFIX = "owner_table_staff_assignments_v1";
const STAFF_ROLE_LABELS = {
    OWNER: "Owner",
    MANAGER: "Manager",
    CHEF: "Chef",
    WAITER: "Server",
    CASHIER: "Cashier",
    STAFF: "Staff",
};
const STAFF_ROLE_SYMBOLS = {
    OWNER: "OW",
    MANAGER: "MG",
    CHEF: "CH",
    WAITER: "SV",
    CASHIER: "CA",
    STAFF: "ST",
};

const getTableStaffStorageKey = (restaurantId) =>
    `${TABLE_STAFF_ASSIGNMENTS_PREFIX}_${restaurantId}`;

const getStaffDesignation = (staffUser) => {
    const explicitDesignation = String(staffUser?.designation || "").trim();
    if (explicitDesignation) return explicitDesignation;
    const role = String(staffUser?.role || "").toUpperCase();
    if (STAFF_ROLE_LABELS[role]) return STAFF_ROLE_LABELS[role];
    return "Staff";
};

const getStaffName = (staffUser) => {
    const rawName = String(staffUser?.name || "").trim();
    return rawName || "Staff";
};

const getStaffDisplayLabel = (staffUser) => {
    const staffName = getStaffName(staffUser);
    const designation = getStaffDesignation(staffUser);
    return `${staffName} - ${designation}`;
};

const getStaffSymbol = (staffUser, displayLabel = "") => {
    const role = String(staffUser?.role || "").toUpperCase();
    if (STAFF_ROLE_SYMBOLS[role]) return STAFF_ROLE_SYMBOLS[role];

    const source = String(displayLabel || getStaffName(staffUser)).trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (!parts.length) return "ST";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
};

const formatOccupiedDuration = (occupiedSince) => {
    if (!occupiedSince) return "";
    const startTime = new Date(occupiedSince).getTime();
    if (Number.isNaN(startTime)) return "";

    const mins = Math.max(0, Math.floor((Date.now() - startTime) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;

    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours < 24) return remMins ? `${hours}h ${remMins}m` : `${hours}h`;

    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours ? `${days}d ${remHours}h` : `${days}d`;
};

const formatOrderTime = (value) => {
    if (!value) return "";
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return "";
    return new Date(time).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
    });
};

const formatReceiptAmount = (value) => `\u20B9${Number(value || 0).toFixed(2)}`;

const getReceiptItemLineTotal = (item) => {
    const directTotal = Number(item?.total || 0);
    if (directTotal > 0) return directTotal;
    return Number(item?.qty || 0) * Number(item?.price || 0);
};

const getReceiptOrderTotal = (order) => {
    const directTotal = Number(order?.total || 0);
    if (directTotal > 0) return directTotal;
    if (!Array.isArray(order?.items)) return 0;
    return order.items.reduce(
        (sum, item) => sum + getReceiptItemLineTotal(item),
        0
    );
};

const normalizeOrderStatus = (value) => String(value || "PLACED").toUpperCase();

const formatOrderStatusLabel = (value) => normalizeOrderStatus(value).replace(/_/g, " ");

const getOrderStatusTone = (value) => {
    const status = normalizeOrderStatus(value);
    if (status === "READY" || status === "DELIVERED") {
        return "border-emerald-200/70 bg-emerald-100/60 text-emerald-900";
    }
    if (status === "PREPARING" || status === "ACCEPTED") {
        return "border-amber-200/70 bg-amber-100/60 text-amber-900";
    }
    if (status === "CANCELLED") {
        return "border-rose-200/70 bg-rose-100/60 text-rose-900";
    }
    return "border-sky-200/70 bg-sky-100/60 text-sky-900";
};

const escapeReceiptText = (value) =>
    String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

const buildReceiptPrintMarkup = ({
    tableLabel,
    activeOrders,
    tableReceiptTotal,
    logoUrl,
} = {}) => {
    const rows = (Array.isArray(activeOrders) ? activeOrders : [])
        .map((order) => {
            const orderLabel = order?.orderNo ? order.orderNo : `#${order?.id || ""}`;
            const status = String(order?.status || "").toUpperCase();
            const orderTotal = getReceiptOrderTotal(order);
            const itemsMarkup = (Array.isArray(order?.items) ? order.items : [])
                .map((item) => {
                    const lineTotal = getReceiptItemLineTotal(item);
                    return `
                        <tr>
                            <td>${Number(item?.qty || 0)} x ${escapeReceiptText(item?.itemName || "Item")}</td>
                            <td style="text-align:right;">${formatReceiptAmount(lineTotal)}</td>
                        </tr>
                    `;
                })
                .join("");

            let snapshot = order?.billingSnapshot;
            if (typeof snapshot === "string") {
                try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
            }

            const taxesList = Array.isArray(snapshot?.taxes) ? snapshot.taxes : [];
            const chargesList = Array.isArray(snapshot?.charges) ? snapshot.charges : [];

            let breakdownMarkup = "";
            if (taxesList.length > 0) {
                breakdownMarkup += taxesList.map((t) => `
                    <tr>
                        <td style="color:#666; font-size:11px;">${escapeReceiptText(t.name || "Tax")}${t.rate ? ` (${t.rate}%)` : ""}</td>
                        <td style="text-align:right; font-size:11px;">${formatReceiptAmount(t.amount || 0)}</td>
                    </tr>
                `).join("");
            } else if (order?.taxAmount > 0) {
                breakdownMarkup += `
                    <tr>
                        <td style="color:#666; font-size:11px;">Tax</td>
                        <td style="text-align:right; font-size:11px;">${formatReceiptAmount(order.taxAmount)}</td>
                    </tr>
                `;
            }

            if (chargesList.length > 0) {
                breakdownMarkup += chargesList.map((c) => `
                    <tr>
                        <td style="color:#666; font-size:11px;">${escapeReceiptText(c.name || "Charge")}</td>
                        <td style="text-align:right; font-size:11px;">${formatReceiptAmount(c.amount || 0)}</td>
                    </tr>
                `).join("");
            } else if (order?.serviceChargeAmount > 0) {
                breakdownMarkup += `
                    <tr>
                        <td style="color:#666; font-size:11px;">Service Charge</td>
                        <td style="text-align:right; font-size:11px;">${formatReceiptAmount(order.serviceChargeAmount)}</td>
                    </tr>
                `;
            }

            if (Number(order?.discountAmount || snapshot?.discount || 0) > 0) {
                breakdownMarkup += `
                    <tr>
                        <td style="color:#10b981; font-size:11px;">Discount</td>
                        <td style="text-align:right; color:#10b981; font-size:11px;">-${formatReceiptAmount(order?.discountAmount || snapshot?.discount)}</td>
                    </tr>
                `;
            }

            return `
                <div class="order-block">
                    <div class="order-head">
                        <span>${escapeReceiptText(orderLabel)}</span>
                        <span>${escapeReceiptText(status)}</span>
                    </div>
                    <table>
                        <tbody>${itemsMarkup || `<tr><td colspan="2">No items found.</td></tr>`}</tbody>
                        ${breakdownMarkup ? `<tfoot>${breakdownMarkup}</tfoot>` : ""}
                    </table>
                    <div class="order-total">
                        <span>Order Total</span>
                        <strong>${formatReceiptAmount(orderTotal)}</strong>
                    </div>
                </div>
            `;
        })
        .join("");

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tiffzy Receipt - Table ${escapeReceiptText(tableLabel || "--")}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 12px; color: #1a1a1a; }
    .receipt { width: 320px; margin: 0 auto; border: 1px dashed #999; padding: 12px; }
    .brand { display: flex; align-items: center; gap: 8px; border-bottom: 1px dashed #bbb; padding-bottom: 8px; margin-bottom: 8px; }
    .brand img { width: 24px; height: 24px; object-fit: contain; }
    .brand h1 { margin: 0; font-size: 18px; line-height: 1; }
    .meta { font-size: 11px; color: #444; margin-bottom: 8px; display: flex; justify-content: space-between; gap: 8px; }
    .order-block { border: 1px solid #ddd; border-radius: 6px; padding: 6px; margin-bottom: 6px; }
    .order-head { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 700; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 2px 0; vertical-align: top; }
    .order-total { margin-top: 4px; display: flex; justify-content: space-between; font-size: 12px; }
    .grand-total { margin-top: 8px; border-top: 1px dashed #bbb; padding-top: 6px; display: flex; justify-content: space-between; font-size: 14px; }
    .thanks { margin-top: 10px; text-align: center; font-size: 11px; color: #666; }
    @media print {
      body { padding: 0; }
      .receipt { border: none; width: 100%; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="brand">
      <img src="${escapeReceiptText(logoUrl || "")}" alt="Tiffzy logo" />
      <div>
        <h1>Tiffzy</h1>
      </div>
    </div>
    <div class="meta">
      <span>Table: ${escapeReceiptText(tableLabel || "--")}</span>
      <span>${escapeReceiptText(new Date().toLocaleString())}</span>
    </div>
    ${rows || `<div class="order-block">No active orders for this table.</div>`}
    <div class="grand-total">
      <span>Total Amount</span>
      <strong>${formatReceiptAmount(tableReceiptTotal || 0)}</strong>
    </div>
    <p class="thanks">Thank you for using Tiffzy</p>
  </div>
</body>
</html>
`;
};

const normalizeTableRows = (rows) =>
    (Array.isArray(rows) ? rows : [])
        .map((table, index) => {
            const rawActiveOrders = Array.isArray(table?.activeOrders)
                ? table.activeOrders.map((order) => ({
                      id: order?.id,
                      orderNo: order?.orderNo || "",
                      status: String(order?.status || "").toUpperCase(),
                      paymentStatus: String(order?.paymentStatus || order?.payment_status || "PENDING").toUpperCase(),
                      createdAt: order?.createdAt || null,
                      total: Number(order?.total || 0),
                      items: Array.isArray(order?.items)
                          ? order.items.map((item) => ({
                                id: item?.id,
                                itemName: String(item?.itemName || "").trim(),
                                qty: Number(item?.qty || 0),
                                price: Number(item?.price || 0),
                                total: Number(item?.total || 0),
                                status: String(item?.status || order?.status || "").toUpperCase(),
                            }))
                          : [],
                  }))
                : [];

            const hasActiveOrders = rawActiveOrders.length > 0;
            const hasActiveSession = Boolean(
                table?.activeSession &&
                table?.activeSession?.status !== "CLOSED" &&
                table?.activeSession?.status !== "CANCELLED"
            );
            const isExplicitlyFree = table?.isOccupied === false || table?.status === "AVAILABLE" || table?.activeSession?.status === "CLOSED" || table?.activeSession?.status === "CANCELLED";
            const isOccupied = !isExplicitlyFree && Boolean(table?.isOccupied || hasActiveOrders || hasActiveSession);
            const activeOrders = isOccupied ? rawActiveOrders : [];

            return {
                ...table,
                tableNo: String(table?.tableNo || "").trim(),
                status: isExplicitlyFree ? "AVAILABLE" : (table?.status || (isOccupied ? "OCCUPIED" : "AVAILABLE")),
                assignedWaiterId: table?.assignedWaiterId || (isOccupied ? table?.activeSession?.waiterId : null) || null,
                assignedWaiterName: table?.assignedWaiterName || (isOccupied ? table?.activeSession?.waiterName : null) || null,
                assignedServer: table?.assignedServer || table?.assignedWaiterName || (isOccupied ? table?.activeSession?.waiterName : null) || null,
                isOccupied,
                isReserved: Boolean(table?.isReserved || table?.is_reserved || table?.activeReservation || table?.upcomingReservation),
                activeReservation: table?.activeReservation || null,
                upcomingReservation: table?.upcomingReservation || null,
                occupiedSince: isOccupied ? (table?.occupiedSince || table?.activeSession?.createdAt || null) : null,
                activeOrderCount: isOccupied ? Number(table?.activeOrderCount || activeOrders.length) : 0,
                activeItemCount: isOccupied ? Number(table?.activeItemCount || 0) : 0,
                activeOrderStatus: isOccupied ? (table?.activeOrderStatus || null) : null,
                paymentStatus: isOccupied ? (table?.paymentStatus || null) : null,
                lastOrderStatus: isOccupied ? String(table?.lastOrderStatus || "").toUpperCase() : null,
                lastPaymentStatus: isOccupied ? String(table?.lastPaymentStatus || "").toUpperCase() : null,
                lastOrderNo: isOccupied ? (table?.lastOrderNo || "") : "",
                lastOrderAt: isOccupied ? (table?.lastOrderAt || null) : null,
                activeOrders,
                assignmentKey: table?.id
                    ? `table-id-${table.id}`
                    : `table-no-${String(table?.tableNo || "").trim().toLowerCase() || index}`,
                key: table?.id ? `table-id-${table.id}` : `${table?.tableNo || "table"}-${index}`,
            };
        })
        .sort((a, b) =>
            String(a.tableNo || "").localeCompare(String(b.tableNo || ""), undefined, {
                numeric: true,
                sensitivity: "base",
            })
        );

const TABLE_STATE_KEYS = {
    BLANK: "BLANK_TABLE",
    RESERVED: "RESERVED_TABLE",
    RUNNING: "RUNNING_TABLE",
    PRINTED: "PRINTED_TABLE",
    PAID: "PAID_TABLE",
    RUNNING_KOT: "RUNNING_KOT_TABLE",
    DELIVERED: "DELIVERED_TABLE",
    FAILED: "FAILED_TABLE",
    CANCELLED: "CANCELLED_TABLE",
};

const TABLE_STATE_LABELS = {
    [TABLE_STATE_KEYS.BLANK]: "Blank Table",
    [TABLE_STATE_KEYS.RESERVED]: "Reserved Table",
    [TABLE_STATE_KEYS.RUNNING]: "Running Table",
    [TABLE_STATE_KEYS.PRINTED]: "Printed Table",
    [TABLE_STATE_KEYS.PAID]: "Paid Table",
    [TABLE_STATE_KEYS.RUNNING_KOT]: "Running KOT Table",
    [TABLE_STATE_KEYS.DELIVERED]: "Payment Pending",
    [TABLE_STATE_KEYS.FAILED]: "Payment Failed",
    [TABLE_STATE_KEYS.CANCELLED]: "Payment Cancelled",
};

const TABLE_STATE_LEGEND = [
    TABLE_STATE_KEYS.BLANK,
    TABLE_STATE_KEYS.RESERVED,
    TABLE_STATE_KEYS.RUNNING,
    TABLE_STATE_KEYS.PRINTED,
    TABLE_STATE_KEYS.PAID,
    TABLE_STATE_KEYS.RUNNING_KOT,
    TABLE_STATE_KEYS.DELIVERED,
];

const ACTIVE_KOT_STATUSES = new Set(["PREPARING", "READY"]);
const TABLE_STATE_RECENT_WINDOW_MS = 3 * 60 * 60 * 1000;

const toTableStateClassToken = (stateKey) =>
    String(stateKey || TABLE_STATE_KEYS.BLANK).toLowerCase().replace(/_/g, "-");

const resolveTableState = (table, printedTableKeys = new Set()) => {
    const activeOrders = Array.isArray(table?.activeOrders) ? table.activeOrders : [];
    if (activeOrders.length > 0) {
        const assignmentKey = String(table?.assignmentKey || table?.key || "");
        const isPrinted = printedTableKeys.has(assignmentKey);

        const allDelivered = activeOrders.every(
            (order) => String(order?.status || "").toUpperCase() === "DELIVERED"
        );

        if (allDelivered) {
            const hasFailed = activeOrders.some(
                (o) => String(o?.paymentStatus || "").toUpperCase() === "FAILED"
            );
            if (hasFailed) return TABLE_STATE_KEYS.FAILED;

            const hasCancelled = activeOrders.some(
                (o) => String(o?.paymentStatus || "").toUpperCase() === "CANCELLED"
            );
            if (hasCancelled) return TABLE_STATE_KEYS.CANCELLED;

            const allPaid = activeOrders.every(
                (o) => ["PAID", "SUCCESS"].includes(String(o?.paymentStatus || "").toUpperCase())
            );
            if (allPaid) {
                return isPrinted ? TABLE_STATE_KEYS.PRINTED : TABLE_STATE_KEYS.PAID;
            }

            if (isPrinted) return TABLE_STATE_KEYS.PRINTED;
            return TABLE_STATE_KEYS.DELIVERED;
        }

        if (isPrinted) return TABLE_STATE_KEYS.PRINTED;

        const hasRunningKot = activeOrders.some((order) =>
            ACTIVE_KOT_STATUSES.has(String(order?.status || "").toUpperCase())
        );
        return hasRunningKot ? TABLE_STATE_KEYS.RUNNING_KOT : TABLE_STATE_KEYS.RUNNING;
    }

    if (table?.isReserved || table?.activeReservation || table?.upcomingReservation || table?.is_reserved) {
        return TABLE_STATE_KEYS.RESERVED;
    }

    return TABLE_STATE_KEYS.BLANK;
};

const resolveTableCardBadge = (table, tableStateKey, printedTableKeys) => {
    const activeOrders = Array.isArray(table?.activeOrders) ? table.activeOrders : [];
    const isOccupied = table?.isOccupied || activeOrders.length > 0;

    if (isOccupied) {
        if (activeOrders.length > 0) {
            const anyFailed = activeOrders.some(
                (o) => String(o?.paymentStatus || "").toUpperCase() === "FAILED"
            );
            if (anyFailed) {
                return {
                    label: "Payment Failed",
                    className: "bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40",
                };
            }

            const anyCancelled = activeOrders.some(
                (o) => String(o?.paymentStatus || "").toUpperCase() === "CANCELLED"
            );
            if (anyCancelled) {
                return {
                    label: "Payment Cancelled",
                    className: "bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/40",
                };
            }

            const allDelivered = activeOrders.every(
                (o) => String(o?.status || "").toUpperCase() === "DELIVERED"
            );
            const allPaid = activeOrders.every(
                (o) => ["PAID", "SUCCESS"].includes(String(o?.paymentStatus || "").toUpperCase())
            );
            const assignmentKey = String(table?.assignmentKey || table?.key || "");
            const isPrinted = printedTableKeys?.has(assignmentKey);

            if (allDelivered) {
                if (allPaid) {
                    if (isPrinted) {
                        return {
                            label: "Bill Printed",
                            className: "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40",
                        };
                    }
                    return {
                        label: "Paid / Available",
                        className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40",
                    };
                }
                if (isPrinted) {
                    return {
                        label: "Bill Printed",
                        className: "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40",
                    };
                }
                return {
                    label: "Payment Pending",
                    className: "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40",
                };
            }

            if (isPrinted) {
                return {
                    label: "Bill Printed",
                    className: "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40",
                };
            }
        }

        return {
            label: "Running",
            className: "bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/40",
        };
    }

    if (table?.isReserved || table?.activeReservation || table?.upcomingReservation || table?.is_reserved) {
        return {
            label: "Reserved",
            className: "bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/40",
        };
    }

    return {
        label: "Available",
        className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40",
    };
};

const resolveOrderSortTime = (order) => {
    const rawTimestamp =
        order?.updatedAt ||
        order?.createdAt ||
        order?.placedAt ||
        order?.created_on ||
        null;
    if (!rawTimestamp) return 0;
    const parsed = new Date(rawTimestamp).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
};

export default function OwnerLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(() => getOwnerUnreadCount());
    const [tableOverview, setTableOverview] = useState({
        loading: true,
        total: 0,
        occupied: 0,
        tables: [],
        error: null,
    });
    const [assigningTableId, setAssigningTableId] = useState(null);
    const assigningTableIdsRef = useRef(new Set());
    const [staffOverview, setStaffOverview] = useState({
        loading: true,
        users: [],
    });
    const [tableAssignments, setTableAssignments] = useState({});
    const [assignmentsHydrated, setAssignmentsHydrated] = useState(false);
    const [draggedStaffId, setDraggedStaffId] = useState("");
    const [dragOverTableKey, setDragOverTableKey] = useState("");
    const [openOrdersTableKey, setOpenOrdersTableKey] = useState("");
    const [openStaffTableKey, setOpenStaffTableKey] = useState("");
    const [openMoreTableKey, setOpenMoreTableKey] = useState("");
    const [completingTableKey, setCompletingTableKey] = useState("");
    const [receiptActionError, setReceiptActionError] = useState("");
    const [tablePopoverPlacement, setTablePopoverPlacement] = useState({});
    const [selectedLiveOrder, setSelectedLiveOrder] = useState(null);
    const [printedTableKeys, setPrintedTableKeys] = useState(() => new Set());
    const [tableGroups, setTableGroups] = useState({});
    const [groupCatalog, setGroupCatalog] = useState([]);
    const [activeGroupFilter, setActiveGroupFilter] = useState("All");
    const [tableZoom, setTableZoom] = useState(() => {
        try {
            const saved = localStorage.getItem("owner_table_zoom_level");
            return saved ? Math.min(180, Math.max(40, Number(saved))) : 100;
        } catch {
            return 100;
        }
    });

    const changeTableZoom = (updater) => {
        setTableZoom((prev) => {
            const next = typeof updater === "function" ? updater(prev) : updater;
            const clamped = Math.min(180, Math.max(40, next));
            try {
                localStorage.setItem("owner_table_zoom_level", String(clamped));
            } catch {}
            return clamped;
        });
    };

    const [showOnlineOrdersPanel, setShowOnlineOrdersPanel] = useState(() => {
        try {
            const saved = localStorage.getItem("owner_show_online_orders_panel");
            return saved !== null ? saved === "true" : true;
        } catch {
            return true;
        }
    });

    const toggleOnlineOrdersPanel = () => {
        setShowOnlineOrdersPanel((prev) => {
            const next = !prev;
            try {
                localStorage.setItem("owner_show_online_orders_panel", String(next));
            } catch {}
            return next;
        });
    };

    // Table Action Modals State
    const [editingTableModal, setEditingTableModal] = useState(null);
    const [submittingEditTable, setSubmittingEditTable] = useState(false);
    const [moveTableModal, setMoveTableModal] = useState(null);
    const [targetMoveTableId, setTargetMoveTableId] = useState("");
    const [submittingMoveTable, setSubmittingMoveTable] = useState(false);

    const { user, logout } = useAuth();
    const restaurantId = useMemo(() => {
        const resolved = resolveAuthoritativeRestaurantId(user);
        if (resolved > 0) return resolved;
        return 1;
    }, [user]);

    const restaurantName = resolveRestaurantName(user, "Restaurant");

    const effectiveRole = useMemo(
        () => resolveEffectiveStaffRole(user?.role, user?.designation),
        [user?.designation, user?.role]
    );

    const access = useMemo(
        () => normalizeAccess(user?.access, effectiveRole),
        [effectiveRole, user?.access]
    );

    const [isTobaccoApproved, setIsTobaccoApproved] = useState(false);

    useEffect(() => {
        if (!restaurantId) return;
        api.get(`/owner/${restaurantId}/settings`)
            .then((res) => {
                const data = res?.data || res;
                const rest = data?.restaurant || data;
                if (rest?.tobaccoApproved === true) {
                    setIsTobaccoApproved(true);
                } else {
                    setIsTobaccoApproved(false);
                }
            })
            .catch(() => {});
    }, [restaurantId]);

    const navItems = [
        {
            label: "Dashboard",
            path: "/owner",
            icon: <LayoutDashboard size={18} />,
            accessKey: "dashboard",
        },
        {
            label: "Billing Desk",
            path: "/owner/billing",
            icon: <ClipboardPlus size={18} />,
            accessKey: "billing",
            fallbackKey: "orders",
        },
        {
            label: "Live Orders",
            path: "/owner/orders",
            icon: <ShoppingBag size={18} />,
            accessKey: "orders",
        },
        {
            label: "Menu Studio",
            path: "/owner/menu",
            icon: <UtensilsCrossed size={18} />,
            accessKey: "menu",
        },
        {
            label: "Recipes & Ingredients",
            path: "/owner/recipes",
            icon: <ChefHat size={18} />,
            accessKey: "recipes",
            fallbackKey: "inventory",
        },
        {
            label: "Tables & QR",
            path: "/owner/tables",
            icon: <TableProperties size={18} />,
            accessKey: "tables",
        },
        {
            label: "Kitchen Operations",
            path: "/owner/kitchen",
            icon: <ChefHat size={18} />,
            accessKey: "kitchen",
        },
        {
            label: "Printers",
            path: "/owner/printers",
            icon: <Printer size={18} />,
            accessKey: "printers",
            fallbackKey: "kitchen",
        },
        {
            label: "Analytics",
            path: "/owner/analytics",
            icon: <BarChart3 size={18} />,
            accessKey: "analytics",
        },
        {
            label: "Reports & Insights",
            path: "/owner/reports",
            icon: <FileText size={18} />,
            accessKey: "reports",
            fallbackKey: "analytics",
        },
        {
            label: "Pay Later",
            path: "/owner/pay-later",
            icon: <IndianRupee size={18} />,
            accessKey: "paylater",
            fallbackKey: "finance",
        },
        {
            label: "Shift & Day Close",
            path: "/owner/shifts",
            icon: <Wallet size={18} />,
            accessKey: "shifts",
            fallbackKey: "finance",
        },
        {
            label: "Supply Chain",
            path: "/owner/supply-chain",
            icon: <Boxes size={18} />,
            accessKey: "supply",
        },
        {
            label: "Delivery Studio",
            path: "/owner/delivery",
            icon: <Truck size={18} />,
            accessKey: "delivery",
            fallbackKey: "orders",
        },
        {
            label: "Delivery Partners",
            path: "/owner/delivery-partners",
            icon: <Users size={18} />,
            accessKey: "delivery_partners",
            fallbackKey: "orders",
        },
        {
            label: "Customers",
            path: "/owner/customers",
            icon: <Users size={18} />,
            accessKey: "customers",
        },
        {
            label: "Discounts & Offers",
            path: "/owner/discounts",
            icon: <Tag size={18} />,
            accessKey: "discounts",
        },
        {
            label: "Loyalty & Rewards",
            path: "/owner/loyalty",
            icon: <Award size={18} />,
            accessKey: "loyalty",
        },
        {
            label: "Staff Directory",
            path: "/owner/staff",
            icon: <Users size={18} />,
            accessKey: "staff",
        },
        {
            label: "Audit Logs",
            path: "/owner/audit-logs",
            icon: <ShieldCheck size={18} />,
            accessKey: "audit",
            fallbackKey: "reports",
        },
        {
            label: "Profile",
            path: "/owner/settings",
            icon: <User size={18} />,
            accessKey: "settings",
        },
    ];

    const visibleNavItems = navItems.filter((item) =>
        hasModuleAccess(access, item.accessKey, item.fallbackKey)
    );

    const firstAllowedPath = visibleNavItems[0]?.path || "/owner";

    const findRouteAccess = (pathname) =>
        [...navItems]
            .sort((a, b) => b.path.length - a.path.length)
            .find((item) =>
                item.path === "/owner"
                    ? pathname === "/owner"
                    : pathname.startsWith(item.path)
            );

    const canAccessCurrentRoute = (() => {
        const match = findRouteAccess(location.pathname);
        if (!match) return true;
        return hasModuleAccess(access, match.accessKey, match.fallbackKey);
    })();
    const isDashboardRoute = location.pathname === "/owner" || location.pathname === "/owner/";
    const isKitchenRoute = location.pathname === "/owner/kitchen" || location.pathname.startsWith("/owner/kitchen/");
    const isInventoryRoute = location.pathname === "/owner/inventory" || location.pathname.startsWith("/owner/inventory/");
    const isFullHeightWorkspaceRoute = isDashboardRoute || isKitchenRoute || isInventoryRoute;
    const showTableAssignmentStrip = isDashboardRoute;

    const dashboardHeaderRef = useRef(null);
    const [dashboardHeaderHeight, setDashboardHeaderHeight] = useState(65);

    useEffect(() => {
        if (!isDashboardRoute) return;

        const updateHeaderHeight = () => {
            if (dashboardHeaderRef.current) {
                const rect = dashboardHeaderRef.current.getBoundingClientRect();
                const h = Math.round(rect.height || dashboardHeaderRef.current.offsetHeight || 65);
                if (h > 0) {
                    setDashboardHeaderHeight(h);
                }
            }
        };

        updateHeaderHeight();

        let resizeObserver = null;
        if (typeof ResizeObserver !== "undefined" && dashboardHeaderRef.current) {
            resizeObserver = new ResizeObserver(() => {
                updateHeaderHeight();
            });
            resizeObserver.observe(dashboardHeaderRef.current);
        }

        window.addEventListener("resize", updateHeaderHeight);
        return () => {
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener("resize", updateHeaderHeight);
        };
    }, [isDashboardRoute]);

    useEffect(() => {
        if (!visibleNavItems.length) return;

        if (!canAccessCurrentRoute) {
            navigate(firstAllowedPath, { replace: true });
        }
    }, [canAccessCurrentRoute, firstAllowedPath, navigate, visibleNavItems.length]);

    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && sidebarOpen) {
                setSidebarOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [sidebarOpen]);

    useEffect(() => {
        const syncUnread = () => setUnreadCount(getOwnerUnreadCount());
        syncUnread();
        const unsubscribe = subscribeOwnerNotifications(syncUnread);
        return unsubscribe;
    }, []);

    const [popupOrder, setPopupOrder] = useState(null);
    const knownOrderIdsRef = useState(() => new Set())[0];
    const tableOverviewReqIdRef = useRef(0);
    const { socket } = useStaffSocket();

    const loadTableOverview = useCallback(async () => {
        if (!restaurantId) {
            setTableOverview({
                loading: false,
                total: 0,
                occupied: 0,
                tables: [],
                error: null,
            });
            return;
        }

        const reqId = ++tableOverviewReqIdRef.current;

        try {
            const res = await axios.get(`${API}/owner/${restaurantId}/tables`);
            if (reqId !== tableOverviewReqIdRef.current) {
                return;
            }
            const tables = normalizeTableRows(res.data);
            const occupied = tables.filter((table) => table.isOccupied).length;

            const activeOrders = tables.flatMap((t) => (Array.isArray(t.activeOrders) ? t.activeOrders : []));
            if (knownOrderIdsRef.size > 0) {
                const brandNewOrder = activeOrders.find((o) => o?.id && !knownOrderIdsRef.has(o.id));
                if (brandNewOrder) {
                    setPopupOrder(brandNewOrder);
                }
            }
            activeOrders.forEach((o) => {
                if (o?.id) knownOrderIdsRef.add(o.id);
            });

            setTableAssignments((prev) => {
                const next = { ...(prev || {}) };
                tables.forEach((t) => {
                    const wid = t.assignedWaiterId ? String(t.assignedWaiterId) : "";
                    const keys = [
                        t.id ? `table-id-${t.id}` : null,
                        t.assignmentKey && t.assignmentKey.startsWith("table-") ? t.assignmentKey : null,
                        t.tableNo && restaurantId
                            ? `table-no-${restaurantId}-${String(t.tableNo).trim().toLowerCase()}`
                            : t.tableNo
                            ? `table-no-${String(t.tableNo).trim().toLowerCase()}`
                            : null,
                    ].filter(Boolean);

                    if (wid) {
                        keys.forEach((k) => {
                            next[k] = wid;
                        });
                    } else {
                        keys.forEach((k) => {
                            delete next[k];
                        });
                    }
                });
                return next;
            });

            setTableOverview({
                loading: false,
                total: tables.length,
                occupied,
                tables,
                error: null,
            });
        } catch (err) {
            console.error("Failed to load table overview for owner dashboard:", err);
            const status = err?.response?.status;
            const errMsg = String(err?.response?.data?.message || err?.message || "");
            if (status === 401 || (status === 403 && (errMsg.includes("Staff access required") || errMsg.includes("Session expired") || errMsg.includes("Authentication required")))) {
                setTableOverview((prev) => ({
                    ...prev,
                    loading: false,
                    error: "Session expired. Please log in again.",
                }));
                navigate("/login?mode=staff&sessionExpired=true", { replace: true });
                return;
            }
            setTableOverview((prev) => ({
                ...prev,
                loading: false,
                error:
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to load tables",
            }));
        }
    }, [knownOrderIdsRef, navigate, restaurantId]);

    useEffect(() => {
        const handleAuthLogout = (e) => {
            const scope = e?.detail?.scope;
            if (!scope || scope === "staff") {
                navigate("/login?mode=staff&sessionExpired=true", { replace: true });
            }
        };
        window.addEventListener("auth:logout", handleAuthLogout);
        return () => {
            window.removeEventListener("auth:logout", handleAuthLogout);
        };
    }, [navigate]);

    useEffect(() => {
        loadTableOverview();
        const intervalId = setInterval(loadTableOverview, 10000);

        return () => {
            clearInterval(intervalId);
        };
    }, [loadTableOverview]);

    // Realtime Socket Event Listener for instant new orders and notifications
    useEffect(() => {
        if (!socket) return undefined;

        const handleNewOrder = (order) => {
            if (order) {
                setPopupOrder(order);
                playNotificationSound();
                loadTableOverview();
            }
        };

        const handleTableUpdated = (payload) => {
            if (!payload || typeof payload !== "object") return;
            const targetId = payload.tableId || payload.id;
            const targetNo = payload.tableNo;

            if (payload.status === "AVAILABLE" || payload.isOccupied === false) {
                setTableOverview((prev) => {
                    const updatedTables = (prev.tables || []).map((t) => {
                        const match =
                            (targetId && String(t.id) === String(targetId)) ||
                            (targetNo && String(t.tableNo).toLowerCase() === String(targetNo).toLowerCase());
                        if (match) {
                            return {
                                ...t,
                                status: "AVAILABLE",
                                isOccupied: false,
                                activeOrderCount: 0,
                                activeItemCount: 0,
                                activeOrders: [],
                                activeOrderStatus: null,
                                paymentStatus: null,
                                lastOrderStatus: null,
                                lastPaymentStatus: null,
                                session: { status: "CLOSED" },
                                activeSession: null,
                                occupiedSince: null,
                                assignedWaiterId: null,
                                assignedWaiterName: null,
                                assignedServer: null,
                            };
                        }
                        return t;
                    });
                    return {
                        ...prev,
                        occupied: updatedTables.filter((t) => t.isOccupied).length,
                        tables: updatedTables,
                    };
                });

                // Immediately clear tableAssignments keys for this table
                setTableAssignments((prev) => {
                    const next = { ...(prev || {}) };
                    if (targetId) delete next[`table-id-${targetId}`];
                    if (targetNo) {
                        const normNo = String(targetNo).trim().toLowerCase();
                        if (restaurantId) delete next[`table-no-${restaurantId}-${normNo}`];
                        delete next[`table-no-${normNo}`];
                    }
                    return next;
                });
            } else if (payload.assignedWaiterId !== undefined || payload.assignedWaiterName !== undefined) {
                const wid = payload.assignedWaiterId ? String(payload.assignedWaiterId) : "";
                const wname = payload.assignedWaiterName || null;
                setTableOverview((prev) => {
                    const updatedTables = (prev.tables || []).map((t) => {
                        const match =
                            (targetId && String(t.id) === String(targetId)) ||
                            (targetNo && String(t.tableNo).toLowerCase() === String(targetNo).toLowerCase());
                        if (match) {
                            return {
                                ...t,
                                assignedWaiterId: wid ? Number(wid) : null,
                                assignedWaiterName: wname,
                                assignedServer: wname,
                            };
                        }
                        return t;
                    });
                    return { ...prev, tables: updatedTables };
                });

                setTableAssignments((prev) => {
                    const next = { ...(prev || {}) };
                    if (targetId) {
                        if (wid) next[`table-id-${targetId}`] = wid;
                        else delete next[`table-id-${targetId}`];
                    }
                    if (targetNo) {
                        const normNo = String(targetNo).trim().toLowerCase();
                        if (restaurantId) {
                            if (wid) next[`table-no-${restaurantId}-${normNo}`] = wid;
                            else delete next[`table-no-${restaurantId}-${normNo}`];
                        }
                        if (wid) next[`table-no-${normNo}`] = wid;
                        else delete next[`table-no-${normNo}`];
                    }
                    return next;
                });
            }
            loadTableOverview();
        };

        const handleSessionUpdated = (session) => {
            if (session && (!session.status || session.status === "CLOSED" || session.status === "CANCELLED")) {
                const targetId = session.tableId;
                const targetNo = session.tableNo;
                setTableOverview((prev) => {
                    const updatedTables = (prev.tables || []).map((t) => {
                        const match =
                            (targetId && String(t.id) === String(targetId)) ||
                            (targetNo && String(t.tableNo).toLowerCase() === String(targetNo).toLowerCase());
                        if (match) {
                            return {
                                ...t,
                                status: "AVAILABLE",
                                isOccupied: false,
                                activeOrderCount: 0,
                                activeItemCount: 0,
                                activeOrders: [],
                                activeOrderStatus: null,
                                paymentStatus: null,
                                lastOrderStatus: null,
                                lastPaymentStatus: null,
                                session: { status: "CLOSED" },
                                activeSession: null,
                                occupiedSince: null,
                                assignedWaiterId: null,
                                assignedWaiterName: null,
                                assignedServer: null,
                            };
                        }
                        return t;
                    });
                    return {
                        ...prev,
                        occupied: updatedTables.filter((t) => t.isOccupied).length,
                        tables: updatedTables,
                    };
                });

                // Immediately clear tableAssignments keys
                setTableAssignments((prev) => {
                    const next = { ...(prev || {}) };
                    if (targetId) delete next[`table-id-${targetId}`];
                    if (targetNo) {
                        const normNo = String(targetNo).trim().toLowerCase();
                        if (restaurantId) delete next[`table-no-${restaurantId}-${normNo}`];
                        delete next[`table-no-${normNo}`];
                    }
                    return next;
                });
            }
            loadTableOverview();
        };

        socket.on("order:created", handleNewOrder);
        socket.on("new_order", handleNewOrder);
        socket.on("order:updated", loadTableOverview);
        socket.on("order:status_updated", loadTableOverview);
        socket.on("payment:updated", loadTableOverview);
        socket.on("notification:new", loadTableOverview);
        socket.on("reservation:updated", loadTableOverview);
        socket.on("table:updated", handleTableUpdated);
        socket.on("table:session_updated", handleSessionUpdated);
        socket.on("table:waiter_assigned", handleTableUpdated);
        socket.on("table:layout_updated", loadTableOverview);

        return () => {
            socket.off("order:created", handleNewOrder);
            socket.off("new_order", handleNewOrder);
            socket.off("order:updated", loadTableOverview);
            socket.off("order:status_updated", loadTableOverview);
            socket.off("payment:updated", loadTableOverview);
            socket.off("notification:new", loadTableOverview);
            socket.off("reservation:updated", loadTableOverview);
            socket.off("table:updated", handleTableUpdated);
            socket.off("table:session_updated", handleSessionUpdated);
            socket.off("table:waiter_assigned", loadTableOverview);
            socket.off("table:layout_updated", loadTableOverview);
        };
    }, [loadTableOverview, socket]);

    useEffect(() => {
        let mounted = true;

        const loadStaffOverview = async () => {
            if (!restaurantId) {
                if (!mounted) return;
                setStaffOverview({
                    loading: false,
                    users: [],
                });
                return;
            }

            try {
                const res = await axios.get(`${API}/owner/${restaurantId}/staff`);
                if (!mounted) return;

                const rawUsers = Array.isArray(res.data?.users) ? res.data.users : [];
                const allUsers = [...rawUsers];
                if (user && user.id && !allUsers.some((u) => String(u.id) === String(user.id))) {
                    allUsers.unshift({
                        id: user.id,
                        name: user.name || "Owner",
                        role: user.role || "OWNER",
                        designation: user.designation || "Owner",
                        isActive: true,
                    });
                }

                const users = allUsers
                    .filter(
                        (staffUser) => staffUser && Boolean(staffUser.isActive !== false)
                    )
                    .map((staffUser, index) => ({
                        ...staffUser,
                        key: staffUser?.id || `staff-${index}`,
                    }))
                    .sort((a, b) =>
                        String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
                            sensitivity: "base",
                        })
                    );

                setStaffOverview({
                    loading: false,
                    users,
                });
            } catch (err) {
                if (!mounted) return;
                setStaffOverview((prev) => ({
                    ...prev,
                    loading: false,
                }));
            }
        };

        loadStaffOverview();
        const intervalId = setInterval(loadStaffOverview, 20000);

        return () => {
            mounted = false;
            clearInterval(intervalId);
        };
    }, [restaurantId]);

    useEffect(() => {
        setAssignmentsHydrated(false);

        if (!restaurantId) {
            setTableAssignments({});
            setAssignmentsHydrated(true);
            return;
        }

        // Clean up legacy localStorage key so stale table assignments are never resurrected
        try {
            localStorage.removeItem(getTableStaffStorageKey(restaurantId));
        } catch (_) {}

        setTableAssignments({});
        setAssignmentsHydrated(true);
    }, [restaurantId]);

    const staffById = useMemo(() => {
        const map = new Map();
        staffOverview.users.forEach((staffUser) => {
            map.set(String(staffUser.id), staffUser);
        });
        return map;
    }, [staffOverview.users]);

    const tableOccupiedByKey = useMemo(() => {
        const map = new Map();
        tableOverview.tables.forEach((table) => {
            const key = String(table.assignmentKey || table.key);
            map.set(key, Boolean(table.isOccupied));
        });
        return map;
    }, [tableOverview.tables]);

    const assignedTableCountByStaff = useMemo(() => {
        const counts = {};
        tableOverview.tables.forEach((table) => {
            const idKey = table.id ? `table-id-${table.id}` : null;
            const noKey = table.tableNo && restaurantId
                ? `table-no-${restaurantId}-${String(table.tableNo).trim().toLowerCase()}`
                : table.tableNo
                ? `table-no-${String(table.tableNo).trim().toLowerCase()}`
                : null;
            const localStaffId = (idKey && tableAssignments[idKey]) ||
                                 (noKey && tableAssignments[noKey]) ||
                                 (table.assignmentKey && tableAssignments[table.assignmentKey]) ||
                                 "";
            const staffId = String(
                table.assignedWaiterId ||
                table.activeSession?.waiterId ||
                localStaffId ||
                ""
            ).trim();
            if (staffId) {
                counts[staffId] = (counts[staffId] || 0) + 1;
            }
        });
        return counts;
    }, [tableOverview.tables, tableAssignments, restaurantId]);

    const handleStaffDragStart = (event, staffId) => {
        const normalizedStaffId = String(staffId || "").trim();
        if (!normalizedStaffId) return;

        setDraggedStaffId(normalizedStaffId);
        event.dataTransfer.setData("text/plain", normalizedStaffId);
        event.dataTransfer.effectAllowed = "move";
    };

    const handleTableDragOver = (event, tableKey) => {
        const hasPayload =
            Boolean(draggedStaffId) ||
            Array.from(event.dataTransfer?.types || []).includes("text/plain");
        if (!hasPayload) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dragOverTableKey !== tableKey) {
            setDragOverTableKey(tableKey);
        }
    };

    const handleTableDrop = (event, tableKey, tableObj) => {
        event.preventDefault();
        const droppedStaffId = String(
            event.dataTransfer.getData("text/plain") || draggedStaffId || ""
        ).trim();

        if (!droppedStaffId) {
            setDragOverTableKey("");
            setDraggedStaffId("");
            return;
        }

        assignStaffToTable(tableKey, droppedStaffId, tableObj);
        setDragOverTableKey("");
        setDraggedStaffId("");
    };

    const clearTableAssignment = async (tableKey, tableObj) => {
        const prevAssignments = { ...(tableAssignments || {}) };
        const prevOverview = { ...tableOverview };

        setTableAssignments((prev) => {
            const next = { ...(prev || {}) };
            if (tableObj?.id) {
                delete next[`table-id-${tableObj.id}`];
            }
            if (tableObj?.tableNo) {
                const normNo = String(tableObj.tableNo).trim().toLowerCase();
                if (restaurantId) {
                    delete next[`table-no-${restaurantId}-${normNo}`];
                }
                delete next[`table-no-${normNo}`];
            }
            if (tableObj?.assignmentKey) {
                delete next[tableObj.assignmentKey];
            }
            if (tableKey) {
                delete next[tableKey];
            }
            return next;
        });

        // Optimistically clear on tableOverview
        setTableOverview((prev) => ({
            ...prev,
            tables: (prev.tables || []).map((t) => {
                const matches = tableObj?.id
                    ? String(t.id) === String(tableObj.id)
                    : (tableObj?.tableNo && String(t.tableNo).toLowerCase() === String(tableObj.tableNo).toLowerCase()) ||
                      t.assignmentKey === tableKey;
                if (!matches) return t;
                return {
                    ...t,
                    assignedWaiterId: null,
                    assignedWaiterName: null,
                    activeSession: t.activeSession ? {
                        ...t.activeSession,
                        waiterId: null,
                        waiterName: null,
                    } : null,
                };
            }),
        }));

        const targetTableId = tableObj?.id || (function () {
            const found = tableOverview.tables.find(
                (t) =>
                    (t.id && `table-id-${t.id}` === tableKey) ||
                    t.assignmentKey === tableKey
            );
            return found?.id;
        })();

        if (restaurantId && targetTableId) {
            try {
                await axios.post(`${API}/owner/${restaurantId}/tables/${targetTableId}/unassign-waiter`, {
                    reason: "Unassigned via Owner Panel",
                });
            } catch (err) {
                console.error("Failed to unassign waiter on backend:", err);
                setTableAssignments(prevAssignments);
                setTableOverview(prevOverview);
                showToast({
                    title: "Unassignment Failed",
                    message: err?.response?.data?.message || err.message || "Failed to unassign waiter on backend",
                    variant: "error",
                });
                await refreshTableOverview();
            }
        }
    };

    const assignStaffToTable = async (tableKey, staffId, tableObj) => {
        const targetTableId = tableObj?.id || (function () {
            const found = (tableOverview.tables || []).find(
                (t) =>
                    (t.id && `table-id-${t.id}` === tableKey) ||
                    t.assignmentKey === tableKey
            );
            return found?.id;
        })();

        if (!targetTableId) {
            return;
        }

        const targetTableIdStr = String(targetTableId);
        if (
            assigningTableIdsRef.current.has(targetTableIdStr) ||
            (assigningTableId && String(assigningTableId) === targetTableIdStr)
        ) {
            return;
        }

        const normalizedStaffId = String(staffId || "").trim();
        if (!normalizedStaffId) return;

        const staffMember = staffById.get(normalizedStaffId);
        const staffName = staffMember ? (staffMember.name || staffMember.userName || "Server") : "Server";

        const prevAssignments = { ...(tableAssignments || {}) };
        const prevOverview = { ...tableOverview };

        try {
            assigningTableIdsRef.current.add(targetTableIdStr);
            setAssigningTableId(targetTableId);

            setTableAssignments((prev) => {
                const next = { ...(prev || {}) };
                if (tableObj?.id) {
                    next[`table-id-${tableObj.id}`] = normalizedStaffId;
                }
                if (tableObj?.tableNo) {
                    const normNo = String(tableObj.tableNo).trim().toLowerCase();
                    if (restaurantId) {
                        next[`table-no-${restaurantId}-${normNo}`] = normalizedStaffId;
                    }
                    next[`table-no-${normNo}`] = normalizedStaffId;
                }
                if (tableObj?.assignmentKey) {
                    next[tableObj.assignmentKey] = normalizedStaffId;
                }
                if (tableKey && tableKey.startsWith("table-")) {
                    next[tableKey] = normalizedStaffId;
                }
                return next;
            });

            // Optimistically update on tableOverview
            setTableOverview((prev) => ({
                ...prev,
                tables: (prev.tables || []).map((t) => {
                    const matches = tableObj?.id
                        ? String(t.id) === String(tableObj.id)
                        : (tableObj?.tableNo && String(t.tableNo).toLowerCase() === String(tableObj.tableNo).toLowerCase()) ||
                          t.assignmentKey === tableKey;
                    if (!matches) return t;
                    return {
                        ...t,
                        assignedWaiterId: Number(normalizedStaffId) || t.assignedWaiterId,
                        assignedWaiterName: staffName || t.assignedWaiterName,
                        activeSession: t.activeSession ? {
                            ...t.activeSession,
                            waiterId: Number(normalizedStaffId) || t.activeSession.waiterId,
                            waiterName: staffName || t.activeSession.waiterName,
                        } : null,
                    };
                }),
            }));

            if (restaurantId && targetTableId) {
                await axios.post(`${API}/owner/${restaurantId}/tables/${targetTableId}/assign-waiter`, {
                    waiterId: Number(normalizedStaffId),
                    waiterName: staffName,
                    reason: "Assigned via Owner Panel",
                });
            }
        } catch (err) {
            console.error("Failed to assign waiter on backend:", err);
            setTableAssignments(prevAssignments);
            setTableOverview(prevOverview);
            showToast({
                title: "Assignment Failed",
                message: err?.response?.data?.message || err.message || "Failed to assign waiter on backend",
                variant: "error",
            });
            await refreshTableOverview();
        } finally {
            assigningTableIdsRef.current.delete(targetTableIdStr);
            setAssigningTableId((prev) => (String(prev) === targetTableIdStr ? null : prev));
        }
    };

    const refreshTableOverview = useCallback(async () => {
        await loadTableOverview();
    }, [loadTableOverview]);

    const handleReceiptPrint = ({ tableLabel, activeOrders, tableReceiptTotal, assignmentKey } = {}) => {
        if (assignmentKey) {
            setPrintedTableKeys((prev) => new Set([...prev, assignmentKey]));
        }
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            showToast({
                title: "Print Blocked",
                message: "Please allow popups in your browser to print receipts.",
                variant: "warning",
            });
            return;
        }

        const markup = buildReceiptPrintMarkup({
            tableLabel,
            activeOrders,
            tableReceiptTotal,
            logoUrl: tiffzyLogo,
        });
        printWindow.document.open();
        printWindow.document.write(markup);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const handleSettleBill = async (table, assignmentKey, paymentMode = "CASH") => {
        const targetTableNo = table?.tableNo || table?.label || null;
        if (!restaurantId || !targetTableNo) return;

        setCompletingTableKey(assignmentKey || String(table?.id || targetTableNo));
        setReceiptActionError("");

        try {
            const res = await api.post(`/owner/${restaurantId}/tables/${encodeURIComponent(targetTableNo)}/settle-bill`, {
                tableId: table?.id || null,
                paymentMode,
                changedByName: user?.name || user?.email || "Owner",
            });

            if (res.data?.cleared === false) {
                showToast({
                    title: "Bill Settlement Notice",
                    message: res.data?.message || `Table ${targetTableNo} has no active bill.`,
                    variant: "info",
                });
                await refreshTableOverview();
                return;
            }

            if (assignmentKey) {
                setPrintedTableKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(assignmentKey);
                    return next;
                });
            }
            await refreshTableOverview();
            setOpenOrdersTableKey("");
            showToast({
                title: "Bill Settled & Table Freed 🎉",
                message: `Table ${targetTableNo} bill settled via ${paymentMode} and released.`,
                variant: "success",
            });
        } catch (err) {
            const errorMsg = err?.response?.data?.message || err?.message || "Failed to settle bill";
            setReceiptActionError(errorMsg);
            showToast({
                title: "Settlement Error",
                message: errorMsg,
                variant: "error",
            });
        } finally {
            setCompletingTableKey("");
        }
    };

    const handleFreeTable = async (table, assignmentKey, options = {}) => {
        const targetTableId = table?.id || table?.tableNo || table?.label || null;

        if (!restaurantId || !targetTableId) {
            setOpenOrdersTableKey("");
            setOpenStaffTableKey("");
            setOpenMoreTableKey("");
            return;
        }

        const tableNoLabel = table?.tableNo || table?.label || "this table";

        const activeOrders = Array.isArray(table?.activeOrders) ? table.activeOrders : [];
        const hasUnpaidOrders = activeOrders.some((o) => {
            const payStatus = String(o?.paymentStatus || o?.payment_status || "PENDING").toUpperCase();
            return payStatus !== "PAID" && payStatus !== "SUCCESS";
        });
        const hasActivePrepOrders = activeOrders.some((o) => {
            const st = String(o?.status || "").toUpperCase();
            return st === "PENDING" || st === "CONFIRMED" || st === "PREPARING" || st === "READY";
        });

        if (!options.force && (hasUnpaidOrders || hasActivePrepOrders)) {
            const reason = hasActivePrepOrders ? "active order(s) being prepared" : "unpaid order(s)";
            const settleConfirm = window.confirm(
                `Table ${tableNoLabel} has ${reason}. Settle the bill before freeing this table.\n\nClick OK to open Settle Bill, or Cancel to abort.`
            );
            if (settleConfirm) {
                handleSettleBill(table, assignmentKey, "CASH");
            }
            return;
        }

        const confirmMsg = options.force
            ? `Are you sure you want to FORCE FREE Table ${tableNoLabel}? This will close the table session immediately even if payment is pending.`
            : `Are you sure you want to free Table ${tableNoLabel}? Confirm that the customer has left and there are no outstanding orders.`;
        if (!window.confirm(confirmMsg)) {
            return;
        }

        setCompletingTableKey(assignmentKey || String(targetTableId));
        setReceiptActionError("");
        const prevAssignments = { ...tableAssignments };
        const prevOverview = { ...tableOverview };

        // Invalidate in-flight requests so a pending poll/fetch response cannot overwrite this action
        tableOverviewReqIdRef.current++;

        // Optimistically update table state to Available and clear server assignment in local state
        setTableOverview((prev) => {
            const updatedTables = (prev.tables || []).map((t) => {
                const matches =
                    (targetTableId && String(t.id) === String(targetTableId)) ||
                    (t.tableNo && String(t.tableNo).toLowerCase() === String(tableNoLabel).toLowerCase()) ||
                    (table?.tableNo && String(t.tableNo).toLowerCase() === String(table.tableNo).toLowerCase()) ||
                    (assignmentKey && t.assignmentKey === assignmentKey);
                if (matches) {
                    return {
                        ...t,
                        isOccupied: false,
                        activeOrderCount: 0,
                        activeItemCount: 0,
                        activeOrders: [],
                        activeSession: null,
                        occupiedSince: null,
                        assignedWaiterId: null,
                        assignedWaiterName: null,
                    };
                }
                return t;
            });
            const occupiedCount = updatedTables.filter((t) => t.isOccupied).length;
            return {
                ...prev,
                occupied: occupiedCount,
                tables: updatedTables,
            };
        });

        // Clear local table staff assignments map
        setTableAssignments((prev) => {
            const next = { ...(prev || {}) };
            const keysToRemove = [
                targetTableId ? `table-id-${targetTableId}` : null,
                assignmentKey,
                table?.assignmentKey,
                table?.tableNo && restaurantId
                    ? `table-no-${restaurantId}-${String(table.tableNo).trim().toLowerCase()}`
                    : null,
                table?.tableNo
                    ? `table-no-${String(table.tableNo).trim().toLowerCase()}`
                    : null,
                tableNoLabel
                    ? `table-no-${String(tableNoLabel).trim().toLowerCase()}`
                    : null,
            ].filter(Boolean);
            keysToRemove.forEach((k) => {
                delete next[k];
            });
            if (restaurantId) {
                try {
                    localStorage.setItem(getTableStaffStorageKey(restaurantId), JSON.stringify(next));
                } catch (e) {
                    // Ignore storage quota errors
                }
            }
            return next;
        });

        try {
            // Call backend API to clear table session, reset isOccupied, clear assigned waiter, and record audit trail
            await axios.post(`${API}/owner/${restaurantId}/tables/${encodeURIComponent(targetTableId)}/clear`, {
                force: Boolean(options.force),
                clearWaiter: true,
                reason: options.reason || "Table cleared by Owner",
                performedByUserId: user?.id || null,
                performedByName: user?.name || user?.email || "Owner",
                performedByUserRole: "OWNER",
            });

            if (assignmentKey) {
                setPrintedTableKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(assignmentKey);
                    return next;
                });
            }
            await refreshTableOverview();
            setOpenOrdersTableKey("");
            setOpenStaffTableKey("");
            setOpenMoreTableKey("");
            showToast({
                title: "Table Freed 🎉",
                message: `Table ${tableNoLabel} is now free and available.`,
                variant: "success",
            });
        } catch (err) {
            setTableOverview(prevOverview);
            setTableAssignments(prevAssignments);
            if (restaurantId) {
                try {
                    localStorage.setItem(getTableStaffStorageKey(restaurantId), JSON.stringify(prevAssignments));
                } catch (e) {
                    // Ignore storage quota errors
                }
            }
            console.error("Failed to free table:", err);
            const errMsg = err?.response?.data?.message || err?.message || "Failed to free table.";
            setReceiptActionError(errMsg);
            showToast({
                title: "Error Freeing Table",
                message: errMsg,
                variant: "error",
            });
        } finally {
            setCompletingTableKey("");
        }
    };

    const copyQrLink = async (table) => {
        const url = table.qrTargetUrl
            ? `${window.location.origin}${table.qrTargetUrl}`
            : `${window.location.origin}/order/table/${table.qrToken || table.id}`;

        let copied = false;
        if (navigator?.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(url);
                copied = true;
            } catch {
                // fallback to execCommand below
            }
        }

        if (!copied) {
            try {
                const textarea = document.createElement("textarea");
                textarea.value = url;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                copied = document.execCommand("copy");
                document.body.removeChild(textarea);
            } catch {
                copied = false;
            }
        }

        if (copied) {
            showToast({
                title: "QR Link Copied 🎉",
                message: `Ordering link for Table ${table.tableNo} copied to clipboard!`,
                variant: "success",
            });
        } else {
            showToast({
                title: "Copy Failed",
                message: "Unable to copy link to clipboard.",
                variant: "error",
            });
        }
    };

    const handleDeleteTable = async (table) => {
        if (!table?.id) return;
        if (!window.confirm(`Are you sure you want to delete Table ${table.tableNo}? This action cannot be undone.`)) {
            return;
        }
        try {
            await axios.delete(`${API}/owner/${restaurantId}/tables/${table.id}`);
            showToast({
                title: "Table Deleted",
                message: `Table ${table.tableNo} has been deleted.`,
                variant: "success",
            });
            await refreshTableOverview();
        } catch (err) {
            showToast({
                title: "Delete Failed",
                message: err.response?.data?.message || err.message || "Failed to delete table.",
                variant: "error",
            });
        }
    };

    useEffect(() => {
        const validTableKeys = new Set(
            tableOverview.tables.map((table) => String(table.assignmentKey || table.key))
        );

        if (openOrdersTableKey && !validTableKeys.has(openOrdersTableKey)) {
            setOpenOrdersTableKey("");
        }
        if (openStaffTableKey && !validTableKeys.has(openStaffTableKey)) {
            setOpenStaffTableKey("");
        }
        if (openMoreTableKey && !validTableKeys.has(openMoreTableKey)) {
            setOpenMoreTableKey("");
        }
    }, [openMoreTableKey, openOrdersTableKey, openStaffTableKey, tableOverview.tables]);

    useEffect(() => {
        if (!openOrdersTableKey) {
            setReceiptActionError("");
            setCompletingTableKey("");
        }
    }, [openOrdersTableKey]);

    const reservedTables = tableOverview.tables.filter(
        (t) => resolveTableState(t, printedTableKeys) === TABLE_STATE_KEYS.RESERVED
    ).length;
    const freeTables = Math.max(0, tableOverview.total - tableOverview.occupied - reservedTables);

    useEffect(() => {
        if (!restaurantId) return;
        const load = () => {
            const storedGroups = getStoredTableGroups(restaurantId);
            const storedCatalog = getStoredGroupCatalog(restaurantId);
            setTableGroups((prev) => {
                const prevStr = JSON.stringify(prev || {});
                const nextStr = JSON.stringify(storedGroups || {});
                return prevStr === nextStr ? prev : storedGroups;
            });
            setGroupCatalog((prev) => {
                const prevStr = JSON.stringify(prev || []);
                const nextStr = JSON.stringify(storedCatalog || []);
                return prevStr === nextStr ? prev : storedCatalog;
            });
        };
        load();
        const handleSync = () => load();
        window.addEventListener(TABLE_GROUPS_SYNC_EVENT, handleSync);
        window.addEventListener("storage", handleSync);
        return () => {
            window.removeEventListener(TABLE_GROUPS_SYNC_EVENT, handleSync);
            window.removeEventListener("storage", handleSync);
        };
    }, [restaurantId]);

    const getTableGroup = useCallback(
        (table) => resolveTableGroup(table, tableGroups, groupCatalog),
        [tableGroups, groupCatalog]
    );

    const groupedTablesMap = useMemo(() => {
        const map = {};
        (tableOverview.tables || []).forEach((table) => {
            const group = getTableGroup(table);
            if (!map[group]) map[group] = [];
            map[group].push(table);
        });
        return map;
    }, [tableOverview.tables, getTableGroup]);

    const availableGroupNames = useMemo(() => {
        return Object.keys(groupedTablesMap).sort((a, b) => {
            if (a.toLowerCase() === "ungrouped") return 1;
            if (b.toLowerCase() === "ungrouped") return -1;
            return a.localeCompare(b, undefined, { sensitivity: "base" });
        });
    }, [groupedTablesMap]);

    const filteredGroupEntries = useMemo(() => {
        if (activeGroupFilter === "All") {
            return availableGroupNames.map((name) => [name, groupedTablesMap[name]]);
        }
        const match = availableGroupNames.find(
            (name) => name.toLowerCase() === activeGroupFilter.toLowerCase()
        );
        if (match) return [[match, groupedTablesMap[match]]];
        return availableGroupNames.map((name) => [name, groupedTablesMap[name]]);
    }, [activeGroupFilter, availableGroupNames, groupedTablesMap]);
    const stripOnlineOrders = useMemo(() => {
        const rows = tableOverview.tables.flatMap((table) => {
            const activeOrders = Array.isArray(table?.activeOrders) ? table.activeOrders : [];
            return activeOrders.map((order) => ({
                ...order,
                tableKey: table?.key || table?.assignmentKey || "table",
                tableNo: table?.tableNo || "--",
                sortTime: resolveOrderSortTime(order),
            }));
        });

        return rows
            .sort((a, b) => b.sortTime - a.sortTime || Number(b.id || 0) - Number(a.id || 0))
            .slice(0, 8);
    }, [tableOverview.tables]);
    const selectedLiveOrderItems = Array.isArray(selectedLiveOrder?.items)
        ? selectedLiveOrder.items
        : [];
    const selectedLiveOrderItemCount = selectedLiveOrderItems.reduce(
        (sum, item) => sum + Math.max(0, Number(item?.qty || 0)),
        0
    );

    useEffect(() => {
        if (!selectedLiveOrder) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") setSelectedLiveOrder(null);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedLiveOrder]);

    useEffect(() => {
        if (!isDashboardRoute && selectedLiveOrder) {
            setSelectedLiveOrder(null);
        }
    }, [isDashboardRoute, selectedLiveOrder]);

    const resolvePopoverPlacement = (event, kind) => {
        const trigger = event?.currentTarget;
        if (!trigger || typeof trigger.getBoundingClientRect !== "function") return { y: "bottom", x: "left" };
        const tableCard = trigger.closest("[data-table-card='true']") || trigger;

        const rect = trigger.getBoundingClientRect();
        const cardRect = tableCard ? tableCard.getBoundingClientRect() : rect;
        const container = tableCard.closest(".theme-nav") || document.body;
        const containerRect = container.getBoundingClientRect();

        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
        const edgePadding = 16;

        const spaceBelow = viewportHeight - cardRect.bottom - edgePadding;
        const spaceAbove = cardRect.top - edgePadding;

        const expectedHeightByKind = {
            orders: 360,
            staff: 280,
            more: 260,
        };
        const requiredHeight = expectedHeightByKind[kind] || 260;
        const popupWidth = kind === "orders" ? 320 : kind === "staff" ? 280 : 210;

        const posY = (spaceBelow < requiredHeight && spaceAbove > spaceBelow) ? "top" : "bottom";

        // Boundary safety calculation:
        // Table card has position: relative.
        // A right-0 popup has its left edge at cardRect.right - popupWidth in viewport coords.
        // A left-0 popup has its right edge at cardRect.left + popupWidth in viewport coords.
        const rightAlignedLeft = cardRect.right - popupWidth;
        const leftAlignedRight = cardRect.left + popupWidth;

        let posX = "left";
        // Only use right-0 if right-alignment leaves at least 8px on the left AND left-alignment would overflow the right boundary
        if (rightAlignedLeft >= containerRect.left + 8 && leftAlignedRight > containerRect.right - 8) {
            posX = "right";
        } else {
            posX = "left";
        }

        return { y: posY, x: posX };
    };

    const setPopoverPlacementFor = (kind, assignmentKey, event) => {
        const placement = resolvePopoverPlacement(event, kind);
        setTablePopoverPlacement((prev) => ({
            ...prev,
            [`${kind}:${assignmentKey}`]: placement,
        }));
    };

    const toPopoverYClass = (placement) => {
        const posY = typeof placement === "object" ? placement?.y : placement;
        return posY === "top" ? "bottom-full mb-2" : "top-full mt-2";
    };

    const toPopoverXClass = (placement) => {
        const posX = typeof placement === "object" ? placement?.x : "left";
        return posX === "right" ? "right-0" : "left-0";
    };

    useEffect(() => {
        if (!openOrdersTableKey && !openStaffTableKey && !openMoreTableKey) return undefined;

        const handleGlobalPointerDown = (event) => {
            if (event.target.closest(".theme-table-popover")) return;
            if (event.target.closest("button[title*='Actions for Table'], button[aria-label*='actions'], button[title*='Assign server'], button[title*='Assigned:']")) {
                return;
            }
            setOpenOrdersTableKey("");
            setOpenStaffTableKey("");
            setOpenMoreTableKey("");
            setReceiptActionError("");
        };

        window.addEventListener("pointerdown", handleGlobalPointerDown);
        return () => window.removeEventListener("pointerdown", handleGlobalPointerDown);
    }, [openOrdersTableKey, openStaffTableKey, openMoreTableKey]);

    return (
        <div className="theme-page flex min-h-screen overflow-x-hidden">
            {/* Transparent backdrop overlay for navigation drawer (click-to-close without dimming) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Navigation Drawer Sidebar (Light Theme - White Background & Dark Text) */}
            <aside
                aria-label="Navigation sidebar"
                className={`
          fixed top-0 left-0 bottom-0 z-50
          w-64 sm:w-72
          bg-white text-gray-900 border-r border-gray-200 shadow-2xl
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
            >
                <div className="h-full flex flex-col p-4 overflow-y-auto">
                    {/* Logo & Close Button */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            type="button"
                            onClick={() => {
                                navigate("/owner");
                                setSidebarOpen(false);
                            }}
                            className="flex items-center gap-2 text-left cursor-pointer transition-opacity hover:opacity-80 focus:outline-none"
                            title="Go to Dashboard"
                        >
                            <BrandLogo className="theme-brand-logo h-8 w-8" title="Tiffzy logo" />
                            <div>
                                <h1 className="theme-brand-text text-xl font-bold">Tiffzy</h1>
                                <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">OWNER PANEL</span>
                            </div>
                        </button>

                        <button
                            className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-xl p-2 transition cursor-pointer"
                            onClick={() => setSidebarOpen(false)}
                            aria-label="Close navigation menu"
                            title="Close navigation menu"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Navigation Items with ACTIVE badge */}
                    <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                        {visibleNavItems.map((item) => {
                            const isCurrentActive = item.path === "/owner"
                                ? (location.pathname === "/owner" || location.pathname === "/owner/")
                                : location.pathname.startsWith(item.path);

                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={item.path === "/owner"}
                                    onClick={() => setSidebarOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl transition text-sm font-medium ${
                                            isActive || isCurrentActive
                                                ? "bg-gray-100 text-gray-900 font-bold border-l-4 border-gray-900 shadow-2xs"
                                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                        }`
                                    }
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`relative ${isCurrentActive ? "text-gray-900" : "text-gray-500"}`}>
                                            {item.icon}
                                            {item.path === "/owner/notifications" && unreadCount > 0 && (
                                                <span className="bg-gray-900 text-white font-extrabold absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none">
                                                    {unreadCount > 99 ? "99+" : unreadCount}
                                                </span>
                                            )}
                                        </span>
                                        <span>{item.label}</span>
                                    </div>
                                </NavLink>
                            );
                        })}
                    </div>

                    {/* Logout */}
                    <button
                        type="button"
                        onClick={logout}
                        className="mt-4 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold cursor-pointer"
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex min-h-screen min-w-0 flex-1 flex-col">
                {/* Header - Full navbar ONLY on Dashboard page (/owner) */}
                {isDashboardRoute && (
                    <header
                        ref={dashboardHeaderRef}
                        className="theme-nav border-b px-2 py-2 sm:px-3"
                    >
                        <div className="flex items-center justify-between gap-3">
                            {/* Left */}
                            <div className="flex items-start gap-3 min-w-0">
                                <button
                                    className="theme-icon-button theme-icon-button-primary block shrink-0 rounded-xl p-2.5 shadow-lg"
                                    onClick={() => setSidebarOpen((prev) => !prev)}
                                    aria-label="Open navigation menu"
                                    title="Open navigation menu"
                                >
                                    <Menu size={20} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navigate("/owner")}
                                    className="min-w-0 space-y-0.5 text-left cursor-pointer transition-opacity hover:opacity-80 focus:outline-none"
                                    title="Go to Dashboard"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <BrandLogo className="theme-brand-logo h-6 w-6 shrink-0" title="Tiffzy logo" />
                                        <h2 className="theme-brand-text text-lg sm:text-xl font-bold truncate">
                                            Tiffzy
                                        </h2>
                                    </div>
                                    <p className="theme-muted-strong text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs">
                                        Owner Panel
                                    </p>
                                </button>
                            </div>

                            {/* Right */}
                            <div className="flex shrink-0 items-center gap-2">
                                <p className="theme-muted max-w-[160px] truncate text-sm font-medium sm:max-w-[220px]">
                                    {restaurantName}
                                </p>
                                {access.orders && (
                                    <button
                                        type="button"
                                        onClick={() => navigate("/owner/billing")}
                                        className="theme-icon-button rounded-2xl p-2.5 sm:p-3"
                                        title="Open billing desk"
                                        aria-label="Open billing desk"
                                    >
                                        <ClipboardPlus size={18} />
                                    </button>
                                )}
                                {access.finance && (
                                    <button
                                        type="button"
                                        onClick={() => navigate("/owner/finance")}
                                        className="theme-icon-button rounded-2xl p-2.5 sm:p-3"
                                        title="Open finance"
                                        aria-label="Open finance page"
                                    >
                                        <Wallet size={18} />
                                    </button>
                                )}
                                {access.kitchen && (
                                    <button
                                        type="button"
                                        onClick={() => navigate("/owner/kitchen")}
                                        className="theme-icon-button rounded-2xl p-2.5 sm:p-3"
                                        title="Kitchen Operations"
                                        aria-label="Open Kitchen Operations"
                                    >
                                        <ChefHat size={18} />
                                    </button>
                                )}
                                {access.notifications && (
                                    <button
                                        onClick={() => navigate("/owner/notifications")}
                                        className="theme-icon-button relative rounded-2xl p-2.5 sm:p-3"
                                    >
                                        <Bell size={18} />
                                        {unreadCount > 0 && (
                                            <span className="theme-count-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none">
                                                {unreadCount > 99 ? "99+" : unreadCount}
                                            </span>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </header>
                )}

                {showTableAssignmentStrip && (
                    <div
                        className={`theme-nav border-b px-1 py-1.5 sm:px-2 w-full ${
                            isDashboardRoute
                                ? "flex-1 flex flex-col justify-start gap-3 min-h-[calc(100vh-65px)] min-h-[calc(100dvh-var(--dashboard-header-height,65px))]"
                                : ""
                        }`}
                        style={
                            isDashboardRoute
                                ? {
                                      minHeight: `calc(100dvh - ${dashboardHeaderHeight}px)`,
                                      "--dashboard-header-height": `${dashboardHeaderHeight}px`,
                                  }
                                : undefined
                        }
                    >
                        <div
                            className={
                                isDashboardRoute
                                    ? `flex-1 grid gap-4 ${
                                          showOnlineOrdersPanel ? "xl:grid-cols-4" : "xl:grid-cols-1"
                                      }`
                                    : "flex flex-col gap-2.5"
                            }
                        >
                            <div
                                className={
                                    isDashboardRoute
                                        ? `flex min-h-0 flex-1 flex-col gap-1.5 ${
                                              showOnlineOrdersPanel ? "xl:col-span-3" : "xl:col-span-1 w-full"
                                          }`
                                        : ""
                                }
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2 py-0">
                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm font-medium">
                                        <span className="inline-flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                                            <TableProperties size={15} />
                                            Tables: {tableOverview.total}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                            Occupied: {tableOverview.occupied}
                                        </span>
                                        {reservedTables > 0 && (
                                            <span className="inline-flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
                                                Reserved: {reservedTables}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1.5 font-bold theme-muted">
                                            Free: {freeTables}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-3 text-[11px]">
                                        {TABLE_STATE_LEGEND.map((stateKey) => {
                                            const stateClass = toTableStateClassToken(stateKey);
                                            return (
                                                <span
                                                    key={stateKey}
                                                    className={`theme-table-legend-item state-${stateClass} inline-flex items-center gap-1.5 font-semibold`}
                                                >
                                                    <span className="theme-table-legend-dot" />
                                                    {TABLE_STATE_LABELS[stateKey]}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div
                                    className={
                                        isDashboardRoute
                                            ? "flex min-h-0 flex-1 flex-col gap-1.5 pt-0.5"
                                            : "flex flex-col gap-1.5"
                                    }
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="theme-muted text-[11px] font-bold uppercase tracking-[0.2em]">
                                            Tables by Group
                                        </span>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {availableGroupNames.length > 1 && (
                                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveGroupFilter("All")}
                                                        className={`font-bold transition-all px-2.5 py-0.5 rounded-md ${
                                                            activeGroupFilter === "All"
                                                                ? "bg-[color:var(--app-primary)] text-white shadow-xs"
                                                                : "text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5"
                                                        }`}
                                                    >
                                                        All ({tableOverview.total})
                                                    </button>
                                                    {availableGroupNames.map((groupName) => {
                                                        const count = groupedTablesMap[groupName]?.length || 0;
                                                        const isSelected =
                                                            activeGroupFilter.toLowerCase() === groupName.toLowerCase();
                                                        return (
                                                            <button
                                                                key={groupName}
                                                                type="button"
                                                                onClick={() => setActiveGroupFilter(groupName)}
                                                                className={`font-bold transition-all px-2.5 py-0.5 rounded-md ${
                                                                    isSelected
                                                                        ? "bg-[color:var(--app-primary)] text-white shadow-xs"
                                                                        : "text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5"
                                                                }`}
                                                            >
                                                                {groupName} ({count})
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Zoom Control Buttons Beside Group Filters */}
                                            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-lg p-0.5 border border-[color:var(--app-border)]/40 shadow-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => changeTableZoom((prev) => prev - 10)}
                                                    disabled={tableZoom <= 40}
                                                    className="p-1 rounded-md text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-30"
                                                    title="Decrease table box size (Zoom Out)"
                                                    aria-label="Zoom Out"
                                                >
                                                    <ZoomOut size={14} />
                                                </button>
                                                <span className="text-[10px] font-extrabold px-1 min-w-[34px] text-center theme-muted select-none">
                                                    {tableZoom}%
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => changeTableZoom((prev) => prev + 10)}
                                                    disabled={tableZoom >= 180}
                                                    className="p-1 rounded-md text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-30"
                                                    title="Increase table box size (Zoom In)"
                                                    aria-label="Zoom In"
                                                >
                                                    <ZoomIn size={14} />
                                                </button>
                                                {tableZoom !== 100 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => changeTableZoom(100)}
                                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 hover:bg-orange-500 hover:text-white transition text-[color:var(--app-muted)]"
                                                        title="Reset size to 100%"
                                                    >
                                                        Reset
                                                    </button>
                                                )}
                                            </div>

                                            {/* Toggle Online Orders Column Button */}
                                            {isDashboardRoute && (
                                                <button
                                                    type="button"
                                                    onClick={toggleOnlineOrdersPanel}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition shadow-xs ${
                                                        showOnlineOrdersPanel
                                                            ? "border-[color:var(--app-border)]/40 bg-black/5 dark:bg-white/5 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]"
                                                            : "border-amber-500/40 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                                                    }`}
                                                    title={showOnlineOrdersPanel ? "Hide Live Orders Column" : "Show Live Orders Column"}
                                                >
                                                    {showOnlineOrdersPanel ? <EyeOff size={13} /> : <Eye size={13} />}
                                                    <span>{showOnlineOrdersPanel ? "Hide Panel" : "Live Orders"}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {tableOverview.loading ? (
                                        <span className="theme-muted text-xs">Loading tables...</span>
                                    ) : tableOverview.error ? (
                                        <div className="flex flex-col items-center justify-center p-6 text-center rounded-xl border border-red-500/20 bg-red-500/5 my-4 max-w-md mx-auto">
                                            <p className="text-sm font-bold text-red-500 mb-1">Unable to load tables</p>
                                            <p className="text-xs text-[color:var(--app-muted)] mb-3">
                                                We couldn't load the table layout right now.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTableOverview((prev) => ({ ...prev, loading: true, error: null }));
                                                    loadTableOverview();
                                                }}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition shadow-sm cursor-pointer"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    ) : tableOverview.tables.length === 0 ? (
                                        <span className="theme-muted text-xs">No tables found.</span>
                                    ) : (
                                        <div className="flex flex-col gap-2 pb-1">
                                            {filteredGroupEntries.map(([groupName, groupTables]) => {
                                                const occupiedInGroup = groupTables.filter((t) => t.isOccupied).length;
                                                const sectionHasActivePopover = groupTables.some((t) => {
                                                    const k = String(t.assignmentKey || t.key);
                                                    return (
                                                        openOrdersTableKey === k ||
                                                        openStaffTableKey === k ||
                                                        openMoreTableKey === k
                                                    );
                                                });
                                                return (
                                                    <section
                                                        key={groupName}
                                                        className={`relative flex flex-col gap-1 py-0 ${
                                                            sectionHasActivePopover ? "z-40" : "z-0"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--app-border)]/50 pb-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--app-primary)]">
                                                                    {groupName}
                                                                </span>
                                                                <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-bold theme-muted">
                                                                    {groupTables.length} table{groupTables.length === 1 ? "" : "s"}
                                                                </span>
                                                            </div>
                                                            {occupiedInGroup > 0 && (
                                                                <span className="text-[10px] font-bold text-emerald-500">
                                                                    {occupiedInGroup} occupied
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div
                                                            className={
                                                                isDashboardRoute
                                                                    ? "grid gap-3 sm:gap-4 w-full auto-rows-fr overflow-visible pt-1"
                                                                    : "flex flex-wrap gap-2 pt-1"
                                                            }
                                                            style={
                                                                isDashboardRoute
                                                                    ? {
                                                                          gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(
                                                                              50,
                                                                              Math.round(130 * (tableZoom / 100))
                                                                          )}px, 1fr))`,
                                                                      }
                                                                    : undefined
                                                            }
                                                        >
                                                            {groupTables.map((table) => {
                                                 const assignmentKey = String(
                                                     table.assignmentKey || (table.id ? `table-id-${table.id}` : table.key)
                                                 );
                                                 const idKey = table.id ? `table-id-${table.id}` : null;
                                                 const noKey = table.tableNo && restaurantId
                                                     ? `table-no-${restaurantId}-${String(table.tableNo).trim().toLowerCase()}`
                                                     : table.tableNo
                                                     ? `table-no-${String(table.tableNo).trim().toLowerCase()}`
                                                     : null;
                                                 const localAssigned = (idKey && tableAssignments[idKey]) ||
                                                                       (noKey && tableAssignments[noKey]) ||
                                                                       (assignmentKey && tableAssignments[assignmentKey]) ||
                                                                       "";
                                                 const isExplicitlyFree = table.status === "AVAILABLE" || table.isOccupied === false;
                                                 const assignedStaffId = isExplicitlyFree
                                                     ? (table.assignedWaiterId ? String(table.assignedWaiterId) : "")
                                                     : String(
                                                         table.assignedWaiterId ||
                                                         table.activeSession?.waiterId ||
                                                         localAssigned ||
                                                         ""
                                                     );
                                                 const fallbackStaffName = table.assignedWaiterName || table.activeSession?.waiterName || (assignedStaffId ? "Server" : "");
                                                 const assignedStaff = assignedStaffId
                                                     ? staffById.get(assignedStaffId) || { id: assignedStaffId, name: fallbackStaffName || `Server`, role: "STAFF" }
                                                     : null;
                                                const assignedStaffLabel = assignedStaff
                                                    ? getStaffDisplayLabel(assignedStaff)
                                                    : "";
                                                const isDropTarget =
                                                    Boolean(draggedStaffId) &&
                                                    dragOverTableKey === assignmentKey;
                                                const tableLabel = table.tableNo || "--";
                                                const occupiedFor = formatOccupiedDuration(
                                                    table.occupiedSince
                                                );
                                                const isOrdersOpen =
                                                    openOrdersTableKey === assignmentKey;
                                                const isStaffOpen =
                                                    openStaffTableKey === assignmentKey;
                                                const isMoreOpen = openMoreTableKey === assignmentKey;
                                                const activeOrders = Array.isArray(table.activeOrders)
                                                    ? table.activeOrders
                                                    : [];
                                                const tableReceiptTotal = activeOrders.reduce(
                                                    (sum, order) => sum + getReceiptOrderTotal(order),
                                                    0
                                                );
                                                const isCompletingThisTable =
                                                    completingTableKey === assignmentKey;
                                                const tableStateKey = resolveTableState(table, printedTableKeys);
                                                const tableCardBadge = resolveTableCardBadge(table, tableStateKey, printedTableKeys);
                                                const tableStateClassToken =
                                                    toTableStateClassToken(tableStateKey);
                                                const ordersPlacement = tablePopoverPlacement[`orders:${assignmentKey}`];
                                                const staffPlacement = tablePopoverPlacement[`staff:${assignmentKey}`];
                                                const morePlacement = tablePopoverPlacement[`more:${assignmentKey}`];

                                                const ordersPopoverYClass = toPopoverYClass(ordersPlacement || "bottom");
                                                const ordersPopoverXClass = toPopoverXClass(ordersPlacement);

                                                const staffPopoverYClass = toPopoverYClass(staffPlacement || "bottom");
                                                const staffPopoverXClass = toPopoverXClass(staffPlacement);

                                                const morePopoverYClass = toPopoverYClass(morePlacement || "bottom");
                                                const morePopoverXClass = toPopoverXClass(morePlacement);
                                                const openStaffSelector = (event) => {
                                                    event.stopPropagation();
                                                    setPopoverPlacementFor("staff", assignmentKey, event);
                                                    setOpenStaffTableKey((prev) =>
                                                        prev === assignmentKey ? "" : assignmentKey
                                                    );
                                                    setOpenOrdersTableKey("");
                                                    setOpenMoreTableKey("");
                                                    setReceiptActionError("");
                                                };

                                                const hasAnyPopoverOpen = isOrdersOpen || isStaffOpen || isMoreOpen;

                                                return (
                                                    <div
                                                        key={table.key}
                                                        data-table-card="true"
                                                        onDragOver={(event) =>
                                                            handleTableDragOver(event, assignmentKey)
                                                        }
                                                        onDragEnter={(event) =>
                                                            handleTableDragOver(event, assignmentKey)
                                                        }
                                                        onDragLeave={() =>
                                                            setDragOverTableKey((prev) =>
                                                                prev === assignmentKey ? "" : prev
                                                            )
                                                        }
                                                        onDrop={(event) =>
                                                            handleTableDrop(event, assignmentKey, table)
                                                        }
                                                        title={`Table ${tableLabel} - ${
                                                            table.isOccupied ? "Occupied" : "Free"
                                                        }${
                                                            assignedStaff
                                                                ? ` - Managed by ${assignedStaffLabel}`
                                                                : ""
                                                        }`}
                                                        className={`theme-table-box relative w-full aspect-square flex flex-col justify-between rounded-xl p-2 sm:p-2.5 text-xs transition-all duration-200 state-${tableStateClassToken} ${
                                                            table.isOccupied ? "is-occupied" : ""
                                                        } ${isDropTarget ? "is-drop-target" : ""} ${
                                                            hasAnyPopoverOpen
                                                                ? "z-[50] shadow-xl ring-2 ring-amber-500/50 !transform-none"
                                                                : "hover:-translate-y-0.5 z-1"
                                                        }`}
                                                        style={{
                                                            minHeight: `${Math.max(70, Math.round(110 * (tableZoom / 100)))}px`,
                                                            fontSize: `${Math.max(9, Math.round(12 * (tableZoom / 100)))}px`,
                                                        }}
                                                    >
                                                        <div className="flex h-full flex-col justify-between">
                                                            {/* Card Header: Table Number / Name + Actions */}
                                                            <div className="flex items-start justify-between gap-1">
                                                                <div className="min-w-0 flex-1">
                                                                    <p
                                                                        className="truncate font-extrabold leading-tight text-[color:var(--app-text)]"
                                                                        title={`Table ${tableLabel}`}
                                                                        style={{
                                                                            fontSize: `${Math.max(
                                                                                11,
                                                                                tableLabel.length > 6
                                                                                    ? Math.round(13 * (tableZoom / 100))
                                                                                    : tableLabel.length > 4
                                                                                    ? Math.round(16 * (tableZoom / 100))
                                                                                    : Math.round(19 * (tableZoom / 100))
                                                                            )}px`,
                                                                        }}
                                                                    >
                                                                        {tableLabel}
                                                                    </p>
                                                                </div>

                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {table.isOccupied && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                setPopoverPlacementFor(
                                                                                    "orders",
                                                                                    assignmentKey,
                                                                                    event
                                                                                );
                                                                                setOpenOrdersTableKey((prev) =>
                                                                                    prev === assignmentKey
                                                                                        ? ""
                                                                                        : assignmentKey
                                                                                );
                                                                                setOpenStaffTableKey("");
                                                                                setOpenMoreTableKey("");
                                                                                setReceiptActionError("");
                                                                            }}
                                                                            className="theme-table-meta-pill rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold leading-none transition hover:opacity-90 shrink-0"
                                                                            title={`Show orders for table ${tableLabel}`}
                                                                        >
                                                                            {table.activeOrderCount || 0} ord
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            setPopoverPlacementFor(
                                                                                "more",
                                                                                assignmentKey,
                                                                                event
                                                                            );
                                                                            setOpenMoreTableKey((prev) =>
                                                                                prev === assignmentKey
                                                                                    ? ""
                                                                                    : assignmentKey
                                                                            );
                                                                            setOpenOrdersTableKey("");
                                                                            setOpenStaffTableKey("");
                                                                        }}
                                                                        className="theme-table-icon-btn rounded-md p-1 transition hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
                                                                        title={`Actions for Table ${tableLabel}`}
                                                                        aria-label={`Table ${tableLabel} actions`}
                                                                    >
                                                                        <MoreHorizontal size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Card Center: Table Status Badge & Seats Indicator (ALWAYS VISIBLE!) */}
                                                            <div className="my-auto flex flex-col gap-1 py-0.5">
                                                                <div className="flex items-center gap-1 flex-wrap">
                                                                    <span
                                                                        className={`inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold ${tableCardBadge.className}`}
                                                                    >
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                                                                        <span>{tableCardBadge.label}</span>
                                                                    </span>

                                                                    <span
                                                                        className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-semibold theme-muted"
                                                                        title={`${table.seats || 4} seats capacity`}
                                                                    >
                                                                        <Users size={10} className="shrink-0" />
                                                                        <span>{table.seats || 4} seats</span>
                                                                    </span>
                                                                </div>

                                                                {(table.activeReservation || table.upcomingReservation) && (
                                                                    <p className="text-[9px] font-bold text-purple-600 dark:text-purple-300 truncate">
                                                                        {(table.activeReservation || table.upcomingReservation).customerName}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Card Footer: Assigned Server or Free State Indicator */}
                                                            <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[10px] pt-0.5">
                                                                {assignedStaff ? (
                                                                    <button
                                                                        type="button"
                                                                        draggable={true}
                                                                        onDragStart={(event) =>
                                                                            handleStaffDragStart(
                                                                                event,
                                                                                assignedStaff.id
                                                                            )
                                                                        }
                                                                        onClick={(event) => openStaffSelector(event)}
                                                                        className="theme-table-staff-pill inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:opacity-90 max-w-[100px] cursor-grab"
                                                                        title={`Assigned: ${assignedStaffLabel}`}
                                                                    >
                                                                        <span className="theme-table-staff-symbol inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-semibold leading-none shrink-0">
                                                                            {getStaffSymbol(assignedStaff, assignedStaffLabel)}
                                                                        </span>
                                                                        <span className="truncate">{getStaffName(assignedStaff)}</span>
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => openStaffSelector(event)}
                                                                        className="theme-table-meta-pill rounded-full px-1.5 py-0.5 transition hover:opacity-90 text-[9px] theme-muted"
                                                                        title={`Assign server for Table ${tableLabel}`}
                                                                    >
                                                                        + Server
                                                                    </button>
                                                                )}

                                                                {table.isOccupied ? (
                                                                    <span
                                                                        className="theme-table-time-pill inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0"
                                                                        title={`Occupied duration: ${occupiedFor || "just now"}`}
                                                                    >
                                                                        <Clock size={9} className="mr-0.5 shrink-0" />
                                                                        {occupiedFor || "just now"}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </div>

                                                        {table.isOccupied && (
                                                            <div className="absolute -bottom-2 left-1/2 z-10 -translate-x-1/2">
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setPopoverPlacementFor(
                                                                            "orders",
                                                                            assignmentKey,
                                                                            event
                                                                        );
                                                                        setOpenOrdersTableKey((prev) =>
                                                                            prev === assignmentKey
                                                                                ? ""
                                                                                : assignmentKey
                                                                        );
                                                                        setOpenStaffTableKey("");
                                                                        setOpenMoreTableKey("");
                                                                        setReceiptActionError("");
                                                                    }}
                                                                    className="theme-table-icon-btn rounded-full p-1 shadow-md transition bg-[color:var(--app-surface)] border border-[color:var(--app-border)]/50"
                                                                    title={`Show receipt for Table ${tableLabel}`}
                                                                >
                                                                    <Printer size={12} />
                                                                </button>
                                                            </div>
                                                        )}

                                                        {table.isOccupied && isOrdersOpen && (
                                                            <div
                                                                onClick={(event) => event.stopPropagation()}
                                                                onMouseDown={(event) => event.stopPropagation()}
                                                                className={`theme-table-popover absolute ${ordersPopoverXClass} ${ordersPopoverYClass} z-[100] w-72 sm:w-80 max-h-[min(380px,75vh)] overflow-y-auto rounded-xl p-2.5 text-[11px] shadow-2xl transition-all duration-150`}
                                                            >
                                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                                    <p className="font-semibold">
                                                                        Table {tableLabel} receipt
                                                                    </p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            setOpenOrdersTableKey("");
                                                                            setReceiptActionError("");
                                                                        }}
                                                                        className="theme-table-icon-btn rounded-md p-1 transition"
                                                                        title="Close receipt"
                                                                        aria-label={`Close receipt for table ${tableLabel}`}
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                                {activeOrders.length === 0 ? (
                                                                    <p className="theme-muted mt-1">
                                                                        No active orders for this table.
                                                                    </p>
                                                                ) : (
                                                                    <div className="mt-1.5 space-y-1.5">
                                                                        {activeOrders.map((order) => {
                                                                            const orderTotal =
                                                                                getReceiptOrderTotal(order);
                                                                            return (
                                                                                <div
                                                                                    key={`${table.key}-${order.id}`}
                                                                                    className="theme-table-order-row rounded-md px-2 py-1.5"
                                                                                >
                                                                                    <div className="flex items-start justify-between gap-2">
                                                                                        <div className="min-w-0">
                                                                                            <p className="font-medium flex items-center gap-1.5 flex-wrap">
                                                                                                <span>{order.orderNo ? order.orderNo : `#${order.id}`}</span>
                                                                                                <span className="theme-muted text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
                                                                                                    {order.status}
                                                                                                </span>
                                                                                            </p>
                                                                                            <div className="mt-1">
                                                                                                {String(order.paymentStatus || "").toUpperCase() === "PAID" || String(order.paymentStatus || "").toUpperCase() === "SUCCESS" ? (
                                                                                                    <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40">
                                                                                                        PAID
                                                                                                    </span>
                                                                                                ) : String(order.paymentStatus || "").toUpperCase() === "FAILED" ? (
                                                                                                    <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40">
                                                                                                        PAYMENT FAILED
                                                                                                    </span>
                                                                                                ) : String(order.paymentStatus || "").toUpperCase() === "CANCELLED" ? (
                                                                                                    <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40">
                                                                                                        PAYMENT CANCELLED
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                                                                                                        PAYMENT PENDING
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <p className="font-semibold shrink-0">
                                                                                            {formatReceiptAmount(orderTotal)}
                                                                                        </p>
                                                                                    </div>
                                                                                    {Array.isArray(order.items) &&
                                                                                    order.items.length > 0 ? (
                                                                                        <div className="mt-1 space-y-0.5">
                                                                                            {order.items.map((item) => {
                                                                                                const lineTotal =
                                                                                                    getReceiptItemLineTotal(
                                                                                                        item
                                                                                                    );
                                                                                                return (
                                                                                                    <div
                                                                                                        key={`${order.id}-${item.id}`}
                                                                                                        className="theme-muted flex items-center justify-between gap-2 text-[10px]"
                                                                                                    >
                                                                                                        <span className="truncate">
                                                                                                            {Number(
                                                                                                                item.qty || 0
                                                                                                            )}{" "}
                                                                                                            x{" "}
                                                                                                            {item.itemName ||
                                                                                                                "Item"}
                                                                                                        </span>
                                                                                                        <span>
                                                                                                            {formatReceiptAmount(
                                                                                                                lineTotal
                                                                                                            )}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <p className="theme-muted mt-1 text-[10px]">
                                                                                            No items found.
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        <div className="theme-table-order-row rounded-md px-2 py-1.5">
                                                                            <div className="flex items-center justify-between gap-2 text-[12px]">
                                                                                <span className="font-semibold">
                                                                                    Total Amount
                                                                                </span>
                                                                                <span className="font-semibold">
                                                                                    {formatReceiptAmount(
                                                                                        tableReceiptTotal
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {receiptActionError ? (
                                                                    <p className="mt-2 rounded-md border border-red-300/40 bg-red-500/10 px-2 py-1 text-[10px] text-red-200">
                                                                        {receiptActionError}
                                                                    </p>
                                                                ) : null}
                                                                {activeOrders.length > 0 ? (
                                                                    <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-[color:var(--app-border)]/40">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleReceiptPrint({
                                                                                    tableLabel,
                                                                                    activeOrders,
                                                                                    tableReceiptTotal,
                                                                                })
                                                                            }
                                                                            className="theme-soft-button rounded-md px-2 py-1 text-[10px] font-semibold"
                                                                            title="Print customer receipt (does not clear table)"
                                                                        >
                                                                            Print
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleSettleBill(
                                                                                    table,
                                                                                    assignmentKey,
                                                                                    "CASH"
                                                                                )
                                                                            }
                                                                            disabled={isCompletingThisTable}
                                                                            className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                                                                            title="Settle bill via Cash and release table"
                                                                        >
                                                                            {isCompletingThisTable ? "Settling..." : "Settle (Cash)"}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleSettleBill(
                                                                                    table,
                                                                                    assignmentKey,
                                                                                    "UPI"
                                                                                )
                                                                            }
                                                                            disabled={isCompletingThisTable}
                                                                            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 text-[10px] font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                                                                            title="Settle bill via UPI and release table"
                                                                        >
                                                                            UPI
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleFreeTable(
                                                                                    table,
                                                                                    assignmentKey,
                                                                                    { force: true }
                                                                                )
                                                                            }
                                                                            disabled={isCompletingThisTable}
                                                                            className="theme-button rounded-md px-2 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                                                            title="Force clear table"
                                                                        >
                                                                            Force Free
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        )}

                                                        {isStaffOpen && (
                                                            <div
                                                                onClick={(event) => event.stopPropagation()}
                                                                onMouseDown={(event) => event.stopPropagation()}
                                                                className={`theme-table-popover absolute ${staffPopoverXClass} ${staffPopoverYClass} z-[100] w-64 sm:w-72 max-h-[min(320px,75vh)] overflow-y-auto rounded-xl p-2.5 text-[11px] shadow-2xl transition-all duration-150`}
                                                            >
                                                                <p className="font-semibold">
                                                                    Assign server for table {tableLabel}
                                                                </p>
                                                                {staffOverview.loading ? (
                                                                    <p className="theme-muted mt-1">
                                                                        Loading staff...
                                                                    </p>
                                                                ) : staffOverview.users.length === 0 ? (
                                                                    <p className="theme-muted mt-1">
                                                                        No active staff found.
                                                                    </p>
                                                                ) : (
                                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                                        {staffOverview.users.map(
                                                                            (staffUser) => {
                                                                                const staffId = String(
                                                                                    staffUser.id || ""
                                                                                );
                                                                                const isSelected =
                                                                                    assignedStaffId === staffId;
                                                                                const isAssigningThisTable = Boolean(
                                                                                    table?.id && (
                                                                                        String(assigningTableId) === String(table.id) ||
                                                                                        assigningTableIdsRef.current.has(String(table.id))
                                                                                    )
                                                                                );
                                                                                return (
                                                                                    <button
                                                                                        key={`${assignmentKey}-${staffId}`}
                                                                                        type="button"
                                                                                        draggable={true}
                                                                                        onDragStart={(event) =>
                                                                                            handleStaffDragStart(
                                                                                                event,
                                                                                                staffUser.id
                                                                                            )
                                                                                        }
                                                                                        disabled={isAssigningThisTable}
                                                                                        onClick={() => {
                                                                                            if (isAssigningThisTable) return;
                                                                                            assignStaffToTable(
                                                                                                assignmentKey,
                                                                                                staffId,
                                                                                                table
                                                                                            );
                                                                                            setOpenStaffTableKey("");
                                                                                        }}
                                                                                        className={`theme-table-staff-option rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                                                                                            isSelected
                                                                                                ? "is-selected"
                                                                                                : ""
                                                                                        } ${
                                                                                            isAssigningThisTable
                                                                                                ? "opacity-50 cursor-not-allowed"
                                                                                                : "cursor-grab"
                                                                                        }`}
                                                                                    >
                                                                                        {getStaffName(
                                                                                            staffUser
                                                                                        )}
                                                                                    </button>
                                                                                );
                                                                            }
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {assignedStaff && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            clearTableAssignment(
                                                                                assignmentKey,
                                                                                table
                                                                            );
                                                                            setOpenStaffTableKey("");
                                                                        }}
                                                                        className="theme-table-remove-btn mt-2 rounded-md px-2 py-1 text-[10px] font-semibold transition"
                                                                    >
                                                                        Remove assigned server
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}

                                                        {isMoreOpen && (
                                                            <div
                                                                onClick={(event) => event.stopPropagation()}
                                                                onMouseDown={(event) => event.stopPropagation()}
                                                                className={`theme-table-popover absolute ${morePopoverXClass} ${morePopoverYClass} z-[100] w-52 max-h-[min(340px,75vh)] overflow-y-auto rounded-xl p-1.5 text-[11px] shadow-2xl transition-all duration-150`}
                                                                style={{ maxWidth: "calc(100vw - 32px)" }}
                                                            >
                                                                {/* Header Info */}
                                                                <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-[color:var(--app-border)]/40 text-[10px] theme-muted font-bold uppercase">
                                                                    <span>Table {tableLabel}</span>
                                                                    <span>{table.seats || 4} Seats</span>
                                                                </div>

                                                                {/* 1. Edit Table */}
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setOpenMoreTableKey("");
                                                                        setEditingTableModal({
                                                                            id: table.id,
                                                                            tableNo: table.tableNo,
                                                                            seats: table.seats || 4,
                                                                            groupName: getTableGroup(table) || "",
                                                                            isActive: table.isActive !== false,
                                                                        });
                                                                    }}
                                                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-black/5 dark:hover:bg-white/10 text-left cursor-pointer"
                                                                >
                                                                    <Edit2 size={13} className="text-amber-500 shrink-0" />
                                                                    <span>Edit Table</span>
                                                                </button>

                                                                {/* 2. Copy QR Link */}
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setOpenMoreTableKey("");
                                                                        copyQrLink(table);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-black/5 dark:hover:bg-white/10 text-left cursor-pointer"
                                                                >
                                                                    <Link2 size={13} className="text-blue-500 shrink-0" />
                                                                    <span>Copy QR Link</span>
                                                                </button>

                                                                {/* 3. Move Table */}
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setOpenMoreTableKey("");
                                                                        setMoveTableModal(table);
                                                                        setTargetMoveTableId("");
                                                                    }}
                                                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-black/5 dark:hover:bg-white/10 text-left cursor-pointer"
                                                                >
                                                                    <Move size={13} className="text-purple-500 shrink-0" />
                                                                    <span>Move Table</span>
                                                                </button>

                                                                {/* Reservation Info if present */}
                                                                {(table.activeReservation || table.upcomingReservation) && (
                                                                    <div className="my-1 rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-1.5 text-purple-700 dark:text-purple-300">
                                                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-75">
                                                                            Reservation Info
                                                                        </p>
                                                                        <p className="font-semibold truncate">
                                                                            {(table.activeReservation || table.upcomingReservation).customerName || "Guest"}
                                                                        </p>
                                                                        {(table.activeReservation || table.upcomingReservation).startTime && (
                                                                            <p className="text-[10px]">
                                                                                {(table.activeReservation || table.upcomingReservation).startTime} – {(table.activeReservation || table.upcomingReservation).endTime}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                <div className="my-1 border-t border-[color:var(--app-border)]/40" />

                                                                {/* Settle Bill if Occupied */}
                                                                {table.isOccupied && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            setOpenMoreTableKey("");
                                                                            handleSettleBill(table, assignmentKey, "CASH");
                                                                        }}
                                                                        disabled={isCompletingThisTable}
                                                                        className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-left cursor-pointer mb-1 disabled:opacity-60"
                                                                    >
                                                                        <CreditCard size={13} className="shrink-0" />
                                                                        <span>
                                                                            {isCompletingThisTable
                                                                                ? "Settling..."
                                                                                : "Settle Bill & Free"}
                                                                        </span>
                                                                    </button>
                                                                )}

                                                                {/* 4. Free Table */}
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setOpenMoreTableKey("");
                                                                        handleFreeTable(table, assignmentKey);
                                                                    }}
                                                                    disabled={isCompletingThisTable || (!table.isOccupied && (!table.activeOrders || table.activeOrders.length === 0) && !table.activeSession && !assignedStaff)}
                                                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-left cursor-pointer disabled:opacity-60"
                                                                >
                                                                    <Unlock size={13} className="shrink-0" />
                                                                    <span>
                                                                        {isCompletingThisTable
                                                                            ? "Freeing..."
                                                                            : table.isOccupied || (table.activeOrders && table.activeOrders.length > 0) || table.activeSession || assignedStaff
                                                                            ? "Free Table"
                                                                            : "Table Available"}
                                                                    </span>
                                                                </button>

                                                                {/* 5. Delete Table */}
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setOpenMoreTableKey("");
                                                                        handleDeleteTable(table);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-left cursor-pointer mt-1"
                                                                >
                                                                    <Trash2 size={13} className="shrink-0" />
                                                                    <span>Delete Table</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                                        </div>
                                                    </section>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {isDashboardRoute && showOnlineOrdersPanel && (
                                <aside className="border-l border-[color:var(--app-border)]/30 pl-4 pr-1 py-1 xl:col-span-1 xl:flex xl:h-full xl:flex-col">
                                    <div className="flex items-center justify-between gap-2 border-b border-[color:var(--app-border)]/50 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Globe2 size={16} className="text-amber-500" />
                                            <p className="text-xs font-extrabold uppercase tracking-[0.16em]">
                                                Live Orders
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => navigate("/owner/kitchen?tab=live")}
                                                className="theme-button rounded-lg px-2.5 py-1 text-xs font-semibold"
                                            >
                                                View all
                                            </button>
                                            <button
                                                type="button"
                                                onClick={toggleOnlineOrdersPanel}
                                                className="p-1.5 rounded-lg text-[color:var(--app-muted)] hover:text-amber-500 hover:bg-black/10 dark:hover:bg-white/10 transition"
                                                title="Hide Live Orders column"
                                                aria-label="Hide Live Orders panel"
                                            >
                                                <EyeOff size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-2.5 flex items-center justify-between text-xs text-[color:var(--app-muted)] font-semibold">
                                        <span>Active Orders</span>
                                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-500 text-[10px] font-bold">
                                            {stripOnlineOrders.length} active
                                        </span>
                                    </div>
                                    <div className="mt-2.5 space-y-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                                        {stripOnlineOrders.length === 0 ? (
                                            <div className="py-4 text-xs theme-muted text-center border-b border-[color:var(--app-border)]/20">
                                                No active live orders.
                                            </div>
                                        ) : (
                                            stripOnlineOrders.map((order) => {
                                                const orderTimeLabel = formatOrderTime(order.createdAt);
                                                const status = String(order.status || "PLACED").toUpperCase();
                                                const statusTone =
                                                    status === "READY"
                                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                                        : status === "PREPARING"
                                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                                        : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
                                                return (
                                                    <button
                                                        key={`${order.tableKey}-${order.id}`}
                                                        type="button"
                                                        onClick={() => setSelectedLiveOrder(order)}
                                                        className="theme-table-order-row block w-full rounded-xl border border-[color:var(--app-border)]/40 p-2.5 text-left transition duration-200 hover:border-amber-500/40 hover:bg-black/5 dark:hover:bg-white/5"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-xs font-bold">
                                                                    {order.orderNo ? order.orderNo : `#${order.id}`}
                                                                </p>
                                                                <p className="theme-muted mt-0.5 text-[11px]">
                                                                    Table {order.tableNo || "--"}
                                                                </p>
                                                                {orderTimeLabel ? (
                                                                    <p className="theme-muted text-[10px]">
                                                                        Time {orderTimeLabel}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${statusTone}`}>
                                                                {status}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2 flex items-center justify-between border-t border-[color:var(--app-border)]/30 pt-1.5 text-xs">
                                                            <span className="theme-muted text-[10px]">Total</span>
                                                            <span className="font-bold text-amber-500">
                                                                {formatReceiptAmount(getReceiptOrderTotal(order))}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </aside>
                            )}
                        </div>
                    </div>
                )}

                {/* Page */}
                <main
                    className={`w-full flex-1 px-2 sm:px-3 pt-1 pb-4 md:pb-6 ${
                        isDashboardRoute ? "hidden" : ""
                    } ${
                        isFullHeightWorkspaceRoute
                            ? "flex flex-col min-h-[calc(100vh-1rem)] min-h-[calc(100dvh-1rem)]"
                            : ""
                    }`}
                >
                    {visibleNavItems.length === 0 ? (
                        <div className="theme-panel rounded-2xl p-6 text-sm">
                            No modules are enabled for this account.
                        </div>
                    ) : canAccessCurrentRoute ? (
                        <Outlet context={{ setSidebarOpen, openSidebar: () => setSidebarOpen(true), restaurantId, user }} />
                    ) : null}
                </main>
                <Footer
                    className={
                        isDashboardRoute
                            ? "mt-0 border-t-0"
                            : isKitchenRoute || isInventoryRoute
                            ? "mt-0"
                            : "mt-20"
                    }
                />
            </div>
            {selectedLiveOrder && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-3 sm:p-5"
                    onClick={() => setSelectedLiveOrder(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Live order details"
                        className="theme-panel w-full max-w-2xl rounded-2xl p-4 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:p-5"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="theme-muted text-xs uppercase tracking-[0.2em]">
                                    Order Details
                                </p>
                                <h3 className="mt-1 text-lg font-semibold">
                                    {selectedLiveOrder.orderNo
                                        ? selectedLiveOrder.orderNo
                                        : `#${selectedLiveOrder.id}`}
                                </h3>
                                <p className="theme-muted mt-1 text-sm">
                                    Table {selectedLiveOrder.tableNo || "--"}
                                </p>
                                {formatOrderTime(selectedLiveOrder.createdAt) ? (
                                    <p className="theme-muted mt-0.5 text-sm">
                                        Time {formatOrderTime(selectedLiveOrder.createdAt)}
                                    </p>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${getOrderStatusTone(
                                        selectedLiveOrder.status
                                    )}`}
                                >
                                    {formatOrderStatusLabel(selectedLiveOrder.status)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedLiveOrder(null)}
                                    className="theme-soft-button inline-flex h-8 w-8 items-center justify-center rounded-full"
                                    aria-label="Close order details"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 max-h-[56vh] space-y-2 overflow-y-auto pr-1">
                            {selectedLiveOrderItems.length === 0 ? (
                                <div className="theme-table-order-row rounded-lg px-3 py-3 text-sm">
                                    No items found for this order.
                                </div>
                            ) : (
                                selectedLiveOrderItems.map((item, index) => {
                                    const qty = Math.max(1, Number(item?.qty || 1));
                                    const itemLabel = String(
                                        item?.itemName || `Item ${index + 1}`
                                    ).trim();
                                    const lineTotal = getReceiptItemLineTotal(item);
                                    const itemStatus = item?.status || selectedLiveOrder.status;
                                    return (
                                        <div
                                            key={item?.id || `${itemLabel}-${index}`}
                                            className="theme-table-order-row rounded-lg px-3 py-2.5"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold">
                                                        {qty} x {itemLabel || "Item"}
                                                    </p>
                                                    <p className="theme-muted mt-0.5 text-xs">
                                                        {formatReceiptAmount(Number(item?.price || 0))} each
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${getOrderStatusTone(
                                                            itemStatus
                                                        )}`}
                                                    >
                                                        {formatOrderStatusLabel(itemStatus)}
                                                    </span>
                                                    <p className="mt-1 text-sm font-semibold">
                                                        {formatReceiptAmount(lineTotal)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-3">
                            <p className="theme-muted text-sm">
                                {selectedLiveOrderItemCount} item
                                {selectedLiveOrderItemCount === 1 ? "" : "s"}
                            </p>
                            <p className="text-sm font-semibold">
                                Total {formatReceiptAmount(getReceiptOrderTotal(selectedLiveOrder))}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* REAL-TIME NEW ORDER POPUP ALERT */}
            <NewOrderPopup
                order={popupOrder}
                onClose={() => setPopupOrder(null)}
                onViewOrder={() => {
                    setPopupOrder(null);
                    navigate("/owner/orders");
                }}
            />

            {/* EDIT TABLE MODAL */}
            {editingTableModal && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
                    onClick={() => setEditingTableModal(null)}
                >
                    <div
                        className="theme-panel w-full max-w-md rounded-2xl p-5 shadow-2xl border border-[color:var(--app-border)]/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-[color:var(--app-border)]/40">
                            <div className="flex items-center gap-2">
                                <Edit2 size={16} className="text-amber-500" />
                                <h3 className="text-base font-bold text-[color:var(--app-text)]">
                                    Edit Table {editingTableModal.tableNo}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingTableModal(null)}
                                className="p-1 rounded-lg theme-muted hover:text-[color:var(--app-text)] cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!restaurantId || !editingTableModal.id) return;
                                setSubmittingEditTable(true);
                                try {
                                    const nextGroup = String(editingTableModal.groupName || "").trim();
                                    await axios.put(`${API}/owner/${restaurantId}/tables/${editingTableModal.id}`, {
                                        tableNo: editingTableModal.tableNo,
                                        seats: Number(editingTableModal.seats || 4),
                                        section: nextGroup || null,
                                        isActive: editingTableModal.isActive,
                                    });
                                    const nextTableGroups = { ...tableGroups };
                                    if (nextGroup) {
                                        nextTableGroups[String(editingTableModal.id)] = nextGroup;
                                    } else {
                                        delete nextTableGroups[String(editingTableModal.id)];
                                    }
                                    writeStoredTableGroups(restaurantId, nextTableGroups);
                                    setTableGroups(nextTableGroups);
                                    showToast({
                                        title: "Table Updated 🎉",
                                        message: `Table ${editingTableModal.tableNo} configuration saved successfully.`,
                                        variant: "success",
                                    });
                                    setEditingTableModal(null);
                                    await refreshTableOverview();
                                } catch (err) {
                                    showToast({
                                        title: "Update Failed",
                                        message: err.response?.data?.message || err.message || "Failed to update table.",
                                        variant: "error",
                                    });
                                } finally {
                                    setSubmittingEditTable(false);
                                }
                            }}
                            className="mt-4 space-y-3.5"
                        >
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider theme-muted mb-1">
                                    Table Number / Label
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editingTableModal.tableNo}
                                    onChange={(e) => setEditingTableModal({ ...editingTableModal, tableNo: e.target.value })}
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/50 bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)] outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider theme-muted mb-1">
                                    Seats (Capacity)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    required
                                    value={editingTableModal.seats}
                                    onChange={(e) => setEditingTableModal({ ...editingTableModal, seats: e.target.value })}
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/50 bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)] outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider theme-muted mb-1">
                                    Group / Section
                                </label>
                                <input
                                    type="text"
                                    list="existing-group-options"
                                    placeholder="e.g. Main Hall, Roof Top, Section T"
                                    value={editingTableModal.groupName}
                                    onChange={(e) => setEditingTableModal({ ...editingTableModal, groupName: e.target.value })}
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/50 bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)] outline-none focus:border-amber-500"
                                />
                                <datalist id="existing-group-options">
                                    {availableGroupNames.map((g) => (
                                        <option key={g} value={g} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="edit-table-active"
                                    checked={editingTableModal.isActive}
                                    onChange={(e) => setEditingTableModal({ ...editingTableModal, isActive: e.target.checked })}
                                    className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                                />
                                <label htmlFor="edit-table-active" className="text-xs font-semibold theme-muted cursor-pointer select-none">
                                    Table is Active & Available for Dining
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[color:var(--app-border)]/40">
                                <button
                                    type="button"
                                    onClick={() => setEditingTableModal(null)}
                                    className="rounded-xl px-4 py-2 text-xs font-bold theme-muted hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingEditTable}
                                    className="rounded-xl bg-[color:var(--app-primary)] px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingEditTable ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MOVE TABLE MODAL */}
            {moveTableModal && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
                    onClick={() => setMoveTableModal(null)}
                >
                    <div
                        className="theme-panel w-full max-w-md rounded-2xl p-5 shadow-2xl border border-[color:var(--app-border)]/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-[color:var(--app-border)]/40">
                            <div className="flex items-center gap-2">
                                <Move size={16} className="text-purple-500" />
                                <h3 className="text-base font-bold text-[color:var(--app-text)]">
                                    Move Table {moveTableModal.tableNo}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMoveTableModal(null)}
                                className="p-1 rounded-lg theme-muted hover:text-[color:var(--app-text)] cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mt-4 space-y-4">
                            <p className="text-xs theme-muted">
                                Transfer orders and dining session from Table{" "}
                                <strong className="text-[color:var(--app-text)]">{moveTableModal.tableNo}</strong> to a free table.
                            </p>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider theme-muted mb-1.5">
                                    Destination Table
                                </label>
                                <select
                                    value={targetMoveTableId}
                                    onChange={(e) => setTargetMoveTableId(e.target.value)}
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/50 bg-[color:var(--app-surface)] px-3 py-2.5 text-sm text-[color:var(--app-text)] outline-none focus:border-amber-500 cursor-pointer"
                                >
                                    <option value="">-- Choose destination table --</option>
                                    {tableOverview.tables
                                        .filter((t) => t.id !== moveTableModal.id)
                                        .map((t) => (
                                            <option key={t.id} value={t.id} disabled={t.isOccupied}>
                                                Table {t.tableNo} ({t.seats || 4} seats) - {t.isOccupied ? "Occupied" : "Free"}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[color:var(--app-border)]/40">
                                <button
                                    type="button"
                                    onClick={() => setMoveTableModal(null)}
                                    className="rounded-xl px-4 py-2 text-xs font-bold theme-muted hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!targetMoveTableId || submittingMoveTable}
                                    onClick={async () => {
                                        if (!restaurantId || !moveTableModal?.id || !targetMoveTableId) return;
                                        setSubmittingMoveTable(true);
                                        try {
                                            await axios.post(`${API}/owner/${restaurantId}/tables/${moveTableModal.id}/move`, {
                                                targetTableId: Number(targetMoveTableId),
                                            });
                                            showToast({
                                                title: "Table Moved 🎉",
                                                message: `Session moved to destination table.`,
                                                variant: "success",
                                            });
                                            setMoveTableModal(null);
                                            await refreshTableOverview();
                                        } catch (err) {
                                            showToast({
                                                title: "Move Failed",
                                                message: err.response?.data?.message || err.message || "Failed to move table.",
                                                variant: "error",
                                            });
                                        } finally {
                                            setSubmittingMoveTable(false);
                                        }
                                    }}
                                    className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingMoveTable ? "Moving..." : "Confirm Move"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
