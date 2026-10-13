export const ACTIVE_STATUSES = new Set([
    "PLACED",
    "ACCEPTED",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "PICKED_UP",
]);

export const isDeliveredOrder = (order) => {
    const s = String(order?.status || "").trim().toUpperCase();
    return s === "DELIVERED" || s === "SERVED";
};

export const isPresentOrder = (order) => !isDeliveredOrder(order);

export const getDeliveredTimestamp = (order) => {
    if (Array.isArray(order?.statusEvents)) {
        const deliveredEvent = [...order.statusEvents]
            .reverse()
            .find((e) => {
                const s = String(e?.status || "").trim().toUpperCase();
                return s === "DELIVERED" || s === "SERVED";
            });
        if (deliveredEvent?.createdAt) {
            const time = new Date(deliveredEvent.createdAt).getTime();
            if (Number.isFinite(time)) return time;
        }
    }
    const updatedTime = new Date(order?.updatedAt).getTime();
    if (Number.isFinite(updatedTime)) return updatedTime;
    const createdTime = new Date(order?.createdAt).getTime();
    return Number.isFinite(createdTime) ? createdTime : 0;
};

export const getCreatedTimestamp = (order) => {
    const time = new Date(order?.createdAt).getTime();
    return Number.isFinite(time) ? time : 0;
};
