import { useEffect, useState } from "react";
import {
    BarChart3,
    Building2,
    LayoutDashboard,
    Menu,
    Power,
    Search,
    Settings,
    Store,
    Users,
    X,
    Image as ImageIcon,
    Utensils,
    Wallet,
    TrendingUp,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    ShieldAlert,
    PlusCircle,
    MinusCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import tiffzyLogo from "../../assets/tiffzy-logo.png";

import SuperAdminSidebar from "../../components/super-admin/SuperAdminSidebar";

export default function SuperAdminWalletManagement() {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const [metrics, setMetrics] = useState(null);
    const [ledgers, setLedgers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Adjustment Modal
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [adjCustomerId, setAdjCustomerId] = useState("");
    const [adjAmount, setAdjAmount] = useState("");
    const [adjType, setAdjType] = useState("CREDIT");
    const [adjReason, setAdjReason] = useState("");
    const [adjSubmitting, setAdjSubmitting] = useState(false);

    const loadWalletData = async () => {
        try {
            setLoading(true);
            setError("");
            const res = await api.get("/super-admin/wallets");
            const data = res?.data || res;
            setMetrics(data?.metrics || { totalWallets: 0, totalBalance: 0, totalTopupsCount: 0, totalTopupAmount: 0, currency: "INR" });
            setLedgers(data?.recentLedgers || []);
        } catch (err) {
            console.error("[SuperAdminWallet] Load warning:", err);
            setMetrics({ totalWallets: 0, totalBalance: 0, totalTopupsCount: 0, totalTopupAmount: 0, currency: "INR" });
            setLedgers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWalletData();
    }, []);

    const handleManualAdjust = async (e) => {
        e.preventDefault();
        if (!adjCustomerId || !adjAmount || !adjReason) {
            setError("All adjustment fields are required");
            return;
        }

        try {
            setAdjSubmitting(true);
            setError("");
            setSuccess("");

            const res = await api.post("/super-admin/wallets/adjust", {
                customerAccountId: Number(adjCustomerId),
                amount: Number(adjAmount),
                type: adjType,
                reason: adjReason,
            });

            const data = res?.data || res;
            setSuccess(data?.message || "Wallet adjusted successfully");
            setShowAdjustModal(false);
            setAdjCustomerId("");
            setAdjAmount("");
            setAdjReason("");
            await loadWalletData();
        } catch (err) {
            console.error("[SuperAdminWallet] Adjust error:", err);
            setError(err.response?.data?.message || "Failed to adjust wallet balance");
        } finally {
            setAdjSubmitting(false);
        }
    };

    return (
        <div className="theme-page min-h-screen">
            <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} currentKey="wallets" />

            {/* Header */}
            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(true)} className="theme-soft-button p-2.5 rounded-xl"><Menu size={20} /></button>
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-widest font-bold">Super Admin</p>
                            <h1 className="text-2xl font-bold text-white">Customer Wallet Management & Financial Ledger</h1>
                        </div>
                    </div>
                    <button onClick={logout} className="rounded-full bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20">
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-8">
                {error && <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-300 text-sm">{error}</div>}
                {success && <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-300 text-sm">{success}</div>}

                {/* Top Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-black text-white">Financial Liabilities Overview</h2>
                        <p className="text-xs text-gray-400">Audited prepaid ledger transactions across all Tiffzy customers.</p>
                    </div>
                    <button
                        onClick={() => setShowAdjustModal(true)}
                        className="theme-button flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-lg shrink-0"
                    >
                        <ShieldAlert size={18} /> Manual Wallet Adjustment
                    </button>
                </div>

                {/* Metrics Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="theme-panel rounded-3xl p-6 border theme-border">
                        <div className="flex items-center gap-3 text-amber-400">
                            <Wallet size={24} />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Customer Liabilities</span>
                        </div>
                        <p className="text-3xl font-black text-white mt-3">₹{metrics ? metrics.totalBalance.toFixed(2) : "0.00"}</p>
                        <p className="text-xs text-gray-500 mt-1">Outstanding wallet balance held by users</p>
                    </div>

                    <div className="theme-panel rounded-3xl p-6 border theme-border">
                        <div className="flex items-center gap-3 text-emerald-400">
                            <TrendingUp size={24} />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Lifetime Top-ups</span>
                        </div>
                        <p className="text-3xl font-black text-white mt-3">₹{metrics ? metrics.totalTopupAmount.toFixed(2) : "0.00"}</p>
                        <p className="text-xs text-gray-500 mt-1">{metrics?.totalTopupsCount || 0} completed Cashfree top-up sessions</p>
                    </div>

                    <div className="theme-panel rounded-3xl p-6 border theme-border">
                        <div className="flex items-center gap-3 text-blue-400">
                            <Users size={24} />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Active Customer Wallets</span>
                        </div>
                        <p className="text-3xl font-black text-white mt-3">{metrics?.totalWallets || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">Registered customer prepaid accounts</p>
                    </div>

                    <div className="theme-panel rounded-3xl p-6 border theme-border">
                        <div className="flex items-center gap-3 text-purple-400">
                            <CreditCard size={24} />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">System Currency</span>
                        </div>
                        <p className="text-3xl font-black text-white mt-3">INR (₹)</p>
                        <p className="text-xs text-gray-500 mt-1">Fixed precision ledger rounding</p>
                    </div>
                </div>

                {/* Audit Ledger Table */}
                <div className="theme-panel rounded-3xl border theme-border p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-4">Recent Wallet Audit Transactions</h3>

                    {loading ? (
                        <div className="py-12 text-center text-gray-400 text-sm">Loading financial audit ledger...</div>
                    ) : ledgers.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm">No ledger transactions found yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b theme-border text-xs uppercase text-gray-400 font-bold">
                                    <tr>
                                        <th className="py-3 px-4">Date / Time</th>
                                        <th className="py-3 px-4">Customer</th>
                                        <th className="py-3 px-4">Type</th>
                                        <th className="py-3 px-4">Direction</th>
                                        <th className="py-3 px-4">Amount</th>
                                        <th className="py-3 px-4">Balance After</th>
                                        <th className="py-3 px-4">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y theme-border">
                                    {ledgers.map((l) => {
                                        const isCredit = l.direction === "CREDIT";
                                        return (
                                            <tr key={l.id} className="hover:bg-white/[0.02] transition">
                                                <td className="py-3.5 px-4 font-mono text-xs text-gray-400">
                                                    {new Date(l.createdAt).toLocaleString("en-IN", {
                                                        dateStyle: "medium",
                                                        timeStyle: "short",
                                                    })}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <p className="font-bold text-white">{l.customerName}</p>
                                                    <p className="text-xs text-gray-400">{l.customerPhone}</p>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-white/10 bg-white/5 text-gray-300">
                                                        {l.type}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isCredit ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                                        {l.direction}
                                                    </span>
                                                </td>
                                                <td className={`py-3.5 px-4 font-black ${isCredit ? "text-emerald-400" : "text-red-400"}`}>
                                                    {isCredit ? "+" : "-"}₹{l.amount.toFixed(2)}
                                                </td>
                                                <td className="py-3.5 px-4 font-mono text-white">
                                                    ₹{l.balanceAfter.toFixed(2)}
                                                </td>
                                                <td className="py-3.5 px-4 text-xs text-gray-300 max-w-xs truncate">
                                                    {l.description}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Adjustment Modal */}
            {showAdjustModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="theme-panel rounded-3xl border theme-border p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <ShieldAlert className="text-amber-400" size={20} /> Manual Wallet Adjustment
                            </h3>
                            <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                        </div>

                        <form onSubmit={handleManualAdjust} className="space-y-4 text-sm">
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">Customer Account ID</label>
                                <input
                                    type="number"
                                    required
                                    value={adjCustomerId}
                                    onChange={(e) => setAdjCustomerId(e.target.value)}
                                    placeholder="Enter Customer Account ID (e.g. 1)"
                                    className="theme-input rounded-xl px-4 py-2.5 w-full outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">Adjustment Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAdjType("CREDIT")}
                                        className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition ${adjType === "CREDIT" ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "border-white/10 text-gray-400"}`}
                                    >
                                        <PlusCircle size={14} /> CREDIT (+)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjType("DEBIT")}
                                        className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition ${adjType === "DEBIT" ? "bg-red-500/20 border-red-500 text-red-300" : "border-white/10 text-gray-400"}`}
                                    >
                                        <MinusCircle size={14} /> DEBIT (-)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">Amount (₹)</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    required
                                    value={adjAmount}
                                    onChange={(e) => setAdjAmount(e.target.value)}
                                    placeholder="Enter amount (e.g. 500)"
                                    className="theme-input rounded-xl px-4 py-2.5 w-full outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">Reason for Audit Log</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={adjReason}
                                    onChange={(e) => setAdjReason(e.target.value)}
                                    placeholder="Reason for manual adjustment..."
                                    className="theme-input rounded-xl px-4 py-2.5 w-full outline-none text-xs"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={adjSubmitting}
                                className="theme-button w-full py-3 rounded-xl font-bold shadow-lg"
                            >
                                {adjSubmitting ? "Processing..." : "Confirm Wallet Adjustment"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
