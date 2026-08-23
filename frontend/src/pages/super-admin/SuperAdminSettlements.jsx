import { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  IndianRupee,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  TrendingUp,
  Webhook,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../utils/apiClient";

const CHART_COLORS = ["#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6"];

export default function SuperAdminSettlements() {
  const [activeTab, setActiveTab] = useState("payment-logs"); // payment-logs | webhook-logs | vendors
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get("/super-admin/settlements/summary");
      setSummary(res.data?.summary || null);
      setChartData(res.data?.chartData || []);
    } catch (err) {
      console.error("Failed to fetch admin settlement summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchPaymentLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get(
        `/super-admin/settlements/payment-logs?page=${page}&limit=15&search=${encodeURIComponent(search)}&status=${statusFilter}`
      );
      setPaymentLogs(res.data?.logs || []);
      setPagination(res.data?.pagination || { page: 1, limit: 15, totalCount: 0, totalPages: 1 });
    } catch (err) {
      console.error("Failed to fetch payment logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchWebhookLogs = async () => {
    try {
      const res = await api.get("/super-admin/settlements/webhook-logs");
      setWebhookLogs(res.data?.webhooks || []);
    } catch (err) {
      console.error("Failed to fetch webhook logs:", err);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await api.get("/super-admin/settlements/vendors");
      setVendors(res.data?.vendors || []);
    } catch (err) {
      console.error("Failed to fetch vendor details:", err);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchWebhookLogs();
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchPaymentLogs();
  }, [page, search, statusFilter]);

  const pieChartData = [
    { name: "Restaurant Share", value: summary?.restaurantSettlements || 0 },
    { name: "Tiffzy Commission", value: summary?.totalCommission || 0 },
    { name: "Pending", value: summary?.pendingSettlements || 0 },
    { name: "Failed", value: summary?.failedSettlements || 0 },
  ];

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-amber-400" />
            Admin Settlement Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Platform-wide Revenue, Tiffzy Commissions, Cashfree Easy Split settlements, and Webhook logs.
          </p>
        </div>

        <button
          onClick={() => {
            fetchSummary();
            fetchPaymentLogs();
            fetchWebhookLogs();
            fetchVendors();
          }}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg hover:bg-slate-800 transition flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Revenue */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ₹{loadingSummary ? "..." : (summary?.totalRevenue ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">Gross sales volume</p>
        </div>

        {/* Total Commission */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
          <div className="flex items-center justify-between text-slate-300 text-xs">
            <span>Total Commission</span>
            <IndianRupee className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">
            ₹{loadingSummary ? "..." : (summary?.totalCommission ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400">Tiffzy platform revenue</p>
        </div>

        {/* Restaurant Settlements */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <div className="flex items-center justify-between text-slate-300 text-xs">
            <span>Restaurant Share</span>
            <Store className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            ₹{loadingSummary ? "..." : (summary?.restaurantSettlements ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400">Easy Split payouts</p>
        </div>

        {/* Pending Settlements */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pending Payouts</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            ₹{loadingSummary ? "..." : (summary?.pendingSettlements ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">Unsettled orders</p>
        </div>

        {/* Failed Settlements */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Failed Settlements</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">
            ₹{loadingSummary ? "..." : (summary?.failedSettlements ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">Failed transactions</p>
        </div>

        {/* Refunds */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Refunds</span>
            <AlertCircle className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">
            ₹{loadingSummary ? "..." : (summary?.totalRefunds ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">Refunded orders</p>
        </div>
      </div>

      {/* Recharts Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Bar Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <h3 className="text-base font-bold text-slate-100">Revenue & Commission Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }}
                  formatter={(val) => `₹${val}`}
                />
                <Legend />
                <Bar dataKey="revenue" name="Total Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="commission" name="Tiffzy Commission" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Distribution Chart */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <h3 className="text-base font-bold text-slate-100">Settlement Share Breakdown</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }}
                  formatter={(val) => `₹${val}`}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabbed Log Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("payment-logs")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "payment-logs"
                ? "bg-amber-500 text-slate-950 shadow"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Payment Logs
          </button>
          <button
            onClick={() => setActiveTab("webhook-logs")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "webhook-logs"
                ? "bg-amber-500 text-slate-950 shadow"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Webhook Logs
          </button>
          <button
            onClick={() => setActiveTab("vendors")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "vendors"
                ? "bg-amber-500 text-slate-950 shadow"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Vendor Details
          </button>
        </div>

        {/* Tab 1: Payment Logs */}
        {activeTab === "payment-logs" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search order, invoice, customer, phone..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-9 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PAID">PAID</option>
                <option value="PENDING">PENDING</option>
                <option value="FAILED">FAILED</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Restaurant</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Gross Total</th>
                    <th className="py-3 px-4">Commission</th>
                    <th className="py-3 px-4">Restaurant Share</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Loading payment logs...
                      </td>
                    </tr>
                  ) : paymentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No payment log records found.
                      </td>
                    </tr>
                  ) : (
                    paymentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono font-semibold text-amber-400">
                          {log.orderNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {log.restaurantName}
                        </td>
                        <td className="py-3 px-4">
                          <div>{log.customerName}</div>
                          <div className="text-[10px] text-slate-500">{log.phone}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          ₹{log.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-purple-400">
                          ₹{log.commission.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-400">
                          ₹{log.settlementAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              log.paymentStatus === "PAID" || log.paymentStatus === "SUCCESS"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : log.paymentStatus === "FAILED"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {log.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
              <div>
                Showing <span className="font-semibold text-slate-200">{paymentLogs.length}</span> of{" "}
                <span className="font-semibold text-slate-200">{pagination.totalCount}</span> records
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || loadingLogs}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition"
                >
                  Previous
                </button>
                <span className="px-2 font-mono">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <button
                  disabled={page >= pagination.totalPages || loadingLogs}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Webhook Logs */}
        {activeTab === "webhook-logs" && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Webhook className="w-4 h-4 text-amber-400" />
              Recent Cashfree Webhook Events & Signature Verifications
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Restaurant</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Signature</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {webhookLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No webhook events logged yet.
                      </td>
                    </tr>
                  ) : (
                    webhookLogs.map((wh) => (
                      <tr key={wh.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono font-bold text-purple-400">
                          {wh.eventType}
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-400">{wh.orderId}</td>
                        <td className="py-3 px-4 text-slate-200">{wh.restaurantName}</td>
                        <td className="py-3 px-4 font-semibold text-slate-200">₹{wh.amount}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            <ShieldCheck className="w-3 h-3" />
                            {wh.signatureStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(wh.receivedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Vendor Details */}
        {activeTab === "vendors" && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-400" />
              Cashfree Easy Split Onboarded Restaurant Vendors
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Rest ID</th>
                    <th className="py-3 px-4">Restaurant Name</th>
                    <th className="py-3 px-4">Cashfree Vendor ID</th>
                    <th className="py-3 px-4">UPI / VPA</th>
                    <th className="py-3 px-4">Commission</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {vendors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No vendor accounts registered.
                      </td>
                    </tr>
                  ) : (
                    vendors.map((v) => (
                      <tr key={v.restaurantId} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-slate-400">#{v.restaurantId}</td>
                        <td className="py-3 px-4 font-bold text-slate-200">{v.name}</td>
                        <td className="py-3 px-4 font-mono text-amber-400">{v.vendorId}</td>
                        <td className="py-3 px-4 text-slate-300">{v.upi}</td>
                        <td className="py-3 px-4 text-purple-400 font-semibold">
                          {v.commissionValue}% ({v.commissionType})
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              v.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
