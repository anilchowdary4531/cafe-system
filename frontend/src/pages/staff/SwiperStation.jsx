import { useState, useEffect, useCallback, useMemo } from "react";
import {
    CreditCard,
    QrCode,
    DollarSign,
    Receipt,
    RefreshCw,
    CheckCircle2,
    Clock,
    Search,
    Printer,
    Check,
    AlertCircle,
    ArrowRight,
    Smartphone,
} from "lucide-react";
import axios from "axios";
import StaffShell from "../../components/StaffShell";
import { useAuth } from "../../context/AuthContext";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import { playNotificationSound, triggerNotificationVibration } from "../../utils/soundPlayer";

export const getAuthoritativeTotal = (order) => {
    if (!order) return 0;
    const direct = Number(order.total ?? order.finalAmount ?? order.payableAmount ?? 0);
    if (direct > 0) return direct;
    if (order.tableSession && Number(order.tableSession.total) > 0) {
        return Number(order.tableSession.total);
    }
    if (Array.isArray(order.items) && order.items.length > 0) {
        const itemSum = order.items.reduce(
            (sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 1)),
            0
        );
        const tax = Number(order.taxAmount || 0);
        const sc = Number(order.serviceChargeAmount || 0);
        const disc = Number(order.discountAmount || 0);
        const calculated = Math.max(0, itemSum + tax + sc - disc);
        if (calculated > 0) return calculated;
        return itemSum;
    }
    return direct;
};

export default function SwiperStation() {
    const { user, token } = useAuth();
    const { socket } = useStaffSocket();

    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("CARD"); // CARD | UPI | CASH
    const [processing, setProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        localStorage.getItem("restaurantId") ||
        1
    );

    const fetchUnpaidTables = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/orders/live`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { restaurantId },
            });
            const allOrders = res?.data?.orders || [];
            const unpaid = allOrders.filter(
                (o) => o.status !== "CANCELLED" && o.paymentStatus !== "PAID" && o.paymentStatus !== "SUCCESS"
            );
            setOrders(unpaid);
            if (selectedOrder) {
                const refreshed = unpaid.find((o) => o.id === selectedOrder.id);
                setSelectedOrder(refreshed || null);
            }
        } catch (err) {
            console.error("Failed to fetch unpaid tables for swiper:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, restaurantId, selectedOrder]);

    useEffect(() => {
        fetchUnpaidTables();
    }, [fetchUnpaidTables]);

    // Realtime listeners
    useEffect(() => {
        if (!socket) return;

        const onPaymentRequested = (data) => {
            fetchUnpaidTables();
            playNotificationSound();
            triggerNotificationVibration();
            setUnreadCount((c) => c + 1);
            showToast({
                title: "Tableside Payment Requested",
                message: `Table ${data?.tableNo || ""} requested card/UPI settlement.`,
                variant: "info",
            });
        };

        const onOrderOrTableUpdated = () => {
            fetchUnpaidTables();
        };

        socket.on("payment:requested", onPaymentRequested);
        socket.on("order:created", onOrderOrTableUpdated);
        socket.on("table:updated", onOrderOrTableUpdated);
        socket.on("payment:updated", onOrderOrTableUpdated);

        return () => {
            socket.off("payment:requested", onPaymentRequested);
            socket.off("order:created", onOrderOrTableUpdated);
            socket.off("table:updated", onOrderOrTableUpdated);
            socket.off("payment:updated", onOrderOrTableUpdated);
        };
    }, [socket, fetchUnpaidTables]);

    // Collect Tableside Payment Action
    const handleConfirmTablesidePayment = async () => {
        if (!selectedOrder) return;

        try {
            setProcessing(true);
            const authTotal = getAuthoritativeTotal(selectedOrder);
            const res = await axios.post(
                `${API}/api/v1/staff/billing/settle`,
                {
                    orderId: selectedOrder.id,
                    tableSessionId: selectedOrder.tableSessionId,
                    tableNo: selectedOrder.tableNo,
                    paymentMethod,
                    amount: authTotal,
                    restaurantId,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data?.success || res.data?.verified) {
                const settledAmount = res.data?.authoritativeTotal || authTotal;
                showToast({
                    title: "Payment Collected",
                    message: `₹${settledAmount} collected tableside via ${paymentMethod} for Table ${selectedOrder.tableNo || ""}. Table queued for cleaning.`,
                    variant: "success",
                });
                playNotificationSound();
                setSelectedOrder(null);
                fetchUnpaidTables();
            }
        } catch (err) {
            showToast({
                title: "Payment Failed",
                message: err.response?.data?.message || "Failed to confirm payment",
                variant: "error",
            });
        } finally {
            setProcessing(false);
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter((o) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            const orderNo = String(o.orderNo || o.id).toLowerCase();
            const tableNo = String(o.tableNo || "").toLowerCase();
            const phone = String(o.customer?.phone || o.phone || "").toLowerCase();
            return orderNo.includes(q) || tableNo.includes(q) || phone.includes(q);
        });
    }, [orders, searchQuery]);

    return (
        <StaffShell
            title="Swiper Station — Mobile Tableside Payment Runner"
            designation="SWIPER"
            unreadNotificationCount={unreadCount}
            fullWidth={true}
            actions={
                <button
                    type="button"
                    onClick={() => {
                        setRefreshing(true);
                        fetchUnpaidTables();
                    }}
                    disabled={refreshing}
                    className="p-2 sm:p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition min-h-[40px] min-w-[40px] flex items-center justify-center border border-neutral-700/60 cursor-pointer"
                    title="Refresh data"
                    aria-label="Refresh data"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
            }
        >
            <div className="w-full flex-1 flex flex-col gap-3.5 sm:gap-4.5">
                {/* Search & Section Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-neutral-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                            <span>Tables Awaiting Settlement</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                {orders.length}
                            </span>
                        </h2>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            id="swiper-tables-search"
                            name="swiperTablesSearch"
                            aria-label="Search table # or bill"
                            type="text"
                            placeholder="Search table # or bill..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition min-h-[38px]"
                        />
                    </div>
                </div>

                {/* Table Selection Cards or Compact Empty State */}
                {loading ? (
                    <div className="py-4 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
                        <span>Loading tables...</span>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex items-center gap-2.5 py-3 px-4 rounded-xl bg-neutral-900/40 border border-neutral-800/60 text-xs text-neutral-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>No tables awaiting settlement. All active tables are paid or pending orders.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
                        {filteredOrders.map((o) => {
                            const isSelected = selectedOrder?.id === o.id;
                            const totalAmount = getAuthoritativeTotal(o);
                            return (
                                <button
                                    key={o.id}
                                    type="button"
                                    data-testid={`swiper-table-card-${o.id}`}
                                    onClick={() => setSelectedOrder(o)}
                                    className={`p-3 rounded-xl border text-left transition cursor-pointer min-h-[72px] flex flex-col justify-between ${
                                        isSelected
                                            ? "bg-orange-600 text-white border-orange-500 shadow-md ring-2 ring-orange-400/40"
                                            : "bg-neutral-900/80 hover:bg-neutral-800/90 text-neutral-200 border-neutral-800 hover:border-neutral-700"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                                            isSelected ? "bg-white text-orange-600" : "bg-neutral-800 text-orange-400 border border-neutral-700/60"
                                        }`}>
                                            Table {o.tableNo}
                                        </span>
                                        <span className="text-[10px] font-semibold opacity-75 truncate">
                                            #{o.orderNo || o.id}
                                        </span>
                                    </div>
                                    <div className="font-black text-base sm:text-lg mt-1 tracking-tight">
                                        ₹{totalAmount}
                                    </div>
                                    {o.customer?.name && (
                                        <div className="text-[10px] truncate opacity-70">
                                            {o.customer.name}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Selected Table Checkout Form / Compact Empty State */}
                {selectedOrder ? (
                    <div className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                            {/* Left Side: Table & Order Info + Item Preview (cols 1-7) */}
                            <div className="lg:col-span-7 space-y-3">
                                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <span className="px-3 py-1 rounded-xl bg-orange-600 text-white font-extrabold text-sm sm:text-base shadow-sm">
                                            Table {selectedOrder.tableNo}
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-white text-base sm:text-lg tracking-tight">
                                                Bill #{selectedOrder.orderNo || selectedOrder.id}
                                            </h3>
                                            <div className="text-xs text-neutral-400">
                                                Guest: {selectedOrder.customer?.name || "Walk-in Guest"}
                                                {selectedOrder.customer?.phone ? ` • ${selectedOrder.customer.phone}` : ""}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Total Due</div>
                                        <div className="text-xl sm:text-2xl font-black text-orange-400 tracking-tight">
                                            ₹{getAuthoritativeTotal(selectedOrder)}
                                        </div>
                                    </div>
                                </div>

                                {/* Ordered items preview */}
                                <div className="space-y-1.5">
                                    <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                                        <span>Order Items ({(selectedOrder.items || []).length})</span>
                                        <span className="text-[11px] lowercase text-neutral-500 font-normal">scroll for all items</span>
                                    </div>
                                    <div className="bg-neutral-950/70 rounded-xl p-3 border border-neutral-800/80 max-h-52 sm:max-h-64 overflow-y-auto divide-y divide-neutral-900 scrollbar-none">
                                        {(selectedOrder.items || []).length === 0 ? (
                                            <div className="py-3 text-xs text-neutral-500 text-center">No itemized breakdown available</div>
                                        ) : (
                                            (selectedOrder.items || []).map((item, idx) => (
                                                <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                                                    <span className="text-neutral-300">
                                                        <span className="font-bold text-orange-400">{item.quantity || item.qty || 1}x</span> {item.name || item.itemName}
                                                    </span>
                                                    <span className="font-semibold text-white">
                                                        ₹{(Number(item.price || 0) * Number(item.quantity || item.qty || 1))}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: EDC / Device Method Picker & Action (cols 8-12) */}
                            <div className="lg:col-span-5 flex flex-col justify-between gap-4 lg:border-l lg:border-neutral-800/80 lg:pl-5">
                                <div className="space-y-2.5">
                                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                                        Payment Method Collected on Handheld
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: "CARD", label: "EDC Card Swipe", icon: CreditCard },
                                            { id: "UPI", label: "Dynamic UPI QR", icon: QrCode },
                                            { id: "CASH", label: "Tableside Cash", icon: DollarSign },
                                        ].map((m) => {
                                            const isSelected = paymentMethod === m.id;
                                            const Icon = m.icon;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setPaymentMethod(m.id)}
                                                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer min-h-[64px] ${
                                                        isSelected
                                                            ? "bg-orange-600 text-white border-orange-500 shadow-md ring-2 ring-orange-400/40"
                                                            : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                                                    }`}
                                                >
                                                    <Icon className="w-5 h-5 shrink-0" />
                                                    <span className="text-[11px] sm:text-xs font-bold text-center leading-tight">{m.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[11px] text-neutral-400">
                                        Collecting payment marks the bill paid and queues the table for cleaning.
                                    </p>
                                </div>

                                {/* Confirmation button */}
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={handleConfirmTablesidePayment}
                                        disabled={processing}
                                        className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 min-h-[48px] cursor-pointer disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                                        <span>
                                            {processing
                                                ? "Confirming Payment..."
                                                : `Confirm ₹${getAuthoritativeTotal(selectedOrder)} Paid via ${paymentMethod}`}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 px-4 text-center rounded-xl border border-dashed border-neutral-800/80 bg-neutral-900/30 text-neutral-400 space-y-1">
                        <CreditCard className="w-6 h-6 text-neutral-500 mb-0.5" />
                        <h3 className="text-sm font-bold text-neutral-200">Select a Table</h3>
                        <p className="text-xs text-neutral-400 max-w-sm">
                            Choose an unpaid table above to begin payment.
                        </p>
                    </div>
                )}
            </div>
        </StaffShell>
    );
}
