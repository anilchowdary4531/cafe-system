import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../config";

export default function OwnerDashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    useEffect(() => {
        if (!user?.restaurantId) return;

        axios
            .get(`${API}/owner/dashboard/${user.restaurantId}`)
            .then((res) => setData(res.data))
            .catch(() => setData(null));
    }, [user]);

    if (!data) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-6 text-gray-300">
                Loading owner dashboard...
            </div>
        );
    }

    const formatAmount = (amount, decimals = 2) =>
        Number(amount || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals,
        });

    const stats = [
        {
            title: "Revenue",
            value: `\u20B9${formatAmount(data.revenue)}`,
        },
        {
            title: "Orders",
            value: formatAmount(data.ordersCount, 0),
        },
        {
            title: "Menu Items",
            value: formatAmount(data.menuCount, 0),
        },
        {
            title: "Tables",
            value: formatAmount(data.tablesCount, 0),
        },
    ];

    const liveOrders = data.recentOrders || [];

    return (
        <section>
            <div className="mt-2 grid grid-cols-4 gap-2">
                {stats.map((card) => (
                    <article
                        key={card.title}
                        className="min-w-0 px-2 py-1"
                    >
                        <div className="text-gray-300">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{card.title}</span>
                        </div>
                        <p className="mt-2 text-[26px] font-bold leading-none">{card.value}</p>
                    </article>
                ))}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold">Live Orders</h4>
                    <button
                        onClick={() => navigate("/owner/orders")}
                        className="text-sm font-semibold text-orange-400 hover:text-orange-300"
                    >
                        View all
                    </button>
                </div>

                <div className="mt-4 space-y-3">
                    {liveOrders.map((order) => (
                        <div
                            key={order.id}
                            className="flex items-center justify-between rounded-xl bg-[#0f172a] p-4"
                        >
                            <div>
                                <p className="font-semibold">{order.orderNo || `#${order.id}`}</p>
                                <p className="text-sm text-gray-400">Table {order.tableNo || "--"}</p>
                            </div>
                            <div className="text-right">
                                <p>{`\u20B9${formatAmount(order.total)}`}</p>
                                <p className="text-sm text-orange-300">{order.status}</p>
                            </div>
                        </div>
                    ))}
                    {liveOrders.length === 0 && (
                        <div className="rounded-xl border border-dashed border-white/10 bg-[#0f172a] p-4 text-sm text-gray-400">
                            No orders yet.
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
