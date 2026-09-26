import React, { useState, useEffect } from "react";
import {
  Tag,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Percent,
  IndianRupee,
  Gift,
  Layers,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Users,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";

export default function OwnerDiscounts() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    code: "",
    type: "PERCENTAGE",
    value: 10,
    maximumDiscount: "",
    minimumOrderAmount: 0,
    minimumQuantity: 0,
    eligibleOrderTypes: "DINE_IN,TAKEAWAY,DELIVERY",
    startAt: "",
    endAt: "",
    usageLimit: "",
    usageLimitPerCustomer: 1,
    active: true,
    priority: 0,
  });

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (restaurantId) {
      fetchPromotions();
    }
  }, [restaurantId, pagination.page, activeFilter, typeFilter]);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/owner/${restaurantId}/promotions`, {
        params: {
          search,
          page: pagination.page,
          limit: pagination.limit,
          active: activeFilter,
          type: typeFilter,
        },
      });
      setPromotions(res.data.items || []);
      setPagination(res.data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error("Failed to fetch promotions:", err);
      showToast.error("Failed to load promotions");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchPromotions();
  };

  const openCreateModal = () => {
    setFormData({
      name: "",
      description: "",
      code: "",
      type: "PERCENTAGE",
      value: 10,
      maximumDiscount: "",
      minimumOrderAmount: 0,
      minimumQuantity: 0,
      eligibleOrderTypes: "DINE_IN,TAKEAWAY,DELIVERY",
      startAt: "",
      endAt: "",
      usageLimit: "",
      usageLimitPerCustomer: 1,
      active: true,
      priority: 0,
    });
    setFormError("");
    setShowCreateModal(true);
  };

  const openEditModal = (promo) => {
    setSelectedPromo(promo);
    setFormData({
      name: promo.name || "",
      description: promo.description || "",
      code: promo.code || "",
      type: promo.type || "PERCENTAGE",
      value: promo.value || 0,
      maximumDiscount: promo.maximumDiscount ?? "",
      minimumOrderAmount: promo.minimumOrderAmount || 0,
      minimumQuantity: promo.minimumQuantity || 0,
      eligibleOrderTypes: promo.eligibleOrderTypes || "DINE_IN,TAKEAWAY,DELIVERY",
      startAt: promo.startAt ? promo.startAt.split("T")[0] : "",
      endAt: promo.endAt ? promo.endAt.split("T")[0] : "",
      usageLimit: promo.usageLimit ?? "",
      usageLimitPerCustomer: promo.usageLimitPerCustomer ?? 1,
      active: promo.active ?? true,
      priority: promo.priority || 0,
    });
    setFormError("");
    setShowEditModal(true);
  };

  const handleCreatePromotion = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!formData.name.trim()) {
      setFormError("Promotion name is required");
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/owner/${restaurantId}/promotions`, formData);
      showToast.success("Promotion created successfully");
      setShowCreateModal(false);
      fetchPromotions();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create promotion";
      setFormError(msg);
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePromotion = async (e) => {
    e.preventDefault();
    setFormError("");
    try {
      setSubmitting(true);
      await api.put(`/owner/${restaurantId}/promotions/${selectedPromo.id}`, formData);
      showToast.success("Promotion updated successfully");
      setShowEditModal(false);
      fetchPromotions();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update promotion";
      setFormError(msg);
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (promo) => {
    try {
      await api.patch(`/owner/${restaurantId}/promotions/${promo.id}/status`, {
        active: !promo.active,
      });
      showToast.success(`Promotion '${promo.name}' ${!promo.active ? "activated" : "deactivated"}`);
      fetchPromotions();
    } catch (err) {
      showToast.error("Failed to update status");
    }
  };

  // KPIs
  const activeCount = promotions.filter((p) => p.active).length;
  const totalUses = promotions.reduce((sum, p) => sum + Number(p.usageCount || 0), 0);

  return (
    <div className="space-y-4 px-1 py-1 w-full text-[color:var(--app-text)]">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[color:var(--app-border)]/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 uppercase tracking-wider">
            <Sparkles size={14} /> Promotions & Offers Engine
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-3xl flex items-center gap-3">
            <OwnerMenuButton />
            Coupons & Discounts Studio
          </h1>
          <p className="mt-1 text-sm theme-muted">
            Create coupon codes, automatic discounts, percentage offers, and minimum order rules.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-600 shadow-md shadow-amber-500/20"
        >
          <Plus size={18} /> Create New Offer
        </button>
      </div>

      {/* KPI Stats (Words on Paper) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-2 border-b border-[color:var(--app-border)]/40">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold theme-muted">Active Offers</span>
            <div className="text-emerald-500">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold text-[color:var(--app-text)]">{activeCount}</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold theme-muted">Total Coupon Uses</span>
            <div className="text-amber-500">
              <Gift size={16} />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold text-[color:var(--app-text)]">{totalUses}</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold theme-muted">Total Offers</span>
            <div className="text-blue-500">
              <Tag size={16} />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold text-[color:var(--app-text)]">{pagination.total}</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold theme-muted">Current Page</span>
            <div className="text-purple-500">
              <Layers size={16} />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold text-[color:var(--app-text)]">
            {pagination.page} / {pagination.totalPages}
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="py-2 border-b border-[color:var(--app-border)]/40">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 theme-muted" size={18} />
            <input
              type="text"
              placeholder="Search offer by name or coupon code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--app-border)] bg-transparent pl-10 pr-4 py-2 text-sm text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-[color:var(--app-border)] bg-transparent px-3 py-1.5 text-xs">
              <Filter size={14} className="theme-muted" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent font-medium text-[color:var(--app-text)] outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[color:var(--app-bg)]">All Types</option>
                <option value="PERCENTAGE" className="bg-[color:var(--app-bg)]">Percentage %</option>
                <option value="FIXED_AMOUNT" className="bg-[color:var(--app-bg)]">Fixed Amount ₹</option>
                <option value="AUTOMATIC_OFFER" className="bg-[color:var(--app-bg)]">Automatic Offer</option>
                <option value="ITEM_DISCOUNT" className="bg-[color:var(--app-bg)]">Item Specific</option>
                <option value="CATEGORY_DISCOUNT" className="bg-[color:var(--app-bg)]">Category Specific</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-[color:var(--app-border)] bg-transparent px-3 py-1.5 text-xs">
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="bg-transparent font-medium text-[color:var(--app-text)] outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[color:var(--app-bg)]">All Statuses</option>
                <option value="true" className="bg-[color:var(--app-bg)]">Active Only</option>
                <option value="false" className="bg-[color:var(--app-bg)]">Inactive Only</option>
              </select>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-500/20 transition"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      {/* Promotions Table */}
      <div className="overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm font-medium theme-muted">
            Loading promotions...
          </div>
        ) : promotions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Gift className="h-12 w-12 theme-muted opacity-50" />
            <h3 className="mt-3 text-base font-semibold text-[color:var(--app-text)]">No promotions found</h3>
            <p className="mt-1 text-xs theme-muted">
              Create your first coupon code or automatic discount offer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b-2 border-[color:var(--app-border)] theme-muted uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Offer Name</th>
                  <th className="px-4 py-3">Coupon Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Value / Cap</th>
                  <th className="px-4 py-3">Min Order</th>
                  <th className="px-4 py-3">Validity</th>
                  <th className="px-4 py-3 text-center">Usage</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--app-border)]/40">
                {promotions.map((promo) => (
                  <tr key={promo.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-semibold text-[color:var(--app-text)]">
                      <div>
                        <p className="font-bold text-sm">{promo.name}</p>
                        {promo.description && (
                          <p className="text-[10px] theme-muted line-clamp-1">{promo.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-amber-500">
                      {promo.code ? (
                        <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 border border-amber-500/20">
                          {promo.code}
                        </span>
                      ) : (
                        <span className="theme-muted italic font-sans font-normal">Auto / No Code</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[color:var(--app-text)]">
                      <span className="px-2 py-0.5 text-[10px] font-semibold opacity-85">
                        {promo.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-500">
                      {promo.type === "PERCENTAGE" ? `${promo.value}%` : `₹${promo.value}`}
                      {promo.maximumDiscount ? ` (Max ₹${promo.maximumDiscount})` : ""}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--app-text)]">
                      {promo.minimumOrderAmount ? `₹${promo.minimumOrderAmount}` : "None"}
                    </td>
                    <td className="px-4 py-3 theme-muted">
                      {promo.startAt || promo.endAt ? (
                        <span>
                          {promo.startAt ? new Date(promo.startAt).toLocaleDateString() : "Start"} -{" "}
                          {promo.endAt ? new Date(promo.endAt).toLocaleDateString() : "No Expiry"}
                        </span>
                      ) : (
                        "Always Valid"
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-[color:var(--app-text)]">
                      {promo.usageCount} {promo.usageLimit ? `/ ${promo.usageLimit}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(promo)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer transition ${
                          promo.active
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                        }`}
                      >
                        {promo.active ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {promo.active ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(promo)}
                        className="rounded-lg p-1.5 theme-muted hover:bg-amber-500/10 hover:text-amber-500 transition"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[color:var(--app-border)]/50 pt-3 text-xs">
            <span className="theme-muted">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="flex items-center gap-1 rounded-lg border border-[color:var(--app-border)] px-3 py-1 font-medium disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="flex items-center gap-1 rounded-lg border border-[color:var(--app-border)] px-3 py-1 font-medium disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE PROMOTION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="theme-panel w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[color:var(--app-border)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/50 pb-3">
              <h2 className="text-lg font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <Plus className="text-amber-500" size={20} /> Create New Offer / Coupon
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 theme-muted hover:text-[color:var(--app-text)]"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-400 border border-red-500/20">
                <AlertCircle size={16} /> {formError}
              </div>
            )}

            <form onSubmit={handleCreatePromotion} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Offer Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Welcome 10% Discount"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Coupon Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="WELCOME100"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] font-mono font-bold uppercase outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Promotion Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="PERCENTAGE" className="bg-[color:var(--app-bg)]">Percentage (%)</option>
                    <option value="FIXED_AMOUNT" className="bg-[color:var(--app-bg)]">Fixed Amount (₹)</option>
                    <option value="AUTOMATIC_OFFER" className="bg-[color:var(--app-bg)]">Automatic Offer</option>
                    <option value="ITEM_DISCOUNT" className="bg-[color:var(--app-bg)]">Item Specific Discount</option>
                    <option value="CATEGORY_DISCOUNT" className="bg-[color:var(--app-bg)]">Category Specific Discount</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">
                    {formData.type === "PERCENTAGE" ? "Discount Percentage (%)" : "Discount Value (₹)"} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] font-bold outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Max Discount Cap (₹)</label>
                  <input
                    type="number"
                    placeholder="Optional max limit"
                    value={formData.maximumDiscount}
                    onChange={(e) => setFormData({ ...formData, maximumDiscount: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Min Order Amount (₹)</label>
                  <input
                    type="number"
                    value={formData.minimumOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minimumOrderAmount: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Min Quantity</label>
                  <input
                    type="number"
                    value={formData.minimumQuantity}
                    onChange={(e) => setFormData({ ...formData, minimumQuantity: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startAt}
                    onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.endAt}
                    onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Total Usage Limit</label>
                  <input
                    type="number"
                    placeholder="Unlimited if empty"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Usage / Customer</label>
                  <input
                    type="number"
                    value={formData.usageLimitPerCustomer}
                    onChange={(e) => setFormData({ ...formData, usageLimitPerCustomer: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Eligible Order Types</label>
                <input
                  type="text"
                  placeholder="DINE_IN,TAKEAWAY,DELIVERY"
                  value={formData.eligibleOrderTypes}
                  onChange={(e) => setFormData({ ...formData, eligibleOrderTypes: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[color:var(--app-border)]/50">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[color:var(--app-border)] px-4 py-2 font-semibold theme-muted hover:text-[color:var(--app-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-black hover:bg-amber-600 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROMOTION MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="theme-panel w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[color:var(--app-border)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/50 pb-3">
              <h2 className="text-lg font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <Edit2 className="text-amber-500" size={20} /> Edit Promotion #{selectedPromo?.id}
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 theme-muted hover:text-[color:var(--app-text)]"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-400 border border-red-500/20">
                <AlertCircle size={16} /> {formError}
              </div>
            )}

            <form onSubmit={handleUpdatePromotion} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Offer Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Coupon Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] font-mono font-bold uppercase outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Promotion Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="PERCENTAGE" className="bg-[color:var(--app-bg)]">Percentage (%)</option>
                    <option value="FIXED_AMOUNT" className="bg-[color:var(--app-bg)]">Fixed Amount (₹)</option>
                    <option value="AUTOMATIC_OFFER" className="bg-[color:var(--app-bg)]">Automatic Offer</option>
                    <option value="ITEM_DISCOUNT" className="bg-[color:var(--app-bg)]">Item Specific Discount</option>
                    <option value="CATEGORY_DISCOUNT" className="bg-[color:var(--app-bg)]">Category Specific Discount</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Discount Value *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] font-bold outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Max Discount Cap (₹)</label>
                  <input
                    type="number"
                    value={formData.maximumDiscount}
                    onChange={(e) => setFormData({ ...formData, maximumDiscount: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Min Order Amount (₹)</label>
                  <input
                    type="number"
                    value={formData.minimumOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minimumOrderAmount: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Usage Limit</label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[color:var(--app-border)]/50">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-[color:var(--app-border)] px-4 py-2 font-semibold theme-muted hover:text-[color:var(--app-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-black hover:bg-amber-600 disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Update Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
