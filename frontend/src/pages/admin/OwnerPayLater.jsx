import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import {
  IndianRupee,
  Search,
  UserPlus,
  ArrowLeft,
  Calendar,
  PlusCircle,
  CheckCircle,
  FileText,
  User,
  Activity,
  History,
  AlertCircle,
  Coins,
  BellRing
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

export default function OwnerPayLater() {
  const { user } = useAuth();
  const { accountId } = useParams();
  const navigate = useNavigate();
  const restaurantId = Number(user?.restaurantId || 0);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // all | pending | paid

  // Add Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Detailed view
  const [accountDetails, setAccountDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Manual adjustment modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState("MANUAL_CREDIT"); // MANUAL_CREDIT | OFFLINE_REPAYMENT
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Reward points adjustment modal
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsDelta, setPointsDelta] = useState("");
  const [pointsSubmitting, setPointsSubmitting] = useState(false);

  // Send Late Dues Reminder modal
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("Overdue Payment Reminder");
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderSubmitting, setReminderSubmitting] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/owner/${restaurantId}/pay-later/customers`);
      setCustomers(res.data?.customers || []);
    } catch (err) {
      showToast({
        title: "Error",
        message: err.response?.data?.message || "Failed to load customers",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountDetails = async (id) => {
    try {
      setDetailsLoading(true);
      const res = await api.get(`/owner/${restaurantId}/pay-later/accounts/${id}/details`);
      setAccountDetails(res.data?.account || null);
      if (res.data?.account) {
        setReminderMsg(`Hi ${res.data.account.customer.name || "Customer"}, this is a reminder that you have an outstanding balance of ₹${toInr(res.data.account.pendingBalance)} at Cafe King. Please clear it at your earliest convenience.`);
      }
    } catch (err) {
      showToast({
        title: "Error",
        message: err.response?.data?.message || "Failed to load account ledger",
        variant: "error"
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (restaurantId) {
      if (accountId) {
        fetchAccountDetails(accountId);
      } else {
        fetchCustomers();
      }
    }
  }, [restaurantId, accountId]);

  const stats = useMemo(() => {
    const totalOutstanding = customers.reduce((sum, c) => sum + c.pendingBalance, 0);
    const activeCount = customers.length;
    return { totalOutstanding, activeCount };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery);
      
      if (!matchesSearch) return false;
      if (filterMode === "pending") return c.pendingBalance > 0;
      if (filterMode === "paid") return c.pendingBalance <= 0;
      return true;
    });
  }, [customers, searchQuery, filterMode]);

  const handleSearchCustomer = async (e) => {
    e.preventDefault();
    if (!searchPhone.trim()) return;

    try {
      setSearchLoading(true);
      setSearchError("");

      await api.post(`/owner/${restaurantId}/pay-later/customers`, { phone: searchPhone });
      showToast({
        title: "Success",
        message: "Customer added successfully",
        variant: "success"
      });
      setShowAddModal(false);
      setSearchPhone("");
      fetchCustomers();
    } catch (err) {
      setSearchError(err.response?.data?.message || "Customer not found or not registered with Tiffzy");
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePostAdjustment = async (e) => {
    e.preventDefault();
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) {
      showToast({
        title: "Validation Error",
        message: "Please enter an amount greater than zero",
        variant: "warning"
      });
      return;
    }

    try {
      setAdjustSubmitting(true);
      await api.post(`/owner/${restaurantId}/pay-later/customers/${accountDetails.customerId}/adjust`, {
        type: adjustType,
        amount,
        description: adjustDesc
      });

      showToast({
        title: "Adjustment Recorded",
        message: "Transaction logged successfully",
        variant: "success"
      });
      
      setShowAdjustModal(false);
      setAdjustAmount("");
      setAdjustDesc("");
      
      if (accountId) {
        fetchAccountDetails(accountId);
      }
    } catch (err) {
      showToast({
        title: "Error",
        message: err.response?.data?.message || "Failed to post adjustment",
        variant: "error"
      });
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleAdjustPoints = async (e) => {
    e.preventDefault();
    const points = Number(pointsDelta);
    if (Number.isNaN(points) || points === 0) {
      showToast({
        title: "Validation Error",
        message: "Please enter a valid points value (non-zero)",
        variant: "warning"
      });
      return;
    }

    try {
      setPointsSubmitting(true);
      await api.post(`/owner/${restaurantId}/pay-later/customers/${accountDetails.customerId}/points`, {
        points
      });

      showToast({
        title: "Points Adjusted",
        message: "Customer reward points updated",
        variant: "success"
      });
      
      setShowPointsModal(false);
      setPointsDelta("");
      
      if (accountId) {
        fetchAccountDetails(accountId);
      }
    } catch (err) {
      showToast({
        title: "Error",
        message: err.response?.data?.message || "Failed to adjust points",
        variant: "error"
      });
    } finally {
      setPointsSubmitting(false);
    }
  };

  const handleSendReminder = async (e) => {
    e.preventDefault();
    if (!reminderMsg.trim()) {
      showToast({
        title: "Validation Error",
        message: "Reminder message cannot be empty",
        variant: "warning"
      });
      return;
    }

    try {
      setReminderSubmitting(true);
      await api.post(`/owner/${restaurantId}/pay-later/customers/${accountDetails.customerId}/reminder`, {
        title: reminderTitle,
        message: reminderMsg
      });

      showToast({
        title: "Reminder Sent",
        message: "Notification sent successfully to the customer",
        variant: "success"
      });
      
      setShowReminderModal(false);
    } catch (err) {
      showToast({
        title: "Error",
        message: err.response?.data?.message || "Failed to send reminder",
        variant: "error"
      });
    } finally {
      setReminderSubmitting(false);
    }
  };

  // If in details route, render details view
  if (accountId) {
    if (detailsLoading) {
      return <div className="py-12 text-center theme-muted">Loading customer details...</div>;
    }

    if (!accountDetails) {
      return (
        <div className="py-12 text-center">
          <p className="theme-muted">Ledger account not found</p>
          <button onClick={() => navigate("/owner/pay-later")} className="mt-4 theme-button rounded-xl px-4 py-2 text-xs font-semibold">
            Back to Accounts
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
        <header className="flex items-center gap-3">
          <button
            onClick={() => navigate("/owner/pay-later")}
            className="theme-soft-button inline-flex h-10 w-10 items-center justify-center rounded-2xl"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="theme-muted text-xs font-semibold uppercase tracking-widest">Pay Later Account</p>
            <h2 className="text-2xl font-bold tracking-tight">{accountDetails.customer.name || "Customer Ledger"}</h2>
          </div>
        </header>

        {/* Customer Info Card */}
        <section className="theme-panel rounded-[32px] p-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-center">
          <div>
            <p className="theme-muted text-[10px] font-extrabold uppercase tracking-wide">Phone Number</p>
            <p className="font-semibold text-sm mt-1">{accountDetails.customer.phone}</p>
          </div>
          <div>
            <p className="theme-muted text-[10px] font-extrabold uppercase tracking-wide">Email</p>
            <p className="font-semibold text-sm mt-1">{accountDetails.customer.email || "—"}</p>
          </div>
          <div>
            <p className="theme-muted text-[10px] font-extrabold uppercase tracking-wide">Loyalty Balance</p>
            <p className="font-bold text-sm text-emerald-400 mt-1 flex items-center gap-1.5">
              <Coins size={14} />
              {accountDetails.customer.rewardPoints || 0} pts
            </p>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2 md:col-span-1">
            <button
              onClick={() => setShowPointsModal(true)}
              className="theme-soft-button inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <Coins size={13} />
              Add Points
            </button>
            {accountDetails.pendingBalance > 0 && (
              <button
                onClick={() => setShowReminderModal(true)}
                className="theme-soft-button inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-amber-200"
              >
                <BellRing size={13} />
                Remind Late Dues
              </button>
            )}
          </div>
        </section>

        {/* Balance Overview */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
            <p className="theme-muted text-xs font-extrabold uppercase tracking-wider">Outstanding Balance</p>
            <h3 className="mt-2 text-3xl font-extrabold text-amber-200">₹{toInr(accountDetails.pendingBalance)}</h3>
            <p className="theme-muted mt-2 text-xs">Total credit accumulated</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
            <p className="theme-muted text-xs font-extrabold uppercase tracking-wider">Total Borrowed</p>
            <h3 className="mt-2 text-3xl font-bold text-rose-300">₹{toInr(accountDetails.totalBorrowed)}</h3>
            <p className="theme-muted mt-2 text-xs">Lifetime credit taken</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
            <p className="theme-muted text-xs font-extrabold uppercase tracking-wider">Total Repaid</p>
            <h3 className="mt-2 text-3xl font-bold text-emerald-300">₹{toInr(accountDetails.totalPaid)}</h3>
            <p className="theme-muted mt-2 text-xs">Lifetime payment received</p>
          </div>
        </section>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setAdjustType("MANUAL_CREDIT");
              setShowAdjustModal(true);
            }}
            className="theme-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold"
          >
            <PlusCircle size={18} />
            Add Credit (Borrow)
          </button>
          <button
            onClick={() => {
              setAdjustType("OFFLINE_REPAYMENT");
              setShowAdjustModal(true);
            }}
            className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold"
          >
            <CheckCircle size={18} />
            Record Payment (Repay)
          </button>
        </div>

        {/* Ledger Transactions */}
        <section className="theme-panel rounded-[32px] p-6">
          <div className="flex items-center gap-2 mb-4">
            <History size={18} className="theme-accent-text" />
            <h3 className="text-lg font-bold">Transaction Ledger</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[11px] font-extrabold uppercase tracking-wider text-white/40">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Ref ID / Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {accountDetails.transactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center theme-muted">
                      No successful transactions found for this account.
                    </td>
                  </tr>
                ) : (
                  accountDetails.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition duration-150">
                      <td className="py-3.5 px-4 whitespace-nowrap theme-muted">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                            tx.type.includes("REPAYMENT")
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {tx.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate">
                        {tx.description || (tx.type === "ORDER_CREDIT" ? "Food Order Purchase" : "Manual Adjustment")}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-semibold whitespace-nowrap ${
                        tx.type.includes("REPAYMENT") ? "text-emerald-300" : "text-rose-300"
                      }`}>
                        {tx.type.includes("REPAYMENT") ? "-" : "+"}₹{toInr(tx.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {tx.orderId ? (
                          <div className="text-[11px] text-white/50">
                            <span className="font-semibold text-white">Order #{tx.order?.orderNo || tx.orderId}</span>
                            <div className="mt-0.5 opacity-80">
                              {tx.order?.items?.map(it => `${it.itemName} (${it.qty})`).join(", ")}
                            </div>
                          </div>
                        ) : tx.paymentReference ? (
                          <span className="font-mono text-xs text-white/50">{tx.paymentReference}</span>
                        ) : (
                          <span className="theme-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Adjust Balance Modal */}
        {showAdjustModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="theme-panel w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">
                  {adjustType === "MANUAL_CREDIT" ? "Add Credit (Borrow)" : "Record Repayment"}
                </h3>
                <button onClick={() => setShowAdjustModal(false)} className="text-white/40 hover:text-white">
                  Close
                </button>
              </div>

              <form onSubmit={handlePostAdjustment} className="space-y-4">
                <div>
                  <label className="theme-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="Enter amount in ₹"
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none font-semibold text-white"
                  />
                </div>

                <div>
                  <label className="theme-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Note / Description</label>
                  <textarea
                    value={adjustDesc}
                    onChange={(e) => setAdjustDesc(e.target.value)}
                    placeholder={adjustType === "MANUAL_CREDIT" ? "e.g., Additional food purchase" : "e.g., Cash repayment"}
                    rows={3}
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdjustModal(false)}
                    className="theme-soft-button rounded-xl px-4 py-2.5 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adjustSubmitting}
                    className="theme-button rounded-xl px-5 py-2.5 text-xs font-semibold"
                  >
                    {adjustSubmitting ? "Saving..." : "Confirm & Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Adjust Points Modal */}
        {showPointsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="theme-panel w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">Adjust Loyalty Points</h3>
                <button onClick={() => setShowPointsModal(false)} className="text-white/40 hover:text-white">
                  Close
                </button>
              </div>

              <form onSubmit={handleAdjustPoints} className="space-y-4">
                <div>
                  <label className="theme-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
                    Points Delta (Positive to add, Negative to deduct)
                  </label>
                  <input
                    type="number"
                    required
                    value={pointsDelta}
                    onChange={(e) => setPointsDelta(e.target.value)}
                    placeholder="e.g. 50 or -20"
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none font-semibold text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPointsModal(false)}
                    className="theme-soft-button rounded-xl px-4 py-2.5 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pointsSubmitting}
                    className="theme-button rounded-xl px-5 py-2.5 text-xs font-semibold"
                  >
                    {pointsSubmitting ? "Updating..." : "Save Points"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Late Due Reminder Modal */}
        {showReminderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="theme-panel w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">Send Due Intimation</h3>
                <button onClick={() => setShowReminderModal(false)} className="text-white/40 hover:text-white">
                  Close
                </button>
              </div>

              <form onSubmit={handleSendReminder} className="space-y-4">
                <div>
                  <label className="theme-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Reminder Title</label>
                  <input
                    type="text"
                    required
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    placeholder="Enter notification title"
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none font-semibold text-white"
                  />
                </div>

                <div>
                  <label className="theme-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">Reminder Message</label>
                  <textarea
                    required
                    value={reminderMsg}
                    onChange={(e) => setReminderMsg(e.target.value)}
                    rows={4}
                    placeholder="Enter notification message details..."
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(false)}
                    className="theme-soft-button rounded-xl px-4 py-2.5 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reminderSubmitting}
                    className="theme-button rounded-xl px-5 py-2.5 text-xs font-semibold"
                  >
                    {reminderSubmitting ? "Sending..." : "Send Intimation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="theme-muted text-xs font-semibold uppercase tracking-widest">Finance Management</p>
          <h2 className="text-3xl font-extrabold tracking-tight">Pay Later / Khata</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="theme-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
        >
          <UserPlus size={18} />
          Add Customer
        </button>
      </header>

      {/* Summary Row */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
          <p className="theme-muted text-xs font-extrabold uppercase tracking-wider">Total Outstanding Credit</p>
          <h3 className="mt-2 text-3xl font-extrabold text-amber-200">₹{toInr(stats.totalOutstanding)}</h3>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
          <p className="theme-muted text-xs font-extrabold uppercase tracking-wider">Approved Customers</p>
          <h3 className="mt-2 text-3xl font-bold">{stats.activeCount}</h3>
        </div>
      </section>

      {/* Filtering and Search Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="theme-input w-full rounded-2xl pl-10 pr-4 py-2.5 text-xs outline-none text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "paid"].map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border transition ${
                filterMode === mode
                  ? "bg-white/10 border-white/20 text-white"
                  : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Customers List in Table format */}
      <section className="theme-panel rounded-[32px] p-5">
        {loading ? (
          <div className="py-12 text-center theme-muted">Loading account data...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-12 text-center theme-muted">No credit accounts match the filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[11px] font-extrabold uppercase tracking-wider text-white/40">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Pending Balance</th>
                  <th className="py-3 px-4 text-center">Last Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCustomers.map((account) => (
                  <tr
                    key={account.id}
                    onClick={() => navigate(`/owner/pay-later/${account.id}`)}
                    className="hover:bg-white/5 transition duration-150 cursor-pointer"
                  >
                    <td className="py-4 px-4 font-bold text-[14px]">
                      {account.name}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-white/60">
                      {account.phone}
                    </td>
                    <td className="py-4 px-4">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-extrabold text-emerald-400 border border-emerald-500/20">
                        {account.status}
                      </span>
                    </td>
                    <td className={`py-4 px-4 text-right font-extrabold ${account.pendingBalance > 0 ? "text-amber-200" : "text-white/40"}`}>
                      ₹{toInr(account.pendingBalance)}
                    </td>
                    <td className="py-4 px-4 text-center text-xs theme-muted">
                      {formatDate(account.lastTransactionDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="theme-panel w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Approve Pay Later Customer</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchPhone("");
                  setSearchError("");
                }}
                className="text-white/40 hover:text-white"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSearchCustomer} className="space-y-4">
              <div>
                <label className="theme-muted mb-1.5 block text-xs font-semibold uppercase tracking-wider">
                  Customer Phone Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    placeholder="Enter phone (e.g. 917776432)"
                    className="theme-input flex-1 rounded-2xl px-4 py-3 text-sm outline-none text-white font-semibold"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="theme-button rounded-2xl px-5 font-semibold text-xs whitespace-nowrap"
                  >
                    {searchLoading ? "Adding..." : "Add Customer"}
                  </button>
                </div>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-xs text-rose-300">
                  <AlertCircle size={14} className="shrink-0" />
                  <p>{searchError}</p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
