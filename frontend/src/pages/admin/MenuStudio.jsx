import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { MoreVertical } from "lucide-react";
import { API } from "../../config";
import { uploadToS3Presigned } from "../../utils/s3Upload";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

const emptyForm = {
    name: "",
    description: "",
    category: "",
    image: "",
    price: "",
    isAvailable: true,
};

export default function MenuStudio() {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState("");
    const [form, setForm] = useState(emptyForm);
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
            const res = await axios.get(`${API}/owner/${restaurantId}/menu`);
            setItems(res.data || []);
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

    const resetForm = ({ close = false } = {}) => {
        setForm(emptyForm);
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

        if (!form.name || !form.category || !form.price) {
            setError("Name, category, and price are required.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const payload = {
                ...form,
                price: Number(form.price),
            };

            if (editingId) {
                await axios.put(`${API}/owner/${restaurantId}/menu/${editingId}`, payload);
            } else {
                await axios.post(`${API}/owner/${restaurantId}/menu`, payload);
            }

            await loadMenu();
            resetForm({ close: true });
        } catch (err) {
            console.log(err);
            setError(getErrorMessage(err, "Could not save menu item."));
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (item) => {
        setForm({
            name: item.name || "",
            description: item.description || "",
            category: item.category || "",
            image: item.image || "",
            price: item.price ?? "",
            isAvailable: item.isAvailable ?? true,
        });
        setEditingId(item.id);
        setFormOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API}/owner/${restaurantId}/menu/${id}`);
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
                isAvailable,
            });

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
        <section>
            <h3 className="text-3xl font-bold">Menu Studio</h3>
            <p className="mt-1 text-sm text-gray-400">
                Create, edit, and control item availability for your restaurant menu.
            </p>

            <div className="mt-4 flex items-center gap-3">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by item name or category..."
                    className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 outline-none"
                />
                <button
                    type="button"
                    onClick={() => {
                        setFormOpen((prev) => !prev);
                        if (formOpen && !editingId) resetForm();
                    }}
                    className="shrink-0 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black"
                >
                    {formOpen ? "Hide Form" : "Add Item"}
                </button>
            </div>

            {error && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            {formOpen && (
                <form
                    onSubmit={handleSubmit}
                    className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-[#111827] p-5 md:grid-cols-2"
                >
                    <input
                        className="rounded-xl bg-[#0f172a] px-3 py-2 outline-none"
                        placeholder="Item name"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                    <input
                        className="rounded-xl bg-[#0f172a] px-3 py-2 outline-none"
                        placeholder="Category"
                        value={form.category}
                        onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    />
                    <input
                        className="rounded-xl bg-[#0f172a] px-3 py-2 outline-none"
                        placeholder="Price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.price}
                        onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                    />
                    <div className="flex flex-col gap-2 md:col-span-2">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                                disabled={imageUploading}
                                onChange={(e) => uploadMenuImage(e.target.files?.[0])}
                                className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-100 hover:file:bg-white/15 disabled:opacity-70 md:w-auto"
                            />
                            <input
                                className="w-full rounded-xl bg-[#0f172a] px-3 py-2 outline-none"
                                placeholder="Image URL"
                                value={form.image}
                                onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
                            />
                        </div>
                        {imageUploading && <p className="text-xs text-slate-400">Uploading image...</p>}
                    </div>
                    <textarea
                        className="rounded-xl bg-[#0f172a] px-3 py-2 outline-none md:col-span-2"
                        placeholder="Description"
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    />

                    <label className="flex items-center gap-2 text-sm text-gray-300">
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
                            className="rounded-xl border border-white/20 px-4 py-2"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-black disabled:opacity-60"
                        >
                            {submitting ? "Saving..." : editingId ? "Update Item" : "Add Item"}
                        </button>
                    </div>
                </form>
            )}

            {!loading && groupedItems.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Categories</span>
                    {groupedItems.map(([category, categoryItems]) => (
                        <span
                            key={category}
                            className="rounded-full border border-[color:var(--app-border-strong)] bg-[color:color-mix(in_srgb,var(--app-primary)_20%,transparent)] px-3 py-1 text-xs font-semibold text-[color:var(--app-text)]"
                        >
                            {category} ({categoryItems.length})
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-6 space-y-5">
                {!loading &&
                    groupedItems.map(([category, categoryItems]) => (
                        <section key={category} className="p-0">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-300">{category}</p>
                                <p className="text-xs text-gray-400">{categoryItems.length} item(s)</p>
                            </div>

                            <div className="mt-3 flex gap-3 overflow-x-auto pb-1 pr-1">
                                {categoryItems.map((item) => (
                                    <article
                                        key={item.id}
                                        className="relative w-[230px] shrink-0 overflow-visible rounded-xl border border-white/15 bg-transparent"
                                    >
                                        <div className="relative">
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
                                                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-amber-700 transition hover:bg-amber-500/10"
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
                                                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-45"
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
                                                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-45"
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
                                                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-500/10"
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
                                                    {item.description && <p className="mt-1 text-xs text-gray-400">{item.description}</p>}
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-lg font-semibold text-orange-300">₹{item.price}</p>
                                                    <span
                                                        className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                                            item.isAvailable
                                                                ? "border-emerald-500/65 bg-emerald-500/30 text-emerald-900"
                                                                : "border-slate-500/60 bg-slate-500/25 text-slate-700"
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
        </section>
    );
}
