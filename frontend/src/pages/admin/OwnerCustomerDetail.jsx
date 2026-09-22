import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  UserCheck,
  UserX,
  Phone,
  Mail,
  Calendar,
  ShoppingBag,
  IndianRupee,
  MapPin,
  Clock,
  Edit2,
  Plus,
  Trash2,
  FileText,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  Home,
  Briefcase,
  Layers,
  X,
  Gift,
  Award,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import { showToast } from "../../utils/toast";

export default function OwnerCustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Selected Order Modal for detailed historical snapshot
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Address Modal state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: "Home",
    name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    notes: "",
    isDefault: false,
  });
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);

  const [loyaltyAccount, setLoyaltyAccount] = useState(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);

  useEffect(() => {
    if (restaurantId && customerId) {
      fetchCustomerDetail();
    }
  }, [restaurantId, customerId]);

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/owner/${restaurantId}/customers/${customerId}`);
      setCustomer(res.data);

      api.get(`/owner/${restaurantId}/loyalty/customer/${customerId}`)
        .then((lRes) => {
          setLoyaltyAccount(lRes.data?.account || null);
          setLoyaltyHistory(lRes.data?.history || []);
        })
        .catch(() => {});
    } catch (err) {
      console.error("Failed to fetch customer detail:", err);
      showToast.error("Customer not found or access denied");
      navigate("/owner/customers");
    } finally {
      setLoading(false);
    }
  };

  const openAddAddressModal = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: "Home",
      name: customer?.name || "",
      phone: customer?.phone || "",
      line1: "",
      line2: "",
      city: restaurant?.city || "",
      state: restaurant?.state || "",
      postalCode: "",
      notes: "",
      isDefault: customer?.addresses?.length === 0,
    });
    setShowAddressModal(true);
  };

  const openEditAddressModal = (addr) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      label: addr.label || "Home",
      name: addr.name || "",
      phone: addr.phone || "",
      line1: addr.line1 || "",
      line2: addr.line2 || "",
      city: addr.city || "",
      state: addr.state || "",
      postalCode: addr.postalCode || "",
      notes: addr.notes || "",
      isDefault: addr.isDefault || false,
    });
    setShowAddressModal(true);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!addressForm.line1.trim()) {
      showToast.error("Address line 1 is required");
      return;
    }
    try {
      setSavingAddress(true);
      if (editingAddressId) {
        await api.put(`/owner/${restaurantId}/customers/${customerId}/addresses/${editingAddressId}`, addressForm);
        showToast.success("Address updated");
      } else {
        await api.post(`/owner/${restaurantId}/customers/${customerId}/addresses`, addressForm);
        showToast.success("Address added");
      }
      setShowAddressModal(false);
      fetchCustomerDetail();
    } catch (err) {
      showToast.error(err.response?.data?.message || "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    try {
      await api.delete(`/owner/${restaurantId}/customers/${customerId}/addresses/${addressId}`);
      showToast.success("Address deleted");
      fetchCustomerDetail();
    } catch (err) {
      showToast.error("Failed to delete address");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-medium text-[color:var(--app-muted)]">
        Loading customer profile...
      </div>
    );
  }

  if (!customer) return null;

  const stats = customer.stats || {};
  const orders = customer.orders || [];
  const payments = customer.payments || [];
  const reservations = customer.reservations || [];
  const addresses = customer.addresses || [];
  const activity = customer.activity || [];

  return (
    <div className="space-y-6 p-4 sm:p-6 text-[color:var(--app-text)]">
      {/* Top Navigation & Profile Header */}
      <div>
        <Link
          to="/owner/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--app-muted)] hover:text-amber-500 transition mb-4"
        >
          <ArrowLeft size={16} /> Back to Customer Directory
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl font-bold text-amber-500">
              {(customer.name || customer.phone || "C").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-[color:var(--app-text)] sm:text-2xl">
                  {customer.name || "Guest Customer"}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    customer.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {customer.status === "ACTIVE" ? <UserCheck size={10} /> : <UserX size={10} />}
                  {customer.status}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-[color:var(--app-muted)]">
                <span className="flex items-center gap-1 font-medium">
                  <Phone size={13} className="text-amber-500" /> {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1 font-medium">
                    <Mail size={13} className="text-blue-500" /> {customer.email}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> Joined {new Date(customer.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[color:var(--app-border)] pb-2 overflow-x-auto text-xs font-semibold">
        {[
          { id: "overview", label: "Overview", icon: <Layers size={15} /> },
          { id: "loyalty", label: `Loyalty Points (${loyaltyAccount?.currentBalance ?? customer.rewardPoints ?? 0})`, icon: <Gift size={15} /> },
          { id: "orders", label: `Orders (${orders.length})`, icon: <ShoppingBag size={15} /> },
          { id: "payments", label: `Payments (${payments.length})`, icon: <IndianRupee size={15} /> },
          { id: "reservations", label: `Reservations (${reservations.length})`, icon: <Calendar size={15} /> },
          { id: "addresses", label: `Addresses (${addresses.length})`, icon: <MapPin size={15} /> },
          { id: "activity", label: `Activity (${activity.length})`, icon: <Clock size={15} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                : "text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)] hover:text-[color:var(--app-text)]"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Factual Stat Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm">
              <span className="text-xs font-medium text-[color:var(--app-muted)]">Total Orders</span>
              <p className="mt-1 text-2xl font-bold text-[color:var(--app-text)]">{stats.totalOrders || 0}</p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm">
              <span className="text-xs font-medium text-[color:var(--app-muted)]">Total Spent</span>
              <p className="mt-1 text-2xl font-bold text-emerald-500">₹{Number(stats.totalSpent || 0).toLocaleString()}</p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm">
              <span className="text-xs font-medium text-[color:var(--app-muted)]">Avg Order Value</span>
              <p className="mt-1 text-2xl font-bold text-blue-500">₹{Number(stats.averageOrderValue || 0).toLocaleString()}</p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm">
              <span className="text-xs font-medium text-[color:var(--app-muted)]">Cancelled Orders</span>
              <p className="mt-1 text-2xl font-bold text-red-400">{stats.cancelledOrders || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Notes & Tags Box */}
            <div className="space-y-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-5 shadow-sm">
              <h3 className="text-sm font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <FileText size={16} className="text-amber-500" /> Internal Notes & Operational Tags
              </h3>

              <div>
                <span className="text-xs font-semibold text-[color:var(--app-muted)]">Operational Tags:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {customer.tags ? (
                    customer.tags.split(",").map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500 border border-amber-500/20"
                      >
                        <Tag size={12} /> {t.trim()}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[color:var(--app-muted)] italic">No tags assigned</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-[color:var(--app-muted)]">Staff Notes:</span>
                <p className="mt-1 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-3 text-xs text-[color:var(--app-text)] whitespace-pre-wrap">
                  {customer.notes || "No internal staff notes entered for this customer."}
                </p>
              </div>
            </div>

            {/* Dates & Timeline Summary */}
            <div className="space-y-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-5 shadow-sm text-xs">
              <h3 className="text-sm font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <Clock size={16} className="text-blue-500" /> Key Dates & Milestones
              </h3>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between rounded-xl border border-[color:var(--app-border)] p-3 bg-[color:var(--app-surface-2)]">
                  <span className="text-[color:var(--app-muted)]">First Order Date:</span>
                  <span className="font-semibold text-[color:var(--app-text)]">
                    {stats.firstOrderAt ? new Date(stats.firstOrderAt).toLocaleString() : "Never"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[color:var(--app-border)] p-3 bg-[color:var(--app-surface-2)]">
                  <span className="text-[color:var(--app-muted)]">Last Order Date:</span>
                  <span className="font-semibold text-[color:var(--app-text)]">
                    {stats.lastOrderAt ? new Date(stats.lastOrderAt).toLocaleString() : "Never"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[color:var(--app-border)] p-3 bg-[color:var(--app-surface-2)]">
                  <span className="text-[color:var(--app-muted)]">Total Refunded Amount:</span>
                  <span className="font-semibold text-red-400">
                    ₹{Number(stats.totalRefunded || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: LOYALTY REWARDS */}
      {activeTab === "loyalty" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-sm">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Current Balance</span>
              <p className="mt-1 text-3xl font-extrabold text-amber-500">
                {loyaltyAccount?.currentBalance ?? customer.rewardPoints ?? 0} <span className="text-sm font-normal">pts</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">Available for redemption at POS checkout</p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-sm">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Lifetime Earned</span>
              <p className="mt-1 text-3xl font-extrabold text-emerald-500">
                +{loyaltyAccount?.lifetimeEarned || 0} <span className="text-sm font-normal">pts</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">Total points granted across completed orders</p>
            </div>

            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5 shadow-sm">
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Lifetime Redeemed</span>
              <p className="mt-1 text-3xl font-extrabold text-purple-500">
                {loyaltyAccount?.lifetimeRedeemed || 0} <span className="text-sm font-normal">pts</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">Total points redeemed for order discounts</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[color:var(--app-text)] flex items-center gap-2">
              <Gift size={16} className="text-amber-500" /> Loyalty Transaction Audit History
            </h3>

            {loyaltyHistory.length === 0 ? (
              <p className="text-xs text-[color:var(--app-muted)] py-6 text-center italic">
                No loyalty points history found for this customer.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[color:var(--app-border)] text-[color:var(--app-muted)] uppercase tracking-wider font-bold">
                      <th className="py-2.5 px-2">Date</th>
                      <th className="py-2.5 px-2">Type</th>
                      <th className="py-2.5 px-2 text-right">Points</th>
                      <th className="py-2.5 px-2 text-right">Balance</th>
                      <th className="py-2.5 px-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--app-border)]">
                    {loyaltyHistory.map((txn) => {
                      const isPositive = txn.points > 0;
                      return (
                        <tr key={txn.id} className="hover:bg-[color:var(--app-surface-2)] transition">
                          <td className="py-2.5 px-2 text-[color:var(--app-muted)] whitespace-nowrap">
                            {new Date(txn.createdAt).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                txn.type === "EARN"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : txn.type === "REDEEM"
                                  ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                                  : txn.type.startsWith("MANUAL")
                                  ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}
                            >
                              {txn.type.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className={`py-2.5 px-2 text-right font-bold ${isPositive ? "text-emerald-500" : "text-rose-400"}`}>
                            {isPositive ? `+${txn.points}` : txn.points}
                          </td>
                          <td className="py-2.5 px-2 text-right font-semibold">
                            {txn.balanceAfter}
                          </td>
                          <td className="py-2.5 px-2 text-[color:var(--app-muted)]">
                            {txn.description || "--"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ORDERS */}
      {activeTab === "orders" && (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] shadow-sm">
          {orders.length === 0 ? (
            <div className="p-12 text-center text-xs text-[color:var(--app-muted)]">
              No historical orders found for this customer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-muted)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Order No</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Table</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--app-border)]">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-[color:var(--app-surface-2)]/50 transition">
                      <td className="px-4 py-3 font-bold text-[color:var(--app-text)]">#{o.orderNo}</td>
                      <td className="px-4 py-3 text-[color:var(--app-muted)]">
                        {new Date(o.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[color:var(--app-text)]">{o.orderSource || "POS"}</td>
                      <td className="px-4 py-3 text-[color:var(--app-muted)]">{o.tableNo || "-"}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-500">₹{Number(o.total || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            o.paymentStatus === "PAID"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[color:var(--app-text)]">{o.status}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="rounded-lg bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-500 hover:bg-amber-500/20"
                        >
                          View Snapshot
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENTS */}
      {activeTab === "payments" && (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] shadow-sm">
          {payments.length === 0 ? (
            <div className="p-12 text-center text-xs text-[color:var(--app-muted)]">
              No payment transactions recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-muted)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Payment ID</th>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Payment Mode</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Txn Ref</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--app-border)]">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-[color:var(--app-surface-2)]/50 transition">
                      <td className="px-4 py-3 font-bold text-[color:var(--app-text)]">#{p.id}</td>
                      <td className="px-4 py-3 text-[color:var(--app-muted)]">#{p.orderId}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-500">₹{Number(p.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 font-semibold text-[color:var(--app-text)]">{p.paymentMode || "CASH"}</td>
                      <td className="px-4 py-3 font-bold">{p.status}</td>
                      <td className="px-4 py-3 text-[color:var(--app-muted)] font-mono text-[10px]">
                        {p.transactionId ? `${p.transactionId.slice(0, 12)}...` : "-"}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--app-muted)]">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RESERVATIONS */}
      {activeTab === "reservations" && (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] shadow-sm">
          {reservations.length === 0 ? (
            <div className="p-12 text-center text-xs text-[color:var(--app-muted)]">
              No table reservations found for this customer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-muted)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Reservation No</th>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3 text-center">Guests</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--app-border)]">
                  {reservations.map((r) => (
                    <tr key={r.id} className="hover:bg-[color:var(--app-surface-2)]/50 transition">
                      <td className="px-4 py-3 font-bold text-[color:var(--app-text)]">#{r.reservationNo}</td>
                      <td className="px-4 py-3 text-[color:var(--app-muted)]">
                        {new Date(r.reservationDate).toLocaleDateString()} ({r.startTime} - {r.endTime})
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[color:var(--app-text)]">{r.guestCount}</td>
                      <td className="px-4 py-3 font-semibold text-[color:var(--app-text)]">{r.status}</td>
                      <td className="px-4 py-3 text-[color:var(--app-muted)]">{r.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ADDRESSES */}
      {activeTab === "addresses" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[color:var(--app-text)] flex items-center gap-2">
              <MapPin size={16} className="text-amber-500" /> Saved Customer Addresses
            </h3>
            <button
              onClick={openAddAddressModal}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition"
            >
              <Plus size={15} /> Add Address
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-12 text-center text-xs text-[color:var(--app-muted)]">
              No saved addresses found for this customer.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="relative space-y-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-500">
                        {addr.label === "Home" ? <Home size={12} /> : <Briefcase size={12} />} {addr.label}
                      </span>
                      {addr.isDefault && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
                          DEFAULT
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditAddressModal(addr)}
                        className="rounded-lg p-1.5 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-[color:var(--app-text)]">{addr.name || customer.name}</p>
                  <p className="text-xs text-[color:var(--app-muted)]">Phone: {addr.phone || customer.phone}</p>
                  <p className="text-xs text-[color:var(--app-text)]">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ""}
                    {addr.city ? `, ${addr.city}` : ""}
                    {addr.state ? `, ${addr.state}` : ""}
                    {addr.postalCode ? ` - ${addr.postalCode}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: FACTUAL ACTIVITY TIMELINE */}
      {activeTab === "activity" && (
        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[color:var(--app-text)] mb-4 flex items-center gap-2">
            <Clock size={16} className="text-purple-500" /> Factual Activity Timeline
          </h3>

          <div className="relative border-l-2 border-[color:var(--app-border)] pl-4 space-y-6">
            {activity.map((act) => (
              <div key={act.id} className="relative">
                <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-amber-500 border-2 border-[color:var(--app-surface-1)]" />
                <p className="text-xs font-bold text-[color:var(--app-text)]">{act.title}</p>
                <p className="text-xs text-[color:var(--app-muted)]">{act.description}</p>
                <p className="text-[10px] text-[color:var(--app-muted)] mt-0.5">
                  {new Date(act.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HISTORICAL ORDER SNAPSHOT MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-3">
              <h3 className="text-base font-bold text-[color:var(--app-text)]">
                Order Snapshot #{selectedOrder.orderNo}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-1 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs space-y-1 text-[color:var(--app-muted)]">
              <p><span className="font-semibold text-[color:var(--app-text)]">Date:</span> {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              <p><span className="font-semibold text-[color:var(--app-text)]">Status:</span> {selectedOrder.status} ({selectedOrder.paymentStatus})</p>
              {selectedOrder.deliveryAddress && (
                <p><span className="font-semibold text-[color:var(--app-text)]">Historical Address:</span> {selectedOrder.deliveryAddress}</p>
              )}
            </div>

            <div className="border border-[color:var(--app-border)] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[color:var(--app-surface-2)] text-[color:var(--app-muted)] font-semibold border-b border-[color:var(--app-border)]">
                  <tr>
                    <th className="px-3 py-2">Item (Historical Snapshot)</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--app-border)]">
                  {(selectedOrder.items || []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-[color:var(--app-text)]">{item.itemName}</td>
                      <td className="px-3 py-2 text-center">{item.qty}</td>
                      <td className="px-3 py-2 text-right">₹{Number(item.price).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-bold">₹{Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-[color:var(--app-border)]">
              <span>Total Amount Paid:</span>
              <span className="text-emerald-500 text-sm">₹{Number(selectedOrder.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ADDRESS FORM MODAL */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-3">
              <h3 className="text-base font-bold text-[color:var(--app-text)]">
                {editingAddressId ? "Edit Customer Address" : "Add New Customer Address"}
              </h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="rounded-lg p-1 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Address Label</label>
                <select
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  placeholder="Flat / House No / Street"
                  value={addressForm.line1}
                  onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--app-text)] mb-1">Address Line 2</label>
                <input
                  type="text"
                  placeholder="Landmark / Locality"
                  value={addressForm.line2}
                  onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">City</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[color:var(--app-text)] mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-2 text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="isDefault" className="font-semibold text-[color:var(--app-text)] cursor-pointer">
                  Set as Default Delivery Address
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="rounded-xl border border-[color:var(--app-border)] px-4 py-2 font-semibold text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {savingAddress ? "Saving..." : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
