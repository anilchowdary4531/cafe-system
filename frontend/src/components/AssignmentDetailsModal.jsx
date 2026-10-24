import React from "react";
import { X, Info, ChefHat, Clock, Hash, MapPin, User, Tag, FileText } from "lucide-react";

export default function AssignmentDetailsModal({
  isOpen = false,
  onClose,
  item = null,
  kot = null,
}) {
  if (!isOpen || !item) return null;

  const canonicalItemId = item.orderItemId || item.id;
  const isAssigned = Boolean(item.assignedChefId);

  const details = [
    { label: "Order ID", value: kot?.orderId || kot?.order?.id ? `#${kot?.orderId || kot?.order?.id}` : "N/A", icon: Hash },
    { label: "OrderItem ID", value: `#${canonicalItemId}`, icon: Hash, highlight: true },
    { label: "KOT Number", value: kot?.kotNo ? (String(kot.kotNo).startsWith("KOT-") ? kot.kotNo : `KOT-${kot.kotNo}`) : "N/A", icon: FileText },
    { label: "Item Name", value: `${item.qty || item.quantity || 1}× ${item.itemName || item.name}`, icon: Tag, bold: true },
    { label: "Current Chef", value: item.assignedChefName || (isAssigned ? `Chef #${item.assignedChefId}` : "Unassigned"), icon: ChefHat, status: isAssigned ? "assigned" : "unassigned" },
    { label: "Assigned By", value: item.assignedByName || (isAssigned ? "Senior Chef" : "—"), icon: User },
    { label: "Assigned At", value: item.assignedAt ? new Date(item.assignedAt).toLocaleString() : "—", icon: Clock },
    { label: "Assignment Source", value: item.assignmentSource ? (item.assignmentSource === "SELF_PICKED" ? "Self-Picked" : "Dispatched by Senior Chef") : "—", icon: Info },
    { label: "Item Status", value: item.status || "PENDING", icon: Info, statusTag: true },
    { label: "Station", value: kot?.stationName || "MAIN KITCHEN", icon: MapPin },
    { label: "Table / Context", value: kot?.tableNo ? `Table ${kot.tableNo}` : "Takeaway / Direct Order", icon: MapPin },
    { label: "Customer", value: kot?.order?.customerName || "Walk-in Guest", icon: User },
  ];

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-modal-title"
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Info size={18} />
            </div>
            <div>
              <h3 id="details-modal-title" className="text-sm font-bold text-slate-900">
                View Assignment Details
              </h3>
              <p className="text-[11px] text-slate-500">
                Authoritative item & assignment metadata
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {details.map((d, idx) => {
              const Icon = d.icon;
              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                    d.highlight
                      ? "border-orange-200 bg-orange-50/40"
                      : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px] mb-1">
                    <Icon size={12} className={d.highlight ? "text-orange-500" : "text-slate-400"} />
                    <span>{d.label}</span>
                  </div>
                  <div className={`font-semibold ${d.bold ? "text-sm text-slate-900" : "text-slate-800"}`}>
                    {d.statusTag ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.value === "READY" ? "bg-emerald-100 text-emerald-800" :
                        d.value === "PREPARING" ? "bg-orange-100 text-orange-800" :
                        "bg-slate-200 text-slate-700"
                      }`}>
                        {d.value}
                      </span>
                    ) : d.status === "assigned" ? (
                      <span className="text-emerald-700 font-bold">{d.value}</span>
                    ) : d.status === "unassigned" ? (
                      <span className="text-amber-700 font-bold">{d.value}</span>
                    ) : (
                      <span>{d.value}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes or Modifiers if present */}
          {(item.notes || (Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0)) && (
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
              <div className="text-[11px] font-bold text-amber-800">Special Instructions / Modifiers:</div>
              {item.notes && <div className="text-amber-700 italic">"{item.notes}"</div>}
              {Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                <div className="text-slate-600 text-[11px]">
                  {item.selectedModifiers.map((m, i) => (
                    <span key={i} className="inline-block mr-2">• {typeof m === "string" ? m : m.name}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-3 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition shadow-sm cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
