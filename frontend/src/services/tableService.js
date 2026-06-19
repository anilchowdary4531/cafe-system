import { api } from "./api";

// 🟢 GET ACTIVE SESSION
export const getSession = async (tableId) => {
    const res = await api.get(`/tables/${tableId}/session`);
    return res.data;
};

// ➕ ADD ITEM TO RUNNING BILL
export const addItemToSession = async (tableId, item) => {
    const res = await api.post(`/tables/${tableId}/add-item`, item);
    return res.data;
};

// 💰 CLOSE BILL
export const closeSession = async (tableId) => {
    const res = await api.post(`/tables/${tableId}/close`);
    return res.data;
};