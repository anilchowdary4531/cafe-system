import { useCallback, useEffect, useState } from "react";
import { api } from "../utils/apiClient";

export default function useKitchenLiveBoardData(restaurantId, socket) {
    const [orders, setOrders] = useState([]);
    const [staffUsers, setStaffUsers] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [staffLoading, setStaffLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [ordersError, setOrdersError] = useState("");
    const [staffError, setStaffError] = useState("");
    const [lastSyncAt, setLastSyncAt] = useState(null);

    const loadOrders = useCallback(
        async ({ initial = false } = {}) => {
            if (!restaurantId) return;

            if (initial) setOrdersLoading(true);

            try {
                const res = await api.get("/orders/live");
                const list = Array.isArray(res?.data?.orders) ? res.data.orders : [];
                setOrders(list);
                setOrdersError("");
                setLastSyncAt(new Date());
            } catch (err) {
                setOrdersError(err?.response?.data?.message || "Unable to load live kitchen orders.");
            } finally {
                if (initial) setOrdersLoading(false);
            }
        },
        [restaurantId]
    );

    const loadStaff = useCallback(
        async ({ initial = false } = {}) => {
            if (!restaurantId) return;

            if (initial) setStaffLoading(true);

            try {
                const res = await api.get(`/owner/${restaurantId}/staff`);
                const list = Array.isArray(res?.data?.users) ? res.data.users : [];
                setStaffUsers(list);
                setStaffError("");
                setLastSyncAt(new Date());
            } catch (err) {
                setStaffError(err?.response?.data?.message || "Unable to load chefs.");
            } finally {
                if (initial) setStaffLoading(false);
            }
        },
        [restaurantId]
    );

    const refreshBoard = useCallback(async () => {
        if (!restaurantId) return;

        setRefreshing(true);
        try {
            await Promise.all([loadOrders(), loadStaff()]);
            setLastSyncAt(new Date());
        } finally {
            setRefreshing(false);
        }
    }, [loadOrders, loadStaff, restaurantId]);

    useEffect(() => {
        if (!restaurantId) {
            setOrders([]);
            setStaffUsers([]);
            setOrdersLoading(false);
            setStaffLoading(false);
            return undefined;
        }

        loadOrders({ initial: true });
        loadStaff({ initial: true });
        return undefined;
    }, [loadOrders, loadStaff, restaurantId]);

    useEffect(() => {
        if (!socket) return undefined;

        const onCreated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev.slice() : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((item) => Number(item?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                list[idx] = order;
                return list;
            });
            setLastSyncAt(new Date());
        };

        const onUpdated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev.slice() : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((item) => Number(item?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                list[idx] = order;
                return list;
            });
            setLastSyncAt(new Date());
        };

        socket.on("order:created", onCreated);
        socket.on("order:updated", onUpdated);
        return () => {
            socket.off("order:created", onCreated);
            socket.off("order:updated", onUpdated);
        };
    }, [socket]);

    return {
        orders,
        staffUsers,
        ordersLoading,
        staffLoading,
        refreshing,
        ordersError,
        staffError,
        lastSyncAt,
        refreshBoard,
    };
}
