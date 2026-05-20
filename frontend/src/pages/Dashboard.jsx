import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
} from "recharts";
import { useMemo, useState } from "react";
import useCachedGet from "../hooks/useCachedGet";

const revenueData = [
    { day: "Mon", revenue: 4200 },
    { day: "Tue", revenue: 5100 },
    { day: "Wed", revenue: 4800 },
    { day: "Thu", revenue: 6200 },
    { day: "Fri", revenue: 7100 },
    { day: "Sat", revenue: 9800 },
    { day: "Sun", revenue: 8500 },
];

const salesData = [
    { name: "Pizza", sold: 48 },
    { name: "Burger", sold: 39 },
    { name: "Biryani", sold: 57 },
    { name: "Coffee", sold: 66 },
];

const tableData = [
    { name: "Occupied", value: 18 },
    { name: "Free", value: 6 },
];

const COLORS = ["#f97316", "#22c55e", "#3b82f6", "#a855f7"];

const readStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
        return {};
    }
};

export default function Dashboard() {
    const [user] = useState(readStoredUser);

    const params = useMemo(() => (user?.restaurantId ? { restaurantId: user.restaurantId } : {}), [user?.restaurantId]);

    const { data: ordersData } = useCachedGet("/orders", { params, ttlMs: 10_000, staleMs: 60_000 });
    const { data: tablesData } = useCachedGet("/tables", { params, ttlMs: 15_000, staleMs: 2 * 60_000 });
    const { data: menuData } = useCachedGet("/menu", { ttlMs: 60_000, staleMs: 15 * 60_000 });

    const summary = useMemo(() => {
        const orders = Array.isArray(ordersData) ? ordersData : [];
        const tables = Array.isArray(tablesData) ? tablesData : [];
        const menuItems = Array.isArray(menuData) ? menuData : [];
        return {
            revenue: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
            orders: orders.length,
            customers: new Set(orders.map((order) => order.phone).filter(Boolean)).size,
            activeTables: tables.filter((table) => table.isActive).length,
            tables: tables.length,
            menuItems: menuItems.length,
        };
    }, [ordersData, tablesData, menuData]);

    return (
        <div className="space-y-8">

            {/* HEADER */}
            <div>
                <h1 className="text-4xl font-bold text-white">
                    Business Reports 📊
                </h1>

                <p className="text-gray-400 mt-2">
                    Premium analytics for your cafe operations
                </p>
            </div>

            {/* STATS */}
            <div className="grid md:grid-cols-4 gap-5">

                <StatCard
                    title="Revenue"
                    value={`₹${Number(summary?.revenue || 0).toFixed(0)}`}
                    color="from-green-500 to-emerald-600"
                />

                <StatCard
                    title="Orders"
                    value={summary?.orders ?? 0}
                    color="from-orange-500 to-red-500"
                />

                <StatCard
                    title="Customers"
                    value={summary?.customers ?? 0}
                    color="from-blue-500 to-cyan-500"
                />

                <StatCard
                    title="Tables"
                    value={`${summary?.activeTables ?? 0} / ${summary?.tables ?? 0}`}
                    color="from-purple-500 to-pink-500"
                />

            </div>

            {/* CHARTS */}
            <div className="grid lg:grid-cols-2 gap-6">

                {/* REVENUE LINE */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

                    <h2 className="text-xl font-semibold text-white mb-4">
                        Weekly Revenue Trend
                    </h2>

                    <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="day" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="revenue"
                                stroke="#f97316"
                                strokeWidth={4}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                </div>

                {/* BAR */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

                    <h2 className="text-xl font-semibold text-white mb-4">
                        Top Selling Items
                    </h2>

                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={salesData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip />
                            <Legend />
                            <Bar
                                dataKey="sold"
                                fill="#22c55e"
                                radius={[8, 8, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>

                </div>

            </div>

            {/* LOWER SECTION */}
            <div className="grid lg:grid-cols-2 gap-6">

                {/* PIE */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

                    <h2 className="text-xl font-semibold text-white mb-4">
                        Table Occupancy
                    </h2>

                    <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                            <Pie
                                data={tableData}
                                cx="50%"
                                cy="50%"
                                outerRadius={110}
                                dataKey="value"
                                label
                            >
                                {tableData.map((entry, index) => (
                                    <Cell
                                        key={index}
                                        fill={COLORS[index]}
                                    />
                                ))}
                            </Pie>

                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>

                </div>

                {/* GROWTH */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

                    <h2 className="text-xl font-semibold text-white mb-6">
                        Growth Summary
                    </h2>

                    <div className="space-y-5 text-lg">

                        <Row label="Weekly Growth" value="+18%" color="text-green-400" />

                        <Row label="Orders Growth" value="+12%" color="text-green-400" />

                        <Row label="Avg Bill Value" value="₹420" color="text-orange-400" />

                        <Row label="Repeat Customers" value="38%" color="text-blue-400" />

                        <Row label="Customer Rating" value="4.8★" color="text-yellow-400" />

                    </div>

                </div>

            </div>

        </div>
    );
}

function StatCard({ title, value, color }) {
    return (
        <div
            className={`bg-gradient-to-r ${color} rounded-3xl p-5 shadow-xl`}
        >
            <p className="text-sm opacity-80">{title}</p>

            <h2 className="text-3xl font-bold mt-2">
                {value}
            </h2>
        </div>
    );
}

function Row({ label, value, color }) {
    return (
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <span className="text-gray-300">{label}</span>
            <span className={`font-bold ${color}`}>{value}</span>
        </div>
    );
}
