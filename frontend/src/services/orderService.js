import { api } from "./api";

// 🔹 GET ALL ORDERS (OWNER)
export const getOrders = () => {
    return api.get("/owner/1/orders");
};

// 🔹 UPDATE ORDER STATUS
export const updateOrderStatus = (orderId, status) => {
    return api.put(`/owner/1/orders/${orderId}`, { status });
};

// 🔹 PLACE CUSTOMER ORDER (🔥 THIS WAS MISSING)
export const placeOrder = (slug, payload) => {
    return api.post(`/r/${slug}/order`, payload);
};