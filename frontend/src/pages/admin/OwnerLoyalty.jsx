import React, { useState, useEffect } from "react";
import {
  Gift,
  Award,
  TrendingUp,
  Settings,
  UserCheck,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import { showToast } from "../../utils/toast";

export default function OwnerLoyalty() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAccounts: 0,
    activeAccounts: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    totalOutstandingBalance: 0,
  });

  const [config, setConfig] = useState({
    enabled: true,
    pointsPerCurrency: 0.1,
    currencyPerPoint: 0.1,
    minOrderSubtotalForEarn: 0,
    minPointsToRedeem: 100,
    maxRedeemablePercent: 20,
    allowCouponStacking: false,
    expiryEnabled: false,
    expiryDays: 365,
  });

  const [savingConfig, setSavingConfig] = useState(false);

  // History / Ledger state
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [historyType, setHistoryType] = useState("ALL");
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Adjust Modal state
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    customerId: "",
    points: 100,
    type: "MANUAL_CREDIT",
    reason: "",
  });
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  useEffect(() => {
    if (restaurantId) {
      fetchData();
    }
  }, [restaurantId]);

  useEffect(() => {
    if (restaurantId) {
      fetchHistory(page, historyType);
    }
  }, [restaurantId, page, historyType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, configRes] = await Promise.all([
        api.get(`/owner/${restaurantId}/loyalty/stats`),
        api.get(`/owner/${restaurantId}/loyalty/config`),
      ]);
      setStats(statsRes.data || statsRes);
      setConfig(configRes.data || configRes);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load loyalty details", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (p = 1, t = "ALL") => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/owner/${restaurantId}/loyalty/history`, {
        params: { page: p, limit: 15, type: t },
      });
      const data = res.data || res;
      setHistory(data.items || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      console.error("Fetch history error:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await api.put(`/owner/${restaurantId}/loyalty/config`, config);
      setConfig(res.data || res);
      showToast("Loyalty rewards settings updated successfully!", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save settings", "error");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSearchCustomer = async (query) => {
    setCustomerSearchQuery(query);
    if (!query || query.length < 2) {
      setCustomerResults([]);
      return;
    }
    setSearchingCustomer(true);
    try {
      const res = await api.get(`/owner/${restaurantId}/customers`, {
        params: { query, limit: 5 },
      });
      setCustomerResults(res.data?.customers || res.data || []);
    } catch (err) {
      console.error("Customer search error:", err);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer?.id) {
      showToast("Please search and select a customer", "error");
      return;
    }
    if (!adjustForm.reason.trim()) {
      showToast("Reason is required for manual points adjustment", "error");
      return;
    }

    setSubmittingAdjust(true);
    try {
      await api.post(`/owner/${restaurantId}/loyalty/adjust`, {
        customerId: selectedCustomer.id,
        points: Number(adjustForm.points),
        type: adjustForm.type,
        reason: adjustForm.reason,
      });

      showToast(`Successfully ${adjustForm.type === "MANUAL_CREDIT" ? "credited" : "debited"} points!`, "success");
      setAdjustModalOpen(false);
      setSelectedCustomer(null);
      setCustomerSearchQuery("");
      setAdjustForm({ customerId: "", points: 100, type: "MANUAL_CREDIT", reason: "" });

      fetchData();
      fetchHistory(1, historyType);
    } catch (err) {
      showToast(err?.response?.data?.message || "Adjustment failed", "error");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500 mb-3" />
        <p className="text-gray-500 font-medium">Loading Loyalty & Rewards Studio...</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-1 sm:px-5 sm:py-1.5 w-full space-y-3.5 text-[color:var(--app-text)] font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[color:var(--app-border)]/40 pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-orange-500" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--app-text)]">Loyalty Points & Rewards Studio</h1>
          </div>
          <p className="theme-muted text-xs">
            Manage customer rewards, earning ratios, redemption thresholds, and ledger transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAdjustModalOpen(true)}
            className="flex items-center gap-2 text-orange-500 hover:underline px-3.5 py-1.5 font-semibold text-xs transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Manual Points Adjustment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-[color:var(--app-border)]/40 pb-4">
        <div className="py-2">
          <div className="flex items-center justify-between theme-muted mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Loyalty Members</span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-[color:var(--app-text)]">
            {stats.activeAccounts} <span className="text-xs font-normal theme-muted">/ {stats.totalAccounts}</span>
          </div>
          <p className="text-[11px] theme-muted mt-0.5">Total registered customers in rewards program</p>
        </div>

        <div className="py-2">
          <div className="flex items-center justify-between theme-muted mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Points Issued</span>
            <div className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-blue-600">
            +{stats.totalPointsIssued.toLocaleString()}
          </div>
          <p className="text-[11px] theme-muted mt-0.5">Lifetime points granted across all orders</p>
        </div>

        <div className="py-2">
          <div className="flex items-center justify-between theme-muted mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Points Redeemed</span>
            <div className="p-1.5 bg-purple-500/10 text-purple-600 rounded-lg">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-purple-600">
            {stats.totalPointsRedeemed.toLocaleString()}
          </div>
          <p className="text-[11px] theme-muted mt-0.5">Lifetime points converted into discounts</p>
        </div>

        <div className="py-2">
          <div className="flex items-center justify-between theme-muted mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Outstanding Balance</span>
            <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-amber-600">
            {stats.totalOutstandingBalance.toLocaleString()} <span className="text-xs font-medium theme-muted">pts</span>
          </div>
          <p className="text-[11px] theme-muted mt-0.5">Current unspent points in customer balances</p>
        </div>
      </div>

      {/* Main Content: Config & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-[color:var(--app-border)]/40">
            <Settings className="w-4 h-4 text-orange-500" />
            <h2 className="text-base font-bold text-[color:var(--app-text)]">Program Configuration</h2>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-3">
            {/* Enable Program Toggle */}
            <div className="flex items-center justify-between py-2 border-b border-[color:var(--app-border)]/30">
              <div>
                <span className="font-semibold text-xs text-[color:var(--app-text)]">Enable Loyalty Rewards</span>
                <p className="text-[11px] theme-muted">Allow earning and redeeming points</p>
              </div>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
              />
            </div>

            {/* Earning Ratio */}
            <div>
              <label className="block text-xs font-semibold text-[color:var(--app-text)] mb-1">
                Points Earned per ₹100 Spent
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={Math.round(config.pointsPerCurrency * 100)}
                onChange={(e) => setConfig({ ...config, pointsPerCurrency: Number(e.target.value) / 100 })}
                className="w-full px-3 py-1.5 border-b border-[color:var(--app-border)]/60 bg-transparent text-xs font-semibold text-[color:var(--app-text)] outline-none focus:border-amber-500"
              />
              <p className="text-[11px] theme-muted mt-0.5">E.g., 10 points = 10 points per ₹100 spent</p>
            </div>

            {/* Redemption Value */}
            <div>
              <label className="block text-xs font-semibold text-[color:var(--app-text)] mb-1">
                Redemption Value (₹ per 10 Points)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={config.currencyPerPoint * 10}
                onChange={(e) => setConfig({ ...config, currencyPerPoint: Number(e.target.value) / 10 })}
                className="w-full px-3 py-1.5 border-b border-[color:var(--app-border)]/60 bg-transparent text-xs font-semibold text-[color:var(--app-text)] outline-none focus:border-amber-500"
              />
              <p className="text-[11px] theme-muted mt-0.5">E.g., ₹1.00 = 10 points grant ₹1 discount</p>
            </div>

            {/* Minimum Points to Redeem */}
            <div>
              <label className="block text-xs font-semibold text-[color:var(--app-text)] mb-1">
                Minimum Points Threshold to Redeem
              </label>
              <input
                type="number"
                step="10"
                min="0"
                value={config.minPointsToRedeem}
                onChange={(e) => setConfig({ ...config, minPointsToRedeem: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border-b border-[color:var(--app-border)]/60 bg-transparent text-xs font-semibold text-[color:var(--app-text)] outline-none focus:border-amber-500"
              />
            </div>

            {/* Max Redeemable Subtotal % */}
            <div>
              <label className="block text-xs font-semibold text-[color:var(--app-text)] mb-1">
                Max Redeemable Order Subtotal %
              </label>
              <input
                type="number"
                step="5"
                min="1"
                max="100"
                value={config.maxRedeemablePercent}
                onChange={(e) => setConfig({ ...config, maxRedeemablePercent: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border-b border-[color:var(--app-border)]/60 bg-transparent text-xs font-semibold text-[color:var(--app-text)] outline-none focus:border-amber-500"
              />
              <p className="text-[11px] theme-muted mt-0.5">Max % of subtotal that can be paid with points</p>
            </div>

            {/* Stacking Rule */}
            <div className="flex items-center justify-between py-2 border-b border-[color:var(--app-border)]/30">
              <div>
                <span className="font-semibold text-xs text-[color:var(--app-text)]">Allow Coupon Stacking</span>
                <p className="text-[11px] theme-muted">Combine points redemption with coupons</p>
              </div>
              <input
                type="checkbox"
                checked={config.allowCouponStacking}
                onChange={(e) => setConfig({ ...config, allowCouponStacking: e.target.checked })}
                className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save Settings"}
            </button>
          </form>
        </div>

        {/* Ledger Transactions Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-[color:var(--app-border)]/40">
            <div>
              <h2 className="text-base font-bold text-[color:var(--app-text)]">Loyalty Ledger History</h2>
              <p className="text-xs theme-muted">Immutable audit log of all point balance changes</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 text-xs font-semibold">
              {["ALL", "EARN", "REDEEM", "MANUAL_CREDIT", "REFUND_REVERSAL"].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setHistoryType(t);
                    setPage(1);
                  }}
                  className={`px-2 py-1 transition-all border-b-2 ${
                    historyType === t
                      ? "border-orange-500 text-orange-500 font-bold"
                      : "border-transparent theme-muted hover:text-[color:var(--app-text)]"
                  }`}
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loadingHistory ? (
            <div className="py-10 text-center theme-muted">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading transactions...
            </div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center theme-muted space-y-2">
              <Clock className="w-7 h-7 mx-auto opacity-50" />
              <p className="font-medium text-xs">No loyalty transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="font-bold uppercase tracking-wider theme-muted border-b border-[color:var(--app-border)]/40">
                    <th className="py-2.5 px-2">Date</th>
                    <th className="py-2.5 px-2">Customer</th>
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 px-2 text-right">Points</th>
                    <th className="py-2.5 px-2 text-right">Balance</th>
                    <th className="py-2.5 px-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--app-border)]/30">
                  {history.map((txn) => {
                    const isPositive = txn.points > 0;
                    return (
                      <tr key={txn.id} className="hover:bg-[color:var(--app-surface)]/30 transition-colors">
                        <td className="py-2.5 px-2 text-[11px] theme-muted whitespace-nowrap">
                          {new Date(txn.createdAt).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-2 font-medium text-[color:var(--app-text)]">
                          {txn.customer?.name || "Customer"}
                          <span className="block text-[10px] theme-muted font-normal">{txn.customer?.phone}</span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              txn.type === "EARN"
                                ? "bg-emerald-500/15 text-emerald-600"
                                : txn.type === "REDEEM"
                                ? "bg-purple-500/15 text-purple-600"
                                : txn.type.startsWith("MANUAL")
                                ? "bg-blue-500/15 text-blue-600"
                                : "bg-rose-500/15 text-rose-600"
                            }`}
                          >
                            {txn.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className={`py-2.5 px-2 font-bold text-right ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isPositive ? `+${txn.points}` : txn.points}
                        </td>
                        <td className="py-2.5 px-2 text-right font-semibold text-[color:var(--app-text)]">
                          {txn.balanceAfter}
                        </td>
                        <td className="py-2.5 px-2 text-xs theme-muted max-w-[200px] truncate" title={txn.description || ""}>
                          {txn.description || "--"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2.5 border-t border-[color:var(--app-border)]/40">
              <span className="text-xs theme-muted">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1 disabled:opacity-50 theme-muted hover:text-[color:var(--app-text)]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1 disabled:opacity-50 theme-muted hover:text-[color:var(--app-text)]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Points Adjustment Modal */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="theme-panel rounded-2xl max-w-md w-full p-5 space-y-3.5 border border-[color:var(--app-border)] shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/50 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <h3 className="text-base font-bold text-[color:var(--app-text)]">Manual Points Adjustment</h3>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="theme-muted hover:text-[color:var(--app-text)] font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              {/* Customer Search */}
              <div>
                <label className="block text-xs font-semibold text-[color:var(--app-text)] mb-1">
                  Select Customer *
                </label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-2.5 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <div>
                      <span className="font-bold text-xs text-orange-600 dark:text-orange-300">{selectedCustomer.name}</span>
                      <p className="text-[11px] text-orange-500">{selectedCustomer.phone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs text-orange-500 font-bold underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search customer by name or phone..."
                      value={customerSearchQuery}
                      onChange={(e) => handleSearchCustomer(e.target.value)}
                      className="w-full px-3 py-1.5 pl-8 border border-[color:var(--app-border)] rounded-lg bg-[color:var(--app-bg)] text-xs text-[color:var(--app-text)] outline-none focus:border-amber-500"
                    />
                    <Search className="w-3.5 h-3.5 theme-muted absolute left-2.5 top-2.5" />

                    {customerResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 theme-panel border border-[color:var(--app-border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {customerResults.map((cust) => (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setCustomerResults([]);
                            }}
                            className="w-full text-left p-2 hover:bg-[color:var(--app-bg)] border-b border-[color:var(--app-border)]/30 last:border-0"
                          >
                            <span className="font-semibold text-xs text-[color:var(--app-text)]">{cust.name}</span>
                            <span className="block text-[11px] theme-muted">{cust.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Adjustment Type */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustForm({ ...adjustForm, type: "MANUAL_CREDIT" })}
                  className={`p-2 rounded-lg border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    adjustForm.type === "MANUAL_CREDIT"
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                      : "bg-[color:var(--app-bg)] theme-muted border-[color:var(--app-border)]"
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Credit Points (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustForm({ ...adjustForm, type: "MANUAL_DEBIT" })}
                  className={`p-2 rounded-lg border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    adjustForm.type === "MANUAL_DEBIT"
                      ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                      : "bg-[color:var(--app-bg)] theme-muted border-[color:var(--app-border)]"
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  Debit Points (-)
                </button>
              </div>

              {/* Points Amount */}
              <div>
                <label className="block text-xs font-semibold text-[color:var(--app-text)] mb-1">
                  Points Amount *
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjustForm.points}
                  onChange={(e) => setAdjustForm({ ...adjustForm, points: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[color:var(--app-border)] rounded-lg bg-[color:var(--app-bg)] text-xs font-bold text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-[color:var(--app-text)] mb-1">
                  Reason for Adjustment * (Audit Log Requirement)
                </label>
                <textarea
                  rows="2"
                  placeholder="E.g., Customer support compensation for delayed order"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[color:var(--app-border)] rounded-lg bg-[color:var(--app-bg)] text-xs text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="flex-1 px-3 py-2 border border-[color:var(--app-border)] rounded-lg font-semibold text-xs theme-muted hover:text-[color:var(--app-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg font-bold text-xs shadow-xs"
                >
                  {submittingAdjust ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "Submit Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
