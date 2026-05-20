import { useMemo } from "react";
import useCachedGet from "../hooks/useCachedGet";
import { api, invalidateGetCache } from "../utils/apiClient";

export default function Orders() {
    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    })();

    const params = useMemo(() => (user?.restaurantId ? { restaurantId: user.restaurantId } : {}), [user?.restaurantId]);
    const { data } = useCachedGet("/orders", { params, ttlMs: 10_000, staleMs: 60_000 });
    const orders = Array.isArray(data) ? data : [];

    const markReady = async (order) => {
        try {
            if (user?.restaurantId) {
                await api.put(`/owner/${user.restaurantId}/orders/${order.id}/status`, {
                    status: "READY",
                    changedByName: user?.name || "Admin",
                });
            }
            invalidateGetCache({ urlStartsWith: "/orders" });
        } catch (err) {
            console.log(err);
        }
    };

    return (
        <div className="ml-64 p-6 text-white">
            <h1 className="text-xl mb-4">Live Orders</h1>

            <div className="grid gap-4">
                {orders.map((o) => (
                    <div key={o.id} className="bg-[#1a2333] p-4 rounded">
                        <p className="font-semibold">{o.orderNo || `Order #${o.id}`}</p>
                        <p>Table: {o.tableNo || "--"}</p>
                        <p>Status: {o.status}</p>
                        <p>Total: ₹{Number(o.total || 0).toFixed(2)}</p>

                        <button
                            onClick={() => markReady(o)}
                            className="bg-orange-500 px-3 py-1 mt-2 rounded"
                        >
                            Mark Ready
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
