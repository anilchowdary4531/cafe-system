import { api } from "./api";

// ✅ GET MENU BY SLUG
export const getMenu = async (slug) => {
    const res = await api.get(`/r/${slug}`);
    return res.data;
};