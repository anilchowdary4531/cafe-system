import { useEffect, useState } from "react";
import {
    Printer,
    Plus,
    CheckCircle2,
    XCircle,
    LoaderCircle,
    RefreshCw,
    Edit3,
    Trash2,
    Wifi,
    FileText,
    Utensils,
    Server,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

export default function PrinterSettings() {
    const { user } = useAuth();
    const restaurantId = user?.restaurantId;

    const [printers, setPrinters] = useState([]);
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [testingPrinterId, setTestingPrinterId] = useState(null);

    // Modal state for Printer
    const [showPrinterModal, setShowPrinterModal] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState(null);
    const [printerForm, setPrinterForm] = useState({
        name: "",
        ipAddress: "",
        port: 9100,
        paperWidth: 80,
        isActive: true,
        isDefault: false,
    });
    const [submittingPrinter, setSubmittingPrinter] = useState(false);

    // Modal state for Kitchen Station
    const [showStationModal, setShowStationModal] = useState(false);
    const [editingStation, setEditingStation] = useState(null);
    const [stationForm, setStationForm] = useState({
        name: "",
        code: "",
        printerId: "",
        isActive: true,
    });
    const [submittingStation, setSubmittingStation] = useState(false);

    const loadData = async () => {
        if (!restaurantId || isNaN(Number(restaurantId))) return;
        setLoading(true);
        try {
            const [printersRes, stationsRes] = await Promise.all([
                api.get(`/owner/${restaurantId}/printers`),
                api.get(`/owner/${restaurantId}/kitchen-stations`),
            ]);
            setPrinters(printersRes?.data?.printers || printersRes?.data || []);
            setStations(stationsRes?.data?.stations || stationsRes?.data || []);
        } catch (err) {
            console.error("Failed to load printer settings", err);
            showToast({
                title: "Error",
                message: err?.response?.data?.message || "Failed to load thermal printer configuration.",
                variant: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [restaurantId]);

    // Handle Printer Save
    const handleSavePrinter = async (e) => {
        e.preventDefault();
        if (!printerForm.name || !printerForm.ipAddress) {
            showToast({ title: "Validation", message: "Name and IP Address are required.", variant: "warning" });
            return;
        }

        setSubmittingPrinter(true);
        try {
            if (editingPrinter) {
                await api.put(`/owner/${restaurantId}/printers/${editingPrinter.id}`, printerForm);
                showToast({ title: "Updated", message: `Printer "${printerForm.name}" updated successfully.` });
            } else {
                await api.post(`/owner/${restaurantId}/printers`, printerForm);
                showToast({ title: "Created", message: `Printer "${printerForm.name}" created successfully.` });
            }
            setShowPrinterModal(false);
            setEditingPrinter(null);
            loadData();
        } catch (err) {
            showToast({
                title: "Error",
                message: err?.response?.data?.message || "Failed to save printer.",
                variant: "error",
            });
        } finally {
            setSubmittingPrinter(false);
        }
    };

    // Handle Printer Delete
    const handleDeletePrinter = async (printerId) => {
        if (!window.confirm("Are you sure you want to delete this printer?")) return;
        try {
            await api.delete(`/owner/${restaurantId}/printers/${printerId}`);
            showToast({ title: "Deleted", message: "Printer deleted successfully." });
            loadData();
        } catch (err) {
            showToast({
                title: "Error",
                message: err?.response?.data?.message || "Failed to delete printer.",
                variant: "error",
            });
        }
    };

    // Handle Printer Test
    const handleTestPrinter = async (printerId) => {
        setTestingPrinterId(printerId);
        try {
            const res = await api.post(`/owner/${restaurantId}/printers/${printerId}/test`);
            if (res.data?.success) {
                showToast({
                    title: "Test Print Sent",
                    message: res.data.message || "Test slip dispatched to printer TCP port.",
                });
            } else {
                showToast({
                    title: "Print Failed",
                    message: res.data?.error || "Printer unreachable on network.",
                    variant: "error",
                });
            }
        } catch (err) {
            showToast({
                title: "Print Error",
                message: err?.response?.data?.error || err?.response?.data?.message || "Connection timed out.",
                variant: "error",
            });
        } finally {
            setTestingPrinterId(null);
        }
    };

    // Handle Station Save
    const handleSaveStation = async (e) => {
        e.preventDefault();
        if (!stationForm.name) {
            showToast({ title: "Validation", message: "Station name is required.", variant: "warning" });
            return;
        }

        setSubmittingStation(true);
        try {
            const payload = {
                ...stationForm,
                printerId: stationForm.printerId ? Number(stationForm.printerId) : null,
            };
            if (editingStation) {
                await api.put(`/owner/${restaurantId}/kitchen-stations/${editingStation.id}`, payload);
                showToast({ title: "Updated", message: `Station "${stationForm.name}" updated.` });
            } else {
                await api.post(`/owner/${restaurantId}/kitchen-stations`, payload);
                showToast({ title: "Created", message: `Station "${stationForm.name}" created.` });
            }
            setShowStationModal(false);
            setEditingStation(null);
            loadData();
        } catch (err) {
            showToast({
                title: "Error",
                message: err?.response?.data?.message || "Failed to save station.",
                variant: "error",
            });
        } finally {
            setSubmittingStation(false);
        }
    };

    // Handle Station Delete
    const handleDeleteStation = async (stationId) => {
        if (!window.confirm("Are you sure you want to delete this kitchen station?")) return;
        try {
            await api.delete(`/owner/${restaurantId}/kitchen-stations/${stationId}`);
            showToast({ title: "Deleted", message: "Station deleted." });
            loadData();
        } catch (err) {
            showToast({ title: "Error", message: err?.response?.data?.message || "Failed to delete station.", variant: "error" });
        }
    };

    const openNewPrinter = () => {
        setEditingPrinter(null);
        setPrinterForm({
            name: "",
            ipAddress: "192.168.1.100",
            port: 9100,
            paperWidth: 80,
            isActive: true,
            isDefault: printers.length === 0,
        });
        setShowPrinterModal(true);
    };

    const openEditPrinter = (p) => {
        setEditingPrinter(p);
        setPrinterForm({
            name: p.name,
            ipAddress: p.ipAddress,
            port: p.port || 9100,
            paperWidth: p.paperWidth || 80,
            isActive: p.isActive,
            isDefault: p.isDefault,
        });
        setShowPrinterModal(true);
    };

    const openNewStation = () => {
        setEditingStation(null);
        setStationForm({
            name: "",
            code: "",
            printerId: printers[0]?.id || "",
            isActive: true,
        });
        setShowStationModal(true);
    };

    const openEditStation = (st) => {
        setEditingStation(st);
        setStationForm({
            name: st.name,
            code: st.code || "",
            printerId: st.printerId || "",
            isActive: st.isActive,
        });
        setShowStationModal(true);
    };

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="theme-muted text-sm font-medium">Hardware & Routing</p>
                    <h3 className="text-3xl font-bold flex items-center gap-2">
                        <Printer className="text-orange-500" size={28} />
                        Thermal Printers & Kitchen Stations
                    </h3>
                    <p className="theme-muted mt-1 text-sm">
                        Configure ESC/POS thermal network printers (Port 9100) and map kitchen routing stations.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={loadData}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm font-semibold hover:bg-white/5"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={openNewPrinter}
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-orange-400"
                    >
                        <Plus size={18} />
                        Add Thermal Printer
                    </button>
                </div>
            </div>

            {/* Thermal Printers Section */}
            <div className="pb-4">
                <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/50 pb-3">
                    <div>
                        <h4 className="text-base font-bold flex items-center gap-2">
                            <Server size={18} className="text-emerald-500" />
                            Network ESC/POS Printers ({printers.length})
                        </h4>
                        <p className="theme-muted text-xs">Direct TCP socket printing over LAN without third-party drivers.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="py-8 text-center theme-muted text-sm flex items-center justify-center gap-2">
                        <LoaderCircle size={18} className="animate-spin" /> Loading thermal printers...
                    </div>
                ) : printers.length === 0 ? (
                    <div className="py-10 text-center rounded-xl border border-dashed border-[color:var(--app-border)]/40 my-3 p-5">
                        <Printer size={36} className="mx-auto theme-muted mb-2 opacity-50" />
                        <p className="font-semibold text-sm">No thermal printers configured</p>
                        <p className="theme-muted text-xs mt-1">Add your kitchen network printer IP address (e.g. 192.168.1.100)</p>
                        <button
                            type="button"
                            onClick={openNewPrinter}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-500/15 text-orange-500 px-3.5 py-1.5 text-xs font-bold hover:bg-orange-500/25"
                        >
                            <Plus size={14} /> Add First Printer
                        </button>
                    </div>
                ) : (
                    <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {printers.map((p) => (
                            <div
                                key={p.id}
                                className="rounded-xl border border-[color:var(--app-border)]/40 p-3 flex flex-col justify-between space-y-2.5 transition hover:bg-black/5 dark:hover:bg-white/5"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-start justify-between">
                                        <h5 className="font-bold text-sm flex items-center gap-2">
                                            {p.name}
                                            {p.isDefault && (
                                                <span className="rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] px-2 py-0.5 font-semibold">
                                                    Default
                                                </span>
                                            )}
                                        </h5>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.isActive ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}`}>
                                            {p.isActive ? "Active" : "Disabled"}
                                        </span>
                                    </div>
                                    <div className="theme-muted text-xs flex items-center gap-2">
                                        <Wifi size={13} className="text-sky-500" />
                                        <code>{p.ipAddress}:{p.port || 9100}</code>
                                    </div>
                                    <div className="theme-muted text-xs flex items-center gap-2">
                                        <FileText size={13} className="text-amber-500" />
                                        <span>Paper Size: <strong>{p.paperWidth}mm</strong></span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-[color:var(--app-border)]/30 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleTestPrinter(p.id)}
                                        disabled={testingPrinterId === p.id}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 text-sky-500 px-2.5 py-1 text-xs font-semibold hover:bg-sky-500/25 disabled:opacity-50"
                                    >
                                        {testingPrinterId === p.id ? (
                                            <LoaderCircle size={13} className="animate-spin" />
                                        ) : (
                                            <Printer size={13} />
                                        )}
                                        Test Print
                                    </button>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openEditPrinter(p)}
                                            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 theme-muted"
                                            title="Edit Printer"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeletePrinter(p.id)}
                                            className="p-1 rounded-md hover:bg-red-500/20 text-red-400"
                                            title="Delete Printer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Kitchen Stations Section */}
            <div className="pt-2">
                <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/50 pb-3">
                    <div>
                        <h4 className="text-base font-bold flex items-center gap-2">
                            <Utensils size={18} className="text-orange-500" />
                            Kitchen Stations ({stations.length})
                        </h4>
                        <p className="theme-muted text-xs">Category & Item routing rules for distinct prep areas (e.g. Main Kitchen, Bar, Tandoor).</p>
                    </div>
                    <button
                        type="button"
                        onClick={openNewStation}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/15 text-orange-500 px-3 py-1.5 text-xs font-semibold hover:bg-orange-500/25"
                    >
                        <Plus size={15} /> Add Station
                    </button>
                </div>

                {loading ? (
                    <div className="py-6 text-center theme-muted text-sm">Loading stations...</div>
                ) : stations.length === 0 ? (
                    <div className="py-6 text-center rounded-xl border border-dashed border-[color:var(--app-border)]/40 my-3 p-4 text-xs theme-muted">
                        No custom kitchen stations added yet. Defaults to <strong>Main Kitchen</strong>.
                    </div>
                ) : (
                    <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {stations.map((st) => (
                            <div
                                key={st.id}
                                className="rounded-xl border border-[color:var(--app-border)]/40 p-3 flex flex-col justify-between space-y-2.5 transition hover:bg-black/5 dark:hover:bg-white/5"
                            >
                                <div>
                                    <div className="flex items-center justify-between">
                                        <h5 className="font-bold text-sm text-[color:var(--app-text)]">{st.name}</h5>
                                        <span className="rounded-md bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-mono theme-muted">
                                            {st.code || "STD"}
                                        </span>
                                    </div>
                                    <p className="theme-muted text-xs mt-1">
                                        Assigned Printer:{" "}
                                        {st.printer ? (
                                            <span className="text-emerald-400 font-semibold">{st.printer.name} ({st.printer.ipAddress})</span>
                                        ) : (
                                            <span className="text-amber-400 font-medium">None (Default Fallback)</span>
                                        )}
                                    </p>
                                </div>

                                <div className="pt-2 border-t border-[color:var(--app-border)]/30 flex items-center justify-end gap-1">
                                    <button
                                        type="button"
                                        onClick={() => openEditStation(st)}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
                                    >
                                        <Edit3 size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteStation(st.id)}
                                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal for Thermal Printer Form */}
            {showPrinterModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h4 className="text-lg font-bold">
                                {editingPrinter ? "Edit Printer" : "Add Thermal Printer"}
                            </h4>
                            <button
                                type="button"
                                onClick={() => setShowPrinterModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePrinter} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold theme-muted mb-1">Printer Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Kitchen ESC-POS Printer 1"
                                    value={printerForm.name}
                                    onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })}
                                    className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-3.5 py-2.5 text-sm outline-none focus:border-orange-500"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold theme-muted mb-1">IP Address</label>
                                    <input
                                        type="text"
                                        placeholder="192.168.1.100"
                                        value={printerForm.ipAddress}
                                        onChange={(e) => setPrinterForm({ ...printerForm, ipAddress: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-3.5 py-2.5 text-sm font-mono outline-none focus:border-orange-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold theme-muted mb-1">Port</label>
                                    <input
                                        type="number"
                                        value={printerForm.port}
                                        onChange={(e) => setPrinterForm({ ...printerForm, port: parseInt(e.target.value) || 9100 })}
                                        className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2.5 text-sm font-mono outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold theme-muted mb-1">Paper Roll Width</label>
                                <select
                                    value={printerForm.paperWidth}
                                    onChange={(e) => setPrinterForm({ ...printerForm, paperWidth: parseInt(e.target.value) })}
                                    className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-3.5 py-2.5 text-sm outline-none focus:border-orange-500"
                                >
                                    <option value={80}>80mm Standard Thermal (42 Chars)</option>
                                    <option value={58}>58mm Compact Thermal (32 Chars)</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-6 pt-1">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={printerForm.isActive}
                                        onChange={(e) => setPrinterForm({ ...printerForm, isActive: e.target.checked })}
                                        className="rounded accent-orange-500"
                                    />
                                    Active
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={printerForm.isDefault}
                                        onChange={(e) => setPrinterForm({ ...printerForm, isDefault: e.target.checked })}
                                        className="rounded accent-orange-500"
                                    />
                                    Default Printer
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setShowPrinterModal(false)}
                                    className="rounded-xl px-4 py-2 text-sm font-semibold theme-muted hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingPrinter}
                                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                                >
                                    {submittingPrinter && <LoaderCircle size={16} className="animate-spin" />}
                                    Save Printer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Kitchen Station Form */}
            {showStationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h4 className="text-lg font-bold">
                                {editingStation ? "Edit Station" : "Add Kitchen Station"}
                            </h4>
                            <button
                                type="button"
                                onClick={() => setShowStationModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveStation} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold theme-muted mb-1">Station Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Bar & Beverages"
                                    value={stationForm.name}
                                    onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                                    className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-3.5 py-2.5 text-sm outline-none focus:border-orange-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold theme-muted mb-1">Station Code (Short)</label>
                                <input
                                    type="text"
                                    placeholder="BAR"
                                    value={stationForm.code}
                                    onChange={(e) => setStationForm({ ...stationForm, code: e.target.value.toUpperCase() })}
                                    className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-3.5 py-2.5 text-sm font-mono outline-none focus:border-orange-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold theme-muted mb-1">Target Printer</label>
                                <select
                                    value={stationForm.printerId}
                                    onChange={(e) => setStationForm({ ...stationForm, printerId: e.target.value })}
                                    className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-3.5 py-2.5 text-sm outline-none focus:border-orange-500"
                                >
                                    <option value="">-- Unassigned (Use Default Printer) --</option>
                                    {printers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.ipAddress})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setShowStationModal(false)}
                                    className="rounded-xl px-4 py-2 text-sm font-semibold theme-muted hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingStation}
                                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                                >
                                    {submittingStation && <LoaderCircle size={16} className="animate-spin" />}
                                    Save Station
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
