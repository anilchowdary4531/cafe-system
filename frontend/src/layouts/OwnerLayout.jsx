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
    IndianRupee,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { resolveRestaurantName } from "../utils/restaurantContext";
import BrandLogo from "../components/BrandLogo";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { resolveEffectiveStaffRole } from "../utils/staffRole";
import { showToast } from "../utils/toast";
import tiffzyLogo from "../assets/tiffzy-logo.png";
import {
    getOwnerUnreadCount,
    subscribeOwnerNotifications,
} from "../utils/ownerNotifications";
import { API } from "../config";

const MODULES = [
    "dashboard",
    "orders",
    "menu",
    "tables",
    "kitchen",
    "analytics",
    "finance",
    "staff",
    "settings",
    "notifications",
];

const defaultAccessByRole = (role) => {
    const r = String(role || "OWNER").toUpperCase();

    if (r === "OWNER") {
        return MODULES.reduce((acc, key) => ({ ...acc, [key]: true }), {});
    }

    return {
        dashboard: true,
        orders: true,
        menu: true,
        tables: true,
        kitchen: true,
        analytics: true,
        finance: false,
        staff: false,
        settings: false,
        notifications: true,
    };
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

            return `
                <div class="order-block">
                    <div class="order-head">
                        <span>${escapeReceiptText(orderLabel)}</span>
                        <span>${escapeReceiptText(status)}</span>
                    </div>
                    <table>
                        <tbody>${itemsMarkup || `<tr><td colspan="2">No items found.</td></tr>`}</tbody>
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
        .map((table, index) => ({
            ...table,
            tableNo: String(table?.tableNo || "").trim(),
            isOccupied: Boolean(table?.isOccupied),
            occupiedSince: table?.occupiedSince || null,
            activeOrderCount: Number(table?.activeOrderCount || 0),
            activeItemCount: Number(table?.activeItemCount || 0),
            lastOrderStatus: String(table?.lastOrderStatus || "").toUpperCase(),
            lastPaymentStatus: String(table?.lastPaymentStatus || "").toUpperCase(),
            lastOrderNo: table?.lastOrderNo || "",
            lastOrderAt: table?.lastOrderAt || null,
            activeOrders: Array.isArray(table?.activeOrders)
                ? table.activeOrders.map((order) => ({
                      id: order?.id,
                      orderNo: order?.orderNo || "",
                      status: String(order?.status || "").toUpperCase(),
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
                : [],
            assignmentKey: table?.id
                ? `table-${table.id}`
                : `table-${String(table?.tableNo || "").trim().toLowerCase() || index}`,
            key: table?.id || `${table?.tableNo || "table"}-${index}`,
        }))
        .sort((a, b) =>
            String(a.tableNo || "").localeCompare(String(b.tableNo || ""), undefined, {
                numeric: true,
                sensitivity: "base",
            })
        );

const TABLE_STATE_KEYS = {
    BLANK: "BLANK_TABLE",
    RUNNING: "RUNNING_TABLE",
    PRINTED: "PRINTED_TABLE",
    PAID: "PAID_TABLE",
    RUNNING_KOT: "RUNNING_KOT_TABLE",
};

const TABLE_STATE_LABELS = {
    [TABLE_STATE_KEYS.BLANK]: "Blank Table",
    [TABLE_STATE_KEYS.RUNNING]: "Running Table",
    [TABLE_STATE_KEYS.PRINTED]: "Printed Table",
    [TABLE_STATE_KEYS.PAID]: "Paid Table",
    [TABLE_STATE_KEYS.RUNNING_KOT]: "Running KOT Table",
};

const TABLE_STATE_LEGEND = [
    TABLE_STATE_KEYS.BLANK,
    TABLE_STATE_KEYS.RUNNING,
    TABLE_STATE_KEYS.PRINTED,
    TABLE_STATE_KEYS.PAID,
    TABLE_STATE_KEYS.RUNNING_KOT,
];

const ACTIVE_KOT_STATUSES = new Set(["PREPARING", "READY"]);
const TABLE_STATE_RECENT_WINDOW_MS = 3 * 60 * 60 * 1000;

const toTableStateClassToken = (stateKey) =>
    String(stateKey || TABLE_STATE_KEYS.BLANK).toLowerCase().replace(/_/g, "-");

const resolveTableState = (table) => {
    const activeOrders = Array.isArray(table?.activeOrders) ? table.activeOrders : [];
    if (activeOrders.length > 0) {
        const hasRunningKot = activeOrders.some((order) =>
            ACTIVE_KOT_STATUSES.has(String(order?.status || "").toUpperCase())
        );
        return hasRunningKot ? TABLE_STATE_KEYS.RUNNING_KOT : TABLE_STATE_KEYS.RUNNING;
    }

    const lastOrderStatus = String(table?.lastOrderStatus || "").toUpperCase();
    const lastPaymentStatus = String(table?.lastPaymentStatus || "").toUpperCase();
    const lastOrderTime = new Date(table?.lastOrderAt || 0).getTime();
    const isRecentOrder =
        !Number.isNaN(lastOrderTime) &&
        Date.now() - lastOrderTime <= TABLE_STATE_RECENT_WINDOW_MS;

    if (isRecentOrder && lastPaymentStatus === "PAID") return TABLE_STATE_KEYS.PAID;
    if (isRecentOrder && lastOrderStatus === "DELIVERED") return TABLE_STATE_KEYS.PRINTED;
    return TABLE_STATE_KEYS.BLANK;
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
    });
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

    const { user, logout } = useAuth();
    const restaurantId = Number(user?.restaurantId || 0);

    const restaurantName = resolveRestaurantName(user, "Restaurant");

    const effectiveRole = useMemo(
        () => resolveEffectiveStaffRole(user?.role, user?.designation),
        [user?.designation, user?.role]
    );

    const access = useMemo(
        () => normalizeAccess(user?.access, effectiveRole),
        [effectiveRole, user?.access]
    );

    // logout is provided by AuthContext (clears cache + navigates with replace).

    const navItems = [
        {
            label: "Dashboard",
            path: "/owner",
            icon: <LayoutDashboard size={18} />,
            accessKey: "dashboard",
        },
        {
            label: "Billing Desk",
            path: "/admin/new-order",
            icon: <ClipboardPlus size={18} />,
            accessKey: "orders",
        },
        {
            label: "Live Orders",
            path: "/owner/orders",
            icon: <ShoppingBag size={18} />,
            accessKey: "orders",
        },
        {
            label: "Online Orders",
            path: "/owner/online-orders",
            icon: <Globe2 size={18} />,
            accessKey: "orders",
        },
        {
            label: "Menu Studio",
            path: "/owner/menu",
            icon: <UtensilsCrossed size={18} />,
            accessKey: "menu",
        },
        {
            label: "Tables & QR",
            path: "/owner/tables",
            icon: <TableProperties size={18} />,
            accessKey: "tables",
        },
        {
            label: "Kitchen Live",
            path: "/owner/kitchen",
            icon: <ChefHat size={18} />,
            accessKey: "kitchen",
        },
        {
            label: "Analytics",
            path: "/owner/analytics",
            icon: <BarChart3 size={18} />,
            accessKey: "analytics",
        },
        {
            label: "Pay Later",
            path: "/owner/pay-later",
            icon: <IndianRupee size={18} />,
            accessKey: "finance",
        },
        {
            label: "Staff",
            path: "/owner/staff",
            icon: <Users size={18} />,
            accessKey: "staff",
        },
        {
            label: "Profile",
            path: "/owner/settings",
            icon: <User size={18} />,
            accessKey: "settings",
        },
    ];

    const visibleNavItems = navItems.filter((item) => access[item.accessKey]);

    const firstAllowedPath = visibleNavItems[0]?.path || "/owner";

    const findRouteAccess = (pathname) =>
        navItems.find((item) =>
            item.path === "/owner"
                ? pathname === "/owner"
                : pathname.startsWith(item.path)
        );

    const canAccessCurrentRoute = (() => {
        const match = findRouteAccess(location.pathname);
        if (!match) return true;
        return access[match.accessKey];
    })();
    const hideTableAssignmentStripOn = [
        "/owner/menu",
        "/owner/notifications",
        "/owner/orders",
        "/owner/online-orders",
        "/owner/staff",
        "/owner/tables",
        "/owner/kitchen",
        "/owner/finance",
        "/owner/pay-later",
        "/owner/analytics",
        "/owner/settings",
    ];
    const showTableAssignmentStrip = !hideTableAssignmentStripOn.some((path) =>
        location.pathname.startsWith(path)
    );

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
        const syncUnread = () => setUnreadCount(getOwnerUnreadCount());
        syncUnread();
        const unsubscribe = subscribeOwnerNotifications(syncUnread);
        return unsubscribe;
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadTableOverview = async () => {
            if (!restaurantId) {
                if (!mounted) return;
                setTableOverview({
                    loading: false,
                    total: 0,
                    occupied: 0,
                    tables: [],
                });
                return;
            }

            try {
                const res = await axios.get(`${API}/owner/${restaurantId}/tables`);
                if (!mounted) return;

                const tables = normalizeTableRows(res.data);

                const occupied = tables.filter((table) => table.isOccupied).length;

                setTableOverview({
                    loading: false,
                    total: tables.length,
                    occupied,
                    tables,
                });
            } catch (err) {
                if (!mounted) return;
                setTableOverview((prev) => ({
                    ...prev,
                    loading: false,
                }));
            }
        };

        loadTableOverview();
        const intervalId = setInterval(loadTableOverview, 20000);

        return () => {
            mounted = false;
            clearInterval(intervalId);
        };
    }, [restaurantId]);

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

                const users = (Array.isArray(res.data?.users) ? res.data.users : [])
                    .filter(
                        (staffUser) =>
                            String(staffUser?.role || "").toUpperCase() !== "OWNER" &&
                            Boolean(staffUser?.isActive)
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

        try {
            const raw = localStorage.getItem(getTableStaffStorageKey(restaurantId));
            if (!raw) {
                setTableAssignments({});
                setAssignmentsHydrated(true);
                return;
            }

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                setTableAssignments({});
                setAssignmentsHydrated(true);
                return;
            }

            const normalized = Object.entries(parsed).reduce((acc, [tableKey, staffId]) => {
                if (!tableKey) return acc;
                acc[String(tableKey)] = String(staffId || "");
                return acc;
            }, {});
            setTableAssignments(normalized);
            setAssignmentsHydrated(true);
        } catch {
            setTableAssignments({});
            setAssignmentsHydrated(true);
        }
    }, [restaurantId]);

    useEffect(() => {
        if (!restaurantId || !assignmentsHydrated) return;
        try {
            localStorage.setItem(
                getTableStaffStorageKey(restaurantId),
                JSON.stringify(tableAssignments)
            );
        } catch {
            // Ignore localStorage write failures.
        }
    }, [assignmentsHydrated, restaurantId, tableAssignments]);

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

    useEffect(() => {
        if (!assignmentsHydrated || staffOverview.loading || tableOverview.loading) return;

        const validTableKeys = new Set(
            tableOverview.tables.map((table) => String(table.assignmentKey || table.key))
        );
        const validStaffIds = new Set(staffOverview.users.map((staffUser) => String(staffUser.id)));

        setTableAssignments((prev) => {
            if (!prev || typeof prev !== "object") return {};

            let changed = false;
            const next = {};

            Object.entries(prev).forEach(([tableKey, staffId]) => {
                const normalizedStaffId = String(staffId || "");
                if (
                    validTableKeys.has(tableKey) &&
                    validStaffIds.has(normalizedStaffId) &&
                    tableOccupiedByKey.get(tableKey)
                ) {
                    next[tableKey] = normalizedStaffId;
                } else {
                    changed = true;
                }
            });

            if (!changed && Object.keys(next).length === Object.keys(prev).length) {
                return prev;
            }
            return next;
        });
    }, [
        assignmentsHydrated,
        staffOverview.loading,
        staffOverview.users,
        tableOverview.loading,
        tableOverview.tables,
        tableOccupiedByKey,
    ]);

    const assignedTableCountByStaff = useMemo(() => {
        const counts = {};
        Object.values(tableAssignments).forEach((staffId) => {
            const key = String(staffId || "");
            if (!key) return;
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [tableAssignments]);

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

    const handleTableDrop = (event, tableKey) => {
        event.preventDefault();
        if (!tableOccupiedByKey.get(tableKey)) {
            setDragOverTableKey("");
            setDraggedStaffId("");
            return;
        }
        const droppedStaffId = String(
            event.dataTransfer.getData("text/plain") || draggedStaffId || ""
        ).trim();

        if (!droppedStaffId || !staffById.has(droppedStaffId)) {
            setDragOverTableKey("");
            setDraggedStaffId("");
            return;
        }

        setTableAssignments((prev) => ({
            ...prev,
            [tableKey]: droppedStaffId,
        }));
        setDragOverTableKey("");
        setDraggedStaffId("");
    };

    const clearTableAssignment = (tableKey) => {
        setTableAssignments((prev) => {
            if (!prev?.[tableKey]) return prev;
            const next = { ...prev };
            delete next[tableKey];
            return next;
        });
    };

    const assignStaffToTable = (tableKey, staffId) => {
        const normalizedStaffId = String(staffId || "").trim();
        if (!normalizedStaffId || !staffById.has(normalizedStaffId)) return;
        if (!tableOccupiedByKey.get(tableKey)) return;

        setTableAssignments((prev) => ({
            ...prev,
            [tableKey]: normalizedStaffId,
        }));
    };

    const refreshTableOverview = async () => {
        if (!restaurantId) return;
        const res = await axios.get(`${API}/owner/${restaurantId}/tables`);
        const tables = normalizeTableRows(res.data);
        const occupied = tables.filter((table) => table.isOccupied).length;
        setTableOverview({
            loading: false,
            total: tables.length,
            occupied,
            tables,
        });
    };

    const handleReceiptPrint = ({ tableLabel, activeOrders, tableReceiptTotal } = {}) => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

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

    const handleFreeTable = async (table, assignmentKey) => {
        const activeOrders = Array.isArray(table?.activeOrders) ? table.activeOrders : [];
        const hasAssignment = Boolean(tableAssignments[assignmentKey]);
        if ((!activeOrders.length && !hasAssignment) || !restaurantId) {
            setOpenOrdersTableKey("");
            setOpenMoreTableKey("");
            showToast({
                title: "Table already free",
                message: `Table ${table?.tableNo || "--"} is already free.`,
                variant: "info",
            });
            return;
        }

        setCompletingTableKey(assignmentKey);
        setReceiptActionError("");
        try {
            await Promise.all(
                activeOrders.map((order) =>
                    axios.put(
                        `${API}/owner/${restaurantId}/orders/${order.id}/status`,
                        {
                            status: "DELIVERED",
                            changedByName: user?.name || "Owner",
                        }
                    )
                )
            );
            if (hasAssignment) {
                clearTableAssignment(assignmentKey);
            }
            await refreshTableOverview();
            setOpenOrdersTableKey("");
            setOpenStaffTableKey("");
            setOpenMoreTableKey("");
            showToast({
                title: "Table freed",
                message: `Table ${table?.tableNo || "--"} is now free.`,
                variant: "success",
            });
        } catch (err) {
            console.log(err);
            setReceiptActionError(
                err?.response?.data?.message || "Failed to free the table."
            );
        } finally {
            setCompletingTableKey("");
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

    const freeTables = Math.max(0, tableOverview.total - tableOverview.occupied);
    const isDashboardRoute = location.pathname === "/owner";
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
        if (!isDashboardRoute) return "bottom";
        const trigger = event?.currentTarget;
        if (!trigger || typeof trigger.closest !== "function") return "bottom";
        const tableCard = trigger.closest("[data-table-card='true']");
        if (!tableCard || typeof tableCard.getBoundingClientRect !== "function") {
            return "bottom";
        }

        const rect = tableCard.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const edgePadding = 16;
        const spaceBelow = viewportHeight - rect.bottom - edgePadding;
        const spaceAbove = rect.top - edgePadding;

        const expectedHeightByKind = {
            orders: 288,
            staff: 220,
            more: 124,
        };
        const requiredHeight = expectedHeightByKind[kind] || 180;

        if (spaceBelow >= requiredHeight) return "bottom";
        if (spaceAbove >= requiredHeight) return "top";
        return spaceBelow >= spaceAbove ? "bottom" : "top";
    };

    const setPopoverPlacementFor = (kind, assignmentKey, event) => {
        const placement = resolvePopoverPlacement(event, kind);
        setTablePopoverPlacement((prev) => ({
            ...prev,
            [`${kind}:${assignmentKey}`]: placement,
        }));
    };

    const toPopoverYClass = (placement) =>
        placement === "top" ? "bottom-full mb-2" : "top-full mt-2";

    return (
        <div className="theme-page flex min-h-screen overflow-x-hidden">
            {/* Backdrop Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/70"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 left-0 bottom-0 z-50
          w-64 sm:w-72
          theme-sidebar border-r
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
            >
                <div className="h-full flex flex-col p-5 overflow-y-auto">
                    {/* Logo */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-2">
                            <BrandLogo className="theme-brand-logo h-9 w-9" title="Tiffzy logo" />
                            <h1 className="theme-brand-text text-2xl font-bold sm:text-3xl">Tiffzy</h1>
                        </div>

                        <button
                            className="theme-icon-button block rounded-xl p-2"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Nav */}
                    <div className="space-y-2">
                        {visibleNavItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === "/owner"}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
                                        isActive
                                            ? "theme-nav-item-active"
                                            : "theme-nav-item"
                                    }`
                                }
                            >
                                <span className="relative">
                                    {item.icon}
                                    {item.path === "/owner/notifications" && unreadCount > 0 && (
                                        <span className="theme-count-badge absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none">
                                            {unreadCount > 99 ? "99+" : unreadCount}
                                        </span>
                                    )}
                                </span>
                                <span className="text-sm sm:text-base">{item.label}</span>
                            </NavLink>
                        ))}
                    </div>

                {/* Logout */}
                <button
                    type="button"
                    onClick={logout}
                    className="mt-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                    <LogOut size={18} />
                    Logout
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className="flex min-h-screen min-w-0 flex-1 flex-col">
                {/* Header */}
                <header className="theme-nav border-b px-3 py-3 sm:px-4 md:px-6">
                    <div className="flex items-center justify-between gap-3">
                        {/* Left */}
                        <div className="flex items-start gap-3 min-w-0">
                            <button
                                className="theme-icon-button theme-icon-button-primary block shrink-0 rounded-xl p-2.5 shadow-lg"
                                onClick={() => setSidebarOpen((prev) => !prev)}
                            >
                                <Menu size={20} />
                            </button>

                            <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <BrandLogo className="theme-brand-logo h-6 w-6 shrink-0" title="Tiffzy logo" />
                                    <h2 className="theme-brand-text text-lg sm:text-xl font-bold truncate">
                                        Tiffzy
                                    </h2>
                                </div>
                                <p className="theme-muted-strong text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs">
                                    Owner Panel
                                </p>
                            </div>
                        </div>

                        {/* Right */}
                        <div className="flex shrink-0 items-center gap-2">
                            <p className="theme-muted max-w-[160px] truncate text-sm font-medium sm:max-w-[220px]">
                                {restaurantName}
                            </p>
                            {access.orders && (
                                <button
                                    type="button"
                                    onClick={() => navigate("/admin/new-order")}
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

                {showTableAssignmentStrip && (
                    <div
                        className={`theme-nav border-b px-3 py-3 sm:px-4 md:px-6 ${
                            isDashboardRoute ? "flex-1 min-h-[80vh] flex flex-col justify-start gap-4" : ""
                        }`}
                    >
                        <div
                            className={
                                isDashboardRoute ? "grid min-h-[80vh] h-full gap-4 xl:grid-cols-4" : "flex flex-col gap-2.5"
                            }
                        >
                            <div
                                className={
                                    isDashboardRoute
                                        ? "flex min-h-0 flex-col gap-3 xl:col-span-3"
                                        : ""
                                }
                            >
                                <div className="theme-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_94%,#000_6%)] p-3 sm:p-4 shadow-sm">
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 font-bold text-amber-400">
                                            <TableProperties size={15} />
                                            Tables: {tableOverview.total}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 font-bold text-emerald-400">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                            Occupied: {tableOverview.occupied}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-500/25 bg-slate-500/10 px-3 py-1.5 font-bold text-slate-300">
                                            Free: {freeTables}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2 text-[10px]">
                                        {TABLE_STATE_LEGEND.map((stateKey) => {
                                            const stateClass = toTableStateClassToken(stateKey);
                                            return (
                                                <span
                                                    key={stateKey}
                                                    className={`theme-table-legend-item state-${stateClass} inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold`}
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
                                            ? "flex min-h-0 flex-1 flex-col gap-2 pt-2"
                                            : "flex flex-col gap-1.5"
                                    }
                                >
                                    <span className="theme-muted mr-1 text-[11px] font-bold uppercase tracking-[0.2em]">
                                        Tables
                                    </span>
                                    {tableOverview.loading ? (
                                        <span className="theme-muted text-xs">Loading tables...</span>
                                    ) : tableOverview.tables.length === 0 ? (
                                        <span className="theme-muted text-xs">No tables found.</span>
                                    ) : (
                                        <div
                                            className={
                                                isDashboardRoute
                                                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 w-full auto-rows-fr overflow-visible pb-4"
                                                    : "flex flex-wrap gap-2 pb-3"
                                            }
                                        >
                                            {tableOverview.tables.map((table) => {
                                                const assignmentKey = String(
                                                    table.assignmentKey || table.key
                                                );
                                                const assignedStaffId = String(
                                                    tableAssignments[assignmentKey] || ""
                                                );
                                                const assignedStaff = assignedStaffId
                                                    ? staffById.get(assignedStaffId)
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
                                                const tableStateKey = resolveTableState(table);
                                                const tableStateClassToken =
                                                    toTableStateClassToken(tableStateKey);
                                                const ordersPopoverYClass = toPopoverYClass(
                                                    tablePopoverPlacement[`orders:${assignmentKey}`] ||
                                                        "bottom"
                                                );
                                                const staffPopoverYClass = toPopoverYClass(
                                                    tablePopoverPlacement[`staff:${assignmentKey}`] ||
                                                        "bottom"
                                                );
                                                const morePopoverYClass = toPopoverYClass(
                                                    tablePopoverPlacement[`more:${assignmentKey}`] ||
                                                        "bottom"
                                                );
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
                                                            handleTableDrop(event, assignmentKey)
                                                        }
                                                        title={`Table ${tableLabel} - ${
                                                            table.isOccupied ? "Occupied" : "Free"
                                                        }${
                                                            assignedStaff
                                                                ? ` - Managed by ${assignedStaffLabel}`
                                                                : ""
                                                        }`}
                                                        className={`theme-table-box relative w-full min-h-[220px] sm:min-h-[260px] flex flex-col justify-between rounded-2xl p-4 sm:p-5 pb-9 text-xs transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 state-${tableStateClassToken} ${
                                                            table.isOccupied ? "is-occupied" : ""
                                                        } ${isDropTarget ? "is-drop-target" : ""}`}
                                                    >
                                                        <div className="flex h-full flex-col justify-between">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="truncate text-2xl sm:text-3xl font-extrabold leading-none">
                                                                            {tableLabel}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-1">
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
                                                                            className="theme-table-meta-pill rounded-full px-2 py-0.5 text-[10px] leading-none transition hover:opacity-90"
                                                                            title={`Show orders for table ${tableLabel}`}
                                                                        >
                                                                            {table.activeOrderCount || 0} order
                                                                            {Number(table.activeOrderCount || 0) ===
                                                                            1
                                                                                ? ""
                                                                                : "s"}
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
                                                                        className="theme-table-icon-btn rounded-md p-1.5 transition"
                                                                        title={`More options for table ${tableLabel}`}
                                                                    >
                                                                        <MoreHorizontal size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {table.isOccupied && (
                                                                <div className="mt-auto flex items-end justify-start gap-1 pr-16 text-[10px]">
                                                                    {assignedStaff ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(event) =>
                                                                                openStaffSelector(event)
                                                                            }
                                                                            className="theme-table-staff-pill inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition hover:opacity-90"
                                                                            title={`Change server for table ${tableLabel}`}
                                                                        >
                                                                            <span className="theme-table-staff-symbol inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold leading-none">
                                                                                {getStaffSymbol(
                                                                                    assignedStaff,
                                                                                    assignedStaffLabel
                                                                                )}
                                                                            </span>
                                                                            <span className="max-w-[120px] truncate">
                                                                                {getStaffName(assignedStaff)}
                                                                            </span>
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(event) =>
                                                                                openStaffSelector(event)
                                                                            }
                                                                            className="theme-table-meta-pill rounded-full px-2 py-0.5 transition hover:opacity-90"
                                                                            title={`Assign server for table ${tableLabel}`}
                                                                        >
                                                                            No server
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {table.isOccupied && (
                                                            <div className="pointer-events-none absolute bottom-2 right-2 z-10">
                                                                <span className="theme-table-time-pill inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                                                    {occupiedFor || "just now"}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {table.isOccupied && (
                                                            <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
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
                                                                    className="theme-table-icon-btn rounded-md p-1.5 transition"
                                                                    title={`Show receipt for table ${tableLabel}`}
                                                                >
                                                                    <Printer size={14} />
                                                                </button>
                                                            </div>
                                                        )}

                                                        {table.isOccupied && isOrdersOpen && (
                                                            <div
                                                                className={`theme-table-popover absolute left-0 z-20 w-72 rounded-xl p-2 text-[11px] transition-all duration-150 ${ordersPopoverYClass}`}
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
                                                                                        <p className="font-medium">
                                                                                            {order.orderNo
                                                                                                ? order.orderNo
                                                                                                : `#${order.id}`}
                                                                                            <span className="theme-muted ml-1 text-[10px] uppercase">
                                                                                                {order.status}
                                                                                            </span>
                                                                                        </p>
                                                                                        <p className="font-semibold">
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
                                                                    <div className="mt-2 flex items-center justify-end gap-1.5">
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
                                                                        >
                                                                            Print
                                                                        </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                handleFreeTable(
                                                                                    table,
                                                                                    assignmentKey
                                                                                )
                                                                            }
                                                                            disabled={isCompletingThisTable}
                                                                            className="theme-button rounded-md px-2 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                                                        >
                                                                            {isCompletingThisTable
                                                                                ? "Completing..."
                                                                                : "Done"}
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        )}

                                                        {table.isOccupied && isStaffOpen && (
                                                            <div
                                                                className={`theme-table-popover absolute left-0 z-20 w-64 rounded-xl p-2 text-[11px] transition-all duration-150 ${staffPopoverYClass}`}
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
                                                                                return (
                                                                                    <button
                                                                                        key={`${assignmentKey}-${staffId}`}
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            assignStaffToTable(
                                                                                                assignmentKey,
                                                                                                staffId
                                                                                            )
                                                                                        }
                                                                                        className={`theme-table-staff-option rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                                                                                            isSelected
                                                                                                ? "is-selected"
                                                                                                : ""
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
                                                                        onClick={() =>
                                                                            clearTableAssignment(
                                                                                assignmentKey
                                                                            )
                                                                        }
                                                                        className="theme-table-remove-btn mt-2 rounded-md px-2 py-1 text-[10px] font-semibold transition"
                                                                    >
                                                                        Remove assigned server
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}

                                                        {isMoreOpen && (
                                                            <div
                                                                className={`theme-table-popover absolute right-0 z-20 w-44 rounded-xl p-2 text-[11px] transition-all duration-150 ${morePopoverYClass}`}
                                                            >
                                                                <div className="theme-table-order-row rounded-md px-2 py-1.5">
                                                                    <p className="theme-muted text-[10px] uppercase tracking-[0.08em]">
                                                                        Seats
                                                                    </p>
                                                                    <p className="font-semibold">
                                                                        {table.seats} seat
                                                                        {Number(table.seats || 0) === 1
                                                                            ? ""
                                                                            : "s"}
                                                                    </p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        handleFreeTable(table, assignmentKey);
                                                                    }}
                                                                    disabled={isCompletingThisTable}
                                                                    className="theme-table-remove-btn mt-2 w-full rounded-md px-2 py-1 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                                                                >
                                                                    {isCompletingThisTable
                                                                        ? "Freeing..."
                                                                        : "Free table"}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {isDashboardRoute && (
                                <aside className="theme-panel rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_94%,#000_6%)] p-4 shadow-sm xl:col-span-1 xl:flex xl:h-full xl:flex-col">
                                    <div className="flex items-center justify-between gap-2 border-b border-[color:var(--app-border)] pb-3">
                                        <div className="flex items-center gap-2">
                                            <Globe2 size={16} className="text-amber-400" />
                                            <p className="text-sm font-bold uppercase tracking-[0.14em]">
                                                Online Orders
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => navigate("/owner/online-orders")}
                                            className="theme-button rounded-xl px-2.5 py-1 text-xs font-semibold"
                                        >
                                            View all
                                        </button>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--app-muted)] font-semibold">
                                        <span>Active Orders</span>
                                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300 text-[10px] font-bold">
                                            {stripOnlineOrders.length} active
                                        </span>
                                    </div>
                                    <div className="mt-3 space-y-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                                        {stripOnlineOrders.length === 0 ? (
                                            <div className="theme-table-order-row rounded-xl px-3 py-3 text-xs theme-muted text-center">
                                                No active online orders.
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
                                                        className="theme-table-order-row block w-full rounded-2xl border border-[color:var(--app-border)] p-3 text-left transition duration-200 hover:border-amber-500/40 hover:bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_85%,#000_15%)]"
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
                                                        <div className="mt-2 flex items-center justify-between border-t border-[color:var(--app-border)] pt-2 text-xs">
                                                            <span className="theme-muted text-[10px]">Total</span>
                                                            <span className="font-bold text-amber-400">
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
                <main className={`p-3 sm:p-4 md:p-6 ${isDashboardRoute ? "hidden" : ""}`}>
                    {visibleNavItems.length === 0 ? (
                        <div className="theme-panel rounded-2xl p-6 text-sm">
                            No modules are enabled for this account.
                        </div>
                    ) : canAccessCurrentRoute ? (
                        <Outlet />
                    ) : null}
                </main>
                <Footer />
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
        </div>
    );
}
