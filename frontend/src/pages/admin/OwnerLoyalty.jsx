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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="w-8 h-8" />
            <h1 className="text-2xl font-bold tracking-tight">Loyalty Points & Rewards Studio</h1>
          </div>
          <p className="text-orange-100 text-sm">
            Manage customer rewards, earning ratios, redemption thresholds, and ledger transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAdjustModalOpen(true)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-md px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Manual Points Adjustment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Loyalty Members</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
            {stats.activeAccounts} <span className="text-sm font-normal text-gray-400">/ {stats.totalAccounts}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Total registered customers in rewards program</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Points Issued</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Gift className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-600">
            +{stats.totalPointsIssued.toLocaleString()}
          </div>
          <p className="text-xs text-gray-400 mt-1">Lifetime points granted across all orders</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Points Redeemed</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-600">
            {stats.totalPointsRedeemed.toLocaleString()}
          </div>
          <p className="text-xs text-gray-400 mt-1">Lifetime points converted into discounts</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Balance</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-600">
            {stats.totalOutstandingBalance.toLocaleString()} <span className="text-xs font-medium text-gray-400">pts</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Current unspent points in customer balances</p>
        </div>
      </div>

      {/* Main Content: Config & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Panel */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-700">
            <Settings className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Program Configuration</h2>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-5">
            {/* Enable Program Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
              <div>
                <span className="font-semibold text-sm text-gray-900 dark:text-white">Enable Loyalty Rewards</span>
                <p className="text-xs text-gray-500">Allow earning and redeeming points</p>
              </div>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-5 h-5 accent-orange-500 rounded cursor-pointer"
              />
            </div>

            {/* Earning Ratio */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Points Earned per ₹100 Spent
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={Math.round(config.pointsPerCurrency * 100)}
                onChange={(e) => setConfig({ ...config, pointsPerCurrency: Number(e.target.value) / 100 })}
                className="w-full px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-semibold"
              />
              <p className="text-[11px] text-gray-400 mt-1">E.g., 10 points = 10 points per ₹100 spent</p>
            </div>

            {/* Redemption Value */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Redemption Value (₹ per 10 Points)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={config.currencyPerPoint * 10}
                onChange={(e) => setConfig({ ...config, currencyPerPoint: Number(e.target.value) / 10 })}
                className="w-full px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-semibold"
              />
              <p className="text-[11px] text-gray-400 mt-1">E.g., ₹1.00 = 10 points grant ₹1 discount</p>
            </div>

            {/* Minimum Points to Redeem */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Minimum Points Threshold to Redeem
              </label>
              <input
                type="number"
                step="10"
                min="0"
                value={config.minPointsToRedeem}
                onChange={(e) => setConfig({ ...config, minPointsToRedeem: Number(e.target.value) })}
                className="w-full px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-semibold"
              />
            </div>

            {/* Max Redeemable Subtotal % */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Max Redeemable Order Subtotal %
              </label>
              <input
                type="number"
                step="5"
                min="1"
                max="100"
                value={config.maxRedeemablePercent}
                onChange={(e) => setConfig({ ...config, maxRedeemablePercent: Number(e.target.value) })}
                className="w-full px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-semibold"
              />
              <p className="text-[11px] text-gray-400 mt-1">Max % of subtotal that can be paid with points</p>
            </div>

            {/* Stacking Rule */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
              <div>
                <span className="font-semibold text-xs text-gray-900 dark:text-white">Allow Coupon Stacking</span>
                <p className="text-[11px] text-gray-500">Combine points redemption with coupons</p>
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
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save Settings"}
            </button>
          </form>
        </div>

        {/* Ledger Transactions Table */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Loyalty Ledger History</h2>
              <p className="text-xs text-gray-500">Immutable audit log of all point balance changes</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-xl text-xs font-semibold">
              {["ALL", "EARN", "REDEEM", "MANUAL_CREDIT", "REFUND_REVERSAL"].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setHistoryType(t);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    historyType === t
                      ? "bg-white dark:bg-gray-800 text-orange-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loadingHistory ? (
            <div className="py-12 text-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading transactions...
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <Clock className="w-8 h-8 mx-auto text-gray-300" />
              <p className="font-medium">No loyalty transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="py-3 px-2">Date</th>
                    <th className="py-3 px-2">Customer</th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2 text-right">Points</th>
                    <th className="py-3 px-2 text-right">Balance</th>
                    <th className="py-3 px-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {history.map((txn) => {
                    const isPositive = txn.points > 0;
                    return (
                      <tr key={txn.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="py-3 px-2 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(txn.createdAt).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-2 font-medium text-gray-900 dark:text-white">
                          {txn.customer?.name || "Customer"}
                          <span className="block text-[11px] text-gray-400 font-normal">{txn.customer?.phone}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-full ${
                              txn.type === "EARN"
                                ? "bg-emerald-100 text-emerald-800"
                                : txn.type === "REDEEM"
                                ? "bg-purple-100 text-purple-800"
                                : txn.type.startsWith("MANUAL")
                                ? "bg-blue-100 text-blue-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {txn.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className={`py-3 px-2 font-bold text-right ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isPositive ? `+${txn.points}` : txn.points}
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                          {txn.balanceAfter}
                        </td>
                        <td className="py-3 px-2 text-xs text-gray-500 max-w-[200px] truncate" title={txn.description || ""}>
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
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Manual Points Adjustment</h3>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              {/* Customer Search */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Select Customer *
                </label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 rounded-xl">
                    <div>
                      <span className="font-bold text-sm text-orange-900 dark:text-orange-200">{selectedCustomer.name}</span>
                      <p className="text-xs text-orange-600">{selectedCustomer.phone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs text-orange-600 font-bold underline"
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
                      className="w-full px-3.5 py-2 pl-9 border border-gray-200 dark:border-gray-700 rounded-xl text-sm"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />

                    {customerResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {customerResults.map((cust) => (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setCustomerResults([]);
                            }}
                            className="w-full text-left p-2.5 hover:bg-orange-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                          >
                            <span className="font-semibold text-sm">{cust.name}</span>
                            <span className="block text-xs text-gray-400">{cust.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Adjustment Type */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustForm({ ...adjustForm, type: "MANUAL_CREDIT" })}
                  className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    adjustForm.type === "MANUAL_CREDIT"
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-600 border-gray-200"
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  Credit Points (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustForm({ ...adjustForm, type: "MANUAL_DEBIT" })}
                  className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    adjustForm.type === "MANUAL_DEBIT"
                      ? "bg-rose-500 text-white border-rose-500 shadow-md"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-600 border-gray-200"
                  }`}
                >
                  <MinusCircle className="w-4 h-4" />
                  Debit Points (-)
                </button>
              </div>

              {/* Points Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Points Amount *
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjustForm.points}
                  onChange={(e) => setAdjustForm({ ...adjustForm, points: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Reason for Adjustment * (Audit Log Requirement)
                </label>
                <textarea
                  rows="2"
                  placeholder="E.g., Customer support compensation for delayed order"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md"
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
