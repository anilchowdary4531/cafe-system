import { useState, useEffect, useCallback, useMemo } from "react";
import {
    CreditCard,
    DollarSign,
    Receipt,
    Search,
    Printer,
    RefreshCw,
    Lock,
    Unlock,
    AlertTriangle,
    CheckCircle2,
    Clock,
    PlusCircle,
    MinusCircle,
    QrCode,
    Smartphone,
    Layers,
    Percent,
    ArrowRight,
    Users,
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

export default function CashierStation() {
    const { user, token } = useAuth();
    const { socket } = useStaffSocket();

    // Active bills / orders state
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingOrders, setLoadingOrders] = useState(true);

    // Current shift / Cash drawer state
    const [currentShift, setCurrentShift] = useState(null);
    const [loadingShift, setLoadingShift] = useState(true);
    const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [showCashMovementModal, setShowCashMovementModal] = useState(false);
    const [cashMovementType, setCashMovementType] = useState("CASH_IN"); // CASH_IN | CASH_OUT
    const [openingCashInput, setOpeningCashInput] = useState("");
    const [actualCashInput, setActualCashInput] = useState("");
    const [movementAmountInput, setMovementAmountInput] = useState("");
    const [movementReasonInput, setMovementReasonInput] = useState("");

    // Payment collection state
    const [paymentMethod, setPaymentMethod] = useState("CASH"); // CASH | UPI | CARD | SPLIT
    const [cashTendered, setCashTendered] = useState("");
    const [processingPayment, setProcessingPayment] = useState(false);

    // Discount request state
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [discountAmountInput, setDiscountAmountInput] = useState("");
    const [discountReasonInput, setDiscountReasonInput] = useState("");
    const [discountWaiting, setDiscountWaiting] = useState(false);

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        localStorage.getItem("restaurantId") ||
        1
    );

    // 1. Fetch live unpaid orders and table bills
    const fetchLiveOrders = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/orders/live`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { restaurantId },
            });
            const allOrders = res.data?.orders || [];
            // Filter to orders requiring payment
            const unpaid = allOrders.filter(
                (o) => o.status !== "CANCELLED" && o.paymentStatus !== "PAID" && o.paymentStatus !== "SUCCESS"
            );
            setOrders(unpaid);
            if (selectedOrder) {
                const refreshed = unpaid.find((o) => o.id === selectedOrder.id);
                setSelectedOrder(refreshed || null);
            }
        } catch (err) {
            console.error("Failed to fetch live cashier orders:", err);
        } finally {
            setLoadingOrders(false);
        }
    }, [token, restaurantId, selectedOrder]);

    // 2. Fetch current cashier shift
    const fetchCurrentShift = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/api/shifts/current`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { restaurantId },
            });
            setCurrentShift(res.data?.shift || null);
        } catch (err) {
            console.error("Failed to fetch cashier shift:", err);
        } finally {
            setLoadingShift(false);
        }
    }, [token, restaurantId]);

    const refreshAll = useCallback(async () => {
        await Promise.all([fetchLiveOrders(), fetchCurrentShift()]);
    }, [fetchLiveOrders, fetchCurrentShift]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // Socket realtime listeners
    useEffect(() => {
        if (!socket) return;

        const onOrderOrPaymentUpdated = () => {
            fetchLiveOrders();
            fetchCurrentShift();
        };

        const onApprovalResolved = (data) => {
            if (data?.orderId && selectedOrder?.id === data.orderId) {
                showToast({
                    title: "Discount Approved!",
                    message: `Manager approved discount of ₹${data.discountAmount || 0}. Bill updated.`,
                    variant: "success",
                });
                setDiscountWaiting(false);
                setShowDiscountModal(false);
                fetchLiveOrders();
            }
        };

        socket.on("order:created", onOrderOrPaymentUpdated);
        socket.on("payment:updated", onOrderOrPaymentUpdated);
        socket.on("table:updated", onOrderOrPaymentUpdated);
        socket.on("shift:updated", fetchCurrentShift);
        socket.on("manager:approval_resolved", onApprovalResolved);

        return () => {
            socket.off("order:created", onOrderOrPaymentUpdated);
            socket.off("payment:updated", onOrderOrPaymentUpdated);
            socket.off("table:updated", onOrderOrPaymentUpdated);
            socket.off("shift:updated", fetchCurrentShift);
            socket.off("manager:approval_resolved", onApprovalResolved);
        };
    }, [socket, fetchLiveOrders, fetchCurrentShift, selectedOrder]);

    // 3. Shift Management Actions
    const handleOpenShift = async (e) => {
        e.preventDefault();
        try {
            const val = parseFloat(openingCashInput) || 0;
            const res = await axios.post(
                `${API}/api/shifts/open`,
                { restaurantId, openingCash: val },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data?.shift) {
                setCurrentShift(res.data.shift);
                setShowOpenShiftModal(false);
                setOpeningCashInput("");
                showToast({ title: "Shift Opened", message: `Cash drawer initialized with ₹${val}`, variant: "success" });
            }
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.error || "Failed to open shift", variant: "error" });
        }
    };

    const handleCashMovement = async (e) => {
        e.preventDefault();
        if (!currentShift) return;
        try {
            const amount = parseFloat(movementAmountInput) || 0;
            if (amount <= 0) return;
            await axios.post(
                `${API}/api/shifts/movement`,
                {
                    shiftId: currentShift.id,
                    restaurantId,
                    type: cashMovementType,
                    amount,
                    reason: movementReasonInput || (cashMovementType === "CASH_IN" ? "Float addition" : "Cash drop/payout"),
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowCashMovementModal(false);
            setMovementAmountInput("");
            setMovementReasonInput("");
            showToast({ title: "Cash Recorded", message: `${cashMovementType === "CASH_IN" ? "Cash In" : "Cash Out"} of ₹${amount} recorded.`, variant: "success" });
            fetchCurrentShift();
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.error || "Failed to record cash movement", variant: "error" });
        }
    };

    const handleCloseShift = async (e) => {
        e.preventDefault();
        if (!currentShift) return;
        try {
            const actualCash = parseFloat(actualCashInput) || 0;
            await axios.post(
                `${API}/api/shifts/close`,
                {
                    shiftId: currentShift.id,
                    restaurantId,
                    actualCash,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowCloseShiftModal(false);
            setActualCashInput("");
            showToast({ title: "Shift Closed", message: "Cashier shift settled and closed.", variant: "success" });
            fetchCurrentShift();
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.error || "Failed to close shift", variant: "error" });
        }
    };

    // 4. Payment Settlement Actions
    const handleCollectPayment = async () => {
        if (!selectedOrder) return;
        if (!currentShift) {
            showToast({
                title: "Shift Required",
                message: "Please open your cash drawer shift before collecting payments.",
                variant: "error",
            });
            setShowOpenShiftModal(true);
            return;
        }

        try {
            setProcessingPayment(true);
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
                    shiftId: currentShift.id,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data?.success || res.data?.verified) {
                const settledAmount = res.data?.authoritativeTotal || authTotal;
                showToast({
                    title: "Payment Collected",
                    message: `₹${settledAmount} collected via ${paymentMethod} for Table ${selectedOrder.tableNo || ""}. Table queued for cleaning.`,
                    variant: "success",
                });
                playNotificationSound();
                setSelectedOrder(null);
                setCashTendered("");
                fetchLiveOrders();
                fetchCurrentShift();
            }
        } catch (err) {
            showToast({
                title: "Payment Error",
                message: err.response?.data?.message || "Failed to settle payment",
                variant: "error",
            });
        } finally {
            setProcessingPayment(false);
        }
    };

    // 5. Discount Approval Flow (Manager Approval Required)
    const handleRequestDiscount = async (e) => {
        e.preventDefault();
        if (!selectedOrder) return;
        const disc = parseFloat(discountAmountInput) || 0;
        if (disc <= 0) return;

        try {
            setDiscountWaiting(true);
            await axios.post(
                `${API}/api/v1/staff/cashier/discount-request`,
                {
                    orderId: selectedOrder.id,
                    tableSessionId: selectedOrder.tableSessionId,
                    tableNo: selectedOrder.tableNo,
                    discountAmount: disc,
                    discountReason: discountReasonInput || "Cashier counter discount",
                    restaurantId,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showToast({
                title: "Approval Dispatched",
                message: `Discount request for ₹${disc} sent to Manager for approval.`,
                variant: "info",
            });
        } catch (err) {
            setDiscountWaiting(false);
            showToast({
                title: "Error",
                message: err.response?.data?.message || "Failed to dispatch discount request",
                variant: "error",
            });
        }
    };

    // Change calculation
    const billTotal = selectedOrder ? getAuthoritativeTotal(selectedOrder) : 0;
    const tendered = parseFloat(cashTendered) || 0;
    const changeDue = Math.max(0, tendered - billTotal);

    // Filtered orders list
    const filteredOrders = useMemo(() => {
        return orders.filter((o) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            const orderNo = String(o.orderNo || o.id).toLowerCase();
            const tableNo = String(o.tableNo || "").toLowerCase();
            const phone = String(o.customer?.phone || o.phone || "").toLowerCase();
            const name = String(o.customer?.name || "").toLowerCase();
            return orderNo.includes(q) || tableNo.includes(q) || phone.includes(q) || name.includes(q);
        });
    }, [orders, searchQuery]);

    return (
        <StaffShell
            title="Cashier Station — POS Checkout & Cash Drawer Settlement"
            designation="CASHIER"
            actions={
                <button
                    type="button"
                    onClick={refreshAll}
                    className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition min-h-[44px] min-w-[44px] flex items-center justify-center border border-neutral-700/60"
                    title="Refresh data"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT COLUMN: Unpaid Bills & Active Checkout (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Orders search & selector header */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-md space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-orange-400" />
                                Unpaid Bills ({orders.length})
                            </h2>
                            <div className="relative w-full sm:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Search table, bill #, phone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 min-h-[40px]"
                                />
                            </div>
                        </div>

                        {/* Order cards horizontal row / grid */}
                        {loadingOrders ? (
                            <div className="py-8 text-center text-xs text-neutral-400">Loading bills...</div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="py-8 text-center bg-neutral-950/60 rounded-xl border border-neutral-800/80">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-1" />
                                <p className="text-xs text-neutral-400">All tables and bills are settled.</p>
                            </div>
                        ) : (
                            <div className="flex gap-2.5 overflow-x-auto pb-2">
                                {filteredOrders.map((o) => {
                                    const isSelected = selectedOrder?.id === o.id;
                                    return (
                                        <button
                                            key={o.id}
                                            type="button"
                                            onClick={() => setSelectedOrder(o)}
                                            className={`p-3 rounded-xl border text-left shrink-0 w-44 transition min-h-[72px] ${
                                                isSelected
                                                    ? "bg-orange-600 text-white border-orange-500 shadow-md"
                                                    : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                                                    isSelected ? "bg-white text-orange-600" : "bg-neutral-800 text-orange-400"
                                                }`}>
                                                    Table {o.tableNo || "T-?"}
                                                </span>
                                                <span className="text-[11px] font-semibold">
                                                    #{o.orderNo || o.id}
                                                </span>
                                            </div>
                                            <div className="font-extrabold text-base mt-1.5">
                                                ₹{getAuthoritativeTotal(o)}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Active Checkout Panel */}
                    {selectedOrder ? (
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 rounded-xl bg-orange-600 text-white font-extrabold text-sm">
                                            Table {selectedOrder.tableNo}
                                        </span>
                                        <h3 className="font-bold text-white text-lg">
                                            Bill #{selectedOrder.orderNo || selectedOrder.id}
                                        </h3>
                                    </div>
                                    <div className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                                        <span>Customer: {selectedOrder.customer?.name || "Walk-in Guest"}</span>
                                        {selectedOrder.customer?.phone && (
                                            <>
                                                <span>•</span>
                                                <span>{selectedOrder.customer.phone}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDiscountModal(true)}
                                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition min-h-[44px]"
                                    >
                                        <Percent className="w-4 h-4 text-orange-400" />
                                        Request Discount
                                    </button>
                                </div>
                            </div>

                            {/* Itemized Order Summary */}
                            <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 space-y-2">
                                <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                                    Ordered Items
                                </div>
                                <div className="divide-y divide-neutral-900 max-h-48 overflow-y-auto">
                                    {(selectedOrder.items || []).map((item, idx) => (
                                        <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                                            <span className="text-neutral-200">
                                                {item.quantity}x {item.name || item.itemName}
                                            </span>
                                            <span className="font-semibold text-white">₹{item.price * item.quantity}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-neutral-800 pt-3 space-y-1 text-xs">
                                    <div className="flex justify-between text-neutral-400">
                                        <span>Subtotal</span>
                                        <span>₹{selectedOrder.subtotal || getAuthoritativeTotal(selectedOrder)}</span>
                                    </div>
                                    {selectedOrder.discountAmount > 0 && (
                                        <div className="flex justify-between text-emerald-400 font-semibold">
                                            <span>Manager Discount</span>
                                            <span>-₹{selectedOrder.discountAmount}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-base font-extrabold text-white pt-1 border-t border-neutral-800">
                                        <span>Authoritative Total Due</span>
                                        <span className="text-orange-400">₹{getAuthoritativeTotal(selectedOrder)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method Selector */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                    Select Payment Method
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: "CASH", label: "Cash Collection", icon: DollarSign },
                                        { id: "UPI", label: "UPI / QR", icon: QrCode },
                                        { id: "CARD", label: "Card / POS", icon: CreditCard },
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

                            {/* Cash change calculator if CASH selected */}
                            {paymentMethod === "CASH" && (
                                <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-neutral-400 block mb-1">Cash Tendered (₹)</label>
                                            <input
                                                type="number"
                                                value={cashTendered}
                                                onChange={(e) => setCashTendered(e.target.value)}
                                                placeholder={`e.g. ${billTotal}`}
                                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-bold text-base focus:outline-none focus:border-orange-500 min-h-[44px]"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-neutral-400 block mb-1">Change Due (₹)</label>
                                            <div className="w-full bg-neutral-900/60 border border-neutral-800 rounded-xl px-3 py-2 text-emerald-400 font-extrabold text-xl flex items-center min-h-[44px]">
                                                ₹{changeDue}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Settle / Complete Payment button */}
                            <button
                                type="button"
                                onClick={handleCollectPayment}
                                disabled={processingPayment || !currentShift}
                                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 min-h-[52px] disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                <span>
                                    {processingPayment
                                        ? "Settle and Release Table..."
                                        : `Confirm ₹${getAuthoritativeTotal(selectedOrder)} Paid via ${paymentMethod}`}
                                </span>
                            </button>
                        </div>
                    ) : (
                        <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
                            <Receipt className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                            <h3 className="text-base font-bold text-neutral-200">No Bill Selected</h3>
                            <p className="text-xs text-neutral-400 mt-1">
                                Select an active table from above to view items, calculate change, or settle payment.
                            </p>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Current Shift & Cash Drawer (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                            <div>
                                <h3 className="font-bold text-white text-base flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-orange-400" />
                                    Cash Drawer Shift
                                </h3>
                                <div className="text-xs text-neutral-400 mt-0.5">
                                    Terminal: {currentShift?.terminalId || "MAIN"}
                                </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                currentShift?.status === "OPEN"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }`}>
                                {currentShift?.status || "CLOSED"}
                            </span>
                        </div>

                        {loadingShift ? (
                            <div className="py-6 text-center text-xs text-neutral-400">Loading drawer state...</div>
                        ) : !currentShift ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 text-center">
                                    <Lock className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                                    <h4 className="font-bold text-white text-sm">Shift is Currently Closed</h4>
                                    <p className="text-xs text-neutral-400 mt-1">
                                        Open your shift with an initial opening float to start collecting bills.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowOpenShiftModal(true)}
                                    className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition min-h-[44px] flex items-center justify-center gap-2 shadow-md"
                                >
                                    <Unlock className="w-4 h-4" />
                                    Open Cashier Shift
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2.5 text-xs">
                                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex justify-between items-center">
                                        <span className="text-neutral-400">Opening Cash Float</span>
                                        <span className="font-bold text-white text-sm">₹{currentShift.openingCash}</span>
                                    </div>
                                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex justify-between items-center">
                                        <span className="text-neutral-400">Authoritative Expected Cash</span>
                                        <span className="font-extrabold text-orange-400 text-base">₹{currentShift.expectedCash}</span>
                                    </div>
                                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex justify-between items-center">
                                        <span className="text-neutral-400">Cash Move Count</span>
                                        <span className="font-semibold text-neutral-300">
                                            {currentShift.cashMovements?.length || 0} movements
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCashMovementType("CASH_IN");
                                            setShowCashMovementModal(true);
                                        }}
                                        className="py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition min-h-[44px] border border-neutral-700"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                                        Cash In (Add)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCashMovementType("CASH_OUT");
                                            setShowCashMovementModal(true);
                                        }}
                                        className="py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition min-h-[44px] border border-neutral-700"
                                    >
                                        <MinusCircle className="w-3.5 h-3.5 text-red-400" />
                                        Cash Out (Drop)
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowCloseShiftModal(true)}
                                    className="w-full py-3 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 font-bold text-xs transition min-h-[44px] border border-red-800/60 flex items-center justify-center gap-2"
                                >
                                    <Lock className="w-4 h-4" />
                                    Close & Settle Shift
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Open Shift */}
            {showOpenShiftModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                            <Unlock className="w-5 h-5 text-orange-400" />
                            Open Cash Drawer Shift
                        </h3>
                        <p className="text-xs text-neutral-400">
                            Enter the initial cash float counted in the cash drawer at shift start.
                        </p>
                        <form onSubmit={handleOpenShift} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                                    Opening Cash Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    value={openingCashInput}
                                    onChange={(e) => setOpeningCashInput(e.target.value)}
                                    placeholder="e.g. 2000"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white font-bold text-base focus:outline-none focus:border-orange-500 min-h-[44px]"
                                    required
                                    min="0"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowOpenShiftModal(false)}
                                    className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold"
                                >
                                    Confirm Open Shift
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Cash Movement (Cash In / Cash Out) */}
            {showCashMovementModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <h3 className="font-bold text-white text-lg">
                            {cashMovementType === "CASH_IN" ? "Record Cash In (Float)" : "Record Cash Out (Drop / Payout)"}
                        </h3>
                        <form onSubmit={handleCashMovement} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-neutral-300 block mb-1">Amount (₹)</label>
                                <input
                                    type="number"
                                    value={movementAmountInput}
                                    onChange={(e) => setMovementAmountInput(e.target.value)}
                                    placeholder="e.g. 500"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white font-bold text-base focus:outline-none focus:border-orange-500 min-h-[44px]"
                                    required
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-neutral-300 block mb-1">Reason / Notes</label>
                                <input
                                    type="text"
                                    value={movementReasonInput}
                                    onChange={(e) => setMovementReasonInput(e.target.value)}
                                    placeholder="e.g. Petty cash drop or extra float"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-orange-500 min-h-[44px]"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCashMovementModal(false)}
                                    className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold"
                                >
                                    Record Movement
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Close Shift */}
            {showCloseShiftModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                            <Lock className="w-5 h-5 text-red-400" />
                            Close & Settle Cashier Shift
                        </h3>
                        <p className="text-xs text-neutral-400">
                            Count physical cash in the drawer. The system will compute variance against expected cash.
                        </p>
                        <form onSubmit={handleCloseShift} className="space-y-4">
                            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                                <span className="text-neutral-400">Expected Cash In Drawer</span>
                                <span className="font-extrabold text-white text-base">₹{currentShift?.expectedCash || 0}</span>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                                    Actual Physical Cash Counted (₹)
                                </label>
                                <input
                                    type="number"
                                    value={actualCashInput}
                                    onChange={(e) => setActualCashInput(e.target.value)}
                                    placeholder="Enter physical count"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white font-bold text-base focus:outline-none focus:border-orange-500 min-h-[44px]"
                                    required
                                    min="0"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCloseShiftModal(false)}
                                    className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                                >
                                    Close Shift
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Request Manager Discount Approval */}
            {showDiscountModal && selectedOrder && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                            <Percent className="w-5 h-5 text-orange-400" />
                            Request Manager Discount Approval
                        </h3>
                        <p className="text-xs text-neutral-400">
                            Cashiers cannot apply manual discounts autonomously. An approval request will be sent to the Duty Manager in realtime.
                        </p>
                        <form onSubmit={handleRequestDiscount} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                                    Discount Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    value={discountAmountInput}
                                    onChange={(e) => setDiscountAmountInput(e.target.value)}
                                    placeholder="e.g. 100"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white font-bold text-base focus:outline-none focus:border-orange-500 min-h-[44px]"
                                    required
                                    min="1"
                                    max={getAuthoritativeTotal(selectedOrder)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-neutral-300 block mb-1">Reason</label>
                                <input
                                    type="text"
                                    value={discountReasonInput}
                                    onChange={(e) => setDiscountReasonInput(e.target.value)}
                                    placeholder="e.g. Guest complaint / VIP guest / Special concession"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-orange-500 min-h-[44px]"
                                    required
                                />
                            </div>

                            {discountWaiting && (
                                <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-amber-300 text-xs flex items-center gap-2 animate-pulse">
                                    <Clock className="w-4 h-4 shrink-0" />
                                    <span>Waiting for Duty Manager to review and approve...</span>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDiscountModal(false)}
                                    disabled={discountWaiting}
                                    className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={discountWaiting}
                                    className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold disabled:opacity-50"
                                >
                                    Send to Manager
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </StaffShell>
    );
}
