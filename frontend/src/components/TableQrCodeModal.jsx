import React, { useState } from "react";
import {
  QrCode,
  Printer,
  Download,
  RefreshCw,
  X,
  Copy,
  Check,
  Building,
  UtensilsCrossed,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import axios from "axios";
import { API } from "../config";
import { showToast } from "../utils/toast";

export default function TableQrCodeModal({
  isOpen,
  onClose,
  table,
  tables = [],
  restaurantName = "Tiffzy Restaurant",
  restaurantSlug = "tiffzy",
  restaurantId,
  onQrRegenerated,
}) {
  const [activeTab, setActiveTab] = useState("SINGLE"); // "SINGLE" | "BATCH"
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirmRegen, setShowConfirmRegen] = useState(false);

  if (!isOpen) return null;

  const currentTable = table || (tables.length > 0 ? tables[0] : null);
  const qrToken = currentTable?.qrToken || currentTable?.id;
  
  const getQrTargetUrl = (tbl) => {
    const token = tbl?.qrToken || tbl?.id;
    return `${window.location.origin}/order/table/${token}`;
  };

  const currentQrTargetUrl = currentTable ? getQrTargetUrl(currentTable) : "";
  const currentQrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    currentQrTargetUrl
  )}`;

  const handleCopyUrl = () => {
    if (!currentQrTargetUrl) return;
    navigator.clipboard.writeText(currentQrTargetUrl);
    setCopied(true);
    showToast("QR Order URL copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRegenerateToken = async () => {
    if (!currentTable || !restaurantId) return;
    setRegenerating(true);
    try {
      const res = await axios.post(
        `${API}/owner/${restaurantId}/tables/${currentTable.id}/qr/regenerate`
      );
      if (res.data?.table) {
        showToast(
          `QR Token regenerated for Table ${currentTable.tableNo}. Old QR codes are now invalidated.`,
          "success"
        );
        if (onQrRegenerated) {
          onQrRegenerated(res.data.table);
        }
      }
      setShowConfirmRegen(false);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to regenerate QR token", "error");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Hide modal controls during print */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-qr-area, .printable-qr-area * {
              visibility: visible;
            }
            .printable-qr-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
            .print-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 20px !important;
              padding: 20px !important;
            }
          }
        `}
      </style>

      <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950 no-print">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">QR Code Studio</h3>
              <p className="text-xs text-gray-400">
                {restaurantName} • Scan-to-Order Cards
              </p>
            </div>
          </div>

          {/* Tab Selector & Controls */}
          <div className="flex items-center space-x-3">
            <div className="flex bg-gray-800/80 p-1 rounded-xl border border-gray-700/50">
              <button
                onClick={() => setActiveTab("SINGLE")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "SINGLE"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Table {currentTable?.tableNo || "Card"}
              </button>
              <button
                onClick={() => setActiveTab("BATCH")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "BATCH"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Batch Sheet ({tables.length || 1})
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-emerald-900/30"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-900/50">
          {activeTab === "SINGLE" && currentTable && (
            <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
              {/* Printable Table QR Card */}
              <div className="printable-qr-area">
                <div className="w-80 bg-gradient-to-b from-gray-950 via-gray-900 to-indigo-950/40 border-2 border-indigo-500/30 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Header */}
                  <div className="mb-4">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Scan to Order</span>
                    </div>
                    <h2 className="text-xl font-extrabold text-white tracking-tight">
                      {restaurantName}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Dine-in Digital Menu & Instant Ordering
                    </p>
                  </div>

                  {/* Table Badge */}
                  <div className="my-3 py-2 px-4 bg-gray-800/90 border border-gray-700/80 rounded-2xl inline-block shadow-inner">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block">
                      Table Number
                    </span>
                    <span className="text-3xl font-black text-amber-400">
                      {currentTable.tableNo}
                    </span>
                  </div>

                  {/* QR Image Box */}
                  <div className="my-4 bg-white p-4 rounded-2xl shadow-xl border-4 border-gray-800 inline-block relative group">
                    <img
                      src={currentQrImage}
                      alt={`Table ${currentTable.tableNo} QR Code`}
                      className="w-48 h-48 object-contain rounded-lg"
                    />
                  </div>

                  {/* Instructions */}
                  <div className="mt-2 text-xs text-gray-300 font-medium space-y-1">
                    <p className="text-indigo-300 font-semibold">
                      1. Open Phone Camera or QR Scanner
                    </p>
                    <p className="text-gray-400">
                      2. Browse menu & place your order directly!
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-800/80 text-[10px] text-gray-500 font-mono">
                    Powered by Tiffzy POS • Secure QR Code
                  </div>
                </div>
              </div>

              {/* Action Sidebar */}
              <div className="w-full md:w-80 flex flex-col space-y-4 no-print">
                <div className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    QR Target & Link
                  </h4>
                  <div className="flex items-center space-x-2 bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                    <input
                      type="text"
                      readOnly
                      value={currentQrTargetUrl}
                      className="bg-transparent text-xs text-indigo-300 w-full outline-none font-mono truncate"
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

                {/* Regenerate Token Box */}
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start space-x-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-300">
                        QR Security Token
                      </h4>
                      <p className="text-[11px] text-amber-200/70 mt-0.5">
                        Token guarantees unguessable URL. Regenerate to invalidate old printed codes.
                      </p>
                    </div>
                  </div>

                  {!showConfirmRegen ? (
                    <button
                      onClick={() => setShowConfirmRegen(true)}
                      className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate Table Token</span>
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] text-red-300 font-semibold">
                        Are you sure? Old QR prints will stop working for new scans!
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

          {activeTab === "BATCH" && (
            <div className="printable-qr-area">
              <div className="print-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(tables.length > 0 ? tables : [currentTable]).map((tbl) => {
                  const targetUrl = getQrTargetUrl(tbl);
                  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    targetUrl
                  )}`;
                  return (
                    <div
                      key={tbl.id}
                      className="bg-gray-950 border border-gray-800 rounded-2xl p-5 text-center flex flex-col items-center justify-between shadow-lg"
                    >
                      <div className="w-full mb-2">
                        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                          {restaurantName}
                        </span>
                        <div className="text-2xl font-black text-amber-400 mt-1">
                          Table {tbl.tableNo}
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {tbl.section || "Main Floor"} • Seats {tbl.seats || 4}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-gray-700 my-2">
                        <img
                          src={qrImg}
                          alt={`Table ${tbl.tableNo} QR`}
                          className="w-36 h-36 object-contain"
                        />
                      </div>

                      <div className="text-[10px] text-gray-400 mt-2 font-medium">
                        Scan to Order • Tiffzy POS
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-950 flex items-center justify-between text-xs text-gray-400 no-print">
          <span>
            {tables.length} Active Tables in {restaurantName}
          </span>
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
