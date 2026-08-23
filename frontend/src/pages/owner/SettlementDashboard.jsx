import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  RefreshCw,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";

export default function SettlementDashboard() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId || user?.restaurant?.id || 1;

  const [range, setRange] = useState("daily"); // daily, weekly, monthly
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, PAID, PENDING, FAILED
  const [page, setPage] = useState(1);
  const limit = 10;

  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalCount: 0, totalPages: 1 });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState("");

  const fetchSummary = async () => {
    setLoadingSummary(true);
    setError("");
    try {
      const res = await api.get(`/owner/${restaurantId}/settlements/summary?range=${range}`);
      setSummary(res.data?.summary || null);
    } catch (err) {
      console.error("Failed to fetch settlement summary:", err);
      setError("Failed to load settlement metrics");
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await api.get(
        `/owner/${restaurantId}/settlements/orders?range=${range}&status=${statusFilter}&page=${page}&limit=${limit}`
      );
      setOrders(res.data?.orders || []);
      setPagination(res.data?.pagination || { page: 1, limit: 10, totalCount: 0, totalPages: 1 });
    } catch (err) {
      console.error("Failed to fetch settlement orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (restaurantId) {
      fetchSummary();
    }
  }, [restaurantId, range]);

  useEffect(() => {
    if (restaurantId) {
      fetchOrders();
    }
  }, [restaurantId, range, statusFilter, page]);

  const handleDownloadCsv = () => {
    const apiBaseUrl = import.meta.env.VITE_API_URL || "https://api.tiffzy.com";
    const downloadUrl = `${apiBaseUrl}/owner/${restaurantId}/settlements/export/csv?range=${range}`;
    window.open(downloadUrl, "_blank");
  };

  const handleDownloadPdf = () => {
    const apiBaseUrl = import.meta.env.VITE_API_URL || "https://api.tiffzy.com";
    const downloadUrl = `${apiBaseUrl}/owner/${restaurantId}/settlements/export/pdf?range=${range}`;
    window.open(downloadUrl, "_blank");
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto text-slate-100">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <IndianRupee className="w-7 h-7 text-amber-400" />
            Settlement Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Real-time breakdown of restaurant earnings, Tiffzy commissions, and Cashfree Easy Split payouts.
          </p>
        </div>

        {/* Action Buttons & Range Selection */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Range Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => {
                setRange("daily");
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                range === "daily" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => {
                setRange("weekly");
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                range === "weekly" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => {
                setRange("monthly");
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                range === "monthly" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Monthly
            </button>
          </div>

          {/* Download CSV */}
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 text-xs font-semibold transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download CSV
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 text-xs font-semibold transition"
          >
            <FileText className="w-4 h-4" />
            Download PDF
          </button>

          {/* Refresh */}
          <button
            onClick={() => {
              fetchSummary();
              fetchOrders();
            }}
            className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Today's Orders */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Today's Orders</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {loadingSummary ? "..." : summary?.todayOrders ?? 0}
          </div>
          <p className="text-[10px] text-slate-500">Orders placed today</p>
        </div>

        {/* Total Earnings */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Earnings</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ₹{loadingSummary ? "..." : (summary?.totalEarnings ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">Gross sales volume</p>
        </div>

        {/* Commission */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tiffzy Commission</span>
            <IndianRupee className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">
            ₹{loadingSummary ? "..." : (summary?.commission ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">Platform service fee</p>
        </div>

        {/* Net Settlement Amount */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <div className="flex items-center justify-between text-slate-300 text-xs">
            <span>Net Settlement</span>
            <IndianRupee className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            ₹{loadingSummary ? "..." : (summary?.settlementAmount ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400">Restaurant net share</p>
        </div>

        {/* Paid Settlement */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Paid Settlement</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ₹{loadingSummary ? "..." : (summary?.paidSettlement ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">Settled to bank</p>
        </div>

        {/* Pending Settlement */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pending Settlement</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            ₹{loadingSummary ? "..." : (summary?.pendingSettlement ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">Awaiting processing</p>
        </div>
      </div>

      {/* Orders Settlement Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            Order Settlement Details
          </h2>

          {/* Status Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Payments</option>
              <option value="PAID">Paid Only</option>
              <option value="PENDING">Pending Only</option>
              <option value="FAILED">Failed Only</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Gross Total</th>
                <th className="py-3 px-4">Commission</th>
                <th className="py-3 px-4">Net Share</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingOrders ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading order settlements...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No order settlement records found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-amber-400">
                      {order.orderNo}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div>{order.customerName}</div>
                      <div className="text-[10px] text-slate-500">{order.phone}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      ₹{order.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-purple-400">
                      -₹{order.commission.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      ₹{order.settlementAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          order.paymentStatus === "PAID" || order.paymentStatus === "SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : order.paymentStatus === "FAILED"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{orders.length}</span> of{" "}
            <span className="font-semibold text-slate-200">{pagination.totalCount}</span> records
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loadingOrders}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <span className="px-2 font-mono">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={page >= pagination.totalPages || loadingOrders}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
