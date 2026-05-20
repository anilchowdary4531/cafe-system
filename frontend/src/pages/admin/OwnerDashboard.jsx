import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { IndianRupee, ShoppingBag, TableProperties, UtensilsCrossed } from "lucide-react";
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

    const stats = [
        {
            title: "Revenue",
            value: `₹${data.revenue}`,
            icon: <IndianRupee size={18} />,
        },
        {
            title: "Orders",
            value: data.ordersCount,
            icon: <ShoppingBag size={18} />,
        },
        {
            title: "Menu Items",
            value: data.menuCount,
            icon: <UtensilsCrossed size={18} />,
        },
        {
            title: "Tables",
            value: data.tablesCount,
            icon: <TableProperties size={18} />,
        },
    ];

    const liveOrders = data.recentOrders || [];

    return (
        <section>
            <p className="text-sm text-gray-400">Welcome back</p>
            <h3 className="mt-1 text-3xl font-bold">{data.restaurantName}</h3>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {stats.map((card) => (
                    <article
                        key={card.title}
                        className="rounded-2xl border border-white/10 bg-[#111827] p-5"
                    >
                        <div className="flex items-center justify-between text-gray-400">
                            <span>{card.title}</span>
                            {card.icon}
                        </div>
                        <p className="mt-4 text-3xl font-bold">{card.value}</p>
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
                                <p>₹{Number(order.total || 0).toFixed(2)}</p>
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
