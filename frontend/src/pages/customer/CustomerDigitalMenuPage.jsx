import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
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
  Phone,
  MapPin,
  Building2,
  Info,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { API } from "../../config";
import { showToast } from "../../utils/toast";

export default function CustomerDigitalMenuPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolved metadata from backend
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [cart, setCart] = useState({});
  const [showCheckoutDrawer, setShowCheckoutDrawer] = useState(false);

  // Customization Modal
  const [selectedItemForCustomization, setSelectedItemForCustomization] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState({});

  // Checkout info
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [fulfillment, setFulfillment] = useState("TAKEAWAY");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("PAY_AT_COUNTER");

  const [placingOrder, setPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid Digital Menu Link");
      setLoading(false);
      return;
    }

    const fetchDigitalMenu = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API}/api/public/digital-menu/resolve/${token}`);
        if (res.data) {
          setRestaurant(res.data.restaurant);
          setMenu(res.data.menu || []);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load restaurant digital menu");
      } finally {
        setLoading(false);
      }
    };

    fetchDigitalMenu();
  }, [token]);

  // Categories list
  const categories = useMemo(() => {
    if (!menu.length) return ["ALL"];
    const cats = new Set(menu.map((m) => m.category || "General"));
    return ["ALL", ...Array.from(cats)];
  }, [menu]);

  // Filtered Menu
  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchCat =
        selectedCategory === "ALL" || (item.category || "General") === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menu, selectedCategory, searchQuery]);

  // Cart Calculations
  const cartItemsList = useMemo(() => Object.values(cart), [cart]);

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

  const handleAddToCart = (item) => {
    if (!item.isAvailable) {
      showToast("This item is currently unavailable", "error");
      return;
    }
    if ((item.variants && item.variants.length > 0) || (item.modifierGroups && item.modifierGroups.length > 0)) {
      setSelectedItemForCustomization(item);
      setSelectedVariant(item.variants?.[0] || null);
      setSelectedModifiers({});
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
    showToast(`Added ${item.name} to cart`, "success");
  };

  const handleConfirmCustomization = () => {
    if (!selectedItemForCustomization) return;
    const item = selectedItemForCustomization;

    let basePrice = selectedVariant ? selectedVariant.price : item.price;
    let extraModPrice = 0;
    const modList = [];

    Object.values(selectedModifiers).forEach((mods) => {
      (Array.isArray(mods) ? mods : [mods]).forEach((m) => {
        if (m) {
          extraModPrice += Number(m.price || 0);
          modList.push(m.name);
        }
      });
    });

    const unitPrice = basePrice + extraModPrice;
    const key = `item_${item.id}_v${selectedVariant?.id || 0}_m${modList.join("_")}`;

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
          price: unitPrice,
          qty: 1,
          variantId: selectedVariant?.id,
          variantName: selectedVariant?.name,
          modifiers: modList,
        },
      };
    });

    setSelectedItemForCustomization(null);
    showToast(`Added customized ${item.name}`, "success");
  };

  const updateCartQty = (key, delta) => {
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      const newQty = existing.qty + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { ...existing, qty: newQty } };
    });
  };

  const handlePlaceOrderSubmit = async (e) => {
    e.preventDefault();
    if (cartItemsList.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }

    try {
      setPlacingOrder(true);
      const payload = {
        token,
        customerName: customerName.trim() || "Online Guest",
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        fulfillment,
        couponCode: couponCode.trim() || undefined,
        loyaltyPointsToRedeem: Number(loyaltyPointsToRedeem || 0),
        paymentMethod,
        items: cartItemsList.map((ci) => ({
          menuItemId: ci.menuItemId,
          itemName: ci.name,
          qty: ci.qty,
          price: ci.price,
          variantName: ci.variantName,
          modifiers: ci.modifiers,
        })),
      };

      const res = await axios.post(`${API}/api/public/digital-menu/order`, payload);
      if (res.data?.order) {
        setPlacedOrder(res.data.order);
        setCart({});
        setShowCheckoutDrawer(false);
        showToast("Online Order Placed Successfully!", "success");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to place order", "error");
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-gray-400">Loading Digital Menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Digital Menu Unavailable</h2>
        <p className="text-sm text-gray-400 max-w-sm mb-6">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition"
        >
          Back to Tiffzy Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-28">
      {/* Banner Header */}
      {restaurant?.bannerUrl && (
        <div className="h-40 w-full overflow-hidden relative">
          <img
            src={restaurant.bannerUrl}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
        </div>
      )}

      {/* Restaurant Info Header */}
      <header className={`px-4 pt-4 pb-3 max-w-md mx-auto ${restaurant?.bannerUrl ? "-mt-12 relative z-10" : ""}`}>
        <div className="bg-gray-900 border border-gray-800/80 rounded-3xl p-4 shadow-2xl flex items-start space-x-4">
          {restaurant?.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-gray-800 flex-shrink-0 shadow-md"
            />
          ) : (
            <div className="p-4 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 flex-shrink-0">
              <Utensils className="w-8 h-8" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Open Now
              </span>
              <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Digital Menu
              </span>
            </div>
            <h1 className="text-lg font-black text-white mt-1 leading-tight truncate">
              {restaurant?.name || "Restaurant"}
            </h1>
            {restaurant?.addressLine1 && (
              <p className="text-xs text-gray-400 flex items-center space-x-1 mt-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <span>
                  {restaurant.addressLine1}, {restaurant.city}
                </span>
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Search & Category Tabs */}
      <div className="max-w-md mx-auto px-4 mt-2 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search food, beverages, desserts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex space-x-2 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-amber-500 text-gray-950 shadow-md shadow-amber-500/20 font-bold"
                  : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Catalog */}
      <main className="max-w-md mx-auto px-4 mt-4 space-y-3">
        {filteredMenu.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-xs">
            No menu items found.
          </div>
        ) : (
          filteredMenu.map((item) => (
            <div
              key={item.id}
              className={`bg-gray-900 border border-gray-800/80 rounded-2xl p-3.5 flex items-center justify-between space-x-4 shadow-lg transition ${
                !item.isAvailable ? "opacity-60" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 rounded-md font-medium">
                    {item.category || "General"}
                  </span>
                  {!item.isAvailable && (
                    <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md font-bold">
                      Currently Unavailable
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white mt-1 leading-tight truncate">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">
                    {item.description}
                  </p>
                )}

                {restaurant?.showPricesOnPublicMenu !== false && (
                  <div className="mt-2 text-sm font-extrabold text-amber-400">
                    ₹{item.price}
                  </div>
                )}
              </div>

              {/* Thumbnail & Add Button */}
              <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 rounded-xl object-cover border border-gray-800"
                  />
                )}
                {restaurant?.isPublicOrderingEnabled && (
                  <button
                    onClick={() => handleAddToCart(item)}
                    disabled={!item.isAvailable}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-md flex items-center space-x-1 ${
                      item.isAvailable
                        ? "bg-amber-500 hover:bg-amber-400 text-gray-950"
                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ADD</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Sticky Bottom View Cart Bar (When Online Ordering Enabled) */}
      {restaurant?.isPublicOrderingEnabled && cartItemsList.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent">
          <div className="max-w-md mx-auto bg-amber-500 text-gray-950 rounded-2xl p-3.5 flex items-center justify-between shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-950/20 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider block">
                  {cartItemsList.reduce((s, i) => s + i.qty, 0)} Items
                </span>
                <span className="text-lg font-black leading-none">
                  ₹{finalTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowCheckoutDrawer(true)}
              className="px-5 py-2 bg-gray-950 hover:bg-gray-900 text-amber-400 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-lg"
            >
              <span>View Cart</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Customization Modal */}
      {selectedItemForCustomization && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                Customize {selectedItemForCustomization.name}
              </h3>
              <button
                onClick={() => setSelectedItemForCustomization(null)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedItemForCustomization.variants?.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Select Variant
                </label>
                <div className="space-y-1.5">
                  {selectedItemForCustomization.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition ${
                        selectedVariant?.id === v.id
                          ? "bg-amber-500/10 border-amber-500 text-amber-400"
                          : "bg-gray-950 border-gray-800 text-gray-300"
                      }`}
                    >
                      <span>{v.name}</span>
                      <span>₹{v.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleConfirmCustomization}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs rounded-xl transition shadow-lg"
            >
              Add Item to Cart
            </button>
          </div>
        </div>
      )}

      {/* Checkout Drawer (Takeaway / Delivery) */}
      {showCheckoutDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-md bg-gray-900 border-t border-gray-800 rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Online Checkout</h3>
              </div>
              <button
                onClick={() => setShowCheckoutDrawer(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Type Choice */}
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1">
                Order Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFulfillment("TAKEAWAY")}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                    fulfillment === "TAKEAWAY"
                      ? "bg-amber-500/10 border-amber-500 text-amber-400"
                      : "bg-gray-950 border-gray-800 text-gray-400"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Takeaway</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillment("DELIVERY")}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                    fulfillment === "DELIVERY"
                      ? "bg-amber-500/10 border-amber-500 text-amber-400"
                      : "bg-gray-950 border-gray-800 text-gray-400"
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Delivery</span>
                </button>
              </div>
            </div>

            {/* Items Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Cart Items
              </span>
              <div className="bg-gray-950 rounded-2xl p-3 border border-gray-800 space-y-2.5">
                {cartItemsList.map((ci) => (
                  <div
                    key={ci.key}
                    className="flex items-center justify-between text-xs border-b border-gray-800/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="font-semibold text-white">{ci.name}</div>
                      {ci.variantName && (
                        <div className="text-[10px] text-amber-400">
                          Variant: {ci.variantName}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400">
                        ₹{ci.price} × {ci.qty}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateCartQty(ci.key, -1)}
                        className="p-1 bg-gray-800 text-gray-300 hover:text-white rounded-lg"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-white w-4 text-center">
                        {ci.qty}
                      </span>
                      <button
                        onClick={() => updateCartQty(ci.key, 1)}
                        className="p-1 bg-gray-800 text-gray-300 hover:text-white rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Checkout Form */}
            <form onSubmit={handlePlaceOrderSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ananya Roy"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Summary */}
              <div className="pt-2 border-t border-gray-800 text-xs space-y-1.5 text-gray-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{cartSubtotal.toFixed(2)}</span>
                </div>
                {restaurant?.taxEnabled && (
                  <div className="flex justify-between text-gray-400">
                    <span>GST Tax ({restaurant.defaultTaxPercent}%)</span>
                    <span>₹{taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-amber-400 pt-2 border-t border-gray-800">
                  <span>Total Payable</span>
                  <span>₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={placingOrder}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-xl text-xs font-extrabold uppercase tracking-wider transition shadow-lg"
              >
                {placingOrder ? "Placing Order..." : `Confirm ${fulfillment} Order`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Screen */}
      {placedOrder && (
        <div className="fixed inset-0 z-50 bg-gray-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl mb-4">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold">Order Received!</h2>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Your {placedOrder.fulfillment} order has been sent to {restaurant?.name}.
          </p>

          <div className="my-6 bg-gray-900 border border-gray-800 rounded-2xl p-4 w-full max-w-xs text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Order Number</span>
              <span className="font-bold text-amber-400">{placedOrder.orderNo}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Status</span>
              <span className="font-bold text-emerald-400 uppercase">
                {placedOrder.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total</span>
              <span className="font-bold text-white">₹{placedOrder.total}</span>
            </div>
          </div>

          <button
            onClick={() => setPlacedOrder(null)}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-xl text-xs font-bold transition shadow-lg"
          >
            Back to Digital Menu
          </button>
        </div>
      )}
    </div>
  );
}
