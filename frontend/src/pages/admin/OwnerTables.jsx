import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../config";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { showToast } from "../../utils/toast";
import SplitBillingModal from "../../components/SplitBillingModal";
import OfflineStatusBar from "../../components/OfflineStatusBar";
import OfflineConflictModal from "../../components/OfflineConflictModal";
import { cacheTablesOffline, getOfflineTables } from "../../utils/offline/offlineDb";

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

    // Table Operations Modals State
    const [moveModalTable, setMoveModalTable] = useState(null);
    const [targetMoveTableId, setTargetMoveTableId] = useState("");
    const [submittingMove, setSubmittingMove] = useState(false);

    const [mergeModalTable, setMergeModalTable] = useState(null);
    const [targetMergeTableId, setTargetMergeTableId] = useState("");
    const [submittingMerge, setSubmittingMerge] = useState(false);

    const [transferModalTable, setTransferModalTable] = useState(null);
    const [targetTransferTableId, setTargetTransferTableId] = useState("");
    const [transferItemQtyMap, setTransferItemQtyMap] = useState({});
    const [submittingTransfer, setSubmittingTransfer] = useState(false);
    const [splitBillingSession, setSplitBillingSession] = useState(null);

    // Floor Plan Layout State
    const [viewMode, setViewMode] = useState("FLOOR_PLAN"); // "FLOOR_PLAN" | "GRID"
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [editedLayoutTables, setEditedLayoutTables] = useState({});
    const [selectedLayoutTableId, setSelectedLayoutTableId] = useState(null);
    const [submittingLayout, setSubmittingLayout] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [dragState, setDragState] = useState(null); // { tableId, startX, startY, origX, origY }

    // Initialize layout editing state
    const handleStartEditLayout = () => {
        const layoutMap = {};
        tables.forEach((t, index) => {
            const defaultSection = t.section || getTableGroup(t) || "Main Floor";
            const defaultX = t.positionX !== null && t.positionX !== undefined ? t.positionX : (index % 5) * 170 + 40;
            const defaultY = t.positionY !== null && t.positionY !== undefined ? t.positionY : Math.floor(index / 5) * 140 + 40;

            layoutMap[t.id] = {
                id: t.id,
                tableNo: t.tableNo,
                seats: t.seats || 4,
                section: defaultSection,
                positionX: defaultX,
                positionY: defaultY,
                width: t.width || 130,
                height: t.height || 100,
                shape: t.shape || "RECTANGLE",
                rotation: t.rotation || 0,
            };
        });
        setEditedLayoutTables(layoutMap);
        setIsEditingLayout(true);
    };

    // Save Floor Plan Layout to Backend
    const handleSaveLayout = async () => {
        try {
            setSubmittingLayout(true);
            const tablesArray = Object.values(editedLayoutTables);
            const res = await axios.put(`${API}/owner/${restaurantId}/tables/layout`, {
                tables: tablesArray,
            });
            showToast({
                title: "Floor Plan Saved",
                message: res.data?.message || "Floor plan layout updated successfully.",
                variant: "success",
            });
            setIsEditingLayout(false);
            await loadTables();
        } catch (err) {
            console.error("Error saving floor plan layout:", err);
            showToast({
                title: "Save Error",
                message: err?.response?.data?.message || "Failed to save floor plan layout.",
                variant: "error",
            });
        } finally {
            setSubmittingLayout(false);
        }
    };

    // Cancel Layout Edits
    const handleCancelLayout = () => {
        setEditedLayoutTables({});
        setSelectedLayoutTableId(null);
        setIsEditingLayout(false);
    };

    // Handle Move Table
    const handleConfirmMoveTable = async (e) => {
        e.preventDefault();
        if (!moveModalTable || !targetMoveTableId) return;

        try {
            setSubmittingMove(true);
            const res = await axios.post(
                `${API}/owner/${restaurantId}/tables/${moveModalTable.id}/move`,
                { targetTableId: Number(targetMoveTableId) }
            );
            showToast({
                title: "Table Moved",
                message: res.data?.message || `Table ${moveModalTable.tableNo} moved successfully.`,
                variant: "success",
            });
            setMoveModalTable(null);
            setTargetMoveTableId("");
            await loadTables();
            await loadActiveSessions();
        } catch (err) {
            console.error("Error moving table:", err);
            const msg = err?.response?.data?.message || "Failed to move table.";
            if (err?.response?.status === 409) {
                showToast({
                    title: "Table Occupied",
                    message: "Target table is occupied. You can merge the tables instead.",
                    variant: "warning",
                });
            } else {
                showToast({ title: "Move Error", message: msg, variant: "error" });
            }
        } finally {
            setSubmittingMove(false);
        }
    };

    // Handle Merge Tables
    const handleConfirmMergeTables = async (e) => {
        e.preventDefault();
        if (!mergeModalTable || !targetMergeTableId) return;

        try {
            setSubmittingMerge(true);
            const res = await axios.post(
                `${API}/owner/${restaurantId}/tables/${targetMergeTableId}/merge`,
                {
                    primaryTableId: Number(targetMergeTableId),
                    secondaryTableId: Number(mergeModalTable.id),
                }
            );
            showToast({
                title: "Tables Merged",
                message: res.data?.message || "Tables merged successfully.",
                variant: "success",
            });
            setMergeModalTable(null);
            setTargetMergeTableId("");
            await loadTables();
            await loadActiveSessions();
        } catch (err) {
            console.error("Error merging tables:", err);
            showToast({
                title: "Merge Error",
                message: err?.response?.data?.message || "Failed to merge tables.",
                variant: "error",
            });
        } finally {
            setSubmittingMerge(false);
        }
    };

    // Handle Item Transfer
    const handleConfirmTransferItems = async (e) => {
        e.preventDefault();
        if (!transferModalTable || !targetTransferTableId) return;

        const itemsToTransfer = Object.entries(transferItemQtyMap)
            .filter(([, qty]) => Number(qty) > 0)
            .map(([orderItemId, qtyToTransfer]) => ({
                orderItemId: Number(orderItemId),
                qtyToTransfer: Number(qtyToTransfer),
            }));

        if (!itemsToTransfer.length) {
            showToast({
                title: "Validation",
                message: "Please select at least one item quantity to transfer.",
                variant: "warning",
            });
            return;
        }

        try {
            setSubmittingTransfer(true);
            const res = await axios.post(
                `${API}/owner/${restaurantId}/tables/${transferModalTable.id}/transfer-items`,
                {
                    targetTableId: Number(targetTransferTableId),
                    items: itemsToTransfer,
                }
            );
            showToast({
                title: "Items Transferred",
                message: res.data?.message || "Items transferred successfully.",
                variant: "success",
            });
            setTransferModalTable(null);
            setTargetTransferTableId("");
            setTransferItemQtyMap({});
            await loadTables();
            await loadActiveSessions();
        } catch (err) {
            console.error("Error transferring items:", err);
            showToast({
                title: "Transfer Error",
                message: err?.response?.data?.message || "Failed to transfer items.",
                variant: "error",
            });
        } finally {
            setSubmittingTransfer(false);
        }
    };

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
        socket.on("table:updated", loadActiveSessions);
        socket.on("table:layout_updated", loadTables);
        socket.on("order:created", loadActiveSessions);
        socket.on("order:updated", loadActiveSessions);

        return () => {
            socket.off("table:session_updated", onSessionUpdated);
            socket.off("table:updated", loadActiveSessions);
            socket.off("table:layout_updated", loadTables);
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

    useEffect(() => {
        if (tables.length > 0) {
            cacheTablesOffline(restaurantId || 1, tables, activeSessions);
        } else {
            getOfflineTables(restaurantId || 1).then((cached) => {
                if (cached?.tables?.length) {
                    setTables(cached.tables);
                    if (cached.activeSessions) setActiveSessions(cached.activeSessions);
                }
            });
        }
    }, [tables, activeSessions, restaurantId]);

    return (
        <section>
            <OfflineConflictModal />
            <OfflineStatusBar />
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
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

            {/* VIEW MODE SWITCHER & FLOOR PLAN TOOLBAR */}
            <div className="mx-auto mt-4 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0f172a] p-3 shadow-xl">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 rounded-xl bg-[#111827] p-1 border border-white/10">
                    <button
                        type="button"
                        onClick={() => setViewMode("FLOOR_PLAN")}
                        className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                            viewMode === "FLOOR_PLAN"
                                ? "bg-orange-500 text-black shadow-md"
                                : "text-gray-300 hover:text-white"
                        }`}
                    >
                        <span>🗺️</span> Floor Plan View
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("GRID")}
                        className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                            viewMode === "GRID"
                                ? "bg-orange-500 text-black shadow-md"
                                : "text-gray-300 hover:text-white"
                        }`}
                    >
                        <span>📋</span> Grid List View
                    </button>
                </div>

                {/* Status Legend */}
                <div className="hidden sm:flex items-center gap-3 text-[11px] font-semibold text-gray-300">
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Available
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" /> Occupied
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-400" /> Billing
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Paid
                    </span>
                </div>

                {/* Layout Editor Controls */}
                {viewMode === "FLOOR_PLAN" && (
                    <div className="flex items-center gap-2">
                        {!isEditingLayout ? (
                            <button
                                type="button"
                                onClick={handleStartEditLayout}
                                className="flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3.5 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-500/20"
                            >
                                <span>✏️</span> Edit Floor Layout
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={handleSaveLayout}
                                    disabled={submittingLayout}
                                    className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    {submittingLayout ? "Saving..." : "💾 Save Layout"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelLayout}
                                    className="rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                )}
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

            {/* VISUAL FLOOR PLAN CANVAS DISPLAY */}
            {viewMode === "FLOOR_PLAN" && !loading && (
                <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-3">
                    {/* Zoom & Canvas Inspector Bar */}
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0f172a] px-4 py-2 text-xs">
                        <span className="font-semibold text-gray-300">
                            {isEditingLayout ? "✏️ Drag tables to position. Click table to edit shape/rotation." : "📍 Live Spatial Floor View"}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">Zoom:</span>
                            <button
                                type="button"
                                onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.1))}
                                className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 font-bold hover:bg-white/10"
                            >
                                -
                            </button>
                            <span className="w-10 text-center font-semibold text-orange-400">{Math.round(zoomLevel * 100)}%</span>
                            <button
                                type="button"
                                onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                                className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 font-bold hover:bg-white/10"
                            >
                                +
                            </button>
                            <button
                                type="button"
                                onClick={() => setZoomLevel(1)}
                                className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-gray-400 hover:text-white"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Inspector Toolbar for Selected Table in Edit Mode */}
                    {isEditingLayout && selectedLayoutTableId && editedLayoutTables[selectedLayoutTableId] && (
                        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-orange-500/40 bg-orange-950/30 p-3 text-xs">
                            <span className="font-bold text-orange-400">
                                Editing Table {editedLayoutTables[selectedLayoutTableId].tableNo}:
                            </span>
                            <div className="flex items-center gap-2">
                                <label className="text-gray-300 font-semibold">Shape:</label>
                                <select
                                    value={editedLayoutTables[selectedLayoutTableId].shape}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setEditedLayoutTables(prev => ({
                                            ...prev,
                                            [selectedLayoutTableId]: { ...prev[selectedLayoutTableId], shape: val }
                                        }));
                                    }}
                                    className="rounded-lg border border-white/10 bg-[#111827] px-2 py-1 text-white outline-none"
                                >
                                    <option value="RECTANGLE">Rectangle ▭</option>
                                    <option value="ROUND">Circle ◯</option>
                                    <option value="SQUARE">Square ▢</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-gray-300 font-semibold">Rotate:</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditedLayoutTables(prev => ({
                                            ...prev,
                                            [selectedLayoutTableId]: {
                                                ...prev[selectedLayoutTableId],
                                                rotation: ((prev[selectedLayoutTableId].rotation || 0) + 90) % 360
                                            }
                                        }));
                                    }}
                                    className="rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 font-bold text-white hover:bg-white/20"
                                >
                                    🔄 {editedLayoutTables[selectedLayoutTableId].rotation || 0}°
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-gray-300 font-semibold">Section:</label>
                                <select
                                    value={editedLayoutTables[selectedLayoutTableId].section}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setEditedLayoutTables(prev => ({
                                            ...prev,
                                            [selectedLayoutTableId]: { ...prev[selectedLayoutTableId], section: val }
                                        }));
                                    }}
                                    className="rounded-lg border border-white/10 bg-[#111827] px-2 py-1 text-white outline-none"
                                >
                                    {groupOptions.map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Interactive Spatial Canvas */}
                    <div className="relative w-full overflow-auto rounded-2xl border border-white/10 bg-[#090d16] p-4 shadow-2xl">
                        <div
                            style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top left" }}
                            className="relative min-w-[950px] h-[550px] rounded-xl border border-white/5 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:24px_24px] select-none"
                            onMouseMove={(e) => {
                                if (!isEditingLayout || !dragState) return;
                                const canvasRect = e.currentTarget.getBoundingClientRect();
                                const rawX = (e.clientX - canvasRect.left) / zoomLevel - dragState.offsetX;
                                const rawY = (e.clientY - canvasRect.top) / zoomLevel - dragState.offsetY;
                                const snapX = Math.max(10, Math.min(820, Math.round(rawX / 10) * 10));
                                const snapY = Math.max(10, Math.min(450, Math.round(rawY / 10) * 10));

                                setEditedLayoutTables(prev => ({
                                    ...prev,
                                    [dragState.tableId]: {
                                        ...prev[dragState.tableId],
                                        positionX: snapX,
                                        positionY: snapY,
                                    }
                                }));
                            }}
                            onMouseUp={() => setDragState(null)}
                            onMouseLeave={() => setDragState(null)}
                        >
                            {filteredTables.map((table, index) => {
                                const session = activeSessions[String(table.id)];
                                const sessionStatus = session ? session.status : "AVAILABLE";
                                const isOccupied = sessionStatus === "OPEN";
                                const isBilling = sessionStatus === "BILLING";
                                const isPaid = sessionStatus === "PAID";
                                const isAvailable = !session;

                                const layoutData = isEditingLayout && editedLayoutTables[table.id]
                                    ? editedLayoutTables[table.id]
                                    : {
                                        positionX: table.positionX !== null && table.positionX !== undefined ? table.positionX : (index % 5) * 170 + 30,
                                        positionY: table.positionY !== null && table.positionY !== undefined ? table.positionY : Math.floor(index / 5) * 140 + 30,
                                        width: table.width || 130,
                                        height: table.height || 100,
                                        shape: table.shape || "RECTANGLE",
                                        rotation: table.rotation || 0,
                                        section: table.section || getTableGroup(table),
                                    };

                                const isSelectedInEdit = isEditingLayout && selectedLayoutTableId === table.id;

                                const shapeClasses =
                                    layoutData.shape === "ROUND"
                                        ? "rounded-full"
                                        : layoutData.shape === "SQUARE"
                                        ? "rounded-2xl aspect-square"
                                        : "rounded-2xl";

                                return (
                                    <div
                                        key={table.id}
                                        style={{
                                            position: "absolute",
                                            left: `${layoutData.positionX}px`,
                                            top: `${layoutData.positionY}px`,
                                            width: `${layoutData.width}px`,
                                            height: `${layoutData.height}px`,
                                            transform: `rotate(${layoutData.rotation}deg)`,
                                        }}
                                        onMouseDown={(e) => {
                                            if (!isEditingLayout) return;
                                            e.stopPropagation();
                                            setSelectedLayoutTableId(table.id);
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setDragState({
                                                tableId: table.id,
                                                offsetX: (e.clientX - rect.left) / zoomLevel,
                                                offsetY: (e.clientY - rect.top) / zoomLevel,
                                            });
                                        }}
                                        className={`group flex flex-col justify-between p-3 border transition-all cursor-pointer ${shapeClasses} ${
                                            isSelectedInEdit
                                                ? "ring-2 ring-orange-500 shadow-orange-500/50 shadow-xl z-30"
                                                : ""
                                        } ${
                                            isOccupied
                                                ? "border-amber-500/80 bg-gradient-to-br from-amber-950/80 via-[#0f172a] to-amber-900/40 text-amber-200 shadow-amber-500/20 shadow-lg"
                                                : isBilling
                                                ? "border-purple-500/80 bg-gradient-to-br from-purple-950/80 via-[#0f172a] to-purple-900/40 text-purple-200 shadow-purple-500/20 shadow-lg"
                                                : isPaid
                                                ? "border-cyan-500/80 bg-gradient-to-br from-cyan-950/80 via-[#0f172a] to-cyan-900/40 text-cyan-200"
                                                : "border-emerald-500/40 bg-gradient-to-br from-[#0f172a] to-emerald-950/20 text-gray-200 hover:border-emerald-400"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-extrabold text-sm tracking-tight">{table.tableNo}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 font-bold text-gray-300">
                                                🪑 {table.seats}
                                            </span>
                                        </div>

                                        {session ? (
                                            <div className="text-center my-0.5">
                                                <p className="text-sm font-black text-emerald-400 tabular-nums">{formatMoney(session.total)}</p>
                                                <p className="text-[10px] text-amber-300">{formatAge(session.openedAt)}</p>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-center text-emerald-400/80 font-semibold">Available</p>
                                        )}

                                        {!isEditingLayout && (
                                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/10">
                                                {isAvailable ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setOpenSessionTable(table); }}
                                                        className="w-full rounded bg-emerald-600/80 py-0.5 font-bold text-white hover:bg-emerald-500"
                                                    >
                                                        + Open
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/new-order?table=${encodeURIComponent(table.tableNo)}`); }}
                                                        className="w-full rounded bg-orange-500/80 py-0.5 font-bold text-black hover:bg-orange-400"
                                                    >
                                                        Order
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

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
                                                                <div className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-white/10 bg-[#0b1220] p-1.5 shadow-2xl">
                                                                    {session && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setMoveModalTable(table); setTargetMoveTableId(""); setOpenMenuId(null); }}
                                                                                className={actionMenuItemClass}
                                                                            >
                                                                                Move Table Session
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setMergeModalTable(table); setTargetMergeTableId(""); setOpenMenuId(null); }}
                                                                                className={actionMenuItemClass}
                                                                            >
                                                                                Merge into Table
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setTransferModalTable(table); setTargetTransferTableId(""); setTransferItemQtyMap({}); setOpenMenuId(null); }}
                                                                                className={actionMenuItemClass}
                                                                            >
                                                                                Transfer Items / Split
                                                                            </button>
                                                                            <div className="my-1 border-t border-white/10" />
                                                                        </>
                                                                    )}
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

                                                {/* Table Operations Quick Actions */}
                                                {session && (
                                                    <div className="mt-2 flex gap-1.5 text-[11px]">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setMoveModalTable(table); setTargetMoveTableId(""); }}
                                                            className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1 font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
                                                            title="Move session to an available table"
                                                        >
                                                            Move
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setMergeModalTable(table); setTargetMergeTableId(""); }}
                                                            className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1 font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
                                                            title="Merge with another table session"
                                                        >
                                                            Merge
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setTransferModalTable(table); setTargetTransferTableId(""); setTransferItemQtyMap({}); }}
                                                            className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1 font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
                                                            title="Transfer items / Split table"
                                                        >
                                                            Split/Transfer
                                                        </button>
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
                                                                onClick={() => setSplitBillingSession(session)}
                                                                className="rounded-xl border border-purple-500/40 bg-purple-500/20 px-3 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/30"
                                                            >
                                                                Split / Pay
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
                                                                onClick={() => setSplitBillingSession(session)}
                                                                className="flex-1 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-500"
                                                            >
                                                                Split Bill / Checkout
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

            {/* MOVE TABLE MODAL */}
            {moveModalTable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <form onSubmit={handleConfirmMoveTable} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h4 className="text-xl font-bold">Move Table {moveModalTable.tableNo}</h4>
                            <button type="button" onClick={() => setMoveModalTable(null)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <p className="text-xs text-gray-300">
                            Relocate active session from Table <strong className="text-orange-400">{moveModalTable.tableNo}</strong> to an empty table.
                        </p>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Select Target Table</label>
                            <select
                                value={targetMoveTableId}
                                onChange={(e) => setTargetMoveTableId(e.target.value)}
                                required
                                className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white outline-none focus:border-orange-400"
                            >
                                <option value="">-- Select Empty Table --</option>
                                {tables
                                    .filter((t) => t.id !== moveModalTable.id && t.isActive && !activeSessions[String(t.id)])
                                    .map((t) => (
                                        <option key={t.id} value={t.id}>
                                            Table {t.tableNo} ({t.seats} Seats) - Available
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button type="button" onClick={() => setMoveModalTable(null)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submittingMove || !targetMoveTableId}
                                className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50"
                            >
                                {submittingMove ? "Moving..." : "Confirm Move"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MERGE TABLES MODAL */}
            {mergeModalTable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <form onSubmit={handleConfirmMergeTables} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h4 className="text-xl font-bold">Merge Table {mergeModalTable.tableNo}</h4>
                            <button type="button" onClick={() => setMergeModalTable(null)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <p className="text-xs text-gray-300">
                            Merge Table <strong className="text-amber-400">{mergeModalTable.tableNo}</strong> into another occupied table. All active items will be combined, and Table {mergeModalTable.tableNo} will be cleared.
                        </p>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Select Primary Table (To Merge Into)</label>
                            <select
                                value={targetMergeTableId}
                                onChange={(e) => setTargetMergeTableId(e.target.value)}
                                required
                                className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white outline-none focus:border-orange-400"
                            >
                                <option value="">-- Select Occupied Table --</option>
                                {tables
                                    .filter((t) => t.id !== mergeModalTable.id && t.isActive && activeSessions[String(t.id)])
                                    .map((t) => {
                                        const sess = activeSessions[String(t.id)];
                                        return (
                                            <option key={t.id} value={t.id}>
                                                Table {t.tableNo} ({formatMoney(sess?.total)})
                                            </option>
                                        );
                                    })}
                            </select>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button type="button" onClick={() => setMergeModalTable(null)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submittingMerge || !targetMergeTableId}
                                className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50"
                            >
                                {submittingMerge ? "Merging..." : "Confirm Merge"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TRANSFER ITEMS / SPLIT MODAL */}
            {transferModalTable && (() => {
                const session = activeSessions[String(transferModalTable.id)];
                const allItems = session?.orders?.flatMap((o) => o.items || []) || [];

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                        <form onSubmit={handleConfirmTransferItems} className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                                <div>
                                    <h4 className="text-xl font-bold">Transfer Items / Split Table</h4>
                                    <p className="text-xs text-gray-400">Source: Table {transferModalTable.tableNo}</p>
                                </div>
                                <button type="button" onClick={() => setTransferModalTable(null)} className="text-gray-400 hover:text-white">✕</button>
                            </div>

                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-gray-300 mb-1">Select Target Table</label>
                                <select
                                    value={targetTransferTableId}
                                    onChange={(e) => setTargetTransferTableId(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white outline-none focus:border-orange-400"
                                >
                                    <option value="">-- Select Target Table --</option>
                                    {tables
                                        .filter((t) => t.id !== transferModalTable.id && t.isActive)
                                        .map((t) => {
                                            const isOcc = !!activeSessions[String(t.id)];
                                            return (
                                                <option key={t.id} value={t.id}>
                                                    Table {t.tableNo} ({isOcc ? "Occupied" : "Available"})
                                                </option>
                                            );
                                        })}
                                </select>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
                                <label className="block text-xs font-semibold text-gray-300">Select Item Quantities to Transfer</label>
                                {allItems.length === 0 ? (
                                    <p className="text-xs text-gray-400 py-4 text-center">No active order items found on Table {transferModalTable.tableNo}.</p>
                                ) : (
                                    allItems.map((item) => {
                                        const currentTransferQty = transferItemQtyMap[item.id] || 0;
                                        return (
                                            <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#111827] p-3">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="text-sm font-semibold truncate">{item.itemName}</p>
                                                    {item.variantName && <p className="text-[11px] text-gray-400">{item.variantName}</p>}
                                                    <p className="text-xs text-emerald-400">{formatMoney(item.price)} × {item.qty}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setTransferItemQtyMap(prev => ({
                                                            ...prev,
                                                            [item.id]: Math.max(0, (prev[item.id] || 0) - 1)
                                                        }))}
                                                        className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-sm font-bold text-gray-200 hover:bg-white/10"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="w-6 text-center text-sm font-extrabold">{currentTransferQty}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setTransferItemQtyMap(prev => ({
                                                            ...prev,
                                                            [item.id]: Math.min(item.qty, (prev[item.id] || 0) + 1)
                                                        }))}
                                                        className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-sm font-bold text-gray-200 hover:bg-white/10"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
                                <button type="button" onClick={() => setTransferModalTable(null)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingTransfer || !targetTransferTableId}
                                    className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50"
                                >
                                    {submittingTransfer ? "Transferring..." : "Confirm Item Transfer"}
                                </button>
                            </div>
                        </form>
                    </div>
                );
            })()}

            {/* SPLIT BILLING & MULTI-PAYMENT MODAL */}
            {splitBillingSession && (
                <SplitBillingModal
                    isOpen={!!splitBillingSession}
                    onClose={() => setSplitBillingSession(null)}
                    session={splitBillingSession}
                    restaurantId={restaurantId}
                    onSessionUpdated={(updatedSession) => {
                        if (updatedSession) {
                            setActiveSessions((prev) => {
                                const next = { ...prev };
                                if (updatedSession.status === "CLOSED" || updatedSession.status === "PAID") {
                                    delete next[String(updatedSession.tableId)];
                                } else {
                                    next[String(updatedSession.tableId)] = updatedSession;
                                }
                                return next;
                            });
                        }
                    }}
                />
            )}
        </section>
    );
}
