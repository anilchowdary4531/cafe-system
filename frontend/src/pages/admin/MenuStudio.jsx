import { useEffect, useMemo, useState } from "react";
import axios from "axios";
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
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [error, setError] = useState("");

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

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
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
            resetForm();
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

    return (
        <section>
            <h3 className="text-3xl font-bold">Menu Studio</h3>
            <p className="mt-1 text-sm text-gray-400">
                Create, edit, and control item availability for your restaurant menu.
            </p>

            <div className="mt-4">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by item name or category..."
                    className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 outline-none"
                />
            </div>

            {error && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

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
                    {editingId && (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="rounded-xl border border-white/20 px-4 py-2"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-black disabled:opacity-60"
                    >
                        {submitting ? "Saving..." : editingId ? "Update Item" : "Add Item"}
                    </button>
                </div>
            </form>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {!loading &&
                    filteredItems.map((item) => (
                        <article
                            key={item.id}
                            className="rounded-2xl border border-white/10 bg-[#111827] p-4"
                        >
                            <img
                                src={resolveImageUrl(item.image) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"}
                                alt={item.name}
                                className="h-40 w-full rounded-xl object-cover"
                            />
                            <div className="mt-3">
                                <p className="text-lg font-semibold">{item.name}</p>
                                <p className="text-sm text-gray-400">{item.category}</p>
                                <p className="mt-1 text-orange-300">₹{item.price}</p>
                                {item.description && (
                                    <p className="mt-2 text-sm text-gray-400">{item.description}</p>
                                )}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => startEdit(item)}
                                    className="rounded-lg bg-yellow-500/20 px-3 py-1 text-yellow-300"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAvailability(item, true)}
                                    disabled={item.isAvailable}
                                    className={`rounded-lg px-3 py-1 ${
                                        item.isAvailable
                                            ? "bg-green-500/25 text-green-200"
                                            : "bg-green-500/10 text-green-300"
                                    } disabled:cursor-not-allowed disabled:opacity-70`}
                                >
                                    Enable
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAvailability(item, false)}
                                    disabled={!item.isAvailable}
                                    className={`rounded-lg px-3 py-1 ${
                                        !item.isAvailable
                                            ? "bg-gray-500/30 text-gray-200"
                                            : "bg-gray-500/20 text-gray-300"
                                    } disabled:cursor-not-allowed disabled:opacity-70`}
                                >
                                    Disable
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(item.id)}
                                    className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300"
                                >
                                    Delete
                                </button>
                            </div>
                        </article>
                    ))}
            </div>

            {loading && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#111827] p-5 text-gray-300">
                    Loading menu items...
                </div>
            )}

            {!loading && filteredItems.length === 0 && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#111827] p-5 text-gray-300">
                    {items.length === 0
                        ? "No menu items yet. Add your first item above."
                        : "No items match your search."}
                </div>
            )}
        </section>
    );
}
