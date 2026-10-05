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
        <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                            <Handshake className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">B2B Live Price Negotiation & Chat Hub</h1>
                            <p className="text-sm text-slate-400">
                                Negotiate bulk rates with suppliers and convert accepted price agreements directly into Purchase Orders.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchNegotiations}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition font-medium text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Active</span>
                        <MessageSquare className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-xl font-bold text-white">{metrics.active}</div>
                    <span className="text-[10px] text-slate-400">In negotiation</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Pending Offers</span>
                        <Clock className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-xl font-bold text-cyan-400">{metrics.pending}</div>
                    <span className="text-[10px] text-slate-400">Awaiting supplier response</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Accepted Offers</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-xl font-bold text-emerald-400">{metrics.accepted}</div>
                    <span className="text-[10px] text-slate-400">Agreed price deals</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Rejected / Expired</span>
                        <XCircle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-xl font-bold text-rose-400">{metrics.rejected + metrics.expired}</div>
                    <span className="text-[10px] text-slate-400">Closed quote sessions</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Total Savings</span>
                        <DollarSign className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-xl font-bold text-purple-400">₹{metrics.totalSavings.toFixed(2)}</div>
                    <span className="text-[10px] text-slate-400">Saved vs catalog price</span>
                </div>
            </div>

            {/* STATUS FILTER TABS */}
            <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold overflow-x-auto">
                <button
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${statusFilter === "ALL" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                    All ({negotiations.length})
                </button>
                <button
                    onClick={() => setStatusFilter("ACTIVE")}
                    className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${statusFilter === "ACTIVE" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                    Active Negotiations ({metrics.active})
                </button>
                <button
                    onClick={() => setStatusFilter("PENDING")}
                    className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${statusFilter === "PENDING" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                    Pending Offers ({metrics.pending})
                </button>
                <button
                    onClick={() => setStatusFilter("ACCEPTED")}
                    className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${statusFilter === "ACCEPTED" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                    Accepted Offers ({metrics.accepted})
                </button>
                <button
                    onClick={() => setStatusFilter("REJECTED")}
                    className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${statusFilter === "REJECTED" ? "bg-rose-500 text-white font-bold" : "text-slate-400 hover:text-white"}`}
                >
                    Rejected ({metrics.rejected})
                </button>
                <button
                    onClick={() => setStatusFilter("EXPIRED")}
                    className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${statusFilter === "EXPIRED" ? "bg-slate-700 text-slate-200 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                    Expired ({metrics.expired})
                </button>
            </div>

            {/* MASTER - DETAIL NEGOTIATION HUB */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT PANEL: Negotiations List */}
                <div className="lg:col-span-4 bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden backdrop-blur-xl flex flex-col max-h-[750px]">
                    <div className="p-4 border-b border-slate-800">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search negotiation ref, supplier..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto divide-y divide-slate-800/80 flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                            </div>
                        ) : filteredNegotiations.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-500">No negotiation quotes found</div>
                        ) : (
                            filteredNegotiations.map((item) => {
                                const isSelected = selectedNegotiation?.id === item.id;
                                const supplierName = item.supplier?.name || "Wholesale Supplier";
                                const statusColor =
                                    item.status === "ACCEPTED" || item.status === "PO_GENERATED"
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : item.status === "REJECTED" || item.status === "EXPIRED"
                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                        : "bg-amber-500/10 text-amber-400 border-amber-500/30";

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedNegotiation(item)}
                                        className={`p-4 transition cursor-pointer flex flex-col justify-between space-y-2 ${isSelected ? "bg-amber-500/10 border-l-4 border-amber-500" : "hover:bg-slate-800/40"}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-[10px] font-bold text-amber-400 font-mono">{item.negotiationNo}</span>
                                                <h4 className="text-sm font-bold text-white line-clamp-1">{item.productName}</h4>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusColor}`}>
                                                {item.status.replace("_", " ")}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span className="truncate">{supplierName}</span>
                                            <span className="font-semibold text-slate-200">
                                                {item.quantity} {item.unit}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                                            <span className="text-[10px] text-slate-500">Catalog: ₹{item.catalogPrice}</span>
                                            <span className="font-bold text-emerald-400">Current Offer: ₹{item.currentOffer}/{item.unit}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Live Negotiation & Conversation Room */}
                <div className="lg:col-span-8 bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden backdrop-blur-xl flex flex-col max-h-[750px]">
                    {!selectedNegotiation ? (
                        <div className="p-16 text-center text-slate-500 space-y-2">
                            <Handshake className="w-12 h-12 mx-auto text-slate-600 mb-2" />
                            <h3 className="text-base font-semibold text-slate-300">Select a negotiation quote</h3>
                            <p className="text-xs">Choose a negotiation thread from the left panel to view timeline & submit offers.</p>
                        </div>
                    ) : (
                        <>
                            {/* Negotiation Header */}
                            <div className="p-5 border-b border-slate-800 bg-slate-950/60 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-bold text-amber-400">{selectedNegotiation.negotiationNo}</span>
                                            <span className="text-xs text-slate-500">•</span>
                                            <span className="text-xs text-slate-300 font-semibold">{selectedNegotiation.supplier?.name || "Wholesale Supplier"}</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white mt-1">{selectedNegotiation.productName}</h2>
                                    </div>

                                    {/* Action Header Button: GENERATE PO */}
                                    {(selectedNegotiation.status === "ACCEPTED" || selectedNegotiation.status === "PO_GENERATED") && (
                                        <div>
                                            {selectedNegotiation.status === "PO_GENERATED" ? (
                                                <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-4 h-4" /> PO Generated (#{selectedNegotiation.purchaseOrderId || "PO-2001"})
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={handleGeneratePO}
                                                    disabled={generatingPO}
                                                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    {generatingPO ? "Generating PO..." : "[Generate PO] From Agreed Price"}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Price Overview Strip */}
                                <div className="grid grid-cols-4 gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Requested Qty</span>
                                        <span className="text-sm font-bold text-slate-200">{selectedNegotiation.quantity} {selectedNegotiation.unit}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Catalog Rate</span>
                                        <span className="text-sm font-bold text-slate-400 line-through">₹{selectedNegotiation.catalogPrice}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Current Offer</span>
                                        <span className="text-sm font-bold text-amber-400">₹{selectedNegotiation.currentOffer} / {selectedNegotiation.unit}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Agreed</span>
                                        <span className="text-sm font-bold text-emerald-400">
                                            ₹{((selectedNegotiation.finalPrice || selectedNegotiation.currentOffer) * selectedNegotiation.quantity).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Conversation Message Timeline */}
                            <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-slate-950/40">
                                {(selectedNegotiation.messages || []).map((msg, idx) => {
                                    const isRestaurant = msg.senderRole === "RESTAURANT";

                                    return (
                                        <div key={idx} className={`flex flex-col ${isRestaurant ? "items-end" : "items-start"}`}>
                                            <div className="flex items-center gap-2 mb-1 text-[10px] text-slate-400">
                                                <span className="font-semibold text-slate-300">{msg.senderName || (isRestaurant ? "Restaurant" : "Supplier")}</span>
                                                <span>•</span>
                                                <span>{new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                                            </div>

                                            <div
                                                className={`max-w-lg p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                                                    isRestaurant
                                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-100 rounded-tr-none"
                                                        : "bg-slate-900 border-slate-800 text-slate-200 rounded-tl-none"
                                                }`}
                                            >
                                                {msg.proposedPrice && (
                                                    <div className="font-bold text-sm text-emerald-400 pb-1 border-b border-slate-800/80">
                                                        Proposed Price: ₹{msg.proposedPrice} / {selectedNegotiation.unit}
                                                    </div>
                                                )}
                                                <p className="leading-relaxed">{msg.message}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Actions & Input Footer */}
                            {selectedNegotiation.status !== "PO_GENERATED" && selectedNegotiation.status !== "REJECTED" && (
                                <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="Counter Rate (₹)"
                                                value={counterPriceInput}
                                                onChange={(e) => setCounterPriceInput(e.target.value)}
                                                className="w-36 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                            <button
                                                onClick={() => handleSendMessage("COUNTER")}
                                                disabled={submittingAction}
                                                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
                                            >
                                                Send Counter Offer
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleSendMessage("ACCEPT")}
                                                disabled={submittingAction}
                                                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1"
                                            >
                                                <Check className="w-3.5 h-3.5" /> Accept Price
                                            </button>

                                            <button
                                                onClick={() => handleSendMessage("REJECT")}
                                                disabled={submittingAction}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold border border-slate-700 transition"
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
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        />
                                        <button
                                            onClick={() => handleSendMessage("MESSAGE")}
                                            disabled={submittingAction}
                                            className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl transition border border-slate-700"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
