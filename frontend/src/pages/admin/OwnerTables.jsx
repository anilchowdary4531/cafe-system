import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API } from "../../config";

const emptyForm = {
    tableNo: "",
    seats: 4,
    isActive: true,
};

const qrImageUrl = (targetUrl) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}`;

export default function OwnerTables() {
    const [tables, setTables] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = user?.restaurantId;
    const restaurantSlug = user?.restaurant?.slug;

    const getErrorMessage = (err, fallback) =>
        err?.response?.data?.message || fallback;

    const buildTargetUrl = (tableNo) => {
        const safeSlug = String(restaurantSlug || "").trim() || "restaurant";
        const safeTable = String(tableNo || "").trim();
        const path = `/r/${safeSlug}?table=${encodeURIComponent(safeTable)}`;
        const base = typeof window !== "undefined" ? window.location.origin : "";
        return base ? `${base}${path}` : path;
    };

    const loadTables = async () => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant not linked to current user.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            const res = await axios.get(`${API}/owner/${restaurantId}/tables`);
            setTables(res.data || []);
        } catch (err) {
            console.log(err);
            setError(getErrorMessage(err, "Unable to load tables."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTables();
    }, [restaurantId]);

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.tableNo) {
            setError("Table number is required.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const payload = {
                tableNo: form.tableNo.trim(),
                seats: Number(form.seats || 4),
                isActive: form.isActive,
            };

            if (editingId) {
                await axios.put(`${API}/owner/${restaurantId}/tables/${editingId}`, payload);
            } else {
                await axios.post(`${API}/owner/${restaurantId}/tables`, payload);
            }

            await loadTables();
            resetForm();
        } catch (err) {
            console.log(err);
            setError(getErrorMessage(err, "Failed to save table."));
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (table) => {
        setEditingId(table.id);
        setForm({
            tableNo: table.tableNo || "",
            seats: table.seats || 4,
            isActive: table.isActive ?? true,
        });
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API}/owner/${restaurantId}/tables/${id}`);
            setTables((prev) => prev.filter((t) => t.id !== id));
            if (editingId === id) resetForm();
        } catch (err) {
            console.log(err);
            setError(getErrorMessage(err, "Failed to delete table."));
        }
    };

    const setActiveState = async (table, isActive) => {
        if (table.isActive === isActive) return;

        try {
            await axios.put(`${API}/owner/${restaurantId}/tables/${table.id}`, {
                tableNo: table.tableNo,
                seats: table.seats,
                isActive,
            });

            setTables((prev) =>
                prev.map((row) =>
                    row.id === table.id ? { ...row, isActive } : row
                )
            );
        } catch (err) {
            console.log(err);
            setError(getErrorMessage(err, "Failed to update table status."));
        }
    };

    const copyQrLink = async (table) => {
        const target = table.qrCodeUrl || buildTargetUrl(table.tableNo);
        try {
            await navigator.clipboard.writeText(target);
        } catch {
            setError("Could not copy link. Check browser permissions.");
        }
    };

    const filteredTables = tables.filter((table) =>
        table.tableNo?.toLowerCase().includes(query.trim().toLowerCase())
    );

    return (
        <section>
            <h3 className="text-3xl font-bold">Tables & QR</h3>
            <p className="mt-1 text-sm text-gray-400">
                Add tables, manage active status, and share QR links for customer ordering.
            </p>

            {error && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-[#111827] p-5 md:grid-cols-4"
            >
                <input
                    value={form.tableNo}
                    onChange={(e) => setForm((prev) => ({ ...prev, tableNo: e.target.value }))}
                    placeholder="Table No (e.g., T1)"
                    className="rounded-xl bg-[#0f172a] px-3 py-2 outline-none"
                />
                <input
                    type="number"
                    min="1"
                    value={form.seats}
                    onChange={(e) => setForm((prev) => ({ ...prev, seats: e.target.value }))}
                    placeholder="Seats"
                    className="rounded-xl bg-[#0f172a] px-3 py-2 outline-none"
                />
                <label className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-3 py-2 text-sm text-gray-300">
                    <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />
                    Active
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
                        className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-black disabled:opacity-70"
                    >
                        {submitting ? "Saving..." : editingId ? "Update Table" : "Add Table"}
                    </button>
                </div>
            </form>

            <div className="mt-4">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search table number..."
                    className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 outline-none"
                />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {!loading &&
                    filteredTables.map((table) => {
                        const target = table.qrCodeUrl || buildTargetUrl(table.tableNo);
                        const image = qrImageUrl(target);

                        return (
                            <article
                                key={table.id}
                                className="rounded-2xl border border-white/10 bg-[#111827] p-4"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-xl font-semibold">{table.tableNo}</p>
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs ${
                                            table.isActive
                                                ? "bg-green-500/20 text-green-300"
                                                : "bg-gray-500/20 text-gray-300"
                                        }`}
                                    >
                                        {table.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>

                                <p className="mt-1 text-sm text-gray-400">{table.seats} seats</p>

                                <img
                                    src={image}
                                    alt={`${table.tableNo} QR`}
                                    className="mt-4 h-44 w-44 rounded-xl bg-white p-2"
                                />

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => startEdit(table)}
                                        className="rounded-lg bg-yellow-500/20 px-3 py-1 text-yellow-300"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveState(table, true)}
                                        disabled={table.isActive}
                                        className="rounded-lg bg-green-500/20 px-3 py-1 text-green-300 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Enable
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveState(table, false)}
                                        disabled={!table.isActive}
                                        className="rounded-lg bg-gray-500/20 px-3 py-1 text-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Disable
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyQrLink(table)}
                                        className="rounded-lg bg-blue-500/20 px-3 py-1 text-blue-300"
                                    >
                                        Copy Link
                                    </button>
                                    <a
                                        href={target}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-lg bg-indigo-500/20 px-3 py-1 text-indigo-300"
                                    >
                                        Open Menu
                                    </a>
                                    <a
                                        href={image}
                                        download={`${table.tableNo}-qr.png`}
                                        className="rounded-lg bg-purple-500/20 px-3 py-1 text-purple-300"
                                    >
                                        Download QR
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(table.id)}
                                        className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </article>
                        );
                    })}
            </div>

            {loading && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#111827] p-5 text-gray-300">
                    Loading tables...
                </div>
            )}

            {!loading && filteredTables.length === 0 && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#111827] p-5 text-gray-300">
                    {tables.length === 0
                        ? "No tables yet. Add your first table above."
                        : "No tables match your search."}
                </div>
            )}
        </section>
    );
}
