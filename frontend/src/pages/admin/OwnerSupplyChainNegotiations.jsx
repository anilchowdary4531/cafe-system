import React, { useState, useEffect, useMemo } from "react";
import {
    Handshake,
    Search,
    Filter,
    Building2,
    MessageSquare,
    Send,
    CheckCircle2,
    XCircle,
    Clock,
    DollarSign,
    RefreshCw,
    X,
    FileText,
    TrendingDown,
    ArrowRight,
    ShieldCheck,
    Star,
    Sparkles,
    Check,
    Layers,
    AlertCircle,
    CheckSquare,
    Plus,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";
import OwnerMenuButton from "../../components/OwnerMenuButton";

export default function OwnerSupplyChainNegotiations() {
    const [negotiations, setNegotiations] = useState([]);
    const [metrics, setMetrics] = useState({
        active: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
        expired: 0,
        totalSavings: 0,
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter & Search
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, PENDING, ACCEPTED, REJECTED, EXPIRED

    // Active Selection & Chat
    const [selectedNegotiation, setSelectedNegotiation] = useState(null);
    const [messageInput, setMessageInput] = useState("");
    const [counterPriceInput, setCounterPriceInput] = useState("");
    const [submittingAction, setSubmittingAction] = useState(false);
    const [generatingPO, setGeneratingPO] = useState(false);

    const fetchNegotiations = async () => {
        try {
            setRefreshing(true);
            const res = await api.get("/api/supply/negotiations");
            if (res.data) {
                const list = res.data.negotiations || [];
                setNegotiations(list);
                if (res.data.metrics) setMetrics(res.data.metrics);

                // Preserve or set initial selected
                if (list.length > 0) {
                    if (!selectedNegotiation) {
                        setSelectedNegotiation(list[0]);
                    } else {
                        const updatedSelected = list.find((n) => n.id === selectedNegotiation.id);
                        if (updatedSelected) setSelectedNegotiation(updatedSelected);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to fetch negotiations:", err);
            showToast.error("Failed to load negotiations list");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchNegotiations();
    }, []);

    // Filtered List
    const filteredNegotiations = useMemo(() => {
        return negotiations.filter((n) => {
            const matchesSearch =
                (n.negotiationNo || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (n.productName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (n.supplier?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

            let matchesStatus = true;
            if (statusFilter === "ACTIVE") matchesStatus = ["ACTIVE", "SUPPLIER_COUNTER", "RESTAURANT_COUNTER"].includes(n.status);
            if (statusFilter === "PENDING") matchesStatus = n.status === "PENDING";
            if (statusFilter === "ACCEPTED") matchesStatus = ["ACCEPTED", "PO_GENERATED"].includes(n.status);
            if (statusFilter === "REJECTED") matchesStatus = n.status === "REJECTED";
            if (statusFilter === "EXPIRED") matchesStatus = n.status === "EXPIRED";

            return matchesSearch && matchesStatus;
        });
    }, [negotiations, searchQuery, statusFilter]);

    // Handle Send Message / Counter Offer
    const handleSendMessage = async (actionType = "MESSAGE") => {
        if (!selectedNegotiation) return;

        if (actionType === "COUNTER" && (!counterPriceInput || Number(counterPriceInput) <= 0)) {
            showToast.error("Please enter a valid counter offer price");
            return;
        }

        try {
            setSubmittingAction(true);
            const payload = {
                message: messageInput || (actionType === "COUNTER" ? `Proposed counter offer of ₹${counterPriceInput}/${selectedNegotiation.unit}` : actionType),
                proposedPrice: actionType === "COUNTER" ? Number(counterPriceInput) : undefined,
                action: actionType,
            };

            const res = await api.post(`/api/supply/negotiations/${selectedNegotiation.id}/messages`, payload);
            showToast.success("Negotiation message sent!");
            setMessageInput("");
            setCounterPriceInput("");
            fetchNegotiations();
        } catch (err) {
            console.error("Error sending message:", err);
            showToast.error(err.response?.data?.error || "Failed to send message");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Handle Generate Purchase Order from Accepted Price
    const handleGeneratePO = async () => {
        if (!selectedNegotiation) return;

        try {
            setGeneratingPO(true);
            const res = await api.post(`/api/supply/negotiations/${selectedNegotiation.id}/generate-po`);
            showToast.success(res.data?.message || "Purchase Order generated successfully!");
            fetchNegotiations();
        } catch (err) {
            console.error("Error generating PO:", err);
            showToast.error(err.response?.data?.error || "Failed to generate Purchase Order");
        } finally {
            setGeneratingPO(false);
        }
    };

    return (
        <section className="space-y-4 font-sans text-sm text-slate-900 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 print:hidden">
                <div className="flex items-center gap-2">
                    <OwnerMenuButton />
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span>Negotiations</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <Handshake className="text-orange-500" size={20} />
                            B2B Live Price Negotiations
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchNegotiations}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            <SupplyChainSubNav />

            {/* Compact Financial KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pb-3 border-b border-slate-200/80 print:hidden">
                <div>
                    <span className="text-xs text-slate-500 font-medium">Active Discussions</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">{metrics.active}</div>
                </div>
                <div>
                    <span className="text-xs text-amber-600 font-medium">Pending Offers</span>
                    <div className="text-xl font-bold text-amber-600 mt-0.5">{metrics.pending}</div>
                </div>
                <div>
                    <span className="text-xs text-emerald-600 font-medium">Accepted Deals</span>
                    <div className="text-xl font-bold text-emerald-600 mt-0.5">{metrics.accepted}</div>
                </div>
                <div>
                    <span className="text-xs text-rose-600 font-medium">Rejected / Expired</span>
                    <div className="text-xl font-bold text-rose-600 mt-0.5">{metrics.rejected + metrics.expired}</div>
                </div>
                <div>
                    <span className="text-xs text-purple-600 font-medium">Total Negotiated Savings</span>
                    <div className="text-xl font-bold text-purple-600 mt-0.5">₹{metrics.totalSavings.toFixed(2)}</div>
                </div>
            </div>

            {/* Status Tabs Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200/80 print:hidden">
                {[
                    { id: "ALL", label: `All (${negotiations.length})` },
                    { id: "ACTIVE", label: `Active (${metrics.active})` },
                    { id: "PENDING", label: `Pending Offers (${metrics.pending})` },
                    { id: "ACCEPTED", label: `Accepted (${metrics.accepted})` },
                    { id: "REJECTED", label: `Rejected (${metrics.rejected})` },
                    { id: "EXPIRED", label: `Expired (${metrics.expired})` },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                            statusFilter === tab.id
                                ? "bg-orange-500 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* MASTER - DETAIL NEGOTIATION HUB */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* LEFT PANEL: Compact Negotiation List */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col max-h-[720px]">
                    <div className="p-3 border-b border-slate-200/80">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search quote #, product, vendor..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
                            </div>
                        ) : filteredNegotiations.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-400">No negotiation quotes found</div>
                        ) : (
                            filteredNegotiations.map((item) => {
                                const isSelected = selectedNegotiation?.id === item.id;
                                const supplierName = item.supplier?.name || "Wholesale Supplier";
                                const statusBadge =
                                    item.status === "ACCEPTED" || item.status === "PO_GENERATED"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : item.status === "REJECTED" || item.status === "EXPIRED"
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200";

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedNegotiation(item)}
                                        className={`p-3 transition cursor-pointer flex flex-col justify-between space-y-1.5 ${
                                            isSelected ? "bg-orange-50/70 border-l-4 border-l-orange-500" : "hover:bg-slate-50/70"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-[10px] font-bold text-orange-600 font-mono">#{item.negotiationNo}</span>
                                                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.productName}</h4>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${statusBadge}`}>
                                                {item.status.replace("_", " ")}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span className="truncate">{supplierName}</span>
                                            <span className="font-semibold text-slate-700">
                                                {item.quantity} {item.unit}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                                            <span className="text-[10px] text-slate-400">Catalog: ₹{item.catalogPrice}</span>
                                            <span className="font-bold text-emerald-600">Current Offer: ₹{item.currentOffer}/{item.unit}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Live Conversation & Details Room */}
                <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col max-h-[720px]">
                    {!selectedNegotiation ? (
                        <div className="p-16 text-center text-slate-400 space-y-2">
                            <Handshake size={36} className="mx-auto text-slate-300 mb-2" />
                            <h3 className="text-sm font-semibold text-slate-700">Select a negotiation quote</h3>
                            <p className="text-xs text-slate-400">Choose a negotiation thread from the left panel to view timeline & submit offers.</p>
                        </div>
                    ) : (
                        <>
                            {/* Negotiation Header */}
                            <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-bold text-orange-600">#{selectedNegotiation.negotiationNo}</span>
                                            <span className="text-xs text-slate-300">•</span>
                                            <span className="text-xs text-slate-600 font-semibold">{selectedNegotiation.supplier?.name || "Wholesale Supplier"}</span>
                                        </div>
                                        <h2 className="text-base font-bold text-slate-900 mt-0.5">{selectedNegotiation.productName}</h2>
                                    </div>

                                    {/* Action Header Button: GENERATE PO */}
                                    {(selectedNegotiation.status === "ACCEPTED" || selectedNegotiation.status === "PO_GENERATED") && (
                                        <div>
                                            {selectedNegotiation.status === "PO_GENERATED" ? (
                                                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                                                    <CheckCircle2 size={14} /> PO Generated (#{selectedNegotiation.purchaseOrderId || "PO-2001"})
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={handleGeneratePO}
                                                    disabled={generatingPO}
                                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <FileText size={14} />
                                                    {generatingPO ? "Generating PO..." : "Generate PO from Deal"}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Price Overview Strip */}
                                <div className="grid grid-cols-4 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80 text-center text-xs">
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Requested Qty</span>
                                        <span className="text-xs font-bold text-slate-900">{selectedNegotiation.quantity} {selectedNegotiation.unit}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Catalog Rate</span>
                                        <span className="text-xs font-bold text-slate-400 line-through">₹{selectedNegotiation.catalogPrice}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Current Offer</span>
                                        <span className="text-xs font-bold text-amber-600">₹{selectedNegotiation.currentOffer} / {selectedNegotiation.unit}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Agreed</span>
                                        <span className="text-xs font-bold text-emerald-600">
                                            ₹{((selectedNegotiation.finalPrice || selectedNegotiation.currentOffer) * selectedNegotiation.quantity).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Conversation Message Timeline */}
                            <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-white">
                                {(selectedNegotiation.messages || []).map((msg, idx) => {
                                    const isRestaurant = msg.senderRole === "RESTAURANT";

                                    return (
                                        <div key={idx} className={`flex flex-col ${isRestaurant ? "items-end" : "items-start"}`}>
                                            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                                                <span className="font-semibold text-slate-600">{msg.senderName || (isRestaurant ? "Restaurant" : "Supplier")}</span>
                                                <span>•</span>
                                                <span>{new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                                            </div>

                                            <div
                                                className={`max-w-md p-3 rounded-xl border text-xs space-y-1 ${
                                                    isRestaurant
                                                        ? "bg-orange-50/70 border-orange-200/80 text-slate-900 rounded-tr-none"
                                                        : "bg-slate-50 border-slate-200 text-slate-900 rounded-tl-none"
                                                }`}
                                            >
                                                {msg.proposedPrice && (
                                                    <div className="font-bold text-xs text-emerald-700 pb-1 border-b border-slate-200/80">
                                                        Proposed Price: ₹{msg.proposedPrice} / {selectedNegotiation.unit}
                                                    </div>
                                                )}
                                                <p className="leading-relaxed text-slate-800">{msg.message}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Actions & Input Footer */}
                            {selectedNegotiation.status !== "PO_GENERATED" && selectedNegotiation.status !== "REJECTED" && (
                                <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 space-y-2.5">
                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="Counter Rate (₹)"
                                                value={counterPriceInput}
                                                onChange={(e) => setCounterPriceInput(e.target.value)}
                                                className="w-32 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                                            />
                                            <button
                                                onClick={() => handleSendMessage("COUNTER")}
                                                disabled={submittingAction}
                                                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                                            >
                                                Send Counter Offer
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleSendMessage("ACCEPT")}
                                                disabled={submittingAction}
                                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1 cursor-pointer"
                                            >
                                                <Check size={13} /> Accept Price
                                            </button>

                                            <button
                                                onClick={() => handleSendMessage("REJECT")}
                                                disabled={submittingAction}
                                                className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold border border-slate-200 transition cursor-pointer"
                                            >
                                                Reject Quote
                                            </button>
                                        </div>
                                    </div>

                                    {/* Text Chat Input */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Type a message or delivery terms..."
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSendMessage("MESSAGE")}
                                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                        <button
                                            onClick={() => handleSendMessage("MESSAGE")}
                                            disabled={submittingAction}
                                            className="p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition cursor-pointer"
                                        >
                                            <Send size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

