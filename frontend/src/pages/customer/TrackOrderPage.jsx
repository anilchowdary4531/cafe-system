import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Truck, MapPin, Phone, Clock, ArrowLeft, Navigation, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../../utils/apiClient";
import { loadGoogleMaps, getGoogleMapsApiKey } from "../../utils/googleMapsLoader";
import { MAP_CONFIG } from "../../utils/mapConfig";
import io from "socket.io-client";
import { API_BASE_URL } from "../../config";
import BrandLogo from "../../components/BrandLogo";

const formatMoney = (value) => `₹${Math.round(Number(value || 0))}`;

const STATUS_STEPS = [
  { key: "PLACED", label: "Placed", hint: "Order received" },
  { key: "ASSIGNED", label: "Driver Assigned", hint: "Rider assigned" },
  { key: "ACCEPTED", label: "Rider On The Way", hint: "Rider heading to outlet" },
  { key: "PICKED_UP", label: "Order Picked Up", hint: "Package collected" },
  { key: "OUT_FOR_DELIVERY", label: "Out For Delivery", hint: "Rider is nearby" },
  { key: "DELIVERED", label: "Delivered", hint: "Enjoy your food!" },
];

const getStepIndex = (status) => {
  const s = String(status || "PLACED").toUpperCase();
  if (s === "DELIVERED") return 5;
  if (s === "OUT_FOR_DELIVERY") return 4;
  if (s === "PICKED_UP") return 3;
  if (s === "REACHED_RESTAURANT" || s === "ACCEPTED") return 2;
  if (s === "ASSIGNED") return 1;
  return 0;
};

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const phone = searchParams.get("phone") || "";

  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [driverPos, setDriverPos] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const socketRef = useRef(null);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/delivery/track/${orderId}`, { params: { phone } });
      if (res.data?.success) {
        setTracking(res.data.tracking);
        if (res.data.tracking?.delivery?.driverLocation) {
          setDriverPos(res.data.tracking.delivery.driverLocation);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Order tracking not found.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();
  }, [orderId, phone]);

  // Socket.IO Room Subscription for Live GPS & Status updates
  useEffect(() => {
    if (!orderId) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_delivery_room", { orderId: Number(orderId), deliveryId: tracking?.delivery?.id });
    });

    socket.on("delivery_status_changed", (payload) => {
      fetchTrackingData();
    });

    socket.on("delivery_location_updated", (payload) => {
      if (payload.latitude && payload.longitude) {
        const newPos = { latitude: Number(payload.latitude), longitude: Number(payload.longitude) };
        setDriverPos(newPos);

        if (driverMarkerRef.current && window.google) {
          driverMarkerRef.current.setPosition({ lat: newPos.latitude, lng: newPos.longitude });
          if (mapRef.current) mapRef.current.panTo({ lat: newPos.latitude, lng: newPos.longitude });
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orderId, tracking?.delivery?.id]);

  // Initialize Google Maps
  useEffect(() => {
    if (!tracking || !mapContainerRef.current) return;

    let isSubscribed = true;
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) return;

    loadGoogleMaps(["maps", "marker"])
      .then((google) => {
        if (!isSubscribed || !mapContainerRef.current) return;

        const restLat = Number(tracking.restaurant?.latitude || MAP_CONFIG.defaultCenter.lat);
        const restLng = Number(tracking.restaurant?.longitude || MAP_CONFIG.defaultCenter.lng);
        const destLat = Number(tracking.destination?.latitude || restLat + 0.015);
        const destLng = Number(tracking.destination?.longitude || restLng + 0.015);

        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: restLat, lng: restLng },
          zoom: 13,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          zoomControl: true,
          streetViewControl: false,
          fullscreenControl: false,
        });

        mapRef.current = map;

        // Restaurant Marker 🏪
        new google.maps.Marker({
          position: { lat: restLat, lng: restLng },
          map,
          title: tracking.restaurant?.name || "Restaurant Outlet",
          icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        });

        // Customer Marker 📍
        new google.maps.Marker({
          position: { lat: destLat, lng: destLng },
          map,
          title: "Your Delivery Address",
          icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        });

        // Driver Marker (if active) 🚗
        const initialDriver = driverPos || tracking.delivery?.driverLocation;
        if (initialDriver?.latitude && initialDriver?.longitude) {
          const marker = new google.maps.Marker({
            position: { lat: Number(initialDriver.latitude), lng: Number(initialDriver.longitude) },
            map,
            title: `Rider: ${tracking.delivery?.partner?.name || "Delivery Partner"}`,
            icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          });
          driverMarkerRef.current = marker;
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
      mapRef.current = null;
      driverMarkerRef.current = null;
    };
  }, [tracking]);

  const currentStep = getStepIndex(tracking?.delivery?.status || tracking?.orderStatus);

  return (
    <div className="theme-page min-h-screen p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link to="/profile/orders" className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold">
          <ArrowLeft size={16} />
          Back to Orders
        </Link>

        <button
          type="button"
          onClick={fetchTrackingData}
          className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-semibold"
        >
          <RefreshCw size={14} />
          Refresh Status
        </button>
      </div>

      {loading ? (
        <div className="theme-panel rounded-3xl p-16 text-center space-y-3">
          <Loader2 className="animate-spin mx-auto text-amber-500" size={36} />
          <p className="theme-muted text-sm font-semibold">Loading live delivery tracking...</p>
        </div>
      ) : error ? (
        <div className="theme-panel rounded-3xl p-10 text-center space-y-4 border border-rose-500/30 bg-rose-500/10">
          <AlertCircle size={44} className="mx-auto text-rose-400" />
          <h2 className="text-xl font-bold text-rose-300">Tracking Unavailable</h2>
          <p className="theme-muted text-sm max-w-md mx-auto">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Card */}
          <div className="theme-panel rounded-[32px] p-6 md:p-8 space-y-6 shadow-xl border border-white/10">
            {/* Headline Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-white/10 pb-6">
              <div>
                <span className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Live Order Tracking</span>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                  Order #{tracking.orderNo || tracking.orderId}
                </h1>
                <p className="theme-muted mt-2 text-sm flex items-center gap-2">
                  <BrandLogo className="h-4 w-4" />
                  <span className="font-semibold text-white">{tracking.restaurant?.name}</span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3.5 py-1 text-xs font-extrabold text-emerald-400 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {tracking.delivery?.status ? tracking.delivery.status.replace(/_/g, " ") : tracking.orderStatus}
                </span>

                <span className="text-xs font-bold theme-muted">
                  Total: <span className="text-amber-300 tabular-nums">{formatMoney(tracking.total)}</span> ({tracking.paymentMode || "ONLINE"})
                </span>
              </div>
            </div>

            {/* Timeline Progress Bar */}
            <div className="space-y-3">
              <p className="theme-muted text-xs font-bold uppercase tracking-wider">Delivery Progress</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {STATUS_STEPS.map((step, idx) => {
                  const completed = idx <= currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <div
                      key={step.key}
                      className={`rounded-2xl p-3 border text-center transition ${
                        completed
                          ? isCurrent
                            ? "bg-amber-500/20 border-amber-500 text-amber-400 font-bold shadow-md"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : "bg-black/20 border-white/5 text-gray-500 opacity-60"
                      }`}
                    >
                      <p className="text-xs font-bold truncate">{step.label}</p>
                      <p className="text-[10px] theme-muted mt-0.5 truncate">{step.hint}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Map */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold theme-muted">
                <span className="flex items-center gap-1.5"><Navigation size={14} className="text-sky-400" /> Live Delivery Map</span>
                {driverPos ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping inline-block" /> Live Driver GPS Streaming
                  </span>
                ) : (
                  <span className="text-amber-400 italic">Live location is currently unavailable</span>
                )}
              </div>

              <div
                ref={mapContainerRef}
                style={{ height: "360px" }}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-gray-900 flex items-center justify-center shadow-inner"
              >
                {!getGoogleMapsApiKey() && (
                  <p className="text-amber-400 text-xs p-4 font-semibold">Google Maps API key is not configured.</p>
                )}
              </div>
            </div>

            {/* Driver Profile Box */}
            {tracking.delivery?.partner && (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xl">
                    <Truck size={24} />
                  </div>

                  <div>
                    <span className="theme-muted text-[10px] font-extrabold uppercase tracking-widest">Delivery Partner</span>
                    <h3 className="font-extrabold text-base text-white">{tracking.delivery.partner.name}</h3>
                    <p className="theme-muted text-xs">
                      {tracking.delivery.partner.vehicleType} • <span className="font-mono text-amber-300 font-bold">{tracking.delivery.partner.vehicleNumber}</span>
                    </p>
                  </div>
                </div>

                {tracking.delivery.partner.phone && (
                  <a
                    href={`tel:${tracking.delivery.partner.phone}`}
                    className="theme-button inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold text-xs shadow-md"
                  >
                    <Phone size={14} />
                    Call Rider ({tracking.delivery.partner.phone})
                  </a>
                )}
              </div>
            )}

            {/* Destination Info */}
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 space-y-2">
              <p className="theme-muted text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={14} className="text-amber-500" /> Delivery Address
              </p>
              <p className="text-sm leading-relaxed text-gray-200">{tracking.destination?.address}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
