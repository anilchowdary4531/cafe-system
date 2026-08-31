import { useState, useEffect } from "react";
import { Bell, X, ArrowRight, ShoppingBag, Utensils } from "lucide-react";
import { playNotificationSound } from "../utils/soundPlayer";
import { appendOwnerNotification } from "../utils/ownerNotifications";

export default function NewOrderPopup({ order, onClose, onViewOrder }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (order) {
      setVisible(true);
      playNotificationSound();

      // Append to local notification store
      const orderNo = order.orderNo || `#${order.id || ""}`;
      const total = order.total ? `₹${order.total}` : "";
      const tableInfo = order.tableNo ? `Table ${order.tableNo}` : "Takeaway / Delivery";

      appendOwnerNotification({
        title: "🔔 New Order Received!",
        message: `Order ${orderNo} (${tableInfo}) for ${total}`,
        type: "orders",
      });
    }
  }, [order]);

  if (!visible || !order) return null;

  const orderNo = order.orderNo || `#${order.id || ""}`;
  const total = order.total ? `₹${order.total}` : "";
  const tableNo = order.tableNo ? `Table ${order.tableNo}` : "Takeaway";
  const customer = order.customerName || order.phone || "Customer";
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="fixed top-5 right-5 z-[9999] max-w-md w-full animate-in slide-in-from-top-5 duration-300">
      <div className="relative rounded-3xl border border-amber-500/40 bg-slate-900/95 p-5 text-white shadow-2xl backdrop-blur-xl space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 animate-bounce">
              <Bell size={22} />
            </div>
            <div>
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Realtime Alert
              </span>
              <h4 className="font-extrabold text-base text-white mt-0.5">
                🔔 New Order Received!
              </h4>
            </div>
          </div>

          <button
            onClick={() => {
              setVisible(false);
              onClose?.();
            }}
            className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Details Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-amber-300">{orderNo}</span>
            <span className="font-extrabold text-base text-emerald-400">{total}</span>
          </div>

          <div className="flex items-center gap-3 text-xs theme-muted">
            <span className="flex items-center gap-1">
              <Utensils size={12} className="text-amber-400" />
              {tableNo}
            </span>
            <span>•</span>
            <span className="truncate">{customer}</span>
          </div>

          {items.length > 0 && (
            <div className="pt-2 border-t border-white/5 text-xs text-white/70 space-y-1">
              {items.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.qty}x {item.itemName || item.name}</span>
                  <span>₹{item.total || (item.qty * (item.price || 0))}</span>
                </div>
              ))}
              {items.length > 3 && (
                <p className="text-[10px] theme-muted pt-1">
                  +{items.length - 3} more items...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => {
              setVisible(false);
              onClose?.();
            }}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/10 transition"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              setVisible(false);
              onViewOrder?.(order);
            }}
            className="flex-1 theme-button flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white shadow-lg"
          >
            View Order <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
