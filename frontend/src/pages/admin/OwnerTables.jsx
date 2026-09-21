import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../config";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { showToast } from "../../utils/toast";

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

const formatMoney = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "₹0.00";
    return `₹${amount.toFixed(2)}`;
};

const formatAge = (isoDate) => {
    if (!isoDate) return "-";
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem ? `${hours}h ${rem}m` : `${hours}h`;
};

export default function OwnerTables() {
    const navigate = useNavigate();
    const { socket } = useStaffSocket();

    const [tables, setTables] = useState([]);
    const [activeSessions, setActiveSessions] = useState({});
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

    // Session Modals
    const [openSessionTable, setOpenSessionTable] = useState(null);
    const [sessionGuestCount, setSessionGuestCount] = useState(4);
    const [sessionWaiterName, setSessionWaiterName] = useState("");
    const [viewSessionDetail, setViewSessionDetail] = useState(null);
    const [, setNowTick] = useState(Date.now());

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

    const loadActiveSessions = async () => {
        if (!restaurantId) return;
        try {
            const res = await axios.get(`${API}/owner/${restaurantId}/tables/sessions/active`);
            const list = Array.isArray(res?.data?.sessions) ? res.data.sessions : [];
            const map = {};
            list.forEach((session) => {
                if (session && session.tableId) {
                    map[String(session.tableId)] = session;
                }
            });
            setActiveSessions(map);
        } catch (err) {
            console.log("Error loading active sessions:", err);
        }
    };

    useEffect(() => {
        loadTables();
        loadActiveSessions();
    }, [restaurantId]);

    // Live 30-sec timer tick for table occupancy duration
    useEffect(() => {
        const timer = setInterval(() => setNowTick(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);

    // Socket.IO Real-time Sync
    useEffect(() => {
        if (!socket) return undefined;

        const onSessionUpdated = (session) => {
            if (!session || !session.tableId) return;
            setActiveSessions((prev) => {
                const next = { ...prev };
                if (session.status === "CLOSED" || session.status === "CANCELLED") {
                    delete next[String(session.tableId)];
                } else {
                    next[String(session.tableId)] = session;
                }
                return next;
            });
        };

        socket.on("table:session_updated", onSessionUpdated);
        socket.on("order:created", loadActiveSessions);
        socket.on("order:updated", loadActiveSessions);

        return () => {
            socket.off("table:session_updated", onSessionUpdated);
            socket.off("order:created", loadActiveSessions);
            socket.off("order:updated", loadActiveSessions);
        };
    }, [socket]);

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

        const inputTableNo = String(form.tableNo || "").trim();
        if (!inputTableNo) {
            setError("Table number is required.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");
            const normalizedGroup = normalizeGroupName(form.groupName);

            const existingTable = tables.find(
                (t) => String(t.tableNo || "").trim().toLowerCase() === inputTableNo.toLowerCase()
            );

            let savedTableId = editingId || null;

            if (!editingId && existingTable) {
                savedTableId = existingTable.id;
                const payload = {
                    tableNo: existingTable.tableNo,
                    seats: Number(form.seats || existingTable.seats || 4),
                    isActive: form.isActive,
                };
                await axios.put(
                    `${API}/owner/${restaurantId}/tables/${existingTable.id}`,
                    payload
                );
            } else if (editingId) {
                const payload = {
                    tableNo: inputTableNo,
                    seats: Number(form.seats || 4),
                    isActive: form.isActive,
                };
                const updated = await axios.put(
                    `${API}/owner/${restaurantId}/tables/${editingId}`,
                    payload
                );
                savedTableId = updated?.data?.id || editingId;
            } else {
                const payload = {
                    tableNo: inputTableNo,
                    seats: Number(form.seats || 4),
                    isActive: form.isActive,
                };
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

            if (activeGroupFilter !== ALL_GROUPS_FILTER && normalizedGroup && activeGroupFilter !== normalizedGroup) {
                setActiveGroupFilter(normalizedGroup);
            } else if (activeGroupFilter !== ALL_GROUPS_FILTER && !normalizedGroup) {
                setActiveGroupFilter(ALL_GROUPS_FILTER);
            }
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
                        body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; }
                        .sheet { max-width: 420px; margin: 0 auto; text-align: center; }
                        h1 { margin: 0 0 8px; font-size: 28px; }
                        p { margin: 0 0 14px; font-size: 13px; color: #4b5563; word-break: break-word; }
                        img { width: 260px; height: 260px; padding: 12px; border: 1px solid #d1d5db; border-radius: 12px; background: #ffffff; }
                    </style>
                </head>
                <body>
                    <div class="sheet">
                        <h1>Table ${safeTableNo}</h1>
                        <img src="${safeImage}" alt="QR for ${safeTableNo}" />
                        <p>${safeTarget}</p>
                    </div>
                    <script>
                        window.onload = function () { window.print(); window.close(); };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Table Session Action Handlers
    const handleOpenSessionSubmit = async (e) => {
        e.preventDefault();
        if (!openSessionTable) return;
        try {
            const payload = {
                restaurantId,
                guestCount: Number(sessionGuestCount || 1),
                waiterName: sessionWaiterName,
            };
            const res = await axios.post(`${API}/tables/${openSessionTable.id}/session`, payload);
            const created = res.data?.session;
            if (created) {
                setActiveSessions((prev) => ({
                    ...prev,
                    [String(openSessionTable.id)]: created,
                }));
            }
            const tableNo = openSessionTable.tableNo;
            setOpenSessionTable(null);
            showToast({
                title: "Table Session Opened",
                message: `Session started for Table ${tableNo}`,
                variant: "success",
            });
            navigate(`/admin/new-order?table=${encodeURIComponent(tableNo)}`);
        } catch (err) {
            setError(getErrorMessage(err, "Failed to open table session."));
        }
    };

    const handleGenerateBill = async (session) => {
        if (!session) return;
        try {
            const res = await axios.post(`${API}/tables/sessions/${session.id}/bill`);
            const updated = res.data?.session;
            if (updated) {
                setActiveSessions((prev) => ({
                    ...prev,
                    [String(updated.tableId)]: updated,
                }));
            }
            showToast({
                title: "Bill Generated",
                message: `Bill calculated for Table ${session.tableNo}`,
                variant: "success",
            });
        } catch (err) {
            setError(getErrorMessage(err, "Failed to generate bill."));
        }
    };

    const handleCloseSession = async (session) => {
        if (!session) return;
        const confirmed = window.confirm(`Close session and free Table ${session.tableNo}?`);
        if (!confirmed) return;
        try {
            await axios.post(`${API}/tables/sessions/${session.id}/close`);
            setActiveSessions((prev) => {
                const next = { ...prev };
                delete next[String(session.tableId)];
                return next;
            });
            setViewSessionDetail(null);
            showToast({
                title: "Table Session Closed",
                message: `Table ${session.tableNo} is now AVAILABLE.`,
                variant: "info",
            });
        } catch (err) {
            setError(getErrorMessage(err, "Failed to close table session."));
        }
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

    const getTableGroup = (table) => {
        const idKey = String(table?.id || "");
        if (idKey && tableGroups[idKey] && String(tableGroups[idKey]).trim()) {
            return String(tableGroups[idKey]).trim();
        }
        const noKey = String(table?.tableNo || "").trim();
        if (noKey && tableGroups[noKey] && String(tableGroups[noKey]).trim()) {
            return String(tableGroups[noKey]).trim();
        }

        if (noKey) {
            if (/^\d+$/.test(noKey)) return "Main Hall";
            const letterMatch = noKey.match(/^([A-Za-z]+)\s*\d+$/);
            if (letterMatch) {
                const prefix = letterMatch[1].toUpperCase();
                return prefix === "T" ? "Section T" : `Section ${prefix}`;
            }
        }
        return "Main Area";
    };

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

    const groupedTableEntries = useMemo(() => {
        const map = {};
        filteredTables.forEach((table) => {
            const group = getTableGroup(table);
            if (!map[group]) map[group] = [];
            map[group].push(table);
        });
        return Object.entries(map).sort(([a], [b]) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
        );
    }, [filteredTables, getTableGroup]);

    return (
        <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-3xl font-bold">Tables & Live Sessions</h3>
                    <p className="mt-1 text-sm text-gray-400">
                        Manage live table sessions, running KOT totals, guest counts, and share QR ordering links.
                    </p>
                </div>
            </div>

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

            {loading ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#111827] p-5 text-gray-300">
                    Loading live table sessions...
                </div>
            ) : filteredTables.length === 0 ? (
                <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#111827] p-6 text-center text-gray-300">
                    <p>
                        {tables.length === 0
                            ? "No tables yet. Add your first table above."
                            : `No tables match your search/group filter${
                                  activeGroupFilter !== ALL_GROUPS_FILTER ? ` ("${activeGroupFilter}")` : ""
                              }.`}
                    </p>
                </div>
            ) : (
                <div className="mt-4 flex flex-col gap-3">
                    {groupedTableEntries.map(([groupName, groupTables]) => {
                        const activeCount = groupTables.filter((t) => t.isActive).length;
                        return (
                            <section key={groupName} className="flex flex-col gap-2 py-0.5">
                                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-sm font-extrabold uppercase tracking-widest text-orange-400">
                                            {groupName}
                                        </span>
                                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-gray-300">
                                            {groupTables.length} table{groupTables.length === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                    <span className="text-xs font-medium text-emerald-400">
                                        {activeCount} active
                                    </span>
                                </div>

                                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
                                    {groupTables.map((table) => {
                                        const target = table.qrCodeUrl || buildTargetUrl(table.tableNo);
                                        const debugTarget = buildDebugTargetUrl(table.tableNo);
                                        const image = qrImageUrl(target);
                                        const tableGroup = getTableGroup(table);
                                        const session = activeSessions[String(table.id)];
                                        const sessionStatus = session ? session.status : "AVAILABLE";
                                        const isOccupied = sessionStatus === "OPEN";
                                        const isBilling = sessionStatus === "BILLING";
                                        const isPaid = sessionStatus === "PAID";
                                        const isAvailable = !session;

                                        return (
                                            <article
                                                key={table.id}
                                                className={`relative flex flex-col justify-between rounded-2xl border p-4 transition ${
                                                    isOccupied
                                                        ? "border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-[#0f172a]"
                                                        : isBilling
                                                        ? "border-purple-500/50 bg-gradient-to-b from-purple-500/10 to-[#0f172a]"
                                                        : isPaid
                                                        ? "border-cyan-500/50 bg-gradient-to-b from-cyan-500/10 to-[#0f172a]"
                                                        : "border-white/10 bg-[#0f172a] hover:border-orange-400/30"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-2xl font-bold">{table.tableNo}</p>
                                                            <span className="text-xs text-gray-400">({table.seats} seats)</span>
                                                        </div>
                                                        <select
                                                            value={tableGroup}
                                                            onChange={(e) => {
                                                                const newGrp = normalizeGroupName(e.target.value);
                                                                setTableGroups((prev) => ({
                                                                    ...prev,
                                                                    [String(table.id)]: newGrp,
                                                                }));
                                                            }}
                                                            className="mt-1 rounded-lg border border-white/10 bg-[#111827] px-2 py-0.5 text-[11px] text-orange-300 outline-none"
                                                            title="Change Table Group"
                                                        >
                                                            {groupOptions.map((g) => (
                                                                <option key={g} value={g}>
                                                                    {g}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                                                isOccupied
                                                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                                                    : isBilling
                                                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                                                    : isPaid
                                                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                                            }`}
                                                        >
                                                            <span className={`h-1.5 w-1.5 rounded-full ${isOccupied ? "bg-amber-400" : isBilling ? "bg-purple-400" : isPaid ? "bg-cyan-400" : "bg-emerald-400"}`} />
                                                            {sessionStatus}
                                                        </span>

                                                        <div className="relative" data-table-actions-menu>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleActionsMenu(table.id)}
                                                                className="rounded-lg border border-white/10 px-2 py-0.5 text-lg leading-none text-gray-200 hover:bg-white/10"
                                                            >
                                                                &#8942;
                                                            </button>
                                                            {openMenuId === table.id && (
                                                                <div className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-white/10 bg-[#0b1220] p-1.5 shadow-2xl">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { startEdit(table); setOpenMenuId(null); }}
                                                                        className={actionMenuItemClass}
                                                                    >
                                                                        Edit Table Config
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { copyQrLink(table); setOpenMenuId(null); }}
                                                                        className={actionMenuItemClass}
                                                                    >
                                                                        Copy QR Link
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { printQr(table); setOpenMenuId(null); }}
                                                                        className={actionMenuItemClass}
                                                                    >
                                                                        Print QR Sheet
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { handleDelete(table.id); setOpenMenuId(null); }}
                                                                        className={actionMenuItemClass}
                                                                    >
                                                                        Delete Table
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Live Session Body Info */}
                                                {session ? (
                                                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2.5 text-xs space-y-1">
                                                        <div className="flex items-center justify-between text-gray-300">
                                                            <span>Occupied Time:</span>
                                                            <strong className="text-amber-300 tabular-nums">{formatAge(session.openedAt)}</strong>
                                                        </div>
                                                        <div className="flex items-center justify-between text-gray-300">
                                                            <span>Running Total:</span>
                                                            <strong className="text-lg font-extrabold text-emerald-400 tabular-nums">{formatMoney(session.total)}</strong>
                                                        </div>
                                                        <div className="flex items-center justify-between text-gray-400 text-[11px]">
                                                            <span>Guests: {session.guestCount || 1}</span>
                                                            {session.waiterName && <span>Server: {session.waiterName}</span>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-3 rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-gray-400">
                                                        Table is currently available for seating.
                                                    </div>
                                                )}

                                                {/* Action Buttons */}
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {isAvailable && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenSessionTable(table)}
                                                            className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                                                        >
                                                            + Open Table Session
                                                        </button>
                                                    )}

                                                    {isOccupied && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/admin/new-order?table=${encodeURIComponent(table.tableNo)}`)}
                                                                className="flex-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-black hover:bg-orange-400"
                                                            >
                                                                + Add Items
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleGenerateBill(session)}
                                                                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
                                                            >
                                                                Generate Bill
                                                            </button>
                                                        </>
                                                    )}

                                                    {(isBilling || isPaid) && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/admin/new-order?table=${encodeURIComponent(table.tableNo)}`)}
                                                                className="flex-1 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-500"
                                                            >
                                                                View Order / Pay
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCloseSession(session)}
                                                                className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
                                                            >
                                                                Close Session
                                                            </button>
                                                        </>
                                                    )}
                                                </div>

                                                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                                                    <a href={target} target="_blank" rel="noreferrer" className="hover:text-orange-400 underline">
                                                        QR Link
                                                    </a>
                                                    <a href={debugTarget} target="_blank" rel="noreferrer" className="hover:text-orange-400 underline">
                                                        Debug Link
                                                    </a>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            {/* OPEN SESSION MODAL */}
            {openSessionTable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <form onSubmit={handleOpenSessionSubmit} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h4 className="text-xl font-bold">Open Table {openSessionTable.tableNo}</h4>
                            <button type="button" onClick={() => setOpenSessionTable(null)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Number of Guests</label>
                            <input
                                type="number"
                                min="1"
                                max={openSessionTable.seats || 20}
                                value={sessionGuestCount}
                                onChange={(e) => setSessionGuestCount(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm outline-none focus:border-orange-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Server / Waiter Name (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. Ramesh"
                                value={sessionWaiterName}
                                onChange={(e) => setSessionWaiterName(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm outline-none focus:border-orange-400"
                            />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button type="button" onClick={() => setOpenSessionTable(null)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm">
                                Cancel
                            </button>
                            <button type="submit" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500">
                                Start Session & Take Order
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
}
