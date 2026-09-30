import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import {
  Utensils,
  Search,
  ShoppingCart,
  CheckCircle2,
  Clock,
  ChevronRight,
  Plus,
  Minus,
  X,
  Sparkles,
  Tag,
  Star,
  Receipt,
  CreditCard,
  AlertCircle,
  Users,
  Bell,
  ChefHat,
  ChevronDown,
  Info,
  Layers,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { API, API_BASE_URL } from "../../config";
import { showToast } from "../../utils/toast";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import ItemCustomizationModal from "../../components/ItemCustomizationModal";
import VegModeToggle from "../../components/VegModeToggle";

const FALLBACK_FOOD_IMG = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80";

// Customer-facing order progress steps
const ORDER_STEPS = [
  { key: "RECEIVED", label: "Order Received", icon: Receipt, desc: "Order placed & sent to kitchen" },
  { key: "PREPARING", label: "Preparing", icon: ChefHat, desc: "Chef is cooking your food" },
  { key: "READY", label: "Ready", icon: Bell, desc: "Order is ready for serving" },
  { key: "SERVED", label: "Served", icon: CheckCircle2, desc: "Delivered to your table" },
];

export default function CustomerQrLandingPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolved metadata from backend
  const [restaurant, setRestaurant] = useState(null);
  const [table, setTable] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [menu, setMenu] = useState([]);

  // Reservation restriction state
  const [isReserved, setIsReserved] = useState(false);
  const [reservedMessage, setReservedMessage] = useState("");
  const [reservationDetails, setReservationDetails] = useState(null);
  const [availableTables, setAvailableTables] = useState([]);

  // UI & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [cart, setCart] = useState({});
  const [showCheckoutDrawer, setShowCheckoutDrawer] = useState(false);

  // Customization Modal State
  const [customizingItem, setCustomizingItem] = useState(null);

  // Quick Customer Actions Cooldown state
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterCooldown, setWaiterCooldown] = useState(0);

  const [requestingBill, setRequestingBill] = useState(false);
  const [billCooldown, setBillCooldown] = useState(0);

  // Checkout Info
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("PAY_AT_COUNTER");

  const [placingOrder, setPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  // Tracking section toggle
  const [showTrackerDrawer, setShowTrackerDrawer] = useState(false);

  const socketRef = useRef(null);

  // 1. Fetch resolved QR token context
  const fetchResolveData = async () => {
    if (!token) {
      setError("Invalid QR Code Link");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/public/qr/resolve/${token}`);
      if (res.data) {
        setRestaurant(res.data.restaurant);
        setTable(res.data.table);
        setActiveSession(res.data.activeSession);
        setMenu(res.data.menu || []);
        if (res.data.isReserved) {
          setIsReserved(true);
          setReservedMessage(res.data.message || "This table is reserved for this time slot.");
          setReservationDetails(res.data.reservationDetails || res.data.upcomingReservationDetails || null);
          setAvailableTables(res.data.availableTables || []);
        } else {
          setIsReserved(false);
          setReservationDetails(null);
          setAvailableTables([]);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load table ordering session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResolveData();
  }, [token]);

  // 2. Real-Time Socket.IO Room Subscription
  useEffect(() => {
    if (!restaurant?.id || !table?.tableNo) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_table_room", {
        sessionId: activeSession?.sessionId,
        tableId: table?.id,
        restaurantId: restaurant?.id,
      });
    });

    // Listen for order status changes for current session
    socket.on("order:status_updated", (updatedOrder) => {
      showToast(`Order #${updatedOrder.orderNo || updatedOrder.id} status: ${updatedOrder.status}`, "info");
      fetchResolveData();
    });

    // Listen for table session updates
    socket.on("table_session_updated", (payload) => {
      fetchResolveData();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [restaurant?.id, table?.tableNo, activeSession?.sessionId]);

  // Cooldown timer tickers
  useEffect(() => {
    if (waiterCooldown <= 0) return;
    const timer = setInterval(() => setWaiterCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [waiterCooldown]);

  useEffect(() => {
    if (billCooldown <= 0) return;
    const timer = setInterval(() => setBillCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [billCooldown]);

  // Categories list & dish count calculation
  const categoriesWithCounts = useMemo(() => {
    if (!menu.length) return [{ name: "ALL", count: 0 }];
    const map = {};
    let total = 0;

    menu.forEach((item) => {
      if (isVegOnly && (item.isVeg === false || item.category?.toLowerCase().includes("non-veg"))) return;
      const cat = item.category || "General";
      map[cat] = (map[cat] || 0) + 1;
      total += 1;
    });

    return [
      { name: "ALL", count: total },
      ...Object.keys(map).map((catName) => ({ name: catName, count: map[catName] })),
    ];
  }, [menu, isVegOnly]);

  // Filtered Menu Items
  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      // Category filter
      const matchCat = selectedCategory === "ALL" || (item.category || "General") === selectedCategory;
      // Search filter
      const matchSearch =
        !searchQuery.trim() ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      // Veg filter
      const matchVeg = !isVegOnly || (item.isVeg !== false && !item.category?.toLowerCase().includes("non-veg"));

      return matchCat && matchSearch && matchVeg;
    });
  }, [menu, selectedCategory, searchQuery, isVegOnly]);

  // Cart Calculations
  const cartItemsList = useMemo(() => Object.values(cart), [cart]);

  const cartTotalQty = useMemo(() => {
    return cartItemsList.reduce((sum, item) => sum + item.qty, 0);
  }, [cartItemsList]);

  const cartSubtotal = useMemo(() => {
    return cartItemsList.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [cartItemsList]);

  const taxAmount = useMemo(() => {
    if (!restaurant?.taxEnabled) return 0;
    const rate = Number(restaurant.defaultTaxPercent || 5) / 100;
    return cartSubtotal * rate;
  }, [restaurant, cartSubtotal]);

  const serviceChargeAmount = useMemo(() => {
    if (!restaurant?.serviceChargeEnabled) return 0;
    const rate = Number(restaurant.serviceChargePercent || 0) / 100;
    return cartSubtotal * rate;
  }, [restaurant, cartSubtotal]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === "PERCENT") {
      return (cartSubtotal * Number(appliedCoupon.discountPercent || 0)) / 100;
    }
    return Math.min(cartSubtotal, Number(appliedCoupon.discountAmount || 0));
  }, [appliedCoupon, cartSubtotal]);

  const finalTotal = useMemo(() => {
    return Math.max(0, cartSubtotal + taxAmount + serviceChargeAmount - discountAmount);
  }, [cartSubtotal, taxAmount, serviceChargeAmount, discountAmount]);

  // Direct Add or Customization Trigger
  const handleItemAdd = (item) => {
    if (!item.isAvailable) {
      showToast("This dish is currently unavailable", "error");
      return;
    }

    const hasVariants = Array.isArray(item.variants) && item.variants.some((v) => v.isActive !== false);
    const hasModifiers = Array.isArray(item.modifierGroups) && item.modifierGroups.length > 0;

    if (hasVariants || hasModifiers) {
      setCustomizingItem(item);
      return;
    }

    const key = `item_${item.id}`;
    setCart((prev) => {
      const existing = prev[key];
      if (existing) {
        return { ...prev, [key]: { ...existing, qty: existing.qty + 1 } };
      }
      return {
        ...prev,
        [key]: {
          key,
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          qty: 1,
          variantName: null,
          modifiers: [],
        },
      };
    });
    showToast(`Added ${item.name}`, "success");
  };

  const handleUpdateItemQty = (cartKey, delta) => {
    setCart((prev) => {
      const existing = prev[cartKey];
      if (!existing) return prev;
      const newQty = existing.qty + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[cartKey];
        return copy;
      }
      return { ...prev, [cartKey]: { ...existing, qty: newQty } };
    });
  };

  const handleSaveCustomization = (customizedData) => {
    if (!customizedData) return;
    const { key, menuItemId, name, price, qty, variant, selectedModifiers, notes } = customizedData;

    const itemKey = key || `custom_${menuItemId}_${Date.now()}`;
    const variantName = variant ? variant.name : null;
    const modifiersList = (selectedModifiers || []).map((m) => ({
      modifierId: m.modifierId,
      name: m.name,
      price: m.price,
    }));

    setCart((prev) => ({
      ...prev,
      [itemKey]: {
        key: itemKey,
        menuItemId,
        name: variantName ? `${name} (${variantName})` : name,
        price,
        qty,
        variantName,
        modifiers: modifiersList,
        notes,
      },
    }));

    setCustomizingItem(null);
    showToast(`Customized ${name} added to cart!`, "success");
  };

  // Quick Action: Call Waiter
  const handleCallWaiter = async () => {
    if (waiterCooldown > 0 || callingWaiter) return;
    try {
      setCallingWaiter(true);
      const res = await axios.post(`${API}/api/public/qr/call-waiter`, { token, reason: "Assistance requested" });
      if (res.data?.success) {
        showToast(res.data.message || `Waiter alerted for Table ${table?.tableNo}`, "success");
        setWaiterCooldown(30); // 30s cooldown
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to alert waiter", "error");
    } finally {
      setCallingWaiter(false);
    }
  };

  // Quick Action: Request Bill
  const handleRequestBill = async () => {
    if (billCooldown > 0 || requestingBill) return;
    try {
      setRequestingBill(true);
      const res = await axios.post(`${API}/api/public/qr/request-bill`, { token });
      if (res.data?.success) {
        showToast(res.data.message || `Bill request submitted for Table ${table?.tableNo}`, "success");
        setBillCooldown(60); // 60s cooldown
        fetchResolveData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to request bill", "error");
    } finally {
      setRequestingBill(false);
    }
  };

  // Submit Order to Backend
  const handlePlaceOrder = async () => {
    if (cartItemsList.length === 0) {
      showToast("Your cart is empty", "error");
      return;
    }

    try {
      setPlacingOrder(true);
      const itemsPayload = cartItemsList.map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        qty: item.qty,
        variantName: item.variantName,
        selectedModifiers: item.modifiers,
        notes: item.notes,
      }));

      const res = await axios.post(`${API}/api/public/qr/order`, {
        token,
        items: itemsPayload,
        customerName,
        phone,
        notes,
        couponCode,
        loyaltyPointsToRedeem,
        paymentMethod,
      });

      if (res.data?.order) {
        setPlacedOrder(res.data.order);
        setCart({});
        setShowCheckoutDrawer(false);
        showToast("Order placed successfully! Kitchen notified.", "success");
        fetchResolveData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to submit order", "error");
    } finally {
      setPlacingOrder(false);
    }
  };

  // Determine current active order tracking stage
  const getStageFromStatus = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "DELIVERED" || s === "SERVED" || s === "COMPLETED") return 3; // Served
    if (s === "READY") return 2; // Ready
    if (s === "PREPARING" || s === "IN_KITCHEN" || s === "ACCEPTED") return 1; // Preparing
    return 0; // Received
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium animate-pulse">Loading menu & table context...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">QR Code Unavailable</h2>
          <p className="text-slate-600 mb-6 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/30 hover:bg-orange-700 transition"
          >
            Retry Scan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 pb-28 font-sans antialiased">
      {/* ============================================================ */}
      {/* 1. SQUARE-STYLE HEADER & HERO BRANDING                       */}
      {/* ============================================================ */}
      <div className="relative bg-gradient-to-b from-orange-600 via-orange-500 to-orange-600 text-white pb-6 pt-5 px-4 shadow-md overflow-hidden">
        {/* Decorative background blur shapes */}
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 bg-black/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-3xl mx-auto relative z-10">
          {/* Header Top Navigation Row */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              {restaurant?.logoUrl ? (
                <img
                  src={resolveImageUrl(restaurant.logoUrl)}
                  alt={restaurant.name}
                  className="w-12 h-12 rounded-2xl object-cover bg-white p-0.5 shadow-md border border-white/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                  <Utensils size={24} />
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">{restaurant?.name || "Tiffzy Restaurant"}</h1>
                <p className="text-xs text-orange-100 flex items-center gap-1 font-medium">
                  <span>{restaurant?.city || "Dine-in Outlet"}</span>
                  {restaurant?.phone && <span>• {restaurant.phone}</span>}
                </p>
              </div>
            </div>

            {/* Table Badge */}
            {table && (
              <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-3.5 py-1.5 text-right shadow-sm">
                <span className="text-[10px] uppercase tracking-wider text-orange-100 font-bold block">Table</span>
                <span className="text-base sm:text-lg font-black tracking-wide leading-none">{table.tableNo}</span>
              </div>
            )}
          </div>

          {/* Quick Action Pills: Call Waiter & Request Bill */}
          <div className="flex items-center gap-2 pt-1 pb-1">
            <button
              onClick={handleCallWaiter}
              disabled={callingWaiter || waiterCooldown > 0}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs shadow-sm transition border ${
                waiterCooldown > 0
                  ? "bg-white/20 text-orange-100 border-white/20 cursor-not-allowed"
                  : "bg-white text-orange-600 border-white hover:bg-orange-50 active:scale-95"
              }`}
            >
              <Bell size={14} className={callingWaiter ? "animate-spin" : ""} />
              <span>{waiterCooldown > 0 ? `Waiter Alerted (${waiterCooldown}s)` : "Call Waiter"}</span>
            </button>

            <button
              onClick={handleRequestBill}
              disabled={requestingBill || billCooldown > 0}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs shadow-sm transition border ${
                billCooldown > 0
                  ? "bg-white/20 text-orange-100 border-white/20 cursor-not-allowed"
                  : "bg-orange-950/40 text-white border-white/30 backdrop-blur-md hover:bg-orange-950/60 active:scale-95"
              }`}
            >
              <Receipt size={14} />
              <span>{billCooldown > 0 ? `Bill Requested (${billCooldown}s)` : "Request Bill"}</span>
            </button>
          </div>

          {/* Search Input Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search dishes, starters, beverages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-800 rounded-xl text-sm font-medium placeholder-slate-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. RESERVED TABLE ALERT CARD                                  */}
      {/* ============================================================ */}
      {isReserved && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 shadow-sm flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <Calendar size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm sm:text-base text-amber-950">Table Reserved / Restricted</h3>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{reservedMessage}</p>
                {reservationDetails && (
                  <div className="mt-2 bg-amber-100/60 rounded-lg p-2 text-xs font-semibold text-amber-900">
                    Slot: {reservationDetails.startTime} - {reservationDetails.endTime} ({reservationDetails.customerName})
                  </div>
                )}
              </div>
            </div>
            {availableTables.length > 0 && (
              <div className="border-t border-amber-200/60 pt-2.5">
                <p className="text-xs font-bold text-amber-900 mb-1.5">Available Alternate Tables:</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableTables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/order/table/${t.qrToken}`)}
                      className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-2xs"
                    >
                      Table {t.tableNo} ({t.seats} Seats)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. ACTIVE SESSION ORDER TRACKER CARD                         */}
      {/* ============================================================ */}
      {activeSession?.orders && activeSession.orders.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="bg-white rounded-2xl border border-orange-100 shadow-md p-4 transition-all">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Utensils size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">Active Table Session Orders</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {activeSession.orders.length} order(s) placed • Total: ₹{Math.round(activeSession.total)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTrackerDrawer((prev) => !prev)}
                className="px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-xl text-xs font-bold hover:bg-orange-100 transition flex items-center gap-1"
              >
                <span>{showTrackerDrawer ? "Hide Tracker" : "Track Orders"}</span>
                <ChevronDown size={14} className={`transform transition-transform ${showTrackerDrawer ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Expandable Live Order Tracker Timeline */}
            {showTrackerDrawer && (
              <div className="border-t border-slate-100 pt-3 flex flex-col gap-4">
                {activeSession.orders.map((ord) => {
                  const currentStageIdx = getStageFromStatus(ord.status);
                  return (
                    <div key={ord.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                        <span>Order #{ord.orderNo || ord.id}</span>
                        <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-extrabold text-[10px]">
                          {ord.status}
                        </span>
                      </div>

                      {/* Timeline Bar */}
                      <div className="grid grid-cols-4 gap-1 relative my-2">
                        {ORDER_STEPS.map((step, idx) => {
                          const StepIcon = step.icon;
                          const isDone = idx <= currentStageIdx;
                          const isCurrent = idx === currentStageIdx;
                          return (
                            <div key={step.key} className="flex flex-col items-center text-center">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 text-xs font-bold transition-all ${
                                  isCurrent
                                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/40 ring-4 ring-orange-100 animate-pulse"
                                    : isDone
                                    ? "bg-emerald-500 text-white"
                                    : "bg-slate-200 text-slate-400"
                                }`}
                              >
                                <StepIcon size={13} />
                              </div>
                              <span className={`text-[10px] font-bold leading-tight ${isDone ? "text-slate-800" : "text-slate-400"}`}>
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Items Summary */}
                      <div className="mt-2 text-[11px] text-slate-600 bg-white rounded-lg p-2 border border-slate-100">
                        {ord.items?.map((it, i) => (
                          <div key={i} className="flex justify-between py-0.5 font-medium">
                            <span>
                              {it.qty}x {it.itemName} {it.variantName ? `(${it.variantName})` : ""}
                            </span>
                            <span className="font-semibold text-slate-800">₹{Math.round(it.price * it.qty)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. STICKY CATEGORY PILLS BAR + VEG TOGGLE                    */}
      {/* ============================================================ */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs py-2.5 px-4 my-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          {/* Scrollable Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-1">
            {categoriesWithCounts.map((cat) => {
              const isSelected = selectedCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all shadow-xs flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-orange-500 text-white shadow-orange-500/30 scale-102 ring-2 ring-orange-400/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? "bg-white/25 text-white" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Veg Only Toggle Switch */}
          <VegModeToggle compact enabled={isVegOnly} onToggle={(val) => setIsVegOnly(val)} />
        </div>
      </div>

      {/* ============================================================ */}
      {/* 5. FOOD ITEM CARDS GRID (SQUARE FOR RESTAURANTS LAYOUT)      */}
      {/* ============================================================ */}
      <div className="max-w-3xl mx-auto px-4 mt-2">
        {filteredMenu.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/80 shadow-xs my-6">
            <Utensils size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-bold text-slate-700 text-base">No dishes found</h3>
            <p className="text-xs text-slate-400 mt-1">Try searching for something else or change category filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredMenu.map((item) => {
              const cartKey = `item_${item.id}`;
              const inCartQty = cart[cartKey]?.qty || 0;
              const hasCustomizations =
                (Array.isArray(item.variants) && item.variants.some((v) => v.isActive !== false)) ||
                (Array.isArray(item.modifierGroups) && item.modifierGroups.length > 0);
              const isVeg = item.isVeg !== false && !item.category?.toLowerCase().includes("non-veg");

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border transition-all p-3.5 flex gap-3 shadow-xs hover:shadow-md relative ${
                    !item.isAvailable ? "opacity-60 bg-slate-50 border-slate-200" : "border-slate-200/90 hover:border-orange-300"
                  }`}
                >
                  {/* Item Image Thumbnail */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    <img
                      src={item.image ? resolveImageUrl(item.image) : FALLBACK_FOOD_IMG}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Bestseller Badge */}
                    {item.isFeatured && (
                      <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5">
                        <Sparkles size={9} /> Best
                      </span>
                    )}
                    {/* Sold Out Overlay */}
                    {!item.isAvailable && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center">
                        <span className="text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-red-600 rounded">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Item Content */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        {/* Veg / Non-Veg Indicator Dot */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              isVeg ? "border-emerald-600 bg-emerald-50" : "border-red-600 bg-red-50"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-emerald-600" : "bg-red-600"}`} />
                          </span>
                          <h4 className="font-extrabold text-sm sm:text-base text-slate-800 truncate leading-snug">{item.name}</h4>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
                        {item.description || "Delicious dish prepared fresh on order."}
                      </p>
                    </div>

                    {/* Footer: Price & Add Button */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div>
                        <span className="text-base sm:text-lg font-black text-slate-900">₹{Math.round(item.price)}</span>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <span className="text-xs text-slate-400 line-through ml-1.5">₹{Math.round(item.originalPrice)}</span>
                        )}
                        {hasCustomizations && (
                          <span className="block text-[10px] text-orange-600 font-bold uppercase tracking-wider">Customizable</span>
                        )}
                      </div>

                      {/* Quantity Stepper / Add Button */}
                      {!item.isAvailable ? (
                        <button disabled className="px-3 py-1.5 bg-slate-200 text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed">
                          Unavailable
                        </button>
                      ) : inCartQty > 0 && !hasCustomizations ? (
                        <div className="flex items-center bg-orange-50 border border-orange-300 rounded-xl overflow-hidden shadow-2xs">
                          <button
                            onClick={() => handleUpdateItemQty(cartKey, -1)}
                            className="p-1.5 text-orange-700 hover:bg-orange-100 transition active:scale-90"
                          >
                            <Minus size={14} strokeWidth={2.5} />
                          </button>
                          <span className="px-2.5 text-xs font-black text-orange-800">{inCartQty}</span>
                          <button
                            onClick={() => handleUpdateItemQty(cartKey, 1)}
                            className="p-1.5 text-orange-700 hover:bg-orange-100 transition active:scale-90"
                          >
                            <Plus size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleItemAdd(item)}
                          className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black shadow-sm shadow-orange-500/20 active:scale-95 transition flex items-center gap-1"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                          <span>ADD</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 6. ITEM CUSTOMIZATION MODAL INTEGRATION                      */}
      {/* ============================================================ */}
      {customizingItem && (
        <ItemCustomizationModal
          isOpen={Boolean(customizingItem)}
          item={customizingItem}
          onClose={() => setCustomizingItem(null)}
          onSave={handleSaveCustomization}
        />
      )}

      {/* ============================================================ */}
      {/* 7. FLOATING MOBILE CART PILL BAR                              */}
      {/* ============================================================ */}
      {cartTotalQty > 0 && !showCheckoutDrawer && (
        <div className="fixed bottom-4 left-0 right-0 z-30 px-4">
          <div className="max-w-xl mx-auto bg-slate-900 text-white rounded-2xl p-3 shadow-2xl border border-slate-800 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black shadow-md shadow-orange-500/40">
                <ShoppingCart size={20} />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  {cartTotalQty} {cartTotalQty === 1 ? "Item" : "Items"} in Cart
                </div>
                <div className="text-base font-black text-white">₹{Math.round(finalTotal)}</div>
              </div>
            </div>

            <button
              onClick={() => setShowCheckoutDrawer(true)}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-extrabold text-xs tracking-wide shadow-lg shadow-orange-500/30 active:scale-95 transition flex items-center gap-1.5"
            >
              <span>VIEW ORDER</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. CHECKOUT & PAYMENT DRAWER MODAL                           */}
      {/* ============================================================ */}
      {showCheckoutDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Checkout Order</h3>
                  <p className="text-xs text-slate-500 font-medium">Table {table?.tableNo} • {restaurant?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCheckoutDrawer(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Cart Items List */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Order Summary</h4>
                <div className="space-y-3">
                  {cartItemsList.map((item) => (
                    <div key={item.key} className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/60 last:border-0 last:pb-0">
                      <div className="flex-1">
                        <h5 className="font-extrabold text-sm text-slate-800">{item.name}</h5>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Add-ons: {item.modifiers.map((m) => m.name).join(", ")}
                          </p>
                        )}
                        {item.notes && <p className="text-[11px] text-amber-700 italic mt-0.5">"{item.notes}"</p>}
                        <div className="font-bold text-xs text-slate-900 mt-1">₹{Math.round(item.price * item.qty)}</div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <button
                          onClick={() => handleUpdateItemQty(item.key, -1)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 transition"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="px-2.5 text-xs font-extrabold text-slate-800">{item.qty}</span>
                        <button
                          onClick={() => handleUpdateItemQty(item.key, 1)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 transition"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Info Form */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Customer Details</h4>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Your Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Mobile Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Kitchen / Special Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Less spicy, extra napkins..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-orange-500 resize-none"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Payment Choice</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("PAY_AT_COUNTER")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 ${
                      paymentMethod === "PAY_AT_COUNTER"
                        ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <CreditCard size={14} />
                    <span>Pay at Counter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("UPI")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 ${
                      paymentMethod === "UPI"
                        ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Sparkles size={14} />
                    <span>UPI QR Pay</span>
                  </button>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Items Subtotal</span>
                  <span className="font-bold text-slate-800">₹{Math.round(cartSubtotal)}</span>
                </div>
                {restaurant?.taxEnabled && (
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>GST Tax ({restaurant.defaultTaxPercent || 5}%)</span>
                    <span className="font-bold text-slate-800">₹{Math.round(taxAmount)}</span>
                  </div>
                )}
                {restaurant?.serviceChargeEnabled && (
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>Service Charge ({restaurant.serviceChargePercent}%)</span>
                    <span className="font-bold text-slate-800">₹{Math.round(serviceChargeAmount)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Coupon Discount</span>
                    <span>-₹{Math.round(discountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-black text-slate-900">
                  <span>Grand Total</span>
                  <span>₹{Math.round(finalTotal)}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Submit */}
            <div className="p-4 border-t border-slate-100 bg-white shadow-xl">
              <button
                onClick={handlePlaceOrder}
                disabled={placingOrder || cartItemsList.length === 0}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-sm shadow-xl shadow-orange-500/30 active:scale-98 transition flex items-center justify-center gap-2"
              >
                {placingOrder ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>SUBMIT DINE-IN ORDER</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
