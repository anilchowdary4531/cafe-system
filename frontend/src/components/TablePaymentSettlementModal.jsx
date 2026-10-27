import React, { useState, useMemo, useEffect } from "react";
import { CheckCircle2, Printer, X, Loader2, AlertCircle, QrCode } from "lucide-react";
import { api } from "../utils/apiClient";
import {
    buildReceiptPrintMarkup,
    printReceiptWindow,
    formatReceiptAmount,
    getReceiptOrderTotal,
} from "../utils/receiptPrinter";
import tiffzyLogo from "../assets/tiffzy-logo.png";

/**
 * TablePaymentSettlementModal
 * Complete payment-settlement flow for Server Station table cards.
 * Supports Cash and UPI settlement with authoritative amount validation,
 * duplicate protection, instant print-bill preview, and real-time refresh.
 */
export default function TablePaymentSettlementModal({
    isOpen,
    onClose,
    table,
    restaurantId,
    serverName = "",
    restaurantInfo = null,
    onSettled,
}) {
    const [selectedMethod, setSelectedMethod] = useState(null); // "CASH" | "UPI" | null
    const [upiReference, setUpiReference] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [settledResult, setSettledResult] = useState(null);
    const [backendBill, setBackendBill] = useState(null);
    const [loadingBill, setLoadingBill] = useState(false);

    const tableNo = table?.tableNo || table?.label || "--";
    const effectiveServerName =
        serverName ||
        table?.assignedWaiterName ||
        table?.activeSession?.waiterName ||
        "Staff";

    // Fallback amount from passed table object
    const initialOrders = useMemo(() => {
        if (!table) return [];
        return Array.isArray(table.activeOrders) ? table.activeOrders : [];
    }, [table]);

    const initialBillAmount = useMemo(() => {
        if (!table) return 0;
        if (initialOrders.length > 0) {
            return initialOrders.reduce((sum, order) => sum + getReceiptOrderTotal(order), 0);
        }
        return Number(table.activeSession?.total || table.payableAmount || table.total || 0);
    }, [table, initialOrders]);

    // Fetch authoritative bill directly from backend to ensure 100% authoritative sync
    useEffect(() => {
        if (!isOpen || !table || !restaurantId) {
            setBackendBill(null);
            setLoadingBill(false);
            return;
        }

        let isMounted = true;
        const fetchBill = async () => {
            if (initialBillAmount <= 0) {
                setLoadingBill(true);
            }
            try {
                const res = await api.get(
                    `/owner/${restaurantId}/tables/${encodeURIComponent(tableNo)}/bill`,
                    { params: { tableId: table.id || undefined } }
                );
                if (!isMounted) return;
                if (res?.data && typeof res.data === "object") {
                    setBackendBill(res.data);
                }
            } catch (err) {
                console.warn("[TablePaymentSettlementModal] Authoritative bill fetch warning:", err?.message);
                if (isMounted) {
                    setBackendBill({ authoritativeTotal: initialBillAmount, orders: initialOrders });
                }
            } finally {
                if (isMounted) {
                    setLoadingBill(false);
                }
            }
        };

        fetchBill();

        return () => {
            isMounted = false;
        };
    }, [isOpen, table?.id, tableNo, restaurantId, initialBillAmount, initialOrders]);

    // Canonical Authoritative Bill Amount resolution
    const authoritativeBillAmount = useMemo(() => {
        if (backendBill) {
            if (backendBill.authoritativeTotal !== undefined && backendBill.authoritativeTotal !== null) {
                return Number(backendBill.authoritativeTotal) || 0;
            }
            if (backendBill.total !== undefined && backendBill.total !== null) {
                return Number(backendBill.total) || 0;
            }
            if (backendBill.amount !== undefined && backendBill.amount !== null) {
                return Number(backendBill.amount) || 0;
            }
        }
        return initialBillAmount;
    }, [backendBill, initialBillAmount]);

    const isBillLoading = loadingBill || (isOpen && initialBillAmount <= 0 && backendBill === null);

    const activeOrders = useMemo(() => {
        if (Array.isArray(backendBill?.orders) && backendBill.orders.length > 0) {
            return backendBill.orders;
        }
        return initialOrders;
    }, [backendBill, initialOrders]);

    if (!isOpen || !table) return null;

    const restaurantUpiId = restaurantInfo?.upiId || "";
    const effectiveRestaurantName = restaurantInfo?.name || "Tiffzy Restaurant";

    // Dynamic UPI Intent URI for QR code generation if UPI ID is present
    const upiQrUri = restaurantUpiId
        ? `upi://pay?pa=${encodeURIComponent(restaurantUpiId)}&pn=${encodeURIComponent(effectiveRestaurantName)}&am=${authoritativeBillAmount.toFixed(2)}&tn=${encodeURIComponent(`Table ${tableNo} Bill`)}`
        : "";

    const handleSelectMethod = (method) => {
        if (isSubmitting || settledResult) return;
        setSelectedMethod(method);
        setErrorMessage("");
    };

    const handleConfirmPayment = async () => {
        if (!selectedMethod || isSubmitting || isBillLoading) return;

        if (authoritativeBillAmount <= 0) {
            setErrorMessage("Unable to load the authoritative bill amount. Please refresh and try again.");
            return;
        }

        setIsSubmitting(true);
        setErrorMessage("");

        try {
            const res = await api.post(
                `/owner/${restaurantId}/tables/${encodeURIComponent(tableNo)}/settle-bill`,
                {
                    tableId: table.id || null,
                    paymentMode: selectedMethod,
                    changedByName: effectiveServerName,
                    reference: upiReference.trim() || null,
                    amount: authoritativeBillAmount,
                }
            );

            const data = res.data;
            if (data?.cleared === false && !data?.alreadySettled) {
                setErrorMessage(data?.message || "Table has no active bill to settle.");
                setIsSubmitting(false);
                return;
            }

            const result = {
                tableNo,
                amount: authoritativeBillAmount,
                paymentMode: selectedMethod,
                reference: upiReference.trim(),
                orders: data?.orders?.length > 0 ? data.orders : activeOrders,
                restaurant: data?.restaurant || restaurantInfo,
                serverName: effectiveServerName,
            };

            setSettledResult(result);
            if (typeof onSettled === "function") {
                onSettled(result);
            }
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to settle payment. Please try again.";
            setErrorMessage(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintBill = () => {
        const result = settledResult || {
            tableNo,
            amount: authoritativeBillAmount,
            paymentMode: selectedMethod || "CASH",
            reference: upiReference,
            orders: activeOrders,
            restaurant: restaurantInfo,
            serverName: effectiveServerName,
        };

        const markup = buildReceiptPrintMarkup({
            restaurantName: result.restaurant?.name || effectiveRestaurantName,
            restaurantAddress: result.restaurant?.address || "",
            restaurantPhone: result.restaurant?.phone || "",
            tableLabel: String(result.tableNo || tableNo),
            serverName: result.serverName || effectiveServerName,
            activeOrders: result.orders || activeOrders,
            tableReceiptTotal: result.amount || authoritativeBillAmount,
            logoUrl: result.restaurant?.logoUrl || tiffzyLogo,
            paymentMode: result.paymentMode || "CASH",
            paymentStatus: "PAID",
            referenceNo: result.reference || "",
        });

        printReceiptWindow({
            markup,
            onBlocked: () => {
                alert("Pop-up blocked! Please allow pop-ups for this site to print receipts.");
            },
        });
    };

    const handleClose = () => {
        if (isSubmitting) return;
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            data-testid="settle-payment-modal"
            role="dialog"
            aria-modal="true"
        >
            <div className="relative w-full max-w-md bg-[color:var(--app-card,#ffffff)] dark:bg-slate-900 border border-[color:var(--app-border,#e2e8f0)] dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--app-border,#e2e8f0)] dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                    <div>
                        <h2 className="text-lg font-bold text-[color:var(--app-text,#0f172a)] dark:text-white flex items-center gap-2">
                            <span>💳</span> {settledResult ? "Payment Settled" : "Settle Payment"}
                        </h2>
                        <p className="text-xs theme-muted mt-0.5">
                            Table <strong className="text-slate-800 dark:text-slate-200">{tableNo}</strong> • Server:{" "}
                            <strong className="text-slate-800 dark:text-slate-200">{effectiveServerName}</strong>
                        </p>
                    </div>
                    {!isSubmitting && (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Error Alert */}
                    {errorMessage && (
                        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" />
                            <div className="flex-1">{errorMessage}</div>
                        </div>
                    )}

                    {settledResult ? (
                        /* SUCCESS STATE */
                        <div className="py-2 text-center space-y-5" data-testid="settlement-success-view">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>

                            <div>
                                <h3 className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
                                    ✓ Payment Successful
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Table {tableNo} has been released and marked AVAILABLE.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-left space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Table:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">Table {tableNo}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Amount Paid:</span>
                                    <span className="font-extrabold text-base text-slate-900 dark:text-white">
                                        {formatReceiptAmount(settledResult.amount)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Payment Method:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {settledResult.paymentMode}
                                    </span>
                                </div>
                                {settledResult.reference && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Reference / UTR:</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-300">
                                            {settledResult.reference}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 flex flex-col sm:flex-row gap-3">
                                <button
                                    type="button"
                                    onClick={handlePrintBill}
                                    className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition"
                                    data-testid="print-bill-btn"
                                >
                                    <Printer className="w-4 h-4" /> Print Bill
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md transition"
                                    data-testid="settlement-done-btn"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* SETTLEMENT FORM */
                        <>
                            {/* Bill Amount Display */}
                            <div className="p-4 rounded-xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 text-center">
                                <span className="text-xs uppercase tracking-wider font-semibold text-orange-600 dark:text-orange-400">
                                    Authoritative Bill Amount
                                </span>
                                <div
                                    className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1"
                                    data-testid="modal-bill-amount"
                                >
                                    {isBillLoading ? (
                                        <span className="text-base font-medium text-slate-500 flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                            Loading bill amount...
                                        </span>
                                    ) : (
                                        formatReceiptAmount(authoritativeBillAmount)
                                    )}
                                </div>
                                {!isBillLoading && activeOrders.length > 0 && (
                                    <p className="text-[11px] theme-muted mt-1">
                                        {activeOrders.length} order(s) included on this bill
                                    </p>
                                )}
                            </div>

                            {/* Payment Method Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                                    Payment Method
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* CASH Option */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectMethod("CASH")}
                                        disabled={isSubmitting}
                                        data-testid="payment-method-cash"
                                        className={`p-4 rounded-xl border-2 text-left transition relative flex flex-col items-center justify-center gap-2 ${
                                            selectedMethod === "CASH"
                                                ? "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500/20 shadow-md"
                                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                        }`}
                                    >
                                        <span className="text-3xl">💵</span>
                                        <span className="font-extrabold text-sm">CASH</span>
                                        {selectedMethod === "CASH" && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                                                ✓ Selected
                                            </span>
                                        )}
                                    </button>

                                    {/* UPI Option */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectMethod("UPI")}
                                        disabled={isSubmitting}
                                        data-testid="payment-method-upi"
                                        className={`p-4 rounded-xl border-2 text-left transition relative flex flex-col items-center justify-center gap-2 ${
                                            selectedMethod === "UPI"
                                                ? "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500/20 shadow-md"
                                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                        }`}
                                    >
                                        <span className="text-3xl">📱</span>
                                        <span className="font-extrabold text-sm">UPI</span>
                                        {selectedMethod === "UPI" && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                                                ✓ Selected
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* CASH-specific details if CASH selected */}
                            {selectedMethod === "CASH" && (
                                <div
                                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 animate-fadeIn"
                                    data-testid="cash-details-section"
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            💵 Cash Collection
                                        </span>
                                        <span className="font-mono text-xs font-semibold text-orange-600 dark:text-orange-400">
                                            {isBillLoading ? "Loading..." : formatReceiptAmount(authoritativeBillAmount)}
                                        </span>
                                    </div>
                                    <p className="text-[11px] theme-muted">
                                        Collect exact cash of <strong className="text-slate-800 dark:text-slate-200">{isBillLoading ? "..." : formatReceiptAmount(authoritativeBillAmount)}</strong> from customer, then confirm settlement below.
                                    </p>
                                </div>
                            )}

                            {/* UPI-specific details if UPI selected */}
                            {selectedMethod === "UPI" && (
                                <div
                                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-fadeIn"
                                    data-testid="upi-details-section"
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <QrCode className="w-3.5 h-3.5 text-orange-500" /> UPI Collection
                                        </span>
                                        {restaurantUpiId && (
                                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                                {restaurantUpiId}
                                            </span>
                                        )}
                                    </div>

                                    {restaurantUpiId ? (
                                        <div className="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(upiQrUri)}`}
                                                alt="UPI QR Code"
                                                className="w-16 h-16 rounded border border-slate-200 flex-shrink-0"
                                            />
                                            <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                                                <p className="font-bold">Scan to Pay via any UPI App</p>
                                                <p className="theme-muted text-[10px]">GPay • PhonePe • Paytm</p>
                                                <p className="font-mono text-orange-600 dark:text-orange-400 font-semibold">
                                                    ₹{authoritativeBillAmount.toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] theme-muted">
                                            Collect payment via restaurant counter UPI / QR, then confirm below.
                                        </p>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                                            Transaction ID / UTR (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={upiReference}
                                            onChange={(e) => setUpiReference(e.target.value)}
                                            placeholder="e.g. 4289XXXXXXXX"
                                            disabled={isSubmitting}
                                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                                            data-testid="upi-reference-input"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Footer Buttons */}
                            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[color:var(--app-border,#e2e8f0)] dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isSubmitting}
                                    className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition disabled:opacity-50"
                                    data-testid="cancel-settlement-btn"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPayment}
                                    disabled={!selectedMethod || isSubmitting || isBillLoading || authoritativeBillAmount <= 0}
                                    className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-orange-500/25 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500"
                                    data-testid="confirm-payment-btn"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Settling Payment...
                                        </>
                                    ) : (
                                        `Confirm Payment (${selectedMethod || "Select Method"})`
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
