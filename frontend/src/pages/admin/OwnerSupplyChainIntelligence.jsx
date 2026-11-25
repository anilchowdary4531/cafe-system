import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";
import {
    AlertCircle,
    ArrowDownRight,
    ArrowUpDown,
    ArrowUpRight,
    BarChart3,
    Building2,
    CheckCircle2,
    Clock,
    Filter,
    Globe,
    Info,
    Package,
    RefreshCcw,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Truck,
    Warehouse,
    X,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const DATE_PRESETS = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "custom", label: "Custom" },
];

const PAGE_TABS = [
    { id: "overview", label: "Overview" },
    { id: "supplier", label: "Supplier" },
    { id: "controls", label: "Controls" },
];

const TOP_SUPPLIER_METRICS = [
    { id: "spend", label: "Spend" },
    { id: "savingsPct", label: "Savings %" },
    { id: "leadTimeDays", label: "Lead Time" },
    { id: "esgScore", label: "ESG Score" },
];

const REFRESH_MS = 30000;
const SCORECARD_PAGE_SIZE = 5;
const REGION_COLORS = ["#f97316", "#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#64748b"];

const formatMoney = (val) =>
    `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCompactMoney = (val) =>
    `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const formatPct = (val) => `${Number(val || 0).toFixed(1)}%`;

function getSupplierDisplayName(supplier, fallbackId) {
    if (!supplier) return fallbackId ? `Supplier #${fallbackId}` : "Unknown Supplier";
    return (
        supplier.profile?.businessName ||
        supplier.profile?.companyName ||
        supplier.name ||
        (supplier.id ? `Supplier #${supplier.id}` : "Unknown Supplier")
    );
}

function getDeliveredTimestamp(order) {
    const events = Array.isArray(order?.statusEvents) ? order.statusEvents : [];
    const deliveredEvent = events.find((ev) => {
        const st = String(ev?.status || "").toUpperCase();
        return st === "DELIVERED" || st === "COMPLETED" || st === "RECEIVED";
    });
    if (deliveredEvent?.createdAt) return new Date(deliveredEvent.createdAt);
    const orderStatus = String(order?.status || "").toUpperCase();
    if ((orderStatus === "DELIVERED" || orderStatus === "COMPLETED") && order?.updatedAt) {
        return new Date(order.updatedAt);
    }
    return null;
}

function isOrderCancelled(order) {
    const st = String(order?.status || "").toUpperCase();
    return st === "CANCELLED" || st === "REJECTED";
}

function getPeriodBounds(range, customStartDate, customEndDate) {
    const now = new Date();
    let cStart = new Date(now);
    let cEnd = new Date(now);
    let pStart = new Date(now);
    let pEnd = new Date(now);

    if (range === "today") {
        cStart.setHours(0, 0, 0, 0);
        pStart = new Date(cStart.getTime() - 24 * 60 * 60 * 1000);
        pEnd = new Date(cStart.getTime() - 1);
    } else if (range === "yesterday") {
        cStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        cStart.setHours(0, 0, 0, 0);
        cEnd = new Date(cStart);
        cEnd.setHours(23, 59, 59, 999);
        pStart = new Date(cStart.getTime() - 24 * 60 * 60 * 1000);
        pEnd = new Date(cStart.getTime() - 1);
    } else if (range === "30d") {
        cStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        pStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        pEnd = new Date(cStart.getTime() - 1);
    } else if (range === "custom" && customStartDate && customEndDate) {
        cStart = new Date(`${customStartDate}T00:00:00`);
        cEnd = new Date(`${customEndDate}T23:59:59.999`);
        const duration = Math.max(86400000, cEnd.getTime() - cStart.getTime());
        pEnd = new Date(cStart.getTime() - 1);
        pStart = new Date(pEnd.getTime() - duration);
    } else {
        cStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        pStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        pEnd = new Date(cStart.getTime() - 1);
    }

    return { cStart, cEnd, pStart, pEnd };
}

export default function OwnerSupplyChainIntelligence() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const range = searchParams.get("range") || "7d";
    const startDateParam = searchParams.get("startDate") || "";
    const endDateParam = searchParams.get("endDate") || "";

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = user?.restaurantId ? Number(user.restaurantId) : null;

    // UI & Navigation State
    const [activeSectionTab, setActiveSectionTab] = useState("overview");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [error, setError] = useState("");
    const [partialWarnings, setPartialWarnings] = useState([]);

    // Chart View Toggles
    const [topSupplierMetric, setTopSupplierMetric] = useState("spend");
    const [deliveryView, setDeliveryView] = useState("delivery"); // delivery | financial
    const [scorecardSort, setScorecardSort] = useState({ key: "totalSpend", dir: "desc" });
    const [scorecardPage, setScorecardPage] = useState(1);

    // Data States
    const [materials, setMaterials] = useState([]);
    const [supplyOrders, setSupplyOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [negotiations, setNegotiations] = useState([]);
    const [paymentsSummary, setPaymentsSummary] = useState(null);
    const [warehouses, setWarehouses] = useState([]);

    // Filter Bar States
    const [customStartDate, setCustomStartDate] = useState(startDateParam);
    const [customEndDate, setCustomEndDate] = useState(endDateParam);
    const [selectedSupplier, setSelectedSupplier] = useState("ALL");
    const [selectedProduct, setSelectedProduct] = useState("ALL");
    const [selectedCategory, setSelectedCategory] = useState("ALL");
    const [selectedWarehouse, setSelectedWarehouse] = useState("ALL");
    const [selectedChannel, setSelectedChannel] = useState("ALL"); // ALL | DIRECT_CATALOG | BARGAIN_QUOTE

    // Quick Action Modals
    const [showPOModal, setShowPOModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [poForm, setPoForm] = useState({ materialId: "", qty: "", supplier: "", notes: "" });
    const [receiveForm, setReceiveForm] = useState({ materialId: "", qty: "", supplier: "", notes: "" });
    const [adjustForm, setAdjustForm] = useState({ materialId: "", qty: "", reason: "COUNT_CORRECTION", notes: "" });

    const fetchDashboardData = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        const requests = [
            { key: "orders", label: "Supply Orders", promise: api.get("/supply-orders") },
            { key: "suppliers", label: "Suppliers", promise: api.get("/owner/suppliers") },
            { key: "negotiations", label: "Negotiations", promise: api.get("/owner/negotiations") },
            { key: "payments", label: "Payments", promise: api.get("/owner/supply-payments") },
            { key: "warehouses", label: "Warehouses", promise: api.get("/owner/storage-locations") },
        ];

        if (restaurantId) {
            requests.push({
                key: "materials",
                label: "Raw Materials",
                promise: api.get(`/owner/${restaurantId}/inventory/materials`),
            });
        }

        const results = await Promise.allSettled(requests.map((r) => r.promise));
        const warnings = [];
        let successCount = 0;

        results.forEach((result, idx) => {
            const reqMeta = requests[idx];
            if (result.status === "fulfilled" && result.value) {
                successCount += 1;
                const data = result.value.data;
                if (reqMeta.key === "orders") {
                    setSupplyOrders(Array.isArray(data?.orders) ? data.orders : []);
                } else if (reqMeta.key === "suppliers") {
                    setSuppliers(Array.isArray(data?.suppliers) ? data.suppliers : []);
                } else if (reqMeta.key === "negotiations") {
                    setNegotiations(Array.isArray(data?.negotiations) ? data.negotiations : []);
                } else if (reqMeta.key === "payments") {
                    setPaymentsSummary(data || null);
                } else if (reqMeta.key === "warehouses") {
                    setWarehouses(Array.isArray(data?.locations) ? data.locations : []);
                } else if (reqMeta.key === "materials") {
                    setMaterials(Array.isArray(data) ? data : data?.materials || []);
                }
            } else {
                warnings.push(reqMeta.label);
            }
        });

        setPartialWarnings(warnings);
        if (successCount === 0) {
            setError("Failed to load procurement & supplier analytics from the server.");
        } else {
            setError("");
        }

        setLoading(false);
        setRefreshing(false);
    }, [restaurantId]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useEffect(() => {
        if (!autoRefresh) return undefined;
        const timer = setInterval(() => {
            fetchDashboardData({ silent: true });
        }, REFRESH_MS);
        return () => clearInterval(timer);
    }, [autoRefresh, fetchDashboardData]);

    // Lookup maps from verified supplier & material data
    const supplierById = useMemo(() => {
        const map = new Map();
        suppliers.forEach((s) => map.set(String(s.id), s));
        return map;
    }, [suppliers]);

    const productCategoryById = useMemo(() => {
        const map = new Map();
        suppliers.forEach((s) => {
            (s.products || []).forEach((p) => {
                const cat = p.category?.name || p.categoryName;
                if (p.id && cat) map.set(String(p.id), cat);
            });
        });
        return map;
    }, [suppliers]);

    const productsList = useMemo(() => {
        const set = new Set();
        supplyOrders.forEach((o) => {
            (o.items || []).forEach((item) => {
                const name = item.productName || item.name || item.materialName;
                if (name) set.add(name);
            });
        });
        materials.forEach((m) => {
            if (m.name) set.add(m.name);
        });
        return ["ALL", ...Array.from(set).sort()];
    }, [supplyOrders, materials]);

    const categoriesList = useMemo(() => {
        const set = new Set();
        materials.forEach((m) => {
            if (m.category) set.add(m.category);
        });
        productCategoryById.forEach((cat) => set.add(cat));
        return ["ALL", ...Array.from(set).sort()];
    }, [materials, productCategoryById]);

    const periodBounds = useMemo(
        () => getPeriodBounds(range, customStartDate, customEndDate),
        [range, customStartDate, customEndDate]
    );

    const negotiatedOrderIds = useMemo(() => {
        const ids = new Set();
        negotiations.forEach((n) => {
            if (n.purchaseOrderId) ids.add(String(n.purchaseOrderId));
        });
        return ids;
    }, [negotiations]);

    // Apply supported procurement filters to orders
    const attributeFilteredOrders = useMemo(() => {
        return supplyOrders.filter((order) => {
            if (selectedSupplier !== "ALL" && String(order.supplierId) !== String(selectedSupplier)) {
                return false;
            }
            if (selectedProduct !== "ALL") {
                const hasProduct = (order.items || []).some(
                    (item) => (item.productName || item.name || item.materialName) === selectedProduct
                );
                if (!hasProduct) return false;
            }
            if (selectedCategory !== "ALL") {
                const hasCategory = (order.items || []).some((item) => {
                    const itemCat = item.category || productCategoryById.get(String(item.productId));
                    return itemCat === selectedCategory;
                });
                if (!hasCategory) return false;
            }
            if (selectedChannel !== "ALL") {
                const isNegotiated =
                    negotiatedOrderIds.has(String(order.id)) ||
                    Boolean(order.notes && order.notes.toLowerCase().includes("negotiation"));
                if (selectedChannel === "BARGAIN_QUOTE" && !isNegotiated) return false;
                if (selectedChannel === "DIRECT_CATALOG" && isNegotiated) return false;
            }
            return true;
        });
    }, [
        supplyOrders,
        selectedSupplier,
        selectedProduct,
        selectedCategory,
        selectedChannel,
        productCategoryById,
        negotiatedOrderIds,
    ]);

    const currentPeriodOrders = useMemo(() => {
        const { cStart, cEnd } = periodBounds;
        return attributeFilteredOrders.filter((o) => {
            if (!o.createdAt) return false;
            const d = new Date(o.createdAt);
            return d >= cStart && d <= cEnd;
        });
    }, [attributeFilteredOrders, periodBounds]);

    const prevPeriodOrders = useMemo(() => {
        const { pStart, pEnd } = periodBounds;
        return attributeFilteredOrders.filter((o) => {
            if (!o.createdAt) return false;
            const d = new Date(o.createdAt);
            return d >= pStart && d <= pEnd;
        });
    }, [attributeFilteredOrders, periodBounds]);

    // Core verified KPIs
    const kpiMetrics = useMemo(() => {
        const validCurrent = currentPeriodOrders.filter((o) => !isOrderCancelled(o));
        const validPrev = prevPeriodOrders.filter((o) => !isOrderCancelled(o));

        const totalSpend = validCurrent.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        const prevSpend = validPrev.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        const totalSavings = validCurrent.reduce((sum, o) => sum + Number(o.discountAmount || 0), 0);

        let spendTrend = null;
        if (prevSpend > 0) {
            const pct = ((totalSpend - prevSpend) / prevSpend) * 100;
            spendTrend = {
                text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs prior period`,
                isUp: pct >= 0,
            };
        }

        // Average Lead Time (only from orders with actual delivery/completion timestamp)
        let leadTimeSumDays = 0;
        let leadTimeCount = 0;
        validCurrent.forEach((o) => {
            const deliveredAt = getDeliveredTimestamp(o);
            if (deliveredAt && o.createdAt) {
                const diffDays = (deliveredAt.getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                if (diffDays >= 0) {
                    leadTimeSumDays += diffDays;
                    leadTimeCount += 1;
                }
            }
        });

        const avgLeadTimeDays = leadTimeCount > 0 ? leadTimeSumDays / leadTimeCount : null;

        return {
            totalSpend,
            totalOrders: validCurrent.length,
            totalSavings,
            spendTrend,
            avgLeadTimeDays,
            leadTimeSampleCount: leadTimeCount,
        };
    }, [currentPeriodOrders, prevPeriodOrders]);

    // Aggregate per-supplier performance from verified orders
    const supplierScorecardRows = useMemo(() => {
        const map = new Map();

        currentPeriodOrders.forEach((order) => {
            if (isOrderCancelled(order)) return;
            const sid = String(order.supplierId || "unknown");
            const supObj = order.supplier || supplierById.get(sid);
            const name = getSupplierDisplayName(supObj, order.supplierId);

            if (!map.has(sid)) {
                map.set(sid, {
                    supplierId: sid,
                    name,
                    orders: 0,
                    totalSpend: 0,
                    subtotal: 0,
                    savings: 0,
                    leadTimeSumDays: 0,
                    leadTimeCount: 0,
                    slaEvaluatedCount: 0,
                    onTimeCount: 0,
                    lateDaysSum: 0,
                });
            }

            const entry = map.get(sid);
            const orderTotal = Number(order.totalAmount || 0);
            const orderSubtotal = Number(order.subtotal || orderTotal);
            const discount = Number(order.discountAmount || 0);

            entry.orders += 1;
            entry.totalSpend += orderTotal;
            entry.subtotal += orderSubtotal;
            entry.savings += discount;

            const deliveredAt = getDeliveredTimestamp(order);
            if (deliveredAt && order.createdAt) {
                const leadDays = (deliveredAt.getTime() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                if (leadDays >= 0) {
                    entry.leadTimeSumDays += leadDays;
                    entry.leadTimeCount += 1;
                }
                if (order.expectedDeliveryDate) {
                    const expectedAt = new Date(order.expectedDeliveryDate);
                    entry.slaEvaluatedCount += 1;
                    const lateDays = Math.max(0, (deliveredAt.getTime() - expectedAt.getTime()) / (1000 * 60 * 60 * 24));
                    if (lateDays === 0) entry.onTimeCount += 1;
                    entry.lateDaysSum += lateDays;
                }
            }
        });

        return Array.from(map.values()).map((row) => {
            const denominator = row.subtotal + row.savings;
            const savingsPct = denominator > 0 ? (row.savings / denominator) * 100 : 0;
            const leadTimeDays = row.leadTimeCount > 0 ? row.leadTimeSumDays / row.leadTimeCount : null;
            const daysLate = row.slaEvaluatedCount > 0 ? row.lateDaysSum / row.slaEvaluatedCount : null;
            const onTimeRate = row.slaEvaluatedCount > 0 ? (row.onTimeCount / row.slaEvaluatedCount) * 100 : null;

            return {
                ...row,
                savingsPct,
                leadTimeDays,
                daysLate,
                onTimeRate,
                esgScore: null,
                esgRating: null,
            };
        });
    }, [currentPeriodOrders, supplierById]);

    const topSuppliersChartData = useMemo(() => {
        if (topSupplierMetric === "esgScore") return [];
        const sorted = [...supplierScorecardRows]
            .filter((row) => (topSupplierMetric === "leadTimeDays" ? row.leadTimeDays !== null : true))
            .sort((a, b) => {
                if (topSupplierMetric === "leadTimeDays") return (a.leadTimeDays || 0) - (b.leadTimeDays || 0);
                if (topSupplierMetric === "savingsPct") return b.savingsPct - a.savingsPct;
                return b.totalSpend - a.totalSpend;
            })
            .slice(0, 5);

        return sorted.map((row) => ({
            name: row.name.length > 20 ? `${row.name.slice(0, 18)}…` : row.name,
            fullName: row.name,
            spend: Math.round(row.totalSpend),
            savingsPct: Number(row.savingsPct.toFixed(1)),
            leadTimeDays: row.leadTimeDays !== null ? Number(row.leadTimeDays.toFixed(1)) : 0,
        }));
    }, [supplierScorecardRows, topSupplierMetric]);

    const deliveryAnalysis = useMemo(() => {
        let onTime = 0;
        let late = 0;
        let evaluated = 0;
        let pending = 0;
        let delivered = 0;
        let cancelled = 0;

        currentPeriodOrders.forEach((o) => {
            if (isOrderCancelled(o)) {
                cancelled += 1;
                return;
            }
            const deliveredAt = getDeliveredTimestamp(o);
            if (deliveredAt) {
                delivered += 1;
                if (o.expectedDeliveryDate) {
                    evaluated += 1;
                    if (deliveredAt <= new Date(o.expectedDeliveryDate)) onTime += 1;
                    else late += 1;
                }
            } else {
                pending += 1;
            }
        });

        const onTimeRate = evaluated > 0 ? (onTime / evaluated) * 100 : null;
        return {
            total: currentPeriodOrders.length,
            delivered,
            pending,
            cancelled,
            evaluated,
            onTime,
            late,
            onTimeRate,
            chartData: [
                { stage: "Delivered", count: delivered, fill: "#10b981" },
                { stage: "In Transit / Open", count: pending, fill: "#f59e0b" },
                { stage: "Cancelled", count: cancelled, fill: "#ef4444" },
            ],
        };
    }, [currentPeriodOrders]);

    // Regional distribution from verified SupplierAddress records for suppliers in filtered orders
    const regionalDistribution = useMemo(() => {
        const activeSupplierIds = new Set(supplierScorecardRows.map((r) => String(r.supplierId)));
        const sourceSuppliers =
            activeSupplierIds.size > 0
                ? suppliers.filter((s) => activeSupplierIds.has(String(s.id)))
                : [];

        const regionMap = new Map();
        sourceSuppliers.forEach((s) => {
            const addr = (s.addresses || []).find((a) => a.isPrimary) || s.addresses?.[0];
            const region = addr?.state || addr?.city || "Unspecified";
            regionMap.set(region, (regionMap.get(region) || 0) + 1);
        });

        const total = sourceSuppliers.length;
        return Array.from(regionMap.entries())
            .map(([region, count], idx) => ({
                region,
                count,
                pct: total > 0 ? (count / total) * 100 : 0,
                color: REGION_COLORS[idx % REGION_COLORS.length],
            }))
            .sort((a, b) => b.count - a.count);
    }, [suppliers, supplierScorecardRows]);

    // Sorted & paginated scorecard
    const sortedScorecardRows = useMemo(() => {
        const list = [...supplierScorecardRows];
        const { key, dir } = scorecardSort;
        list.sort((a, b) => {
            const av = a[key];
            const bv = b[key];
            if (av === null && bv === null) return 0;
            if (av === null) return 1;
            if (bv === null) return -1;
            if (typeof av === "string") {
                return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            }
            return dir === "asc" ? av - bv : bv - av;
        });
        return list;
    }, [supplierScorecardRows, scorecardSort]);

    const totalScorecardPages = Math.max(1, Math.ceil(sortedScorecardRows.length / SCORECARD_PAGE_SIZE));
    const pagedScorecardRows = useMemo(() => {
        const safePage = Math.min(scorecardPage, totalScorecardPages);
        const start = (safePage - 1) * SCORECARD_PAGE_SIZE;
        return sortedScorecardRows.slice(start, start + SCORECARD_PAGE_SIZE);
    }, [sortedScorecardRows, scorecardPage, totalScorecardPages]);

    // Warehouse inventory summary (only shown in Controls tab where selectedWarehouse applies)
    const warehouseInventorySummary = useMemo(() => {
        if (selectedWarehouse === "ALL") {
            return {
                label: "All Storage Locations",
                skuCount: materials.length,
                totalValue: materials.reduce((sum, m) => sum + Number(m.currentStock || 0) * Number(m.costPerBaseUnit || m.costPerUnit || 0), 0),
                lowStockCount: materials.filter((m) => Number(m.currentStock || 0) <= Number(m.minimumStock || 0)).length,
            };
        }
        const loc = warehouses.find((w) => String(w.id) === String(selectedWarehouse));
        const items = Array.isArray(loc?.items) ? loc.items : [];
        return {
            label: loc?.name || `Location #${selectedWarehouse}`,
            skuCount: items.length,
            totalValue: items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.rawMaterial?.costPerBaseUnit || 0), 0),
            lowStockCount: items.filter((i) => Number(i.quantity || 0) <= Number(i.minStock || 0)).length,
        };
    }, [selectedWarehouse, warehouses, materials]);

    const handleResetFilters = () => {
        setSelectedSupplier("ALL");
        setSelectedProduct("ALL");
        setSelectedCategory("ALL");
        setSelectedWarehouse("ALL");
        setSelectedChannel("ALL");
        setCustomStartDate("");
        setCustomEndDate("");
        setTopSupplierMetric("spend");
        setDeliveryView("delivery");
        setScorecardSort({ key: "totalSpend", dir: "desc" });
        setScorecardPage(1);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("range", "7d");
            next.delete("startDate");
            next.delete("endDate");
            return next;
        });
    };

    const handleSortColumn = (key) => {
        setScorecardPage(1);
        setScorecardSort((prev) => ({
            key,
            dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
        }));
    };

    // Quick Action Handlers (guarded by authenticated restaurantId)
    const handleCreatePO = async (e) => {
        e.preventDefault();
        if (!restaurantId) {
            showToast("Authenticated restaurant context is required", { type: "error" });
            return;
        }
        try {
            await api.post(`/owner/${restaurantId}/inventory/stock-in`, {
                rawMaterialId: poForm.materialId,
                quantity: poForm.qty,
                supplierName: poForm.supplier,
                notes: `PO Issued: ${poForm.notes}`,
            });
            showToast("Purchase Order created successfully!");
            setShowPOModal(false);
            setPoForm({ materialId: "", qty: "", supplier: "", notes: "" });
            fetchDashboardData({ silent: true });
        } catch {
            showToast("Failed to create purchase order", { type: "error" });
        }
    };

    const handleReceiveStock = async (e) => {
        e.preventDefault();
        if (!restaurantId) {
            showToast("Authenticated restaurant context is required", { type: "error" });
            return;
        }
        try {
            await api.post(`/owner/${restaurantId}/inventory/stock-in`, {
                rawMaterialId: receiveForm.materialId,
                quantity: receiveForm.qty,
                supplierName: receiveForm.supplier,
                notes: `GRN Received: ${receiveForm.notes}`,
            });
            showToast("Goods Receipt Note (GRN) logged successfully!");
            setShowReceiveModal(false);
            setReceiveForm({ materialId: "", qty: "", supplier: "", notes: "" });
            fetchDashboardData({ silent: true });
        } catch {
            showToast("Failed to log goods receipt", { type: "error" });
        }
    };

    const handleAdjustStock = async (e) => {
        e.preventDefault();
        if (!restaurantId) {
            showToast("Authenticated restaurant context is required", { type: "error" });
            return;
        }
        try {
            await api.post(`/owner/${restaurantId}/inventory/adjustments`, {
                rawMaterialId: adjustForm.materialId,
                quantity: adjustForm.qty,
                reason: adjustForm.reason,
                notes: adjustForm.notes,
            });
            showToast("Stock adjustment logged successfully!");
            setShowAdjustModal(false);
            setAdjustForm({ materialId: "", qty: "", reason: "COUNT_CORRECTION", notes: "" });
            fetchDashboardData({ silent: true });
        } catch {
            showToast("Failed to log stock adjustment", { type: "error" });
        }
    };

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text,#1e293b)] pb-12">
            {/* HEADER */}
            <header className="pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                                    Supplier Performance & Procurement Analytics
                                </h1>
                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                                    RESTAURANT PROCUREMENT
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Restaurant-scoped supplier spend, delivery reliability, negotiation savings, and procurement insights.
                        </p>
                    </div>

                    {/* TOP RIGHT CONTROLS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* In-page Section Tabs */}
                        <div role="tablist" aria-label="Analytics sections" className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-900">
                            {PAGE_TABS.map((tab) => {
                                const isActive = activeSectionTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => setActiveSectionTab(tab.id)}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                            isActive
                                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Date Preset Selector */}
                        <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-900">
                            {DATE_PRESETS.map((preset) => {
                                const isActive = range === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => {
                                            setScorecardPage(1);
                                            setSearchParams((prev) => {
                                                const next = new URLSearchParams(prev);
                                                next.set("range", preset.id);
                                                return next;
                                            });
                                        }}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                            isActive
                                                ? "bg-orange-500 text-white shadow-xs"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Currency Display (Restaurant Base Currency) */}
                        <span
                            className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
                            title="Display currency is fixed to INR in current API contracts"
                        >
                            INR (₹)
                        </span>

                        {/* Live Toggle */}
                        <button
                            type="button"
                            onClick={() => setAutoRefresh((prev) => !prev)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                                autoRefresh
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "border-slate-200 dark:border-slate-800 text-slate-500"
                            }`}
                        >
                            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                            {autoRefresh ? "Live ON" : "Live OFF"}
                        </button>

                        {/* Manual Refresh */}
                        <button
                            type="button"
                            onClick={() => fetchDashboardData({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <RefreshCcw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* SHARED SUPPLY CHAIN NAVIGATION */}
            <SupplyChainSubNav />

            {/* ERROR & PARTIAL WARNING BANNERS */}
            {error && (
                <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchDashboardData({ silent: false })}
                        className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-500/30 dark:text-rose-300 transition-colors cursor-pointer"
                    >
                        <RefreshCcw size={12} className={loading || refreshing ? "animate-spin" : ""} />
                        Retry
                    </button>
                </div>
            )}

            {!error && partialWarnings.length > 0 && (
                <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                    <div className="flex items-center gap-2">
                        <Info size={14} className="shrink-0" />
                        <span>Partial data unavailable: {partialWarnings.join(", ")}. Affected widgets show empty or unavailable states.</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchDashboardData({ silent: true })}
                        className="rounded border border-amber-500/40 px-2 py-0.5 font-semibold hover:bg-amber-500/20 cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* FILTER TOOLBAR */}
            <div className="py-2.5 px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                    <Filter size={14} className="text-orange-500" />
                    <span>FILTERS:</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Custom Date Inputs */}
                    {range === "custom" && (
                        <div className="flex items-center gap-1.5">
                            <input
                                type="date"
                                aria-label="Custom start date"
                                value={customStartDate}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomStartDate(val);
                                    setScorecardPage(1);
                                    setSearchParams((prev) => {
                                        const next = new URLSearchParams(prev);
                                        if (val) next.set("startDate", val);
                                        else next.delete("startDate");
                                        return next;
                                    });
                                }}
                                className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-200"
                            />
                            <span className="text-slate-400">to</span>
                            <input
                                type="date"
                                aria-label="Custom end date"
                                value={customEndDate}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomEndDate(val);
                                    setScorecardPage(1);
                                    setSearchParams((prev) => {
                                        const next = new URLSearchParams(prev);
                                        if (val) next.set("endDate", val);
                                        else next.delete("endDate");
                                        return next;
                                    });
                                }}
                                className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-200"
                            />
                        </div>
                    )}

                    {/* Supplier Filter */}
                    <select
                        aria-label="Filter by supplier"
                        value={selectedSupplier}
                        onChange={(e) => {
                            setSelectedSupplier(e.target.value);
                            setScorecardPage(1);
                        }}
                        className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                    >
                        <option value="ALL">All Suppliers</option>
                        {suppliers.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                                {getSupplierDisplayName(s, s.id)}
                            </option>
                        ))}
                    </select>

                    {/* Product Filter */}
                    <select
                        aria-label="Filter by product"
                        value={selectedProduct}
                        onChange={(e) => {
                            setSelectedProduct(e.target.value);
                            setScorecardPage(1);
                        }}
                        className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                    >
                        {productsList.map((prod) => (
                            <option key={prod} value={prod}>
                                {prod === "ALL" ? "All Products" : prod}
                            </option>
                        ))}
                    </select>

                    {/* Category Filter */}
                    <select
                        aria-label="Filter by category"
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setScorecardPage(1);
                        }}
                        className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                    >
                        {categoriesList.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat === "ALL" ? "All Categories" : cat}
                            </option>
                        ))}
                    </select>

                    {/* Warehouse Filter (applies to Controls / Inventory summary only) */}
                    <select
                        aria-label="Filter by warehouse"
                        value={selectedWarehouse}
                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                        title="Warehouse filter applies to Inventory Stock Summary in Controls tab (B2B orders do not store warehouse IDs)"
                        className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                    >
                        <option value="ALL">All Warehouses (Stock Only)</option>
                        {warehouses.map((w) => (
                            <option key={w.id} value={String(w.id)}>
                                {w.name}
                            </option>
                        ))}
                    </select>

                    {/* Procurement Channel Filter */}
                    <select
                        aria-label="Filter by procurement channel"
                        value={selectedChannel}
                        onChange={(e) => {
                            setSelectedChannel(e.target.value);
                            setScorecardPage(1);
                        }}
                        className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                    >
                        <option value="ALL">All Procurement Channels</option>
                        <option value="DIRECT_CATALOG">Direct Catalog PO</option>
                        <option value="BARGAIN_QUOTE">Negotiated Quote</option>
                    </select>

                    {/* Reset Button */}
                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* LOADING SKELETON */}
            {loading ? (
                <div data-testid="supply-analytics-loading" className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-pulse">
                    <div className="lg:col-span-3 space-y-3">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <div key={n} className="h-24 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
                        ))}
                    </div>
                    <div className="lg:col-span-9 space-y-4">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="h-64 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
                            <div className="h-64 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
                        </div>
                        <div className="h-72 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
                    </div>
                </div>
            ) : (
                <>
                    {/* OVERVIEW & SUPPLIER SECTIONS */}
                    {activeSectionTab !== "controls" && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* LEFT KPI COLUMN (Reference Column) */}
                            {activeSectionTab === "overview" && (
                                <div className="lg:col-span-3 space-y-3">
                                    {/* Verified Total Spend */}
                                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-1">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Total Procurement Spend
                                        </div>
                                        <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                                            {formatCompactMoney(kpiMetrics.totalSpend)}
                                        </div>
                                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                            {kpiMetrics.spendTrend ? (
                                                <span className={kpiMetrics.spendTrend.isUp ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                                                    {kpiMetrics.spendTrend.text}
                                                </span>
                                            ) : (
                                                <span>{kpiMetrics.totalOrders} orders in period</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preferred Supplier Spend % */}
                                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-1">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Preferred Supplier Spend %
                                        </div>
                                        <div className="text-xl font-bold text-slate-400 dark:text-slate-500">—</div>
                                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                            Requires setup (preferred supplier flag)
                                        </div>
                                    </div>

                                    {/* Single-Source Spend % */}
                                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-1">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Single-Source Spend %
                                        </div>
                                        <div className="text-xl font-bold text-slate-400 dark:text-slate-500">—</div>
                                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                            Requires setup (SKU-to-supplier mapping)
                                        </div>
                                    </div>

                                    {/* Low-Risk Supplier Spend % */}
                                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-1">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Low-Risk Supplier Spend %
                                        </div>
                                        <div className="text-xl font-bold text-slate-400 dark:text-slate-500">—</div>
                                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                            Requires setup (supplier risk scoring)
                                        </div>
                                    </div>

                                    {/* Weighted Average ESG Score */}
                                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-1">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Weighted Average ESG Score
                                        </div>
                                        <div className="text-xl font-bold text-slate-400 dark:text-slate-500">—</div>
                                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                            Requires setup (ESG data)
                                        </div>
                                    </div>

                                    {/* Average Lead Time */}
                                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-1">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Average Lead Time
                                        </div>
                                        <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                                            {kpiMetrics.avgLeadTimeDays !== null
                                                ? `${kpiMetrics.avgLeadTimeDays.toFixed(1)} days`
                                                : "—"}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            {kpiMetrics.leadTimeSampleCount > 0
                                                ? `Based on ${kpiMetrics.leadTimeSampleCount} delivered orders`
                                                : "No delivered order timestamps in period"}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* RIGHT MAIN GRID */}
                            <div className={`${activeSectionTab === "overview" ? "lg:col-span-9" : "lg:col-span-12"} space-y-4`}>
                                {/* TOP ROW: TOP 5 SUPPLIERS + DELIVERY ANALYSIS */}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {/* TOP 5 SUPPLIERS BY SPEND */}
                                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                                    Top 5 Suppliers by Spend
                                                </h2>
                                                <p className="text-[11px] text-slate-500">Scoped to your restaurant orders in period</p>
                                            </div>
                                            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950">
                                                {TOP_SUPPLIER_METRICS.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        aria-pressed={topSupplierMetric === m.id}
                                                        onClick={() => setTopSupplierMetric(m.id)}
                                                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                                            topSupplierMetric === m.id
                                                                ? "bg-orange-500 text-white"
                                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                                        }`}
                                                    >
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {topSupplierMetric === "esgScore" ? (
                                            <div className="h-[220px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4 text-slate-500">
                                                <ShieldCheck size={28} className="text-slate-400 mb-2" />
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">ESG Score Unavailable</p>
                                                <p className="text-[11px] mt-0.5">Supplier ESG ratings require schema and data setup.</p>
                                            </div>
                                        ) : topSuppliersChartData.length === 0 ? (
                                            <div className="h-[220px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4 text-slate-500">
                                                <BarChart3 size={28} className="text-slate-400 mb-2" />
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No supplier data for this period</p>
                                                <p className="text-[11px] mt-0.5">Adjust date range or filters to view supplier performance.</p>
                                            </div>
                                        ) : (
                                            <div className="h-[220px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={topSuppliersChartData} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                                        <XAxis
                                                            type="number"
                                                            tick={{ fontSize: 11, fill: "#64748b" }}
                                                            tickFormatter={(v) =>
                                                                topSupplierMetric === "spend"
                                                                    ? `₹${Math.round(v / 1000)}k`
                                                                    : topSupplierMetric === "savingsPct"
                                                                    ? `${v}%`
                                                                    : `${v}d`
                                                            }
                                                        />
                                                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#475569" }} />
                                                        <Tooltip
                                                            formatter={(val) => {
                                                                if (topSupplierMetric === "spend") return [formatMoney(val), "Spend"];
                                                                if (topSupplierMetric === "savingsPct") return [`${val}%`, "Savings %"];
                                                                return [`${val} days`, "Avg Lead Time"];
                                                            }}
                                                        />
                                                        <Bar dataKey={topSupplierMetric} fill="#f97316" radius={[0, 4, 4, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </div>

                                    {/* SUPPLIER DELIVERY PERFORMANCE ANALYSIS */}
                                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                                    Supplier Delivery Performance Analysis
                                                </h2>
                                                <p className="text-[11px] text-slate-500">Order fulfillment & financial overview</p>
                                            </div>
                                            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950">
                                                <button
                                                    type="button"
                                                    aria-pressed={deliveryView === "delivery"}
                                                    onClick={() => setDeliveryView("delivery")}
                                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                                        deliveryView === "delivery"
                                                            ? "bg-orange-500 text-white"
                                                            : "text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    Delivery
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-pressed={deliveryView === "financial"}
                                                    onClick={() => setDeliveryView("financial")}
                                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                                        deliveryView === "financial"
                                                            ? "bg-orange-500 text-white"
                                                            : "text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    Financial
                                                </button>
                                            </div>
                                        </div>

                                        {deliveryView === "delivery" ? (
                                            deliveryAnalysis.total === 0 ? (
                                                <div className="h-[220px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4 text-slate-500">
                                                    <Truck size={28} className="text-slate-400 mb-2" />
                                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No delivery records in period</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
                                                            <div className="text-[10px] uppercase font-bold text-slate-500">On-Time Rate</div>
                                                            <div className="text-base font-black text-emerald-600">
                                                                {deliveryAnalysis.onTimeRate !== null ? formatPct(deliveryAnalysis.onTimeRate) : "—"}
                                                            </div>
                                                        </div>
                                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
                                                            <div className="text-[10px] uppercase font-bold text-slate-500">Delivered</div>
                                                            <div className="text-base font-black text-slate-900 dark:text-slate-100">
                                                                {deliveryAnalysis.delivered}
                                                            </div>
                                                        </div>
                                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
                                                            <div className="text-[10px] uppercase font-bold text-slate-500">Late (SLA)</div>
                                                            <div className="text-base font-black text-amber-600">
                                                                {deliveryAnalysis.evaluated > 0 ? deliveryAnalysis.late : "—"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="h-[150px] w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={deliveryAnalysis.chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                                                                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#64748b" }} />
                                                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                                                                <Tooltip />
                                                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                                                    {deliveryAnalysis.chartData.map((entry, idx) => (
                                                                        <Cell key={idx} fill={entry.fill} />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            )
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3 pt-1">
                                                <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 p-3">
                                                    <div className="text-[11px] font-bold uppercase text-slate-500">Period Order Spend</div>
                                                    <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                                        {formatMoney(kpiMetrics.totalSpend)}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 p-3">
                                                    <div className="text-[11px] font-bold uppercase text-slate-500">Order Discount Savings</div>
                                                    <div className="text-lg font-black text-emerald-600 mt-0.5">
                                                        {formatMoney(kpiMetrics.totalSavings)}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 p-3">
                                                    <div className="text-[11px] font-bold uppercase text-slate-500">Invoices Paid (All-Time)</div>
                                                    <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                                        {paymentsSummary?.summary ? formatMoney(paymentsSummary.summary.paidAmount) : "—"}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 p-3">
                                                    <div className="text-[11px] font-bold uppercase text-slate-500">Pending / Overdue</div>
                                                    <div className="text-lg font-black text-amber-600 mt-0.5">
                                                        {paymentsSummary?.summary
                                                            ? formatMoney(
                                                                  Number(paymentsSummary.summary.pendingAmount || 0) +
                                                                      Number(paymentsSummary.summary.overdueAmount || 0)
                                                              )
                                                            : "—"}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* BOTTOM ROW: REGIONAL DISTRIBUTION + SUPPLIER SCORECARD */}
                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                                    {/* SUPPLIER DISTRIBUTION BY REGION */}
                                    <div className="xl:col-span-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                                        <div>
                                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                                Supplier Distribution by Region
                                            </h2>
                                            <p className="text-[11px] text-slate-500">Active suppliers in selected period</p>
                                        </div>

                                        {regionalDistribution.length === 0 ? (
                                            <div className="h-[210px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4 text-slate-500">
                                                <Globe size={28} className="text-slate-400 mb-2" />
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No regional supplier data</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="h-[140px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={regionalDistribution}
                                                                dataKey="count"
                                                                nameKey="region"
                                                                innerRadius={38}
                                                                outerRadius={58}
                                                                paddingAngle={2}
                                                            >
                                                                {regionalDistribution.map((entry, idx) => (
                                                                    <Cell key={idx} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip formatter={(val) => [`${val} suppliers`, "Count"]} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <ul className="space-y-1 text-xs">
                                                    {regionalDistribution.map((r) => (
                                                        <li key={r.region} className="flex items-center justify-between">
                                                            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                                                                {r.region}
                                                            </span>
                                                            <span className="font-bold text-slate-900 dark:text-slate-100">
                                                                {r.count} ({formatPct(r.pct)})
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* SUPPLIER PERFORMANCE SCORECARD TABLE */}
                                    <div className="xl:col-span-8 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                                    Supplier Performance Scorecard
                                                </h2>
                                                <p className="text-[11px] text-slate-500">
                                                    ESG columns show unavailable until backend scoring is configured
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => navigate("/owner/supply-chain/suppliers")}
                                                className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                                            >
                                                View Full Directory ({suppliers.length}) →
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                                                    <tr>
                                                        {[
                                                            { key: "name", label: "Supplier" },
                                                            { key: "orders", label: "Orders" },
                                                            { key: "totalSpend", label: "Total Spend" },
                                                            { key: "savings", label: "Savings" },
                                                            { key: "daysLate", label: "Days Late" },
                                                            { key: "onTimeRate", label: "On-Time %" },
                                                        ].map((col) => (
                                                            <th
                                                                key={col.key}
                                                                aria-sort={
                                                                    scorecardSort.key === col.key
                                                                        ? scorecardSort.dir === "asc"
                                                                            ? "ascending"
                                                                            : "descending"
                                                                        : "none"
                                                                }
                                                                className="p-2.5 whitespace-nowrap"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSortColumn(col.key)}
                                                                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                                                >
                                                                    {col.label}
                                                                    <ArrowUpDown size={11} />
                                                                </button>
                                                            </th>
                                                        ))}
                                                        <th className="p-2.5 whitespace-nowrap">Weighted ESG</th>
                                                        <th className="p-2.5 whitespace-nowrap text-right">ESG Rating</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                    {pagedScorecardRows.map((sup) => (
                                                        <tr
                                                            key={sup.supplierId}
                                                            onClick={() => navigate("/owner/supply-chain/suppliers")}
                                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                                                        >
                                                            <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{sup.name}</td>
                                                            <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{sup.orders}</td>
                                                            <td className="p-2.5 font-bold text-orange-500">{formatMoney(sup.totalSpend)}</td>
                                                            <td className="p-2.5 font-semibold text-emerald-600">{formatMoney(sup.savings)}</td>
                                                            <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                                                {sup.daysLate !== null ? sup.daysLate.toFixed(1) : "—"}
                                                            </td>
                                                            <td className="p-2.5 font-bold text-emerald-600">
                                                                {sup.onTimeRate !== null ? formatPct(sup.onTimeRate) : "—"}
                                                            </td>
                                                            <td className="p-2.5 text-slate-400">—</td>
                                                            <td className="p-2.5 text-right text-slate-400">Requires setup</td>
                                                        </tr>
                                                    ))}
                                                    {pagedScorecardRows.length === 0 && (
                                                        <tr>
                                                            <td colSpan={8} className="p-8 text-center text-slate-500">
                                                                No supplier orders match the current date range and filters.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {totalScorecardPages > 1 && (
                                            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                                                <span>
                                                    Page {scorecardPage} of {totalScorecardPages} ({sortedScorecardRows.length} suppliers)
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={scorecardPage <= 1}
                                                        onClick={() => setScorecardPage((p) => Math.max(1, p - 1))}
                                                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                                                    >
                                                        Prev
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={scorecardPage >= totalScorecardPages}
                                                        onClick={() => setScorecardPage((p) => Math.min(totalScorecardPages, p + 1))}
                                                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTROLS TAB (QUICK ACTIONS & WAREHOUSE STOCK HEALTH) */}
                    {activeSectionTab === "controls" && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Warehouse size={16} className="text-orange-500" />
                                        <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                            Warehouse Stock Snapshot — {warehouseInventorySummary.label}
                                        </h2>
                                    </div>
                                    <span className="text-[11px] text-slate-500">Filtered by Warehouse selector</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                                        <div className="text-[11px] font-bold uppercase text-slate-500">Tracked SKUs</div>
                                        <div className="text-xl font-black text-slate-900 dark:text-slate-100">{warehouseInventorySummary.skuCount}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                                        <div className="text-[11px] font-bold uppercase text-slate-500">Stock Valuation</div>
                                        <div className="text-xl font-black text-slate-900 dark:text-slate-100">{formatMoney(warehouseInventorySummary.totalValue)}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                                        <div className="text-[11px] font-bold uppercase text-slate-500">Low Stock Items</div>
                                        <div className="text-xl font-black text-amber-600">{warehouseInventorySummary.lowStockCount}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* QUICK ACTIONS TOOLBAR */}
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-orange-500" />
                            <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                Procurement & Inventory Actions
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigate("/owner/supply-chain/marketplace")}
                                className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                            >
                                + B2B Marketplace
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate("/owner/supply-chain/negotiations")}
                                className="px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 cursor-pointer"
                            >
                                + Price Quotes
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPOModal(true)}
                                disabled={!restaurantId}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                            >
                                + Issue PO
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowReceiveModal(true)}
                                disabled={!restaurantId}
                                className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 disabled:opacity-50 cursor-pointer"
                            >
                                + Receive Stock (GRN)
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate("/owner/supply-chain/payments")}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                                + Settlement Payouts
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* 1. CREATE PO MODAL */}
            {showPOModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Create B2B Purchase Order</h3>
                            <button type="button" onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreatePO} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold uppercase text-slate-500">Select Material *</label>
                                <select
                                    required
                                    value={poForm.materialId}
                                    onChange={(e) => setPoForm({ ...poForm, materialId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                >
                                    <option value="">-- Select Ingredient --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name} (Current: {m.currentStock})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Order Quantity</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="e.g. 50"
                                    value={poForm.qty}
                                    onChange={(e) => setPoForm({ ...poForm, qty: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Supplier Name</label>
                                <input
                                    type="text"
                                    placeholder="Supplier name"
                                    value={poForm.supplier}
                                    onChange={(e) => setPoForm({ ...poForm, supplier: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowPOModal(false)} className="rounded-lg border px-4 py-2 font-bold text-slate-500">Cancel</button>
                                <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-white shadow-sm cursor-pointer">Issue Purchase Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. RECEIVE STOCK MODAL */}
            {showReceiveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Receive Inward Stock (GRN)</h3>
                            <button type="button" onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleReceiveStock} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold uppercase text-slate-500">Select Material Received *</label>
                                <select
                                    required
                                    value={receiveForm.materialId}
                                    onChange={(e) => setReceiveForm({ ...receiveForm, materialId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                >
                                    <option value="">-- Choose Raw Ingredient --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Received Quantity</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="e.g. 100"
                                    value={receiveForm.qty}
                                    onChange={(e) => setReceiveForm({ ...receiveForm, qty: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Supplier Name</label>
                                <input
                                    type="text"
                                    placeholder="Vendor Name"
                                    value={receiveForm.supplier}
                                    onChange={(e) => setReceiveForm({ ...receiveForm, supplier: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowReceiveModal(false)} className="rounded-lg border px-4 py-2 font-bold text-slate-500">Cancel</button>
                                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white shadow-sm cursor-pointer">Accept & Log Stock</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. ADJUST STOCK MODAL */}
            {showAdjustModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Log Stock Level Adjustment</h3>
                            <button type="button" onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAdjustStock} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold uppercase text-slate-500">Select Material *</label>
                                <select
                                    required
                                    value={adjustForm.materialId}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, materialId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                >
                                    <option value="">-- Select Ingredient --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name} (Current: {m.currentStock})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Adjustment Quantity (+ / -)</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="e.g. -5 or 10"
                                    value={adjustForm.qty}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, qty: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Adjustment Reason</label>
                                <select
                                    value={adjustForm.reason}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                >
                                    <option value="COUNT_CORRECTION">Physical Stock Count Correction</option>
                                    <option value="SPOILAGE">Prep Spoilage / Waste</option>
                                    <option value="DAMAGE">Transit / Storage Damage</option>
                                    <option value="OTHER">Other Reconciliation</option>
                                </select>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowAdjustModal(false)} className="rounded-lg border px-4 py-2 font-bold text-slate-500">Cancel</button>
                                <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-white shadow-sm cursor-pointer">Submit Adjustment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
