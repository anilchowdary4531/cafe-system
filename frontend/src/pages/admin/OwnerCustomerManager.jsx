import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Plus,
  Filter,
  UserCheck,
  UserX,
  ShoppingBag,
  ArrowUpDown,
  Eye,
  Edit2,
  GitMerge,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Sparkles,
  Calendar,
  Download,
  RotateCcw,
  IndianRupee,
  Clock,
  Award,
  HelpCircle,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import { showToast } from "../../utils/toast";

import OwnerMenuButton from "../../components/OwnerMenuButton";

export default function OwnerCustomerManager() {
  const navigate = useNavigate();
  const { restaurant } = useAuth();
  const restaurantId = Number(restaurant?.id || localStorage.getItem("restaurantId") || 1);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Advanced Analytics & Segmentation states
  const [range, setRange] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [segment, setSegment] = useState("ALL");
  const [minOrders, setMinOrders] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [exporting, setExporting] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    tags: "",
    status: "ACTIVE",
    dateOfBirth: "",
    gender: "",
  });

  const [mergeData, setMergeData] = useState({
    sourceCustomerId: "",
    targetCustomerId: "",
  });

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [
    restaurantId,
    pagination.page,
    statusFilter,
    sortBy,
    sortOrder,
    range,
    segment,
  ]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const targetId = restaurantId || Number(localStorage.getItem("restaurantId")) || 1;
      const res = await api.get(`/owner/${targetId}/customers`, {
        params: {
          query: searchQuery,
          page: pagination.page,
          limit: pagination.limit,
          status: statusFilter,
          sortBy,
          sortOrder,
          range,
          startDate: range === "custom" && startDate ? startDate : undefined,
          endDate: range === "custom" && endDate ? endDate : undefined,
          segment,
          minOrders: minOrders !== "" ? minOrders : undefined,
          minSpend: minSpend !== "" ? minSpend : undefined,
        },
      });

      const items = res.data?.items || (Array.isArray(res.data) ? res.data : []);
      const pag = res.data?.pagination || { page: 1, limit: 15, total: items.length, totalPages: 1 };
      
      setCustomers(items);
      setPagination(pag);
      if (res.data?.summary) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      showToast.error("Failed to load customer list");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCustomers();
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ACTIVE");
    setSortBy("createdAt");
    setSortOrder("desc");
    setRange("all");
    setStartDate("");
    setEndDate("");
    setSegment("ALL");
    setMinOrders("");
    setMinSpend("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const targetId = restaurantId || Number(localStorage.getItem("restaurantId")) || 1;
      const res = await api.get(`/owner/${targetId}/customers/export`, {
        params: {
          query: searchQuery,
          status: statusFilter,
          sortBy,
          sortOrder,
          range,
          startDate: range === "custom" && startDate ? startDate : undefined,
          endDate: range === "custom" && endDate ? endDate : undefined,
          segment,
          minOrders: minOrders !== "" ? minOrders : undefined,
          minSpend: minSpend !== "" ? minSpend : undefined,
          format: "csv",
        },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `customers_${targetId}_${range}_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast.success("Customer report exported successfully!");
    } catch (err) {
      console.error("Export failed:", err);
      showToast.error("Failed to export customer report");
    } finally {
      setExporting(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      notes: "",
      tags: "",
      status: "ACTIVE",
      dateOfBirth: "",
      gender: "",
    });
    setFormError("");
    setShowCreateModal(true);
  };

  const openEditModal = (cust) => {
    setSelectedCustomer(cust);
    setFormData({
      name: cust.name || "",
      phone: cust.phone || "",
      email: cust.email || "",
      notes: cust.notes || "",
      tags: cust.tags || "",
      status: cust.status || "ACTIVE",
      dateOfBirth: cust.dateOfBirth ? cust.dateOfBirth.split("T")[0] : "",
      gender: cust.gender || "",
    });
    setFormError("");
    setShowEditModal(true);
  };

  const openMergeModal = (cust) => {
    setSelectedCustomer(cust);
    setMergeData({
      sourceCustomerId: cust.id,
      targetCustomerId: "",
    });
    setFormError("");
    setShowMergeModal(true);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!formData.phone.trim()) {
      setFormError("Phone number is required");
      return;
    }
    try {
      setSubmitting(true);
      const targetId = restaurantId || 1;
      await api.post(`/owner/${targetId}/customers`, formData);
      showToast.success("Customer created successfully");
      setShowCreateModal(false);
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create customer";
      setFormError(msg);
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    setFormError("");
    try {
      setSubmitting(true);
      const targetId = restaurantId || 1;
      await api.put(`/owner/${targetId}/customers/${selectedCustomer.id}`, formData);
      showToast.success("Customer updated successfully");
      setShowEditModal(false);
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update customer";
      setFormError(msg);
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMergeCustomers = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!mergeData.targetCustomerId) {
      setFormError("Please select a target customer to merge into");
      return;
    }
    if (Number(mergeData.sourceCustomerId) === Number(mergeData.targetCustomerId)) {
      setFormError("Source and target customer cannot be the same");
      return;
    }
    try {
      setSubmitting(true);
      const targetId = restaurantId || 1;
      const res = await api.post(`/owner/${targetId}/customers/merge`, {
        sourceCustomerId: Number(mergeData.sourceCustomerId),
        targetCustomerId: Number(mergeData.targetCustomerId),
      });
      showToast.success(`Merged successfully! Reassigned ${res.data.ordersMoved || 0} orders.`);
      setShowMergeModal(false);
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to merge customers";
      setFormError(msg);
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getSegmentBadge = (seg) => {
    switch (seg) {
      case "FREQUENT":
        return {
          label: "Frequent (5+)",
          className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
        };
      case "HIGH_SPENDING":
        return {
          label: "High Spender",
          className: "bg-purple-500/10 text-purple-600 border border-purple-500/20",
        };
      case "RETURNING":
        return {
          label: "Returning (2+)",
          className: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
        };
      case "NEW":
        return {
          label: "New (1st)",
          className: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
        };
      case "REACTIVATED":
        return {
          label: "Reactivated",
          className: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20",
        };
      case "RECENTLY_INACTIVE":
        return {
          label: "Inactive (30d+)",
          className: "bg-orange-500/10 text-orange-600 border border-orange-500/20",
        };
      case "LONG_TERM_INACTIVE":
        return {
          label: "Dormant (90d+)",
          className: "bg-rose-500/10 text-rose-600 border border-rose-500/20",
        };
      case "NO_ORDERS":
      default:
        return {
          label: "No Orders",
          className: "bg-gray-500/10 text-gray-500 border border-gray-500/20",
        };
    }
  };

  const hasDateFilter = range !== "all";

  return (
    <div className="px-1 py-1 w-full space-y-3 text-[color:var(--app-text)] font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[color:var(--app-border)]/40 pb-3 gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-widest">
            <Sparkles size={12} /> CRM & Retention Intelligence
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl flex items-center gap-3">
            <OwnerMenuButton />
            Customer Directory
          </h1>
          <p className="text-xs text-[color:var(--app-muted)]">
            Track repeat-purchase behavior, visit frequencies, customer segments, and lifetime spending.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-2)] transition shadow-xs disabled:opacity-50"
            title="Export filtered records to CSV"
          >
            <Download size={14} className="text-amber-500" />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 shadow-sm"
          >
            <Plus size={15} /> New Customer
          </button>
        </div>
      </div>

      {/* 6-Card KPI Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 border-b border-[color:var(--app-border)]/40 pb-3">
        {/* Total Customers */}
        <div className="rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-1)]/70 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">
              Total Customers
            </span>
            <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-md">
              <Users size={13} />
            </div>
          </div>
          <p className="text-lg font-bold text-[color:var(--app-text)] mt-1 leading-none">
            {summary?.totalCustomers ?? pagination.total}
          </p>
          <span className="text-[10px] text-[color:var(--app-muted)] mt-1 block">
            {summary?.hasDateFilter ? "In current filter" : "All-time registered"}
          </span>
        </div>

        {/* New Customers */}
        <div className="rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-1)]/70 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">
              New Customers
            </span>
            <div className="p-1.5 bg-blue-500/10 text-blue-600 rounded-md">
              <ShoppingBag size={13} />
            </div>
          </div>
          <p className="text-lg font-bold text-blue-600 mt-1 leading-none">
            {summary?.newCustomers ?? 0}
          </p>
          <span className="text-[10px] text-[color:var(--app-muted)] mt-1 block">
            {hasDateFilter ? "1st visit in range" : "1 lifetime order"}
          </span>
        </div>

        {/* Returning Customers */}
        <div className="rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-1)]/70 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">
              Repeat Customers
            </span>
            <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-md">
              <RotateCcw size={13} />
            </div>
          </div>
          <p className="text-lg font-bold text-amber-600 mt-1 leading-none">
            {summary?.returningCustomers ?? 0}
          </p>
          <span className="text-[10px] text-[color:var(--app-muted)] mt-1 block">
            {hasDateFilter ? "Repeat in range" : "2+ lifetime orders"}
          </span>
        </div>

        {/* Repeat Rate % */}
        <div className="rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-1)]/70 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">
                Repeat Rate
              </span>
              <span
                title="Calculated as (Repeat Customers / Customers with ≥1 order in scope) × 100"
                className="cursor-help text-[color:var(--app-muted)]"
              >
                <HelpCircle size={10} />
              </span>
            </div>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-md">
              <UserCheck size={13} />
            </div>
          </div>
          <p className="text-lg font-bold text-emerald-600 mt-1 leading-none">
            {summary?.repeatCustomerRate ?? 0}%
          </p>
          <span className="text-[10px] text-[color:var(--app-muted)] mt-1 block">
            of {summary?.periodPurchasingCustomers ?? 0} buyers
          </span>
        </div>

        {/* Frequent Customers */}
        <div className="rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-1)]/70 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">
              Frequent (5+)
            </span>
            <div className="p-1.5 bg-purple-500/10 text-purple-600 rounded-md">
              <Award size={13} />
            </div>
          </div>
          <p className="text-lg font-bold text-purple-600 mt-1 leading-none">
            {summary?.frequentCustomers ?? 0}
          </p>
          <span className="text-[10px] text-[color:var(--app-muted)] mt-1 block">
            Loyal core visitors
          </span>
        </div>

        {/* Total Qualifying Revenue */}
        <div className="rounded-xl border border-[color:var(--app-border)]/40 bg-[color:var(--app-surface-1)]/70 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">
              Total Revenue
            </span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-md">
              <IndianRupee size={13} />
            </div>
          </div>
          <p className="text-lg font-bold text-emerald-600 mt-1 leading-none">
            ₹{Number(summary?.totalQualifyingRevenue || 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-[color:var(--app-muted)] mt-1 block">
            AOV: ₹{Number(summary?.averageOrderValue || 0).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="space-y-2 border-b border-[color:var(--app-border)]/40 pb-3">
        <form onSubmit={handleSearchSubmit} className="space-y-2">
          {/* Top Line: Search + Presets + Segments */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--app-muted)]"
                size={14}
              />
              <input
                type="text"
                placeholder="Search by name, phone, email, or Customer ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-[color:var(--app-border)]/60 pl-8 pr-3 py-1.5 text-xs text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none focus:border-amber-500"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {/* Date Range Selector */}
              <div className="flex items-center gap-1">
                <Calendar size={13} className="text-amber-600" />
                <select
                  value={range}
                  onChange={(e) => {
                    setRange(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="bg-transparent border-b border-[color:var(--app-border)]/60 font-semibold text-[color:var(--app-text)] py-1 outline-none cursor-pointer text-xs"
                >
                  <option value="all" className="bg-[color:var(--app-bg)]">Range: All Time</option>
                  <option value="today" className="bg-[color:var(--app-bg)]">Range: Today</option>
                  <option value="yesterday" className="bg-[color:var(--app-bg)]">Range: Yesterday</option>
                  <option value="7d" className="bg-[color:var(--app-bg)]">Range: Last 7 Days</option>
                  <option value="30d" className="bg-[color:var(--app-bg)]">Range: Last 30 Days</option>
                  <option value="90d" className="bg-[color:var(--app-bg)]">Range: Last 90 Days</option>
                  <option value="this_month" className="bg-[color:var(--app-bg)]">Range: This Month</option>
                  <option value="prev_month" className="bg-[color:var(--app-bg)]">Range: Previous Month</option>
                  <option value="custom" className="bg-[color:var(--app-bg)]">Range: Custom Dates</option>
                </select>
              </div>

              {/* Customer Segment Selector */}
              <div className="flex items-center gap-1">
                <Filter size={13} className="text-purple-600" />
                <select
                  value={segment}
                  onChange={(e) => {
                    setSegment(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="bg-transparent border-b border-[color:var(--app-border)]/60 font-semibold text-[color:var(--app-text)] py-1 outline-none cursor-pointer text-xs"
                >
                  <option value="ALL" className="bg-[color:var(--app-bg)]">Segment: All Customers</option>
                  <option value="NEW" className="bg-[color:var(--app-bg)]">Segment: New (1 Order)</option>
                  <option value="RETURNING" className="bg-[color:var(--app-bg)]">Segment: Returning (2+ Orders)</option>
                  <option value="FREQUENT" className="bg-[color:var(--app-bg)]">Segment: Frequent (5+ Orders)</option>
                  <option value="HIGH_SPENDING" className="bg-[color:var(--app-bg)]">Segment: High Spender (₹5k+)</option>
                  <option value="RECENTLY_INACTIVE" className="bg-[color:var(--app-bg)]">Segment: Inactive (30-89d)</option>
                  <option value="LONG_TERM_INACTIVE" className="bg-[color:var(--app-bg)]">Segment: Dormant (90d+)</option>
                  <option value="REACTIVATED" className="bg-[color:var(--app-bg)]">Segment: Reactivated</option>
                </select>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1">
                <ArrowUpDown size={13} className="text-[color:var(--app-muted)]" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent border-b border-[color:var(--app-border)]/60 font-medium text-[color:var(--app-text)] py-1 outline-none cursor-pointer text-xs"
                >
                  <option value="createdAt" className="bg-[color:var(--app-bg)]">Sort: Joined Date</option>
                  <option value="name" className="bg-[color:var(--app-bg)]">Sort: Name</option>
                  <option value="orderCount" className="bg-[color:var(--app-bg)]">Sort: Total Orders</option>
                  <option value="totalSpend" className="bg-[color:var(--app-bg)]">Sort: Total Spend</option>
                  <option value="periodOrders" className="bg-[color:var(--app-bg)]">Sort: Period Orders</option>
                  <option value="periodSpent" className="bg-[color:var(--app-bg)]">Sort: Period Spend</option>
                  <option value="lastOrderDate" className="bg-[color:var(--app-bg)]">Sort: Last Visit</option>
                  <option value="firstOrderDate" className="bg-[color:var(--app-bg)]">Sort: First Order</option>
                  <option value="avgOrderValue" className="bg-[color:var(--app-bg)]">Sort: Avg Order Value</option>
                  <option value="visitInterval" className="bg-[color:var(--app-bg)]">Sort: Visit Interval</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  className="ml-0.5 text-[10px] font-bold uppercase text-amber-600 hover:underline"
                  title="Toggle Ascending / Descending"
                >
                  {sortOrder}
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1">
                <UserCheck size={13} className="text-emerald-600" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent border-b border-[color:var(--app-border)]/60 font-medium text-[color:var(--app-text)] py-1 outline-none cursor-pointer text-xs"
                >
                  <option value="ACTIVE" className="bg-[color:var(--app-bg)]">Active Only</option>
                  <option value="INACTIVE" className="bg-[color:var(--app-bg)]">Inactive / Merged</option>
                  <option value="ALL" className="bg-[color:var(--app-bg)]">All Statuses</option>
                </select>
              </div>

              <button
                type="submit"
                className="px-2.5 py-1 text-xs font-semibold text-amber-600 hover:underline transition"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2 py-1 text-[11px] font-medium text-[color:var(--app-muted)] hover:text-rose-500 transition"
                title="Reset all filters"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Optional Custom Date Inputs + Threshold Inputs */}
          {range === "custom" && (
            <div className="flex items-center gap-3 pt-1 text-xs bg-[color:var(--app-surface-1)]/40 p-2 rounded-lg border border-[color:var(--app-border)]/30">
              <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                <Calendar size={13} /> Custom Period:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[color:var(--app-muted)]">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border border-[color:var(--app-border)] rounded px-2 py-0.5 text-xs text-[color:var(--app-text)] outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[color:var(--app-muted)]">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border border-[color:var(--app-border)] rounded px-2 py-0.5 text-xs text-[color:var(--app-text)] outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-2.5 py-0.5 rounded bg-amber-500 text-white font-semibold text-[11px] hover:bg-amber-600 transition"
              >
                Set Dates
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Customer List Table */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex h-36 items-center justify-center text-xs font-medium text-[color:var(--app-muted)]">
            Loading customers and analytics...
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="h-10 w-10 text-[color:var(--app-muted)] opacity-40" />
            <h3 className="mt-2 text-sm font-semibold text-[color:var(--app-text)]">No customers match criteria</h3>
            <p className="mt-0.5 text-xs text-[color:var(--app-muted)]">
              Try adjusting your date range, segment filter, or search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[color:var(--app-border)]/40 text-[color:var(--app-muted)] uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3">Segment</th>
                  <th className="py-2 px-3 text-center">
                    Orders {hasDateFilter ? "(Range/Life)" : ""}
                  </th>
                  <th className="py-2 px-3 text-right">
                    Spend {hasDateFilter ? "(Range/Life)" : ""}
                  </th>
                  <th className="py-2 px-3 text-right">AOV</th>
                  <th className="py-2 px-3">First Order</th>
                  <th className="py-2 px-3">Last Visit</th>
                  <th className="py-2 px-3 text-center">Visit Interval</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--app-border)]/20">
                {customers.map((cust) => {
                  const segBadge = getSegmentBadge(cust.segment);
                  return (
                    <tr key={cust.id} className="hover:bg-[color:var(--app-surface)]/20 transition">
                      {/* Name & ID */}
                      <td className="py-2 px-3 font-medium text-[color:var(--app-text)]">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-600">
                            {(cust.name || cust.phone || "C").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-[color:var(--app-text)]">
                              {cust.name || "Guest Customer"}
                            </p>
                            <p className="text-[10px] text-[color:var(--app-muted)]">ID: #{cust.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Email */}
                      <td className="py-2 px-3 text-[color:var(--app-text)]">
                        <p className="font-medium">{cust.phone}</p>
                        {cust.email && <p className="text-[10px] text-[color:var(--app-muted)]">{cust.email}</p>}
                      </td>

                      {/* Behavioral Segment Badge */}
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${segBadge.className}`}
                        >
                          {segBadge.label}
                        </span>
                      </td>

                      {/* Orders */}
                      <td className="py-2 px-3 text-center font-bold text-[color:var(--app-text)]">
                        {hasDateFilter ? (
                          <div>
                            <span className="text-amber-600">{cust.periodOrders || 0}</span>
                            <span className="text-[10px] font-normal text-[color:var(--app-muted)] block">
                              / {cust.totalOrders || 0} total
                            </span>
                          </div>
                        ) : (
                          <span>{cust.totalOrders || 0}</span>
                        )}
                      </td>

                      {/* Total Spend */}
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">
                        {hasDateFilter ? (
                          <div>
                            <span>₹{Number(cust.periodSpent || 0).toLocaleString()}</span>
                            <span className="text-[10px] font-normal text-[color:var(--app-muted)] block">
                              / ₹{Number(cust.totalSpent || 0).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span>₹{Number(cust.totalSpent || 0).toLocaleString()}</span>
                        )}
                      </td>

                      {/* Average Order Value */}
                      <td className="py-2 px-3 text-right text-[color:var(--app-text)] font-semibold">
                        ₹{Number(cust.averageOrderValue || 0).toLocaleString()}
                      </td>

                      {/* First Order Date */}
                      <td className="py-2 px-3 text-[color:var(--app-muted)] text-[11px]">
                        {cust.firstOrderAt ? new Date(cust.firstOrderAt).toLocaleDateString() : "Never"}
                      </td>

                      {/* Last Order Date */}
                      <td className="py-2 px-3 text-[color:var(--app-text)] text-[11px] font-medium">
                        {cust.lastOrderAt ? new Date(cust.lastOrderAt).toLocaleDateString() : "Never"}
                      </td>

                      {/* Average Visit Interval */}
                      <td className="py-2 px-3 text-center text-[11px]">
                        {cust.avgVisitIntervalDays !== null && cust.avgVisitIntervalDays !== undefined ? (
                          <span className="font-semibold text-purple-600">
                            {cust.avgVisitIntervalDays}d
                          </span>
                        ) : (cust.totalOrders || 0) <= 1 ? (
                          <span className="text-[color:var(--app-muted)] text-[10px]">1st visit</span>
                        ) : (
                          <span className="text-[color:var(--app-muted)] text-[10px]">-</span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            cust.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {cust.status === "ACTIVE" ? <UserCheck size={9} /> : <UserX size={9} />}
                          {cust.status}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/owner/customers/${cust.id}`}
                            title="View Full 360° Profile"
                            className="p-1 text-[color:var(--app-muted)] hover:text-amber-600 transition"
                          >
                            <Eye size={15} />
                          </Link>
                          <button
                            onClick={() => openEditModal(cust)}
                            title="Edit Customer"
                            className="p-1 text-[color:var(--app-muted)] hover:text-blue-600 transition"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => openMergeModal(cust)}
                            title="Merge Customer Record"
                            className="p-1 text-[color:var(--app-muted)] hover:text-purple-600 transition"
                          >
                            <GitMerge size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[color:var(--app-border)]/30 pt-2 text-xs">
            <span className="text-[color:var(--app-muted)] text-[11px]">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} matching records)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="flex items-center gap-0.5 px-2 py-1 font-medium disabled:opacity-40 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="flex items-center gap-0.5 px-2 py-1 font-medium disabled:opacity-40 text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>


      {/* CREATE CUSTOMER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-3">
              <h2 className="text-base font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <Plus className="text-amber-500" size={18} /> Register New Customer
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs font-medium text-red-500 border border-red-500/20">
                <AlertCircle size={15} /> {formError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="mt-3 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[color:var(--app-text)] mb-1">Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-[color:var(--app-text)] mb-1">Phone Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[color:var(--app-text)] mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[color:var(--app-text)] mb-1">Tags</label>
                  <input
                    type="text"
                    placeholder="Regular, VIP"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[color:var(--app-text)] mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[color:var(--app-text)] mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Prefers less spicy food..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 font-medium text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-amber-500 px-4 py-1.5 font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-3">
              <h2 className="text-base font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <Edit2 className="text-blue-500" size={18} /> Edit Customer Profile
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs font-medium text-red-500 border border-red-500/20">
                <AlertCircle size={15} /> {formError}
              </div>
            )}

            <form onSubmit={handleUpdateCustomer} className="mt-3 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[color:var(--app-text)] mb-1">Customer Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-[color:var(--app-text)] mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[color:var(--app-text)] mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[color:var(--app-text)] mb-1">Tags</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[color:var(--app-text)] mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[color:var(--app-text)] mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 font-medium text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-500 px-4 py-1.5 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Update Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MERGE CUSTOMER MODAL */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-3">
              <h2 className="text-base font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <GitMerge className="text-purple-500" size={18} /> Merge Duplicate Customer
              </h2>
              <button
                onClick={() => setShowMergeModal(false)}
                className="rounded-lg p-1 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 rounded-lg bg-purple-500/10 p-2.5 text-xs text-purple-600 border border-purple-500/20">
              <p className="font-semibold">Merging Customer #{selectedCustomer?.id} ({selectedCustomer?.name || selectedCustomer?.phone})</p>
              <p className="mt-0.5 opacity-90">
                All historical orders, reservations, addresses, and notes from this source customer will be transferred to the target customer.
              </p>
            </div>

            {formError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs font-medium text-red-500 border border-red-500/20">
                <AlertCircle size={15} /> {formError}
              </div>
            )}

            <form onSubmit={handleMergeCustomers} className="mt-3 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[color:var(--app-text)] mb-1">
                  Select Target Customer to Merge INTO *
                </label>
                <select
                  value={mergeData.targetCustomerId}
                  onChange={(e) => setMergeData({ ...mergeData, targetCustomerId: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[color:var(--app-text)] outline-none focus:border-purple-500 cursor-pointer"
                  required
                >
                  <option value="">-- Choose Target Surviving Customer --</option>
                  {customers
                    .filter((c) => c.id !== selectedCustomer?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.id} - {c.name || "Guest"} ({c.phone}) [{c.totalOrders || 0} orders]
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 font-medium text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-purple-500 px-4 py-1.5 font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
                >
                  {submitting ? "Merging..." : "Confirm Transactional Merge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
