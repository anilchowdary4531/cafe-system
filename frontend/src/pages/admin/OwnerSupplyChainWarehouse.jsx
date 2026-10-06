import React, { useState, useEffect, useMemo } from "react";
import {
    Warehouse,
    Plus,
    Search,
    Filter,
    Clock,
    CheckCircle2,
    XCircle,
    Building2,
    Calendar,
    RefreshCw,
    X,
    Eye,
    AlertTriangle,
    CreditCard,
    DollarSign,
    Receipt,
    History,
    ArrowLeftRight,
    Snowflake,
    Thermometer,
    Package,
    Coffee,
    Boxes,
    Layers,
    Edit3,
    ArrowRight,
    MapPin,
    ShieldAlert,
    TrendingUp,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainWarehouse() {
    const { user } = useAuth();
    const userRole = String(user?.role || "OWNER").toUpperCase();
    const isManagerOrOwner = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN"].includes(userRole);

    const [locations, setLocations] = useState([]);
    const [summary, setSummary] = useState({
        totalLocations: 0,
        totalStockItems: 0,
        totalWarehouseValue: 0,
        totalLowStockCount: 0,
    });
    const [rawMaterials, setRawMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    const [selectedLocation, setSelectedLocation] = useState(null);
    const [detailTab, setDetailTab] = useState("items"); // "items" | "transfers" | "racks"
    const [submitting, setSubmitting] = useState(false);

    // Form States
    const [locationForm, setLocationForm] = useState({
        name: "",
        type: "DRY",
        temperature: "Ambient (20-25°C)",
        capacityValue: 500,
        description: "",
    });

    const [transferForm, setTransferForm] = useState({
        fromLocationId: "",
        toLocationId: "",
        rawMaterialId: "",
        quantity: 1,
        reason: "Internal Stock Transfer",
    });

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const [locRes, matRes] = await Promise.all([
                api.get("/owner/storage-locations").catch(() => ({ data: { locations: [], summary: {} } })),
                api.get("/owner/inventory/movements").catch(() => ({ data: { items: [] } })),
            ]);

            setLocations(locRes.data?.locations || []);
            if (locRes.data?.summary) {
                setSummary(locRes.data.summary);
            }
            setRawMaterials(matRes.data?.items || []);
        } catch (err) {
            showToast.error("Failed to load warehouse & storage location data.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Locations
    const filteredLocations = useMemo(() => {
        return locations.filter((loc) => {
            const q = searchQuery.toLowerCase();
            const name = (loc.name || "").toLowerCase();
            const code = (loc.code || "").toLowerCase();
            const desc = (loc.description || "").toLowerCase();

            const matchesSearch = !q || name.includes(q) || code.includes(q) || desc.includes(q);
            const matchesType = typeFilter === "ALL" || String(loc.type).toUpperCase() === typeFilter.toUpperCase();

            return matchesSearch && matchesType;
        });
    }, [locations, searchQuery, typeFilter]);

    // Create / Edit Location Submit
    const handleSaveLocation = async (e) => {
        e.preventDefault();
        if (!locationForm.name) {
            showToast.error("Location name is required");
            return;
        }

        setSubmitting(true);
        try {
            if (isEditModalOpen && selectedLocation) {
                const res = await api.put(`/owner/storage-locations/${selectedLocation.id}`, locationForm);
                showToast.success(res.data?.message || "Storage location updated!");
                setIsEditModalOpen(false);
            } else {
                const res = await api.post("/owner/storage-locations", locationForm);
                showToast.success(res.data?.message || "Storage location created!");
                setIsCreateModalOpen(false);
            }
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to save storage location");
        } finally {
            setSubmitting(false);
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (loc) => {
        setSelectedLocation(loc);
        setLocationForm({
            name: loc.name || "",
            type: loc.type || "DRY",
            temperature: loc.temperature || "",
            capacityValue: loc.capacityValue || 500,
            description: loc.description || "",
        });
        setIsEditModalOpen(true);
    };

    // Open Transfer Modal
    const handleOpenTransfer = (loc) => {
        setSelectedLocation(loc);
        const otherLoc = locations.find((l) => l.id !== loc.id);
        setTransferForm({
            fromLocationId: loc.id,
            toLocationId: otherLoc ? otherLoc.id : "",
            rawMaterialId: loc.items?.[0]?.rawMaterialId || "",
            quantity: 1,
            reason: "Internal Warehouse Rebalancing",
        });
        setIsTransferModalOpen(true);
    };

    // Handle Transfer Submit
    const handleExecuteTransfer = async (e) => {
        e.preventDefault();
        if (!transferForm.fromLocationId || !transferForm.toLocationId || !transferForm.rawMaterialId) {
            showToast.error("Please fill in source, destination, and item");
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post("/owner/stock-transfers", transferForm);
            showToast.success(res.data?.message || "Stock transfer executed!");
            setIsTransferModalOpen(false);
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to execute stock transfer");
        } finally {
            setSubmitting(false);
        }
    };

    // Icon & Color helper for Location Cards
    const getLocationIcon = (type) => {
        const t = String(type || "DRY").toUpperCase();
        switch (t) {
            case "FREEZER":
                return <Snowflake className="w-5 h-5 text-cyan-400" />;
            case "COLD":
                return <Thermometer className="w-5 h-5 text-blue-400" />;
            case "BEVERAGE":
                return <Coffee className="w-5 h-5 text-amber-400" />;
            case "PACKAGING":
                return <Boxes className="w-5 h-5 text-purple-400" />;
            case "DRY":
            default:
                return <Package className="w-5 h-5 text-orange-400" />;
        }
    };

    const getLocationBorder = (type) => {
        const t = String(type || "DRY").toUpperCase();
        switch (t) {
            case "FREEZER":
                return "border-cyan-500/30 hover:border-cyan-500/60";
            case "COLD":
                return "border-blue-500/30 hover:border-blue-500/60";
            case "BEVERAGE":
                return "border-amber-500/30 hover:border-amber-500/60";
            case "PACKAGING":
                return "border-purple-500/30 hover:border-purple-500/60";
            case "DRY":
            default:
                return "border-orange-500/30 hover:border-orange-500/60";
        }
    };

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* TOP HEADER BAR */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
                                <span>Supply Chain</span>
                                <span>/</span>
                                <span>Warehouse & Storage</span>
                            </div>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
                            <Warehouse className="text-orange-500" size={28} />
                            Warehouse & Storage Locations
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            Enterprise multi-location storage management, zone capacities, stock distribution, and transfers.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchData(true)}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition border border-slate-200 shadow-sm disabled:opacity-50"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? "animate-spin text-orange-500" : ""}`} />
                        </button>

                        {isManagerOrOwner && (
                            <button
                                onClick={() => {
                                    setLocationForm({
                                        name: "",
                                        type: "DRY",
                                        temperature: "Ambient (20-25°C)",
                                        capacityValue: 500,
                                        description: "",
                                    });
                                    setIsCreateModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-sm shadow-sm transition"
                            >
                                <Plus className="w-4 h-4 stroke-[3]" />
                                <span>New Location</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <SupplyChainSubNav />

            {/* TOP 4 SUMMARY METRICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Storage Locations */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Total Storage Locations</span>
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                            <Warehouse className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{summary.totalLocations || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">Active storage zones & cold vaults</div>
                </div>

                {/* Stock Items Managed */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Stock Items Managed</span>
                        <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                            <Package className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{summary.totalStockItems || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">Unique SKUs mapped across zones</div>
                </div>

                {/* Total Inventory Value */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Total Warehouse Value</span>
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                            <DollarSign className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                        ₹{(summary.totalWarehouseValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Current total valuation in stock</div>
                </div>

                {/* Low Stock Alerts */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-rose-600 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Low Stock Items</span>
                        <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-rose-600">{summary.totalLowStockCount || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">Below minimum reorder threshold</div>
                </div>
            </div>

            {/* SEARCH AND FILTER BAR */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search location name, code, description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                    />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs font-medium overflow-x-auto">
                    {["ALL", "DRY", "COLD", "FREEZER", "BEVERAGE", "PACKAGING"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTypeFilter(t)}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                typeFilter === t
                                    ? "bg-amber-500 text-white font-bold shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                            }`}
                        >
                            {t === "ALL" ? "All Zones" : t}
                        </button>
                    ))}
                </div>
            </div>

            {/* STORAGE LOCATION CARDS GRID */}
            {loading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                    <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                    <p className="text-sm">Loading warehouse storage locations...</p>
                </div>
            ) : filteredLocations.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                    <Warehouse className="w-12 h-12 stroke-[1.5] text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-900">No Storage Locations Found</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        No warehouse locations match your filter. Try adjusting your search query.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLocations.map((loc) => {
                        const m = loc.metrics || {};
                        return (
                            <div
                                key={loc.id}
                                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5 transition-all duration-200 hover:shadow-md hover:border-orange-200"
                            >
                                {/* Location Card Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                            {getLocationIcon(loc.type)}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                <span>{loc.name}</span>
                                                {loc.isDefault && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        DEFAULT
                                                    </span>
                                                )}
                                            </h2>
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">{loc.code}</p>
                                        </div>
                                    </div>

                                    {isManagerOrOwner && (
                                        <button
                                            onClick={() => handleOpenEdit(loc)}
                                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200"
                                            title="Edit Location Attributes"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Description & Temp */}
                                <div className="space-y-1 text-xs">
                                    <p className="text-slate-600 line-clamp-2">{loc.description || "Central storage zone"}</p>
                                    {loc.temperature && (
                                        <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                                            <Thermometer className="w-3.5 h-3.5" />
                                            <span>Temp: {loc.temperature}</span>
                                        </div>
                                    )}
                                </div>

                                {/* 4 Metrics Grid Inside Location Card */}
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <div className="text-slate-500 text-[11px] mb-1 font-medium">Stock Items</div>
                                        <div className="text-lg font-bold text-slate-900">{m.stockItemsCount || 0}</div>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <div className="text-slate-500 text-[11px] mb-1 font-medium">Inventory Value</div>
                                        <div className="text-lg font-bold text-emerald-700">
                                            ₹{(m.inventoryValue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <div className="text-slate-500 text-[11px] mb-1 font-medium">Low Stock</div>
                                        <div className={`text-lg font-bold ${m.lowStockCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
                                            {m.lowStockCount || 0}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <div className="text-slate-500 text-[11px] mb-1 font-medium">Expiring Items</div>
                                        <div className="text-lg font-bold text-amber-600">{m.expiringItemsCount || 0}</div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        onClick={() => {
                                            setSelectedLocation(loc);
                                            setDetailTab("items");
                                            setIsDetailModalOpen(true);
                                        }}
                                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-200"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>View Details</span>
                                    </button>

                                    {isManagerOrOwner && (
                                        <button
                                            onClick={() => handleOpenTransfer(loc)}
                                            className="py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 font-semibold text-xs transition-all flex items-center gap-1.5"
                                            title="Transfer stock to another location"
                                        >
                                            <ArrowLeftRight className="w-3.5 h-3.5" />
                                            <span>Transfer</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* LOCATION DETAIL MODAL */}
            {isDetailModalOpen && selectedLocation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
                    <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-xl p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-orange-50 text-orange-600 rounded-lg border border-orange-200">
                                    {getLocationIcon(selectedLocation.type)}
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        <span>{selectedLocation.name}</span>
                                        <span className="text-xs font-mono text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                            {selectedLocation.code}
                                        </span>
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedLocation.description || "Storage location detail"} • Temp:{" "}
                                        {selectedLocation.temperature || "Ambient"}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <button
                                onClick={() => setDetailTab("items")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    detailTab === "items"
                                        ? "bg-orange-500 text-white shadow-2xs"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                }`}
                            >
                                Items Stored ({selectedLocation.items?.length || 0})
                            </button>
                            <button
                                onClick={() => setDetailTab("transfers")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    detailTab === "transfers"
                                        ? "bg-orange-500 text-white shadow-2xs"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                }`}
                            >
                                Transfer History ({selectedLocation.transfers?.length || 0})
                            </button>
                        </div>

                        {/* Tab 1: Items List */}
                        {detailTab === "items" && (
                            <div className="space-y-4">
                                {(!selectedLocation.items || selectedLocation.items.length === 0) ? (
                                    <div className="p-8 text-center text-slate-400 text-xs">
                                        No items currently mapped to this storage location.
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                <tr>
                                                    <th className="py-2.5 px-3.5">Item Name</th>
                                                    <th className="py-2.5 px-3.5">Category</th>
                                                    <th className="py-2.5 px-3.5 text-right">Quantity</th>
                                                    <th className="py-2.5 px-3.5 text-right">Cost/Unit (₹)</th>
                                                    <th className="py-2.5 px-3.5 text-right">Total Value (₹)</th>
                                                    <th className="py-2.5 px-3.5 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                                {selectedLocation.items.map((it) => {
                                                    const isLow = it.quantity <= it.minStock;
                                                    return (
                                                        <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="py-2.5 px-3.5 text-slate-900 font-bold">{it.name}</td>
                                                            <td className="py-2.5 px-3.5 text-slate-500">{it.category}</td>
                                                            <td className="py-2.5 px-3.5 text-right font-bold font-mono text-slate-900">
                                                                {it.quantity} {it.unit}
                                                            </td>
                                                            <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">
                                                                ₹{(it.costPerUnit || 0).toFixed(2)}
                                                            </td>
                                                            <td className="py-2.5 px-3.5 text-right font-bold font-mono text-emerald-600">
                                                                ₹{(it.totalValue || 0).toFixed(2)}
                                                            </td>
                                                            <td className="py-2.5 px-3.5 text-center">
                                                                {isLow ? (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                        LOW STOCK
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                        HEALTHY
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 2: Inter-Location Transfers */}
                        {detailTab === "transfers" && (
                            <div className="space-y-4">
                                {(!selectedLocation.transfers || selectedLocation.transfers.length === 0) ? (
                                    <div className="p-8 text-center text-slate-400 text-xs">
                                        No stock transfers recorded for this location.
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                <tr>
                                                    <th className="py-2.5 px-3.5">Transfer Code</th>
                                                    <th className="py-2.5 px-3.5">Direction</th>
                                                    <th className="py-2.5 px-3.5">Item Name</th>
                                                    <th className="py-2.5 px-3.5 text-right">Quantity</th>
                                                    <th className="py-2.5 px-3.5">Date</th>
                                                    <th className="py-2.5 px-3.5">Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                                {selectedLocation.transfers.map((trf) => (
                                                    <tr key={trf.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="py-2.5 px-3.5 font-mono font-bold text-orange-600">
                                                            {trf.transferCode}
                                                        </td>
                                                        <td className="py-2.5 px-3.5">
                                                            {trf.direction === "OUTGOING" ? (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                    OUTGOING → {trf.toLocation?.name}
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                    INCOMING ← {trf.fromLocation?.name}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3.5 text-slate-900 font-bold">{trf.itemName}</td>
                                                        <td className="py-2.5 px-3.5 text-right font-bold font-mono text-slate-900">
                                                            {trf.quantity} {trf.unit}
                                                        </td>
                                                        <td className="py-2.5 px-3.5 text-slate-500">
                                                            {new Date(trf.createdAt).toLocaleDateString("en-IN")}
                                                        </td>
                                                        <td className="py-2.5 px-3.5 text-slate-500">{trf.reason || "N/A"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CREATE / EDIT LOCATION MODAL */}
            {(isCreateModalOpen || isEditModalOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                    <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Warehouse className="w-5 h-5 text-orange-500" />
                                <h2 className="text-sm font-bold text-slate-900">
                                    {isEditModalOpen ? "Edit Storage Location" : "Create Storage Location"}
                                </h2>
                            </div>
                            <button
                                onClick={() => {
                                    setIsCreateModalOpen(false);
                                    setIsEditModalOpen(false);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveLocation} className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Location Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Cold Storage Vault #2"
                                    value={locationForm.name}
                                    onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                                    required
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Zone Type</label>
                                    <select
                                        value={locationForm.type}
                                        onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
                                    >
                                        <option value="DRY">Dry Storage</option>
                                        <option value="COLD">Cold Storage</option>
                                        <option value="FREEZER">Deep Freezer</option>
                                        <option value="BEVERAGE">Beverage Vault</option>
                                        <option value="PACKAGING">Packaging Store</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Temperature Info</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 2°C to 8°C"
                                        value={locationForm.temperature}
                                        onChange={(e) => setLocationForm({ ...locationForm, temperature: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Capacity (sqft)</label>
                                <input
                                    type="number"
                                    placeholder="500"
                                    value={locationForm.capacityValue}
                                    onChange={(e) => setLocationForm({ ...locationForm, capacityValue: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Description / Purpose</label>
                                <textarea
                                    rows={3}
                                    placeholder="Describe storage conditions, access rules, or contents..."
                                    value={locationForm.description}
                                    onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreateModalOpen(false);
                                        setIsEditModalOpen(false);
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-2xs disabled:opacity-50 cursor-pointer"
                                >
                                    {submitting ? "Saving..." : "Save Location"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* STOCK TRANSFER MODAL */}
            {isTransferModalOpen && selectedLocation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                    <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <ArrowLeftRight className="w-5 h-5 text-orange-500" />
                                <h2 className="text-sm font-bold text-slate-900">Inter-Location Stock Transfer</h2>
                            </div>
                            <button
                                onClick={() => setIsTransferModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleExecuteTransfer} className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">From Source Location</label>
                                <input
                                    type="text"
                                    disabled
                                    value={selectedLocation.name}
                                    className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-900"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">To Destination Location *</label>
                                <select
                                    value={transferForm.toLocationId}
                                    onChange={(e) => setTransferForm({ ...transferForm, toLocationId: e.target.value })}
                                    required
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
                                >
                                    <option value="">Select Destination</option>
                                    {locations
                                        .filter((l) => l.id !== selectedLocation.id)
                                        .map((l) => (
                                            <option key={l.id} value={l.id}>
                                                {l.name} ({l.code})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Item to Transfer *</label>
                                <select
                                    value={transferForm.rawMaterialId}
                                    onChange={(e) => setTransferForm({ ...transferForm, rawMaterialId: e.target.value })}
                                    required
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
                                >
                                    <option value="">Select Item</option>
                                    {(selectedLocation.items || []).map((it) => (
                                        <option key={it.rawMaterialId} value={it.rawMaterialId}>
                                            {it.name} (Available: {it.quantity} {it.unit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Quantity to Transfer *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={transferForm.quantity}
                                    onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                                    required
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Reason for Transfer</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Moved to Kitchen Cold Storage for daily prep"
                                    value={transferForm.reason}
                                    onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsTransferModalOpen(false)}
                                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-2xs disabled:opacity-50 cursor-pointer"
                                >
                                    {submitting ? "Transferring..." : "Execute Transfer"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
