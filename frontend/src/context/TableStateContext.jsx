import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API } from "../config";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { useStaffSocket } from "./StaffSocketContext";
import { setCacheEntry } from "../utils/localCache";

export const TableStateContext = createContext(null);

/**
 * Canonical Table Identity helper (Step 3)
 * Primary identity: `${restaurantId}:table:${tableId}`
 */
export function getCanonicalTableKey({ restaurantId, tableId, id }) {
    const tid = tableId || id;
    if (!tid) return null;
    return `${restaurantId || "default"}:table:${tid}`;
}

/**
 * Normalizes any incoming table record into the strict canonical schema (Step 2)
 */
export function normalizeCanonicalTable(raw, defaultRestaurantId = null) {
    if (!raw || typeof raw !== "object") return null;

    const tid = Number(raw.id || raw.tableId || 0);
    const rid = Number(raw.restaurantId || defaultRestaurantId || 0);
    const tableNo = String(raw.tableNo || raw.label || "").trim();

    const hasStatus = raw.status !== undefined && raw.status !== null;
    const hasOccupancy = raw.isOccupied !== undefined && raw.isOccupied !== null;

    const isExplicitlyFree =
        raw.status === "AVAILABLE" ||
        raw.isOccupied === false ||
        raw.session?.status === "CLOSED" ||
        raw.activeSession?.status === "CLOSED" ||
        raw.sessionStatus === "CLOSED";

    const isBlocked = Boolean(raw.isBlocked);
    const isReserved = !isBlocked && !raw.isOccupied && Boolean(raw.activeReservation || raw.isReserved);
    const cleaningStatus = raw.cleaningStatus || (raw.status === "DIRTY" ? "DIRTY" : "CLEAN");

    let canonicalStatus = hasStatus ? String(raw.status).toUpperCase() : undefined;
    if (isBlocked) {
        canonicalStatus = "BLOCKED";
    } else if (cleaningStatus === "DIRTY" && !raw.isOccupied) {
        canonicalStatus = "DIRTY";
    } else if (canonicalStatus === undefined && isExplicitlyFree) {
        canonicalStatus = isReserved ? "RESERVED" : "AVAILABLE";
    } else if (raw.isOccupied) {
        canonicalStatus = raw.activeOrderStatus === "PAYMENT_PENDING"
            ? "PAYMENT_PENDING"
            : raw.activeSession?.status === "BILLING" || raw.session?.status === "BILLING"
            ? "BILLING"
            : "OCCUPIED";
    }

    const isOccupied = hasOccupancy
        ? Boolean(raw.isOccupied)
        : (canonicalStatus ? (!isExplicitlyFree && (canonicalStatus === "OCCUPIED" || canonicalStatus === "PAYMENT_PENDING" || canonicalStatus === "BILLING")) : undefined);

    // Canonical Server Assignment
    let assignedWaiterId = raw.assignedWaiterId !== undefined
        ? (raw.assignedWaiterId ? Number(raw.assignedWaiterId) : null)
        : (raw.assignedServerId ? Number(raw.assignedServerId) : (raw.activeSession?.waiterId ? Number(raw.activeSession.waiterId) : undefined));

    let assignedWaiterName = raw.assignedWaiterName !== undefined
        ? raw.assignedWaiterName
        : (raw.assignedServer !== undefined ? raw.assignedServer : (raw.assignedServerName !== undefined ? raw.assignedServerName : (raw.activeSession?.waiterName || undefined)));

    const activeOrders = Array.isArray(raw.activeOrders) ? raw.activeOrders : (isExplicitlyFree ? [] : undefined);
    const activeOrderCount = raw.activeOrderCount !== undefined ? Number(raw.activeOrderCount) : (activeOrders ? activeOrders.length : (isExplicitlyFree ? 0 : undefined));
    const activeItemCount = raw.activeItemCount !== undefined ? Number(raw.activeItemCount) : (isExplicitlyFree ? 0 : undefined);
    const activeOrderStatus = raw.activeOrderStatus !== undefined ? raw.activeOrderStatus : (isExplicitlyFree ? null : undefined);
    const paymentStatus = isExplicitlyFree ? null : (activeOrderStatus === "PAYMENT_PENDING" ? "PENDING" : raw.paymentStatus);

    const version = Number(raw.version || (raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now()));
    const updatedAt = raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date(version).toISOString();

    const normalized = {
        ...raw,
        id: tid,
        tableId: tid,
        restaurantId: rid,
        tableNo,
        isBlocked,
        isReserved,
        cleaningStatus,
        blockReason: raw.blockReason || null,
        blockedAt: raw.blockedAt || null,
        blockedByName: raw.blockedByName || null,
        total: Number(raw.total || raw.payableAmount || 0),
        payableAmount: Number(raw.payableAmount || raw.total || 0),
        section: raw.section || "Main Floor",
        seats: Number(raw.seats || 4),
        version,
        updatedAt,
    };

    if (canonicalStatus !== undefined) normalized.status = canonicalStatus;
    if (isOccupied !== undefined) normalized.isOccupied = isOccupied;
    if (assignedWaiterId !== undefined) {
        normalized.assignedWaiterId = assignedWaiterId;
        normalized.assignedServerId = assignedWaiterId;
    }
    if (assignedWaiterName !== undefined) {
        normalized.assignedWaiterName = assignedWaiterName;
        normalized.assignedServer = assignedWaiterName;
        normalized.assignedServerName = assignedWaiterName;
    }
    if (activeOrders !== undefined) normalized.activeOrders = activeOrders;
    if (activeOrderCount !== undefined) normalized.activeOrderCount = activeOrderCount;
    if (activeItemCount !== undefined) normalized.activeItemCount = activeItemCount;
    if (activeOrderStatus !== undefined) normalized.activeOrderStatus = activeOrderStatus;
    if (paymentStatus !== undefined) normalized.paymentStatus = paymentStatus;

    if (isExplicitlyFree) {
        normalized.sessionId = null;
        normalized.sessionStatus = "CLOSED";
        normalized.session = { status: "CLOSED" };
        normalized.activeSession = null;
        normalized.occupiedSince = null;
    } else if (raw.sessionId || raw.session || raw.activeSession) {
        normalized.sessionId = raw.sessionId || raw.session?.id || raw.activeSession?.id || null;
        normalized.sessionStatus = raw.session?.status || raw.activeSession?.status || raw.sessionStatus || "OPEN";
        normalized.session = raw.session || raw.activeSession || null;
        normalized.activeSession = raw.activeSession || raw.session || null;
        normalized.occupiedSince = raw.occupiedSince || raw.activeSession?.openedAt || null;
    }

    return normalized;
}

/**
 * Reconciles current canonical table with an incoming table or patch (Step 10: Race Protection)
 */
export function reconcileTable(current, incoming) {
    if (!current) return incoming;
    if (!incoming) return current;

    const currentVer = Number(current.version || (current.updatedAt ? new Date(current.updatedAt).getTime() : 0));
    const incomingVer = Number(incoming.version || (incoming.updatedAt ? new Date(incoming.updatedAt).getTime() : 0));

    // Stale HTTP/Socket Response Rejection:
    // If incoming is strictly older than current, reject the stale update!
    if (incomingVer > 0 && currentVer > 0 && incomingVer < currentVer) {
        return current;
    }

    const hasIncomingAssignment = incoming.assignedWaiterId !== undefined || incoming.assignedWaiterName !== undefined || incoming.assignedServer !== undefined;
    const isExplicitRelease =
        !hasIncomingAssignment &&
        Boolean(
            (incoming.status === "AVAILABLE" && incoming.isOccupied === false) ||
            incoming.session?.status === "CLOSED" ||
            incoming.activeSession?.status === "CLOSED" ||
            incoming.sessionStatus === "CLOSED"
        );

    if (isExplicitRelease) {
        return {
            ...current,
            ...incoming,
            status: "AVAILABLE",
            isOccupied: false,
            isReserved: Boolean(incoming.isReserved),
            activeOrders: [],
            activeOrderCount: 0,
            activeItemCount: 0,
            activeOrderStatus: null,
            paymentStatus: null,
            occupiedSince: null,
            assignedServer: null,
            assignedServerId: null,
            assignedServerName: null,
            assignedWaiterId: null,
            assignedWaiterName: null,
            session: { status: "CLOSED" },
            activeSession: null,
            sessionId: null,
            sessionStatus: "CLOSED",
            version: Math.max(currentVer, incomingVer, Date.now()),
            updatedAt: incoming.updatedAt || new Date().toISOString(),
        };
    }

    const resolvedWaiterId = incoming.assignedWaiterId !== undefined ? incoming.assignedWaiterId : current.assignedWaiterId;
    const resolvedWaiterName = incoming.assignedWaiterName !== undefined ? incoming.assignedWaiterName : current.assignedWaiterName;
    const resolvedServer = incoming.assignedServer !== undefined ? incoming.assignedServer : (incoming.assignedWaiterName !== undefined ? incoming.assignedWaiterName : current.assignedServer);

    return {
        ...current,
        ...incoming,
        status: incoming.status !== undefined ? incoming.status : current.status,
        isOccupied: incoming.isOccupied !== undefined ? incoming.isOccupied : current.isOccupied,
        assignedWaiterId: resolvedWaiterId,
        assignedWaiterName: resolvedWaiterName,
        assignedServer: resolvedServer,
        assignedServerId: incoming.assignedServerId !== undefined ? incoming.assignedServerId : resolvedWaiterId,
        assignedServerName: incoming.assignedServerName !== undefined ? incoming.assignedServerName : resolvedServer,
        version: Math.max(currentVer, incomingVer, Date.now()),
        updatedAt: incoming.updatedAt || new Date().toISOString(),
    };
}

export function TableStateProvider({ children }) {
    const { user } = useAuth();
    const { socket, connected } = useStaffSocket();

    const restaurantId = useMemo(() => {
        return Number(user?.restaurantId || user?.restaurant?.id || 0) || null;
    }, [user]);

    // Canonical Map: tableId -> canonical Table object
    const [tablesMap, setTablesMap] = useState(() => new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Track active fetch request IDs to prevent out-of-order race conditions
    const fetchSeqRef = useRef(0);
    const tablesMapRef = useRef(tablesMap);
    tablesMapRef.current = tablesMap;

    const tables = useMemo(() => {
        return Array.from(tablesMap.values()).sort((a, b) => {
            const na = Number(a.tableNo);
            const nb = Number(b.tableNo);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
            return String(a.tableNo || "").localeCompare(String(b.tableNo || ""));
        });
    }, [tablesMap]);

    const tablesById = useMemo(() => {
        const map = new Map();
        tables.forEach((t) => {
            if (t?.id) map.set(Number(t.id), t);
        });
        return map;
    }, [tables]);

    const occupiedCount = useMemo(() => {
        return tables.filter((t) => t.isOccupied).length;
    }, [tables]);

    const totalCount = tables.length;
    const freeCount = Math.max(0, totalCount - occupiedCount);

    const getTable = useCallback((tableId) => {
        if (!tableId) return null;
        return tablesById.get(Number(tableId)) || null;
    }, [tablesById]);

    const getTableByNo = useCallback((tableNo) => {
        if (!tableNo) return null;
        const norm = String(tableNo).trim().toLowerCase();
        return tables.find((t) => String(t.tableNo).trim().toLowerCase() === norm) || null;
    }, [tables]);

    // Upsert or patch a table into canonical state with race protection
    const upsertTable = useCallback((tableOrPatch) => {
        if (!tableOrPatch || typeof tableOrPatch !== "object") return;
        const tid = Number(tableOrPatch.id || tableOrPatch.tableId || 0);
        if (!tid) return;

        setTablesMap((prev) => {
            const next = new Map(prev);
            const existing = next.get(tid);
            const normalized = normalizeCanonicalTable(tableOrPatch, restaurantId);
            const reconciled = reconcileTable(existing, normalized);
            next.set(tid, reconciled);
            return next;
        });
    }, [restaurantId]);

    // Bulk reconcile an array of tables from HTTP response (Step 10: Race Protection)
    const reconcileIncomingTables = useCallback((incomingList, responseTimestamp = Date.now()) => {
        if (!Array.isArray(incomingList)) return;

        setTablesMap((prev) => {
            const next = new Map(prev);
            incomingList.forEach((raw) => {
                const normalized = normalizeCanonicalTable({ ...raw, version: raw.version || responseTimestamp }, restaurantId);
                if (!normalized || !normalized.id) return;
                const existing = next.get(normalized.id);
                const reconciled = reconcileTable(existing, normalized);
                next.set(normalized.id, reconciled);
            });
            return next;
        });
    }, [restaurantId]);

    // Authoritative Fetch / Rehydrate from Backend (Step 11)
    const refreshTables = useCallback(async ({ force = false } = {}) => {
        if (!restaurantId) return [];
        const seq = ++fetchSeqRef.current;
        const reqTimestamp = Date.now();

        try {
            if (force || tablesMapRef.current.size === 0) {
                setLoading(true);
            }
            setError(null);

            const res = await axios.get(`${API}/owner/${restaurantId}/tables`);
            if (seq !== fetchSeqRef.current) {
                return Array.from(tablesMapRef.current.values()); // Discard superseded request
            }

            const rawList = Array.isArray(res.data?.tables)
                ? res.data.tables
                : Array.isArray(res.data)
                ? res.data
                : [];

            reconcileIncomingTables(rawList, reqTimestamp);

            // Also keep localCache synchronized for legacy useCachedGet consumers
            try {
                setCacheEntry(
                    `api:${API}/owner/${restaurantId}/tables:public:[]`,
                    { tables: rawList },
                    { ttlMs: 15000, staleMs: 60000 }
                );
            } catch (_) {}

            return rawList;
        } catch (err) {
            if (seq === fetchSeqRef.current) {
                setError(err?.response?.data?.message || err.message || "Failed to load tables");
            }
            return [];
        } finally {
            if (seq === fetchSeqRef.current) {
                setLoading(false);
            }
        }
    }, [restaurantId, reconcileIncomingTables]);

    // Initial fetch on mount or restaurantId change
    useEffect(() => {
        if (!restaurantId) {
            setTablesMap(new Map());
            return;
        }
        refreshTables({ force: true });
    }, [restaurantId, refreshTables]);

    // Rehydrate on socket connect / reconnect (Step 11)
    useEffect(() => {
        if (connected && restaurantId) {
            refreshTables({ force: true });
        }
    }, [connected, restaurantId, refreshTables]);

    // Real-time Socket.IO Listeners (Step 5, 6, 7)
    useEffect(() => {
        if (!socket || !restaurantId) return undefined;

        const handleTableUpdated = (payload) => {
            if (!payload || typeof payload !== "object") return;
            const rid = Number(payload.restaurantId || restaurantId);
            if (rid && rid !== restaurantId) return; // Strict Restaurant Isolation

            const tid = Number(payload.tableId || payload.id || 0);
            if (tid) {
                upsertTable({ ...payload, version: payload.version || Date.now() });
            } else {
                refreshTables();
            }
        };

        const handleSessionUpdated = (payload) => {
            if (!payload) return;
            const rid = Number(payload.restaurantId || restaurantId);
            if (rid && rid !== restaurantId) return;

            const isClosed = payload.status === "CLOSED" || payload.status === "CANCELLED";
            const tid = Number(payload.tableId || 0);

            if (tid) {
                if (isClosed) {
                    upsertTable({
                        tableId: tid,
                        id: tid,
                        status: "AVAILABLE",
                        isOccupied: false,
                        session: { status: "CLOSED" },
                        activeSession: null,
                        sessionStatus: "CLOSED",
                        activeOrders: [],
                        activeOrderCount: 0,
                        activeOrderStatus: null,
                        paymentStatus: null,
                        assignedServer: null,
                        assignedServerId: null,
                        assignedServerName: null,
                        assignedWaiterId: null,
                        assignedWaiterName: null,
                        version: Date.now(),
                    });
                } else {
                    upsertTable({
                        tableId: tid,
                        id: tid,
                        isOccupied: true,
                        session: payload,
                        activeSession: payload,
                        sessionId: payload.id,
                        sessionStatus: payload.status,
                        version: Date.now(),
                    });
                }
            }
        };

        const handleWaiterAssigned = (payload) => {
            if (!payload) return;
            const rid = Number(payload.restaurantId || restaurantId);
            if (rid && rid !== restaurantId) return;

            const tid = Number(payload.tableId || payload.id || 0);
            if (tid) {
                upsertTable({
                    tableId: tid,
                    id: tid,
                    assignedWaiterId: payload.assignedWaiterId ? Number(payload.assignedWaiterId) : null,
                    assignedWaiterName: payload.assignedWaiterName || null,
                    assignedServer: payload.assignedWaiterName || null,
                    assignedServerId: payload.assignedWaiterId ? Number(payload.assignedWaiterId) : null,
                    assignedServerName: payload.assignedWaiterName || null,
                    version: payload.version || Date.now(),
                });
            }
        };

        const handleOrderOrPayment = (order) => {
            if (!order) return;
            const rid = Number(order.restaurantId || restaurantId);
            if (rid && rid !== restaurantId) return;
            refreshTables();
        };

        socket.on("table:updated", handleTableUpdated);
        socket.on("table:session_updated", handleSessionUpdated);
        socket.on("table:waiter_assigned", handleWaiterAssigned);
        socket.on("table:layout_updated", refreshTables);
        socket.on("order:created", handleOrderOrPayment);
        socket.on("order:updated", handleOrderOrPayment);
        socket.on("order:status_updated", handleOrderOrPayment);
        socket.on("payment:updated", handleOrderOrPayment);

        return () => {
            socket.off("table:updated", handleTableUpdated);
            socket.off("table:session_updated", handleSessionUpdated);
            socket.off("table:waiter_assigned", handleWaiterAssigned);
            socket.off("table:layout_updated", refreshTables);
            socket.off("order:created", handleOrderOrPayment);
            socket.off("order:updated", handleOrderOrPayment);
            socket.off("order:status_updated", handleOrderOrPayment);
            socket.off("payment:updated", handleOrderOrPayment);
        };
    }, [socket, restaurantId, upsertTable, refreshTables]);

    const value = useMemo(
        () => ({
            tables,
            tablesById,
            occupiedCount,
            freeCount,
            totalCount,
            loading,
            error,
            getTable,
            getTableByNo,
            refreshTables,
            upsertTable,
            reconcileIncomingTables,
            restaurantId,
        }),
        [
            tables,
            tablesById,
            occupiedCount,
            freeCount,
            totalCount,
            loading,
            error,
            getTable,
            getTableByNo,
            refreshTables,
            upsertTable,
            reconcileIncomingTables,
            restaurantId,
        ]
    );

    return <TableStateContext.Provider value={value}>{children}</TableStateContext.Provider>;
}

// Fallback when component is mounted without TableStateProvider in isolated unit tests
const fallbackTableState = {
    tables: [],
    tablesById: new Map(),
    occupiedCount: 0,
    freeCount: 0,
    totalCount: 0,
    loading: false,
    error: null,
    getTable: () => null,
    getTableByNo: () => null,
    refreshTables: () => Promise.resolve([]),
    upsertTable: () => {},
    reconcileIncomingTables: () => {},
    restaurantId: null,
};

export function useCanonicalTables() {
    const ctx = useContext(TableStateContext);
    return ctx || fallbackTableState;
}
