import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
    ArrowLeft,
    Users,
    X,
    Filter,
    ChevronRight,
    History,
    Sparkles,
    Banknote,
    FileText,
    Check,
    AlertCircle,
    Calendar,
    ArrowDownRight,
    ArrowUpRight,
    SlidersHorizontal,
    HelpCircle,
} from "lucide-react";
import axios from "axios";
import StaffShell from "../../components/StaffShell";
import { useAuth } from "../../context/AuthContext";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { useCanonicalTables } from "../../context/TableStateContext";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import { playNotificationSound, triggerNotificationVibration } from "../../utils/soundPlayer";
import SplitBillingModal from "../../components/SplitBillingModal";
import { buildReceiptPrintMarkup, printReceiptWindow } from "../../utils/receiptPrinter";

/**
 * Authoritative total resolver - ensures frontend does not compute settlement divergent from backend
 */
export const getAuthoritativeTotal = (order) => {
    if (!order) return 0;
    const direct = Number(order.total ?? order.finalAmount ?? order.payableAmount ?? 0);
    if (direct > 0) return direct;
    if (order.tableSession && Number(order.tableSession.total) > 0) {
        return Number(order.tableSession.total);
    }
    if (Array.isArray(order.items) && order.items.length > 0) {
        const itemSum = order.items.reduce(
            (sum, it) => sum + (Number(it.price || 0) * Number(it.qty || it.quantity || 1)),
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
    const { socket, isConnected } = useStaffSocket();
    const isOnline = isConnected ?? true;
    const { tables, occupiedCount, freeCount, loading: loadingTables, refreshTables } = useCanonicalTables();

    // Workstation view tab: "terminal" | "transactions" | "shift"
    const [stationView, setStationView] = useState("terminal");

    // Active bills / orders state
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [orderFilter, setOrderFilter] = useState("ALL"); // ALL | DINE_IN | TAKEAWAY | DELIVERY | BILL_REQUESTED | PAYMENT_PENDING
    const [tableFilter, setTableFilter] = useState("ALL"); // ALL | BILLING | PAYMENT_PENDING | OCCUPIED | AVAILABLE
    const [loadingOrders, setLoadingOrders] = useState(true);

    // Current shift / Cash drawer state
    const [currentShift, setCurrentShift] = useState(null);
    const [loadingShift, setLoadingShift] = useState(true);
    const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [showCashMovementModal, setShowCashMovementModal] = useState(false);
    const [cashMovementType, setCashMovementType] = useState("CASH_IN"); // CASH_IN | CASH_OUT
    const [openingCashInput, setOpeningCashInput] = useState("");
    const [shiftNotesInput, setShiftNotesInput] = useState("");
    const [actualCashInput, setActualCashInput] = useState("");
    const [varianceReasonInput, setVarianceReasonInput] = useState("");
    const [closeNotesInput, setCloseNotesInput] = useState("");
    const [movementAmountInput, setMovementAmountInput] = useState("");
    const [movementReasonInput, setMovementReasonInput] = useState("");

    // Payment collection state
    const [paymentMethod, setPaymentMethod] = useState("CASH"); // CASH | UPI | CARD | SPLIT
    const [cashTendered, setCashTendered] = useState("");
    const [referenceNoInput, setReferenceNoInput] = useState("");
    const [processingPayment, setProcessingPayment] = useState(false);
    const [lastSettledOrder, setLastSettledOrder] = useState(null);
    const paymentInFlightRef = useRef(false);

    // Split Billing state
    const [showSplitModal, setShowSplitModal] = useState(false);

    // Discount request state
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [discountAmountInput, setDiscountAmountInput] = useState("");
    const [discountReasonInput, setDiscountReasonInput] = useState("");
    const [discountWaiting, setDiscountWaiting] = useState(false);

    // Recent Transactions / History drawer state
    const [transactions, setTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [txSearchQuery, setTxSearchQuery] = useState("");
    const [txFilter, setTxFilter] = useState("ALL"); // ALL | CASH | UPI | CARD

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
            setSelectedOrder((prev) => {
                if (!prev) return null;
                return unpaid.find((o) => o.id === prev.id) || null;
            });
        } catch (err) {
            console.error("Failed to fetch live cashier orders:", err);
        } finally {
            setLoadingOrders(false);
        }
    }, [token, restaurantId]);

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

    // 3. Fetch recent settled payments/transactions
    const fetchTransactions = useCallback(async () => {
        if (!token) return;
        try {
            setLoadingTransactions(true);
            const res = await axios.get(`${API}/api/restaurant/payments`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { restaurantId, limit: 40 },
            });
            setTransactions(res.data?.orders || []);
        } catch (err) {
            console.error("Failed to fetch payment transactions:", err);
        } finally {
            setLoadingTransactions(false);
        }
    }, [token, restaurantId]);

    const refreshAll = useCallback(async () => {
        await Promise.all([
            fetchLiveOrders(),
            fetchCurrentShift(),
            refreshTables ? refreshTables() : Promise.resolve(),
            fetchTransactions(),
        ]);
        showToast({ title: "Updated", message: "Cashier workstation refreshed", variant: "info" });
    }, [fetchLiveOrders, fetchCurrentShift, refreshTables, fetchTransactions]);

    useEffect(() => {
        fetchLiveOrders();
        fetchCurrentShift();
        fetchTransactions();
    }, [fetchLiveOrders, fetchCurrentShift, fetchTransactions]);

    // Socket realtime listeners
    useEffect(() => {
        if (!socket) return;

        const onOrderOrPaymentUpdated = () => {
            fetchLiveOrders();
            fetchCurrentShift();
            fetchTransactions();
            if (refreshTables) refreshTables();
        };

        const onBillRequested = (data) => {
            fetchLiveOrders();
            if (refreshTables) refreshTables();
            playNotificationSound();
            triggerNotificationVibration();
            showToast({
                title: "Bill Requested",
                message: `Table ${data?.tableNo || data?.tableId || ""} requested bill presentation.`,
                variant: "warning",
            });
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
        socket.on("order:updated", onOrderOrPaymentUpdated);
        socket.on("payment:updated", onOrderOrPaymentUpdated);
        socket.on("table:updated", onOrderOrPaymentUpdated);
        socket.on("table:session_updated", onOrderOrPaymentUpdated);
        socket.on("shift:updated", fetchCurrentShift);
        socket.on("bill:requested", onBillRequested);
        socket.on("manager:approval_resolved", onApprovalResolved);

        return () => {
            socket.off("order:created", onOrderOrPaymentUpdated);
            socket.off("order:updated", onOrderOrPaymentUpdated);
            socket.off("payment:updated", onOrderOrPaymentUpdated);
            socket.off("table:updated", onOrderOrPaymentUpdated);
            socket.off("table:session_updated", onOrderOrPaymentUpdated);
            socket.off("shift:updated", fetchCurrentShift);
            socket.off("bill:requested", onBillRequested);
            socket.off("manager:approval_resolved", onApprovalResolved);
        };
    }, [socket, fetchLiveOrders, fetchCurrentShift, fetchTransactions, refreshTables, selectedOrder]);

    // Shift Management Actions
    const handleOpenShift = async (e) => {
        e.preventDefault();
        try {
            const val = parseFloat(openingCashInput) || 0;
            const res = await axios.post(
                `${API}/api/shifts/open`,
                { restaurantId, openingCash: val, notes: shiftNotesInput || "Cashier POS Start" },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data?.shift) {
                setCurrentShift(res.data.shift);
                setShowOpenShiftModal(false);
                setOpeningCashInput("");
                setShiftNotesInput("");
                showToast({ title: "Shift Opened", message: `Drawer float initialized with ₹${val}`, variant: "success" });
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
            if (amount <= 0) {
                showToast({ title: "Invalid Amount", message: "Enter a positive cash amount", variant: "error" });
                return;
            }
            const endpoint = cashMovementType === "CASH_IN" ? "cash-in" : "cash-out";
            await axios.post(
                `${API}/api/shifts/${currentShift.id}/${endpoint}`,
                {
                    restaurantId,
                    amount,
                    reason: movementReasonInput || (cashMovementType === "CASH_IN" ? "Float addition" : "Cash payout/drop"),
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowCashMovementModal(false);
            setMovementAmountInput("");
            setMovementReasonInput("");
            showToast({
                title: "Cash Movement Recorded",
                message: `${cashMovementType === "CASH_IN" ? "Cash In" : "Cash Out"} of ₹${amount} recorded.`,
                variant: "success",
            });
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
            const expectedCash = Number(currentShift.expectedCash || 0);
            const variance = actualCash - expectedCash;

            if (Math.abs(variance) > 0.01 && !varianceReasonInput.trim()) {
                showToast({
                    title: "Reason Required",
                    message: "A discrepancy exists. Please provide an explanation note for the drawer variance.",
                    variant: "error",
                });
                return;
            }

            await axios.post(
                `${API}/api/shifts/${currentShift.id}/close`,
                {
                    restaurantId,
                    actualCash,
                    varianceReason: varianceReasonInput || "Balanced drawer settlement",
                    notes: closeNotesInput,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowCloseShiftModal(false);
            setActualCashInput("");
            setVarianceReasonInput("");
            setCloseNotesInput("");
            showToast({ title: "Shift Closed", message: "Cash drawer shift settled and reconciled.", variant: "success" });
            fetchCurrentShift();
        } catch (err) {
            showToast({ title: "Error", message: err.response?.data?.error || "Failed to close shift", variant: "error" });
        }
    };

    // Thermal Receipt Printing Utility
    const handlePrintReceipt = (orderToPrint, paymentInfo = {}) => {
        if (!orderToPrint) return;
        const authTotal = getAuthoritativeTotal(orderToPrint);
        const effectiveMethod = paymentInfo.paymentMode || paymentInfo.method || orderToPrint.paymentMode || paymentMethod || "CASH";
        const markup = buildReceiptPrintMarkup({
            restaurantName: user?.restaurant?.name || "Tiffzy Restaurant",
            restaurantAddress: user?.restaurant?.address || "",
            restaurantPhone: user?.restaurant?.phone || "",
            tableLabel: String(orderToPrint.tableNo || (orderToPrint.tableSession ? `T-${orderToPrint.tableSession.tableId}` : "--")),
            serverName: orderToPrint.serverName || orderToPrint.waiterName || user?.name || "Cashier",
            activeOrders: [orderToPrint],
            tableReceiptTotal: authTotal,
            paymentMode: effectiveMethod,
            paymentStatus: "PAID",
            referenceNo: paymentInfo.id ? `REC-${paymentInfo.id}` : (orderToPrint.invoiceNo || `ORD-${orderToPrint.id}`),
        });

        printReceiptWindow({
            markup,
            onBlocked: () => {
                showToast({
                    title: "Pop-up Blocked",
                    message: "Please allow pop-ups for this browser to print thermal receipts.",
                    variant: "warning",
                });
            },
        });
    };

    // Pre-Bill / Bill Estimate Print Utility
    const handlePrintEstimate = (orderToPrint) => {
        if (!orderToPrint) return;
        const authTotal = getAuthoritativeTotal(orderToPrint);
        const markup = buildReceiptPrintMarkup({
            restaurantName: user?.restaurant?.name || "Tiffzy Restaurant",
            restaurantAddress: user?.restaurant?.address || "",
            restaurantPhone: user?.restaurant?.phone || "",
            tableLabel: String(orderToPrint.tableNo || "--"),
            serverName: orderToPrint.serverName || orderToPrint.waiterName || user?.name || "Cashier",
            activeOrders: [orderToPrint],
            tableReceiptTotal: authTotal,
            paymentMode: "ESTIMATE (UNPAID)",
            paymentStatus: "PRE-BILL",
            referenceNo: `EST-${orderToPrint.orderNo || orderToPrint.id}`,
        });

        printReceiptWindow({
            markup,
            onBlocked: () => {
                showToast({
                    title: "Pop-up Blocked",
                    message: "Please allow pop-ups to print bill estimate.",
                    variant: "warning",
                });
            },
        });
    };

    // Payment Settlement Action
    const handleCollectPayment = async () => {
        if (!selectedOrder) return;
        if (paymentInFlightRef.current || processingPayment) return;

        if (!isOnline) {
            showToast({
                title: "Network Offline",
                message: "Cannot settle payments while offline. Reconnecting to POS network...",
                variant: "error",
            });
            return;
        }

        if (!currentShift) {
            showToast({
                title: "Shift Required",
                message: "Please open your cash drawer shift before collecting payments.",
                variant: "error",
            });
            setShowOpenShiftModal(true);
            return;
        }

        const authTotal = getAuthoritativeTotal(selectedOrder);

        if (paymentMethod === "CASH") {
            const tendered = parseFloat(cashTendered);
            if (Number.isNaN(tendered) || tendered < authTotal) {
                showToast({
                    title: "Insufficient Cash Tendered",
                    message: `Tendered cash (₹${Number.isNaN(tendered) ? 0 : tendered}) is less than total due (₹${authTotal}). Settlement blocked.`,
                    variant: "error",
                });
                return;
            }
        }

        try {
            paymentInFlightRef.current = true;
            setProcessingPayment(true);

            // Settle payment with backend authoritative amount
            // Try staff billing settle endpoint first, with fallback to owner table settle-bill
            let res;
            const targetTableNo = selectedOrder.tableNo || (selectedOrder.tableSession ? selectedOrder.tableSession.tableNo : null);
            try {
                res = await axios.post(
                    `${API}/api/v1/staff/billing/settle`,
                    {
                        orderId: selectedOrder.id,
                        tableSessionId: selectedOrder.tableSessionId,
                        tableNo: selectedOrder.tableNo,
                        paymentMethod,
                        paymentMode: paymentMethod,
                        amount: authTotal,
                        restaurantId,
                        shiftId: currentShift.id,
                        reference: referenceNoInput.trim() || null,
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch (endpointErr) {
                if (endpointErr.response?.status === 404 && targetTableNo) {
                    res = await axios.post(
                        `${API}/owner/${restaurantId}/tables/${encodeURIComponent(targetTableNo)}/settle-bill`,
                        {
                            tableId: selectedOrder.tableId || null,
                            orderId: selectedOrder.id,
                            paymentMode: paymentMethod,
                            paymentMethod,
                            amount: authTotal,
                            changedByName: user?.name || "Cashier",
                            reference: referenceNoInput.trim() || null,
                            transactionId: referenceNoInput.trim() || null,
                            shiftId: currentShift?.id || null,
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } else {
                    throw endpointErr;
                }
            }

            if (res.data?.success || res.data?.verified || res.data?.cleared !== undefined) {
                const settledAmount = res.data?.authoritativeTotal || authTotal;
                const completedOrder = {
                    ...selectedOrder,
                    paymentMode: paymentMethod,
                    paymentStatus: "PAID",
                };
                setLastSettledOrder(completedOrder);

                showToast({
                    title: "Payment Collected",
                    message: `₹${settledAmount} settled via ${paymentMethod} for Table ${selectedOrder.tableNo || ""}. Table queued for sanitization.`,
                    variant: "success",
                });
                playNotificationSound();

                // Trigger thermal receipt
                handlePrintReceipt(completedOrder, { paymentMode: paymentMethod, id: res.data?.payment?.id });

                setSelectedOrder(null);
                setCashTendered("");
                setReferenceNoInput("");
                fetchLiveOrders();
                fetchCurrentShift();
                fetchTransactions();
                if (refreshTables) refreshTables();
            }
        } catch (err) {
            showToast({
                title: "Payment Settlement Error",
                message: err.response?.data?.message || err.message || "Failed to settle payment",
                variant: "error",
            });
        } finally {
            paymentInFlightRef.current = false;
            setProcessingPayment(false);
        }
    };

    // Discount Approval Request (Manager Approval Required)
    const handleRequestDiscount = async (e) => {
        e.preventDefault();
        if (!selectedOrder) return;
        const disc = parseFloat(discountAmountInput) || 0;
        if (disc <= 0) {
            showToast({ title: "Invalid Amount", message: "Enter discount amount greater than ₹0", variant: "error" });
            return;
        }

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
                message: `Discount request for ₹${disc} sent to Duty Manager in realtime.`,
                variant: "info",
            });
        } catch (err) {
            setDiscountWaiting(false);
            showToast({
                title: "Discount Request Failed",
                message: err.response?.data?.message || "Failed to dispatch discount request",
                variant: "error",
            });
        }
    };

    // Change calculation
    const billTotal = selectedOrder ? getAuthoritativeTotal(selectedOrder) : 0;
    const tendered = parseFloat(cashTendered) || 0;
    const changeDue = Math.max(0, tendered - billTotal);
    const shortDue = tendered > 0 && tendered < billTotal ? billTotal - tendered : 0;

    // Shift Breakdown Computations
    const shiftStats = useMemo(() => {
        if (!currentShift) return null;
        const movements = currentShift.cashMovements || [];
        let cashSales = 0;
        let cashIn = 0;
        let cashOut = 0;
        let cashRefunds = 0;

        movements.forEach((m) => {
            const amt = Number(m.amount || 0);
            if (m.type === "CASH_SALE") cashSales += amt;
            else if (m.type === "CASH_IN") cashIn += amt;
            else if (m.type === "CASH_OUT") cashOut += amt;
            else if (m.type === "CASH_REFUND") cashRefunds += amt;
        });

        // Compute shift duration
        let durationStr = "Just started";
        if (currentShift.openedAt) {
            const start = new Date(currentShift.openedAt).getTime();
            const end = currentShift.closedAt ? new Date(currentShift.closedAt).getTime() : Date.now();
            const diffMins = Math.max(1, Math.round((end - start) / 60000));
            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        }

        return {
            openingCash: Number(currentShift.openingCash || 0),
            expectedCash: Number(currentShift.expectedCash || 0),
            cashSales,
            cashIn,
            cashOut,
            cashRefunds,
            movementCount: movements.length,
            durationStr,
        };
    }, [currentShift]);

    // Live Table Map Strip Mapping
    const tableStripData = useMemo(() => {
        const canonicalList = Array.isArray(tables) ? tables : [];
        return canonicalList.map((t) => {
            const tNo = String(t.tableNo || t.label || "").trim();
            // Match with an active unpaid order
            const activeOrder = orders.find((o) => String(o.tableNo || "").trim() === tNo);
            const status = t.canonicalStatus || (t.isOccupied ? "OCCUPIED" : "AVAILABLE");
            const billTotal = activeOrder ? getAuthoritativeTotal(activeOrder) : Number(t.sessionTotal || 0);
            return {
                ...t,
                tableNo: tNo,
                activeOrder,
                status,
                billTotal,
            };
        });
    }, [tables, orders]);

    const filteredTables = useMemo(() => {
        if (tableFilter === "ALL") return tableStripData;
        return tableStripData.filter((t) => {
            if (tableFilter === "BILLING") return t.status === "BILLING" || t.activeOrder?.status === "BILL_REQUESTED";
            if (tableFilter === "PAYMENT_PENDING") return t.status === "PAYMENT_PENDING" || t.activeOrder?.paymentStatus === "PENDING";
            if (tableFilter === "OCCUPIED") return t.isOccupied || t.status === "OCCUPIED";
            if (tableFilter === "AVAILABLE") return t.status === "AVAILABLE" && !t.isOccupied;
            return true;
        });
    }, [tableStripData, tableFilter]);

    // Filtered orders list for the Queue
    const filteredOrders = useMemo(() => {
        return orders.filter((o) => {
            // Text search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const orderNo = String(o.orderNo || o.id).toLowerCase();
                const tableNo = String(o.tableNo || "").toLowerCase();
                const phone = String(o.customer?.phone || o.phone || "").toLowerCase();
                const name = String(o.customer?.name || "").toLowerCase();
                const match = orderNo.includes(q) || tableNo.includes(q) || phone.includes(q) || name.includes(q);
                if (!match) return false;
            }

            // Category filter
            if (orderFilter === "DINE_IN") return (o.orderType || o.type || "DINE_IN").toUpperCase() === "DINE_IN";
            if (orderFilter === "TAKEAWAY") return (o.orderType || o.type || "").toUpperCase() === "TAKEAWAY";
            if (orderFilter === "DELIVERY") return (o.orderType || o.type || "").toUpperCase() === "DELIVERY";
            if (orderFilter === "BILL_REQUESTED") return o.billRequested || o.status === "BILL_REQUESTED";
            if (orderFilter === "PAYMENT_PENDING") return o.paymentStatus === "PENDING" || !o.paymentStatus;
            if (orderFilter === "PARTIALLY_PAID") return o.paymentStatus === "PARTIAL";

            return true;
        });
    }, [orders, searchQuery, orderFilter]);

    // Filtered Transactions
    const filteredTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            if (txSearchQuery.trim()) {
                const q = txSearchQuery.toLowerCase();
                const orderNo = String(tx.orderNo || tx.id).toLowerCase();
                const inv = String(tx.invoiceNo || "").toLowerCase();
                const name = String(tx.customerName || "").toLowerCase();
                const phone = String(tx.phone || "").toLowerCase();
                const match = orderNo.includes(q) || inv.includes(q) || name.includes(q) || phone.includes(q);
                if (!match) return false;
            }
            if (txFilter === "CASH") return String(tx.paymentMode || "").toUpperCase().includes("CASH");
            if (txFilter === "UPI") return String(tx.paymentMode || "").toUpperCase().includes("UPI");
            if (txFilter === "CARD") return String(tx.paymentMode || "").toUpperCase().includes("CARD");
            return true;
        });
    }, [transactions, txSearchQuery, txFilter]);

    // Quick Cash Preset Click
    const handleQuickCashPreset = (amount) => {
        setCashTendered(String(amount));
    };

    // Calculate Variance live for close shift modal
    const closeShiftVariance = useMemo(() => {
        const expected = Number(currentShift?.expectedCash || 0);
        const actual = parseFloat(actualCashInput) || 0;
        return actual - expected;
    }, [currentShift, actualCashInput]);

    return (
        <StaffShell
            title="Cashier Station POS Workstation"
            designation="CASHIER"
            fullWidth={true}
            tabs={[
                { id: "terminal", label: "POS Checkout", icon: Receipt, badge: orders.length },
                { id: "transactions", label: "Transactions", icon: History, badge: transactions.length },
                { id: "shift", label: "Cash Drawer", icon: DollarSign },
            ]}
            activeTab={stationView}
            onTabChange={setStationView}
            actions={
                <div className="flex items-center gap-2">
                    {/* Shift Status Pill */}
                    {currentShift ? (
                        <div
                            onClick={() => setStationView("shift")}
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold cursor-pointer hover:bg-emerald-100 transition"
                            title="Shift is OPEN. Click to inspect cash drawer"
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>DRAWER OPEN</span>
                            <span className="text-[#171717] font-black">₹{currentShift.expectedCash}</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowOpenShiftModal(true)}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold hover:bg-amber-100 transition"
                        >
                            <Unlock className="w-3.5 h-3.5 text-amber-600" />
                            <span>OPEN SHIFT</span>
                        </button>
                    )}

                    {/* Quick Reprint Last Receipt */}
                    {lastSettledOrder && (
                        <button
                            type="button"
                            onClick={() => handlePrintReceipt(lastSettledOrder)}
                            className="p-2.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#171717] transition min-h-[40px] min-w-[40px] flex items-center justify-center border border-[#E7E5E4]"
                            title="Reprint last thermal receipt"
                            aria-label="Reprint receipt"
                        >
                            <Printer className="w-4 h-4 text-[#EA580C]" />
                        </button>
                    )}

                    {/* Refresh Workstation */}
                    <button
                        type="button"
                        onClick={refreshAll}
                        className="p-2.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#171717] transition min-h-[40px] min-w-[40px] flex items-center justify-center border border-[#E7E5E4]"
                        title="Refresh bills and table state"
                        aria-label="Refresh workstation"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            }
        >
            {/* VIEW 1: MAIN POS CHECKOUT WORKSTATION */}
            {stationView === "terminal" && (
                <div className="space-y-4">
                    {/* TOP STATUS BAR: Connection, Drawer Quick Status, Summary Counter */}
                    <div className="bg-white border border-[#E7E5E4] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                        <div className="flex items-center gap-4 flex-wrap">
                            {/* Online / Realtime Status */}
                            <div className="flex items-center gap-1.5 font-bold">
                                <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500 shadow-xs" : "bg-rose-500 shadow-xs"}`} />
                                <span className={isConnected ? "text-emerald-700 font-extrabold uppercase tracking-wider" : "text-rose-700 font-extrabold uppercase tracking-wider"}>
                                    {isConnected ? "ONLINE • REALTIME POS" : "OFFLINE • SYNC PENDING"}
                                </span>
                            </div>

                            <span className="text-stone-300 hidden sm:inline">|</span>

                            {/* Active Metrics */}
                            <div className="flex items-center gap-3 text-[#57534E]">
                                <span>Unpaid Bills: <strong className="text-[#171717] font-extrabold">{orders.length}</strong></span>
                                <span>Total Pending: <strong className="text-[#EA580C] font-extrabold">₹{orders.reduce((sum, o) => sum + getAuthoritativeTotal(o), 0)}</strong></span>
                                <span className="hidden md:inline">Occupied Tables: <strong className="text-[#171717] font-bold">{occupiedCount}</strong></span>
                            </div>
                        </div>

                        {/* Shift Quick Actions */}
                        <div className="flex items-center gap-2">
                            {currentShift ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCashMovementType("CASH_IN");
                                            setShowCashMovementModal(true);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#FFF7ED] text-[#171717] font-semibold flex items-center gap-1 transition border border-[#E7E5E4]"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>+ Cash In</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCashMovementType("CASH_OUT");
                                            setShowCashMovementModal(true);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#FFF7ED] text-[#171717] font-semibold flex items-center gap-1 transition border border-[#E7E5E4]"
                                    >
                                        <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
                                        <span>- Cash Out</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowOpenShiftModal(true)}
                                    className="px-3 py-1 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white font-bold flex items-center gap-1 transition shadow-xs"
                                >
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>Open Shift</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* MAIN TWO-COLUMN POS WORKSPACE */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        {/* LEFT COLUMN: Table Strip & Active Bills Queue */}
                        <div className={`lg:col-span-5 xl:col-span-5 space-y-3 ${selectedOrder ? "hidden lg:block" : "block"}`}>
                            {/* FLOOR / TABLE STATUS STRIP */}
                            <div className="bg-white border border-[#E7E5E4] rounded-xl p-3 space-y-2.5 shadow-xs">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-extrabold text-[#171717] uppercase tracking-wider flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-[#EA580C]" />
                                        Table Floor Map ({tableStripData.length})
                                    </span>
                                    {/* Table Filters */}
                                    <div className="flex items-center gap-1">
                                        {[
                                            { id: "ALL", label: "All" },
                                            { id: "BILLING", label: "Billing" },
                                            { id: "PAYMENT_PENDING", label: "Pending" },
                                            { id: "OCCUPIED", label: "Occupied" },
                                        ].map((tf) => (
                                            <button
                                                key={tf.id}
                                                type="button"
                                                onClick={() => setTableFilter(tf.id)}
                                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition ${
                                                    tableFilter === tf.id
                                                        ? "bg-[#F97316] text-white shadow-xs"
                                                        : "text-[#57534E] hover:text-[#171717] hover:bg-stone-100"
                                                }`}
                                            >
                                                {tf.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Horizontal Scrollable Table Badges */}
                                <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                                    {filteredTables.length === 0 ? (
                                        <div className="py-2 text-xs text-[#78716C] italic">No tables match filter</div>
                                    ) : (
                                        filteredTables.map((t) => {
                                            const hasActiveOrder = Boolean(t.activeOrder);
                                            const isSelected = selectedOrder && String(selectedOrder.tableNo || "").trim() === String(t.tableNo).trim();
                                            const isBilling = t.status === "BILLING" || t.activeOrder?.status === "BILL_REQUESTED";

                                            return (
                                                <button
                                                    key={t.id || t.tableNo}
                                                    type="button"
                                                    onClick={() => {
                                                        if (t.activeOrder) {
                                                            setSelectedOrder(t.activeOrder);
                                                        } else {
                                                            showToast({
                                                                title: `Table ${t.tableNo}`,
                                                                message: t.isOccupied ? "Table occupied but no unpaid bill found" : "Table is currently available",
                                                                variant: "info",
                                                            });
                                                        }
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-xl border text-left shrink-0 transition flex flex-col justify-between min-w-[76px] ${
                                                        isSelected
                                                            ? "bg-[#F97316] border-[#EA580C] text-white shadow-xs"
                                                            : isBilling
                                                            ? "bg-amber-50 border-amber-300 text-amber-900 animate-pulse"
                                                            : hasActiveOrder
                                                            ? "bg-[#FFF7ED] border-orange-200 text-[#171717] hover:border-orange-300"
                                                            : t.isOccupied
                                                            ? "bg-sky-50 border-sky-200 text-sky-900"
                                                            : "bg-stone-50 border-[#E7E5E4] text-[#57534E] hover:border-stone-300"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="font-black text-xs">T-{t.tableNo || "?"}</span>
                                                        <span className={`w-2 h-2 rounded-full ${
                                                            isBilling ? "bg-amber-500" : hasActiveOrder ? "bg-[#F97316]" : t.isOccupied ? "bg-sky-500" : "bg-emerald-500"
                                                        }`} />
                                                    </div>
                                                    <div className="text-[10px] font-bold mt-1">
                                                        {t.billTotal > 0 ? `₹${t.billTotal}` : t.isOccupied ? "Seated" : "Free"}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* UNPAID BILLS QUEUE */}
                            <div className="bg-white border border-[#E7E5E4] rounded-xl p-3 space-y-3 shadow-xs">
                                {/* Search and Filter Tabs */}
                                <div className="space-y-2">
                                    <div className="relative w-full">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
                                        <input
                                            type="text"
                                            placeholder="Search table, bill #, phone, customer..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-white border border-[#E7E5E4] rounded-xl pl-9 pr-8 py-2 text-xs text-[#171717] placeholder-[#78716C] focus:outline-hidden focus:border-[#F97316] min-h-[40px]"
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery("")}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#171717]"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Order Type / Status Filter Chips */}
                                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                                        {[
                                            { id: "ALL", label: `All (${orders.length})` },
                                            { id: "BILL_REQUESTED", label: "Bill Requested" },
                                            { id: "DINE_IN", label: "Dine-In" },
                                            { id: "TAKEAWAY", label: "Takeaway" },
                                            { id: "PAYMENT_PENDING", label: "Pending" },
                                        ].map((f) => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => setOrderFilter(f.id)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                                                    orderFilter === f.id
                                                        ? "bg-[#F97316] text-white shadow-xs"
                                                        : "bg-stone-100 text-[#57534E] hover:bg-stone-200 border border-[#E7E5E4]"
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Active Orders List */}
                                <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 scrollbar-thin">
                                    {loadingOrders ? (
                                        <div className="py-12 text-center text-xs text-[#78716C]">Loading active bills...</div>
                                    ) : filteredOrders.length === 0 ? (
                                        <div className="py-12 text-center bg-[#FFF7ED]/50 rounded-xl border border-[#E7E5E4] p-4">
                                            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
                                            <p className="text-xs font-bold text-[#171717]">No Unpaid Bills Found</p>
                                            <p className="text-[11px] text-[#57534E] mt-0.5">All tables and takeaway orders are currently settled.</p>
                                        </div>
                                    ) : (
                                        filteredOrders.map((o) => {
                                            const isSelected = selectedOrder?.id === o.id;
                                            const total = getAuthoritativeTotal(o);
                                            const isBillReq = o.billRequested || o.status === "BILL_REQUESTED";
                                            const orderType = String(o.orderType || o.type || "DINE_IN").toUpperCase();

                                            return (
                                                <div
                                                    key={o.id}
                                                    data-testid={`order-card-${o.id}`}
                                                    onClick={() => setSelectedOrder(o)}
                                                    role="button"
                                                    tabIndex={0}
                                                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                                                        isSelected
                                                            ? "bg-[#FFF7ED] border-[#F97316] shadow-xs ring-1 ring-[#F97316]"
                                                            : "bg-white border-[#E7E5E4] hover:border-stone-300 hover:bg-stone-50/60"
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                                                                isSelected
                                                                    ? "bg-[#F97316] text-white"
                                                                    : "bg-stone-100 text-[#EA580C] border border-[#E7E5E4]"
                                                            }`}>
                                                                {orderType === "TAKEAWAY"
                                                                    ? `Takeaway #${o.orderNo || o.id}`
                                                                    : `Table ${o.tableNo || "T-?"}`}
                                                            </span>

                                                            {isBillReq && (
                                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                                                                    BILL REQUESTED
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="text-right">
                                                            <span className="text-base font-black text-[#171717]">₹{total}</span>
                                                        </div>
                                                    </div>

                                                    {/* Middle Info: Bill ID, Customer, Server */}
                                                    <div className="flex items-center justify-between text-[11px] text-[#57534E] mt-2">
                                                        <div className="truncate max-w-[200px]">
                                                            <span className="text-[#171717] font-semibold">Bill #{o.orderNo || o.id}</span>
                                                            {o.customer?.name && (
                                                                <span className="ml-1.5 text-[#57534E]">• {o.customer.name}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[#57534E] flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-[#78716C]" />
                                                            <span>{o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</span>
                                                        </div>
                                                    </div>

                                                    {/* Items Summary Snippet */}
                                                    {Array.isArray(o.items) && o.items.length > 0 && (
                                                        <div className="mt-2 text-[11px] text-[#57534E] line-clamp-1 bg-stone-100 px-2 py-1 rounded-md border border-[#E7E5E4]">
                                                            {o.items.map((it) => `${it.qty || it.quantity || 1}x ${it.name || it.itemName}`).join(", ")}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Selected Bill Workstation & Checkout Pane (7 cols on wide) */}
                        <div className={`lg:col-span-7 xl:col-span-7 ${!selectedOrder ? "hidden lg:block" : "block"}`}>
                            {selectedOrder ? (
                                <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
                                    {/* Mobile Back to Bills Queue Button */}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedOrder(null)}
                                        className="lg:hidden inline-flex items-center gap-1.5 text-xs font-bold text-[#EA580C] hover:text-[#C2410C] py-1.5 px-3 rounded-xl bg-white border border-[#E7E5E4] min-h-[40px] transition mb-1"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        <span>← Back to Bills Queue</span>
                                    </button>

                                    {/* BILL HEADER & FAST ACTIONS */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7E5E4] pb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-3 py-1 rounded-xl bg-[#F97316] text-white font-black text-sm">
                                                    Table {selectedOrder.tableNo || "T-?"}
                                                </span>
                                                <h2 className="font-black text-[#171717] text-lg">
                                                    Bill #{selectedOrder.orderNo || selectedOrder.id}
                                                </h2>
                                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-stone-100 text-[#57534E] border border-[#E7E5E4]">
                                                    {selectedOrder.orderType || selectedOrder.type || "DINE_IN"}
                                                </span>
                                            </div>

                                            <div className="text-xs text-[#57534E] mt-1.5 flex items-center gap-2 flex-wrap">
                                                <span>Customer: <strong className="text-[#171717]">{selectedOrder.customer?.name || "Walk-in Guest"}</strong></span>
                                                {selectedOrder.customer?.phone && (
                                                    <>
                                                        <span className="text-stone-300">•</span>
                                                        <span>{selectedOrder.customer.phone}</span>
                                                    </>
                                                )}
                                                {selectedOrder.serverName && (
                                                    <>
                                                        <span className="text-stone-300">•</span>
                                                        <span>Server: <strong className="text-[#171717]">{selectedOrder.serverName}</strong></span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bill Operations: Print Estimate, Split Bill, Discount */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Pre-bill / Estimate Print */}
                                            <button
                                                type="button"
                                                onClick={() => handlePrintEstimate(selectedOrder)}
                                                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-bold flex items-center gap-1.5 transition border border-[#E7E5E4] min-h-[38px]"
                                                title="Print Pre-Bill estimate slip for guest presentation"
                                            >
                                                <Printer className="w-3.5 h-3.5 text-[#57534E]" />
                                                <span>Pre-Bill</span>
                                            </button>

                                            {/* Split Bill */}
                                            <button
                                                type="button"
                                                data-testid="open-split-modal-btn"
                                                onClick={() => setShowSplitModal(true)}
                                                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-bold flex items-center gap-1.5 transition border border-[#E7E5E4] min-h-[38px]"
                                                title="Open Split Billing Modal"
                                            >
                                                <Layers className="w-3.5 h-3.5 text-sky-600" />
                                                <span>Split</span>
                                            </button>

                                            {/* Request Discount */}
                                            <button
                                                type="button"
                                                data-testid="request-discount-btn"
                                                onClick={() => setShowDiscountModal(true)}
                                                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-bold flex items-center gap-1.5 transition border border-[#E7E5E4] min-h-[38px]"
                                            >
                                                <Percent className="w-3.5 h-3.5 text-[#EA580C]" />
                                                <span>Discount</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* ITEMIZED BILL LEDGER */}
                                    <div className="bg-stone-50 rounded-xl p-3 border border-[#E7E5E4] space-y-2">
                                        <div className="flex justify-between items-center text-[11px] font-extrabold text-[#57534E] uppercase tracking-wider pb-1.5 border-b border-[#E7E5E4]">
                                            <span>Item & Details</span>
                                            <div className="flex items-center gap-8">
                                                <span>Qty x Price</span>
                                                <span className="w-16 text-right">Total</span>
                                            </div>
                                        </div>

                                        <div className="divide-y divide-[#E7E5E4] max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                                            {(selectedOrder.items || []).map((item, idx) => {
                                                const qty = item.qty || item.quantity || 1;
                                                const unitPrice = Number(item.price || 0);
                                                const lineTotal = unitPrice * qty;

                                                return (
                                                    <div key={idx} className="py-2 flex items-center justify-between text-xs">
                                                        <div className="pr-2">
                                                            <div className="font-bold text-[#171717] text-xs">
                                                                {item.name || item.itemName}
                                                            </div>
                                                            {item.notes && (
                                                                <div className="text-[10px] text-[#EA580C] italic">
                                                                    Note: {item.notes}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-8 shrink-0">
                                                            <span className="text-[#57534E] text-xs">
                                                                {qty} × ₹{unitPrice}
                                                            </span>
                                                            <span className="font-extrabold text-[#171717] text-xs w-16 text-right">
                                                                ₹{lineTotal}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* FINANCIAL TOTALS LEDGER */}
                                        <div className="border-t border-[#E7E5E4] pt-2.5 space-y-1.5 text-xs">
                                            <div className="flex justify-between text-[#57534E]">
                                                <span>Subtotal</span>
                                                <span className="font-semibold text-[#171717]">₹{selectedOrder.subtotal || billTotal}</span>
                                            </div>

                                            {Number(selectedOrder.discountAmount || 0) > 0 && (
                                                <div className="flex justify-between text-emerald-700 font-bold">
                                                    <span>Manager Approved Discount</span>
                                                    <span>-₹{selectedOrder.discountAmount}</span>
                                                </div>
                                            )}

                                            {Number(selectedOrder.taxAmount || 0) > 0 && (
                                                <div className="flex justify-between text-[#57534E]">
                                                    <span>Taxes (GST/CGST/SGST)</span>
                                                    <span>₹{selectedOrder.taxAmount}</span>
                                                </div>
                                            )}

                                            {Number(selectedOrder.serviceChargeAmount || 0) > 0 && (
                                                <div className="flex justify-between text-[#57534E]">
                                                    <span>Service Charge</span>
                                                    <span>₹{selectedOrder.serviceChargeAmount}</span>
                                                </div>
                                            )}

                                            {/* AUTHORITATIVE GRAND TOTAL */}
                                            <div className="flex justify-between items-center text-lg font-black text-[#171717] pt-2 border-t border-[#E7E5E4] bg-[#FFF7ED] p-2.5 rounded-xl border border-orange-200">
                                                <span className="text-xs uppercase tracking-wider text-[#57534E]">Total Authoritative Due</span>
                                                <span data-testid="authoritative-grand-total" className="text-2xl font-black text-[#EA580C]">
                                                    ₹{billTotal}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PAYMENT WORKFLOW TARGETS */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-[#57534E] uppercase tracking-wider block">
                                            Select Settlement Method
                                        </label>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { id: "CASH", label: "Cash", sub: "Drawer float", icon: DollarSign },
                                                { id: "UPI", label: "UPI / QR", sub: "Scan & pay", icon: QrCode },
                                                { id: "CARD", label: "Card POS", sub: "EDC Swiper", icon: CreditCard },
                                                { id: "SPLIT", label: "Split Bill", sub: "Multi-payer", icon: Layers },
                                            ].map((m) => {
                                                const isSelected = paymentMethod === m.id;
                                                const Icon = m.icon;
                                                return (
                                                    <button
                                                        key={m.id}
                                                        data-testid={`pay-method-${m.id}`}
                                                        type="button"
                                                        onClick={() => {
                                                            if (m.id === "SPLIT") {
                                                                setShowSplitModal(true);
                                                            } else {
                                                                setPaymentMethod(m.id);
                                                            }
                                                        }}
                                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition min-h-[64px] ${
                                                            isSelected
                                                                ? "bg-[#F97316] text-white border-[#EA580C] shadow-xs"
                                                                : "bg-white text-[#171717] border-[#E7E5E4] hover:bg-[#FFF7ED]"
                                                        }`}
                                                    >
                                                        <Icon className="w-5 h-5 mb-1" />
                                                        <span className="text-xs font-black">{m.label}</span>
                                                        <span className="text-[10px] opacity-75">{m.sub}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* CASH CHANGE CALCULATOR (When CASH is chosen) */}
                                    {paymentMethod === "CASH" && (
                                        <div className="bg-stone-50 p-3.5 rounded-xl border border-[#E7E5E4] space-y-3">
                                            {/* Quick preset buttons */}
                                            <div>
                                                <div className="text-[11px] font-bold text-[#57534E] mb-1.5 flex items-center justify-between">
                                                    <span>Fast Cash Presets</span>
                                                    <span className="text-[10px] text-[#78716C]">Tap to auto-fill tendered</span>
                                                </div>
                                                <div className="flex gap-1.5 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuickCashPreset(billTotal)}
                                                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-bold border border-[#E7E5E4] transition shadow-xs"
                                                    >
                                                        Exact (₹{billTotal})
                                                    </button>
                                                    {[50, 100, 500].map((add) => {
                                                        const presetVal = billTotal + add;
                                                        return (
                                                            <button
                                                                key={add}
                                                                type="button"
                                                                onClick={() => handleQuickCashPreset(presetVal)}
                                                                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-semibold border border-[#E7E5E4] transition"
                                                            >
                                                                +₹{add} (₹{presetVal})
                                                            </button>
                                                        );
                                                    })}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuickCashPreset(500)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-semibold border border-[#E7E5E4] transition"
                                                    >
                                                        ₹500
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuickCashPreset(2000)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-semibold border border-[#E7E5E4] transition"
                                                    >
                                                        ₹2000
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Cash Tendered Input & Change Output */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                <div>
                                                    <label className="text-xs text-[#57534E] block mb-1 font-semibold">Cash Tendered (₹)</label>
                                                    <input
                                                        type="number"
                                                        value={cashTendered}
                                                        onChange={(e) => setCashTendered(e.target.value)}
                                                        placeholder={`e.g. ${billTotal}`}
                                                        className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] font-extrabold text-lg focus:outline-hidden focus:border-[#F97316] min-h-[46px]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-[#57534E] block mb-1 font-semibold">
                                                        {shortDue > 0 ? "Under-Tendered Due (₹)" : "Change to Return (₹)"}
                                                    </label>
                                                    <div className={`w-full rounded-xl px-3 py-2 font-black text-xl flex items-center min-h-[46px] border ${
                                                        shortDue > 0
                                                            ? "bg-amber-50 text-amber-800 border-amber-300"
                                                            : changeDue > 0
                                                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                                            : "bg-stone-100 text-[#57534E] border-[#E7E5E4]"
                                                    }`}>
                                                        {shortDue > 0 ? `-₹${shortDue.toFixed(2)}` : `₹${changeDue.toFixed(2)}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* UPI / Card Reference Input */}
                                    {(paymentMethod === "UPI" || paymentMethod === "CARD") && (
                                        <div className="bg-stone-50 p-3 rounded-xl border border-[#E7E5E4] flex items-center gap-3">
                                            <div className="flex-1">
                                                <label className="text-[11px] text-[#57534E] block mb-1 font-semibold">
                                                    {paymentMethod === "UPI" ? "UPI UTR / Reference No. (Optional)" : "Card Approval / Transaction Slip No."}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={referenceNoInput}
                                                    onChange={(e) => setReferenceNoInput(e.target.value)}
                                                    placeholder="Enter reference / UTR for payment audit"
                                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] text-xs focus:outline-hidden focus:border-[#F97316] min-h-[40px]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* SETTLE / COMPLETE PAYMENT BUTTON */}
                                    <button
                                        type="button"
                                        data-testid="settle-payment-btn"
                                        onClick={handleCollectPayment}
                                        disabled={processingPayment || !currentShift || !isOnline || (paymentMethod === "CASH" && shortDue > 0)}
                                        className={`w-full py-4 rounded-xl font-black text-base transition flex items-center justify-center gap-2 shadow-xs min-h-[50px] disabled:opacity-50 ${
                                            !isOnline
                                                ? "bg-stone-200 text-[#78716C] cursor-not-allowed border border-[#E7E5E4]"
                                                : paymentMethod === "CASH" && shortDue > 0
                                                ? "bg-amber-100 hover:bg-amber-200 text-amber-900 cursor-not-allowed border border-amber-300"
                                                : "bg-[#059669] hover:bg-emerald-700 text-white"
                                        }`}
                                    >
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span>
                                            {!isOnline
                                                ? "Offline — Settlements Paused"
                                                : processingPayment
                                                ? "Settling & Releasing Table..."
                                                : paymentMethod === "CASH" && shortDue > 0
                                                ? `Under-Tendered (Short ₹${shortDue.toFixed(2)})`
                                                : `Confirm ₹${billTotal} Paid via ${paymentMethod}`}
                                        </span>
                                    </button>
                                </div>
                            ) : (
                                /* COMPACT EMPTY STATE (No bill selected) */
                                <div className="p-8 sm:p-12 text-center bg-white border border-[#E7E5E4] rounded-xl space-y-4 shadow-xs">
                                    <div className="w-14 h-14 rounded-2xl bg-[#FFF7ED] border border-orange-200 flex items-center justify-center mx-auto text-[#F97316]">
                                        <Receipt className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-extrabold text-[#171717]">Select a Bill to Begin Checkout</h3>
                                        <p className="text-xs text-[#57534E] mt-1 max-w-sm mx-auto">
                                            Choose an unpaid table bill or takeaway order from the queue on the left to review items and collect payment.
                                        </p>
                                    </div>

                                    {/* Quick metrics overview in empty state */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md mx-auto pt-2">
                                        <div className="p-3 bg-stone-50 rounded-xl border border-[#E7E5E4] text-left">
                                            <span className="text-[10px] text-[#57534E] uppercase font-bold block">Pending Bills</span>
                                            <span className="text-lg font-black text-[#171717]">{orders.length}</span>
                                        </div>
                                        <div className="p-3 bg-stone-50 rounded-xl border border-[#E7E5E4] text-left">
                                            <span className="text-[10px] text-[#57534E] uppercase font-bold block">Outstanding</span>
                                            <span className="text-lg font-black text-[#EA580C]">
                                                ₹{orders.reduce((sum, o) => sum + getAuthoritativeTotal(o), 0)}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-stone-50 rounded-xl border border-[#E7E5E4] text-left col-span-2 sm:col-span-1">
                                            <span className="text-[10px] text-[#57534E] uppercase font-bold block">Drawer Float</span>
                                            <span className="text-lg font-black text-emerald-700">
                                                ₹{currentShift?.expectedCash ?? "0"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW 2: RECENT TRANSACTIONS & RECEIPT REPRINT */}
            {stationView === "transactions" && (
                <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7E5E4] pb-4">
                        <div>
                            <h2 className="text-lg font-black text-[#171717] flex items-center gap-2">
                                <History className="w-5 h-5 text-[#EA580C]" />
                                Recent Settle Transactions ({transactions.length})
                            </h2>
                            <p className="text-xs text-[#57534E] mt-0.5">
                                Search, audit, and reprint thermal receipts for today's settled orders.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative w-full sm:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
                                <input
                                    type="text"
                                    placeholder="Search bill #, customer, phone..."
                                    value={txSearchQuery}
                                    onChange={(e) => setTxSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl pl-9 pr-3 py-2 text-xs text-[#171717] placeholder-[#78716C] focus:outline-hidden focus:border-[#F97316] min-h-[40px]"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={fetchTransactions}
                                className="p-2.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#171717] transition border border-[#E7E5E4]"
                                title="Refresh transactions"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5">
                        {["ALL", "CASH", "UPI", "CARD"].map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setTxFilter(f)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                    txFilter === f
                                        ? "bg-[#F97316] text-white shadow-xs"
                                        : "bg-stone-100 text-[#57534E] hover:text-[#171717] border border-[#E7E5E4]"
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {/* Transactions Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#171717] border-collapse">
                            <thead>
                                <tr className="border-b border-[#E7E5E4] text-[#57534E] uppercase text-[10px] tracking-wider bg-stone-50">
                                    <th className="py-2.5 px-3">Bill / Invoice #</th>
                                    <th className="py-2.5 px-3">Customer</th>
                                    <th className="py-2.5 px-3">Method</th>
                                    <th className="py-2.5 px-3">Amount</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Time</th>
                                    <th className="py-2.5 px-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E7E5E4]">
                                {loadingTransactions ? (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-[#78716C]">Loading transactions...</td>
                                    </tr>
                                ) : filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-[#78716C]">No transactions found</td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-stone-50 transition">
                                            <td className="py-2.5 px-3 font-bold text-[#171717]">
                                                #{tx.orderNo || tx.id}
                                                {tx.invoiceNo && <span className="block text-[10px] text-[#78716C] font-normal">{tx.invoiceNo}</span>}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className="font-semibold text-[#171717]">{tx.customerName || "Walk-in Guest"}</span>
                                                {tx.phone && <span className="block text-[10px] text-[#78716C]">{tx.phone}</span>}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-stone-100 text-[#171717] border border-[#E7E5E4]">
                                                    {tx.paymentMode || "CASH"}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-extrabold text-[#171717] text-sm">
                                                ₹{tx.total}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    {tx.paymentStatus || "SUCCESS"}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-[#57534E] text-[11px]">
                                                {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <button
                                                    type="button"
                                                    data-testid={`reprint-tx-${tx.id}`}
                                                    onClick={() => handlePrintReceipt(tx)}
                                                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#FFF7ED] text-[#171717] font-bold text-xs inline-flex items-center gap-1 transition border border-[#E7E5E4]"
                                                >
                                                    <Printer className="w-3.5 h-3.5 text-[#EA580C]" />
                                                    <span>Reprint</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VIEW 3: CASH DRAWER & SHIFT RECONCILIATION */}
            {stationView === "shift" && (
                <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 sm:p-6 shadow-xs space-y-6 w-full max-w-none">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7E5E4] pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-black text-[#171717] text-lg flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-[#EA580C]" />
                                    Cash Drawer Shift Management
                                </h2>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                                    currentShift?.status === "OPEN"
                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                                        : "bg-rose-50 text-rose-800 border border-rose-300"
                                }`}>
                                    {currentShift?.status || "CLOSED"}
                                </span>
                            </div>
                            <p className="text-xs text-[#57534E] mt-1">
                                Terminal: <strong className="text-[#171717]">{currentShift?.terminalId || "MAIN"}</strong> • Cashier: <strong className="text-[#171717]">{user?.name || "Staff"}</strong> • Duration: <strong className="text-[#171717]">{shiftStats?.durationStr || "0m"}</strong>
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            {currentShift ? (
                                <button
                                    type="button"
                                    data-testid="close-shift-btn"
                                    onClick={() => setShowCloseShiftModal(true)}
                                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                                >
                                    <Lock className="w-4 h-4" />
                                    <span>Close Shift & Reconcile</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    data-testid="open-shift-btn"
                                    onClick={() => setShowOpenShiftModal(true)}
                                    className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                                >
                                    <Unlock className="w-4 h-4" />
                                    <span>Open Shift</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {currentShift ? (
                        <div className="space-y-6">
                            {/* Summary Metric Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3.5 bg-stone-50 rounded-xl border border-[#E7E5E4]">
                                    <span className="text-[10px] text-[#57534E] uppercase font-bold block mb-1">Opening Cash Float</span>
                                    <span className="text-lg font-black text-[#171717]">₹{shiftStats?.openingCash || 0}</span>
                                </div>
                                <div className="p-3.5 bg-stone-50 rounded-xl border border-[#E7E5E4]">
                                    <span className="text-[10px] text-[#57534E] uppercase font-bold block mb-1">Cash Sales Collected</span>
                                    <span className="text-lg font-black text-emerald-700">₹{shiftStats?.cashSales || 0}</span>
                                </div>
                                <div className="p-3.5 bg-stone-50 rounded-xl border border-[#E7E5E4]">
                                    <span className="text-[10px] text-[#57534E] uppercase font-bold block mb-1">Cash In (Float Additions)</span>
                                    <span className="text-lg font-black text-sky-700">+₹{shiftStats?.cashIn || 0}</span>
                                </div>
                                <div className="p-3.5 bg-stone-50 rounded-xl border border-[#E7E5E4]">
                                    <span className="text-[10px] text-[#57534E] uppercase font-bold block mb-1">Cash Out (Drops / Payouts)</span>
                                    <span className="text-lg font-black text-rose-700">-₹{shiftStats?.cashOut || 0}</span>
                                </div>
                            </div>

                            {/* Authoritative Expected Cash in Drawer */}
                            <div className="p-4 bg-[#FFF7ED] rounded-xl border border-orange-200 flex items-center justify-between">
                                <div>
                                    <span className="text-xs uppercase font-extrabold text-[#57534E] tracking-wider block">
                                        Authoritative Expected Cash In Drawer
                                    </span>
                                    <span className="text-xs text-[#78716C]">
                                        Formula: Opening Float + Cash Sales + Cash In - Cash Out - Refunds
                                    </span>
                                </div>
                                <span className="text-3xl font-black text-[#EA580C]">
                                    ₹{shiftStats?.expectedCash || 0}
                                </span>
                            </div>

                            {/* Cash Movement Ledger */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-extrabold text-[#171717] text-sm">
                                        Cash Movement Audit Trail ({currentShift.cashMovements?.length || 0})
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            data-testid="shift-cash-in-btn"
                                            onClick={() => {
                                                setCashMovementType("CASH_IN");
                                                setShowCashMovementModal(true);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-semibold flex items-center gap-1 border border-[#E7E5E4]"
                                        >
                                            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>+ Cash In</span>
                                        </button>
                                        <button
                                            type="button"
                                            data-testid="shift-cash-out-btn"
                                            onClick={() => {
                                                setCashMovementType("CASH_OUT");
                                                setShowCashMovementModal(true);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-semibold flex items-center gap-1 border border-[#E7E5E4]"
                                        >
                                            <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
                                            <span>- Cash Out</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-stone-50 rounded-xl border border-[#E7E5E4] divide-y divide-[#E7E5E4] max-h-64 overflow-y-auto">
                                    {(currentShift.cashMovements || []).length === 0 ? (
                                        <div className="py-6 text-center text-xs text-[#78716C]">No cash movements recorded yet</div>
                                    ) : (
                                        currentShift.cashMovements.map((m) => {
                                            const isPositive = ["OPENING_CASH", "CASH_SALE", "CASH_IN"].includes(m.type);
                                            return (
                                                <div key={m.id} className="p-3 flex items-center justify-between text-xs">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                                                m.type === "CASH_SALE"
                                                                    ? "bg-emerald-50 text-emerald-800"
                                                                    : m.type === "CASH_IN"
                                                                    ? "bg-sky-50 text-sky-800"
                                                                    : m.type === "CASH_OUT"
                                                                    ? "bg-rose-50 text-rose-800"
                                                                    : "bg-stone-200 text-[#171717]"
                                                            }`}>
                                                                {m.type}
                                                            </span>
                                                            <span className="text-[#171717] font-semibold">{m.reason || "Shift Transaction"}</span>
                                                        </div>
                                                        <span className="text-[10px] text-[#78716C] mt-0.5 block">
                                                            {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                                                        </span>
                                                    </div>

                                                    <span className={`font-black text-sm ${isPositive ? "text-emerald-700" : "text-rose-700"}`}>
                                                        {isPositive ? `+₹${m.amount}` : `-₹${m.amount}`}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center bg-stone-50 rounded-xl border border-[#E7E5E4] p-6 space-y-3">
                            <Lock className="w-10 h-10 text-[#78716C] mx-auto" />
                            <h3 className="font-extrabold text-[#171717] text-base">Cashier Shift is Currently Closed</h3>
                            <p className="text-xs text-[#57534E] max-w-sm mx-auto">
                                Open your shift with an initial opening float to start collecting bills and tracking cash movements.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowOpenShiftModal(true)}
                                className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs transition shadow-xs"
                            >
                                Open Shift (Enter Float)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL 1: OPEN SHIFT */}
            {showOpenShiftModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-[#E7E5E4] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                        <h3 className="font-black text-[#171717] text-lg flex items-center gap-2">
                            <Unlock className="w-5 h-5 text-[#EA580C]" />
                            Open Cash Drawer Shift
                        </h3>
                        <p className="text-xs text-[#57534E]">
                            Enter the initial physical cash float counted in the drawer at the start of your shift.
                        </p>
                        <form onSubmit={handleOpenShift} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#57534E] block mb-1">
                                    Opening Cash Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    value={openingCashInput}
                                    onChange={(e) => setOpeningCashInput(e.target.value)}
                                    placeholder="e.g. 2000"
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2.5 text-[#171717] font-black text-lg focus:outline-hidden focus:border-[#F97316] min-h-[46px]"
                                    required
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#57534E] block mb-1">
                                    Shift Notes / Station
                                </label>
                                <input
                                    type="text"
                                    value={shiftNotesInput}
                                    onChange={(e) => setShiftNotesInput(e.target.value)}
                                    placeholder="e.g. Terminal 1 morning shift"
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] text-xs focus:outline-hidden focus:border-[#F97316] min-h-[40px]"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowOpenShiftModal(false)}
                                    className="px-4 py-2 rounded-xl bg-stone-100 text-[#171717] text-xs font-semibold hover:bg-stone-200 border border-[#E7E5E4]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-xs"
                                >
                                    Confirm Open Shift
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: CASH MOVEMENT (IN / OUT) */}
            {showCashMovementModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-[#E7E5E4] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                        <h3 className="font-black text-[#171717] text-lg">
                            {cashMovementType === "CASH_IN" ? "Record Cash In (Float Addition)" : "Record Cash Out (Drop / Payout)"}
                        </h3>
                        <form onSubmit={handleCashMovement} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#57534E] block mb-1">Amount (₹)</label>
                                <input
                                    type="number"
                                    value={movementAmountInput}
                                    onChange={(e) => setMovementAmountInput(e.target.value)}
                                    placeholder="e.g. 500"
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2.5 text-[#171717] font-black text-lg focus:outline-hidden focus:border-[#F97316] min-h-[46px]"
                                    required
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#57534E] block mb-1">Reason / Notes</label>
                                <input
                                    type="text"
                                    value={movementReasonInput}
                                    onChange={(e) => setMovementReasonInput(e.target.value)}
                                    placeholder="e.g. Petty cash drop or extra float from safe"
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] text-xs focus:outline-hidden focus:border-[#F97316] min-h-[42px]"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCashMovementModal(false)}
                                    className="px-4 py-2 rounded-xl bg-stone-100 text-[#171717] text-xs font-semibold hover:bg-stone-200 border border-[#E7E5E4]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-xs"
                                >
                                    Record Movement
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: CLOSE SHIFT & CASH RECONCILIATION */}
            {showCloseShiftModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-[#E7E5E4] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                        <h3 className="font-black text-[#171717] text-lg flex items-center gap-2">
                            <Lock className="w-5 h-5 text-rose-600" />
                            Close & Reconcile Cashier Shift
                        </h3>
                        <p className="text-xs text-[#57534E]">
                            Count physical currency in the cash drawer. The system compares physical cash with expected sales and float movements.
                        </p>

                        <form data-testid="close-shift-form" onSubmit={handleCloseShift} className="space-y-4">
                            {/* Expected Cash Box */}
                            <div className="p-3.5 bg-stone-50 rounded-xl border border-[#E7E5E4] flex justify-between items-center text-xs">
                                <div>
                                    <span className="text-[#57534E] block font-semibold">Authoritative Expected Cash</span>
                                    <span className="text-[10px] text-[#78716C]">System calculated</span>
                                </div>
                                <span className="font-black text-[#171717] text-lg">₹{currentShift?.expectedCash || 0}</span>
                            </div>

                            {/* Actual Counted Input */}
                            <div>
                                <label className="text-xs font-bold text-[#57534E] block mb-1">
                                    Actual Physical Cash Counted (₹)
                                </label>
                                <input
                                    type="number"
                                    value={actualCashInput}
                                    onChange={(e) => setActualCashInput(e.target.value)}
                                    placeholder="Enter physical cash count"
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2.5 text-[#171717] font-black text-lg focus:outline-hidden focus:border-[#F97316] min-h-[46px]"
                                    required
                                    min="0"
                                />
                            </div>

                            {/* Live Variance Calculation Banner */}
                            {actualCashInput !== "" && (
                                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between font-bold ${
                                    Math.abs(closeShiftVariance) < 0.01
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                        : closeShiftVariance > 0
                                        ? "bg-amber-50 text-amber-800 border-amber-300"
                                        : "bg-rose-50 text-rose-800 border-rose-300"
                                }`}>
                                    <span>
                                        {Math.abs(closeShiftVariance) < 0.01
                                            ? "✓ Exact Match (Zero Variance)"
                                            : closeShiftVariance > 0
                                            ? "▲ Cash Surplus (Over)"
                                            : "▼ Cash Shortage (Short)"}
                                    </span>
                                    <span className="text-sm font-black">
                                        {closeShiftVariance > 0 ? `+₹${closeShiftVariance.toFixed(2)}` : `₹${closeShiftVariance.toFixed(2)}`}
                                    </span>
                                </div>
                            )}

                            {/* Variance Explanation Note (Mandatory if variance != 0) */}
                            {Math.abs(closeShiftVariance) > 0.01 && actualCashInput !== "" && (
                                <div>
                                    <label className="text-xs font-bold text-amber-800 block mb-1">
                                        Discrepancy Explanation (Required)
                                    </label>
                                    <input
                                        type="text"
                                        value={varianceReasonInput}
                                        onChange={(e) => setVarianceReasonInput(e.target.value)}
                                        placeholder="Explain reason for shortage or surplus..."
                                        className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-[#171717] text-xs focus:outline-hidden focus:border-amber-500 min-h-[42px]"
                                        required
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCloseShiftModal(false)}
                                    className="px-4 py-2 rounded-xl bg-stone-100 text-[#171717] text-xs font-semibold hover:bg-stone-200 border border-[#E7E5E4]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs"
                                >
                                    Confirm Settle & Close Shift
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: REQUEST MANAGER DISCOUNT APPROVAL */}
            {showDiscountModal && selectedOrder && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-[#E7E5E4] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                        <h3 className="font-black text-[#171717] text-lg flex items-center gap-2">
                            <Percent className="w-5 h-5 text-[#EA580C]" />
                            Request Manager Discount Approval
                        </h3>
                        <p className="text-xs text-[#57534E]">
                            Cashiers cannot apply manual discounts autonomously. An approval request will be dispatched to the Duty Manager in realtime.
                        </p>
                        <form onSubmit={handleRequestDiscount} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#57534E] block mb-1">
                                    Discount Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    value={discountAmountInput}
                                    onChange={(e) => setDiscountAmountInput(e.target.value)}
                                    placeholder="e.g. 100"
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2.5 text-[#171717] font-black text-lg focus:outline-hidden focus:border-[#F97316] min-h-[46px]"
                                    required
                                    min="1"
                                    max={getAuthoritativeTotal(selectedOrder)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#57534E] block mb-1">Reason</label>
                                <input
                                    type="text"
                                    value={discountReasonInput}
                                    onChange={(e) => setDiscountReasonInput(e.target.value)}
                                    placeholder="e.g. VIP guest concession / Special promo"
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] text-xs focus:outline-hidden focus:border-[#F97316] min-h-[42px]"
                                    required
                                />
                            </div>

                            {discountWaiting && (
                                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs flex items-center gap-2 animate-pulse">
                                    <Clock className="w-4 h-4 shrink-0" />
                                    <span>Waiting for Duty Manager to review and approve...</span>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDiscountModal(false)}
                                    disabled={discountWaiting}
                                    className="px-4 py-2 rounded-xl bg-stone-100 text-[#171717] text-xs font-semibold hover:bg-stone-200 border border-[#E7E5E4]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={discountWaiting}
                                    className="px-5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold disabled:opacity-50 shadow-xs"
                                >
                                    Send to Manager
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: SPLIT BILLING MODAL (Existing Tiffzy Split Billing Integration) */}
            {showSplitModal && selectedOrder && (
                <SplitBillingModal
                    isOpen={showSplitModal}
                    onClose={() => setShowSplitModal(false)}
                    session={selectedOrder.tableSession || {
                        id: selectedOrder.tableSessionId || selectedOrder.id,
                        tableId: selectedOrder.tableId,
                        tableNo: selectedOrder.tableNo,
                        orders: [selectedOrder],
                        total: getAuthoritativeTotal(selectedOrder),
                    }}
                    restaurantId={restaurantId}
                    onSessionUpdated={() => {
                        fetchLiveOrders();
                        fetchCurrentShift();
                        if (refreshTables) refreshTables();
                    }}
                />
            )}
        </StaffShell>
    );
}
