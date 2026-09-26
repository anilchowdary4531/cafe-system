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
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import { showToast } from "../../utils/toast";

export default function OwnerCustomerManager() {
  const navigate = useNavigate();
  const { restaurant } = useAuth();
  const restaurantId = Number(restaurant?.id || localStorage.getItem("restaurantId") || 1);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

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
  }, [restaurantId, pagination.page, statusFilter, sortBy, sortOrder]);

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
        },
      });

      const items = res.data?.items || (Array.isArray(res.data) ? res.data : []);
      const pag = res.data?.pagination || { page: 1, limit: 15, total: items.length, totalPages: 1 };
      
      setCustomers(items);
      setPagination(pag);
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

  // Summary Metrics
  const activeCount = customers.filter((c) => c.status === "ACTIVE").length;
  const customersWithOrders = customers.filter((c) => (c.totalOrders || 0) > 0).length;

  return (
    <div className="px-3 py-1 sm:px-5 sm:py-1.5 w-full space-y-3 text-[color:var(--app-text)] font-sans">
      {/* Header Banner - Sleek Paper Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[color:var(--app-border)]/40 pb-3 gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-widest">
            <Sparkles size={12} /> CRM & Customer Relations
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
            Customer Directory
          </h1>
          <p className="text-xs text-[color:var(--app-muted)]">
            Manage restaurant customers, view purchase history, saved addresses, and historical activity.
          </p>
        </div>
        <div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 shadow-sm"
          >
            <Plus size={15} /> New Customer
          </button>
        </div>
      </div>

      {/* KPI Stats Bar - Compact Inline Paper Style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-[color:var(--app-border)]/40 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-600 rounded-md">
            <Users size={16} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">Total Customers</p>
            <p className="text-lg font-bold leading-none text-[color:var(--app-text)] mt-0.5">{pagination.total}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-md">
            <UserCheck size={16} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">Active Directory</p>
            <p className="text-lg font-bold leading-none text-[color:var(--app-text)] mt-0.5">{activeCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-600 rounded-md">
            <ShoppingBag size={16} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">With Orders</p>
            <p className="text-lg font-bold leading-none text-[color:var(--app-text)] mt-0.5">{customersWithOrders}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 text-purple-600 rounded-md">
            <Calendar size={16} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[color:var(--app-muted)] uppercase tracking-wide">Current Page</p>
            <p className="text-lg font-bold leading-none text-[color:var(--app-text)] mt-0.5">
              {pagination.page} / {pagination.totalPages}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar - Minimal Paper Line */}
      <div className="border-b border-[color:var(--app-border)]/40 pb-2">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--app-muted)]" size={15} />
            <input
              type="text"
              placeholder="Search customer by name, phone, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-b border-[color:var(--app-border)]/60 pl-8 pr-3 py-1.5 text-xs text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1 text-xs">
              <Filter size={13} className="text-[color:var(--app-muted)]" />
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

            {/* Sort Selector */}
            <div className="flex items-center gap-1 text-xs">
              <ArrowUpDown size={13} className="text-[color:var(--app-muted)]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent border-b border-[color:var(--app-border)]/60 font-medium text-[color:var(--app-text)] py-1 outline-none cursor-pointer text-xs"
              >
                <option value="createdAt" className="bg-[color:var(--app-bg)]">Sort: Created Date</option>
                <option value="name" className="bg-[color:var(--app-bg)]">Sort: Name</option>
                <option value="orderCount" className="bg-[color:var(--app-bg)]">Sort: Total Orders</option>
                <option value="totalSpend" className="bg-[color:var(--app-bg)]">Sort: Total Spend</option>
                <option value="lastOrderDate" className="bg-[color:var(--app-bg)]">Sort: Last Order</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                className="ml-0.5 text-[10px] font-bold uppercase text-amber-600 hover:underline"
              >
                {sortOrder}
              </button>
            </div>

            <button
              type="submit"
              className="px-2.5 py-1 text-xs font-semibold text-amber-600 hover:underline transition"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      {/* Customer List Table - Clean Paper Design */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex h-36 items-center justify-center text-xs font-medium text-[color:var(--app-muted)]">
            Loading customers...
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="h-10 w-10 text-[color:var(--app-muted)] opacity-40" />
            <h3 className="mt-2 text-sm font-semibold text-[color:var(--app-text)]">No customers found</h3>
            <p className="mt-0.5 text-xs text-[color:var(--app-muted)]">
              Try adjusting your search criteria or click "New Customer" to add one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[color:var(--app-border)]/40 text-[color:var(--app-muted)] uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3 text-center">Orders</th>
                  <th className="py-2 px-3 text-right">Total Spend</th>
                  <th className="py-2 px-3">Last Order</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--app-border)]/20">
                {customers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-[color:var(--app-surface)]/20 transition">
                    <td className="py-2 px-3 font-medium text-[color:var(--app-text)]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-600">
                          {(cust.name || cust.phone || "C").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-[color:var(--app-text)]">{cust.name || "Guest Customer"}</p>
                          <p className="text-[10px] text-[color:var(--app-muted)]">ID: #{cust.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 font-medium text-[color:var(--app-text)]">{cust.phone}</td>
                    <td className="py-2 px-3 text-[color:var(--app-muted)]">{cust.email || "-"}</td>
                    <td className="py-2 px-3 text-center font-bold text-[color:var(--app-text)]">
                      {cust.totalOrders || 0}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-600">
                      ₹{Number(cust.totalSpent || 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-[color:var(--app-muted)]">
                      {cust.lastOrderAt ? new Date(cust.lastOrderAt).toLocaleDateString() : "Never"}
                    </td>
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
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/owner/customers/${cust.id}`}
                          title="View Profile"
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
                          title="Merge Customer"
                          className="p-1 text-[color:var(--app-muted)] hover:text-purple-600 transition"
                        >
                          <GitMerge size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[color:var(--app-border)]/30 pt-2 text-xs">
            <span className="text-[color:var(--app-muted)] text-[11px]">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
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
