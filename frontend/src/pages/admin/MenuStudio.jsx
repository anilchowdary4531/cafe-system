import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useOutletContext } from "react-router-dom";
import axios from "axios";
import { Menu, MoreVertical, Search, Trash2 } from "lucide-react";
import { API } from "../../config";
import { uploadToS3Presigned } from "../../utils/s3Upload";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { api, invalidateGetCache } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import DigitalMenuQrModal from "../../components/DigitalMenuQrModal";

const emptyForm = {
    name: "",
    description: "",
    category: "",
    image: "",
    originalPrice: "",
    discountPercent: "",
    isAvailable: true,
    variants: [],
    modifierGroups: [],
};

const emptyTobaccoForm = {
    name: "",
    brand: "",
    category: "Cigarettes",
    packSize: "10 Sticks Pack",
    description: "Statutory Warning: Tobacco causes painful death. 18+ Only.",
    image: "",
    originalPrice: "",
    discountPercent: "0",
    isTobacco: true,
    ageVerificationRequired: true,
    isAvailable: true,
};

const TOBACCO_CATEGORIES = [
    "Cigarettes",
    "Cigars",
    "Smokeless Tobacco",
    "Hookah / Shisha",
    "Vapes / E-Cigarettes",
    "Rolling Tobacco",
];

const toMoney = (value) => {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.round(number * 100) / 100);
};

const formatMoney = (value) => {
    const amount = toMoney(value);
    return amount % 1 === 0 ? `₹${amount.toFixed(0)}` : `₹${amount.toFixed(2)}`;
};

const getDiscountedPrice = (originalPrice, discountPercent) => {
    const base = toMoney(originalPrice);
    const discount = Math.max(0, Number(discountPercent || 0));
    return Math.max(0, Math.round(base * (1 - discount / 100) * 100) / 100);
};

export default function MenuStudio() {
    const [searchParams] = useSearchParams();
    const { setSidebarOpen } = useOutletContext() || {};
    const isTobaccoParam = searchParams.get("tobacco") === "true";

    const [items, setItems] = useState([]);
    const [restaurantInfo, setRestaurantInfo] = useState(null);
    const [showDigitalMenuModal, setShowDigitalMenuModal] = useState(false);
    const [search, setSearch] = useState("");
    const [form, setForm] = useState(emptyForm);
    const [formType, setFormType] = useState("NORMAL"); // "NORMAL" | "TOBACCO"
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [error, setError] = useState("");
    const [openActionMenuId, setOpenActionMenuId] = useState(null);
    const [openActionMenuPlacement, setOpenActionMenuPlacement] = useState("down");
    const [openActionMenuMeta, setOpenActionMenuMeta] = useState(null);

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = user?.restaurantId;

    const getErrorMessage = (err, fallback) =>
        err?.response?.data?.message || fallback;

    const uploadMenuImage = async (file) => {
        if (!file || !restaurantId) return;
        try {
            setImageUploading(true);
            setError("");
            const upload = await uploadToS3Presigned({
                restaurantId,
                kind: "menu_item_image",
                file,
                entityId: editingId || "new",
            });
            if (upload?.publicUrl) {
                setForm((prev) => ({ ...prev, image: upload.publicUrl }));
            }
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || err?.message || "Image upload failed.");
        } finally {
            setImageUploading(false);
        }
    };

    const loadMenu = async () => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant not linked to current user.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            const [menuRes, settingsRes] = await Promise.all([
                api.get(`/owner/${restaurantId}/menu`),
                api.get(`/owner/${restaurantId}/settings`).catch(() => null),
            ]);
            const menuData = menuRes?.data || menuRes;
            setItems(Array.isArray(menuData) ? menuData : (menuData?.items || []));

            const settingsData = settingsRes?.data || settingsRes;
            if (settingsData) {
                setRestaurantInfo(settingsData.restaurant || settingsData);
            }
        } catch (err) {
            console.log(err);
            setError(getErrorMessage(err, "Unable to load menu. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMenu();
    }, [restaurantId]);

    useEffect(() => {
        if (isTobaccoParam && restaurantInfo?.tobaccoApproved === true) {
            setFormType("TOBACCO");
            setForm(emptyTobaccoForm);
            setFormOpen(true);
        }
    }, [isTobaccoParam, restaurantInfo?.tobaccoApproved]);

    useEffect(() => {
        if (!openActionMenuId) return undefined;

        const closeActionMenu = () => {
            setOpenActionMenuId(null);
            setOpenActionMenuMeta(null);
        };

        const onPointerDown = (event) => {
            if (!event.target.closest("[data-item-action-menu='true']")) {
                closeActionMenu();
            }
        };

        const onKeyDown = (event) => {
            if (event.key === "Escape") closeActionMenu();
        };

        window.addEventListener("mousedown", onPointerDown);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("mousedown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [openActionMenuId]);

    const resetForm = ({ close = false, type = formType } = {}) => {
        setForm(type === "TOBACCO" ? emptyTobaccoForm : emptyForm);
        setEditingId(null);
        if (close) setFormOpen(false);
    };

    const toggleActionMenu = (itemId, event) => {
        if (openActionMenuId === itemId) {
            setOpenActionMenuId(null);
            setOpenActionMenuMeta(null);
            return;
        }

        const triggerRect = event?.currentTarget?.getBoundingClientRect?.();
        if (triggerRect) {
            const viewportPadding = 12;
            const menuWidth = 160;
            const estimatedMenuHeight = 176;
            const gap = 8;
            const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding - gap;
            const spaceAbove = triggerRect.top - viewportPadding - gap;
            const shouldOpenUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
            const availableSpace = Math.max(0, shouldOpenUpward ? spaceAbove : spaceBelow);
            const maxHeight = Math.min(estimatedMenuHeight, availableSpace || estimatedMenuHeight);
            const left = Math.min(
                window.innerWidth - viewportPadding - menuWidth,
                Math.max(viewportPadding, triggerRect.right - menuWidth)
            );
            setOpenActionMenuPlacement(shouldOpenUpward ? "up" : "down");
            setOpenActionMenuMeta({
                bottom: shouldOpenUpward ? window.innerHeight - triggerRect.top + gap : null,
                left,
                maxHeight,
                top: shouldOpenUpward ? null : triggerRect.bottom + gap,
            });
        } else {
            setOpenActionMenuPlacement("down");
            setOpenActionMenuMeta({
                bottom: null,
                left: 0,
                maxHeight: 176,
                top: 0,
            });
        }

        setOpenActionMenuId(itemId);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.name || !form.category || !form.originalPrice) {
            setError("Name, category, and original price are required.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const originalPrice = toMoney(form.originalPrice);
            const discountPercent = Math.max(0, Number(form.discountPercent || 0));
            const price = getDiscountedPrice(originalPrice, discountPercent);

            const payload = {
                ...form,
                originalPrice,
                discountPercent,
                price,
                isTobacco: formType === "TOBACCO",
            };

            if (editingId) {
                await axios.put(`${API}/owner/${restaurantId}/menu/${editingId}`, payload);
            } else {
                await axios.post(`${API}/owner/${restaurantId}/menu`, payload);
            }

            invalidateGetCache({ urlStartsWith: "/catalog" });
            invalidateGetCache({ urlStartsWith: "/restaurants" });
            await loadMenu();
            resetForm({ close: true });
        } catch (err) {
            console.log(err);
            setError(getErrorMessage(err, "Could not save menu item."));
        } finally {
            setSubmitting(false);
        }
    };

    const isTobaccoItem = (item) => {
        if (item.isTobacco) return true;
        if (TOBACCO_CATEGORIES.some((cat) => item.category?.toLowerCase()?.includes(cat.toLowerCase()))) return true;
        return false;
    };

    const startEdit = (item) => {
        const isTob = isTobaccoItem(item);
        setFormType(isTob ? "TOBACCO" : "NORMAL");
        setForm({
            name: item.name || "",
            brand: item.brand || "",
            category: item.category || (isTob ? "Cigarettes" : ""),
            packSize: item.packSize || "10 Sticks Pack",
            description: item.description || "",
            image: item.image || "",
            originalPrice: item.originalPrice ?? item.price ?? "",
            discountPercent: item.discountPercent ?? 0,
            isTobacco: isTob,
            ageVerificationRequired: item.ageVerificationRequired !== false,
            isAvailable: item.isAvailable ?? true,
            variants: Array.isArray(item.variants)
                ? item.variants.map((v) => ({ name: v.name, price: v.price, isDefault: Boolean(v.isDefault), isActive: v.isActive !== false }))
                : [],
            modifierGroups: Array.isArray(item.modifierGroups)
                ? item.modifierGroups.map((g) => ({
                    name: g.name,
                    isRequired: Boolean(g.isRequired),
                    minSelect: g.minSelect || 0,
                    maxSelect: g.maxSelect || 1,
                    options: Array.isArray(g.modifiers)
                        ? g.modifiers.map((m) => ({ name: m.name, price: m.price, isAvailable: m.isAvailable !== false }))
                        : [],
                }))
                : [],
        });
        setEditingId(item.id);
        setFormOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API}/owner/${restaurantId}/menu/${id}`);
            invalidateGetCache({ urlStartsWith: "/catalog" });
            invalidateGetCache({ urlStartsWith: "/restaurants" });
            setItems((prev) => prev.filter((item) => item.id !== id));
            if (editingId === id) resetForm();
        } catch (err) {
            console.log(err);
            setError(getErrorMessage(err, "Could not delete menu item."));
        }
    };

    const setAvailability = async (item, isAvailable) => {
        if (item.isAvailable === isAvailable) return;

        try {
            await axios.put(`${API}/owner/${restaurantId}/menu/${item.id}`, {
                name: item.name,
                description: item.description,
                category: item.category,
                image: item.image,
                price: Number(item.price),
                originalPrice: item.originalPrice ?? item.price,
                discountPercent: item.discountPercent ?? 0,
                isAvailable,
            });

            invalidateGetCache({ urlStartsWith: "/catalog" });
            invalidateGetCache({ urlStartsWith: "/restaurants" });

            setItems((prev) =>
                prev.map((menuItem) =>
                    menuItem.id === item.id ? { ...menuItem, isAvailable } : menuItem
                )
            );
        } catch (err) {
            console.log(err);
            setError(getErrorMessage(err, "Could not update availability."));
        }
    };

    // Variant Helper methods
    const addVariantRow = () => {
        setForm((prev) => ({
            ...prev,
            variants: [...(prev.variants || []), { name: "", price: "" }],
        }));
    };

    const updateVariantRow = (index, field, value) => {
        setForm((prev) => {
            const list = [...(prev.variants || [])];
            list[index] = { ...list[index], [field]: value };
            return { ...prev, variants: list };
        });
    };

    const removeVariantRow = (index) => {
        setForm((prev) => ({
            ...prev,
            variants: (prev.variants || []).filter((_, idx) => idx !== index),
        }));
    };

    // Modifier Group Helper methods
    const addModifierGroupRow = () => {
        setForm((prev) => ({
            ...prev,
            modifierGroups: [
                ...(prev.modifierGroups || []),
                { name: "", isRequired: false, minSelect: 0, maxSelect: 1, options: [{ name: "", price: 0 }] },
            ],
        }));
    };

    const updateModifierGroupRow = (gIndex, field, value) => {
        setForm((prev) => {
            const groups = [...(prev.modifierGroups || [])];
            groups[gIndex] = { ...groups[gIndex], [field]: value };
            return { ...prev, modifierGroups: groups };
        });
    };

    const removeModifierGroupRow = (gIndex) => {
        setForm((prev) => ({
            ...prev,
            modifierGroups: (prev.modifierGroups || []).filter((_, idx) => idx !== gIndex),
        }));
    };

    const addGroupOption = (gIndex) => {
        setForm((prev) => {
            const groups = [...(prev.modifierGroups || [])];
            const opts = [...(groups[gIndex].options || []), { name: "", price: 0 }];
            groups[gIndex] = { ...groups[gIndex], options: opts };
            return { ...prev, modifierGroups: groups };
        });
    };

    const updateGroupOption = (gIndex, oIndex, field, value) => {
        setForm((prev) => {
            const groups = [...(prev.modifierGroups || [])];
            const opts = [...(groups[gIndex].options || [])];
            opts[oIndex] = { ...opts[oIndex], [field]: value };
            groups[gIndex] = { ...groups[gIndex], options: opts };
            return { ...prev, modifierGroups: groups };
        });
    };

    const removeGroupOption = (gIndex, oIndex) => {
        setForm((prev) => {
            const groups = [...(prev.modifierGroups || [])];
            const opts = (groups[gIndex].options || []).filter((_, idx) => idx !== oIndex);
            groups[gIndex] = { ...groups[gIndex], options: opts };
            return { ...prev, modifierGroups: groups };
        });
    };

    const filteredItems = items.filter((item) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            item.name?.toLowerCase().includes(q) ||
            item.category?.toLowerCase().includes(q)
        );
    });

    const groupedItems = useMemo(() => {
        const groups = new Map();
        filteredItems.forEach((item) => {
            const category = String(item?.category || "").trim() || "Uncategorized";
            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push(item);
        });
        return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "en", { sensitivity: "base" }));
    }, [filteredItems]);

    return (
        <div className="theme-page min-h-screen px-1 py-2 sm:px-2 w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen?.(true)}
                            className="theme-icon-button theme-icon-button-primary inline-flex items-center justify-center rounded-xl p-2.5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                            aria-label="Open navigation menu"
                            title="Open navigation menu"
                        >
                            <Menu size={20} />
                        </button>
                        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--app-heading)]">Menu Studio</h1>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--app-muted)]">
                        Create, edit, and control item availability, variants, and add-ons for your restaurant menu.
                    </p>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[color:var(--app-muted)]" />
                    <input
                        className="theme-input w-full rounded-xl py-2 pr-3 pl-9 outline-none"
                        placeholder="Search menu items..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setShowDigitalMenuModal(true)}
                    className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-gray-950 font-extrabold text-xs rounded-xl shadow-lg transition"
                >
                    <span>Digital Menu QR</span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (formOpen && formType === "NORMAL" && !editingId) {
                            setFormOpen(false);
                        } else {
                            setFormType("NORMAL");
                            setEditingId(null);
                            setForm(emptyForm);
                            setFormOpen(true);
                        }
                    }}
                    className={`rounded-xl px-4 py-3 font-semibold transition ${
                        formOpen && formType === "NORMAL"
                            ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                            : "theme-button"
                    }`}
                >
                    {formOpen && formType === "NORMAL" ? "Hide Normal Form" : "+ Add Item"}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (formOpen && formType === "TOBACCO" && !editingId) {
                            setFormOpen(false);
                        } else {
                            setFormType("TOBACCO");
                            setEditingId(null);
                            setForm(emptyTobaccoForm);
                            setFormOpen(true);
                        }
                    }}
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 font-bold text-xs shadow-lg transition ${
                        formOpen && formType === "TOBACCO"
                            ? "bg-amber-950 text-amber-200 border border-amber-500/60"
                            : "bg-gradient-to-r from-amber-600 via-orange-600 to-red-700 text-white hover:from-amber-500 hover:to-red-600 border border-amber-400/40"
                    }`}
                >
                    <span className="text-base">🚬</span>
                    <span>{formOpen && formType === "TOBACCO" ? "Hide Tobacco Form" : "+ Add Tobacco Item"}</span>
                </button>
            </div>

            {error && (
                <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                    {error}
                </div>
            )}

            {/* NORMAL ITEM FORM */}
            {formOpen && formType === "NORMAL" && (
                <form
                    onSubmit={handleSubmit}
                    className="theme-panel mt-6 grid gap-4 rounded-2xl p-5 md:grid-cols-2"
                >
                    <div className="md:col-span-2 flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🍽️</span>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-[color:var(--app-primary)]">
                                {editingId ? "Edit Normal Menu Item" : "Add Normal Menu Item"}
                            </h2>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Food & Beverage
                        </span>
                    </div>

                    <input
                        className="theme-input rounded-xl px-3 py-2 outline-none"
                        placeholder="Item name"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                    <input
                        className="theme-input rounded-xl px-3 py-2 outline-none"
                        placeholder="Category (e.g. Coffee, Food, Sweets)"
                        value={form.category}
                        onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    />
                    <input
                        className="theme-input rounded-xl px-3 py-2 outline-none"
                        placeholder="Original base price (₹)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.originalPrice}
                        onChange={(e) => setForm((prev) => ({ ...prev, originalPrice: e.target.value }))}
                    />
                    <input
                        className="theme-input rounded-xl px-3 py-2 outline-none"
                        placeholder="Discount %"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={form.discountPercent}
                        onChange={(e) => setForm((prev) => ({ ...prev, discountPercent: e.target.value }))}
                    />
                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 md:col-span-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--app-muted)]">Final price preview</p>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--app-primary)]">
                            {formatMoney(getDiscountedPrice(form.originalPrice, form.discountPercent))}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                                disabled={imageUploading}
                                onChange={(e) => uploadMenuImage(e.target.files?.[0])}
                                className="block w-full text-sm text-[color:var(--app-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[color:var(--app-primary)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--app-primary-text)] hover:file:bg-[color:var(--app-primary-hover)] disabled:opacity-70 md:w-auto"
                            />
                            <input
                                className="theme-input w-full rounded-xl px-3 py-2 outline-none"
                                placeholder="Image URL"
                                value={form.image}
                                onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
                            />
                        </div>
                        {imageUploading && <p className="text-xs text-[color:var(--app-muted)]">Uploading image...</p>}
                    </div>
                    <textarea
                        className="theme-input rounded-xl px-3 py-2 outline-none md:col-span-2"
                        placeholder="Description"
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    />

                    {/* VARIANTS SECTION */}
                    <div className="rounded-2xl border border-[color:var(--app-border)] bg-zinc-900/40 p-4 md:col-span-2 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                    Item Portion / Size Variants (Optional)
                                </h3>
                                <p className="text-[11px] text-[color:var(--app-muted)]">
                                    e.g., Small ₹200, Medium ₹300, Large ₹400
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addVariantRow}
                                className="theme-soft-button rounded-xl px-3 py-1.5 text-xs font-semibold text-amber-300 border border-amber-500/30"
                            >
                                + Add Variant
                            </button>
                        </div>

                        {Array.isArray(form.variants) && form.variants.length > 0 && (
                            <div className="space-y-2">
                                {form.variants.map((v, vIdx) => (
                                    <div key={vIdx} className="flex items-center gap-2">
                                        <input
                                            className="theme-input flex-1 rounded-xl px-3 py-1.5 text-xs outline-none"
                                            placeholder="Variant Name (e.g. Large / Half)"
                                            value={v.name}
                                            onChange={(e) => updateVariantRow(vIdx, "name", e.target.value)}
                                        />
                                        <input
                                            className="theme-input w-28 rounded-xl px-3 py-1.5 text-xs outline-none"
                                            placeholder="Price (₹)"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={v.price}
                                            onChange={(e) => updateVariantRow(vIdx, "price", e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeVariantRow(vIdx)}
                                            className="rounded-xl p-2 text-rose-400 hover:bg-rose-500/10 transition"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* MODIFIER GROUPS SECTION */}
                    <div className="rounded-2xl border border-[color:var(--app-border)] bg-zinc-900/40 p-4 md:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                    Modifier Groups & Add-ons (Optional)
                                </h3>
                                <p className="text-[11px] text-[color:var(--app-muted)]">
                                    e.g., Crust (Normal, Cheese Burst +₹80) or Toppings (Extra Cheese +₹50)
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addModifierGroupRow}
                                className="theme-soft-button rounded-xl px-3 py-1.5 text-xs font-semibold text-amber-300 border border-amber-500/30"
                            >
                                + Add Modifier Group
                            </button>
                        </div>

                        {Array.isArray(form.modifierGroups) && form.modifierGroups.length > 0 && (
                            <div className="space-y-4">
                                {form.modifierGroups.map((group, gIdx) => (
                                    <div key={gIdx} className="rounded-xl border border-[color:var(--app-border)] bg-zinc-950/60 p-3 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <input
                                                className="theme-input flex-1 min-w-[180px] rounded-xl px-3 py-1.5 text-xs font-semibold outline-none"
                                                placeholder="Group Name (e.g. Crust / Toppings)"
                                                value={group.name}
                                                onChange={(e) => updateModifierGroupRow(gIdx, "name", e.target.value)}
                                            />
                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={group.isRequired}
                                                        onChange={(e) => updateModifierGroupRow(gIdx, "isRequired", e.target.checked)}
                                                    />
                                                    Required
                                                </label>
                                                <div className="flex items-center gap-1 text-xs text-zinc-400">
                                                    <span>Min:</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="theme-input w-12 rounded-lg px-1.5 py-1 text-xs outline-none text-center"
                                                        value={group.minSelect}
                                                        onChange={(e) => updateModifierGroupRow(gIdx, "minSelect", Number(e.target.value))}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-zinc-400">
                                                    <span>Max:</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="theme-input w-12 rounded-lg px-1.5 py-1 text-xs outline-none text-center"
                                                        value={group.maxSelect}
                                                        onChange={(e) => updateModifierGroupRow(gIdx, "maxSelect", Number(e.target.value))}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeModifierGroupRow(gIdx)}
                                                    className="rounded-xl p-1.5 text-rose-400 hover:bg-rose-500/10 transition"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Group Options */}
                                        <div className="space-y-2 pl-3 border-l-2 border-amber-500/30">
                                            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                                                <span>Options / Add-ons</span>
                                                <button
                                                    type="button"
                                                    onClick={() => addGroupOption(gIdx)}
                                                    className="text-amber-400 hover:underline"
                                                >
                                                    + Add Option
                                                </button>
                                            </div>
                                            {Array.isArray(group.options) && group.options.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex items-center gap-2">
                                                    <input
                                                        className="theme-input flex-1 rounded-xl px-3 py-1 text-xs outline-none"
                                                        placeholder="Option Name (e.g. Cheese Burst / Extra Cheese)"
                                                        value={opt.name}
                                                        onChange={(e) => updateGroupOption(gIdx, oIdx, "name", e.target.value)}
                                                    />
                                                    <input
                                                        className="theme-input w-28 rounded-xl px-3 py-1 text-xs outline-none"
                                                        placeholder="Price (+₹)"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={opt.price}
                                                        onChange={(e) => updateGroupOption(gIdx, oIdx, "price", e.target.value)}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeGroupOption(gIdx, oIdx)}
                                                        className="rounded-lg p-1 text-zinc-500 hover:text-rose-400 transition"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <label className="flex items-center gap-2 text-sm text-[color:var(--app-muted-strong)]">
                        <input
                            type="checkbox"
                            checked={form.isAvailable}
                            onChange={(e) => setForm((prev) => ({ ...prev, isAvailable: e.target.checked }))}
                        />
                        Available
                    </label>

                    <div className="flex gap-2 md:justify-end">
                        <button
                            type="button"
                            onClick={() => resetForm({ close: true })}
                            className="theme-soft-button rounded-xl px-4 py-2"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="theme-button rounded-xl px-4 py-2 font-semibold disabled:opacity-60"
                        >
                            {submitting ? "Saving..." : editingId ? "Update Item" : "Add Item"}
                        </button>
                    </div>
                </form>
            )}

            {/* DEDICATED TOBACCO FORM */}
            {formOpen && formType === "TOBACCO" && (
                <form
                    onSubmit={handleSubmit}
                    className="mt-6 rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-950/40 via-zinc-900/95 to-zinc-950 p-5 md:p-6 shadow-2xl grid gap-4 md:grid-cols-2 text-zinc-100"
                >
                    <div className="md:col-span-2 rounded-xl border border-amber-500/40 bg-amber-950/60 p-4 flex items-start gap-3 text-amber-200">
                        <span className="text-2xl">🔞</span>
                        <div className="space-y-1 text-xs">
                            <p className="font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                                <span>Statutory Tobacco Product Registry</span>
                                <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded font-black tracking-widest">
                                    18+ MANDATORY
                                </span>
                            </p>
                            <p className="text-amber-200/90 leading-relaxed">
                                Under COPTA regulations, tobacco product sales are legally restricted to adults aged 18 and above. Ensure age verification is strictly enforced during ordering.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            Tobacco Product / Item Name *
                        </label>
                        <input
                            className="w-full rounded-xl border border-amber-500/30 bg-zinc-900/80 px-3 py-2 text-sm outline-none focus:border-amber-400 text-white placeholder-zinc-500"
                            placeholder="e.g. Classic Milds, Marlboro Lights, Shisha Mint"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            Tobacco Category *
                        </label>
                        <select
                            className="w-full rounded-xl border border-amber-500/30 bg-zinc-900/80 px-3 py-2 text-sm outline-none focus:border-amber-400 text-white"
                            value={form.category}
                            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                        >
                            {TOBACCO_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat} className="bg-zinc-900 text-white">
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            Brand / Manufacturer
                        </label>
                        <input
                            className="w-full rounded-xl border border-amber-500/30 bg-zinc-900/80 px-3 py-2 text-sm outline-none focus:border-amber-400 text-white placeholder-zinc-500"
                            placeholder="e.g. ITC Ltd, Philip Morris, Godfrey Phillips"
                            value={form.brand || ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            Pack Size / Stick Count
                        </label>
                        <input
                            className="w-full rounded-xl border border-amber-500/30 bg-zinc-900/80 px-3 py-2 text-sm outline-none focus:border-amber-400 text-white placeholder-zinc-500"
                            placeholder="e.g. 10 Sticks Pack, 20 Sticks Pack, 50g Tub"
                            value={form.packSize || ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, packSize: e.target.value }))}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            Original Price / MRP (₹) *
                        </label>
                        <input
                            className="w-full rounded-xl border border-amber-500/30 bg-zinc-900/80 px-3 py-2 text-sm outline-none focus:border-amber-400 text-white placeholder-zinc-500"
                            placeholder="Price in ₹"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.originalPrice}
                            onChange={(e) => setForm((prev) => ({ ...prev, originalPrice: e.target.value }))}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            Discount %
                        </label>
                        <input
                            className="w-full rounded-xl border border-amber-500/30 bg-zinc-900/80 px-3 py-2 text-sm outline-none focus:border-amber-400 text-white placeholder-zinc-500"
                            placeholder="0"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={form.discountPercent}
                            onChange={(e) => setForm((prev) => ({ ...prev, discountPercent: e.target.value }))}
                        />
                    </div>

                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2.5 md:col-span-2 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Effective Retail Selling Price</p>
                            <p className="text-xs text-amber-200/70">Calculated after statutory discount</p>
                        </div>
                        <p className="text-xl font-extrabold text-amber-300">
                            {formatMoney(getDiscountedPrice(form.originalPrice, form.discountPercent))}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            Product Image (Upload or URL)
                        </label>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                                disabled={imageUploading}
                                onChange={(e) => uploadMenuImage(e.target.files?.[0])}
                                className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-amber-500 disabled:opacity-70 md:w-auto"
                            />
                            <input
                                className="w-full flex-1 rounded-xl border border-amber-500/30 bg-zinc-900/80 px-3 py-2 text-sm outline-none focus:border-amber-400 text-white placeholder-zinc-500"
                                placeholder="Image URL (optional)"
                                value={form.image}
                                onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
                            />
                        </div>
                        {imageUploading && <p className="text-xs text-amber-400">Uploading image to S3...</p>}
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            Statutory Health Warning & Description
                        </label>
                        <textarea
                            rows={3}
                            className="w-full rounded-xl border border-amber-500/30 bg-zinc-900/80 px-3 py-2 text-sm outline-none focus:border-amber-400 text-white placeholder-zinc-500"
                            placeholder="Statutory warning text..."
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                        />
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2 bg-amber-950/40 p-3 rounded-xl border border-amber-500/30">
                        <label className="flex items-center gap-2.5 text-xs font-bold text-amber-200 cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded text-amber-500 focus:ring-amber-400"
                                checked={form.ageVerificationRequired !== false}
                                onChange={(e) => setForm((prev) => ({ ...prev, ageVerificationRequired: e.target.checked }))}
                            />
                            <span>🔞 Flag Mandatory 18+ Age Check at POS / Waiter Terminal</span>
                        </label>
                        <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-300 cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded text-amber-500 focus:ring-amber-400"
                                checked={form.isAvailable}
                                onChange={(e) => setForm((prev) => ({ ...prev, isAvailable: e.target.checked }))}
                            />
                            <span>Product Available in Stock & Active on Menu</span>
                        </label>
                    </div>

                    <div className="flex gap-3 md:col-span-2 justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => resetForm({ close: true })}
                            className="rounded-xl px-5 py-2.5 text-xs font-bold text-zinc-300 border border-zinc-700 hover:bg-zinc-800 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-xl px-6 py-2.5 text-xs font-extrabold bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white shadow-lg transition disabled:opacity-60"
                        >
                            {submitting ? "Saving Tobacco Product..." : editingId ? "Update Tobacco Product" : "Save Tobacco Product"}
                        </button>
                    </div>
                </form>
            )}

            {!loading && groupedItems.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-muted)]">Categories</span>
                    {groupedItems.map(([category, categoryItems]) => (
                        <span
                            key={category}
                            className="rounded-lg bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-xs font-semibold theme-muted flex items-center gap-1"
                        >
                            {TOBACCO_CATEGORIES.some((c) => category.toLowerCase().includes(c.toLowerCase())) && (
                                <span className="text-[10px]">🚬</span>
                            )}
                            {category} ({categoryItems.length})
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-5 space-y-4">
                {!loading &&
                    groupedItems.map(([category, categoryItems]) => (
                        <section key={category} className="p-0">
                            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)]/30 pb-1">
                                <div className="flex items-center gap-1.5">
                                    {TOBACCO_CATEGORIES.some((c) => category.toLowerCase().includes(c.toLowerCase())) && (
                                        <span className="text-xs">🚬</span>
                                    )}
                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--app-primary)]">{category}</p>
                                </div>
                                <p className="text-xs text-[color:var(--app-muted)]">{categoryItems.length} item(s)</p>
                            </div>

                            <div className="mt-2.5 flex gap-3 overflow-x-auto pb-1 pr-1">
                                {categoryItems.map((item) => (
                                    <article
                                        key={item.id}
                                        className="relative w-[220px] shrink-0 overflow-visible rounded-xl border border-[color:var(--app-border)]/30 p-1.5 transition hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                        <div className="relative">
                                            {isTobaccoItem(item) && (
                                                <div className="absolute left-2 top-2 z-10 rounded-lg bg-amber-950/90 border border-amber-500/60 px-2 py-0.5 text-[10px] font-black text-amber-300 backdrop-blur-sm shadow flex items-center gap-1">
                                                    <span>🔞</span>
                                                    <span>18+ TOBACCO</span>
                                                </div>
                                            )}
                                            <img
                                                src={resolveImageUrl(item.image) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"}
                                                alt={item.name}
                                                className="h-28 w-full rounded-t-xl object-cover"
                                            />
                                            <div className="absolute right-3 top-3 z-10" data-item-action-menu="true">
                                                <button
                                                    type="button"
                                                    onClick={(event) => toggleActionMenu(item.id, event)}
                                                    className="theme-table-icon-btn inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-lg backdrop-blur-sm transition"
                                                    aria-label="Open item actions"
                                                >
                                                    <MoreVertical size={20} strokeWidth={2.4} />
                                                </button>

                                                {openActionMenuId === item.id && (
                                                    <div
                                                        className={`theme-table-popover fixed z-50 w-40 overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl p-1 touch-pan-y ${
                                                            openActionMenuPlacement === "up" ? "origin-bottom-right" : "origin-top-right"
                                                        }`}
                                                        style={{
                                                            bottom: openActionMenuMeta?.bottom != null ? `${openActionMenuMeta.bottom}px` : "auto",
                                                            left: openActionMenuMeta?.left != null ? `${openActionMenuMeta.left}px` : "auto",
                                                            maxHeight: openActionMenuMeta?.maxHeight != null ? `${openActionMenuMeta.maxHeight}px` : "176px",
                                                            top: openActionMenuMeta?.top != null ? `${openActionMenuMeta.top}px` : "auto",
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                startEdit(item);
                                                                setOpenActionMenuId(null);
                                                                setOpenActionMenuMeta(null);
                                                            }}
                                                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[color:var(--app-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--app-primary)_14%,transparent)]"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAvailability(item, true);
                                                                setOpenActionMenuId(null);
                                                                setOpenActionMenuMeta(null);
                                                            }}
                                                            disabled={item.isAvailable}
                                                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-45"
                                                        >
                                                            Enable
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAvailability(item, false);
                                                                setOpenActionMenuId(null);
                                                                setOpenActionMenuMeta(null);
                                                            }}
                                                            disabled={!item.isAvailable}
                                                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[color:var(--app-muted)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
                                                        >
                                                            Disable
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleDelete(item.id);
                                                                setOpenActionMenuId(null);
                                                                setOpenActionMenuMeta(null);
                                                            }}
                                                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-400 transition hover:bg-rose-500/10"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-lg font-semibold">{item.name}</p>
                                                    {item.description && <p className="mt-1 text-xs text-[color:var(--app-muted)]">{item.description}</p>}
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    {Number(item.discountPercent || 0) > 0 && Number(item.originalPrice || 0) > Number(item.price || 0) ? (
                                                        <div className="flex flex-col items-end">
                                                            <p className="text-sm text-[color:var(--app-muted)] line-through">
                                                                {formatMoney(item.originalPrice ?? item.price)}
                                                            </p>
                                                            <p className="text-lg font-semibold text-[color:var(--app-primary)]">
                                                                {formatMoney(item.price)}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-lg font-semibold text-[color:var(--app-primary)]">
                                                            {formatMoney(item.price)}
                                                        </p>
                                                    )}
                                                    <span
                                                        className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                                                            item.isAvailable
                                                                ? "border-emerald-400 bg-emerald-500 text-white shadow-xs"
                                                                : "border-slate-500/60 bg-slate-500/20 text-[color:var(--app-muted)]"
                                                        }`}
                                                    >
                                                        {item.isAvailable ? "Available" : "Disabled"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
            </div>

            {loading && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#111827] p-5 text-gray-300">
                    Loading menu items...
                </div>
            )}

            {!loading && groupedItems.length === 0 && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#111827] p-5 text-gray-300">
                    {items.length === 0
                        ? "No menu items yet. Add your first item above."
                        : "No items match your search."}
                </div>
            )}

            <DigitalMenuQrModal
                isOpen={showDigitalMenuModal}
                onClose={() => setShowDigitalMenuModal(false)}
                restaurantId={user?.restaurantId}
                restaurantName={user?.restaurant?.name || "Tiffzy Restaurant"}
                restaurantSlug={user?.restaurant?.slug || "tiffzy"}
            />
        </div>
    );
}
