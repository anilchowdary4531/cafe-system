import React, { useState, useEffect, useMemo } from "react";
import {
    Utensils,
    Plus,
    Search,
    Filter,
    ChefHat,
    DollarSign,
    TrendingUp,
    TrendingDown,
    PieChart,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    X,
    Edit3,
    Trash2,
    Layers,
    Scale,
    Percent,
    ArrowUpRight,
    Info,
    Sparkles,
    Save,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

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
                
                // Note: assuming row.quantity is in base unit or standard display unit
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
        <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                            <ChefHat className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Recipes & Ingredient Mapping</h1>
                            <p className="text-sm text-slate-400">
                                Link Tiffzy menu items with raw material inventory to track food cost % and gross margins.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchRecipes}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition font-medium text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Recipe Coverage</span>
                        <Utensils className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {summary.configuredRecipes} <span className="text-sm text-slate-400 font-normal">/ {summary.totalMenuItems} Menu Items</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                        <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${summary.totalMenuItems > 0 ? (summary.configuredRecipes / summary.totalMenuItems) * 100 : 0}%`,
                            }}
                        />
                    </div>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Avg Food Cost %</span>
                        <PieChart className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                        {summary.avgFoodCostPercent.toFixed(1)}%
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Target benchmark: &lt; 30.0%</p>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Avg Gross Margin</span>
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-2xl font-bold text-cyan-400">
                        {summary.avgGrossMarginPercent.toFixed(1)}%
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Avg profitability across menu</p>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Active Raw Materials</span>
                        <Layers className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {rawMaterials.length}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Available inventory ingredients</p>
                </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search menu item or ingredient..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Category Filter */}
                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-transparent text-sm text-slate-200 focus:outline-none"
                        >
                            <option value="ALL" className="bg-slate-900">All Categories</option>
                            {categories.filter((c) => c !== "ALL").map((cat) => (
                                <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs font-medium">
                        <button
                            onClick={() => setStatusFilter("ALL")}
                            className={`px-3 py-1 rounded-lg transition ${statusFilter === "ALL" ? "bg-amber-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"}`}
                        >
                            All ({recipes.length})
                        </button>
                        <button
                            onClick={() => setStatusFilter("CONFIGURED")}
                            className={`px-3 py-1 rounded-lg transition ${statusFilter === "CONFIGURED" ? "bg-emerald-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"}`}
                        >
                            Mapped ({summary.configuredRecipes})
                        </button>
                        <button
                            onClick={() => setStatusFilter("MISSING")}
                            className={`px-3 py-1 rounded-lg transition ${statusFilter === "MISSING" ? "bg-rose-500 text-white font-semibold" : "text-slate-400 hover:text-white"}`}
                        >
                            Unmapped ({recipes.length - summary.configuredRecipes})
                        </button>
                    </div>
                </div>
            </div>

            {/* Recipe Items Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
            ) : filteredRecipes.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
                    <ChefHat className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-slate-300">No menu items found</h3>
                    <p className="text-sm text-slate-500">Try adjusting your search query or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredRecipes.map((item) => {
                        const foodCostBadgeColor =
                            item.foodCostPercent === 0
                                ? "bg-slate-800 text-slate-400 border-slate-700"
                                : item.foodCostPercent <= 28
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : item.foodCostPercent <= 35
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30";

                        return (
                            <div
                                key={item.id}
                                className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden hover:border-slate-700 transition flex flex-col justify-between"
                            >
                                <div className="p-5 space-y-4">
                                    {/* Item Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                {item.category || "General"}
                                            </span>
                                            <h3 className="text-lg font-bold text-white mt-1.5 leading-tight">{item.name}</h3>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-slate-400 block">Selling Price</span>
                                            <span className="text-lg font-bold text-emerald-400">₹{item.sellingPrice.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Cost Breakdown */}
                                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Recipe Cost</span>
                                            <span className="text-sm font-semibold text-slate-200">₹{item.recipeCost.toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Food Cost %</span>
                                            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border mt-0.5 ${foodCostBadgeColor}`}>
                                                {item.hasRecipe ? `${item.foodCostPercent.toFixed(1)}%` : "N/A"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Gross Margin</span>
                                            <span className="text-sm font-semibold text-cyan-400">₹{item.grossMargin.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Ingredients List */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
                                            <span className="font-semibold uppercase tracking-wider">Ingredients ({item.ingredients.length})</span>
                                            {item.hasRecipe && <span className="text-slate-500">v{item.recipeVersion}</span>}
                                        </div>

                                        {item.ingredients.length === 0 ? (
                                            <div className="p-3 bg-amber-500/5 border border-dashed border-amber-500/20 rounded-xl text-center">
                                                <AlertCircle className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                                                <span className="text-xs text-amber-300">No ingredients mapped yet</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                {item.ingredients.map((ing, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-slate-800">
                                                        <span className="text-slate-300 font-medium">{ing.name}</span>
                                                        <div className="flex items-center gap-2 text-slate-400">
                                                            <span>{ing.quantity} {ing.unit}</span>
                                                            <span className="text-slate-500">•</span>
                                                            <span className="text-slate-300 font-semibold">₹{ing.totalCost.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer Action */}
                                <div className="p-4 bg-slate-950/40 border-t border-slate-800/80">
                                    <button
                                        onClick={() => handleOpenEditor(item)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 rounded-xl font-medium text-sm border border-slate-700 hover:border-amber-400 transition"
                                    >
                                        <Edit3 className="w-4 h-4" />
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
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                                    <ChefHat className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{editingItem.name}</h2>
                                    <p className="text-xs text-slate-400">Category: {editingItem.category} • Selling Price: ₹{editingItem.sellingPrice}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Live Metrics Header Inside Modal */}
                        <div className="bg-slate-950/60 p-4 border-b border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Selling Price</span>
                                <span className="text-base font-bold text-emerald-400">₹{editingItem.sellingPrice.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Calculated Recipe Cost</span>
                                <span className="text-base font-bold text-white">₹{modalLiveMetrics.recipeCost.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Food Cost %</span>
                                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border mt-0.5 ${
                                    modalLiveMetrics.foodCostPercent <= 28
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : modalLiveMetrics.foodCostPercent <= 35
                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                }`}>
                                    {modalLiveMetrics.foodCostPercent.toFixed(1)}%
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Gross Profit Margin</span>
                                <span className="text-base font-bold text-cyan-400">₹{modalLiveMetrics.grossMargin.toFixed(2)} ({modalLiveMetrics.grossMarginPercent.toFixed(1)}%)</span>
                            </div>
                        </div>

                        {/* Modal Body - Ingredient Mapping Editor */}
                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Recipe Ingredients Breakdown</h4>
                                <button
                                    type="button"
                                    onClick={handleAddIngredientRow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition"
                                >
                                    <Plus className="w-4 h-4" /> Add Ingredient
                                </button>
                            </div>

                            <div className="space-y-3">
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
                                            className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                                        >
                                            {/* Raw Material Select */}
                                            <div className="md:col-span-4">
                                                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Raw Material Ingredient</label>
                                                <select
                                                    value={row.rawMaterialId}
                                                    onChange={(e) => handleUpdateRow(idx, "rawMaterialId", e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                                                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Quantity</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    value={row.quantity}
                                                    onChange={(e) => handleUpdateRow(idx, "quantity", e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Unit</label>
                                                <input
                                                    type="text"
                                                    value={row.unit}
                                                    onChange={(e) => handleUpdateRow(idx, "unit", e.target.value)}
                                                    placeholder="g, ml, pcs"
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>

                                            {/* Yield % */}
                                            <div className="md:col-span-1">
                                                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Yield %</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={row.yieldPercent}
                                                    onChange={(e) => handleUpdateRow(idx, "yieldPercent", e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>

                                            {/* Prep Loss % */}
                                            <div className="md:col-span-1">
                                                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Prep Loss %</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={row.prepLossPercent}
                                                    onChange={(e) => handleUpdateRow(idx, "prepLossPercent", e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>

                                            {/* Cost & Delete */}
                                            <div className="md:col-span-2 flex items-center justify-between gap-2 pl-2">
                                                <div className="text-right">
                                                    <span className="text-[10px] text-slate-400 block">Est. Cost</span>
                                                    <span className="text-xs font-bold text-amber-400">₹{ingCost.toFixed(2)}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveIngredientRow(idx)}
                                                    className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-slate-800 bg-slate-900/80 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveRecipe}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/10"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? "Saving Recipe..." : "Save Recipe & BOM"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
