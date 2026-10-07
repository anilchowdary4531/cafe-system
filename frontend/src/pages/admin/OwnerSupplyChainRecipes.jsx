import React, { useState, useEffect, useMemo } from "react";
import {
    Utensils,
    Plus,
    Search,
    Filter,
    ChefHat,
    DollarSign,
    TrendingUp,
    PieChart,
    AlertCircle,
    RefreshCw,
    X,
    Edit3,
    Trash2,
    Layers,
    Save,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainRecipes() {
    const [recipes, setRecipes] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [summary, setSummary] = useState({
        totalMenuItems: 0,
        configuredRecipes: 0,
        avgFoodCostPercent: 0,
        avgGrossMarginPercent: 0,
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, CONFIGURED, MISSING

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [recipeItems, setRecipeItems] = useState([]);
    const [saving, setSaving] = useState(false);

    const fetchRecipes = async () => {
        try {
            setRefreshing(true);
            const res = await api.get("/api/supply/recipes");
            if (res.data) {
                setRecipes(res.data.recipes || []);
                setRawMaterials(res.data.rawMaterials || []);
                if (res.data.summary) {
                    setSummary(res.data.summary);
                }
            }
        } catch (err) {
            console.error("Failed to fetch recipes:", err);
            showToast.error("Failed to load recipes and ingredient mappings");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRecipes();
    }, []);

    // Unique Categories
    const categories = useMemo(() => {
        const set = new Set(recipes.map((r) => r.category).filter(Boolean));
        return ["ALL", ...Array.from(set)];
    }, [recipes]);

    // Filtered Recipes List
    const filteredRecipes = useMemo(() => {
        return recipes.filter((item) => {
            const matchesSearch =
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.ingredients || []).some((ing) => ing.name.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;

            let matchesStatus = true;
            if (statusFilter === "CONFIGURED") matchesStatus = item.hasRecipe;
            if (statusFilter === "MISSING") matchesStatus = !item.hasRecipe;

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [recipes, searchQuery, categoryFilter, statusFilter]);

    // Open Recipe Editor Modal
    const handleOpenEditor = (item) => {
        setEditingItem(item);
        if (item.ingredients && item.ingredients.length > 0) {
            setRecipeItems(
                item.ingredients.map((ing) => ({
                    rawMaterialId: ing.rawMaterialId,
                    quantity: ing.quantity || 1,
                    unit: ing.unit || "g",
                    yieldPercent: ing.yieldPercent ?? 100,
                    prepLossPercent: ing.prepLossPercent ?? 0,
                    wastagePercent: ing.wastagePercent ?? 0,
                }))
            );
        } else {
            // Default blank ingredient row
            setRecipeItems([
                {
                    rawMaterialId: rawMaterials[0]?.id || "",
                    quantity: 100,
                    unit: rawMaterials[0]?.baseUnit || "g",
                    yieldPercent: 100,
                    prepLossPercent: 0,
                    wastagePercent: 0,
                },
            ]);
        }
        setIsModalOpen(true);
    };

    // Add ingredient row in modal
    const handleAddIngredientRow = () => {
        const firstRm = rawMaterials[0];
        setRecipeItems([
            ...recipeItems,
            {
                rawMaterialId: firstRm?.id || "",
                quantity: 100,
                unit: firstRm?.baseUnit || "g",
                yieldPercent: 100,
                prepLossPercent: 0,
                wastagePercent: 0,
            },
        ]);
    };

    // Remove ingredient row
    const handleRemoveIngredientRow = (index) => {
        setRecipeItems(recipeItems.filter((_, i) => i !== index));
    };

    // Update ingredient row field
    const handleUpdateRow = (index, field, value) => {
        const updated = [...recipeItems];
        updated[index][field] = value;

        // Auto update default unit if rawMaterialId changed
        if (field === "rawMaterialId") {
            const rm = rawMaterials.find((r) => r.id === Number(value));
            if (rm) {
                updated[index].unit = rm.baseUnit || rm.displayUnit || "g";
            }
        }

        setRecipeItems(updated);
    };

    // Live Recipe Cost calculation in Modal
    const modalLiveMetrics = useMemo(() => {
        if (!editingItem) return { recipeCost: 0, foodCostPercent: 0, grossMargin: 0, grossMarginPercent: 0 };

        let totalCost = 0;
        recipeItems.forEach((row) => {
            const rm = rawMaterials.find((r) => r.id === Number(row.rawMaterialId));
            if (rm) {
                const qty = Number(row.quantity || 0);
                const yieldFactor = Number(row.yieldPercent) > 0 ? Number(row.yieldPercent) / 100 : 1;
                const prepLossFactor = 1 + (Number(row.prepLossPercent || 0) / 100) + (Number(row.wastagePercent || 0) / 100);
                
                const grossBaseQty = (qty * prepLossFactor) / yieldFactor;
                const ingCost = grossBaseQty * (rm.costPerBaseUnit || 0);
                totalCost += ingCost;
            }
        });

        const sellingPrice = editingItem.sellingPrice || 0;
        const foodCostPercent = sellingPrice > 0 ? (totalCost / sellingPrice) * 100 : 0;
        const grossMargin = sellingPrice - totalCost;
        const grossMarginPercent = sellingPrice > 0 ? (grossMargin / sellingPrice) * 100 : 0;

        return {
            recipeCost: totalCost,
            foodCostPercent,
            grossMargin,
            grossMarginPercent,
        };
    }, [recipeItems, editingItem, rawMaterials]);

    // Save Recipe
    const handleSaveRecipe = async (e) => {
        e.preventDefault();
        if (!editingItem) return;

        // Validate rows
        const validRows = recipeItems.filter((r) => r.rawMaterialId && Number(r.quantity) > 0);
        if (validRows.length === 0) {
            showToast.error("Please add at least one valid ingredient with quantity > 0");
            return;
        }

        try {
            setSaving(true);
            const payload = {
                menuItemId: editingItem.menuItemId,
                items: validRows.map((r) => ({
                    rawMaterialId: Number(r.rawMaterialId),
                    quantity: Number(r.quantity),
                    unit: String(r.unit || "g"),
                    yieldPercent: Number(r.yieldPercent || 100),
                    prepLossPercent: Number(r.prepLossPercent || 0),
                    wastagePercent: Number(r.wastagePercent || 0),
                })),
            };

            await api.post("/api/supply/recipes", payload);
            showToast.success(`Recipe for "${editingItem.name}" updated successfully!`);
            setIsModalOpen(false);
            fetchRecipes();
        } catch (err) {
            console.error("Error saving recipe:", err);
            showToast.error(err.response?.data?.error || "Failed to save recipe");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text,#1e293b)] pb-12">
            {/* Header Section */}
            <header className="pb-3 border-b border-[color:var(--app-border,#e2e8f0)]/80">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-xs">
                                    <ChefHat size={16} />
                                </div>
                                <h2 className="text-xl font-bold tracking-tight text-[color:var(--app-text,#1e293b)] sm:text-2xl">
                                    Recipes & Ingredients
                                </h2>
                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-600">
                                    INVENTORY & BOM
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-[color:var(--app-text-muted,#64748b)] mt-1">
                            Manage recipes, ingredients, quantities, BOM mappings and kitchen consumption standards.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchRecipes}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                            <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* HORIZONTAL SUB-NAVIGATION BAR */}
            <SupplyChainSubNav />

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                        <span>Recipe Coverage</span>
                        <Utensils className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {summary.configuredRecipes} <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">/ {summary.totalMenuItems} Menu Items</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                            className="bg-orange-500 h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${summary.totalMenuItems > 0 ? (summary.configuredRecipes / summary.totalMenuItems) * 100 : 0}%`,
                            }}
                        />
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                        <span>Avg Food Cost %</span>
                        <PieChart className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {summary.avgFoodCostPercent.toFixed(1)}%
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Target benchmark: &lt; 30.0%</p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                        <span>Avg Gross Margin</span>
                        <TrendingUp className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                        {summary.avgGrossMarginPercent.toFixed(1)}%
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Avg profitability across menu</p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                        <span>Active Raw Materials</span>
                        <Layers className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {rawMaterials.length}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Available inventory ingredients</p>
                </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search menu item or ingredient..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">All Categories</option>
                            {categories.filter((c) => c !== "ALL").map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                        <button
                            onClick={() => setStatusFilter("ALL")}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${statusFilter === "ALL" ? "bg-orange-500 text-white font-bold shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                        >
                            All ({recipes.length})
                        </button>
                        <button
                            onClick={() => setStatusFilter("CONFIGURED")}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${statusFilter === "CONFIGURED" ? "bg-emerald-600 text-white font-bold shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                        >
                            Mapped ({summary.configuredRecipes})
                        </button>
                        <button
                            onClick={() => setStatusFilter("MISSING")}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${statusFilter === "MISSING" ? "bg-rose-600 text-white font-bold shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                        >
                            Unmapped ({recipes.length - summary.configuredRecipes})
                        </button>
                    </div>
                </div>
            </div>

            {/* Recipe Items Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
            ) : filteredRecipes.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <ChefHat className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No menu items found</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Try adjusting your search query or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRecipes.map((item) => {
                        const foodCostBadgeColor =
                            item.foodCostPercent === 0
                                ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                : item.foodCostPercent <= 28
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                : item.foodCostPercent <= 35
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";

                        return (
                            <div
                                key={item.id}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between"
                            >
                                <div className="p-4 space-y-3">
                                    {/* Item Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                                                {item.category || "General"}
                                            </span>
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 leading-tight">{item.name}</h3>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Selling Price</span>
                                            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">₹{item.sellingPrice.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Cost Breakdown */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Recipe Cost</span>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">₹{item.recipeCost.toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Food Cost %</span>
                                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border mt-0.5 ${foodCostBadgeColor}`}>
                                                {item.hasRecipe ? `${item.foodCostPercent.toFixed(1)}%` : "N/A"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Gross Margin</span>
                                            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">₹{item.grossMargin.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Ingredients List */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="font-semibold uppercase tracking-wider text-[10px]">Ingredients ({item.ingredients.length})</span>
                                            {item.hasRecipe && <span className="text-[10px]">v{item.recipeVersion}</span>}
                                        </div>

                                        {item.ingredients.length === 0 ? (
                                            <div className="p-3 bg-amber-500/5 border border-dashed border-amber-500/20 rounded-lg text-center">
                                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 mx-auto mb-0.5" />
                                                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">No ingredients mapped yet</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                                {item.ingredients.map((ing, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/40 px-2.5 py-1 rounded border border-slate-100 dark:border-slate-800">
                                                        <span className="text-slate-800 dark:text-slate-200 font-medium">{ing.name}</span>
                                                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                                                            <span>{ing.quantity} {ing.unit}</span>
                                                            <span>•</span>
                                                            <span className="text-slate-900 dark:text-slate-200 font-semibold">₹{ing.totalCost.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer Action */}
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                                    <button
                                        onClick={() => handleOpenEditor(item)}
                                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs transition shadow-xs cursor-pointer"
                                    >
                                        <Edit3 size={13} />
                                        {item.hasRecipe ? "Edit Recipe & BOM" : "Map Ingredients"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* RECIPE BUILDER MODAL */}
            {isModalOpen && editingItem && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-orange-500/10 text-orange-600 rounded-lg border border-orange-500/20">
                                    <ChefHat size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 dark:text-white">{editingItem.name}</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Category: {editingItem.category} • Selling Price: ₹{editingItem.sellingPrice}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Live Metrics Header Inside Modal */}
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                            <div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Selling Price</span>
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">₹{editingItem.sellingPrice.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Calculated Recipe Cost</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">₹{modalLiveMetrics.recipeCost.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Food Cost %</span>
                                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border mt-0.5 ${
                                    modalLiveMetrics.foodCostPercent <= 28
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                        : modalLiveMetrics.foodCostPercent <= 35
                                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                }`}>
                                    {modalLiveMetrics.foodCostPercent.toFixed(1)}%
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Gross Margin</span>
                                <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">₹{modalLiveMetrics.grossMargin.toFixed(2)} ({modalLiveMetrics.grossMarginPercent.toFixed(1)}%)</span>
                            </div>
                        </div>

                        {/* Modal Body - Ingredient Mapping Editor */}
                        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Recipe Ingredients Breakdown</h4>
                                <button
                                    type="button"
                                    onClick={handleAddIngredientRow}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                >
                                    <Plus size={13} /> Add Ingredient
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                {recipeItems.map((row, idx) => {
                                    const selectedRm = rawMaterials.find((r) => r.id === Number(row.rawMaterialId));
                                    const qty = Number(row.quantity || 0);
                                    const yieldFactor = Number(row.yieldPercent) > 0 ? Number(row.yieldPercent) / 100 : 1;
                                    const prepLossFactor = 1 + (Number(row.prepLossPercent || 0) / 100) + (Number(row.wastagePercent || 0) / 100);
                                    const grossQty = (qty * prepLossFactor) / yieldFactor;
                                    const ingCost = selectedRm ? grossQty * (selectedRm.costPerBaseUnit || 0) : 0;

                                    return (
                                        <div
                                            key={idx}
                                            className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center"
                                        >
                                            {/* Raw Material Select */}
                                            <div className="md:col-span-4">
                                                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Raw Material Ingredient</label>
                                                <select
                                                    value={row.rawMaterialId}
                                                    onChange={(e) => handleUpdateRow(idx, "rawMaterialId", e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                                >
                                                    <option value="">Select Raw Material</option>
                                                    {rawMaterials.map((rm) => (
                                                        <option key={rm.id} value={rm.id}>
                                                            {rm.name} ({rm.category}) - ₹{rm.costPerBaseUnit}/unit
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Quantity & Unit */}
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Quantity</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    value={row.quantity}
                                                    onChange={(e) => handleUpdateRow(idx, "quantity", e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Unit</label>
                                                <input
                                                    type="text"
                                                    value={row.unit}
                                                    onChange={(e) => handleUpdateRow(idx, "unit", e.target.value)}
                                                    placeholder="g, ml, pcs"
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                                />
                                            </div>

                                            {/* Yield % */}
                                            <div className="md:col-span-1">
                                                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Yield %</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={row.yieldPercent}
                                                    onChange={(e) => handleUpdateRow(idx, "yieldPercent", e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                                />
                                            </div>

                                            {/* Prep Loss % */}
                                            <div className="md:col-span-1">
                                                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Loss %</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={row.prepLossPercent}
                                                    onChange={(e) => handleUpdateRow(idx, "prepLossPercent", e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                                />
                                            </div>

                                            {/* Cost & Delete */}
                                            <div className="md:col-span-2 flex items-center justify-between gap-1.5 pl-1">
                                                <div className="text-right">
                                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Est. Cost</span>
                                                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">₹{ingCost.toFixed(2)}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveIngredientRow(idx)}
                                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition cursor-pointer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveRecipe}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs transition shadow-xs cursor-pointer"
                            >
                                <Save size={14} />
                                {saving ? "Saving..." : "Save Recipe & BOM"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
