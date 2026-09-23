import React, { useState, useEffect } from "react";
import {
  QrCode,
  Printer,
  Download,
  RefreshCw,
  X,
  Copy,
  Check,
  Building,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Eye,
  Settings,
  ToggleLeft,
  ToggleRight,
  ShoppingCart,
} from "lucide-react";
import axios from "axios";
import { API } from "../config";
import { showToast } from "../utils/toast";

export default function DigitalMenuQrModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantName = "Tiffzy Restaurant",
  restaurantSlug = "tiffzy",
}) {
  const [loading, setLoading] = useState(true);
  const [restaurantData, setRestaurantData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirmRegen, setShowConfirmRegen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings State
  const [isPublicMenuEnabled, setIsPublicMenuEnabled] = useState(true);
  const [isPublicOrderingEnabled, setIsPublicOrderingEnabled] = useState(true);
  const [showPricesOnPublicMenu, setShowPricesOnPublicMenu] = useState(true);
  const [showUnavailableItemsOnPublicMenu, setShowUnavailableItemsOnPublicMenu] = useState(true);

  // Fetch Digital Menu configuration for restaurant on open
  useEffect(() => {
    if (!isOpen || !restaurantId) return;

    const fetchMenuInfo = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API}/owner/${restaurantId}/digital-menu`);
        if (res.data?.restaurant) {
          const r = res.data.restaurant;
          setRestaurantData(r);
          setIsPublicMenuEnabled(r.isPublicMenuEnabled ?? true);
          setIsPublicOrderingEnabled(r.isPublicOrderingEnabled ?? true);
          setShowPricesOnPublicMenu(r.showPricesOnPublicMenu ?? true);
          setShowUnavailableItemsOnPublicMenu(r.showUnavailableItemsOnPublicMenu ?? true);
        }
      } catch (err) {
        showToast(err.response?.data?.message || "Failed to load digital menu configuration", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchMenuInfo();
  }, [isOpen, restaurantId]);

  if (!isOpen) return null;

  const publicToken = restaurantData?.publicMenuToken || restaurantSlug;
  const menuTargetUrl = `${window.location.origin}/menu/${publicToken}`;
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    menuTargetUrl
  )}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(menuTargetUrl);
    setCopied(true);
    showToast("Public Menu URL copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePreview = () => {
    window.open(`/menu/${publicToken}`, "_blank");
  };

  const handleRegenerateToken = async () => {
    if (!restaurantId) return;
    setRegenerating(true);
    try {
      const res = await axios.post(`${API}/owner/${restaurantId}/digital-menu/regenerate`);
      if (res.data?.restaurant) {
        setRestaurantData(res.data.restaurant);
        showToast("Digital Menu QR token regenerated! Old menu links are now invalidated.", "success");
      }
      setShowConfirmRegen(false);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to regenerate menu token", "error");
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleSetting = async (key, val) => {
    if (!restaurantId) return;
    const updatedSettings = {
      isPublicMenuEnabled: key === "menu" ? val : isPublicMenuEnabled,
      isPublicOrderingEnabled: key === "ordering" ? val : isPublicOrderingEnabled,
      showPricesOnPublicMenu: key === "prices" ? val : showPricesOnPublicMenu,
      showUnavailableItemsOnPublicMenu: key === "unavailable" ? val : showUnavailableItemsOnPublicMenu,
    };

    if (key === "menu") setIsPublicMenuEnabled(val);
    if (key === "ordering") setIsPublicOrderingEnabled(val);
    if (key === "prices") setShowPricesOnPublicMenu(val);
    if (key === "unavailable") setShowUnavailableItemsOnPublicMenu(val);

    try {
      setSavingSettings(true);
      await axios.put(`${API}/owner/${restaurantId}/digital-menu/settings`, updatedSettings);
      showToast("Digital menu settings saved", "success");
    } catch (err) {
      showToast("Failed to update settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Hide controls during browser print */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-digital-menu-area, .printable-digital-menu-area * {
              visibility: visible;
            }
            .printable-digital-menu-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950 no-print">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Public Digital Menu QR Studio</h3>
              <p className="text-xs text-gray-400">
                {restaurantName} • Self-Service Menu Card (No Table Required)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handlePreview}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl transition"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span>Preview Menu</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-bold rounded-xl transition shadow-lg shadow-amber-500/20"
            >
              <Printer className="w-4 h-4" />
              <span>Print Card</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-900/50">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-xs">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading Digital Menu details...
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
              {/* Printable Digital Menu QR Card */}
              <div className="printable-digital-menu-area flex-shrink-0 mx-auto">
                <div className="w-80 bg-gradient-to-b from-gray-950 via-gray-900 to-amber-950/30 border-2 border-amber-500/30 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Header */}
                  <div className="mb-4">
                    <div className="inline-flex items-center space-x-2 px-3.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-[11px] font-bold mb-2 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Digital Menu</span>
                    </div>
                    <h2 className="text-xl font-black text-white tracking-tight">
                      {restaurantName}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Scan to view our complete menu on your phone
                    </p>
                  </div>

                  {/* QR Box */}
                  <div className="my-3 bg-white p-4 rounded-2xl shadow-2xl border-4 border-gray-800 inline-block">
                    <img
                      src={qrImageSrc}
                      alt={`${restaurantName} Digital Menu QR`}
                      className="w-48 h-48 object-contain rounded-lg"
                    />
                  </div>

                  {/* Instructions */}
                  <div className="mt-3 text-xs text-gray-300 font-medium space-y-1">
                    <p className="text-amber-300 font-bold">
                      SCAN TO VIEW OUR MENU
                    </p>
                    <p className="text-gray-400 text-[11px]">
                      No app download required • Browse dishes & prices
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-800 text-[10px] text-gray-500 font-mono">
                    Powered by Tiffzy Restaurant Platform
                  </div>
                </div>
              </div>

              {/* Sidebar Configuration */}
              <div className="w-full md:w-96 flex flex-col space-y-4 no-print">
                {/* Public Link Box */}
                <div className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Public Menu URL
                  </h4>
                  <div className="flex items-center space-x-2 bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                    <input
                      type="text"
                      readOnly
                      value={menuTargetUrl}
                      className="bg-transparent text-xs text-amber-300 w-full outline-none font-mono truncate"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition"
                      title="Copy URL"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Settings Controls */}
                <div className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-700/60 pb-2">
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <Settings className="w-4 h-4 text-amber-400" />
                      <span>Digital Menu Settings</span>
                    </h4>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {/* Public Menu Enabled */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-white block">Enable Public Menu</span>
                        <span className="text-[10px] text-gray-400">Allow customers to scan & view menu</span>
                      </div>
                      <button
                        onClick={() => handleToggleSetting("menu", !isPublicMenuEnabled)}
                        className="p-1 text-amber-400 hover:scale-105 transition"
                      >
                        {isPublicMenuEnabled ? (
                          <ToggleRight className="w-7 h-7 text-amber-400" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-gray-600" />
                        )}
                      </button>
                    </div>

                    {/* Online Ordering Enabled */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-white block">Enable Online Ordering</span>
                        <span className="text-[10px] text-gray-400">Allow takeaway/delivery checkout from menu</span>
                      </div>
                      <button
                        onClick={() => handleToggleSetting("ordering", !isPublicOrderingEnabled)}
                        className="p-1 text-amber-400 hover:scale-105 transition"
                      >
                        {isPublicOrderingEnabled ? (
                          <ToggleRight className="w-7 h-7 text-amber-400" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-gray-600" />
                        )}
                      </button>
                    </div>

                    {/* Show Prices */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-white block">Show Dish Prices</span>
                        <span className="text-[10px] text-gray-400">Display item prices on public menu</span>
                      </div>
                      <button
                        onClick={() => handleToggleSetting("prices", !showPricesOnPublicMenu)}
                        className="p-1 text-amber-400 hover:scale-105 transition"
                      >
                        {showPricesOnPublicMenu ? (
                          <ToggleRight className="w-7 h-7 text-amber-400" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Security & Token Regeneration Box */}
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start space-x-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-300">
                        Menu Token Security
                      </h4>
                      <p className="text-[11px] text-amber-200/70 mt-0.5">
                        Regenerate token if printed menu QR code needs to be revoked. Old links will stop working.
                      </p>
                    </div>
                  </div>

                  {!showConfirmRegen ? (
                    <button
                      onClick={() => setShowConfirmRegen(true)}
                      className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate Public Menu Token</span>
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] text-red-300 font-semibold">
                        Are you sure? Previously printed digital menu QRs will be invalidated!
                      </p>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleRegenerateToken}
                          disabled={regenerating}
                          className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition"
                        >
                          {regenerating ? "Regenerating..." : "Yes, Regenerate"}
                        </button>
                        <button
                          onClick={() => setShowConfirmRegen(false)}
                          className="px-3 py-1.5 bg-gray-800 text-gray-300 hover:text-white rounded-lg text-xs transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-950 flex items-center justify-between text-xs text-gray-400 no-print">
          <span>{restaurantName} • Digital Menu Studio</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
