import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API } from "../../config";

const emptyForm = {
    tableNo: "",
    seats: 4,
    groupName: "",
    isActive: true,
};

const qrImageUrl = (targetUrl) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}`;

const TABLE_GROUPS_STORAGE_PREFIX = "owner_table_groups_v1";
const TABLE_GROUP_CATALOG_STORAGE_PREFIX = "owner_table_group_catalog_v1";
const ALL_GROUPS_FILTER = "All";

const normalizeGroupName = (value) =>
    String(value || "")
        .trim()
        .replace(/\s+/g, " ");

const isSameGroupName = (left, right) =>
    normalizeGroupName(left).toLowerCase() ===
    normalizeGroupName(right).toLowerCase();

const mergeUniqueGroupNames = (names) => {
    const unique = new Map();
    for (const name of names || []) {
        const normalized = normalizeGroupName(name);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (!unique.has(key)) unique.set(key, normalized);
    }
    return [...unique.values()].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
    );
};

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

export default function OwnerTables() {
    const [tables, setTables] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [openMenuId, setOpenMenuId] = useState(null);
    const [tableGroups, setTableGroups] = useState({});
    const [groupCatalog, setGroupCatalog] = useState([]);
    const [newGroupName, setNewGroupName] = useState("");
    const [activeGroupFilter, setActiveGroupFilter] = useState(ALL_GROUPS_FILTER);

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = user?.restaurantId;
    const restaurantSlug = user?.restaurant?.slug;
    const tableGroupStorageKey = restaurantId
        ? `${TABLE_GROUPS_STORAGE_PREFIX}_${restaurantId}`
        : "";
    const tableGroupCatalogStorageKey = restaurantId
        ? `${TABLE_GROUP_CATALOG_STORAGE_PREFIX}_${restaurantId}`
        : "";

    const getErrorMessage = (err, fallback) =>
        err?.response?.data?.message || fallback;

    const buildTargetUrl = (tableNo) => {
        const safeSlug = String(restaurantSlug || "").trim() || "restaurant";
        const safeTable = String(tableNo || "").trim();
        const path = `/m/${encodeURIComponent(safeSlug)}/${encodeURIComponent(safeTable)}`;
        const base = typeof window !== "undefined" ? window.location.origin : "";
        return base ? `${base}${path}` : path;
    };

    const buildDebugTargetUrl = (tableNo) => {
        const safeSlug = String(restaurantSlug || "").trim() || "restaurant";
        const safeTable = String(tableNo || "").trim();
        const path = `/debug/menu/${encodeURIComponent(safeSlug)}/${encodeURIComponent(safeTable)}`;
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

    useEffect(() => {
        if (!tableGroupStorageKey) {
            setTableGroups({});
            return;
        }

        try {
            const raw = localStorage.getItem(tableGroupStorageKey);
            if (!raw) {
                setTableGroups({});
                return;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                setTableGroups({});
                return;
            }
            setTableGroups(parsed);
        } catch {
            setTableGroups({});
        }
    }, [tableGroupStorageKey]);

    useEffect(() => {
        if (!tableGroupCatalogStorageKey) {
            setGroupCatalog([]);
            return;
        }
        try {
            const raw = localStorage.getItem(tableGroupCatalogStorageKey);
            if (!raw) {
                setGroupCatalog([]);
                return;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                setGroupCatalog([]);
                return;
            }
            setGroupCatalog(mergeUniqueGroupNames(parsed));
        } catch {
            setGroupCatalog([]);
        }
    }, [tableGroupCatalogStorageKey]);

    useEffect(() => {
        if (!tableGroupStorageKey) return;
        localStorage.setItem(tableGroupStorageKey, JSON.stringify(tableGroups));
    }, [tableGroupStorageKey, tableGroups]);

    useEffect(() => {
        if (!tableGroupCatalogStorageKey) return;
        localStorage.setItem(
            tableGroupCatalogStorageKey,
            JSON.stringify(groupCatalog)
        );
    }, [groupCatalog, tableGroupCatalogStorageKey]);

    useEffect(() => {
        if (loading) return;

        setTableGroups((prev) => {
            const keys = Object.keys(prev);
            if (keys.length === 0) return prev;
            const validIds = new Set(tables.map((table) => String(table.id)));
            let changed = false;
            const next = {};
            for (const key of keys) {
                if (validIds.has(key)) {
                    next[key] = prev[key];
                } else {
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [loading, tables]);

    useEffect(() => {
        const usedGroups = tables
            .map((table) => normalizeGroupName(tableGroups[String(table.id)] || ""))
            .filter(Boolean);
        if (!usedGroups.length) return;
        setGroupCatalog((prev) => mergeUniqueGroupNames([...prev, ...usedGroups]));
    }, [tableGroups, tables]);

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (event.target instanceof Element && event.target.closest("[data-table-actions-menu]")) {
                return;
            }
            setOpenMenuId(null);
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setOpenMenuId(null);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

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
            const normalizedGroup = normalizeGroupName(form.groupName);
            let savedTableId = editingId || null;

            const payload = {
                tableNo: form.tableNo.trim(),
                seats: Number(form.seats || 4),
                isActive: form.isActive,
            };

            if (editingId) {
                const updated = await axios.put(
                    `${API}/owner/${restaurantId}/tables/${editingId}`,
                    payload
                );
                savedTableId = updated?.data?.id || editingId;
            } else {
                const created = await axios.post(
                    `${API}/owner/${restaurantId}/tables`,
                    payload
                );
                savedTableId = created?.data?.id || null;
            }

            if (savedTableId) {
                const groupKey = String(savedTableId);
                setTableGroups((prev) => {
                    const next = { ...prev };
                    if (normalizedGroup) {
                        next[groupKey] = normalizedGroup;
                    } else {
                        delete next[groupKey];
                    }
                    return next;
                });
                if (normalizedGroup) {
                    setGroupCatalog((prev) =>
                        mergeUniqueGroupNames([...prev, normalizedGroup])
                    );
                }
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
            groupName: tableGroups[String(table.id)] || "",
            isActive: table.isActive ?? true,
        });
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API}/owner/${restaurantId}/tables/${id}`);
            setTables((prev) => prev.filter((t) => t.id !== id));
            setTableGroups((prev) => {
                if (!(String(id) in prev)) return prev;
                const next = { ...prev };
                delete next[String(id)];
                return next;
            });
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

    const printQr = (table) => {
        const target = table.qrCodeUrl || buildTargetUrl(table.tableNo);
        const image = qrImageUrl(target);

        const printWindow = window.open("", "_blank", "width=900,height=700");
        if (!printWindow) {
            setError("Could not open print window. Please allow pop-ups and try again.");
            return;
        }

        const safeTableNo = escapeHtml(table.tableNo ?? "");
        const safeTarget = escapeHtml(target ?? "");
        const safeImage = escapeHtml(image ?? "");

        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Print QR - ${safeTableNo}</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 24px;
                            font-family: Arial, sans-serif;
                            color: #111827;
                        }
                        .sheet {
                            max-width: 420px;
                            margin: 0 auto;
                            text-align: center;
                        }
                        h1 {
                            margin: 0 0 8px;
                            font-size: 28px;
                        }
                        p {
                            margin: 0 0 14px;
                            font-size: 13px;
                            color: #4b5563;
                            word-break: break-word;
                        }
                        img {
                            width: 260px;
                            height: 260px;
                            padding: 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 12px;
                            background: #ffffff;
                        }
                    </style>
                </head>
                <body>
                    <div class="sheet">
                        <h1>Table ${safeTableNo}</h1>
                        <img src="${safeImage}" alt="QR for ${safeTableNo}" />
                        <p>${safeTarget}</p>
                    </div>
                    <script>
                        window.onload = function () {
                            window.print();
                            window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const toggleActionsMenu = (tableId) => {
        setOpenMenuId((prev) => (prev === tableId ? null : tableId));
    };

    const createGroup = () => {
        const normalized = normalizeGroupName(newGroupName);
        if (!normalized) {
            setError("Group name is required.");
            return;
        }
        setError("");
        setGroupCatalog((prev) =>
            mergeUniqueGroupNames([...prev, normalized])
        );
        setForm((prev) => ({ ...prev, groupName: normalized }));
        setNewGroupName("");
    };

    const deleteGroup = (groupName) => {
        const normalized = normalizeGroupName(groupName);
        if (!normalized) return;

        const assignedCount = Object.values(tableGroups).filter((value) =>
            isSameGroupName(value, normalized)
        ).length;

        const approved = window.confirm(
            assignedCount > 0
                ? `Delete group "${normalized}"? It will be removed from ${assignedCount} table${assignedCount > 1 ? "s" : ""}.`
                : `Delete group "${normalized}"?`
        );
        if (!approved) return;

        setError("");
        setGroupCatalog((prev) =>
            prev.filter((name) => !isSameGroupName(name, normalized))
        );
        setTableGroups((prev) => {
            const next = {};
            let changed = false;
            for (const [tableId, value] of Object.entries(prev)) {
                if (isSameGroupName(value, normalized)) {
                    changed = true;
                    continue;
                }
                next[tableId] = value;
            }
            return changed ? next : prev;
        });

        if (isSameGroupName(form.groupName, normalized)) {
            setForm((prev) => ({ ...prev, groupName: "" }));
        }
        if (isSameGroupName(activeGroupFilter, normalized)) {
            setActiveGroupFilter(ALL_GROUPS_FILTER);
        }
    };

    const getTableGroup = (table) => normalizeGroupName(tableGroups[String(table.id)] || "");

    const groupOptions = useMemo(() => {
        const fromTables = tables.map((table) => getTableGroup(table)).filter(Boolean);
        const fromForm = normalizeGroupName(form.groupName);
        return mergeUniqueGroupNames([...groupCatalog, ...fromTables, fromForm]);
    }, [form.groupName, groupCatalog, tableGroups, tables]);

    const groupCounts = useMemo(() => {
        return tables.reduce((acc, table) => {
            const group = getTableGroup(table);
            if (!group) return acc;
            acc[group] = (acc[group] || 0) + 1;
            return acc;
        }, {});
    }, [tableGroups, tables]);

    useEffect(() => {
        if (activeGroupFilter === ALL_GROUPS_FILTER) return;
        const exists = groupOptions.includes(activeGroupFilter);
        if (!exists) {
            setActiveGroupFilter(ALL_GROUPS_FILTER);
        }
    }, [activeGroupFilter, groupOptions]);

    const actionMenuItemClass =
        "w-full rounded-lg px-3 py-2 text-left text-sm theme-muted-strong hover:bg-black/10";

    const filteredTables = tables.filter((table) => {
        const matchesSearch = table.tableNo
            ?.toLowerCase()
            .includes(query.trim().toLowerCase());
        const group = getTableGroup(table);
        const matchesGroup =
            activeGroupFilter === ALL_GROUPS_FILTER || group === activeGroupFilter;
        return matchesSearch && matchesGroup;
    });

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

            <div className="mt-5 flex w-full justify-end">
                <div className="w-full max-w-[520px]">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px]">
                        <input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Create new table group"
                            className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-2.5 outline-none transition focus:border-orange-400/40 focus:ring-2 focus:ring-orange-400/20"
                        />
                        <button
                            type="button"
                            onClick={createGroup}
                            className="rounded-xl bg-orange-500 px-4 py-2.5 font-semibold text-black transition hover:bg-orange-400"
                        >
                            Create
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto mt-6 flex w-full max-w-6xl flex-col gap-3 xl:flex-row xl:items-start">
                <div className="w-full shrink-0 xl:w-[300px]">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search table number..."
                        className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 outline-none transition focus:border-orange-400/40 focus:ring-2 focus:ring-orange-400/20"
                    />
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="grid w-full flex-1 gap-3 rounded-2xl border border-white/10 bg-[#111827] p-4 md:grid-cols-[minmax(0,1.6fr)_120px_minmax(0,1.2fr)_170px_auto]"
                >
                    <input
                        value={form.tableNo}
                        onChange={(e) => setForm((prev) => ({ ...prev, tableNo: e.target.value }))}
                        placeholder="Table No (e.g., T1)"
                        className="rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 outline-none transition focus:border-orange-400/40 focus:ring-2 focus:ring-orange-400/20"
                    />
                    <input
                        type="number"
                        min="1"
                        value={form.seats}
                        onChange={(e) => setForm((prev) => ({ ...prev, seats: e.target.value }))}
                        placeholder="Seats"
                        className="rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 outline-none transition focus:border-orange-400/40 focus:ring-2 focus:ring-orange-400/20"
                    />
                    <select
                        value={form.groupName}
                        onChange={(e) => setForm((prev) => ({ ...prev, groupName: e.target.value }))}
                        className="rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 outline-none transition focus:border-orange-400/40 focus:ring-2 focus:ring-orange-400/20"
                    >
                        <option value="">Select group</option>
                        {groupOptions.map((group) => (
                            <option key={group} value={group}>
                                {group}
                            </option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-gray-300">
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
            </div>
            <p className="mx-auto mt-2 w-full max-w-5xl text-xs text-gray-400">
                Create your own group names, then assign each table to a group.
            </p>

            <div className="mx-auto mt-3 flex w-full max-w-5xl flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setActiveGroupFilter(ALL_GROUPS_FILTER)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        activeGroupFilter === ALL_GROUPS_FILTER
                            ? "border-orange-500/70 bg-orange-500 text-black"
                            : "border-white/10 bg-[#111827] text-gray-300 hover:border-orange-400/40"
                    }`}
                >
                    All ({tables.length})
                </button>
                {groupOptions.map((group) => (
                    <div
                        key={group}
                        className={`inline-flex items-center overflow-hidden rounded-full border ${
                            activeGroupFilter === group
                                ? "border-orange-500/70"
                                : "border-white/10"
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => setActiveGroupFilter(group)}
                            className={`px-3 py-1 text-xs font-semibold transition ${
                                activeGroupFilter === group
                                    ? "bg-orange-500 text-black"
                                    : "bg-[#111827] text-gray-300 hover:border-orange-400/40"
                            }`}
                        >
                            {group} ({groupCounts[group] || 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => deleteGroup(group)}
                            className="border-l border-white/10 bg-[#0f172a] px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/20 hover:text-red-200"
                            aria-label={`Delete group ${group}`}
                            title={`Delete group ${group}`}
                        >
                            x
                        </button>
                    </div>
                ))}
            </div>

            <div className="mt-6 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
                {!loading &&
                    filteredTables.map((table) => {
                        const target = table.qrCodeUrl || buildTargetUrl(table.tableNo);
                        const debugTarget = buildDebugTargetUrl(table.tableNo);
                        const image = qrImageUrl(target);
                        const tableGroup = getTableGroup(table);

                        return (
                            <article
                                key={table.id}
                                className="rounded-2xl border border-white/10 bg-[#111827] p-3 transition hover:-translate-y-0.5 hover:border-orange-400/30"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xl font-semibold">{table.tableNo}</p>
                                        <span className="mt-1 inline-flex rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[11px] text-gray-300">
                                            {tableGroup || "No Group"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                                table.isActive
                                                    ? "border-emerald-500/40 bg-emerald-100 text-emerald-700 shadow-sm"
                                                    : "border-gray-400/40 bg-gray-100 text-gray-600"
                                            }`}
                                        >
                                            <span
                                                className={`h-1.5 w-1.5 rounded-full ${
                                                    table.isActive ? "bg-emerald-600" : "bg-gray-500"
                                                }`}
                                            />
                                            {table.isActive ? "Active" : "Inactive"}
                                        </span>
                                        <div className="relative" data-table-actions-menu>
                                            <button
                                                type="button"
                                                onClick={() => toggleActionsMenu(table.id)}
                                                className="rounded-lg border border-white/10 px-2 py-0.5 text-lg leading-none text-gray-200 hover:bg-white/10"
                                                aria-label={`Open actions for ${table.tableNo}`}
                                            >
                                                &#8942;
                                            </button>
                                            {openMenuId === table.id && (
                                                <div className="absolute right-0 z-30 mt-2 w-40 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-[#0b1220] p-1.5 shadow-2xl">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            startEdit(table);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className={actionMenuItemClass}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveState(table, true);
                                                            setOpenMenuId(null);
                                                        }}
                                                        disabled={table.isActive}
                                                        className={`${actionMenuItemClass} disabled:cursor-not-allowed disabled:opacity-50`}
                                                    >
                                                        Enable
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveState(table, false);
                                                            setOpenMenuId(null);
                                                        }}
                                                        disabled={!table.isActive}
                                                        className={`${actionMenuItemClass} disabled:cursor-not-allowed disabled:opacity-50`}
                                                    >
                                                        Disable
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            copyQrLink(table);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className={actionMenuItemClass}
                                                    >
                                                        Copy Link
                                                    </button>
                                                    <a
                                                        href={target}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={() => setOpenMenuId(null)}
                                                        className={`block ${actionMenuItemClass}`}
                                                    >
                                                        Open Menu
                                                    </a>
                                                    <a
                                                        href={image}
                                                        download={`${table.tableNo}-qr.png`}
                                                        onClick={() => setOpenMenuId(null)}
                                                        className={`block ${actionMenuItemClass}`}
                                                    >
                                                        Download QR
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            printQr(table);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className={actionMenuItemClass}
                                                    >
                                                        Print QR
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleDelete(table.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className={actionMenuItemClass}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <p className="mt-1 text-sm text-gray-400">{table.seats} seats</p>

                                <img src={image} alt={`${table.tableNo} QR`} className="mt-3 h-32 w-32 rounded-xl bg-white p-1.5 sm:h-36 sm:w-36" />

                                <a
                                    href={debugTarget}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/20"
                                >
                                    Open debug link
                                </a>
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
                        : "No tables match your search/group filter."}
                </div>
            )}
        </section>
    );
}
