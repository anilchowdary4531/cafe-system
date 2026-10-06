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
    <div className="space-y-4 font-sans text-sm text-slate-900 pb-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
            <span>Finance & Payouts</span>
            <span>/</span>
            <span>Settlement Dashboard</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
            <IndianRupee className="w-5 h-5 text-orange-500" />
            Settlement & Earnings Breakdown
          </h1>
        </div>

        {/* Action Buttons & Range Selection */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Range Selector */}
          <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-lg p-0.5">
            <button
              onClick={() => {
                setRange("daily");
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                range === "daily" ? "bg-orange-500 text-white shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => {
                setRange("weekly");
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                range === "weekly" ? "bg-orange-500 text-white shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => {
                setRange("monthly");
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                range === "monthly" ? "bg-orange-500 text-white shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
          </div>

          {/* Download CSV */}
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200/80 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export CSV
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200/80 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            Export PDF
          </button>

          {/* Refresh */}
          <button
            onClick={() => {
              fetchSummary();
              fetchOrders();
            }}
            className="p-1.5 bg-white border border-slate-200/80 text-slate-700 rounded-lg hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          {error}
        </div>
      )}

      {/* Metrics Summary Row (Analytics Compact Line Style - No Dark Panels) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-3 border-b border-slate-100">
        {/* Today's Orders */}
        <div className="py-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Orders ({range})</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
            {loadingSummary ? "..." : summary?.todayOrders ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Orders Count</span>
        </div>

        {/* Total Earnings */}
        <div className="py-1">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Total Sales</span>
          <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">
            ₹{loadingSummary ? "..." : (summary?.totalEarnings ?? 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Gross Revenue</span>
        </div>

        {/* Commission */}
        <div className="py-1">
          <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Tiffzy Fee</span>
          <div className="text-lg font-bold text-purple-600 font-mono mt-0.5">
            ₹{loadingSummary ? "..." : (summary?.commission ?? 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Platform Fee</span>
        </div>

        {/* Net Settlement Amount */}
        <div className="py-1">
          <span className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Net Settlement</span>
          <div className="text-lg font-bold text-orange-600 font-mono mt-0.5">
            ₹{loadingSummary ? "..." : (summary?.settlementAmount ?? 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Net Payout Share</span>
        </div>

        {/* Paid Settlement */}
        <div className="py-1">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Paid Payouts</span>
          <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
            ₹{loadingSummary ? "..." : (summary?.paidSettlement ?? 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Settled to Bank</span>
        </div>

        {/* Pending Settlement */}
        <div className="py-1">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Pending Payouts</span>
          <div className="text-lg font-bold text-amber-600 font-mono mt-0.5">
            ₹{loadingSummary ? "..." : (summary?.pendingSettlement ?? 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Awaiting EasySplit</span>
        </div>
      </div>

      {/* Orders Settlement Table Section */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <IndianRupee size={14} className="text-orange-500" />
            Order Settlement Payout History
          </h2>

          {/* Status Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] font-semibold text-slate-500">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200/80 text-slate-900 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
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
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase text-[11px] font-bold border-b border-slate-100 tracking-wider">
                <th className="py-2.5 px-3.5">Order ID</th>
                <th className="py-2.5 px-3.5">Date</th>
                <th className="py-2.5 px-3.5">Customer</th>
                <th className="py-2.5 px-3.5 text-right">Gross Total</th>
                <th className="py-2.5 px-3.5 text-right">Commission</th>
                <th className="py-2.5 px-3.5 text-right">Net Share</th>
                <th className="py-2.5 px-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loadingOrders ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <RefreshCw size={20} className="animate-spin text-orange-500 mx-auto mb-1" />
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
                  <tr key={order.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3.5 font-mono font-bold text-orange-600">
                      {order.orderNo}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 text-xs">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="font-semibold text-slate-900">{order.customerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{order.phone}</div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                      ₹{order.total.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono text-purple-600 font-semibold">
                      -₹{order.commission.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-600">
                      ₹{order.settlementAmount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.paymentStatus === "PAID" || order.paymentStatus === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : order.paymentStatus === "FAILED"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
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
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-900">{orders.length}</span> of{" "}
            <span className="font-bold text-slate-900">{pagination.totalCount}</span> records
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loadingOrders}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-white border border-slate-200/80 rounded-lg hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            >
              Previous
            </button>
            <span className="px-2 font-mono text-slate-700 font-bold">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={page >= pagination.totalPages || loadingOrders}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 bg-white border border-slate-200/80 rounded-lg hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
