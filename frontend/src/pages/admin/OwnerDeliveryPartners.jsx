import { useEffect, useState } from "react";
import { Plus, Search, Truck, Phone, Mail, Edit3, Trash2, CheckCircle2, XCircle, Loader2, User } from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

const VEHICLE_TYPES = [
  { value: "BIKE", label: "Motorcycle / Bike 🏍️" },
  { value: "SCOOTER", label: "Scooter 🛵" },
  { value: "EV", label: "Electric Vehicle ⚡" },
  { value: "BICYCLE", label: "Bicycle 🚲" },
  { value: "CAR", label: "Car 🚗" },
];

export default function OwnerDeliveryPartners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    vehicleType: "BIKE",
    vehicleNumber: "",
    isActive: true,
  });

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const res = await api.get("/delivery/partners", { params: { search } });
      if (res.data?.success) {
        setPartners(res.data.partners || []);
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load delivery partners", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [search]);

  const handleOpenModal = (partner = null) => {
    if (partner) {
      setEditingPartner(partner);
      setFormData({
        name: partner.name || "",
        phone: partner.phone || "",
        email: partner.email || "",
        vehicleType: partner.vehicleType || "BIKE",
        vehicleNumber: partner.vehicleNumber || "",
        isActive: Boolean(partner.isActive),
      });
    } else {
      setEditingPartner(null);
      setFormData({
        name: "",
        phone: "",
        email: "",
        vehicleType: "BIKE",
        vehicleNumber: "",
        isActive: true,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      showToast("Name and phone number are required.", { type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      if (editingPartner) {
        await api.put(`/delivery/partners/${editingPartner.id}`, formData);
        showToast("Delivery partner updated successfully!", { type: "success" });
      } else {
        await api.post("/delivery/partners", formData);
        showToast("Delivery partner created successfully!", { type: "success" });
      }
      setModalOpen(false);
      fetchPartners();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save delivery partner", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (partner) => {
    try {
      if (partner.isActive) {
        await api.delete(`/delivery/partners/${partner.id}`);
        showToast(`${partner.name} deactivated.`, { type: "info" });
      } else {
        await api.put(`/delivery/partners/${partner.id}`, { isActive: true, status: "AVAILABLE" });
        showToast(`${partner.name} activated.`, { type: "success" });
      }
      fetchPartners();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update partner status", { type: "error" });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
            <Truck className="text-amber-500" size={28} />
            Delivery Partners
          </h1>
          <p className="theme-muted text-sm mt-1">
            Manage drivers, contact details, vehicle info, and active availability.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="theme-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold text-sm shadow-md"
        >
          <Plus size={18} />
          Add Delivery Partner
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between theme-panel rounded-2xl p-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by driver name, phone, vehicle no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/10 py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-400 border border-emerald-500/30">
            Available: {partners.filter((p) => p.status === "AVAILABLE" && p.isActive).length}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-amber-400 border border-amber-500/30">
            Busy: {partners.filter((p) => p.status === "BUSY" && p.isActive).length}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/15 px-3 py-1 text-gray-400 border border-gray-500/30">
            Total: {partners.length}
          </span>
        </div>
      </div>

      {/* Partners Cards / Table */}
      {loading ? (
        <div className="theme-panel rounded-3xl p-12 text-center">
          <Loader2 className="animate-spin mx-auto text-amber-500" size={32} />
          <p className="theme-muted mt-3 text-sm">Loading delivery partners...</p>
        </div>
      ) : partners.length === 0 ? (
        <div className="theme-panel rounded-3xl p-12 text-center space-y-4">
          <Truck size={48} className="mx-auto text-gray-500 opacity-40" />
          <h3 className="text-lg font-bold">No delivery partners found</h3>
          <p className="theme-muted text-sm max-w-md mx-auto">
            Get started by adding your restaurant's delivery drivers or riders to assign order deliveries.
          </p>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="theme-button inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 font-semibold text-sm"
          >
            <Plus size={16} />
            Add First Partner
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((partner) => {
            const isAvailable = partner.status === "AVAILABLE" && partner.isActive;
            const isBusy = partner.status === "BUSY" && partner.isActive;

            return (
              <div
                key={partner.id}
                className="theme-panel rounded-3xl p-5 border border-white/10 hover:border-amber-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
                        {partner.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-base leading-tight">{partner.name}</h3>
                        <p className="theme-muted text-xs flex items-center gap-1.5 mt-0.5">
                          <Phone size={12} />
                          {partner.phone}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                        isAvailable
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : isBusy
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-emerald-400 animate-pulse" : isBusy ? "bg-amber-400" : "bg-rose-400"}`} />
                      {partner.isActive ? partner.status : "INACTIVE"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl border border-white/5 bg-black/10 p-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="theme-muted">Vehicle Type</span>
                      <span className="font-semibold">{partner.vehicleType}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="theme-muted">Vehicle No</span>
                      <span className="font-mono font-bold text-amber-300">{partner.vehicleNumber || "N/A"}</span>
                    </div>
                    {partner.email && (
                      <div className="flex justify-between items-center">
                        <span className="theme-muted">Email</span>
                        <span className="truncate max-w-[160px]">{partner.email}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-white/5 pt-2">
                      <span className="theme-muted">Active Deliveries</span>
                      <span className="font-bold text-emerald-400">{partner.activeDeliveriesCount || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(partner)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${
                      partner.isActive
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    {partner.isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                    {partner.isActive ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenModal(partner)}
                    className="theme-soft-button inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Partner Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="theme-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 border border-white/20">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Truck className="text-amber-500" size={22} />
                {editingPartner ? "Edit Delivery Partner" : "Add Delivery Partner"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="theme-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/10 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-black/10 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="driver@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-black/10 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-black/10 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v.value} value={v.value} className="bg-gray-900 text-white">
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Vehicle Registration No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TS09-EZ-4589"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-black/10 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="cursor-pointer font-semibold text-xs">
                  Active Delivery Partner
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="theme-soft-button rounded-xl px-4 py-2.5 font-semibold text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="theme-button inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-xs shadow-md"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {editingPartner ? "Update Partner" : "Save Partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
