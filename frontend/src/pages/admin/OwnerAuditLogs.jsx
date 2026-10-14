import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ShieldCheck,
    RefreshCw,
    Download,
    Filter,
    Calendar,
    RotateCcw,
    AlertTriangle,
    Eye,
    ChevronLeft,
    ChevronRight,
    Lock,
    Search,
    Clock,
    FileText,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SecurityActivityDrawer, {
    ACTION_LABELS,
    formatActionLabel,
    getSeverityBadgeClass,
    getStatusBadgeClass,
    sanitizeDetailsFrontend,
} from "../../components/SecurityActivityDrawer";

const SEVERITY_OPTIONS = [
    { value: "", label: "All Severities" },
    { value: "INFO", label: "INFO" },
    { value: "WARN", label: "WARN" },
    { value: "ERROR", label: "ERROR" },
    { value: "CRITICAL", label: "CRITICAL" },
];

const STATUS_OPTIONS = [
    { value: "", label: "All Statuses" },
    { value: "SUCCESS", label: "SUCCESS" },
    { value: "FAILURE", label: "FAILURE" },
    { value: "BLOCKED", label: "BLOCKED" },
    { value: "EXPIRED", label: "EXPIRED" },
];

const ENTITY_OPTIONS = [
    { value: "", label: "All Entities" },
    { value: "User", label: "User" },
    { value: "Auth", label: "Auth" },
    { value: "Staff", label: "Staff" },
    { value: "Table", label: "Table" },
    { value: "Order", label: "Order" },
];

const ACTION_GROUPS = [
    {
        label: "Authentication & Lockout",
        options: [
            { value: "AUTH_LOGIN_SUCCESS", label: "Login Successful" },
            { value: "AUTH_LOGIN_FAILURE", label: "Login Failed" },
            { value: "AUTH_ACCOUNT_LOCKED", label: "Account Locked" },
            { value: "AUTH_LOCKOUT_EXPIRED", label: "Lockout Expired" },
            { value: "AUTH_TEMP_PASSWORD_USED", label: "Temporary Password Used" },
            { value: "AUTH_SESSION_INVALIDATED", label: "Session Invalidated" },
        ],
    },
    {
        label: "Password & OTP Lifecycle",
        options: [
            { value: "AUTH_PASSWORD_CHANGED", label: "Password Changed" },
            { value: "AUTH_PASSWORD_RESET_REQUESTED", label: "Password Reset Requested" },
            { value: "AUTH_PASSWORD_RESET_COMPLETED", label: "Password Reset Completed" },
            { value: "AUTH_FORCED_PASSWORD_CHANGE", label: "Forced Password Change" },
            { value: "AUTH_OTP_SENT", label: "OTP Sent" },
            { value: "AUTH_OTP_VERIFIED", label: "OTP Verified" },
            { value: "AUTH_OTP_FAILED", label: "OTP Failed" },
            { value: "AUTH_OTP_EXPIRED", label: "OTP Expired" },
        ],
    },
    {
        label: "Staff Lifecycle & Roles",
        options: [
            { value: "STAFF_TEMP_PASSWORD_ISSUED", label: "Temporary Password Issued" },
            { value: "STAFF_CREATED", label: "Staff Created" },
            { value: "STAFF_UPDATED", label: "Staff Updated" },
            { value: "STAFF_ROLE_CHANGED", label: "Staff Role Changed" },
            { value: "STAFF_ACCESS_UPDATED", label: "Staff Access Updated" },
            { value: "STAFF_STATUS_CHANGED", label: "Staff Status Changed" },
            { value: "STAFF_DELETED", label: "Staff Deleted" },
        ],
    },
    {
        label: "POS & Restaurant Operations",
        options: [
            { value: "WAITER_ASSIGNED", label: "Waiter Assigned" },
            { value: "WAITER_UNASSIGNED", label: "Waiter Unassigned" },
            { value: "WAITER_REASSIGNED", label: "Waiter Reassigned" },
            { value: "ORDER_CANCELLED", label: "Order Cancelled" },
            { value: "KOT_ITEM_CANCELLED", label: "KOT Item Cancelled" },
            { value: "ORDER_DISCOUNT_APPLIED", label: "Order Discount Applied" },
            { value: "SESSION_DISCOUNT_APPLIED", label: "Session Discount Applied" },
            { value: "KOT_REPRINTED", label: "KOT Reprinted" },
        ],
    },
];

const DATE_PRESETS = [
    { label: "All Time", value: "all" },
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 7 Days", value: "7d" },
    { label: "Last 30 Days", value: "30d" },
    { label: "Custom Range", value: "custom" },
];

export const formatLocalDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const escapeCsvCell = (value) => {
    if (value === null || value === undefined) return '""';
    const str = typeof value === "object" ? JSON.stringify(value) : String(value);
    return `"${str.replace(/"/g, '""')}"`;
};

export default function OwnerAuditLogs() {
    const { user } = useAuth();
    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        (typeof window !== "undefined" ? localStorage.getItem("activeRestaurantId") : null) ||
        1
    );

    // Logs & Pagination State
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 1,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errorState, setErrorState] = useState(null); // { type: '403' | 'error', message: string }

    // Filters State
    const [severity, setSeverity] = useState("");
    const [status, setStatus] = useState("");
    const [action, setAction] = useState("");
    const [entity, setEntity] = useState("");
    const [branchId, setBranchId] = useState("");
    const [datePreset, setDatePreset] = useState("all");
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");

    // Detail Drawer State
    const [selectedLog, setSelectedLog] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Compute Date Range Boundaries
    const computedDates = useMemo(() => {
        if (datePreset === "all") {
            return { startDate: null, endDate: null };
        }
        const now = new Date();
        if (datePreset === "today") {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            return { startDate: start.toISOString(), endDate: end.toISOString() };
        }
        if (datePreset === "yesterday") {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
            const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
            return { startDate: start.toISOString(), endDate: end.toISOString() };
        }
        if (datePreset === "7d") {
            const start = new Date(now);
            start.setDate(start.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            return { startDate: start.toISOString(), endDate: end.toISOString() };
        }
        if (datePreset === "30d") {
            const start = new Date(now);
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            return { startDate: start.toISOString(), endDate: end.toISOString() };
        }
        if (datePreset === "custom") {
            if (!customStartDate && !customEndDate) {
                return { startDate: null, endDate: null };
            }
            const start = customStartDate
                ? new Date(`${customStartDate}T00:00:00.000`).toISOString()
                : null;
            const end = customEndDate
                ? new Date(`${customEndDate}T23:59:59.999`).toISOString()
                : null;
            return { startDate: start, endDate: end };
        }
        return { startDate: null, endDate: null };
    }, [datePreset, customStartDate, customEndDate]);

    // Data Fetching
    const fetchAuditLogs = useCallback(
        async (targetPage = 1, isManualRefresh = false) => {
            if (!restaurantId) return;

            if (isManualRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setErrorState(null);

            try {
                // Strict backend API contract: only send supported parameters if they have truthy values
                const params = {
                    page: targetPage,
                    limit: pagination.limit,
                };

                if (severity) params.severity = severity;
                if (status) params.status = status;
                if (action) params.action = action;
                if (entity) params.entity = entity;
                if (branchId) params.branchId = Number(branchId);
                if (computedDates.startDate) params.startDate = computedDates.startDate;
                if (computedDates.endDate) params.endDate = computedDates.endDate;

                const res = await api.get(`/owner/${restaurantId}/audit-logs`, { params });

                if (res.data) {
                    setLogs(res.data.logs || []);
                    if (res.data.pagination) {
                        setPagination((prev) => ({
                            ...prev,
                            total: res.data.pagination.total ?? 0,
                            page: res.data.pagination.page ?? targetPage,
                            limit: res.data.pagination.limit ?? prev.limit,
                            totalPages: res.data.pagination.totalPages ?? 1,
                        }));
                    }
                }
            } catch (err) {
                const status = err?.response?.status;
                if (status === 403) {
                    setErrorState({
                        type: "403",
                        message: "You do not have sufficient permissions to view Security Audit Logs.",
                    });
                } else {
                    setErrorState({
                        type: "error",
                        message: "Failed to load audit logs. Please check your connection or retry.",
                    });
                }
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [
            restaurantId,
            pagination.limit,
            severity,
            status,
            action,
            entity,
            branchId,
            computedDates,
        ]
    );

    // Initial and filter-change fetch (resets to page 1)
    useEffect(() => {
        fetchAuditLogs(1, false);
    }, [
        restaurantId,
        severity,
        status,
        action,
        entity,
        branchId,
        computedDates,
        pagination.limit,
    ]);

    // Manual Refresh
    const handleRefresh = () => {
        if (loading || refreshing) return;
        fetchAuditLogs(pagination.page, true);
    };

    // Reset All Filters
    const handleResetFilters = () => {
        setSeverity("");
        setStatus("");
        setAction("");
        setEntity("");
        setBranchId("");
        setDatePreset("all");
        setCustomStartDate("");
        setCustomEndDate("");
    };

    // Pagination handlers
    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return;
        fetchAuditLogs(newPage, false);
    };

    const handleLimitChange = (e) => {
        const nextLimit = Number(e.target.value);
        setPagination((prev) => ({ ...prev, limit: nextLimit, page: 1 }));
    };

    // Client-side Safe CSV Export
    const handleExportCSV = () => {
        if (!logs || logs.length === 0) return;

        const headers = [
            "Timestamp",
            "Severity",
            "Status",
            "Action",
            "Actor",
            "Role",
            "Entity",
            "Entity ID",
            "Branch",
            "IP Address",
            "User Agent",
            "Details",
        ];

        const rows = logs.map((log) => {
            const cleanDetails = sanitizeDetailsFrontend(log.details || {});
            return [
                escapeCsvCell(log.createdAt ? new Date(log.createdAt).toISOString() : ""),
                escapeCsvCell(log.severity || ""),
                escapeCsvCell(log.status || ""),
                escapeCsvCell(formatActionLabel(log.action)),
                escapeCsvCell(log.actorName || ""),
                escapeCsvCell(log.actorRole || ""),
                escapeCsvCell(log.entity || ""),
                escapeCsvCell(log.entityId || ""),
                escapeCsvCell(
                    log.branchId !== null && log.branchId !== undefined ? log.branchId : ""
                ),
                escapeCsvCell(log.ipAddress || ""),
                escapeCsvCell(log.userAgent || ""),
                escapeCsvCell(cleanDetails ? JSON.stringify(cleanDetails) : ""),
            ].join(",");
        });

        const csvContent = [headers.map(escapeCsvCell).join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `tiffzy_security_audit_logs_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleViewDetails = (log) => {
        setSelectedLog(log);
        setDrawerOpen(true);
    };

    // Pagination math
    const startRecord =
        pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const endRecord = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* HEADER CONSOLE BAR */}
            <header className="pb-3 border-b border-[color:var(--app-border)]/50 space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--app-text)]">
                                    Audit Logs
                                </h1>
                                <span className="inline-flex items-center rounded-md bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400 border border-orange-500/20">
                                    SECURITY CONSOLE
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            Security and administrative activity across your restaurant.
                        </p>
                    </div>

                    {/* TOP ACTION BUTTONS */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={loading || refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw
                                size={13}
                                className={refreshing ? "animate-spin text-orange-500" : "text-neutral-500"}
                            />
                            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportCSV}
                            disabled={loading || logs.length === 0}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                            <Download size={13} className="text-emerald-500" />
                            <span>Export CSV</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* FILTER TOOLBAR */}
            <div className="p-3 rounded-xl border border-[color:var(--app-border)]/60 bg-[color:var(--app-surface)] shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        <Filter size={13} className="text-orange-500" />
                        <span>Filter Security Events</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                    >
                        <RotateCcw size={11} />
                        <span>Reset Filters</span>
                    </button>
                </div>

                {/* Filter Controls Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    {/* Severity Filter */}
                    <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            Severity
                        </label>
                        <select
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value)}
                            aria-label="Filter by Severity"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs py-1.5 px-2.5 focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                            {SEVERITY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            Status
                        </label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            aria-label="Filter by Status"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs py-1.5 px-2.5 focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                            {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Action Filter */}
                    <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            Action
                        </label>
                        <select
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            aria-label="Filter by Action"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs py-1.5 px-2.5 focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                            <option value="">All Actions</option>
                            {ACTION_GROUPS.map((group) => (
                                <optgroup key={group.label} label={group.label}>
                                    {group.options.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* Entity Filter */}
                    <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            Entity
                        </label>
                        <select
                            value={entity}
                            onChange={(e) => setEntity(e.target.value)}
                            aria-label="Filter by Entity"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs py-1.5 px-2.5 focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                            {ENTITY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Branch Filter */}
                    <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            Branch
                        </label>
                        <select
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            aria-label="Filter by Branch"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs py-1.5 px-2.5 focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                            <option value="">All Branches</option>
                            <option value="1">Branch #1</option>
                            <option value="2">Branch #2</option>
                            <option value="3">Branch #3</option>
                        </select>
                    </div>

                    {/* Date Range Preset */}
                    <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            Date Range
                        </label>
                        <select
                            value={datePreset}
                            onChange={(e) => setDatePreset(e.target.value)}
                            aria-label="Filter by Date Range"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs py-1.5 px-2.5 focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                            {DATE_PRESETS.map((p) => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Custom Date Inputs if Custom Range selected */}
                {datePreset === "custom" && (
                    <div className="pt-2 border-t border-neutral-200/50 dark:border-neutral-800/50 flex flex-wrap items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-neutral-500 font-medium">Start:</span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                aria-label="Custom Start Date"
                                className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1 text-xs"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-neutral-500 font-medium">End:</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                aria-label="Custom End Date"
                                className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1 text-xs"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 403 FORBIDDEN STATE */}
            {errorState?.type === "403" && (
                <div
                    role="alert"
                    className="p-6 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center space-y-2"
                >
                    <div className="w-10 h-10 mx-auto rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <Lock className="w-5 h-5" />
                    </div>
                    <h2 className="text-base font-bold text-rose-700 dark:text-rose-400">
                        Access Restricted
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
                        {errorState.message}
                    </p>
                </div>
            )}

            {/* 500 / NETWORK ERROR STATE */}
            {errorState?.type === "error" && (
                <div
                    role="alert"
                    className="p-6 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center space-y-3"
                >
                    <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-base font-bold text-amber-700 dark:text-amber-400">
                            Failed to Load Audit Logs
                        </h2>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
                            {errorState.message}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchAuditLogs(pagination.page, false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs"
                    >
                        <RefreshCw size={12} />
                        <span>Retry</span>
                    </button>
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            {!errorState && (
                <div className="rounded-xl border border-[color:var(--app-border)]/60 bg-[color:var(--app-surface)] shadow-xs overflow-hidden">
                    {/* TABLE */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-[color:var(--app-border)]/60 bg-neutral-50/75 dark:bg-neutral-900/75 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                    <th className="py-2.5 px-3 whitespace-nowrap">Timestamp</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">Severity</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">Action</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">Actor</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">Role</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">Entity</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">Branch</th>
                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[color:var(--app-border)]/40 text-neutral-800 dark:text-neutral-200">
                                {/* LOADING SKELETON STATE */}
                                {loading ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <tr key={`skeleton-${i}`} className="animate-pulse">
                                            <td className="py-3 px-3">
                                                <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-28" />
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-md w-12" />
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-md w-14" />
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-36" />
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-24" />
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-16" />
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-14" />
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-12" />
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-16 ml-auto" />
                                            </td>
                                        </tr>
                                    ))
                                ) : logs.length === 0 ? (
                                    /* EMPTY STATE */
                                    <tr>
                                        <td colSpan={9} className="py-12 px-4 text-center">
                                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center">
                                                <ShieldCheck className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                                No security audit events recorded for the selected criteria.
                                            </h3>
                                            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                                                Adjust your filters, clear date restrictions, or refresh to see activity.
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    /* AUDIT LOG ROWS (Newest First) */
                                    logs.map((log) => {
                                        const formattedTime = log.createdAt
                                            ? new Date(log.createdAt).toLocaleString(undefined, {
                                                  dateStyle: "short",
                                                  timeStyle: "short",
                                              })
                                            : "N/A";

                                        return (
                                            <tr
                                                key={log.id}
                                                className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                                            >
                                                {/* Timestamp */}
                                                <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                                    {formattedTime}
                                                </td>

                                                {/* Severity */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getSeverityBadgeClass(
                                                            log.severity
                                                        )}`}
                                                    >
                                                        {log.severity || "INFO"}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadgeClass(
                                                            log.status
                                                        )}`}
                                                    >
                                                        {log.status || "SUCCESS"}
                                                    </span>
                                                </td>

                                                {/* Action */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <div className="font-semibold text-neutral-900 dark:text-white">
                                                        {formatActionLabel(log.action)}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-neutral-500">
                                                        {log.action}
                                                    </div>
                                                </td>

                                                {/* Actor */}
                                                <td className="py-2.5 px-3 whitespace-nowrap font-medium text-neutral-800 dark:text-neutral-200">
                                                    {log.actorName || "System"}
                                                </td>

                                                {/* Role */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                                        {log.actorRole || "SYSTEM"}
                                                    </span>
                                                </td>

                                                {/* Entity */}
                                                <td className="py-2.5 px-3 whitespace-nowrap text-neutral-600 dark:text-neutral-400 font-mono text-[11px]">
                                                    {log.entity || "N/A"}
                                                    {log.entityId ? ` #${log.entityId}` : ""}
                                                </td>

                                                {/* Branch */}
                                                <td className="py-2.5 px-3 whitespace-nowrap text-neutral-500 dark:text-neutral-400 text-[11px]">
                                                    {log.branchId !== null && log.branchId !== undefined
                                                        ? `#${log.branchId}`
                                                        : "All / Main"}
                                                </td>

                                                {/* Details Action Button */}
                                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(log)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={12} />
                                                        <span>View Details</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINATION TOOLBAR */}
                    {!loading && logs.length > 0 && (
                        <div className="p-3 border-t border-[color:var(--app-border)]/60 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400">
                            {/* Record Count */}
                            <div>
                                Showing <span className="font-semibold text-neutral-900 dark:text-white">{startRecord}</span>–
                                <span className="font-semibold text-neutral-900 dark:text-white">{endRecord}</span> of{" "}
                                <span className="font-semibold text-neutral-900 dark:text-white">{pagination.total}</span> events
                            </div>

                            {/* Page Controls & Size */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px]">Page Size:</span>
                                    <select
                                        value={pagination.limit}
                                        onChange={handleLimitChange}
                                        aria-label="Items per page"
                                        className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md py-1 px-2 text-xs"
                                    >
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                        <option value="100">100</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(pagination.page - 1)}
                                        disabled={pagination.page <= 1}
                                        aria-label="Previous Page"
                                        className="p-1 rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <ChevronLeft size={15} />
                                    </button>
                                    <span className="px-2 text-xs font-medium">
                                        Page {pagination.page} of {pagination.totalPages || 1}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(pagination.page + 1)}
                                        disabled={pagination.page >= pagination.totalPages}
                                        aria-label="Next Page"
                                        className="p-1 rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <ChevronRight size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* DETAIL SLIDE-OVER DRAWER */}
            <SecurityActivityDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                log={selectedLog}
            />
        </section>
    );
}
