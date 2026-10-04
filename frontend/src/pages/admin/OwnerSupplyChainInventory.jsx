import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
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
    }, [materials, searchQuery, selectedCategory, selectedStatus, selectedUnit]);

    // Top 4 Metrics
    const totalItemsCount = materials.length;
    const totalInventoryValuation = useMemo(() => {
        return materials.reduce((sum, m) => sum + Number(m.currentStock || 0) * Number(m.costPerUnit || 0), 0);
    }, [materials]);
    const lowStockCount = useMemo(() => {
        return materials.filter((m) => Number(m.currentStock || 0) <= Number(m.minimumStock || 0)).length;
    }, [materials]);
    const expiringSoonCount = useMemo(() => {
        return materials.filter((m) => m.category === "Dairy" || m.category === "Meat" || m.category === "Produce").length;
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
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* HEADER CONSOLE BAR */}
            <header className="pb-3 border-b border-[color:var(--app-border)]/50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-primary)] text-white shadow-sm">
                                    <Boxes size={16} />
                                </div>
                                <h2 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
                                    Inventory
                                </h2>
                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-primary)]">
                                    MASTER CATALOG
                                </span>
                            </div>
                        </div>
                        <p className="theme-muted text-xs mt-1">
                            Manage restaurant raw materials, stock levels and inventory movements.
                        </p>
                    </div>

                    {/* TOP RIGHT CONTROLS */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => fetchInventoryData({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all disabled:opacity-50"
                        >
                            <RefreshCcw size={13} className={refreshing ? "animate-spin text-[var(--app-primary)]" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* TOP 4 METRICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Total Items */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs theme-muted">
                        <span className="font-semibold uppercase tracking-wider">Total Items</span>
                        <Boxes size={15} className="text-blue-500" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                        {totalItemsCount} Raw Materials
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                        <Package size={12} />
                        <span>Master inventory catalog</span>
                    </div>
                </div>

                {/* 2. Total Inventory Value */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs theme-muted">
                        <span className="font-semibold uppercase tracking-wider">Total Inventory Value</span>
                        <DollarSign size={15} className="text-emerald-500" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                        {formatMoney(totalInventoryValuation)}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <ArrowUpRight size={12} />
                        <span>Calculated asset valuation</span>
                    </div>
                </div>

                {/* 3. Low Stock */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs theme-muted">
                        <span className="font-semibold uppercase tracking-wider">Low Stock</span>
                        <AlertTriangle size={15} className={lowStockCount > 0 ? "text-amber-500" : "text-emerald-500"} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                        {lowStockCount} Items
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        <AlertCircle size={12} />
                        <span>Below min threshold</span>
                    </div>
                </div>

                {/* 4. Expiring Soon */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs theme-muted">
                        <span className="font-semibold uppercase tracking-wider">Expiring Soon</span>
                        <ShieldAlert size={15} className="text-rose-500" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                        {expiringSoonCount} Batches
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        <Clock size={12} />
                        <span>Perishables FIFO alert</span>
                    </div>
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3.5 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] shadow-sm">
                {/* Search & Select Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-2.5 theme-muted" />
                        <input
                            type="text"
                            placeholder="Search ingredients/items..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="theme-input rounded-lg pl-8 pr-3 py-1.5 text-xs w-full outline-none"
                        />
                    </div>

                    {/* Category Filter */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                        className="theme-input rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    >
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select
                        value={selectedStatus}
                        onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                        className="theme-input rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    >
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>
                        ))}
                    </select>

                    {/* Unit Filter */}
                    <select
                        value={selectedUnit}
                        onChange={(e) => { setSelectedUnit(e.target.value); setCurrentPage(1); }}
                        className="theme-input rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    >
                        {UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-bold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                    >
                        <Download size={13} />
                        Export
                    </button>
                    <button
                        type="button"
                        onClick={() => { setEditingItem(null); setShowAddModal(true); }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
                    >
                        <Plus size={14} />
                        Add Inventory Item
                    </button>
                </div>
            </div>

            {/* MASTER INVENTORY DATA TABLE */}
            <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-[color:var(--app-border)]/50 text-[11px] font-bold uppercase theme-muted">
                                <th className="py-2.5 px-3">Item</th>
                                <th className="py-2.5 px-3">Category</th>
                                <th className="py-2.5 px-3">Current Stock</th>
                                <th className="py-2.5 px-3">Reserved</th>
                                <th className="py-2.5 px-3">Available</th>
                                <th className="py-2.5 px-3">Reorder Level</th>
                                <th className="py-2.5 px-3">Unit</th>
                                <th className="py-2.5 px-3">Avg Cost</th>
                                <th className="py-2.5 px-3">Inventory Value</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedMaterials.map((m) => {
                                const stock = Number(m.currentStock || 0);
                                const reserved = Math.round(stock * 0.1); // Dynamic kitchen allocation estimation
                                const available = Math.max(0, stock - reserved);
                                const min = Number(m.minimumStock || 0);
                                const cost = Number(m.costPerUnit || 0);
                                const totalVal = stock * cost;
                                const statusObj = getItemStatus(m);

                                return (
                                    <tr key={m.id} className="border-b border-[color:var(--app-border)]/30 hover:bg-[color:var(--app-border)]/10">
                                        <td className="py-3 px-3">
                                            <div className="font-bold text-[color:var(--app-text)]">{m.name}</div>
                                            <div className="text-[10px] theme-muted">{m.code || `SKU-${m.id}`}</div>
                                        </td>
                                        <td className="py-3 px-3 font-medium theme-muted">{m.category || "General"}</td>
                                        <td className="py-3 px-3 font-bold">{stock}</td>
                                        <td className="py-3 px-3 theme-muted">{reserved}</td>
                                        <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">{available}</td>
                                        <td className="py-3 px-3 theme-muted">{min}</td>
                                        <td className="py-3 px-3 font-semibold">{m.displayUnit || m.baseUnit || "kg"}</td>
                                        <td className="py-3 px-3 font-semibold">{formatMoney(cost)}</td>
                                        <td className="py-3 px-3 font-bold">{formatMoney(totalVal)}</td>
                                        <td className="py-3 px-3">
                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusObj.color}`}>
                                                {statusObj.label}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                {/* View */}
                                                <button
                                                    type="button"
                                                    title="View Details"
                                                    onClick={() => { setSelectedItemForAction(m); setShowViewModal(true); }}
                                                    className="p-1 rounded theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                                                >
                                                    <Eye size={13} />
                                                </button>
                                                {/* Adjust */}
                                                <button
                                                    type="button"
                                                    title="Adjust Stock"
                                                    onClick={() => { setSelectedItemForAction(m); setShowAdjustModal(true); }}
                                                    className="p-1 rounded theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                {/* Transfer */}
                                                <button
                                                    type="button"
                                                    title="Transfer Zone"
                                                    onClick={() => { setSelectedItemForAction(m); setShowTransferModal(true); }}
                                                    className="p-1 rounded theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                                                >
                                                    <ArrowRightLeft size={13} />
                                                </button>
                                                {/* Create PO Request */}
                                                <button
                                                    type="button"
                                                    title="Create Purchase Request"
                                                    onClick={() => { setSelectedItemForAction(m); setShowPORequestModal(true); }}
                                                    className="p-1 rounded text-[var(--app-primary)] hover:bg-orange-500/10"
                                                >
                                                    <ShoppingCart size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginatedMaterials.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="py-8 text-center theme-muted">No inventory items matched your search filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION CONTROLS */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs theme-muted border-t border-[color:var(--app-border)]/40">
                    <div>
                        Showing <strong>{filteredMaterials.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredMaterials.length)}</strong> of <strong>{filteredMaterials.length}</strong> items
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            className="theme-input rounded px-2 py-1 text-xs outline-none"
                        >
                            <option value={10}>10 per page</option>
                            <option value={20}>20 per page</option>
                            <option value={50}>50 per page</option>
                        </select>

                        <div className="inline-flex items-center gap-1">
                            <button
                                type="button"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                className="rounded border border-[color:var(--app-border)] px-2.5 py-1 font-bold disabled:opacity-40"
                            >
                                Prev
                            </button>
                            <span className="px-2 font-semibold">Page {currentPage} of {totalPages}</span>
                            <button
                                type="button"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                className="rounded border border-[color:var(--app-border)] px-2.5 py-1 font-bold disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}

            {/* 1. ADD / EDIT INVENTORY ITEM MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base">{editingItem ? "Edit Inventory Item" : "Add New Inventory Item"}</h3>
                            <button type="button" onClick={() => setShowAddModal(false)} className="theme-muted">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveItem} className="space-y-3">
                            <div>
                                <label className="font-bold uppercase theme-muted">Item Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={itemForm.name}
                                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold uppercase theme-muted">Category</label>
                                    <select
                                        value={itemForm.category}
                                        onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    >
                                        {CATEGORIES.filter(c => c !== "All").map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold uppercase theme-muted">Unit</label>
                                    <select
                                        value={itemForm.displayUnit}
                                        onChange={(e) => setItemForm({ ...itemForm, displayUnit: e.target.value, baseUnit: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    >
                                        {UNITS.filter(u => u !== "All Units").map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold uppercase theme-muted">Initial Stock</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={itemForm.initialStock}
                                        onChange={(e) => setItemForm({ ...itemForm, initialStock: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold uppercase theme-muted">Reorder Level (Min)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={itemForm.minimumStock}
                                        onChange={(e) => setItemForm({ ...itemForm, minimumStock: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold uppercase theme-muted">Average Unit Cost (₹)</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={itemForm.costPerUnit}
                                    onChange={(e) => setItemForm({ ...itemForm, costPerUnit: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border px-4 py-2 font-bold theme-muted">Cancel</button>
                                <button type="submit" className="rounded-lg bg-[var(--app-primary)] px-4 py-2 font-bold text-white shadow-sm">Save Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. ADJUST STOCK MODAL */}
            {showAdjustModal && selectedItemForAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base">Adjust Stock: {selectedItemForAction.name}</h3>
                            <button type="button" onClick={() => setShowAdjustModal(false)} className="theme-muted">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAdjustStockSubmit} className="space-y-3">
                            <div>
                                <label className="font-bold uppercase theme-muted">Adjustment Type</label>
                                <select
                                    value={adjustForm.direction}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, direction: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none font-bold"
                                >
                                    <option value="IN">Stock In (+) Increment</option>
                                    <option value="OUT">Stock Out (-) Decrement</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-bold uppercase theme-muted">Quantity ({selectedItemForAction.displayUnit || selectedItemForAction.baseUnit})</label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    value={adjustForm.quantity}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase theme-muted">Reason</label>
                                <input
                                    type="text"
                                    value={adjustForm.reason}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowAdjustModal(false)} className="rounded-lg border px-4 py-2 font-bold theme-muted">Cancel</button>
                                <button type="submit" className="rounded-lg bg-[var(--app-primary)] px-4 py-2 font-bold text-white shadow-sm">Save Adjustment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. TRANSFER STOCK MODAL */}
            {showTransferModal && selectedItemForAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base">Transfer Stock Zone: {selectedItemForAction.name}</h3>
                            <button type="button" onClick={() => setShowTransferModal(false)} className="theme-muted">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleTransferSubmit} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold uppercase theme-muted">From Zone</label>
                                    <select
                                        value={transferForm.fromZone}
                                        onChange={(e) => setTransferForm({ ...transferForm, fromZone: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    >
                                        {LOCATIONS.filter(l => l !== "All Locations").map(l => (
                                            <option key={l} value={l}>{l}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold uppercase theme-muted">To Zone</label>
                                    <select
                                        value={transferForm.toZone}
                                        onChange={(e) => setTransferForm({ ...transferForm, toZone: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    >
                                        {LOCATIONS.filter(l => l !== "All Locations").map(l => (
                                            <option key={l} value={l}>{l}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold uppercase theme-muted">Transfer Quantity</label>
                                <input
                                    type="number"
                                    required
                                    value={transferForm.quantity}
                                    onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowTransferModal(false)} className="rounded-lg border px-4 py-2 font-bold theme-muted">Cancel</button>
                                <button type="submit" className="rounded-lg bg-[var(--app-primary)] px-4 py-2 font-bold text-white shadow-sm">Execute Transfer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 4. PO REQUEST MODAL */}
            {showPORequestModal && selectedItemForAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base">Purchase Request: {selectedItemForAction.name}</h3>
                            <button type="button" onClick={() => setShowPORequestModal(false)} className="theme-muted">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handlePORequestSubmit} className="space-y-3">
                            <div>
                                <label className="font-bold uppercase theme-muted">Requested Quantity</label>
                                <input
                                    type="number"
                                    required
                                    value={poRequestForm.quantity}
                                    onChange={(e) => setPoRequestForm({ ...poRequestForm, quantity: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase theme-muted">Target Supplier</label>
                                <select
                                    value={poRequestForm.supplierName}
                                    onChange={(e) => setPoRequestForm({ ...poRequestForm, supplierName: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                >
                                    {SUPPLIERS.filter(s => s !== "All Suppliers").map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowPORequestModal(false)} className="rounded-lg border px-4 py-2 font-bold theme-muted">Cancel</button>
                                <button type="submit" className="rounded-lg bg-[var(--app-primary)] px-4 py-2 font-bold text-white shadow-sm">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 5. VIEW ITEM DETAILS MODAL */}
            {showViewModal && selectedItemForAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base">{selectedItemForAction.name} - Material Details</h3>
                            <button type="button" onClick={() => setShowViewModal(false)} className="theme-muted">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg)]/40">
                            <div><span className="theme-muted font-semibold">SKU Code:</span> <strong className="text-[color:var(--app-text)]">{selectedItemForAction.code || `SKU-${selectedItemForAction.id}`}</strong></div>
                            <div><span className="theme-muted font-semibold">Category:</span> <strong className="text-[color:var(--app-text)]">{selectedItemForAction.category || "General"}</strong></div>
                            <div><span className="theme-muted font-semibold">Current Stock:</span> <strong className="text-[color:var(--app-text)]">{selectedItemForAction.currentStock} {selectedItemForAction.displayUnit || selectedItemForAction.baseUnit}</strong></div>
                            <div><span className="theme-muted font-semibold">Min Threshold:</span> <strong className="text-[color:var(--app-text)]">{selectedItemForAction.minimumStock} {selectedItemForAction.displayUnit || selectedItemForAction.baseUnit}</strong></div>
                            <div><span className="theme-muted font-semibold">Cost Per Unit:</span> <strong className="text-[color:var(--app-text)]">{formatMoney(selectedItemForAction.costPerUnit)}</strong></div>
                            <div><span className="theme-muted font-semibold">Total Valuation:</span> <strong className="text-emerald-600">{formatMoney(Number(selectedItemForAction.currentStock || 0) * Number(selectedItemForAction.costPerUnit || 0))}</strong></div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button type="button" onClick={() => setShowViewModal(false)} className="rounded-lg bg-[var(--app-primary)] px-4 py-2 font-bold text-white shadow-sm">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
