import { useEffect, useState } from "react";
import { api, cachedGet, invalidateGetCache } from "../utils/apiClient";

export default function Admin() {
    const [items, setItems] = useState([]);
    const [form, setForm] = useState({
        name: "",
        price: "",
        category: "",
        image: "",
    });
    const [editingId, setEditingId] = useState(null);
    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    })();

    // 🔄 LOAD DATA
    const fetchMenu = async () => {
        const data = await cachedGet("/menu", { ttlMs: 30_000, staleMs: 10 * 60_000 });
        setItems(Array.isArray(data) ? data : []);
    };

    useEffect(() => {
        fetchMenu();
    }, []);

    // ➕ CREATE / UPDATE
    const handleSubmit = async () => {
        if (!form.name || !form.price) return alert("Fill required fields");

        if (editingId) {
            await api.put(`/menu/${editingId}`, form);
            setEditingId(null);
        } else {
            await api.post("/menu", {
                ...form,
                restaurantId: user?.restaurantId || undefined,
            });
        }

        setForm({ name: "", price: "", category: "", image: "" });
        invalidateGetCache({ urlStartsWith: "/menu" });
        fetchMenu();
    };

    // ✏️ EDIT
    const handleEdit = (item) => {
        setForm(item);
        setEditingId(item.id);
    };

    // ❌ DELETE
    const handleDelete = async (id) => {
        await api.delete(`/menu/${id}`);
        invalidateGetCache({ urlStartsWith: "/menu" });
        fetchMenu();
    };

    return (
        <div className="min-h-screen bg-[#0b1220] text-white p-6">

            <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

            {/* FORM */}
            <div className="bg-[#1a2333] p-4 rounded-xl mb-6">
                <h2 className="mb-3">{editingId ? "Edit Item" : "Add Item"}</h2>

                <div className="grid grid-cols-2 gap-3">
                    <input
                        placeholder="Name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="p-2 rounded bg-[#0f172a]"
                    />

                    <input
                        placeholder="Price"
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                        className="p-2 rounded bg-[#0f172a]"
                    />

                    <input
                        placeholder="Category"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="p-2 rounded bg-[#0f172a]"
                    />

                    <input
                        placeholder="Image URL"
                        value={form.image}
                        onChange={(e) => setForm({ ...form, image: e.target.value })}
                        className="p-2 rounded bg-[#0f172a]"
                    />
                </div>

                <button
                    onClick={handleSubmit}
                    className="mt-4 bg-orange-500 px-4 py-2 rounded"
                >
                    {editingId ? "Update" : "Add"}
                </button>
            </div>

            {/* LIST */}
            <div className="grid md:grid-cols-3 gap-4">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="bg-[#1a2333] p-4 rounded-xl"
                    >
                        <img
                            src={item.image}
                            className="h-32 w-full object-cover rounded mb-2"
                        />

                        <h3 className="font-bold">{item.name}</h3>
                        <p>₹{item.price}</p>

                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => handleEdit(item)}
                                className="bg-yellow-500 px-2 py-1 rounded"
                            >
                                Edit
                            </button>

                            <button
                                onClick={() => handleDelete(item.id)}
                                className="bg-red-500 px-2 py-1 rounded"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
