import { useEffect, useState } from "react";
import { Bell, Shield, Sparkles, Tag, Star, PackageCheck, AlertCircle } from "lucide-react";
import { api } from "../../../utils/apiClient";
import { showToast } from "../../../utils/toast";
import NotificationSoundPicker from "../../../components/NotificationSoundPicker";

export default function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    orderUpdates: true,
    paymentUpdates: true,
    deliveryUpdates: true,
    promotions: true,
    coupons: true,
    reviewReminders: true,
  });

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/notifications/preferences");
      if (res.data?.preferences) {
        setPrefs(res.data.preferences);
      }
    } catch {
      // Fallback to defaults if non-authenticated or error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const handleToggle = async (key) => {
    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);

    try {
      setSaving(true);
      await api.patch("/api/notifications/preferences", nextPrefs);
      showToast({
        title: "Saved",
        message: "Notification preferences updated",
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Error",
        message: err.response?.data?.message || "Failed to update preferences",
        variant: "error",
      });
      // Revert state on error
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center theme-muted">Loading preferences...</div>;
  }

  const items = [
    {
      key: "orderUpdates",
      label: "Order Status Updates",
      desc: "Instant alerts when your food is accepted, preparing, or ready.",
      icon: <PackageCheck className="text-amber-500" size={20} />,
      critical: true,
    },
    {
      key: "paymentUpdates",
      label: "Payment & Refund Alerts",
      desc: "Real-time updates on Cashfree payment verification and refunds.",
      icon: <Shield className="text-emerald-400" size={20} />,
      critical: true,
    },
    {
      key: "deliveryUpdates",
      label: "Delivery Partner Tracking",
      desc: "Live notifications when a delivery partner is assigned or nearby.",
      icon: <Bell className="text-sky-400" size={20} />,
      critical: true,
    },
    {
      key: "promotions",
      label: "Special Offers & Deals",
      desc: "Personalized discounts, weekend dining specials, and festive offers.",
      icon: <Sparkles className="text-amber-400" size={20} />,
      critical: false,
    },
    {
      key: "coupons",
      label: "Coupons & Cashbacks",
      desc: "Alerts when new promo codes or Khata wallet cashbacks are unlocked.",
      icon: <Tag className="text-rose-400" size={20} />,
      critical: false,
    },
    {
      key: "reviewReminders",
      label: "Rating & Review Reminders",
      desc: "Occasional reminders to rate your recent dining and order experience.",
      icon: <Star className="text-amber-300" size={20} />,
      critical: false,
    },
  ];

  return (
    <div className="space-y-6 text-left">
      <header className="theme-panel rounded-[32px] p-6">
        <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">
          Control Center
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Notification Settings
        </h1>
        <p className="theme-muted mt-2 text-sm leading-relaxed max-w-xl">
          Customize which notifications you receive across App Push, SMS, and Realtime WebSockets.
        </p>
      </header>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="theme-panel flex items-center justify-between rounded-2xl border border-white/10 p-5 transition hover:bg-white/[0.03]"
          >
            <div className="flex items-start gap-4">
              <div className="mt-1 shrink-0">{item.icon}</div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white/90">{item.label}</h3>
                  {item.critical && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      Essential
                    </span>
                  )}
                </div>
                <p className="theme-muted mt-1 text-xs leading-relaxed max-w-md">
                  {item.desc}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleToggle(item.key)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                prefs[item.key] ? "bg-amber-500" : "bg-white/20"
              }`}
              role="switch"
              aria-checked={prefs[item.key]}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  prefs[item.key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <NotificationSoundPicker />
    </div>
  );
}
