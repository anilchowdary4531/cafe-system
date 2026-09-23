import { useEffect, useState, useRef } from "react";
import { Truck, Navigation, Phone, CheckCircle2, AlertTriangle, Clock, MapPin, Loader2, Play, Pause, RefreshCw, ChevronRight } from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

const formatMoney = (value) => `₹${Math.round(Number(value || 0))}`;

export default function DriverDeliveryStudio() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ACTIVE"); // ACTIVE | COMPLETED
  const [trackingActive, setTrackingActive] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const watchIdRef = useRef(null);

  const fetchDriverDeliveries = async () => {
    try {
      setLoading(true);
      const res = await api.get("/delivery/driver/orders");
      if (res.data?.success) {
        setDeliveries(res.data.deliveries || []);
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load assigned deliveries", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverDeliveries();
    const interval = setInterval(fetchDriverDeliveries, 10000);
    return () => clearInterval(interval);
  }, []);

  // GPS Location Tracking
  useEffect(() => {
    if (!trackingActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser.", { type: "error" });
      setTrackingActive(false);
      return;
    }

    const sendLocation = (pos) => {
      const lat = Math.round(pos.coords.latitude * 1000000) / 1000000;
      const lng = Math.round(pos.coords.longitude * 1000000) / 1000000;

      const activeDelivery = deliveries.find((d) => ["OUT_FOR_DELIVERY", "PICKED_UP", "ACCEPTED"].includes(d.status));
      if (!activeDelivery) return;

      api.post("/delivery/location", {
        deliveryId: activeDelivery.id,
        lat,
        lng,
      }).catch(() => {});
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      (err) => console.warn("GPS Tracking error:", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [trackingActive, deliveries]);

  const handleUpdateStatus = async (deliveryId, nextStatus) => {
    try {
      setUpdatingId(deliveryId);
      const res = await api.post("/delivery/status", {
        deliveryId,
        status: nextStatus,
      });

      if (res.data?.success) {
        showToast(`Status updated to ${nextStatus.replace(/_/g, " ")}!`, { type: "success" });

        if (nextStatus === "OUT_FOR_DELIVERY") {
          setTrackingActive(true);
        } else if (["DELIVERED", "FAILED", "CANCELLED"].includes(nextStatus)) {
          setTrackingActive(false);
        }

        fetchDriverDeliveries();
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update delivery status", { type: "error" });
    } finally {
      setUpdatingId(null);
    }
  };

  const activeDeliveries = deliveries.filter((d) =>
    ["ASSIGNED", "ACCEPTED", "REACHED_RESTAURANT", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(d.status)
  );

  const completedDeliveries = deliveries.filter((d) =>
    ["DELIVERED", "FAILED", "CANCELLED"].includes(d.status)
  );

  const displayedList = activeTab === "ACTIVE" ? activeDeliveries : completedDeliveries;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6 space-y-5 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Truck className="text-amber-500" size={24} />
            Driver Delivery Portal
          </h1>
          <p className="text-xs text-gray-400">View assigned orders and stream live GPS location</p>
        </div>

        <button
          type="button"
          onClick={fetchDriverDeliveries}
          className="p-2.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* GPS Tracking Toggle Banner */}
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${trackingActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-gray-800 text-gray-400"}`}>
            <Navigation size={20} className={trackingActive ? "animate-pulse" : ""} />
          </div>
          <div>
            <h3 className="font-bold text-sm">Live Location Stream</h3>
            <p className="text-xs text-gray-400">
              {trackingActive ? "Streaming GPS coordinates to customer & restaurant..." : "Turn on to share live location with customer."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTrackingActive(!trackingActive)}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            trackingActive
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
              : "bg-emerald-500 text-black shadow-md font-extrabold"
          }`}
        >
          {trackingActive ? <Pause size={14} /> : <Play size={14} />}
          {trackingActive ? "Pause GPS" : "Start GPS"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl border border-white/10 bg-black/40 p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("ACTIVE")}
          className={`flex-1 py-2.5 rounded-xl transition ${activeTab === "ACTIVE" ? "bg-amber-500 text-black shadow-md" : "text-gray-400 hover:text-white"}`}
        >
          Active Deliveries ({activeDeliveries.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("COMPLETED")}
          className={`flex-1 py-2.5 rounded-xl transition ${activeTab === "COMPLETED" ? "bg-amber-500 text-black shadow-md" : "text-gray-400 hover:text-white"}`}
        >
          Completed ({completedDeliveries.length})
        </button>
      </div>

      {/* Deliveries List */}
      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-12 text-center">
          <Loader2 className="animate-spin mx-auto text-amber-500" size={32} />
          <p className="text-xs text-gray-400 mt-3">Loading deliveries...</p>
        </div>
      ) : displayedList.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-12 text-center space-y-3">
          <Truck size={40} className="mx-auto text-gray-600 opacity-50" />
          <h3 className="font-bold text-base">No deliveries found</h3>
          <p className="text-xs text-gray-400">You currently have no {activeTab.toLowerCase()} delivery assignments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedList.map((delivery) => {
            const order = delivery.order || {};
            const restaurant = delivery.restaurant || {};
            const isCod = ["CASH", "COD"].includes(String(order.paymentMode || "").toUpperCase());
            const isUpdating = updatingId === delivery.id;

            const destLat = delivery.deliveryLatitude;
            const destLng = delivery.deliveryLongitude;
            const navUrl = destLat && destLng
              ? `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.deliveryAddressSnapshot || "Customer Address")}`;

            return (
              <div key={delivery.id} className="rounded-3xl border border-white/10 bg-gray-900 p-5 space-y-4 shadow-xl">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">Order</span>
                    <h2 className="text-lg font-bold font-mono text-white">#{order.orderNo || delivery.orderId}</h2>
                  </div>

                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    delivery.status === "DELIVERED"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : delivery.status === "OUT_FOR_DELIVERY"
                      ? "bg-sky-500/15 text-sky-400 border-sky-500/30 animate-pulse"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }`}>
                    {delivery.status.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Pickup & Destination Address */}
                <div className="space-y-3 text-xs">
                  {/* Restaurant Outlet */}
                  <div className="rounded-2xl border border-white/5 bg-black/30 p-3 space-y-1">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pickup From Outlet</p>
                    <p className="font-bold text-sm text-white">{restaurant.name || "Restaurant Outlet"}</p>
                    <p className="text-gray-400 leading-relaxed">{restaurant.address || "Outlet Address"}</p>
                    {restaurant.phone && (
                      <a href={`tel:${restaurant.phone}`} className="inline-flex items-center gap-1 text-amber-400 pt-1 font-semibold">
                        <Phone size={12} /> Call Outlet: {restaurant.phone}
                      </a>
                    )}
                  </div>

                  {/* Customer Destination */}
                  <div className="rounded-2xl border border-white/5 bg-black/30 p-3 space-y-1">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Deliver To Customer</p>
                    <p className="font-bold text-sm text-white">{order.customerName || "Customer"}</p>
                    <p className="text-gray-300 leading-relaxed font-medium">{delivery.deliveryAddressSnapshot || "Customer Address"}</p>
                    {order.phone && (
                      <a href={`tel:${order.phone}`} className="inline-flex items-center gap-1 text-emerald-400 pt-1 font-semibold">
                        <Phone size={12} /> Call Customer: {order.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Payment Notice */}
                <div className={`rounded-2xl p-3 text-xs font-bold flex items-center justify-between border ${
                  isCod
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                }`}>
                  <span>{isCod ? "Collect Cash on Delivery (COD)" : "Prepaid Online Order"}</span>
                  <span className="text-sm font-extrabold">{formatMoney(order.total)}</span>
                </div>

                {/* Action Controls */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <a
                    href={navUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white py-3 text-xs font-bold transition shadow-md"
                  >
                    <Navigation size={16} />
                    Navigate in Google Maps
                  </a>

                  {delivery.status === "ASSIGNED" && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(delivery.id, "ACCEPTED")}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black py-3 text-sm font-bold shadow-md"
                    >
                      {isUpdating && <Loader2 size={16} className="animate-spin" />}
                      Accept Delivery 🛵
                    </button>
                  )}

                  {delivery.status === "ACCEPTED" && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(delivery.id, "REACHED_RESTAURANT")}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black py-3 text-sm font-bold shadow-md"
                    >
                      {isUpdating && <Loader2 size={16} className="animate-spin" />}
                      Reached Restaurant 🏪
                    </button>
                  )}

                  {delivery.status === "REACHED_RESTAURANT" && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(delivery.id, "PICKED_UP")}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black py-3 text-sm font-bold shadow-md"
                    >
                      {isUpdating && <Loader2 size={16} className="animate-spin" />}
                      Picked Up Order 📦
                    </button>
                  )}

                  {delivery.status === "PICKED_UP" && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(delivery.id, "OUT_FOR_DELIVERY")}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 hover:bg-sky-400 text-black py-3 text-sm font-bold shadow-md"
                    >
                      {isUpdating && <Loader2 size={16} className="animate-spin" />}
                      Start Delivery 🚗
                    </button>
                  )}

                  {delivery.status === "OUT_FOR_DELIVERY" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(delivery.id, "DELIVERED")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black py-3 text-xs font-bold shadow-md"
                      >
                        {isUpdating && <Loader2 size={14} className="animate-spin" />}
                        Mark Delivered ✅
                      </button>

                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(delivery.id, "FAILED")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/40 py-3 text-xs font-bold"
                      >
                        Report Issue ❌
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
