import { useEffect, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Download,
  History,
  Info,
  Lock,
  MinusCircle,
  PlusCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  User,
  Wallet,
  X,
} from "lucide-react";
import { API } from "../../config";
import OwnerMenuButton from "../../components/OwnerMenuButton";

const DENOMINATIONS = [500, 200, 100, 50, 20, 10];

export default function OwnerShiftManager() {
  const [activeTab, setActiveTab] = useState("current"); // "current" | "history" | "dayClose"
  const [currentShift, setCurrentShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(true);

  // Modals state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCashInModal, setShowCashInModal] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [selectedShiftForDetails, setSelectedShiftForDetails] = useState(null);

  // Form states
  const [openCashInput, setOpenCashInput] = useState("5000");
  const [openNotes, setOpenNotes] = useState("");
  const [terminalId, setTerminalId] = useState("POS-01");

  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");

  // Denomination counter state
  const [denomCounts, setDenomCounts] = useState({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    coins: 0,
  });

  const [actualCashInput, setActualCashInput] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  // History state
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  // Day closing state
  const [daySummary, setDaySummary] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayClosingNotes, setDayClosingNotes] = useState("");

  const token = localStorage.getItem("token");
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchCurrentShift = async () => {
    setLoadingShift(true);
    try {
      const res = await axios.get(`${API}/shifts/current?terminalId=${terminalId}`, authHeaders);
      if (res.data?.success) {
        setCurrentShift(res.data.shift);
      }
    } catch (err) {
      console.error("Error fetching current shift:", err);
    } finally {
      setLoadingShift(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const url = `${API}/shifts/history?terminalId=${terminalId}${statusFilter ? `&status=${statusFilter}` : ""}`;
      const res = await axios.get(url, authHeaders);
      if (res.data?.success) {
        setHistoryItems(res.data.items || []);
      }
    } catch (err) {
      console.error("Error fetching shift history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchDaySummary = async () => {
    setDayLoading(true);
    try {
      const res = await axios.get(`${API}/day-closing/current`, authHeaders);
      if (res.data?.success) {
        setDaySummary(res.data.summary);
      }
    } catch (err) {
      console.error("Error fetching day closing summary:", err);
    } finally {
      setDayLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentShift();
  }, [terminalId]);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
    if (activeTab === "dayClose") fetchDaySummary();
  }, [activeTab, statusFilter, terminalId]);

  // Denomination counter auto total calculation
  const denominationTotal =
    Object.entries(denomCounts).reduce((acc, [denom, cnt]) => {
      const multiplier = denom === "coins" ? 1 : Number(denom);
      return acc + multiplier * (Number(cnt) || 0);
    }, 0);

  // Sync actual cash input with denomination total if denomination used
  useEffect(() => {
    if (denominationTotal > 0) {
      setActualCashInput(String(denominationTotal));
    }
  }, [denomCounts]);

  const expectedCash = currentShift ? Number(currentShift.expectedCash || 0) : 0;
  const countedCash = Number(actualCashInput || 0);
  const variance = countedCash - expectedCash;

  // Actions
  const handleOpenShift = async () => {
    try {
      const res = await axios.post(
        `${API}/shifts/open`,
        {
          openingCash: Number(openCashInput),
          notes: openNotes,
          terminalId,
        },
        authHeaders
      );
      if (res.data?.success) {
        setShowOpenModal(false);
        fetchCurrentShift();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to open shift");
    }
  };

  const handleCashIn = async () => {
    if (!currentShift) return;
    try {
      const res = await axios.post(
        `${API}/shifts/${currentShift.id}/cash-in`,
        {
          amount: Number(movementAmount),
          reason: movementReason,
        },
        authHeaders
      );
      if (res.data?.success) {
        setShowCashInModal(false);
        setMovementAmount("");
        setMovementReason("");
        fetchCurrentShift();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to record Cash In");
    }
  };

  const handleCashOut = async () => {
    if (!currentShift) return;
    try {
      const res = await axios.post(
        `${API}/shifts/${currentShift.id}/cash-out`,
        {
          amount: Number(movementAmount),
          reason: movementReason,
        },
        authHeaders
      );
      if (res.data?.success) {
        setShowCashOutModal(false);
        setMovementAmount("");
        setMovementReason("");
        fetchCurrentShift();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to record Cash Out");
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    try {
      const res = await axios.post(
        `${API}/shifts/${currentShift.id}/close`,
        {
          actualCash: countedCash,
          varianceReason,
          notes: closeNotes,
        },
        authHeaders
      );
      if (res.data?.success) {
        setShowCloseModal(false);
        fetchCurrentShift();
        if (activeTab === "history") fetchHistory();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to close shift");
    }
  };

  const handleReopenShift = async (shiftId) => {
    try {
      const res = await axios.post(
        `${API}/shifts/${shiftId}/reopen`,
        { reason: reopenReason },
        authHeaders
      );
      if (res.data?.success) {
        setShowReopenModal(false);
        setReopenReason("");
        fetchCurrentShift();
        if (activeTab === "history") fetchHistory();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to reopen shift");
    }
  };

  const handleExecuteDayClose = async () => {
    try {
      const res = await axios.post(
        `${API}/day-closing/close`,
        { notes: dayClosingNotes },
        authHeaders
      );
      if (res.data?.success) {
        alert("Business Day closed successfully!");
        fetchDaySummary();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to close business day");
    }
  };

  return (
    <div className="space-y-6 text-[color:var(--app-text)] font-sans">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[color:var(--app-border)]/40 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3 text-[color:var(--app-text)]">
            <OwnerMenuButton />
            <Wallet className="w-7 h-7 text-amber-500" />
            Cashier Shift & Day Closing
          </h1>
          <p className="theme-muted text-xs sm:text-sm mt-1">
            Cash drawer management, float tracking, payment reconciliation, variance logging & EOD closing
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Terminal Selector */}
          <div className="flex items-center px-3 py-1.5 text-xs sm:text-sm">
            <span className="theme-muted mr-2 text-xs uppercase tracking-wider font-semibold">REGISTER:</span>
            <select
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)}
              className="bg-transparent text-amber-500 font-bold outline-none cursor-pointer"
            >
              <option value="POS-01" className="bg-[color:var(--app-bg)] text-[color:var(--app-text)]">POS-01 (Main Counter)</option>
              <option value="POS-02" className="bg-[color:var(--app-bg)] text-[color:var(--app-text)]">POS-02 (Bar Counter)</option>
              <option value="POS-03" className="bg-[color:var(--app-bg)] text-[color:var(--app-text)]">POS-03 (Takeaway)</option>
            </select>
          </div>

          <button
            onClick={fetchCurrentShift}
            className="theme-button rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loadingShift ? "animate-spin" : ""}`} />
            Sync
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-[color:var(--app-border)]/40 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("current")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition border-b-2 ${
            activeTab === "current"
              ? "text-amber-500 border-amber-500"
              : "theme-muted border-transparent hover:text-[color:var(--app-text)]"
          }`}
        >
          <Wallet className="w-4 h-4" />
          Active Shift
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition border-b-2 ${
            activeTab === "history"
              ? "text-amber-500 border-amber-500"
              : "theme-muted border-transparent hover:text-[color:var(--app-text)]"
          }`}
        >
          <History className="w-4 h-4" />
          Shift History
        </button>
        <button
          onClick={() => setActiveTab("dayClose")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition border-b-2 ${
            activeTab === "dayClose"
              ? "text-amber-500 border-amber-500"
              : "theme-muted border-transparent hover:text-[color:var(--app-text)]"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Day Closing (EOD)
        </button>
      </div>

      {/* TAB 1: CURRENT ACTIVE SHIFT */}
      {activeTab === "current" && (
        <div className="space-y-6">
          {loadingShift ? (
            <div className="py-12 text-center theme-muted">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
              Loading current cashier shift status...
            </div>
          ) : !currentShift ? (
            /* NO SHIFT OPEN CARD */
            <div className="py-12 text-center max-w-2xl mx-auto space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Lock className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[color:var(--app-text)]">No Active Shift for {terminalId}</h2>
              <p className="theme-muted text-xs sm:text-sm max-w-md mx-auto">
                Open a cashier shift to record opening float cash and begin taking payments on this register.
              </p>
              <button
                onClick={() => setShowOpenModal(true)}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-6 py-3 rounded-xl shadow-md transition"
              >
                <PlusCircle className="w-5 h-5" />
                Open Cashier Shift
              </button>
            </div>
          ) : (
            /* ACTIVE SHIFT DASHBOARD */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT & MIDDLE: SHIFT OVERVIEW & CASH DRAWER CALCULATIONS */}
              <div className="lg:col-span-2 space-y-6">
                {/* ACTIVE SHIFT SUMMARY BANNER */}
                <div className="py-2 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--app-border)]/40 pb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                          Shift OPEN
                        </span>
                        <h2 className="text-xl font-bold text-[color:var(--app-text)]">Shift #{currentShift.id}</h2>
                      </div>
                      <p className="theme-muted text-xs mt-1 flex flex-wrap items-center gap-3">
                        <span>Cashier: <strong className="text-[color:var(--app-text)]">{currentShift.user?.name}</strong></span>
                        <span>•</span>
                        <span>Terminal: <strong className="text-[color:var(--app-text)]">{currentShift.terminalId}</strong></span>
                        <span>•</span>
                        <span>Opened: <strong className="text-[color:var(--app-text)]">{new Date(currentShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCashInModal(true)}
                        className="flex items-center gap-1.5 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold transition hover:underline"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        Cash In
                      </button>
                      <button
                        onClick={() => setShowCashOutModal(true)}
                        className="flex items-center gap-1.5 text-rose-400 px-3.5 py-2 rounded-xl text-xs font-bold transition hover:underline"
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        Cash Out
                      </button>
                      <button
                        onClick={() => setShowCloseModal(true)}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm transition"
                      >
                        <Lock className="w-4 h-4" />
                        Close Shift
                      </button>
                    </div>
                  </div>

                  {/* CASH DRAWER BREAKDOWN GRID */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                    <div className="py-2">
                      <p className="theme-muted text-xs font-medium">Opening Float</p>
                      <p className="text-lg font-bold text-[color:var(--app-text)] mt-0.5">₹{currentShift.openingCash?.toLocaleString()}</p>
                    </div>
                    <div className="py-2">
                      <p className="theme-muted text-xs font-medium">Cash Sales (+)</p>
                      <p className="text-lg font-bold text-emerald-400 mt-0.5">
                        ₹{(
                          currentShift.cashMovements
                            ?.filter((m) => m.type === "CASH_SALE")
                            .reduce((sum, m) => sum + m.amount, 0) || 0
                        ).toLocaleString()}
                      </p>
                    </div>
                    <div className="py-2">
                      <p className="theme-muted text-xs font-medium">Cash Adjustments</p>
                      <p className="text-lg font-bold text-amber-400 mt-0.5">
                        +₹{(
                          currentShift.cashMovements
                            ?.filter((m) => m.type === "CASH_IN")
                            .reduce((sum, m) => sum + m.amount, 0) || 0
                        ) - (
                          currentShift.cashMovements
                            ?.filter((m) => m.type === "CASH_OUT")
                            .reduce((sum, m) => sum + m.amount, 0) || 0
                        )}
                      </p>
                    </div>
                    <div className="py-2">
                      <p className="text-amber-500 text-xs font-bold uppercase tracking-wider">Expected Cash</p>
                      <p className="text-xl font-extrabold text-amber-400 mt-0.5">₹{currentShift.expectedCash?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* CASH MOVEMENTS LEDGER */}
                <div className="pt-4 border-t border-[color:var(--app-border)]/40">
                  <h3 className="text-base font-bold text-[color:var(--app-text)] mb-4 flex items-center justify-between">
                    <span>Shift Cash Movements Ledger</span>
                    <span className="text-xs font-normal theme-muted">{currentShift.cashMovements?.length || 0} entries</span>
                  </h3>

                  {!currentShift.cashMovements || currentShift.cashMovements.length === 0 ? (
                    <p className="theme-muted text-xs py-4 text-center">No cash movements recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[color:var(--app-border)]/40 theme-muted uppercase tracking-wider">
                            <th className="pb-2">Time</th>
                            <th className="pb-2">Type</th>
                            <th className="pb-2">Reason / Ref</th>
                            <th className="pb-2">Staff</th>
                            <th className="pb-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--app-border)]/30">
                          {currentShift.cashMovements.map((m) => (
                            <tr key={m.id} className="hover:bg-[color:var(--app-surface)]/30">
                              <td className="py-2.5 theme-muted">
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-2.5 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  m.type === "OPENING_CASH" ? "bg-blue-500/20 text-blue-400" :
                                  m.type === "CASH_SALE" ? "bg-emerald-500/20 text-emerald-400" :
                                  m.type === "CASH_IN" ? "bg-teal-500/20 text-teal-400" :
                                  m.type === "CASH_OUT" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                                }`}>
                                  {m.type}
                                </span>
                              </td>
                              <td className="py-2.5 text-[color:var(--app-text)] max-w-xs truncate">{m.reason || "N/A"}</td>
                              <td className="py-2.5 theme-muted">{m.performedByName || "Staff"}</td>
                              <td className={`py-2.5 text-right font-bold ${
                                ["OPENING_CASH", "CASH_SALE", "CASH_IN"].includes(m.type) ? "text-emerald-400" : "text-rose-400"
                              }`}>
                                {["OPENING_CASH", "CASH_SALE", "CASH_IN"].includes(m.type) ? "+" : "-"}₹{m.amount?.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT SIDE: RECONCILIATION SUMMARY (ALL PAYMENT METHODS) */}
              <div className="space-y-6">
                <div className="pt-2">
                  <h3 className="text-base font-bold text-[color:var(--app-text)] mb-4">Payment Methods Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-[color:var(--app-border)]/30">
                      <span className="text-xs theme-muted flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-emerald-400" />
                        Cash Sales
                      </span>
                      <span className="text-sm font-bold text-[color:var(--app-text)]">
                        ₹{(
                          currentShift.cashMovements
                            ?.filter((m) => m.type === "CASH_SALE")
                            .reduce((sum, m) => sum + m.amount, 0) || 0
                        ).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-[color:var(--app-border)]/30">
                      <span className="text-xs theme-muted flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-purple-400" />
                        UPI / QR Sales
                      </span>
                      <span className="text-sm font-bold text-[color:var(--app-text)]">
                        ₹{(
                          currentShift.payments
                            ?.filter((p) => String(p.paymentMethod || p.method).toUpperCase().includes("UPI"))
                            .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0
                        ).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-[color:var(--app-border)]/30">
                      <span className="text-xs theme-muted flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-400" />
                        Card Sales
                      </span>
                      <span className="text-sm font-bold text-[color:var(--app-text)]">
                        ₹{(
                          currentShift.payments
                            ?.filter((p) => String(p.paymentMethod || p.method).toUpperCase().includes("CARD"))
                            .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0
                        ).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-[color:var(--app-border)]/30">
                      <span className="text-xs theme-muted flex items-center gap-2">
                        <Info className="w-4 h-4 text-amber-400" />
                        Cashfree / Online
                      </span>
                      <span className="text-sm font-bold text-[color:var(--app-text)]">
                        ₹{(
                          currentShift.payments
                            ?.filter((p) => {
                              const m = String(p.paymentMethod || p.method).toUpperCase();
                              return m.includes("CASHFREE") || m.includes("ONLINE");
                            })
                            .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SHIFT HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-bold text-[color:var(--app-text)]">Closed Shift Logs & Reconciliation</h3>
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-b border-[color:var(--app-border)] text-[color:var(--app-text)] text-xs py-1 outline-none"
              >
                <option value="" className="bg-[color:var(--app-bg)]">All Statuses</option>
                <option value="CLOSED" className="bg-[color:var(--app-bg)]">CLOSED</option>
                <option value="OPEN" className="bg-[color:var(--app-bg)]">OPEN</option>
              </select>
            </div>
          </div>

          {historyLoading ? (
            <div className="text-center py-8 theme-muted">Loading history...</div>
          ) : historyItems.length === 0 ? (
            <p className="theme-muted text-center py-8 text-sm">No historical shifts found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[color:var(--app-border)]/40 theme-muted uppercase tracking-wider">
                    <th className="pb-3">Shift ID</th>
                    <th className="pb-3">Cashier</th>
                    <th className="pb-3">Opened</th>
                    <th className="pb-3">Closed</th>
                    <th className="pb-3 text-right">Opening</th>
                    <th className="pb-3 text-right">Expected</th>
                    <th className="pb-3 text-right">Actual</th>
                    <th className="pb-3 text-right">Variance</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--app-border)]/30">
                  {historyItems.map((s) => (
                    <tr key={s.id} className="hover:bg-[color:var(--app-surface)]/30">
                      <td className="py-3 font-bold text-amber-500">#{s.id}</td>
                      <td className="py-3 font-semibold text-[color:var(--app-text)]">{s.user?.name || "Cashier"}</td>
                      <td className="py-3 theme-muted">{new Date(s.openedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="py-3 theme-muted">{s.closedAt ? new Date(s.closedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Active"}</td>
                      <td className="py-3 text-right theme-muted">₹{s.openingCash?.toLocaleString()}</td>
                      <td className="py-3 text-right theme-muted">₹{s.expectedCash?.toLocaleString()}</td>
                      <td className="py-3 text-right text-[color:var(--app-text)] font-bold">{s.actualCash !== null ? `₹${s.actualCash?.toLocaleString()}` : "-"}</td>
                      <td className={`py-3 text-right font-extrabold ${
                        (s.variance || 0) === 0 ? "theme-muted" :
                        (s.variance || 0) > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {s.variance !== null ? `${s.variance > 0 ? "+" : ""}₹${s.variance}` : "-"}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === "OPEN" ? "bg-emerald-500/20 text-emerald-400" : "theme-muted"
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {s.status === "CLOSED" && (
                          <button
                            onClick={() => {
                              setSelectedShiftForDetails(s);
                              setShowReopenModal(true);
                            }}
                            className="text-amber-500 hover:text-amber-600 font-semibold text-[11px] underline"
                          >
                            Reopen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DAY CLOSING (EOD) */}
      {activeTab === "dayClose" && (
        <div className="space-y-6">
          {dayLoading ? (
            <div className="text-center py-12 theme-muted">Loading EOD Day Closing summary...</div>
          ) : !daySummary ? (
            <p className="theme-muted text-center py-8">No day closing summary available.</p>
          ) : (
            <div className="space-y-6">
              {/* UNRESOLVED SHIFTS WARNING */}
              {!daySummary.canCloseDay && (
                <div className="border-l-4 border-rose-500 pl-4 py-2 flex items-center gap-3 text-rose-300 text-sm">
                  <ShieldAlert className="w-6 h-6 flex-shrink-0 text-rose-400" />
                  <div>
                    <strong className="block text-[color:var(--app-text)]">Unresolved Open Cashier Shifts Exist</strong>
                    You have {daySummary.unresolvedOpenShifts?.length} active cashier shift(s) open. All shifts must be closed before executing Day Closing.
                  </div>
                </div>
              )}

              {/* DAY CLOSING METRICS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[color:var(--app-border)]/40 pb-6">
                <div className="py-2">
                  <p className="text-xs theme-muted">Gross Sales</p>
                  <p className="text-2xl font-extrabold text-[color:var(--app-text)] mt-1">₹{daySummary.grossSales?.toLocaleString()}</p>
                </div>
                <div className="py-2">
                  <p className="text-xs theme-muted">Total Net Sales</p>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1">₹{daySummary.netSales?.toLocaleString()}</p>
                </div>
                <div className="py-2">
                  <p className="text-xs theme-muted">Closed Shifts</p>
                  <p className="text-2xl font-extrabold text-amber-500 mt-1">{daySummary.totalShifts}</p>
                </div>
                <div className="py-2">
                  <p className="text-xs theme-muted">Overall Cash Variance</p>
                  <p className={`text-2xl font-extrabold mt-1 ${
                    daySummary.totalCashVariance === 0 ? "theme-muted" :
                    daySummary.totalCashVariance > 0 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {daySummary.totalCashVariance > 0 ? "+" : ""}₹{daySummary.totalCashVariance}
                  </p>
                </div>
              </div>

              {/* PAYMENT METHODS & ACTIONS */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-[color:var(--app-text)] mb-4">Payment Method Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="py-2 border-b border-[color:var(--app-border)]/30">
                    <span className="text-xs theme-muted">Cash Total</span>
                    <p className="text-lg font-bold text-[color:var(--app-text)] mt-0.5">₹{daySummary.paymentBreakdown?.cash?.toLocaleString()}</p>
                  </div>
                  <div className="py-2 border-b border-[color:var(--app-border)]/30">
                    <span className="text-xs theme-muted">UPI Total</span>
                    <p className="text-lg font-bold text-[color:var(--app-text)] mt-0.5">₹{daySummary.paymentBreakdown?.upi?.toLocaleString()}</p>
                  </div>
                  <div className="py-2 border-b border-[color:var(--app-border)]/30">
                    <span className="text-xs theme-muted">Card Total</span>
                    <p className="text-lg font-bold text-[color:var(--app-text)] mt-0.5">₹{daySummary.paymentBreakdown?.card?.toLocaleString()}</p>
                  </div>
                  <div className="py-2 border-b border-[color:var(--app-border)]/30">
                    <span className="text-xs theme-muted">Cashfree / Online</span>
                    <p className="text-lg font-bold text-[color:var(--app-text)] mt-0.5">₹{daySummary.paymentBreakdown?.cashfree?.toLocaleString()}</p>
                  </div>
                </div>

                <div className="border-t border-[color:var(--app-border)]/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <input
                    type="text"
                    placeholder="Day closing notes / remarks..."
                    value={dayClosingNotes}
                    onChange={(e) => setDayClosingNotes(e.target.value)}
                    className="w-full sm:w-96 bg-transparent border-b border-[color:var(--app-border)] px-2 py-2 text-sm text-[color:var(--app-text)] outline-none focus:border-amber-500"
                  />
                  <button
                    disabled={!daySummary.canCloseDay}
                    onClick={handleExecuteDayClose}
                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold px-6 py-2.5 rounded-xl shadow-md transition"
                  >
                    Execute Business Day Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OPEN SHIFT MODAL */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="theme-panel border border-[color:var(--app-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[color:var(--app-border)]/50 pb-3">
              <h3 className="text-lg font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-500" />
                Open Cashier Shift
              </h3>
              <button onClick={() => setShowOpenModal(false)} className="theme-muted hover:text-[color:var(--app-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold theme-muted mb-1">Opening Cash Float (₹)</label>
              <input
                type="number"
                min="0"
                value={openCashInput}
                onChange={(e) => setOpenCashInput(e.target.value)}
                className="w-full bg-[color:var(--app-bg)] border border-[color:var(--app-border)] rounded-xl p-3 text-lg font-bold text-[color:var(--app-text)] outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold theme-muted mb-1">Shift Notes / Register Context</label>
              <input
                type="text"
                placeholder="e.g. Morning counter shift"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                className="w-full bg-[color:var(--app-bg)] border border-[color:var(--app-border)] rounded-xl p-3 text-sm text-[color:var(--app-text)] outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button onClick={() => setShowOpenModal(false)} className="px-4 py-2 text-sm theme-muted hover:text-[color:var(--app-text)]">Cancel</button>
              <button onClick={handleOpenShift} className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-5 py-2 rounded-xl text-sm transition">
                Confirm & Open Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASH IN / OUT MODALS */}
      {(showCashInModal || showCashOutModal) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="theme-panel border border-[color:var(--app-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[color:var(--app-border)]/50 pb-3">
              <h3 className="text-lg font-bold text-[color:var(--app-text)] flex items-center gap-2">
                {showCashInModal ? <ArrowUpRight className="w-5 h-5 text-emerald-400" /> : <ArrowDownRight className="w-5 h-5 text-rose-400" />}
                {showCashInModal ? "Record Cash In Adjustment" : "Record Cash Out Expense"}
              </h3>
              <button onClick={() => { setShowCashInModal(false); setShowCashOutModal(false); }} className="theme-muted hover:text-[color:var(--app-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold theme-muted mb-1">Amount (₹)</label>
              <input
                type="number"
                min="1"
                placeholder="Enter amount"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                className="w-full bg-[color:var(--app-bg)] border border-[color:var(--app-border)] rounded-xl p-3 text-lg font-bold text-[color:var(--app-text)] outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold theme-muted mb-1">Reason / Details</label>
              <input
                type="text"
                placeholder={showCashInModal ? "Reason for adding float..." : "Supplier payment / petty cash reason..."}
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                className="w-full bg-[color:var(--app-bg)] border border-[color:var(--app-border)] rounded-xl p-3 text-sm text-[color:var(--app-text)] outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button onClick={() => { setShowCashInModal(false); setShowCashOutModal(false); }} className="px-4 py-2 text-sm theme-muted hover:text-[color:var(--app-text)]">Cancel</button>
              <button
                onClick={showCashInModal ? handleCashIn : handleCashOut}
                className={`font-bold px-5 py-2 rounded-xl text-sm transition ${
                  showCashInModal ? "bg-emerald-500 hover:bg-emerald-600 text-black" : "bg-rose-500 hover:bg-rose-600 text-white"
                }`}
              >
                Record {showCashInModal ? "Cash In" : "Cash Out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT CLOSING & RECONCILIATION MODAL */}
      {showCloseModal && currentShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="theme-panel border border-amber-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
            <div className="flex justify-between items-center border-b border-[color:var(--app-border)]/50 pb-3">
              <div>
                <h3 className="text-xl font-bold text-[color:var(--app-text)] flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-500" />
                  Shift Closing & Cash Reconciliation
                </h3>
                <p className="text-xs theme-muted">Shift #{currentShift.id} • Terminal {currentShift.terminalId}</p>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="theme-muted hover:text-[color:var(--app-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DENOMINATION CALCULATOR */}
            <div className="bg-[color:var(--app-bg)]/40 border border-[color:var(--app-border)]/60 rounded-xl p-4">
              <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Coins className="w-4 h-4" />
                Denomination Count Calculator (Optional)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {DENOMINATIONS.map((d) => (
                  <div key={d} className="flex items-center justify-between theme-panel p-2 rounded-lg border border-[color:var(--app-border)]/60">
                    <span className="font-bold theme-muted">₹{d} ×</span>
                    <input
                      type="number"
                      min="0"
                      value={denomCounts[d] || ""}
                      onChange={(e) => setDenomCounts({ ...denomCounts, [d]: e.target.value })}
                      className="w-16 bg-[color:var(--app-bg)] border border-[color:var(--app-border)] text-center font-bold text-[color:var(--app-text)] rounded p-1"
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between theme-panel p-2 rounded-lg border border-[color:var(--app-border)]/60">
                  <span className="font-bold theme-muted">Coins ×</span>
                  <input
                    type="number"
                    min="0"
                    value={denomCounts.coins || ""}
                    onChange={(e) => setDenomCounts({ ...denomCounts, coins: e.target.value })}
                    className="w-16 bg-[color:var(--app-bg)] border border-[color:var(--app-border)] text-center font-bold text-[color:var(--app-text)] rounded p-1"
                  />
                </div>
              </div>
            </div>

            {/* EXPECTED VS ACTUAL COUNT */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[color:var(--app-bg)]/40 p-4 rounded-xl border border-[color:var(--app-border)]/60">
                <span className="text-xs theme-muted">Expected Cash</span>
                <p className="text-xl font-extrabold text-amber-500 mt-1">₹{expectedCash.toLocaleString()}</p>
              </div>

              <div className="bg-[color:var(--app-bg)]/40 p-4 rounded-xl border border-[color:var(--app-border)]/60">
                <label className="block text-xs font-semibold theme-muted mb-1">Actual Counted Cash (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter count"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full bg-[color:var(--app-bg)] border border-[color:var(--app-border)] rounded-lg p-2 font-extrabold text-lg text-[color:var(--app-text)] outline-none focus:border-amber-500"
                />
              </div>

              <div className={`p-4 rounded-xl border ${
                variance === 0 ? "bg-[color:var(--app-bg)]/40 border-[color:var(--app-border)]/60 theme-muted" :
                variance > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}>
                <span className="text-xs font-semibold">Calculated Variance</span>
                <p className="text-xl font-extrabold mt-1">
                  {variance > 0 ? "+" : ""}₹{variance.toLocaleString()}
                </p>
                <span className="text-[10px]">
                  {variance === 0 ? "Balanced" : variance > 0 ? "Overage" : "Shortage"}
                </span>
              </div>
            </div>

            {/* VARIANCE REASON IF NON-ZERO */}
            {variance !== 0 && (
              <div>
                <label className="block text-xs font-semibold text-rose-400 mb-1">Variance Explanation (Required for non-zero variance)</label>
                <input
                  type="text"
                  placeholder="Explain reason for shortage or overage..."
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  className="w-full bg-[color:var(--app-bg)] border border-rose-500/40 rounded-xl p-3 text-sm text-[color:var(--app-text)] outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold theme-muted mb-1">Shift Closing Notes</label>
              <textarea
                rows="2"
                placeholder="Closing notes / hand-over comments..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                className="w-full bg-[color:var(--app-bg)] border border-[color:var(--app-border)] rounded-xl p-3 text-sm text-[color:var(--app-text)] outline-none focus:border-amber-500"
              ></textarea>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-[color:var(--app-border)]/50">
              <button onClick={() => setShowCloseModal(false)} className="px-4 py-2 text-sm theme-muted hover:text-[color:var(--app-text)]">Cancel</button>
              <button
                onClick={handleCloseShift}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-lg"
              >
                Confirm & Close Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REOPEN SHIFT MODAL */}
      {showReopenModal && selectedShiftForDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="theme-panel border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[color:var(--app-border)]/50 pb-3">
              <h3 className="text-lg font-bold text-[color:var(--app-text)] flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                Reopen Closed Shift #{selectedShiftForDetails.id}
              </h3>
              <button onClick={() => setShowReopenModal(false)} className="theme-muted hover:text-[color:var(--app-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs theme-muted">
              Manager override: Reopening a closed shift allows corrections to cash movements. This action will be logged in the immutable audit trail.
            </p>

            <div>
              <label className="block text-xs font-semibold theme-muted mb-1">Reason for Reopening</label>
              <input
                type="text"
                placeholder="Reason..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="w-full bg-[color:var(--app-bg)] border border-[color:var(--app-border)] rounded-xl p-3 text-sm text-[color:var(--app-text)] outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button onClick={() => setShowReopenModal(false)} className="px-4 py-2 text-sm theme-muted hover:text-[color:var(--app-text)]">Cancel</button>
              <button
                onClick={() => handleReopenShift(selectedShiftForDetails.id)}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-5 py-2 rounded-xl text-sm transition"
              >
                Confirm Reopen Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
