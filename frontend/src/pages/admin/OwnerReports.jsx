import { useEffect, useState } from "react";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import {
  BarChart3,
  Calendar,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Flame,
  IndianRupee,
  Layers,
  Printer,
  Receipt,
  RefreshCw,
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
import { api } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";

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

const formatLocalDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function OwnerReports() {
  const { user } = useAuth();
  const restaurantId = Number(user?.restaurantId || localStorage.getItem("activeRestaurantId") || 1);

  const [activeTab, setActiveTab] = useState("sales");
  const [datePreset, setDatePreset] = useState("Last 7 Days");

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatLocalDate(d);
  });

  const [endDate, setEndDate] = useState(() => formatLocalDate(new Date()));

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const handlePresetSelect = (preset) => {
    setDatePreset(preset.label);
    const end = new Date();
    const start = new Date();

    if (preset.days === 0) {
      // Today
    } else if (preset.days === 1) {
      // Yesterday
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else {
      start.setDate(start.getDate() - preset.days);
    }

    setStartDate(formatLocalDate(start));
    setEndDate(formatLocalDate(end));
    setPage(1);
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `/reports/${activeTab}?restaurantId=${restaurantId}&startDate=${startDate}&endDate=${endDate}&page=${page}&limit=20`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await api.get(url);
      if (res.data) {
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
  }, [activeTab, startDate, endDate, page, restaurantId]);

  const handleExport = (format) => {
    const url = `${API}/reports/export?type=${activeTab}&format=${format}&startDate=${startDate}&endDate=${endDate}&restaurantId=${restaurantId}`;
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
      {/* HEADER CONSOLE BAR */}
      <header className="pb-3 border-b border-[color:var(--app-border)]/50 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <OwnerMenuButton />
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--app-text)]">
                  Centralized Business Reports & Analytics
                </h2>
                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-primary)]">
                  ENTERPRISE CONSOLE
                </span>
              </div>
            </div>
            <p className="theme-muted text-xs mt-0.5">
              Backend-authoritative financial, operational, sales, tax, kitchen, and inventory intelligence.
            </p>
          </div>

          {/* EXPORT ACTIONS & TOP CONTROLS */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport("csv")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all cursor-pointer"
            >
              <Download size={13} className="text-emerald-500" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport("excel")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={13} className="text-emerald-500" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all cursor-pointer"
            >
              <FileText size={13} className="text-rose-500" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-3 py-1 text-xs font-bold text-white shadow-xs transition hover:opacity-90 cursor-pointer"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* SUB-HEADER / DATE CONTROL BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs theme-muted pt-1">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {/* PRESET PILL SELECTOR */}
            <div className="inline-flex items-center rounded-lg border border-[color:var(--app-border)] p-0.5 bg-[color:var(--app-bg)]/50">
              {DATE_PRESETS.map((preset) => {
                const isActive = datePreset === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      isActive
                        ? "bg-[var(--app-primary)] text-white shadow-sm"
                        : "theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* CUSTOM DATE INPUTS */}
            <div className="flex items-center gap-2 ml-1">
              <span className="flex items-center gap-1 text-[color:var(--app-muted)]">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("Custom");
                }}
                className="rounded border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-2 py-0.5 text-xs text-[color:var(--app-text)] outline-none"
              />
              <span className="flex items-center gap-1 text-[color:var(--app-muted)]">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("Custom");
                }}
                className="rounded border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-2 py-0.5 text-xs text-[color:var(--app-text)] outline-none"
              />
              <button
                type="button"
                onClick={fetchReport}
                className="inline-flex items-center gap-1 rounded bg-[var(--app-primary)] px-2.5 py-0.5 text-xs font-semibold text-white transition hover:opacity-90 cursor-pointer"
              >
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                Apply
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <Calendar size={13} className="text-[var(--app-primary)]" />
            <span>Range: <strong className="text-[color:var(--app-text)]">{datePreset}</strong></span>
            <span className="mx-1">•</span>
            <span>Timezone: <strong className="text-[color:var(--app-text)]">Asia/Kolkata</strong></span>
          </div>
        </div>
      </header>

      {/* HORIZONTAL SECTION NAVIGATION TABS */}
      <nav className="border-b border-[color:var(--app-border)]/50 overflow-x-auto scrollbar-none">
        <div className="flex min-w-max gap-1">
          {REPORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? "text-[var(--app-primary)] border-b-2 border-[var(--app-primary)]"
                    : "theme-muted hover:text-[color:var(--app-text)]"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* REPORT CONTENT BODY */}
      {loading ? (
        <div className="py-16 text-center theme-muted">
          <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-[var(--app-primary)]" />
          <p className="text-xs font-semibold">Querying backend database for {activeTab} analytics...</p>
        </div>
      ) : !reportData ? (
        <div className="py-12 text-center theme-muted font-medium text-xs">
          No report data available for selected filters.
        </div>
      ) : (
        <div className="space-y-6 pt-1">
          {/* EXECUTIVE SUMMARY METRIC CARDS */}
          {reportData.summary && (
            <div className="pb-4 border-b border-[color:var(--app-border)]/40">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)] mb-2">
                PERIOD PERFORMANCE OVERVIEW · {REPORT_TABS.find((t) => t.id === activeTab)?.label?.toUpperCase() || "REPORT"}
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-2">
                {Object.entries(reportData.summary)
                  .filter(([k, v]) => typeof v !== "object")
                  .map(([key, value]) => (
                    <div key={key} className="space-y-0.5">
                      <div className="theme-muted text-xs font-medium uppercase tracking-wide">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </div>
                      <div className="text-2xl font-black tracking-tight text-[color:var(--app-text)]">
                        {typeof value === "number" &&
                        (key.toLowerCase().includes("sales") ||
                          key.toLowerCase().includes("amount") ||
                          key.toLowerCase().includes("tax") ||
                          key.toLowerCase().includes("value") ||
                          key.toLowerCase().includes("cost"))
                          ? `₹${value.toLocaleString()}`
                          : value}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* VISUAL CHARTS (IF APPLICABLE) */}
          {activeTab === "sales" && reportData.salesTrend && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4 border-b border-[color:var(--app-border)]/40">
              <div className="lg:col-span-2 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--app-muted)]">
                  Sales Trend (Net Sales)
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reportData.salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" opacity={0.4} />
                      <XAxis dataKey="date" stroke="var(--app-muted)" fontSize={11} />
                      <YAxis stroke="var(--app-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }} />
                      <Area type="monotone" dataKey="netSales" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--app-muted)]">
                  Payment Breakdown
                </div>
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
                      <Tooltip contentStyle={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* MAIN DATA TABLE SECTION */}
          <div className="py-2 space-y-3">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--app-muted)]">
                {REPORT_TABS.find((t) => t.id === activeTab)?.label} Data Table
              </div>
              <span className="text-xs font-semibold theme-muted">
                Total Records: {reportData.pagination?.total || reportData.orders?.length || reportData.items?.length || reportData.waiters?.length || reportData.rows?.length || 0}
              </span>
            </div>

            {/* SALES TAB TABLE */}
            {activeTab === "sales" && reportData.orders && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[color:var(--app-border)]/50 theme-muted uppercase tracking-wider text-[11px] font-bold">
                      <th className="pb-2">Order #</th>
                      <th className="pb-2">Source</th>
                      <th className="pb-2">Method</th>
                      <th className="pb-2">Date</th>
                      <th className="pb-2 text-right">Subtotal</th>
                      <th className="pb-2 text-right">Discount</th>
                      <th className="pb-2 text-right">Tax</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--app-border)]/40">
                    {reportData.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 font-bold text-amber-500">{o.orderNo}</td>
                        <td className="py-2.5 text-[color:var(--app-text)]">{o.fulfillment || o.orderSource}</td>
                        <td className="py-2.5 text-[color:var(--app-text)]">{o.paymentMode || "CASH"}</td>
                        <td className="py-2.5 theme-muted">{new Date(o.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="py-2.5 text-right text-[color:var(--app-text)]">₹{o.subtotal?.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-rose-500">₹{o.discountAmount?.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-[color:var(--app-text)]">₹{o.taxAmount?.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-[color:var(--app-text)] font-black">₹{o.total?.toLocaleString()}</td>
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
                    <tr className="border-b border-[color:var(--app-border)]/50 theme-muted uppercase tracking-wider text-[11px] font-bold">
                      <th className="pb-2">Invoice #</th>
                      <th className="pb-2">Order #</th>
                      <th className="pb-2 text-right">Taxable Value</th>
                      <th className="pb-2 text-right">CGST</th>
                      <th className="pb-2 text-right">SGST</th>
                      <th className="pb-2 text-right">IGST</th>
                      <th className="pb-2 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--app-border)]/40">
                    {reportData.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 font-bold text-[color:var(--app-text)]">{o.invoiceNo || o.orderNo}</td>
                        <td className="py-2.5 text-amber-500 font-semibold">{o.orderNo}</td>
                        <td className="py-2.5 text-right text-[color:var(--app-text)]">₹{o.taxableValue?.toLocaleString()}</td>
                        <td className="py-2.5 text-right theme-muted">₹{o.cgst?.toLocaleString()}</td>
                        <td className="py-2.5 text-right theme-muted">₹{o.sgst?.toLocaleString()}</td>
                        <td className="py-2.5 text-right theme-muted">₹{o.igst?.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-emerald-500 font-black">₹{o.totalTax?.toLocaleString()}</td>
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
                    <tr className="border-b border-[color:var(--app-border)]/50 theme-muted uppercase tracking-wider text-[11px] font-bold">
                      <th className="pb-2">Item Name</th>
                      <th className="pb-2">Variant</th>
                      <th className="pb-2 text-right">Qty Sold</th>
                      <th className="pb-2 text-right">Unit Price</th>
                      <th className="pb-2 text-right">Gross Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--app-border)]/40">
                    {reportData.items.map((i, idx) => (
                      <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 font-bold text-[color:var(--app-text)]">{i.itemName}</td>
                        <td className="py-2.5 theme-muted">{i.variantName || "-"}</td>
                        <td className="py-2.5 text-right font-bold text-amber-500">{i.qty}</td>
                        <td className="py-2.5 text-right text-[color:var(--app-text)]">₹{i.unitPrice}</td>
                        <td className="py-2.5 text-right text-emerald-500 font-black">₹{i.grossSales?.toLocaleString()}</td>
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
                    <tr className="border-b border-[color:var(--app-border)]/50 theme-muted uppercase tracking-wider text-[11px] font-bold">
                      <th className="pb-2">Server Name</th>
                      <th className="pb-2 text-right">Sessions</th>
                      <th className="pb-2 text-right">Orders</th>
                      <th className="pb-2 text-right">Items Served</th>
                      <th className="pb-2 text-right">Cash Collected</th>
                      <th className="pb-2 text-right">Digital Collected</th>
                      <th className="pb-2 text-right">Net Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--app-border)]/40">
                    {reportData.waiters.map((w, idx) => (
                      <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 font-bold text-[color:var(--app-text)] flex items-center gap-2">
                          <Users size={14} className="text-amber-500" />
                          {w.waiterName}
                        </td>
                        <td className="py-2.5 text-right text-[color:var(--app-text)]">{w.sessionCount}</td>
                        <td className="py-2.5 text-right text-[color:var(--app-text)]">{w.orderCount}</td>
                        <td className="py-2.5 text-right font-bold text-amber-500">{w.itemsServed}</td>
                        <td className="py-2.5 text-right text-emerald-500">₹{w.cashCollections?.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-purple-500">₹{w.digitalCollections?.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-black text-[color:var(--app-text)]">₹{w.netSales?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* GENERIC TAB TABLE FALLBACK */}
            {!["sales", "gst", "items", "waiters"].includes(activeTab) && (reportData.rows || reportData.items || reportData.orders || reportData.data) && (
              <div className="overflow-x-auto">
                {(() => {
                  const rows = reportData.rows || reportData.items || reportData.orders || reportData.data || [];
                  if (!rows.length) return <p className="py-6 text-center theme-muted text-xs">No records for {activeTab}.</p>;
                  const keys = Object.keys(rows[0] || {}).filter((k) => typeof rows[0][k] !== "object");
                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[color:var(--app-border)]/50 theme-muted uppercase tracking-wider text-[11px] font-bold">
                          {keys.map((k) => (
                            <th key={k} className="pb-2 px-2">{k.replace(/([A-Z])/g, " $1").trim()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--app-border)]/40">
                        {rows.map((r, idx) => (
                          <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            {keys.map((k) => (
                              <td key={k} className="py-2.5 px-2 text-[color:var(--app-text)] font-medium">
                                {typeof r[k] === "boolean" ? (r[k] ? "Yes" : "No") : String(r[k] ?? "-")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}

            {/* PAGINATION CONTROLS */}
            {reportData.pagination && reportData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[color:var(--app-border)]/40 pt-3 mt-4 text-xs theme-muted">
                <span>
                  Page {reportData.pagination.page} of {reportData.pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1.5 bg-transparent border border-[color:var(--app-border)] rounded-lg text-[color:var(--app-text)] disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={page >= reportData.pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-1.5 bg-transparent border border-[color:var(--app-border)] rounded-lg text-[color:var(--app-text)] disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
