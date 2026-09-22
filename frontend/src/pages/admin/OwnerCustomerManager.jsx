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
  Phone,
  Mail,
  Tag,
  AlertCircle,
  Clock,
  Sparkles,
  Calendar,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import { showToast } from "../../utils/toast";

export default function OwnerCustomerManager() {
  const navigate = useNavigate();
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

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
    if (restaurantId) {
      fetchCustomers();
    }
  }, [restaurantId, pagination.page, statusFilter, sortBy, sortOrder]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/owner/${restaurantId}/customers`, {
        params: {
          query: searchQuery,
          page: pagination.page,
          limit: pagination.limit,
          status: statusFilter,
          sortBy,
          sortOrder,
        },
      });
      setCustomers(res.data.items || []);
      setPagination(res.data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      showToast.error("Failed to load customer list");
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
      await api.post(`/owner/${restaurantId}/customers`, formData);
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
      await api.put(`/owner/${restaurantId}/customers/${selectedCustomer.id}`, formData);
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
      const res = await api.post(`/owner/${restaurantId}/customers/merge`, {
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
    <div className="space-y-6 p-4 sm:p-6 text-[color:var(--app-text)]">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 uppercase tracking-wider">
            <Sparkles size={14} /> CRM & Customer Relations
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-3xl">
            Customer Directory
          </h1>
          <p className="mt-1 text-sm text-[color:var(--app-muted)]">
            Manage restaurant customers, view purchase history, saved addresses, and historical activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 shadow-md shadow-amber-500/20"
          >
            <Plus size={18} /> New Customer
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[color:var(--app-muted)]">Total Customers</span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500">
              <Users size={18} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--app-text)]">{pagination.total}</p>
        </div>

        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[color:var(--app-muted)]">Active Directory</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500">
              <UserCheck size={18} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--app-text)]">{activeCount}</p>
        </div>

        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[color:var(--app-muted)]">With Orders</span>
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-500">
              <ShoppingBag size={18} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--app-text)]">{customersWithOrders}</p>
        </div>

        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[color:var(--app-muted)]">Current Page</span>
            <div className="rounded-xl bg-purple-500/10 p-2 text-purple-500">
              <Calendar size={18} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--app-text)]">
            {pagination.page} / {pagination.totalPages}
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--app-muted)]" size={18} />
            <input
              type="text"
              placeholder="Search customer by name, phone, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] pl-10 pr-4 py-2 text-sm text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-xs">
              <Filter size={14} className="text-[color:var(--app-muted)]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent font-medium text-[color:var(--app-text)] outline-none cursor-pointer"
              >
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive / Merged</option>
                <option value="ALL">All Statuses</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-xs">
              <ArrowUpDown size={14} className="text-[color:var(--app-muted)]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-medium text-[color:var(--app-text)] outline-none cursor-pointer"
              >
                <option value="createdAt">Sort: Created Date</option>
                <option value="name">Sort: Name</option>
                <option value="orderCount">Sort: Total Orders</option>
                <option value="totalSpend">Sort: Total Spend</option>
                <option value="lastOrderDate">Sort: Last Order</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                className="ml-1 text-[10px] font-bold uppercase text-amber-500 hover:underline"
              >
                {sortOrder}
              </button>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-500/20 transition"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      {/* Customer List Table */}
      <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] shadow-sm">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm font-medium text-[color:var(--app-muted)]">
            Loading customers...
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Users className="h-12 w-12 text-[color:var(--app-muted)] opacity-50" />
            <h3 className="mt-3 text-base font-semibold text-[color:var(--app-text)]">No customers found</h3>
            <p className="mt-1 text-xs text-[color:var(--app-muted)]">
              Try adjusting your search criteria or register a new customer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-center">Orders</th>
                  <th className="px-4 py-3 text-right">Total Spend</th>
                  <th className="px-4 py-3">Last Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--app-border)]">
                {customers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-[color:var(--app-surface-2)]/50 transition">
                    <td className="px-4 py-3 font-semibold text-[color:var(--app-text)]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 font-bold text-amber-500">
                          {(cust.name || cust.phone || "C").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{cust.name || "Guest Customer"}</p>
                          <p className="text-[10px] text-[color:var(--app-muted)]">ID: #{cust.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-[color:var(--app-text)]">{cust.phone}</td>
                    <td className="px-4 py-3 text-[color:var(--app-muted)]">{cust.email || "-"}</td>
                    <td className="px-4 py-3 text-center font-bold text-[color:var(--app-text)]">
                      {cust.totalOrders || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-500">
                      ₹{Number(cust.totalSpent || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--app-muted)]">
                      {cust.lastOrderAt ? new Date(cust.lastOrderAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          cust.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {cust.status === "ACTIVE" ? <UserCheck size={10} /> : <UserX size={10} />}
                        {cust.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/owner/customers/${cust.id}`}
                          title="View Detail Profile"
                          className="rounded-lg p-1.5 text-[color:var(--app-muted)] hover:bg-amber-500/10 hover:text-amber-500 transition"
                        >
                          <Eye size={16} />
                        </Link>
                        <button
                          onClick={() => openEditModal(cust)}
                          title="Edit Customer"
                          className="rounded-lg p-1.5 text-[color:var(--app-muted)] hover:bg-blue-500/10 hover:text-blue-500 transition"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => openMergeModal(cust)}
                          title="Merge Customer"
                          className="rounded-lg p-1.5 text-[color:var(--app-muted)] hover:bg-purple-500/10 hover:text-purple-500 transition"
                        >
                          <GitMerge size={16} />
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
          <div className="flex items-center justify-between border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-4 py-3 text-xs">
            <span className="text-[color:var(--app-muted)]">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="flex items-center gap-1 rounded-lg border border-[color:var(--app-border)] px-3 py-1 font-medium disabled:opacity-40 hover:bg-[color:var(--app-surface-1)]"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="flex items-center gap-1 rounded-lg border border-[color:var(--app-border)] px-3 py-1 font-medium disabled:opacity-40 hover:bg-[color:var(--app-surface-1)]"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE CUSTOMER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-4">
              <h2 className="text-lg font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <Plus className="text-amber-500" size={20} /> Register New Customer
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-400 border border-red-500/20">
                <AlertCircle size={16} /> {formError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Phone Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Tags</label>
                  <input
                    type="text"
                    placeholder="Regular, VIP"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Prefers less spicy food, call before delivery..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[color:var(--app-border)] px-4 py-2 font-semibold text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-4">
              <h2 className="text-lg font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <Edit2 className="text-blue-500" size={20} /> Edit Customer Profile
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-400 border border-red-500/20">
                <AlertCircle size={16} /> {formError}
              </div>
            )}

            <form onSubmit={handleUpdateCustomer} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Customer Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Tags</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-[color:var(--app-border)] px-4 py-2 font-semibold text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-500 px-5 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-4">
              <h2 className="text-lg font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <GitMerge className="text-purple-500" size={20} /> Merge Duplicate Customer
              </h2>
              <button
                onClick={() => setShowMergeModal(false)}
                className="rounded-lg p-1 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-purple-500/10 p-3 text-xs text-purple-400 border border-purple-500/20">
              <p className="font-bold">Merging Customer #{selectedCustomer?.id} ({selectedCustomer?.name || selectedCustomer?.phone})</p>
              <p className="mt-1 opacity-90">
                All historical orders, reservations, addresses, and notes from this source customer will be transferred to the target customer.
              </p>
            </div>

            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-400 border border-red-500/20">
                <AlertCircle size={16} /> {formError}
              </div>
            )}

            <form onSubmit={handleMergeCustomers} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">
                  Select Target Customer to Merge INTO *
                </label>
                <select
                  value={mergeData.targetCustomerId}
                  onChange={(e) => setMergeData({ ...mergeData, targetCustomerId: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-purple-500 cursor-pointer"
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

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="rounded-xl border border-[color:var(--app-border)] px-4 py-2 font-semibold text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-purple-500 px-5 py-2 font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
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
