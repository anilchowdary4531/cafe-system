import { useEffect, useMemo, useState } from "react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useStaffSocket } from "../../context/StaffSocketContext";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import { Package, AlertTriangle, Plus, Search, Layers, RefreshCw, FileSpreadsheet, ArrowUpRight, ArrowDownRight, DollarSign, History, Settings2, Trash2, Edit3, CheckCircle } from "lucide-react";

const CATEGORIES = ["All", "Produce", "Meat", "Dairy", "Dry Goods", "Beverages", "Spices", "Packaging", "General"];
const UNITS = [
    { value: "g", label: "Grams (g)" },
    { value: "kg", label: "Kilograms (kg)" },
    { value: "ml", label: "Milliliters (ml)" },
    { value: "L", label: "Liters (L)" },
    { value: "pcs", label: "Pieces (pcs)" },
    { value: "dozen", label: "Dozen (12 pcs)" },
];

export default function OwnerInventory() {
    const { socket } = useStaffSocket();

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = user?.restaurantId;

    // Main State
    const [activeTab, setActiveTab] = useState("materials"); // "materials" | "recipes" | "purchases" | "adjustments" | "ledger" | "reports"
    const [materials, setMaterials] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");

    // Modals & Form State
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [materialForm, setMaterialForm] = useState({
        name: "",
        code: "",
        category: "Produce",
        baseUnit: "g",
        displayUnit: "kg",
        initialStock: 0,
        minimumStock: 5,
        costPerUnit: 0,
    });

    // Recipe BOM Studio State
    const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [recipeItems, setRecipeItems] = useState([]);
    const [recipeCost, setRecipeCost] = useState(null);
    const [savingRecipe, setSavingRecipe] = useState(false);

    // Purchase / Stock-In State
    const [purchaseForm, setPurchaseForm] = useState({
        rawMaterialId: "",
        quantity: "",
        unit: "kg",
        totalCost: "",
        supplierName: "",
        notes: "",
    });
    const [submittingPurchase, setSubmittingPurchase] = useState(false);

    // Adjustment / Wastage State
    const [adjForm, setAdjForm] = useState({
        rawMaterialId: "",
        quantity: "",
        unit: "kg",
        direction: "IN", // "IN" or "OUT"
        reason: "Physical count correction",
    });
    const [wastageForm, setWastageForm] = useState({
        rawMaterialId: "",
        quantity: "",
        unit: "kg",
        reason: "Spoilage / Preparation Waste",
    });

    // Settings
    const [allowNegativeStock, setAllowNegativeStock] = useState(true);

    // API Loaders
    const loadMaterials = async () => {
        if (!restaurantId || isNaN(Number(restaurantId))) return;
        try {
            setLoading(true);
            const res = await api.get(`/owner/${restaurantId}/inventory/materials`, {
                params: { search, category: categoryFilter },
            });
            const mats = res.data?.materials || res.data?.data || (Array.isArray(res.data) ? res.data : []);
            setMaterials(Array.isArray(mats) ? mats : []);
        } catch (err) {
            console.error("Error loading raw materials:", err);
            showToast({ title: "Error", message: err?.response?.data?.message || "Failed to load raw materials", variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    const loadMenuItems = async () => {
        if (!restaurantId || isNaN(Number(restaurantId))) return;
        try {
            const res = await api.get(`/owner/${restaurantId}/menu`);
            setMenuItems(res.data || []);
        } catch (err) {
            console.error("Error loading menu items:", err);
        }
    };

    const loadLedger = async () => {
        if (!restaurantId || isNaN(Number(restaurantId))) return;
        try {
            const res = await api.get(`/owner/${restaurantId}/inventory/ledger`, { params: { limit: 50 } });
            setLedger(res.data?.movements || res.data || []);
        } catch (err) {
            console.error("Error loading ledger:", err);
        }
    };

    const loadReport = async () => {
        if (!restaurantId || isNaN(Number(restaurantId))) return;
        try {
            const res = await api.get(`/owner/${restaurantId}/inventory/reports`);
            setReport(res.data?.report || res.data || null);
        } catch (err) {
            console.error("Error loading report:", err);
        }
    };

    useEffect(() => {
        loadMaterials();
        loadMenuItems();
        loadLedger();
        loadReport();
    }, [restaurantId, search, categoryFilter]);

    // Socket.IO Sync
    useEffect(() => {
        if (!socket) return undefined;
        const onStockUpdated = () => {
            loadMaterials();
            loadLedger();
            loadReport();
        };
        socket.on("inventory:stock-updated", onStockUpdated);
        return () => socket.off("inventory:stock-updated", onStockUpdated);
    }, [socket]);

    // Material Form Submissions
    const handleSaveMaterial = async (e) => {
        e.preventDefault();
        if (!materialForm.name.trim()) {
            showToast({ title: "Validation Error", message: "Material name is required", variant: "warning" });
            return;
        }

        try {
            if (editingMaterial) {
                await api.put(`/owner/${restaurantId}/inventory/materials/${editingMaterial.id}`, materialForm);
                showToast({ title: "Updated", message: "Material updated successfully", variant: "success" });
            } else {
                await api.post(`/owner/${restaurantId}/inventory/materials`, materialForm);
                showToast({ title: "Created", message: "Raw material added successfully", variant: "success" });
            }
            setShowMaterialModal(false);
            setEditingMaterial(null);
            setMaterialForm({
                name: "",
                code: "",
                category: "Produce",
                baseUnit: "g",
                displayUnit: "kg",
                initialStock: 0,
                minimumStock: 5,
                costPerUnit: 0,
            });
            await loadMaterials();
        } catch (err) {
            console.error("Error saving raw material:", err);
            showToast({ title: "Save Error", message: err?.response?.data?.message || "Failed to save raw material", variant: "error" });
        }
    };

    const handleDeleteMaterial = async (id) => {
        if (!window.confirm("Archive this raw material? Historical stock movements will be preserved.")) return;
        try {
            await api.delete(`/owner/${restaurantId}/inventory/materials/${id}`);
            showToast({ title: "Archived", message: "Raw material archived", variant: "success" });
            await loadMaterials();
        } catch (err) {
            console.error("Error archiving material:", err);
            showToast({ title: "Error", message: err?.response?.data?.message || "Failed to archive raw material", variant: "error" });
        }
    };

    // Recipe Studio Selection
    const selectedMenuItem = useMemo(() => {
        return menuItems.find((m) => String(m.id) === String(selectedMenuItemId));
    }, [menuItems, selectedMenuItemId]);

    const handleSelectMenuItem = (mId) => {
        setSelectedMenuItemId(mId);
        setSelectedVariantId("");
        const item = menuItems.find((m) => String(m.id) === String(mId));
        if (item && item.recipes && item.recipes.length > 0) {
            const r = item.recipes[0];
            setRecipeItems((r.items || []).map((i) => ({
                rawMaterialId: i.rawMaterialId,
                quantity: i.quantity,
                unit: i.unit,
                wastagePercent: i.wastagePercent || 0,
            })));
        } else {
            setRecipeItems([]);
        }
    };

    const handleAddRecipeIngredient = () => {
        if (!materials.length) {
            showToast({ title: "No Ingredients", message: "Please create raw materials first", variant: "warning" });
            return;
        }
        const firstRm = materials[0];
        setRecipeItems((prev) => [
            ...prev,
            { rawMaterialId: firstRm.id, quantity: 100, unit: firstRm.displayUnit || firstRm.baseUnit, wastagePercent: 0 },
        ]);
    };

    const handleSaveRecipe = async () => {
        if (!selectedMenuItemId) {
            showToast({ title: "Validation Error", message: "Please select a Menu Item", variant: "warning" });
            return;
        }

        try {
            setSavingRecipe(true);
            await api.post(`/owner/${restaurantId}/inventory/recipes`, {
                menuItemId: Number(selectedMenuItemId),
                variantId: selectedVariantId ? Number(selectedVariantId) : null,
                items: recipeItems,
            });
            showToast({ title: "Recipe Saved", message: "Recipe / BOM updated successfully", variant: "success" });
            await loadMenuItems();
        } catch (err) {
            console.error("Error saving recipe:", err);
            showToast({ title: "Recipe Error", message: err?.response?.data?.message || "Failed to save recipe", variant: "error" });
        } finally {
            setSavingRecipe(false);
        }
    };

    // Stock-In Submit
    const handlePurchaseSubmit = async (e) => {
        e.preventDefault();
        if (!purchaseForm.rawMaterialId || !purchaseForm.quantity) {
            showToast({ title: "Validation", message: "Select ingredient and enter quantity", variant: "warning" });
            return;
        }

        try {
            setSubmittingPurchase(true);
            await api.post(`/owner/${restaurantId}/inventory/stock-in`, purchaseForm);
            showToast({ title: "Stock Received", message: "Stock-in logged successfully", variant: "success" });
            setPurchaseForm({ rawMaterialId: "", quantity: "", unit: "kg", totalCost: "", supplierName: "", notes: "" });
            await loadMaterials();
            await loadLedger();
        } catch (err) {
            console.error("Error logging stock-in:", err);
            showToast({ title: "Stock-In Error", message: err?.response?.data?.message || "Failed to log stock-in", variant: "error" });
        } finally {
            setSubmittingPurchase(false);
        }
    };

    // Adjustment Submit
    const handleAdjustmentSubmit = async (e) => {
        e.preventDefault();
        if (!adjForm.rawMaterialId || !adjForm.quantity) return;

        try {
            await api.post(`/owner/${restaurantId}/inventory/adjustments`, adjForm);
            showToast({ title: "Stock Adjusted", message: "Stock correction saved", variant: "success" });
            setAdjForm({ rawMaterialId: "", quantity: "", unit: "kg", direction: "IN", reason: "Physical count correction" });
            await loadMaterials();
            await loadLedger();
        } catch (err) {
            showToast({ title: "Error", message: err?.response?.data?.message || "Failed adjustment", variant: "error" });
        }
    };

    // Wastage Submit
    const handleWastageSubmit = async (e) => {
        e.preventDefault();
        if (!wastageForm.rawMaterialId || !wastageForm.quantity) return;

        try {
            await api.post(`/owner/${restaurantId}/inventory/wastage`, wastageForm);
            showToast({ title: "Wastage Logged", message: "Kitchen waste recorded", variant: "success" });
            setWastageForm({ rawMaterialId: "", quantity: "", unit: "kg", reason: "Spoilage / Preparation Waste" });
            await loadMaterials();
            await loadLedger();
        } catch (err) {
            showToast({ title: "Error", message: err?.response?.data?.message || "Failed wastage entry", variant: "error" });
        }
    };

    return (
        <div className="px-1 py-1 w-full flex flex-col gap-3.5 text-[color:var(--app-text)] font-sans">
            {/* Page Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                <div>
                    <div className="flex items-center gap-3">
                        <OwnerMenuButton />
                        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-[color:var(--app-heading)] sm:text-2xl">
                            <Package className="text-orange-500" size={24} /> Raw Material Inventory & BOM
                        </h1>
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--app-muted)]">
                        Manage ingredient master, recipes, stock-ins, kitchen wastage, and automatic order consumption.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setEditingMaterial(null);
                            setMaterialForm({
                                name: "",
                                code: "",
                                category: "Produce",
                                baseUnit: "g",
                                displayUnit: "kg",
                                initialStock: 0,
                                minimumStock: 5,
                                costPerUnit: 0,
                            });
                            setShowMaterialModal(true);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-black transition hover:bg-orange-400"
                    >
                        <Plus size={16} /> Add Raw Material
                    </button>
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 border-b border-[color:var(--app-border)]/40 pb-3">
                <div className="p-2">
                    <div className="flex items-center justify-between theme-muted">
                        <span className="text-xs font-bold">Total Materials</span>
                        <Package size={15} className="text-orange-500" />
                    </div>
                    <p className="mt-1 text-2xl font-black text-[color:var(--app-text)]">{report?.totalMaterials || materials.length}</p>
                </div>
                <div className="p-2">
                    <div className="flex items-center justify-between text-amber-500">
                        <span className="text-xs font-bold">Low Stock Alert</span>
                        <AlertTriangle size={15} />
                    </div>
                    <p className="mt-1 text-2xl font-black text-amber-500">{report?.lowStockCount || 0}</p>
                </div>
                <div className="p-2">
                    <div className="flex items-center justify-between text-red-500">
                        <span className="text-xs font-bold">Out of Stock</span>
                        <AlertTriangle size={15} />
                    </div>
                    <p className="mt-1 text-2xl font-black text-red-500">{report?.outOfStockCount || 0}</p>
                </div>
                <div className="p-2">
                    <div className="flex items-center justify-between text-emerald-500">
                        <span className="text-xs font-bold">Inventory Valuation</span>
                        <DollarSign size={15} />
                    </div>
                    <p className="mt-1 text-2xl font-black text-emerald-500">
                        ₹{(report?.totalValuation || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[color:var(--app-border)]/40 scrollbar-none">
                {[
                    { id: "materials", label: "📦 Raw Materials", icon: Package },
                    { id: "recipes", label: "🍕 Recipe / BOM Studio", icon: Layers },
                    { id: "purchases", label: "📥 Stock-In & Purchases", icon: ArrowDownRight },
                    { id: "adjustments", label: "⚖️ Adjustments & Wastage", icon: RefreshCw },
                    { id: "ledger", label: "📜 Movement Ledger", icon: History },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            activeTab === tab.id
                                ? "bg-[color:var(--app-primary)] text-white shadow-xs"
                                : "text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: RAW MATERIALS MASTER */}
            {activeTab === "materials" && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-muted" size={15} />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search raw material name, code, or category..."
                                className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent py-2 pl-9 pr-3 text-xs text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-muted)]"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-3 py-2 text-xs text-[color:var(--app-text)] outline-none"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>Category: {c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto border-b border-[color:var(--app-border)]/40 pb-2">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-[color:var(--app-border)]/40 theme-muted font-bold uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="py-2 px-3">Material Name</th>
                                        <th className="py-2 px-3">Category</th>
                                        <th className="py-2 px-3">Current Stock</th>
                                        <th className="py-2 px-3">Reorder Level</th>
                                        <th className="py-2 px-3">Cost / Unit</th>
                                        <th className="py-2 px-3">Status</th>
                                        <th className="py-2 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[color:var(--app-border)]/30 text-[color:var(--app-text)]">
                                    {loading ? (
                                        <tr><td colSpan="7" className="p-6 text-center text-gray-400">Loading raw materials...</td></tr>
                                    ) : materials.length === 0 ? (
                                        <tr><td colSpan="7" className="p-6 text-center text-gray-400">No raw materials found. Add your first ingredient above.</td></tr>
                                    ) : (
                                        materials.map((rm) => (
                                            <tr key={rm.id} className="hover:bg-white/5 transition">
                                                <td className="p-3.5 font-bold text-white">
                                                    {rm.name}
                                                    {rm.code && <span className="ml-2 text-[10px] font-mono text-gray-400">({rm.code})</span>}
                                                </td>
                                                <td className="p-3.5">{rm.category}</td>
                                                <td className="p-3.5 font-extrabold text-white tabular-nums">
                                                    {rm.formattedCurrentStock}
                                                </td>
                                                <td className="p-3.5 text-gray-400 tabular-nums">
                                                    {rm.formattedMinimumStock}
                                                </td>
                                                <td className="p-3.5 text-emerald-400 font-semibold tabular-nums">
                                                    ₹{Number(rm.unitCost || 0).toFixed(2)} / {rm.displayUnit || rm.baseUnit}
                                                </td>
                                                <td className="p-3.5">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${
                                                        rm.status === "OUT_OF_STOCK"
                                                            ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                                            : rm.status === "LOW_STOCK"
                                                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                                    }`}>
                                                        {rm.status.replace(/_/g, " ")}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingMaterial(rm);
                                                                setMaterialForm({
                                                                    name: rm.name,
                                                                    code: rm.code || "",
                                                                    category: rm.category || "Produce",
                                                                    baseUnit: rm.baseUnit,
                                                                    displayUnit: rm.displayUnit || rm.baseUnit,
                                                                    minimumStock: rm.displayMinimumStock || 0,
                                                                    costPerUnit: rm.unitCost || 0,
                                                                });
                                                                setShowMaterialModal(true);
                                                            }}
                                                            className="rounded-lg p-1.5 text-gray-300 hover:bg-white/10 hover:text-white"
                                                            title="Edit Material"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteMaterial(rm.id)}
                                                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20"
                                                            title="Archive Material"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: RECIPE / BOM STUDIO */}
            {activeTab === "recipes" && (
                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                    {/* Menu Item Selector List */}
                    <div className="rounded-2xl border border-white/10 bg-[#111827] p-4 space-y-3">
                        <h2 className="text-sm font-extrabold text-orange-400 uppercase tracking-wider">Select Menu Item</h2>
                        <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1">
                            {menuItems.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectMenuItem(item.id)}
                                    className={`w-full text-left rounded-xl p-3 text-xs transition flex items-center justify-between ${
                                        String(selectedMenuItemId) === String(item.id)
                                            ? "bg-orange-500/20 border border-orange-500/50 text-white font-bold"
                                            : "bg-white/5 text-gray-300 hover:bg-white/10"
                                    }`}
                                >
                                    <span>{item.name}</span>
                                    {item.recipes && item.recipes.length > 0 && (
                                        <span className="text-[10px] rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 font-bold">
                                            v{item.recipes[0].version} BOM
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* BOM Builder Form */}
                    <div className="rounded-2xl border border-white/10 bg-[#111827] p-5 space-y-4">
                        {selectedMenuItem ? (
                            <>
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                    <div>
                                        <h2 className="text-lg font-black text-white">{selectedMenuItem.name}</h2>
                                        <p className="text-xs text-gray-400">Category: {selectedMenuItem.category} • Base Price: ₹{selectedMenuItem.price}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddRecipeIngredient}
                                        className="rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30 px-3 py-1.5 text-xs font-bold flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Add Ingredient
                                    </button>
                                </div>

                                {/* Ingredient Lines */}
                                <div className="space-y-3">
                                    {recipeItems.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-white/10 rounded-xl">
                                            No ingredients added yet. Click "+ Add Ingredient" above to create recipe BOM.
                                        </div>
                                    ) : (
                                        recipeItems.map((line, idx) => (
                                            <div key={idx} className="grid grid-cols-12 gap-2 items-center rounded-xl bg-black/30 p-2.5 border border-white/5">
                                                <div className="col-span-5">
                                                    <label className="text-[10px] text-gray-400 font-semibold">Raw Material:</label>
                                                    <select
                                                        value={line.rawMaterialId}
                                                        onChange={(e) => {
                                                            const val = Number(e.target.value);
                                                            const targetRm = materials.find((m) => m.id === val);
                                                            setRecipeItems((prev) => {
                                                                const next = [...prev];
                                                                next[idx].rawMaterialId = val;
                                                                if (targetRm) next[idx].unit = targetRm.displayUnit || targetRm.baseUnit;
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-full rounded-lg bg-[#0f172a] border border-white/10 px-2.5 py-1.5 text-xs text-white outline-none"
                                                    >
                                                        {materials.map((m) => (
                                                            <option key={m.id} value={m.id}>{m.name} ({m.displayUnit || m.baseUnit})</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="col-span-3">
                                                    <label className="text-[10px] text-gray-400 font-semibold">Quantity:</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.quantity}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setRecipeItems((prev) => {
                                                                const next = [...prev];
                                                                next[idx].quantity = val;
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-full rounded-lg bg-[#0f172a] border border-white/10 px-2.5 py-1.5 text-xs text-white outline-none"
                                                    />
                                                </div>

                                                <div className="col-span-3">
                                                    <label className="text-[10px] text-gray-400 font-semibold">Unit:</label>
                                                    <select
                                                        value={line.unit}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setRecipeItems((prev) => {
                                                                const next = [...prev];
                                                                next[idx].unit = val;
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-full rounded-lg bg-[#0f172a] border border-white/10 px-2.5 py-1.5 text-xs text-white outline-none"
                                                    >
                                                        {UNITS.map((u) => (
                                                            <option key={u.value} value={u.value}>{u.value}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="col-span-1 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRecipeItems((prev) => prev.filter((_, i) => i !== idx))}
                                                        className="text-red-400 hover:text-red-300 p-1"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="flex items-center justify-end pt-3 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={handleSaveRecipe}
                                        disabled={savingRecipe}
                                        className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                        {savingRecipe ? "Saving Recipe..." : "💾 Save Recipe BOM"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="p-12 text-center text-gray-400 text-xs">
                                Select a menu item from the left panel to configure its Recipe Bill of Materials.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: PURCHASES & STOCK-IN */}
            {activeTab === "purchases" && (
                <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                    <form onSubmit={handlePurchaseSubmit} className="rounded-2xl border border-white/10 bg-[#111827] p-5 space-y-4">
                        <h2 className="text-sm font-extrabold text-orange-400 uppercase tracking-wider">Record Stock-In / Purchase</h2>

                        <div>
                            <label className="text-xs font-semibold text-gray-300">Raw Material:</label>
                            <select
                                value={purchaseForm.rawMaterialId}
                                onChange={(e) => setPurchaseForm((prev) => ({ ...prev, rawMaterialId: e.target.value }))}
                                className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                            >
                                <option value="">-- Select Material --</option>
                                {materials.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name} (Current: {m.formattedCurrentStock})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-gray-300">Quantity:</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={purchaseForm.quantity}
                                    onChange={(e) => setPurchaseForm((prev) => ({ ...prev, quantity: e.target.value }))}
                                    placeholder="e.g. 10"
                                    className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-300">Unit:</label>
                                <select
                                    value={purchaseForm.unit}
                                    onChange={(e) => setPurchaseForm((prev) => ({ ...prev, unit: e.target.value }))}
                                    className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                                >
                                    {UNITS.map((u) => (
                                        <option key={u.value} value={u.value}>{u.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-300">Total Purchase Cost (₹):</label>
                            <input
                                type="number"
                                step="0.01"
                                value={purchaseForm.totalCost}
                                onChange={(e) => setPurchaseForm((prev) => ({ ...prev, totalCost: e.target.value }))}
                                placeholder="e.g. 700"
                                className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-300">Supplier Name (Optional):</label>
                            <input
                                value={purchaseForm.supplierName}
                                onChange={(e) => setPurchaseForm((prev) => ({ ...prev, supplierName: e.target.value }))}
                                placeholder="e.g. Metro Wholesale"
                                className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submittingPurchase}
                            className="w-full rounded-xl bg-orange-500 py-2.5 font-bold text-xs text-black hover:bg-orange-400 disabled:opacity-50"
                        >
                            {submittingPurchase ? "Processing..." : "📥 Record Stock-In"}
                        </button>
                    </form>

                    <div className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                        <h2 className="text-sm font-extrabold text-gray-300 uppercase tracking-wider mb-3">Recent Purchase History</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-white/10 bg-black/40 text-gray-400">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Material</th>
                                        <th className="p-3">Quantity</th>
                                        <th className="p-3">Total Cost</th>
                                        <th className="p-3">Source</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-gray-300">
                                    {ledger.filter((m) => m.movementType === "PURCHASE").slice(0, 10).map((m) => (
                                        <tr key={m.id}>
                                            <td className="p-3 text-gray-400">{new Date(m.createdAt).toLocaleDateString()}</td>
                                            <td className="p-3 font-bold text-white">{m.rawMaterial?.name}</td>
                                            <td className="p-3 text-emerald-400 font-bold">+{m.formattedQuantity}</td>
                                            <td className="p-3 font-mono">₹{m.totalCost}</td>
                                            <td className="p-3 text-gray-400">{m.sourceId || "Stock-In"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: ADJUSTMENTS & WASTAGE */}
            {activeTab === "adjustments" && (
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Manual Adjustment Form */}
                    <form onSubmit={handleAdjustmentSubmit} className="rounded-2xl border border-white/10 bg-[#111827] p-5 space-y-4">
                        <h2 className="text-sm font-extrabold text-blue-400 uppercase tracking-wider">Manual Stock Adjustment</h2>
                        <div>
                            <label className="text-xs font-semibold text-gray-300">Raw Material:</label>
                            <select
                                value={adjForm.rawMaterialId}
                                onChange={(e) => setAdjForm((prev) => ({ ...prev, rawMaterialId: e.target.value }))}
                                className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                            >
                                <option value="">-- Select Material --</option>
                                {materials.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name} (Current: {m.formattedCurrentStock})</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-gray-300">Quantity:</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={adjForm.quantity}
                                    onChange={(e) => setAdjForm((prev) => ({ ...prev, quantity: e.target.value }))}
                                    className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-300">Direction:</label>
                                <select
                                    value={adjForm.direction}
                                    onChange={(e) => setAdjForm((prev) => ({ ...prev, direction: e.target.value }))}
                                    className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                                >
                                    <option value="IN">+ Add (IN)</option>
                                    <option value="OUT">- Subtract (OUT)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-300">Reason:</label>
                            <input
                                value={adjForm.reason}
                                onChange={(e) => setAdjForm((prev) => ({ ...prev, reason: e.target.value }))}
                                placeholder="Physical count correction"
                                className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                            />
                        </div>
                        <button type="submit" className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500">
                            Apply Stock Adjustment
                        </button>
                    </form>

                    {/* Wastage Form */}
                    <form onSubmit={handleWastageSubmit} className="rounded-2xl border border-red-500/30 bg-red-950/10 p-5 space-y-4">
                        <h2 className="text-sm font-extrabold text-red-400 uppercase tracking-wider">Log Kitchen Wastage / Spoilage</h2>
                        <div>
                            <label className="text-xs font-semibold text-gray-300">Raw Material:</label>
                            <select
                                value={wastageForm.rawMaterialId}
                                onChange={(e) => setWastageForm((prev) => ({ ...prev, rawMaterialId: e.target.value }))}
                                className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                            >
                                <option value="">-- Select Material --</option>
                                {materials.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name} (Current: {m.formattedCurrentStock})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-300">Wastage Quantity:</label>
                            <input
                                type="number"
                                step="0.01"
                                value={wastageForm.quantity}
                                onChange={(e) => setWastageForm((prev) => ({ ...prev, quantity: e.target.value }))}
                                className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-300">Reason / Cause:</label>
                            <input
                                value={wastageForm.reason}
                                onChange={(e) => setWastageForm((prev) => ({ ...prev, reason: e.target.value }))}
                                placeholder="Spoilage / Expired / Damaged"
                                className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                            />
                        </div>
                        <button type="submit" className="w-full rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-500">
                            Log Kitchen Wastage
                        </button>
                    </form>
                </div>
            )}

            {/* TAB 5: STOCK MOVEMENT LEDGER */}
            {activeTab === "ledger" && (
                <div className="rounded-2xl border border-white/10 bg-[#111827] p-5 space-y-4">
                    <h2 className="text-sm font-extrabold text-orange-400 uppercase tracking-wider">Stock Movement Audit Trail</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-white/10 bg-black/40 text-gray-400">
                                <tr>
                                    <th className="p-3">Timestamp</th>
                                    <th className="p-3">Material</th>
                                    <th className="p-3">Movement Type</th>
                                    <th className="p-3">Quantity</th>
                                    <th className="p-3">Balance After</th>
                                    <th className="p-3">Source / Reference</th>
                                    <th className="p-3">User</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {ledger.map((m) => (
                                    <tr key={m.id} className="hover:bg-white/5">
                                        <td className="p-3 text-gray-400">{new Date(m.createdAt).toLocaleString()}</td>
                                        <td className="p-3 font-bold text-white">{m.rawMaterial?.name}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                m.movementType === "SALE"
                                                    ? "bg-purple-500/20 text-purple-300"
                                                    : m.movementType === "PURCHASE" || m.movementType === "OPENING"
                                                    ? "bg-emerald-500/20 text-emerald-300"
                                                    : m.movementType === "REVERSAL"
                                                    ? "bg-blue-500/20 text-blue-300"
                                                    : "bg-red-500/20 text-red-300"
                                            }`}>
                                                {m.movementType}
                                            </span>
                                        </td>
                                        <td className={`p-3 font-bold tabular-nums ${m.quantity >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                            {m.quantity >= 0 ? `+${m.formattedQuantity}` : m.formattedQuantity}
                                        </td>
                                        <td className="p-3 font-mono text-white tabular-nums">{m.formattedBalanceAfter}</td>
                                        <td className="p-3 text-gray-400">{m.notes || m.sourceId || "--"}</td>
                                        <td className="p-3 text-gray-400">{m.performedByName || "System"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* RAW MATERIAL MODAL */}
            {showMaterialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <form onSubmit={handleSaveMaterial} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6 space-y-4">
                        <h2 className="text-lg font-black text-white">
                            {editingMaterial ? "Edit Raw Material" : "Add New Raw Material"}
                        </h2>

                        <div>
                            <label className="text-xs font-semibold text-gray-300">Material Name:</label>
                            <input
                                value={materialForm.name}
                                onChange={(e) => setMaterialForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Basmati Rice"
                                className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-gray-300">Category:</label>
                                <select
                                    value={materialForm.category}
                                    onChange={(e) => setMaterialForm((prev) => ({ ...prev, category: e.target.value }))}
                                    className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                                >
                                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-300">Display Unit:</label>
                                <select
                                    value={materialForm.displayUnit}
                                    onChange={(e) => setMaterialForm((prev) => ({ ...prev, displayUnit: e.target.value }))}
                                    className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                                >
                                    {UNITS.map((u) => (
                                        <option key={u.value} value={u.value}>{u.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-gray-300">Reorder Threshold ({materialForm.displayUnit}):</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={materialForm.minimumStock}
                                    onChange={(e) => setMaterialForm((prev) => ({ ...prev, minimumStock: e.target.value }))}
                                    className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-300">Cost / Unit (₹):</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={materialForm.costPerUnit}
                                    onChange={(e) => setMaterialForm((prev) => ({ ...prev, costPerUnit: e.target.value }))}
                                    className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                        </div>

                        {!editingMaterial && (
                            <div>
                                <label className="text-xs font-semibold text-gray-300">Initial Opening Stock ({materialForm.displayUnit}):</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={materialForm.initialStock}
                                    onChange={(e) => setMaterialForm((prev) => ({ ...prev, initialStock: e.target.value }))}
                                    className="w-full mt-1 rounded-xl bg-[#0f172a] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowMaterialModal(false)}
                                className="rounded-xl border border-white/20 px-4 py-2 text-xs text-gray-300 hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-black hover:bg-orange-400"
                            >
                                {editingMaterial ? "Update Material" : "Save Material"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
