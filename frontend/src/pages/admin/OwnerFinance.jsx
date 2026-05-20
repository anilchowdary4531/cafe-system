import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    Bot,
    CalendarRange,
    CircleDollarSign,
    CreditCard,
    LoaderCircle,
    ReceiptText,
    RefreshCcw,
    Trash2,
    Wallet,
} from "lucide-react";
import { API } from "../../config";

const RANGE_OPTIONS = ["24h", "7d", "30d"];

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const signalClass = (type) => {
    if (type === "WARNING") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    if (type === "GOOD") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
};

export default function OwnerFinance() {
    const [range, setRange] = useState("7d");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [expenseForm, setExpenseForm] = useState({
        title: "",
        category: "General",
        amount: "",
        notes: "",
        spentAt: "",
    });
    const [savingExpense, setSavingExpense] = useState(false);
    const [upiIdInput, setUpiIdInput] = useState("");
    const [savingUpi, setSavingUpi] = useState(false);
    const [upiNotice, setUpiNotice] = useState("");

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = Number(user?.restaurantId);

    const loadFinance = async ({ silent = false } = {}) => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant not linked to current user.");
            return;
        }

        try {
            if (silent) setRefreshing(true);
            else setLoading(true);

            const res = await axios.get(`${API}/owner/${restaurantId}/finance`, {
                params: { range },
            });
            setData(res.data || null);
            setError("");
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Unable to load finance data.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadFinance();
    }, [restaurantId, range]);

    useEffect(() => {
        setUpiIdInput(String(data?.restaurant?.upiId || ""));
    }, [data?.restaurant?.upiId]);

    const addExpense = async (e) => {
        e.preventDefault();
        if (!expenseForm.title || !expenseForm.amount) {
            setError("Expense title and amount are required.");
            return;
        }

        try {
            setSavingExpense(true);
            setError("");

            await axios.post(`${API}/owner/${restaurantId}/finance/expenses`, {
                title: expenseForm.title,
                category: expenseForm.category,
                amount: Number(expenseForm.amount),
                notes: expenseForm.notes,
                spentAt: expenseForm.spentAt || undefined,
            });

            setExpenseForm({
                title: "",
                category: "General",
                amount: "",
                notes: "",
                spentAt: "",
            });
            await loadFinance({ silent: true });
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to add expense.");
        } finally {
            setSavingExpense(false);
        }
    };

    const deleteExpense = async (expenseId) => {
        try {
            await axios.delete(`${API}/owner/${restaurantId}/finance/expenses/${expenseId}`);
            await loadFinance({ silent: true });
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to delete expense.");
        }
    };

    const saveUpiId = async () => {
        const normalizedUpiId = String(upiIdInput || "").trim().toLowerCase();
        if (normalizedUpiId && !/^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$/i.test(normalizedUpiId)) {
            setError("Enter a valid UPI ID (example: owner@okhdfcbank).");
            return;
        }

        try {
            setSavingUpi(true);
            setError("");
            setUpiNotice("");
            await axios.put(`${API}/owner/${restaurantId}/settings`, {
                upiId: normalizedUpiId || null,
            });
            setUpiNotice(normalizedUpiId ? "UPI ID saved successfully." : "UPI ID removed.");
            await loadFinance({ silent: true });
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to save UPI ID.");
        } finally {
            setSavingUpi(false);
        }
    };

    const filteredInvoices = (data?.invoices || []).filter((invoice) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            String(invoice.orderNo || "").toLowerCase().includes(q) ||
            String(invoice.invoiceNo || "").toLowerCase().includes(q) ||
            String(invoice.customerName || "").toLowerCase().includes(q) ||
            String(invoice.tableNo || "").toLowerCase().includes(q)
        );
    });

    const topPaymentMode = data?.paymentSplit?.[0];

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-6 text-gray-300">
                Loading finance workspace...
            </div>
        );
    }

    return (
        <section className="space-y-5">
            <article className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-[#0f172a] via-[#152238] to-[#0d1f18] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">
                            Finance Command
                        </p>
                        <h3 className="mt-1 text-3xl font-bold">
                            {data?.restaurant?.name || "Restaurant"} Finance Hub
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">
                            Revenue intelligence, settlement tracking, expense control, and margin pulse.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {RANGE_OPTIONS.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setRange(option)}
                                className={`rounded-lg border px-3 py-1.5 text-sm ${
                                    range === option
                                        ? "border-emerald-300 bg-emerald-300/20 text-emerald-200"
                                        : "border-white/15 bg-white/5 text-slate-300"
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => loadFinance({ silent: true })}
                            className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-sm text-cyan-200"
                            disabled={refreshing}
                        >
                            {refreshing ? (
                                <LoaderCircle size={14} className="animate-spin" />
                            ) : (
                                <RefreshCcw size={14} />
                            )}
                            Refresh
                        </button>
                    </div>
                </div>
            </article>

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h4 className="text-lg font-semibold">UPI Payment Setup</h4>
                        <p className="mt-1 text-sm text-gray-400">
                            Add your restaurant UPI ID so customers can pay in Google Pay, PhonePe and other UPI apps.
                        </p>
                    </div>
                    <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
                        Current: {data?.restaurant?.upiId || "Not configured"}
                    </span>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                        value={upiIdInput}
                        onChange={(e) => setUpiIdInput(e.target.value)}
                        placeholder="owner@okbank"
                        className="w-full rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                    />
                    <button
                        type="button"
                        onClick={saveUpiId}
                        disabled={savingUpi}
                        className="inline-flex items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-60"
                    >
                        {savingUpi ? <LoaderCircle size={14} className="animate-spin" /> : "Save UPI ID"}
                    </button>
                </div>
                {upiNotice && <p className="mt-2 text-sm text-emerald-300">{upiNotice}</p>}
            </article>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-[#111827] p-4">
                    <p className="text-xs text-gray-400">Gross Sales</p>
                    <p className="mt-2 text-2xl font-bold">{formatMoney(data?.summary?.grossSales)}</p>
                    <p className="mt-1 text-xs text-gray-400">Invoices: {data?.summary?.invoiceCount || 0}</p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-4">
                    <p className="text-xs text-gray-400">Net Sales</p>
                    <p className="mt-2 text-2xl font-bold">{formatMoney(data?.summary?.netSales)}</p>
                    <p className="mt-1 text-xs text-gray-400">
                        Discounts: {formatMoney(data?.summary?.discountGiven)}
                    </p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-4">
                    <p className="text-xs text-gray-400">Expenses</p>
                    <p className="mt-2 text-2xl font-bold">{formatMoney(data?.summary?.expenseTotal)}</p>
                    <p className="mt-1 text-xs text-gray-400">
                        Profit: {formatMoney(data?.summary?.operatingProfit)}
                    </p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-4">
                    <p className="text-xs text-gray-400">Collections</p>
                    <p className="mt-2 text-2xl font-bold">{data?.summary?.collectionEfficiency?.toFixed(1)}%</p>
                    <p className="mt-1 text-xs text-gray-400">
                        Unpaid: {formatMoney(data?.summary?.unpaidAmount)}
                    </p>
                </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5 xl:col-span-2">
                    <h4 className="text-lg font-semibold">Payment Method Split</h4>
                    <div className="mt-4 space-y-3">
                        {(data?.paymentSplit || []).map((row) => {
                            const pct =
                                (Number(row.amount || 0) / Math.max(1, Number(data?.summary?.grossSales || 0))) *
                                100;
                            return (
                                <div key={row.mode}>
                                    <div className="mb-1 flex items-center justify-between text-xs text-gray-300">
                                        <span>{row.mode}</span>
                                        <span>{formatMoney(row.amount)}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-white/10">
                                        <div
                                            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                                            style={{ width: `${Math.max(6, pct)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {(data?.paymentSplit || []).length === 0 && (
                            <p className="text-sm text-gray-400">No payment mode data in selected range.</p>
                        )}
                    </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="text-lg font-semibold">Profit Snapshot</h4>
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between rounded-lg bg-[#0f172a] px-3 py-2">
                            <span className="text-gray-400">Operating Profit</span>
                            <span className="font-semibold text-emerald-300">
                                {formatMoney(data?.summary?.operatingProfit)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-[#0f172a] px-3 py-2">
                            <span className="text-gray-400">Margin</span>
                            <span className="font-semibold">{data?.summary?.marginPct?.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-[#0f172a] px-3 py-2">
                            <span className="text-gray-400">Tax Collected</span>
                            <span>{formatMoney(data?.summary?.taxCollected)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-[#0f172a] px-3 py-2">
                            <span className="text-gray-400">Service Charge</span>
                            <span>{formatMoney(data?.summary?.serviceChargeCollected)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-[#0f172a] px-3 py-2">
                            <span className="text-gray-400">Top Payment Mode</span>
                            <span>{topPaymentMode?.mode || "N/A"}</span>
                        </div>
                    </div>
                </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="mb-3 text-lg font-semibold">Expense Tracker</h4>

                    <form onSubmit={addExpense} className="grid gap-2 md:grid-cols-2">
                        <input
                            placeholder="Expense title"
                            value={expenseForm.title}
                            onChange={(e) => setExpenseForm((prev) => ({ ...prev, title: e.target.value }))}
                            className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                        />
                        <input
                            placeholder="Category"
                            value={expenseForm.category}
                            onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                            className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                        />
                        <input
                            placeholder="Amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={expenseForm.amount}
                            onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                            className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                        />
                        <input
                            type="date"
                            value={expenseForm.spentAt}
                            onChange={(e) => setExpenseForm((prev) => ({ ...prev, spentAt: e.target.value }))}
                            className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                        />
                        <input
                            placeholder="Notes"
                            value={expenseForm.notes}
                            onChange={(e) => setExpenseForm((prev) => ({ ...prev, notes: e.target.value }))}
                            className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none md:col-span-2"
                        />
                        <button
                            type="submit"
                            disabled={savingExpense}
                            className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-black md:col-span-2 disabled:opacity-70"
                        >
                            {savingExpense ? "Saving..." : "Add Expense"}
                        </button>
                    </form>

                    <div className="mt-4 space-y-2">
                        {(data?.expenses || []).map((expense) => (
                            <div
                                key={expense.id}
                                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2"
                            >
                                <div>
                                    <p className="text-sm font-medium">{expense.title}</p>
                                    <p className="text-xs text-gray-400">
                                        {expense.category} • {new Date(expense.spentAt || expense.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-sm text-rose-300">{formatMoney(expense.amount)}</p>
                                    <button
                                        type="button"
                                        onClick={() => deleteExpense(expense.id)}
                                        className="text-gray-400 hover:text-red-300"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="mb-3 text-lg font-semibold">AI Finance Signals</h4>
                    <div className="space-y-3">
                        {(data?.aiSignals || []).map((signal) => (
                            <div key={signal.title} className={`rounded-xl border p-3 ${signalClass(signal.type)}`}>
                                <p className="text-sm font-semibold">{signal.title}</p>
                                <p className="mt-1 text-xs opacity-90">{signal.message}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-white/10 bg-[#0f172a] p-3">
                            <p className="text-xs text-gray-400">
                                <CalendarRange size={12} className="mr-1 inline" />
                                Range
                            </p>
                            <p className="mt-1 text-sm font-semibold uppercase">{range}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#0f172a] p-3">
                            <p className="text-xs text-gray-400">
                                <Bot size={12} className="mr-1 inline" />
                                Margin Pulse
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                                {data?.summary?.marginPct >= 20 ? "Healthy" : "Needs Improvement"}
                            </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#0f172a] p-3">
                            <p className="text-xs text-gray-400">
                                <Wallet size={12} className="mr-1 inline" />
                                Paid
                            </p>
                            <p className="mt-1 text-sm font-semibold">{formatMoney(data?.summary?.paidAmount)}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#0f172a] p-3">
                            <p className="text-xs text-gray-400">
                                <CreditCard size={12} className="mr-1 inline" />
                                Outstanding
                            </p>
                            <p className="mt-1 text-sm font-semibold">{formatMoney(data?.summary?.unpaidAmount)}</p>
                        </div>
                    </div>
                </article>
            </div>

            <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h4 className="text-lg font-semibold">Invoice Ledger</h4>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by order, invoice, customer, table..."
                        className="w-full rounded-lg bg-[#0f172a] px-3 py-2 outline-none md:w-96"
                    />
                </div>

                <div className="mt-4 overflow-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr className="border-b border-white/10 text-left text-xs text-gray-400">
                                <th className="px-2 py-2">
                                    <ReceiptText size={14} className="inline" /> Invoice
                                </th>
                                <th className="px-2 py-2">Order</th>
                                <th className="px-2 py-2">Customer</th>
                                <th className="px-2 py-2">Table</th>
                                <th className="px-2 py-2">Payment</th>
                                <th className="px-2 py-2">Status</th>
                                <th className="px-2 py-2">Total</th>
                                <th className="px-2 py-2">Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvoices.map((invoice) => (
                                <tr key={invoice.id} className="border-b border-white/5">
                                    <td className="px-2 py-2">{invoice.invoiceNo || "-"}</td>
                                    <td className="px-2 py-2">{invoice.orderNo || "-"}</td>
                                    <td className="px-2 py-2">{invoice.customerName || "-"}</td>
                                    <td className="px-2 py-2">{invoice.tableNo || "-"}</td>
                                    <td className="px-2 py-2">
                                        <span className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-200">
                                            {invoice.paymentMode || "UNKNOWN"}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2">
                                        <span className="rounded bg-orange-500/20 px-2 py-1 text-xs text-orange-200">
                                            {invoice.paymentStatus || "PENDING"}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2">
                                        <span className="inline-flex items-center gap-1">
                                            <CircleDollarSign size={13} />
                                            {formatMoney(invoice.total)}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2">
                                        {new Date(invoice.createdAt).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredInvoices.length === 0 && (
                        <div className="mt-4 rounded-lg border border-white/10 bg-[#0f172a] p-4 text-sm text-gray-400">
                            No invoices match your search.
                        </div>
                    )}
                </div>
            </article>
        </section>
    );
}
