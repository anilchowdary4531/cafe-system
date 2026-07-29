import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { api } from "../../../utils/apiClient";
import { showToast } from "../../../utils/toast";
import {
  IndianRupee,
  ArrowLeft,
  Calendar,
  History,
  AlertCircle,
  TrendingUp,
  CreditCard,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const toInr = (val) => {
  const n = Number(val || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PayLaterDetailSection() {
  const { accountId } = useParams();
  const [searchParams] = useSearchParams();
  const forceCustomerMode = searchParams.get("scope") === "customer";
  const buildProfilePath = (path) => (forceCustomerMode ? `${path}?scope=customer` : path);

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  
  // Repayment Modal
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");
  const [repaySubmitting, setRepaySubmitting] = useState(false);

  // Expandable items state
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/customer/pay-later/accounts/${accountId}/details`);
      setAccount(res.data?.account || null);
    } catch (err) {
      showToast({
        title: "Error",
        message: err.response?.data?.message || "Failed to load account ledger",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchDetails();
    }
  }, [accountId]);

  const toggleOrderExpansion = (orderId) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleRepaySubmit = async (e) => {
    e.preventDefault();
    const amount = Number(repayAmount);
    if (!amount || amount <= 0) {
      showToast({
        title: "Validation Error",
        message: "Please enter an amount greater than zero",
        variant: "warning"
      });
      return;
    }

    if (amount > account.pendingBalance) {
      showToast({
        title: "Validation Error",
        message: `Repayment amount cannot exceed the pending balance (₹${account.pendingBalance})`,
        variant: "warning"
      });
      return;
    }

    try {
      setRepaySubmitting(true);
      
      // Load SDK
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        showToast({
          title: "Payment Error",
          message: "Failed to load payment gateway. Check internet connection.",
          variant: "error"
        });
        return;
      }

      // 1. Create repayment record and Razorpay order
      const res = await api.post(`/customer/pay-later/accounts/${accountId}/repay`, { amount });
      const { keyId, order } = res.data;

      // 2. Open Checkout
      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: account.restaurant.name,
        description: "Khata Credit Repayment",
        order_id: order.id,
        handler: async (response) => {
          try {
            showToast({
              title: "Payment Successful",
              message: "Verifying signature...",
              variant: "info"
            });

            // 3. Verify Payment
            await api.post(`/customer/pay-later/accounts/${accountId}/repay/verify`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });

            showToast({
              title: "Repayment Settled",
              message: `Payment of ₹${amount} successfully applied to your balance.`,
              variant: "success"
            });
            setShowRepayModal(false);
            setRepayAmount("");
            fetchDetails();
          } catch (verifyErr) {
            showToast({
              title: "Verification Failed",
              message: verifyErr.response?.data?.message || "Could not verify transaction",
              variant: "error"
            });
          }
        },
        prefill: {
          contact: account.customer.phone,
          email: account.customer.email || ""
        },
        theme: {
          color: "#10B981"
        },
        modal: {
          ondismiss: () => {
            setRepaySubmitting(false);
          }
        }
      };

      const rzpay = new window.Razorpay(options);
      rzpay.open();
    } catch (err) {
      showToast({
        title: "Error",
        message: err.response?.data?.message || "Repayment checkout failed",
        variant: "error"
      });
      setRepaySubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center theme-muted">Loading account details...</div>;
  }

  if (!account) {
    return (
      <div className="theme-panel rounded-[32px] p-8 text-center max-w-xl mx-auto">
        <AlertCircle size={44} className="mx-auto text-rose-300" />
        <h3 className="text-lg font-bold mt-4">Account not found</h3>
        <p className="theme-muted mt-2 text-sm">
          The requested credit account does not exist or you do not have permission to view it.
        </p>
        <Link
          to={buildProfilePath("/profile/pay-later")}
          className="theme-button mt-6 inline-block rounded-2xl px-5 py-3 font-semibold text-sm"
        >
          Back to Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      <header className="theme-panel rounded-[32px] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Restaurant Credit</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{account.restaurant.name}</h1>
          </div>
          {account.pendingBalance > 0 && (
            <button
              onClick={() => setShowRepayModal(true)}
              className="theme-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold"
            >
              <CreditCard size={18} />
              Pay Now
            </button>
          )}
        </div>
      </header>

      {/* Balance Summary Card */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
          <p className="theme-muted text-xs font-extrabold uppercase tracking-wider">Pending Balance</p>
          <h3 className="mt-2 text-3xl font-extrabold text-amber-200">₹{toInr(account.pendingBalance)}</h3>
          <p className="theme-muted mt-2 text-xs">Unpaid dues at this outlet</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
          <p className="theme-muted text-xs font-extrabold uppercase tracking-wider">Total Borrowed</p>
          <h3 className="mt-2 text-3xl font-bold text-rose-300">₹{toInr(account.totalBorrowed)}</h3>
          <p className="theme-muted mt-2 text-xs">Total food credit taken</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
          <p className="theme-muted text-xs font-extrabold uppercase tracking-wider">Total Repaid</p>
          <h3 className="mt-2 text-3xl font-bold text-emerald-300">₹{toInr(account.totalPaid)}</h3>
          <p className="theme-muted mt-2 text-xs">Dues repaid so far</p>
        </div>
      </section>

      {/* Transaction History Ledger */}
      <section className="theme-panel rounded-[32px] p-6">
        <div className="flex items-center gap-2 mb-4">
          <History size={18} className="theme-accent-text" />
          <h3 className="text-lg font-bold">Credit Ledger</h3>
        </div>

        <div className="space-y-3">
          {account.transactions.length === 0 ? (
            <p className="py-8 text-center theme-muted text-sm">No transaction history found.</p>
          ) : (
            account.transactions.map((tx) => {
              const isRepayment = tx.type.includes("REPAYMENT");
              const isExpanded = expandedOrders.has(tx.orderId);

              return (
                <div
                  key={tx.id}
                  className="rounded-2xl border border-white/5 bg-black/5 p-4 flex flex-col transition hover:bg-black/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide uppercase ${
                            isRepayment
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {tx.type.replace("_", " ")}
                        </span>
                        <span className="theme-muted text-xs">{formatDate(tx.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold">
                        {tx.description || (isRepayment ? "Credit Repayment" : "Food Order Purchase")}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className={`text-base font-extrabold ${isRepayment ? "text-emerald-300" : "text-rose-300"}`}>
                        {isRepayment ? "-" : "+"}₹{toInr(tx.amount)}
                      </p>
                      {tx.orderId && (
                        <button
                          onClick={() => toggleOrderExpansion(tx.orderId)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--app-accent)] underline decoration-dotted underline-offset-4"
                        >
                          {isExpanded ? (
                            <>
                              Hide details <ChevronUp size={11} />
                            </>
                          ) : (
                            <>
                              Show details <ChevronDown size={11} />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nested Order Details */}
                  {tx.orderId && isExpanded && tx.order && (
                    <div className="mt-3 border-t border-white/5 pt-3 space-y-2 text-xs">
                      <p className="font-bold text-white/70">Order ID: {tx.order.orderNo || tx.orderId}</p>
                      <div className="space-y-1">
                        {tx.order.items?.map((it) => (
                          <div key={it.id} className="flex justify-between items-center text-white/60">
                            <span>
                              {it.itemName} <strong className="text-white/40">x{it.qty}</strong>
                            </span>
                            <span>₹{toInr(it.price * it.qty)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Pay Now modal */}
      {showRepayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="theme-panel w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Repay Credit Balance</h3>
              <button
                onClick={() => setShowRepayModal(false)}
                className="text-white/40 hover:text-white"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleRepaySubmit} className="space-y-4">
              <div>
                <label className="theme-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
                  Repayment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={account.pendingBalance}
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder={`Max ₹${toInr(account.pendingBalance)}`}
                  className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none font-semibold text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRepayModal(false)}
                  className="theme-soft-button rounded-xl px-4 py-2.5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={repaySubmitting}
                  className="theme-button rounded-xl px-5 py-2.5 text-xs font-semibold disabled:opacity-60"
                >
                  {repaySubmitting ? "Loading Gateway..." : "Proceed to Pay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
