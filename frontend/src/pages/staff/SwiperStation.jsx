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
            const allOrders = res.data?.orders || [];
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
            actions={
                <button
                    type="button"
                    onClick={() => {
                        setRefreshing(true);
                        fetchUnpaidTables();
                    }}
                    disabled={refreshing}
                    className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition min-h-[44px] min-w-[44px] flex items-center justify-center border border-neutral-700/60"
                    title="Refresh data"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
            }
        >
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Search & Header */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-md space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-orange-400" />
                            <h2 className="text-base font-bold text-white">
                                Tables Awaiting Settlement ({orders.length})
                            </h2>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search table # or bill..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 min-h-[40px]"
                            />
                        </div>
                    </div>

                    {/* Table Selection Cards */}
                    {loading ? (
                        <div className="py-8 text-center text-xs text-neutral-400">Loading tables...</div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="py-8 text-center bg-neutral-950/60 rounded-xl border border-neutral-800/80">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-1" />
                            <p className="text-xs text-neutral-400">No tables waiting for tableside payment.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 min-[340px]:grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {filteredOrders.map((o) => {
                                const isSelected = selectedOrder?.id === o.id;
                                return (
                                    <button
                                        key={o.id}
                                        type="button"
                                        onClick={() => setSelectedOrder(o)}
                                        className={`p-3 rounded-xl border text-left transition min-h-[76px] ${
                                            isSelected
                                                ? "bg-orange-600 text-white border-orange-500 shadow-md"
                                                : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                                                isSelected ? "bg-white text-orange-600" : "bg-neutral-800 text-orange-400"
                                            }`}>
                                                Table {o.tableNo}
                                            </span>
                                            <span className="text-[11px] font-semibold">
                                                #{o.orderNo || o.id}
                                            </span>
                                        </div>
                                        <div className="font-extrabold text-base mt-2">
                                            ₹{getAuthoritativeTotal(o)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Selected Table Checkout Form */}
                {selectedOrder ? (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-xl bg-orange-600 text-white font-extrabold text-sm">
                                        Table {selectedOrder.tableNo}
                                    </span>
                                    <h3 className="font-bold text-white text-lg">
                                        Bill #{selectedOrder.orderNo || selectedOrder.id}
                                    </h3>
                                </div>
                                <div className="text-xs text-neutral-400 mt-1">
                                    Guest: {selectedOrder.customer?.name || "Walk-in Guest"}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-neutral-400">Total Due</div>
                                <div className="text-2xl font-black text-orange-400">
                                    ₹{getAuthoritativeTotal(selectedOrder)}
                                </div>
                            </div>
                        </div>

                        {/* Ordered items preview */}
                        <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 max-h-40 overflow-y-auto divide-y divide-neutral-900">
                            {(selectedOrder.items || []).map((item, idx) => (
                                <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                                    <span className="text-neutral-300">
                                        {item.quantity}x {item.name || item.itemName}
                                    </span>
                                    <span className="font-semibold text-white">₹{item.price * item.quantity}</span>
                                </div>
                            ))}
                        </div>

                        {/* EDC / Device Method Picker */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                Payment Method Collected on Handheld
                            </label>
                            <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2.5">
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
                                            className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition min-h-[64px] ${
                                                isSelected
                                                    ? "bg-orange-600 text-white border-orange-500 shadow-md"
                                                    : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                                            }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span className="text-xs font-bold">{m.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Confirmation button */}
                        <button
                            type="button"
                            onClick={handleConfirmTablesidePayment}
                            disabled={processing}
                            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 min-h-[52px] disabled:opacity-50"
                        >
                            <CheckCircle2 className="w-5 h-5" />
                            <span>
                                {processing
                                    ? "Confirming Payment..."
                                    : `Confirm ₹${getAuthoritativeTotal(selectedOrder)} Paid via ${paymentMethod}`}
                            </span>
                        </button>
                    </div>
                ) : (
                    <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
                        <CreditCard className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-neutral-200">Select a Table</h3>
                        <p className="text-xs text-neutral-400 mt-1">
                            Choose an unpaid table above when bringing the card machine or QR scanner to the guest.
                        </p>
                    </div>
                )}
            </div>
        </StaffShell>
    );
}
