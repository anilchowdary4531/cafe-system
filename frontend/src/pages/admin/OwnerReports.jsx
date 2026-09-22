import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart3,
  Calendar,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  IndianRupee,
  Layers,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  TableProperties,
  Tag,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { API } from "../../config";

const REPORT_TABS = [
  { id: "sales", label: "Sales", icon: ShoppingBag },
  { id: "gst", label: "GST / Tax", icon: Receipt },
  { id: "items", label: "Item Sales", icon: Flame },
  { id: "categories", label: "Category Sales", icon: Layers },
  { id: "waiters", label: "Servers", icon: Users },
  { id: "kots", label: "KOT Logs", icon: ChefHat },
  { id: "cancellations", label: "Cancellations", icon: XCircle },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "discounts", label: "Discounts", icon: Tag },
  { id: "tables", label: "Table Sessions", icon: TableProperties },
  { id: "shifts", label: "Shifts", icon: IndianRupee },
  { id: "inventory", label: "Inventory", icon: BarChart3 },
  { id: "wastage", label: "Wastage", icon: Trash2 },
];

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
];

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function OwnerReports() {
  const [activeTab, setActiveTab] = useState("sales");
  const [datePreset, setDatePreset] = useState("Last 7 Days");

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });

  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const token = localStorage.getItem("token");
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const handlePresetSelect = (preset) => {
    setDatePreset(preset.label);
    const end = new Date();
    const start = new Date();

    if (preset.days === 0) {
      // Today
      start.setHours(0, 0, 0, 0);
    } else if (preset.days === 1) {
      // Yesterday
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else {
      start.setDate(start.getDate() - preset.days);
    }

    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setPage(1);
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `${API}/reports/${activeTab}?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=20`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await axios.get(url, authHeaders);
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error(`Error fetching ${activeTab} report:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, startDate, endDate, page]);

  const handleExport = (format) => {
    const url = `${API}/reports/export?type=${activeTab}&format=${format}&startDate=${startDate}&endDate=${endDate}`;
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-amber-500" />
            Centralized Business Reports & Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Backend-authoritative financial, operational, sales, tax, kitchen, and inventory intelligence
          </p>
        </div>

        {/* EXPORT ACTIONS */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            CSV
          </button>
          <button
            onClick={() => handleExport("excel")}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Excel
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-extrabold shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* PRESETS */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePresetSelect(p)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  datePreset === p.label ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* CUSTOM DATE PICKERS */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("Custom");
                }}
                className="bg-transparent text-white outline-none font-bold"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("Custom");
                }}
                className="bg-transparent text-white outline-none font-bold"
              />
            </div>

            <button
              onClick={fetchReport}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* REPORT SUB-TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8 no-scrollbar border-b border-slate-800">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                isActive
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-lg shadow-amber-500/20"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* REPORT CONTENT BODY */}
      {loading ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-16 text-center text-slate-400">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-4 text-amber-500" />
          Querying backend database for {activeTab} analytics...
        </div>
      ) : !reportData ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          No report data available for selected filters.
        </div>
      ) : (
        <div className="space-y-8">
          {/* EXECUTIVE SUMMARY METRIC CARDS */}
          {reportData.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(reportData.summary)
                .filter(([k, v]) => typeof v !== "object")
                .map(([key, value]) => (
                  <div key={key} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                    <p className="text-2xl font-extrabold text-white mt-1">
                      {typeof value === "number" && key.toLowerCase().includes("sales") || key.toLowerCase().includes("amount") || key.toLowerCase().includes("tax") || key.toLowerCase().includes("value") || key.toLowerCase().includes("cost")
                        ? `₹${value.toLocaleString()}`
                        : value}
                    </p>
                  </div>
                ))}
            </div>
          )}

          {/* VISUAL CHARTS (IF APPLICABLE) */}
          {activeTab === "sales" && reportData.salesTrend && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-4">Sales Trend (Net Sales)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reportData.salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }} />
                      <Area type="monotone" dataKey="netSales" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-4">Payment Breakdown</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(reportData.summary?.paymentBreakdown || {}).map(([name, value]) => ({ name, value }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {COLORS.map((c, i) => (
                          <Cell key={i} fill={c} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#fff" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* MAIN DATA TABLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
              <span>{REPORT_TABS.find((t) => t.id === activeTab)?.label} Data Table</span>
              <span className="text-xs font-normal text-slate-400">
                Total Records: {reportData.pagination?.total || reportData.orders?.length || reportData.items?.length || 0}
              </span>
            </h3>

            {/* SALES TAB TABLE */}
            {activeTab === "sales" && reportData.orders && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="pb-3">Order #</th>
                      <th className="pb-3">Source</th>
                      <th className="pb-3">Method</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3 text-right">Subtotal</th>
                      <th className="pb-3 text-right">Discount</th>
                      <th className="pb-3 text-right">Tax</th>
                      <th className="pb-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {reportData.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-800/30">
                        <td className="py-3 font-bold text-amber-400">{o.orderNo}</td>
                        <td className="py-3 text-slate-300">{o.fulfillment || o.orderSource}</td>
                        <td className="py-3 text-slate-300">{o.paymentMode || "CASH"}</td>
                        <td className="py-3 text-slate-400">{new Date(o.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="py-3 text-right text-slate-300">₹{o.subtotal?.toLocaleString()}</td>
                        <td className="py-3 text-right text-rose-400">₹{o.discountAmount?.toLocaleString()}</td>
                        <td className="py-3 text-right text-slate-300">₹{o.taxAmount?.toLocaleString()}</td>
                        <td className="py-3 text-right text-white font-extrabold">₹{o.total?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* GST TAB TABLE */}
            {activeTab === "gst" && reportData.orders && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="pb-3">Invoice #</th>
                      <th className="pb-3">Order #</th>
                      <th className="pb-3 text-right">Taxable Value</th>
                      <th className="pb-3 text-right">CGST</th>
                      <th className="pb-3 text-right">SGST</th>
                      <th className="pb-3 text-right">IGST</th>
                      <th className="pb-3 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {reportData.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-800/30">
                        <td className="py-3 font-bold text-slate-200">{o.invoiceNo || o.orderNo}</td>
                        <td className="py-3 text-amber-400 font-semibold">{o.orderNo}</td>
                        <td className="py-3 text-right text-slate-300">₹{o.taxableValue?.toLocaleString()}</td>
                        <td className="py-3 text-right text-slate-400">₹{o.cgst?.toLocaleString()}</td>
                        <td className="py-3 text-right text-slate-400">₹{o.sgst?.toLocaleString()}</td>
                        <td className="py-3 text-right text-slate-400">₹{o.igst?.toLocaleString()}</td>
                        <td className="py-3 text-right text-emerald-400 font-extrabold">₹{o.totalTax?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ITEM SALES TAB TABLE */}
            {activeTab === "items" && reportData.items && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="pb-3">Item Name</th>
                      <th className="pb-3">Variant</th>
                      <th className="pb-3 text-right">Qty Sold</th>
                      <th className="pb-3 text-right">Unit Price</th>
                      <th className="pb-3 text-right">Gross Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {reportData.items.map((i, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-3 font-bold text-white">{i.itemName}</td>
                        <td className="py-3 text-slate-400">{i.variantName || "-"}</td>
                        <td className="py-3 text-right font-bold text-amber-400">{i.qty}</td>
                        <td className="py-3 text-right text-slate-300">₹{i.unitPrice}</td>
                        <td className="py-3 text-right text-emerald-400 font-extrabold">₹{i.grossSales?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SERVER / WAITER TAB TABLE */}
            {activeTab === "waiters" && reportData.waiters && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="pb-3">Server Name</th>
                      <th className="pb-3 text-right">Sessions</th>
                      <th className="pb-3 text-right">Orders</th>
                      <th className="pb-3 text-right">Items Served</th>
                      <th className="pb-3 text-right">Cash Collected</th>
                      <th className="pb-3 text-right">Digital Collected</th>
                      <th className="pb-3 text-right">Net Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {reportData.waiters.map((w, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-3 font-bold text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-amber-500" />
                          {w.waiterName}
                        </td>
                        <td className="py-3 text-right text-slate-300">{w.sessionCount}</td>
                        <td className="py-3 text-right text-slate-300">{w.orderCount}</td>
                        <td className="py-3 text-right font-bold text-amber-400">{w.itemsServed}</td>
                        <td className="py-3 text-right text-emerald-400">₹{w.cashCollections?.toLocaleString()}</td>
                        <td className="py-3 text-right text-purple-400">₹{w.digitalCollections?.toLocaleString()}</td>
                        <td className="py-3 text-right font-extrabold text-white">₹{w.netSales?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAGINATION CONTROLS */}
            {reportData.pagination && reportData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-6">
                <span className="text-xs text-slate-400">
                  Page {reportData.pagination.page} of {reportData.pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 hover:bg-slate-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= reportData.pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 hover:bg-slate-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
