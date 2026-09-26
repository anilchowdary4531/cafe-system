import { useEffect, useState, useRef } from "react";
import { Truck, Search, Plus, MapPin, User, Clock, Phone, AlertCircle, RefreshCw, CheckCircle2, ShieldAlert, Loader2, Navigation } from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { loadGoogleMaps, getGoogleMapsApiKey } from "../../utils/googleMapsLoader";
import { MAP_CONFIG } from "../../utils/mapConfig";
import OwnerMenuButton from "../../components/OwnerMenuButton";

const DELIVERY_STATUS_TABS = [
  { key: "ALL", label: "All Deliveries" },
  { key: "UNASSIGNED", label: "Unassigned" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "REACHED_RESTAURANT", label: "At Restaurant" },
  { key: "PICKED_UP", label: "Picked Up" },
  { key: "OUT_FOR_DELIVERY", label: "Out For Delivery" },
  { key: "DELIVERED", label: "Delivered" },
];

const formatMoney = (value) => `₹${Math.round(Number(value || 0))}`;

const formatTimeAgo = (isoDate) => {
  if (!isoDate) return "";
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return "";
  const mins = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
};

export default function OwnerDeliveryManager() {
  const [deliveries, setDeliveries] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("ALL");
  const [search, setSearch] = useState("");

  // Assign / Reassign Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetOrder, setTargetOrder] = useState(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Map Modal State
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapTargetDelivery, setMapTargetDelivery] = useState(null);

  const fetchDeliveriesAndPartners = async () => {
    try {
      setLoading(true);
      const [delRes, partRes] = await Promise.all([
        api.get("/delivery/orders", { params: { search } }).catch(() => ({ data: [] })),
        api.get("/delivery/partners", { params: { isActive: true } }).catch(() => ({ data: [] })),
      ]);

      const delData = delRes.data?.deliveries || (Array.isArray(delRes.data) ? delRes.data : []);
      const partData = partRes.data?.partners || (Array.isArray(partRes.data) ? partRes.data : []);

      setDeliveries(Array.isArray(delData) ? delData : []);
      setPartners(Array.isArray(partData) ? partData : []);
    } catch (err) {
      console.error("Failed to load delivery data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveriesAndPartners();
    const interval = setInterval(fetchDeliveriesAndPartners, 15000);
    return () => clearInterval(interval);
  }, [search]);

  const filteredDeliveries = deliveries.filter((d) => {
    if (statusTab === "ALL") return true;
    return d.status === statusTab;
  });

  const handleOpenAssignModal = (deliveryOrOrder) => {
    setTargetOrder(deliveryOrOrder);
    setSelectedPartnerId(deliveryOrOrder.deliveryPartnerId || deliveryOrOrder.deliveryPartner?.id || "");
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPartnerId) {
      showToast("Please select a delivery partner.", { type: "error" });
      return;
    }

    try {
      setSubmittingAssign(true);
      const isReassign = Boolean(targetOrder.deliveryPartnerId || targetOrder.id);
      if (isReassign && targetOrder.id) {
        await api.post("/delivery/reassign", {
          deliveryId: targetOrder.id,
          newPartnerId: selectedPartnerId,
          reason: "Reassigned by manager",
        });
        showToast("Delivery partner reassigned successfully!", { type: "success" });
      } else {
        await api.post("/delivery/assign", {
          orderId: targetOrder.orderId || targetOrder.order?.id || targetOrder.id,
          partnerId: selectedPartnerId,
        });
        showToast("Delivery partner assigned successfully!", { type: "success" });
      }
      setAssignModalOpen(false);
      fetchDeliveriesAndPartners();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to assign delivery partner", { type: "error" });
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleOpenMapModal = (delivery) => {
    setMapTargetDelivery(delivery);
    setMapModalOpen(true);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-3">
            <OwnerMenuButton />
            <Truck className="text-amber-500" size={28} />
            Delivery Studio & Live Tracking
          </h1>
          <p className="theme-muted text-sm mt-1">
            Track active order deliveries, assign drivers, and monitor delivery progress in real time.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDeliveriesAndPartners}
          className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 font-semibold text-xs"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Search & Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2 border-b border-[color:var(--app-border)]/40">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 theme-muted" />
            <input
              type="text"
              placeholder="Search order #, customer, address, driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-b border-[color:var(--app-border)] py-2 pl-10 pr-4 text-sm text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none focus:border-amber-500"
            />
          </div>

          <div className="text-xs font-semibold theme-muted">
            Total Deliveries: <span className="text-[color:var(--app-text)] font-bold">{deliveries.length}</span>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none border-b border-[color:var(--app-border)]/40">
          {DELIVERY_STATUS_TABS.map((tab) => {
            const count = tab.key === "ALL" ? deliveries.length : deliveries.filter((d) => d.status === tab.key).length;
            const active = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusTab(tab.key)}
                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold transition border-b-2 ${
                  active
                    ? "border-amber-500 text-amber-500 font-extrabold"
                    : "border-transparent theme-muted hover:text-[color:var(--app-text)]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-amber-500/20 text-amber-500" : "bg-white/10 theme-muted"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Delivery Cards Grid */}
      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="animate-spin mx-auto text-amber-500" size={32} />
          <p className="theme-muted mt-3 text-sm">Loading active deliveries...</p>
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <Truck size={48} className="mx-auto theme-muted opacity-40" />
          <h3 className="text-lg font-bold text-[color:var(--app-text)]">No deliveries in this tab</h3>
          <p className="theme-muted text-sm">No delivery orders currently match the selected filter.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDeliveries.map((delivery) => {
            const order = delivery.order || {};
            const partner = delivery.deliveryPartner || {};
            const isCod = ["CASH", "COD"].includes(String(order.paymentMode || "").toUpperCase());
            const isPaidOnline = String(order.paymentStatus || "").toUpperCase() === "SUCCESS" && !isCod;

            return (
              <div
                key={delivery.id}
                className="py-4 border-b border-[color:var(--app-border)]/40 hover:bg-[color:var(--app-surface)]/20 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Order & Status Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-[color:var(--app-border)]/40 pb-3">
                    <div>
                      <span className="theme-muted text-[10px] font-extrabold uppercase tracking-widest">Order ID</span>
                      <h3 className="text-lg font-bold text-amber-500 font-mono">
                        #{order.orderNo || delivery.orderId}
                      </h3>
                      <span className="text-[11px] theme-muted flex items-center gap-1 mt-0.5">
                        <Clock size={12} />
                        {formatTimeAgo(delivery.createdAt)}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          delivery.status === "DELIVERED"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : delivery.status === "OUT_FOR_DELIVERY"
                            ? "bg-sky-500/15 text-sky-400 animate-pulse"
                            : delivery.status === "UNASSIGNED"
                            ? "bg-rose-500/15 text-rose-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {delivery.status.replace(/_/g, " ")}
                      </span>

                      {/* Payment Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPaidOnline
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {isPaidOnline ? "PAID ONLINE" : `COD: ${formatMoney(order.total)}`}
                      </span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[color:var(--app-text)]">{order.customerName || "Customer"}</span>
                      {order.phone && (
                        <a href={`tel:${order.phone}`} className="text-amber-500 hover:underline flex items-center gap-1 font-mono">
                          <Phone size={12} />
                          {order.phone}
                        </a>
                      )}
                    </div>

                    <p className="theme-muted text-xs leading-relaxed flex items-start gap-1.5 line-clamp-2">
                      <MapPin size={13} className="shrink-0 text-amber-500 mt-0.5" />
                      <span>{delivery.deliveryAddressSnapshot || "Address not provided"}</span>
                    </p>
                  </div>

                  {/* Assigned Driver Box */}
                  <div className="mt-4 pt-3 border-t border-[color:var(--app-border)]/30">
                    <div className="flex items-center justify-between">
                      <span className="theme-muted text-[10px] font-bold uppercase tracking-wider">Assigned Driver</span>
                      {partner.id ? (
                        <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Assigned
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-rose-400 flex items-center gap-1">
                          <AlertCircle size={12} /> Unassigned
                        </span>
                      )}
                    </div>

                    {partner.id ? (
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[color:var(--app-text)]">{partner.name}</p>
                          <p className="theme-muted text-[11px]">{partner.vehicleType} • {partner.vehicleNumber}</p>
                        </div>
                        <a href={`tel:${partner.phone}`} className="p-2 text-amber-500 hover:underline">
                          <Phone size={14} />
                        </a>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs theme-muted italic">No delivery partner assigned yet.</p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-[color:var(--app-border)]/30">
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal(delivery)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:underline"
                  >
                    <User size={13} />
                    {partner.id ? "Reassign" : "Assign Partner"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenMapModal(delivery)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:underline"
                  >
                    <Navigation size={13} />
                    Live Map
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Driver Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="theme-panel w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 border border-white/20">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Truck className="text-amber-500" size={22} />
                Assign Delivery Partner
              </h2>
              <button type="button" onClick={() => setAssignModalOpen(false)} className="theme-muted hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-sm">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-3 text-xs space-y-1">
                <p><strong>Order:</strong> #{targetOrder?.orderNo || targetOrder?.order?.orderNo || targetOrder?.orderId}</p>
                <p className="truncate"><strong>Customer Address:</strong> {targetOrder?.deliveryAddressSnapshot || targetOrder?.deliveryAddress || "N/A"}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Select Partner *
                </label>
                {partners.length === 0 ? (
                  <p className="text-xs text-rose-400 italic">No active delivery partners found. Add partners first.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {partners.map((p) => {
                      const selected = String(selectedPartnerId) === String(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPartnerId(p.id)}
                          className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition ${
                            selected
                              ? "border-amber-500 bg-amber-500/15"
                              : "border-white/10 bg-black/10 hover:border-white/30"
                          }`}
                        >
                          <div>
                            <p className="font-bold text-sm">{p.name}</p>
                            <p className="theme-muted text-xs">{p.vehicleType} ({p.vehicleNumber}) • {p.phone}</p>
                          </div>

                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.status === "AVAILABLE" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                            {p.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="theme-soft-button rounded-xl px-4 py-2.5 font-semibold text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingAssign || !selectedPartnerId}
                  className="theme-button inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-xs shadow-md disabled:opacity-50"
                >
                  {submittingAssign && <Loader2 size={14} className="animate-spin" />}
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Map Modal */}
      {mapModalOpen && mapTargetDelivery && (
        <DeliveryLiveMapModal
          delivery={mapTargetDelivery}
          onClose={() => setMapModalOpen(false)}
        />
      )}
    </div>
  );
}

function DeliveryLiveMapModal({ delivery, onClose }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    let isSubscribed = true;

    if (!getGoogleMapsApiKey()) {
      setMapError("Google Maps API Key is not configured.");
      return;
    }

    loadGoogleMaps(["maps", "marker"])
      .then((google) => {
        if (!isSubscribed || !mapContainerRef.current) return;

        const restLat = Number(delivery.restaurant?.latitude || MAP_CONFIG.defaultCenter.lat);
        const restLng = Number(delivery.restaurant?.longitude || MAP_CONFIG.defaultCenter.lng);
        const destLat = Number(delivery.deliveryLatitude || restLat + 0.015);
        const destLng = Number(delivery.deliveryLongitude || restLng + 0.015);

        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: restLat, lng: restLng },
          zoom: 13,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
        });

        mapRef.current = map;

        // Restaurant Marker 🏪
        new google.maps.Marker({
          position: { lat: restLat, lng: restLng },
          map,
          title: "Restaurant Outlet",
          icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        });

        // Customer Destination Marker 📍
        new google.maps.Marker({
          position: { lat: destLat, lng: destLng },
          map,
          title: "Customer Address",
          icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        });

        // Driver Marker (if present) 🚗
        if (delivery.currentDriverLatitude && delivery.currentDriverLongitude) {
          new google.maps.Marker({
            position: {
              lat: Number(delivery.currentDriverLatitude),
              lng: Number(delivery.currentDriverLongitude),
            },
            map,
            title: `Driver: ${delivery.deliveryPartner?.name || "Rider"}`,
            icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          });
        }
      })
      .catch((err) => {
        if (!isSubscribed) return;
        setMapError(err?.message || "Failed to load Google Maps.");
      });

    return () => {
      isSubscribed = false;
      mapRef.current = null;
    };
  }, [delivery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="theme-panel w-full max-w-3xl rounded-3xl p-6 shadow-2xl space-y-4 border border-white/20">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Navigation className="text-sky-400" size={20} />
              Live Delivery Location — Order #{delivery.order?.orderNo || delivery.orderId}
            </h2>
            <p className="theme-muted text-xs">
              Driver: <strong>{delivery.deliveryPartner?.name || "Unassigned"}</strong> • Status: <strong>{delivery.status}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} className="theme-muted hover:text-white text-lg">
            ✕
          </button>
        </div>

        <div
          ref={mapContainerRef}
          style={{ height: "380px" }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gray-900 flex items-center justify-center"
        >
          {mapError && <p className="text-amber-400 text-xs p-4 font-semibold">{mapError}</p>}
        </div>

        <div className="flex items-center justify-between text-xs theme-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> Restaurant</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-500 inline-block" /> Customer</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-blue-500 inline-block" /> Live Driver</span>
          </div>

          <button type="button" onClick={onClose} className="theme-soft-button px-4 py-1.5 rounded-xl font-semibold">
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
}
