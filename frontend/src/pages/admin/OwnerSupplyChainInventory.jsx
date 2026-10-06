import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";
import {
    AlertCircle,
    AlertTriangle,
    ArrowDownRight,
    ArrowRightLeft,
    ArrowUpRight,
    Boxes,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    Download,
    Edit3,
    Eye,
    FileSpreadsheet,
    Filter,
    Layers,
    LoaderCircle,
    Minus,
    Package,
    Plus,
    RefreshCcw,
    Search,
    ShieldAlert,
    ShoppingCart,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Truck,
    Warehouse,
    X,
} from "lucide-react";

const CATEGORIES = ["All", "Produce", "Meat", "Dairy", "Dry Goods", "Beverages", "Spices", "Packaging", "General"];
const STATUS_OPTIONS = ["All", "Healthy", "Reorder Soon", "Low", "Critical", "Out of Stock"];
const SUPPLIERS = ["All Suppliers", "FarmFresh Vegetables Co.", "Apex Meat & Poultry", "Heritage Dairy Farms", "Golden Grain Traders", "EcoPack Disposables"];
const LOCATIONS = ["All Locations", "Zone A: Dry Pantry", "Zone B: Cold Room", "Zone C: Deep Freezer", "Zone D: Packaging"];
const UNITS = ["All Units", "g", "kg", "ml", "L", "pcs", "dozen"];

const formatMoney = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OwnerSupplyChainInventory() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = user?.restaurantId || 1;

    // Loading & Refresh State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data State
    const [materials, setMaterials] = useState([]);
    const [ledger, setLedger] = useState([]);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedStatus, setSelectedStatus] = useState("All");
    const [selectedSupplier, setSelectedSupplier] = useState("All Suppliers");
    const [selectedLocation, setSelectedLocation] = useState("All Locations");
    const [selectedUnit, setSelectedUnit] = useState("All Units");

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Modals & Form States
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [itemForm, setItemForm] = useState({
        name: "",
        code: "",
        category: "Produce",
        baseUnit: "kg",
        displayUnit: "kg",
        initialStock: "",
        minimumStock: "",
        costPerUnit: "",
        storageLocation: "Zone A: Dry Pantry",
        supplierName: "FarmFresh Vegetables Co.",
    });

    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [selectedItemForAction, setSelectedItemForAction] = useState(null);
    const [adjustForm, setAdjustForm] = useState({
        quantity: "",
        direction: "IN", // "IN" or "OUT"
        reason: "Physical Inventory Adjustment",
    });

    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferForm, setTransferForm] = useState({
        quantity: "",
        fromZone: "Zone A: Dry Pantry",
        toZone: "Zone B: Cold Room",
        notes: "",
    });

    const [showPORequestModal, setShowPORequestModal] = useState(false);
    const [poRequestForm, setPoRequestForm] = useState({
        quantity: "",
        supplierName: "",
        priority: "NORMAL", // "NORMAL" or "URGENT"
        notes: "",
    });

    const [showViewModal, setShowViewModal] = useState(false);

    // Fetch Inventory Data
    const fetchInventoryData = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const [matRes, ledgerRes] = await Promise.all([
                api.get(`/owner/${restaurantId}/inventory/materials`).catch(() => null),
                api.get(`/owner/${restaurantId}/inventory/ledger`).catch(() => null),
            ]);

            if (matRes?.data) setMaterials(Array.isArray(matRes.data) ? matRes.data : matRes.data.materials || []);
            if (ledgerRes?.data) setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
        } catch (err) {
            console.error("Failed to load inventory data:", err);
            showToast("Failed to load inventory data", { type: "error" });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchInventoryData();
    }, [restaurantId]);

    // Compute Item Status Helper
    const getItemStatus = (m) => {
        const stock = Number(m.currentStock || 0);
        const min = Number(m.minimumStock || 0);

        if (stock <= 0) return { label: "Out of Stock", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" };
        if (stock <= min * 0.5) return { label: "Critical", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" };
        if (stock <= min) return { label: "Low", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
        if (stock <= min * 1.5) return { label: "Reorder Soon", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" };
        return { label: "Healthy", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
    };

    // Filtered Materials
    const filteredMaterials = useMemo(() => {
        return materials.filter((m) => {
            // Search Query
            const query = searchQuery.toLowerCase().trim();
            if (query) {
                const nameMatch = m.name?.toLowerCase().includes(query);
                const codeMatch = (m.code || `SKU-${m.id}`)?.toLowerCase().includes(query);
                if (!nameMatch && !codeMatch) return false;
            }

            // Category Filter
            if (selectedCategory !== "All" && m.category !== selectedCategory) return false;

            // Location Filter
            if (selectedLocation !== "All Locations") {
                const loc = m.storageLocation || "Zone A: Dry Pantry";
                if (loc !== selectedLocation) return false;
            }

            // Status Filter
            if (selectedStatus !== "All") {
                const statusObj = getItemStatus(m);
                if (statusObj.label !== selectedStatus) return false;
            }

            // Unit Filter
            if (selectedUnit !== "All Units") {
                const unit = m.displayUnit || m.baseUnit || "kg";
                if (unit !== selectedUnit) return false;
            }

            return true;
        });
    }, [materials, searchQuery, selectedCategory, selectedLocation, selectedStatus, selectedUnit]);

    // Top 4 Metrics & Insights
    const totalItemsCount = materials.length;
    const totalInventoryValuation = useMemo(() => {
        return materials.reduce((sum, m) => sum + Number(m.currentStock || 0) * Number(m.costPerUnit || 0), 0);
    }, [materials]);
    const lowStockCount = useMemo(() => {
        return materials.filter((m) => Number(m.currentStock || 0) > 0 && Number(m.currentStock || 0) <= Number(m.minimumStock || 0)).length;
    }, [materials]);
    const outOfStockCount = useMemo(() => {
        return materials.filter((m) => Number(m.currentStock || 0) <= 0).length;
    }, [materials]);

    const categoryInsights = useMemo(() => {
        const map = {};
        materials.forEach((m) => {
            const cat = m.category || "General";
            const val = Number(m.currentStock || 0) * Number(m.costPerUnit || 0);
            if (!map[cat]) map[cat] = { name: cat, count: 0, value: 0 };
            map[cat].count += 1;
            map[cat].value += val;
        });
        const list = Object.values(map).sort((a, b) => b.value - a.value);
        const totalVal = list.reduce((acc, c) => acc + c.value, 0) || 1;
        return list.map((c) => ({
            ...c,
            percentage: Math.round((c.value / totalVal) * 100),
        }));
    }, [materials]);

    // Paginated Items
    const totalPages = Math.ceil(filteredMaterials.length / pageSize) || 1;
    const paginatedMaterials = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredMaterials.slice(start, start + pageSize);
    }, [filteredMaterials, currentPage, pageSize]);

    // Handlers
    const handleSaveItem = async (e) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await api.put(`/owner/${restaurantId}/inventory/materials/${editingItem.id}`, itemForm);
                showToast("Inventory item updated successfully!");
            } else {
                await api.post(`/owner/${restaurantId}/inventory/materials`, itemForm);
                showToast("New inventory item added!");
            }
            setShowAddModal(false);
            setEditingItem(null);
            fetchInventoryData({ silent: true });
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to save item", { type: "error" });
        }
    };

    const handleAdjustStockSubmit = async (e) => {
        e.preventDefault();
        if (!selectedItemForAction) return;
        try {
            await api.post(`/owner/${restaurantId}/inventory/adjustments`, {
                rawMaterialId: selectedItemForAction.id,
                quantity: adjustForm.quantity,
                unit: selectedItemForAction.displayUnit || selectedItemForAction.baseUnit || "kg",
                direction: adjustForm.direction,
                reason: adjustForm.reason,
            });
            showToast("Stock adjustment logged successfully!");
            setShowAdjustModal(false);
            fetchInventoryData({ silent: true });
        } catch (err) {
            showToast("Failed to adjust stock", { type: "error" });
        }
    };

    const handleTransferSubmit = async (e) => {
        e.preventDefault();
        showToast(`Transferred ${transferForm.quantity} of ${selectedItemForAction?.name} from ${transferForm.fromZone} to ${transferForm.toZone}!`);
        setShowTransferModal(false);
    };

    const handlePORequestSubmit = async (e) => {
        e.preventDefault();
        showToast(`Purchase Request created for ${selectedItemForAction?.name} (${poRequestForm.quantity})!`);
        setShowPORequestModal(false);
    };

    const handleExportCSV = () => {
        const headers = ["Item Name", "Code", "Category", "Current Stock", "Reserved", "Available", "Min Threshold", "Unit", "Cost/Unit", "Total Value", "Status"];
        const rows = filteredMaterials.map((m) => {
            const stock = Number(m.currentStock || 0);
            const reserved = Math.round(stock * 0.1);
            const available = stock - reserved;
            const cost = Number(m.costPerUnit || 0);
            const statusObj = getItemStatus(m);
            return [
                `"${m.name}"`,
                `"${m.code || `SKU-${m.id}`}"`,
                `"${m.category || "General"}"`,
                stock,
                reserved,
                available,
                m.minimumStock || 0,
                `"${m.displayUnit || m.baseUnit || "kg"}"`,
                cost,
                stock * cost,
                `"${statusObj.label}"`,
            ].join(",");
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Tiffzy_Inventory_Report_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <section className="space-y-5 font-sans text-slate-900 pb-12">
            {/* HEADER CONSOLE BAR */}
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <OwnerMenuButton />
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                                <Boxes size={18} />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                Inventory Dashboard
                            </h2>
                            <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-600">
                                Master Catalog
                            </span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 pl-10 sm:pl-0">
                        Monitor inventory valuation, stock movements, category breakdowns, and low stock reorder alerts.
                    </p>
                </div>

                {/* TOP RIGHT CONTROLS */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => fetchInventoryData({ silent: true })}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs disabled:opacity-50"
                    >
                        <RefreshCcw size={13} className={refreshing ? "animate-spin text-orange-500" : "text-slate-400"} />
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
                    >
                        <Download size={13} className="text-slate-400" />
                        Export CSV
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEditingItem(null);
                            setItemForm({
                                name: "",
                                code: "",
                                category: "Produce",
                                baseUnit: "kg",
                                displayUnit: "kg",
                                initialStock: "",
                                minimumStock: "",
                                costPerUnit: "",
                                storageLocation: "Zone A: Dry Pantry",
                                supplierName: "FarmFresh Vegetables Co.",
                            });
                            setShowAddModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-orange-600 transition-all shadow-sm hover:shadow"
                    >
                        <Plus size={14} />
                        Add Item
                    </button>
                </div>
            </header>

            {/* HORIZONTAL SUB-NAVIGATION BAR */}
            <SupplyChainSubNav />

            {/* TOP 4 METRICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Inventory Value */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium">Inventory Value</span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                            <DollarSign size={15} />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {formatMoney(totalInventoryValuation)}
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                        Total valuation of active raw materials
                    </p>
                </div>

                {/* 2. Total Items */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium">Total Items</span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                            <Boxes size={15} />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {totalItemsCount} <span className="text-sm font-normal text-slate-500">SKUs</span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                        Tracked ingredients & supplies
                    </p>
                </div>

                {/* 3. Low Stock */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium">Low Stock</span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                            <AlertTriangle size={15} />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
                        {lowStockCount} <span className="text-sm font-normal text-slate-500">Items</span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-amber-700/80">
                        At or below reorder threshold
                    </p>
                </div>

                {/* 4. Out of Stock */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium">Out of Stock</span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                            <AlertCircle size={15} />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
                        {outOfStockCount} <span className="text-sm font-normal text-slate-500">Items</span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-rose-700/80">
                        Requires urgent purchase order
                    </p>
                </div>
            </div>

            {/* CATEGORY INSIGHTS & RECENT STOCK MOVEMENTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                {/* CATEGORY INSIGHTS (1 Col) */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal size={15} className="text-orange-500" />
                            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Category Insights</h3>
                        </div>
                        <span className="text-[11px] text-slate-500">{categoryInsights.length} Categories</span>
                    </div>

                    <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[220px] pr-1">
                        {categoryInsights.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No categories recorded</p>
                        ) : (
                            categoryInsights.map((cat) => (
                                <div key={cat.name} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium text-slate-700">{cat.name}</span>
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <span className="text-slate-400">{cat.count} items</span>
                                            <span className="font-semibold text-slate-900">{formatMoney(cat.value)}</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-orange-500 rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* STOCK MOVEMENTS LOG (2 Cols) */}
                <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                            <History size={15} className="text-orange-500" />
                            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Recent Stock Movement</h3>
                        </div>
                        <span className="text-[11px] text-slate-400">Latest Ledger Activity</span>
                    </div>

                    <div className="overflow-x-auto max-h-[220px]">
                        {ledger.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                No recent stock movement transactions found.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                        <th className="pb-2">Material / SKU</th>
                                        <th className="pb-2">Type</th>
                                        <th className="pb-2">Quantity</th>
                                        <th className="pb-2">Reason / Note</th>
                                        <th className="pb-2 text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {ledger.slice(0, 5).map((entry, idx) => (
                                        <tr key={entry.id || idx} className="hover:bg-slate-50/50">
                                            <td className="py-2 font-medium text-slate-900">
                                                {entry.rawMaterialName || entry.materialName || `Item #${entry.rawMaterialId}`}
                                            </td>
                                            <td className="py-2">
                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    entry.direction === "IN" || entry.type === "RECEIPT"
                                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                                                        : "bg-rose-50 text-rose-600 border border-rose-200/60"
                                                }`}>
                                                    {entry.direction || entry.type || "ADJUST"}
                                                </span>
                                            </td>
                                            <td className="py-2 font-semibold text-slate-900">
                                                {entry.quantity} {entry.unit || "units"}
                                            </td>
                                            <td className="py-2 text-slate-500 max-w-[180px] truncate">
                                                {entry.reason || entry.notes || "Routine update"}
                                            </td>
                                            <td className="py-2 text-right text-slate-400 text-[11px]">
                                                {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* SEARCH & FILTER CONTROLS */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Search inventory items by name or SKU..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                </div>

                {/* Filter Dropdowns */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Category Filter */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-orange-500 transition-all"
                    >
                        {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat === "All" ? "All Categories" : cat}</option>
                        ))}
                    </select>

                    {/* Location Filter */}
                    <select
                        value={selectedLocation}
                        onChange={(e) => {
                            setSelectedLocation(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-orange-500 transition-all"
                    >
                        {LOCATIONS.map((loc) => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select
                        value={selectedStatus}
                        onChange={(e) => {
                            setSelectedStatus(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-orange-500 transition-all"
                    >
                        {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>{st === "All" ? "All Statuses" : st}</option>
                        ))}
                    </select>

                    {/* Unit Filter */}
                    <select
                        value={selectedUnit}
                        onChange={(e) => {
                            setSelectedUnit(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-orange-500 transition-all"
                    >
                        {UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>

                    {/* Reset Filters */}
                    {(searchQuery || selectedCategory !== "All" || selectedLocation !== "All Locations" || selectedStatus !== "All" || selectedUnit !== "All Units") && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedCategory("All");
                                setSelectedLocation("All Locations");
                                setSelectedStatus("All");
                                setSelectedUnit("All Units");
                                setCurrentPage(1);
                            }}
                            className="text-xs text-orange-600 hover:underline px-1 font-medium"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* MASTER INVENTORY CATALOG TABLE */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                            <tr>
                                <th className="py-3 px-3.5">SKU Code</th>
                                <th className="py-3 px-3.5">Material Name</th>
                                <th className="py-3 px-3.5">Category</th>
                                <th className="py-3 px-3.5">Current Stock</th>
                                <th className="py-3 px-3.5">Min Stock</th>
                                <th className="py-3 px-3.5">Unit Cost & Valuation</th>
                                <th className="py-3 px-3.5">Status</th>
                                <th className="py-3 px-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <div className="inline-flex items-center gap-2">
                                            <RefreshCcw size={16} className="animate-spin text-orange-500" />
                                            <span>Loading inventory catalog...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedMaterials.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <Package className="mx-auto mb-2 opacity-40" size={32} />
                                        <p className="font-medium text-slate-600">No inventory materials found</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your search query or filter options.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedMaterials.map((material) => {
                                    const statusObj = getItemStatus(material);
                                    const stockVal = Number(material.currentStock || 0);
                                    const minVal = Number(material.minimumStock || 0);
                                    const costVal = Number(material.costPerUnit || 0);
                                    const totalVal = stockVal * costVal;
                                    const unitLabel = material.displayUnit || material.baseUnit || "kg";

                                    return (
                                        <tr key={material.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-2.5 px-3.5 font-mono text-[11px] font-semibold text-slate-600">
                                                {material.code || `SKU-${material.id}`}
                                            </td>
                                            <td className="py-2.5 px-3.5">
                                                <div className="font-semibold text-slate-900">{material.name}</div>
                                                <div className="text-[11px] text-slate-400">{material.storageLocation || "Main Pantry"}</div>
                                            </td>
                                            <td className="py-2.5 px-3.5">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                                                    {material.category || "General"}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3.5">
                                                <div className="font-bold text-slate-900">
                                                    {stockVal} <span className="font-normal text-slate-500 text-[11px]">{unitLabel}</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3.5 text-slate-500">
                                                {minVal} {unitLabel}
                                            </td>
                                            <td className="py-2.5 px-3.5">
                                                <div className="font-semibold text-slate-900">{formatMoney(totalVal)}</div>
                                                <div className="text-[11px] text-slate-400">{formatMoney(costVal)} / {unitLabel}</div>
                                            </td>
                                            <td className="py-2.5 px-3.5">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusObj.color}`}>
                                                    {statusObj.label}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3.5 text-right">
                                                <div className="inline-flex items-center gap-1 justify-end">
                                                    <button
                                                        type="button"
                                                        title="View Details"
                                                        onClick={() => {
                                                            setSelectedItemForAction(material);
                                                            setShowViewModal(true);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Adjust Stock"
                                                        onClick={() => {
                                                            setSelectedItemForAction(material);
                                                            setAdjustForm({ quantity: "", direction: "IN", reason: "Physical Inventory Adjustment" });
                                                            setShowAdjustModal(true);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                    >
                                                        <ArrowUpDown size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Transfer Zone"
                                                        onClick={() => {
                                                            setSelectedItemForAction(material);
                                                            setTransferForm({ quantity: "", fromZone: material.storageLocation || "Zone A: Dry Pantry", toZone: "Zone B: Cold Room", notes: "" });
                                                            setShowTransferModal(true);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <Truck size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Edit Item"
                                                        onClick={() => {
                                                            setEditingItem(material);
                                                            setItemForm({
                                                                name: material.name || "",
                                                                code: material.code || "",
                                                                category: material.category || "Produce",
                                                                baseUnit: material.baseUnit || "kg",
                                                                displayUnit: material.displayUnit || "kg",
                                                                initialStock: material.currentStock || "",
                                                                minimumStock: material.minimumStock || "",
                                                                costPerUnit: material.costPerUnit || "",
                                                                storageLocation: material.storageLocation || "Zone A: Dry Pantry",
                                                                supplierName: material.supplierName || "FarmFresh Vegetables Co.",
                                                            });
                                                            setShowAddModal(true);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION FOOTER */}
                {filteredMaterials.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-slate-50/50 border-t border-slate-200/80 text-xs text-slate-500">
                        <div>
                            Showing <span className="font-semibold text-slate-900">{((currentPage - 1) * pageSize) + 1}</span> to{" "}
                            <span className="font-semibold text-slate-900">{Math.min(currentPage * pageSize, filteredMaterials.length)}</span> of{" "}
                            <span className="font-semibold text-slate-900">{filteredMaterials.length}</span> materials
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all shadow-2xs"
                            >
                                <ChevronLeft size={14} />
                                Previous
                            </button>
                            <span className="text-slate-600 font-medium px-1">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all shadow-2xs"
                            >
                                Next
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL 1: ADD / EDIT ITEM */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-4 text-xs my-8">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-900 text-base">
                                {editingItem ? "Edit Inventory Material" : "Add New Inventory Material"}
                            </h3>
                            <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveItem} className="space-y-3.5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Material Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Basmati Rice (Premium Grade)"
                                        value={itemForm.name}
                                        onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">SKU / Material Code</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. SKU-BAS-001"
                                        value={itemForm.code}
                                        onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Category</label>
                                    <select
                                        value={itemForm.category}
                                        onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500"
                                    >
                                        {CATEGORIES.filter(c => c !== "All").map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Unit of Measure</label>
                                    <select
                                        value={itemForm.displayUnit}
                                        onChange={(e) => setItemForm({ ...itemForm, displayUnit: e.target.value, baseUnit: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500"
                                    >
                                        {UNITS.filter(u => u !== "All Units").map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Current Stock</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={itemForm.initialStock}
                                        onChange={(e) => setItemForm({ ...itemForm, initialStock: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Min Reorder Threshold</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={itemForm.minimumStock}
                                        onChange={(e) => setItemForm({ ...itemForm, minimumStock: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Cost Per Unit (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={itemForm.costPerUnit}
                                        onChange={(e) => setItemForm({ ...itemForm, costPerUnit: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Storage Location</label>
                                    <select
                                        value={itemForm.storageLocation}
                                        onChange={(e) => setItemForm({ ...itemForm, storageLocation: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500"
                                    >
                                        {STORAGE_LOCATIONS.filter(l => l !== "All Locations").map(l => (
                                            <option key={l} value={l}>{l}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Preferred Supplier</label>
                                    <select
                                        value={itemForm.supplierName}
                                        onChange={(e) => setItemForm({ ...itemForm, supplierName: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500"
                                    >
                                        {SUPPLIERS.filter(s => s !== "All Suppliers").map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 shadow-sm transition-all"
                                >
                                    {editingItem ? "Save Changes" : "Create Material"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: ADJUST STOCK */}
            {showAdjustModal && selectedItemForAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Adjust Stock Level</h3>
                                <p className="text-[11px] text-slate-500">{selectedItemForAction.name}</p>
                            </div>
                            <button type="button" onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAdjustStockSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Adjustment Direction</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustForm({ ...adjustForm, direction: "IN" })}
                                        className={`rounded-xl py-2 font-semibold border text-center transition-all ${
                                            adjustForm.direction === "IN"
                                                ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                                                : "bg-slate-50 text-slate-600 border-slate-200"
                                        }`}
                                    >
                                        + Add Stock (IN)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustForm({ ...adjustForm, direction: "OUT" })}
                                        className={`rounded-xl py-2 font-semibold border text-center transition-all ${
                                            adjustForm.direction === "OUT"
                                                ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                                                : "bg-slate-50 text-slate-600 border-slate-200"
                                        }`}
                                    >
                                        - Remove Stock (OUT)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                                    Quantity ({selectedItemForAction.displayUnit || selectedItemForAction.baseUnit}) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="Enter quantity"
                                    value={adjustForm.quantity}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Reason / Reference</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Physical stock count variance"
                                    value={adjustForm.reason}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowAdjustModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 shadow-sm transition-all">Submit Adjustment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: ZONE TRANSFER */}
            {showTransferModal && selectedItemForAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Zone Stock Transfer</h3>
                                <p className="text-[11px] text-slate-500">{selectedItemForAction.name}</p>
                            </div>
                            <button type="button" onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleTransferSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">From Storage Zone</label>
                                <select
                                    value={transferForm.fromZone}
                                    onChange={(e) => setTransferForm({ ...transferForm, fromZone: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500"
                                >
                                    {STORAGE_LOCATIONS.filter(l => l !== "All Locations").map(l => (
                                        <option key={l} value={l}>{l}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">To Destination Zone</label>
                                <select
                                    value={transferForm.toZone}
                                    onChange={(e) => setTransferForm({ ...transferForm, toZone: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500"
                                >
                                    {STORAGE_LOCATIONS.filter(l => l !== "All Locations").map(l => (
                                        <option key={l} value={l}>{l}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                                    Quantity ({selectedItemForAction.displayUnit || selectedItemForAction.baseUnit}) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="Enter transfer quantity"
                                    value={transferForm.quantity}
                                    onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowTransferModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 shadow-sm transition-all">Confirm Transfer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: PURCHASE ORDER REQUEST */}
            {showPORequestModal && selectedItemForAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Request Purchase Order</h3>
                                <p className="text-[11px] text-slate-500">{selectedItemForAction.name}</p>
                            </div>
                            <button type="button" onClick={() => setShowPORequestModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handlePORequestSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                                    Reorder Quantity ({selectedItemForAction.displayUnit || selectedItemForAction.baseUnit}) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="Enter reorder quantity"
                                    value={poRequestForm.quantity}
                                    onChange={(e) => setPoRequestForm({ ...poRequestForm, quantity: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">Target Supplier</label>
                                <select
                                    value={poRequestForm.supplierName}
                                    onChange={(e) => setPoRequestForm({ ...poRequestForm, supplierName: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500"
                                >
                                    {SUPPLIERS.filter(s => s !== "All Suppliers").map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowPORequestModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 shadow-sm transition-all">Submit PO Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: VIEW ITEM DETAILS */}
            {showViewModal && selectedItemForAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-900 text-base">{selectedItemForAction.name} - Material Details</h3>
                            <button type="button" onClick={() => setShowViewModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                            <div><span className="text-slate-500 font-medium">SKU Code:</span> <strong className="text-slate-900 block mt-0.5">{selectedItemForAction.code || `SKU-${selectedItemForAction.id}`}</strong></div>
                            <div><span className="text-slate-500 font-medium">Category:</span> <strong className="text-slate-900 block mt-0.5">{selectedItemForAction.category || "General"}</strong></div>
                            <div><span className="text-slate-500 font-medium">Current Stock:</span> <strong className="text-slate-900 block mt-0.5">{selectedItemForAction.currentStock} {selectedItemForAction.displayUnit || selectedItemForAction.baseUnit}</strong></div>
                            <div><span className="text-slate-500 font-medium">Min Threshold:</span> <strong className="text-slate-900 block mt-0.5">{selectedItemForAction.minimumStock} {selectedItemForAction.displayUnit || selectedItemForAction.baseUnit}</strong></div>
                            <div><span className="text-slate-500 font-medium">Cost Per Unit:</span> <strong className="text-slate-900 block mt-0.5">{formatMoney(selectedItemForAction.costPerUnit)}</strong></div>
                            <div><span className="text-slate-500 font-medium">Total Valuation:</span> <strong className="text-emerald-600 block mt-0.5">{formatMoney(Number(selectedItemForAction.currentStock || 0) * Number(selectedItemForAction.costPerUnit || 0))}</strong></div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button type="button" onClick={() => setShowViewModal(false)} className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 shadow-sm transition-all">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
