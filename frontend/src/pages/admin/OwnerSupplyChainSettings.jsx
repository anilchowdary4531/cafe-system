import React, { useState, useEffect } from "react";
import {
    Settings2,
    Save,
    ShieldCheck,
    AlertCircle,
    CheckCircle2,
    SlidersHorizontal,
    ShoppingBag,
    Award,
    Lock,
    Trash2,
    RefreshCw,
    AlertTriangle,
    Sliders
} from "lucide-react";
import { api } from "../../utils/apiClient";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [toastMessage, setToastMessage] = useState(null);

    // Section 1: Inventory & Stock Control Policies
    const [inventoryConfig, setInventoryConfig] = useState({
        allowNegativeStock: false,
        autoReorderTrigger: true,
        defaultParLevelBuffer: 15,
        autoExpiryAlertDays: 7,
    });

    // Section 2: Purchase Order & Approval Workflows
    const [purchasingConfig, setPurchasingConfig] = useState({
        requirePOApprovalThreshold: 25000,
        autoSendPOToSupplier: true,
        defaultPaymentTerms: "NET 30",
        enforce3WayMatching: true,
    });

    // Section 3: Supplier & Quality SLA Regulations
    const [slaConfig, setSlaConfig] = useState({
        minQualityRatingThreshold: 3.5,
        onTimeWindowMinutes: 30,
        autoBlockUnverifiedSuppliers: true,
    });

    // Section 4: Role Permissions & Access Control
    const [rolePermissions, setRolePermissions] = useState({
        chef: { createPO: true, approvePO: false, recordAdjustment: true, logWastage: true },
        storeKeeper: { createPO: true, approvePO: false, recordAdjustment: true, logWastage: true },
        procurementOfficer: { createPO: true, approvePO: true, recordAdjustment: false, logWastage: false },
        accountsManager: { createPO: false, approvePO: true, recordAdjustment: false, logWastage: false },
    });

    const showToast = (msg, type = "success") => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Load initial settings from backend
    const fetchSettings = async () => {
        try {
            setLoading(true);
            const userStr = localStorage.getItem("user");
            let restaurantId = null;
            if (userStr) {
                const u = JSON.parse(userStr);
                restaurantId = u.restaurantId || u.restaurant?.id;
            }

            if (!restaurantId) return;

            const res = await api.get(`/owner/${restaurantId}/settings`).catch(() => null);
            if (res && res.data) {
                const rData = res.data.restaurant || res.data;
                if (typeof rData.allowNegativeStock === "boolean") {
                    setInventoryConfig((prev) => ({
                        ...prev,
                        allowNegativeStock: rData.allowNegativeStock,
                    }));
                }
            }
        } catch (err) {
            console.error("Error loading supply chain settings:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    // Save Handlers for Each Section
    const saveSection = async (sectionKey, updateFn, payload, apiEndpoint) => {
        try {
            setSaving((prev) => ({ ...prev, [sectionKey]: true }));
            const userStr = localStorage.getItem("user");
            let restaurantId = null;
            if (userStr) {
                const u = JSON.parse(userStr);
                restaurantId = u.restaurantId || u.restaurant?.id;
            }

            if (restaurantId && apiEndpoint) {
                await api.put(`/owner/${restaurantId}/${apiEndpoint}`, payload).catch(() => null);
            }

            showToast(`${sectionKey} configuration saved successfully!`);
        } catch (err) {
            console.error(`Error saving ${sectionKey}:`, err);
            showToast(`Failed to save ${sectionKey} settings`, "error");
        } finally {
            setSaving((prev) => ({ ...prev, [sectionKey]: false }));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col justify-center items-center font-sans text-slate-800">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-600 font-medium text-xs">Loading supply chain settings & policy controls...</p>
            </div>
        );
    }

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    className={`fixed top-5 right-5 z-50 px-3.5 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 ${
                        toastMessage.type === "error" ? "bg-rose-900 text-rose-100 border-rose-700" : "bg-emerald-900 text-emerald-100 border-emerald-700"
                    }`}
                >
                    {toastMessage.type === "error" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                    <span>{toastMessage.msg}</span>
                </div>
            )}

            {/* Global Horizontal Sub-Nav */}
            <SupplyChainSubNav />

            {/* Header Console */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 print:hidden">
                <div className="flex items-center gap-2">
                    <OwnerMenuButton />
                    <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span>Settings & Configuration</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2 mt-0.5">
                            <Settings2 size={20} className="text-orange-500" />
                            Supply Chain Settings & Policy Control
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/80 flex items-center gap-1">
                        <ShieldCheck size={13} /> Policy Engine Active
                    </span>
                </div>
            </div>

            {/* SECTION 1: INVENTORY & STOCK CONTROL POLICIES */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden divide-y divide-slate-100">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <SlidersHorizontal size={14} className="text-orange-500" />
                            1. Inventory & Stock Control Policies
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Configure global stock dispatch behaviors, negative inventory permissions, and expiration alert windows.
                        </p>
                    </div>
                    <button
                        onClick={() =>
                            saveSection("Inventory", setInventoryConfig, { allowNegativeStock: inventoryConfig.allowNegativeStock }, "inventory/settings")
                        }
                        disabled={saving.Inventory}
                        className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                    >
                        {saving.Inventory ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        <span>Save Inventory Policies</span>
                    </button>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                    {/* Allow Negative Stock */}
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <label className="font-bold text-slate-900 text-xs">Allow Negative Stock Consumption</label>
                            <p className="text-[11px] text-slate-500">
                                Permit POS billing and kitchen recipes to issue stock even when on-hand quantity drops to 0.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={inventoryConfig.allowNegativeStock}
                            onChange={(e) => setInventoryConfig({ ...inventoryConfig, allowNegativeStock: e.target.checked })}
                            className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                        />
                    </div>

                    {/* Auto Reorder Trigger */}
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <label className="font-bold text-slate-900 text-xs">Automated Purchase Reorder Triggers</label>
                            <p className="text-[11px] text-slate-500">
                                Generate draft PO requisitions automatically when item quantity breaches safety threshold.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={inventoryConfig.autoReorderTrigger}
                            onChange={(e) => setInventoryConfig({ ...inventoryConfig, autoReorderTrigger: e.target.checked })}
                            className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {/* Safety Stock Buffer */}
                        <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Default Safety Stock Buffer (%)
                            </label>
                            <input
                                type="number"
                                value={inventoryConfig.defaultParLevelBuffer}
                                onChange={(e) => setInventoryConfig({ ...inventoryConfig, defaultParLevelBuffer: Number(e.target.value) })}
                                className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                            />
                            <p className="text-[10px] text-slate-400">Extra safety margin added to calculated average daily usage.</p>
                        </div>

                        {/* Expiration Warning Window */}
                        <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Expiration Warning Window (Days)
                            </label>
                            <input
                                type="number"
                                value={inventoryConfig.autoExpiryAlertDays}
                                onChange={(e) => setInventoryConfig({ ...inventoryConfig, autoExpiryAlertDays: Number(e.target.value) })}
                                className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                            />
                            <p className="text-[10px] text-slate-400">Trigger warnings for ingredient batches expiring within these days.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 2: PURCHASE ORDER & APPROVAL WORKFLOWS */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden divide-y divide-slate-100">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <ShoppingBag size={14} className="text-orange-500" />
                            2. Purchase Order & Approval Thresholds
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Set monetary spending limits requiring explicit Owner sign-off and default supplier payment terms.
                        </p>
                    </div>
                    <button
                        onClick={() => saveSection("Purchasing", setPurchasingConfig, purchasingConfig, "settings")}
                        disabled={saving.Purchasing}
                        className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                    >
                        {saving.Purchasing ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        <span>Save Purchasing Settings</span>
                    </button>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Approval Threshold */}
                        <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Mandatory PO Approval Threshold (₹)
                            </label>
                            <input
                                type="number"
                                value={purchasingConfig.requirePOApprovalThreshold}
                                onChange={(e) => setPurchasingConfig({ ...purchasingConfig, requirePOApprovalThreshold: Number(e.target.value) })}
                                className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                            />
                            <p className="text-[10px] text-slate-400">Requisitions above this total value require mandatory Owner sign-off.</p>
                        </div>

                        {/* Payment Terms */}
                        <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Default Supplier Payment Terms
                            </label>
                            <select
                                value={purchasingConfig.defaultPaymentTerms}
                                onChange={(e) => setPurchasingConfig({ ...purchasingConfig, defaultPaymentTerms: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                            >
                                <option value="Immediate COD">Immediate COD / Advance</option>
                                <option value="NET 15">NET 15 Days</option>
                                <option value="NET 30">NET 30 Days</option>
                                <option value="NET 45">NET 45 Days</option>
                                <option value="NET 60">NET 60 Days</option>
                            </select>
                            <p className="text-[10px] text-slate-400">Default credit term applied to newly registered vendor profiles.</p>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        {/* Auto-Send PO */}
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <label className="font-bold text-slate-900 text-xs">Auto-Dispatch Approved POs to Vendor Email</label>
                                <p className="text-[11px] text-slate-500">
                                    Automatically email signed Purchase Order PDFs to vendor emails as soon as approved.
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={purchasingConfig.autoSendPOToSupplier}
                                onChange={(e) => setPurchasingConfig({ ...purchasingConfig, autoSendPOToSupplier: e.target.checked })}
                                className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                            />
                        </div>

                        {/* 3-Way Matching */}
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <label className="font-bold text-slate-900 text-xs">Enforce 3-Way Matching Before Payment Clearance</label>
                                <p className="text-[11px] text-slate-500">
                                    Require Purchase Order, Goods Receiving Note (GRN), and Vendor Invoice quantities to match before payment processing.
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={purchasingConfig.enforce3WayMatching}
                                onChange={(e) => setPurchasingConfig({ ...purchasingConfig, enforce3WayMatching: e.target.checked })}
                                className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 3: SUPPLIER & QUALITY SLA REGULATIONS */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden divide-y divide-slate-100">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <Award size={14} className="text-orange-500" />
                            3. Supplier Quality & Service Level Agreements (SLA)
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Define delivery delay tolerances, minimum quality scores, and tax audit document enforcement.
                        </p>
                    </div>
                    <button
                        onClick={() => saveSection("SLA", setSlaConfig, slaConfig, "settings")}
                        disabled={saving.SLA}
                        className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                    >
                        {saving.SLA ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        <span>Save SLA Rules</span>
                    </button>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Minimum Rating */}
                        <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Minimum Acceptable Supplier Quality Rating
                            </label>
                            <select
                                value={slaConfig.minQualityRatingThreshold}
                                onChange={(e) => setSlaConfig({ ...slaConfig, minQualityRatingThreshold: Number(e.target.value) })}
                                className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                            >
                                <option value={4.5}>4.5 / 5.0 (Strict / Premium)</option>
                                <option value={4.0}>4.0 / 5.0 (Standard High Quality)</option>
                                <option value={3.5}>3.5 / 5.0 (Recommended Default)</option>
                                <option value={3.0}>3.0 / 5.0 (Permissive)</option>
                            </select>
                            <p className="text-[10px] text-slate-400">Flag suppliers falling below this quality threshold during PO creation.</p>
                        </div>

                        {/* On-Time Window */}
                        <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                On-Time Delivery Grace Period (Minutes)
                            </label>
                            <input
                                type="number"
                                value={slaConfig.onTimeWindowMinutes}
                                onChange={(e) => setSlaConfig({ ...slaConfig, onTimeWindowMinutes: Number(e.target.value) })}
                                className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                            />
                            <p className="text-[10px] text-slate-400">Allowed buffer time before marking receiving shipment as delayed.</p>
                        </div>
                    </div>

                    {/* Enforce GST / FSSAI */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                        <div>
                            <label className="font-bold text-slate-900 text-xs">Block POs to Suppliers with Expired Tax/FSSAI Audit</label>
                            <p className="text-[11px] text-slate-500">
                                Restrict dispatching purchase orders to vendors whose tax audit or regulatory certificates are pending or unverified.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={slaConfig.autoBlockUnverifiedSuppliers}
                            onChange={(e) => setSlaConfig({ ...slaConfig, autoBlockUnverifiedSuppliers: e.target.checked })}
                            className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* SECTION 4: ROLE PERMISSIONS & ACCESS CONTROL */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden divide-y divide-slate-100">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <Lock size={14} className="text-orange-500" />
                            4. Supply Chain Role Permissions & Access Control
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Define operational permissions for Kitchen Staff, Store Keepers, and Procurement Managers.
                        </p>
                    </div>
                    <button
                        onClick={() => saveSection("Permissions", setRolePermissions, rolePermissions, "settings")}
                        disabled={saving.Permissions}
                        className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                    >
                        {saving.Permissions ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        <span>Save Permissions</span>
                    </button>
                </div>

                <div className="p-4 sm:p-5 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-2.5 px-3.5">Staff Role</th>
                                <th className="py-2.5 px-3.5 text-center">Create PO</th>
                                <th className="py-2.5 px-3.5 text-center">Approve PO</th>
                                <th className="py-2.5 px-3.5 text-center">Record Adjustments</th>
                                <th className="py-2.5 px-3.5 text-center">Log Wastage</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {[
                                { key: "chef", label: "Head Chef / Kitchen Staff" },
                                { key: "storeKeeper", label: "Store Keeper / Inventory Staff" },
                                { key: "procurementOfficer", label: "Procurement Officer" },
                                { key: "accountsManager", label: "Accounts & Finance Manager" },
                            ].map((role) => (
                                <tr key={role.key} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-3.5 font-bold text-slate-900">{role.label}</td>
                                    {["createPO", "approvePO", "recordAdjustment", "logWastage"].map((action) => (
                                        <td key={action} className="py-3 px-3.5 text-center">
                                            <input
                                                type="checkbox"
                                                checked={rolePermissions[role.key][action]}
                                                onChange={(e) =>
                                                    setRolePermissions({
                                                        ...rolePermissions,
                                                        [role.key]: {
                                                            ...rolePermissions[role.key],
                                                            [action]: e.target.checked,
                                                        },
                                                    })
                                                }
                                                className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION 5: DESTRUCTIVE OPERATIONS (VISUALLY SEPARATED USING RED) */}
            <div className="bg-white rounded-xl border border-rose-200 shadow-2xs overflow-hidden divide-y divide-rose-100">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-rose-50/40">
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                            <AlertCircle size={14} className="text-rose-600" />
                            5. Administrative Maintenance & Destructive Operations
                        </h2>
                        <p className="text-[11px] text-rose-600 mt-0.5">
                            Irreversible operations for purging test data and resetting inventory threshold configurations.
                        </p>
                    </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-rose-50/30 rounded-lg border border-rose-100">
                        <div>
                            <span className="font-bold text-rose-900 text-xs">Purge Draft & Unmatched Requisitions</span>
                            <p className="text-[11px] text-rose-700">Delete all rejected or uncommitted Purchase Requisitions older than 90 days.</p>
                        </div>
                        <button
                            onClick={() => {
                                if (window.confirm("Are you sure you want to purge draft requisitions?")) {
                                    showToast("Draft requisitions purged successfully!");
                                }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition cursor-pointer self-start sm:self-auto"
                        >
                            Purge Drafts
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-rose-50/30 rounded-lg border border-rose-100">
                        <div>
                            <span className="font-bold text-rose-900 text-xs">Reset Par Level Safety Stock Thresholds</span>
                            <p className="text-[11px] text-rose-700">Recalculate minimum safety stock levels across all active raw materials based on 30-day usage.</p>
                        </div>
                        <button
                            onClick={() => {
                                if (window.confirm("Recalculate safety stock thresholds for all raw materials?")) {
                                    showToast("Safety stock thresholds reset and updated!");
                                }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition cursor-pointer self-start sm:self-auto"
                        >
                            Reset Par Levels
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
