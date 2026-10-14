import React, { useEffect, useState } from "react";
import {
    X,
    ShieldCheck,
    AlertTriangle,
    Clock,
    User,
    Server,
    Globe,
    FileJson,
    Copy,
    Check,
    CheckCircle2,
    XCircle,
    AlertOctagon,
    Info,
    Calendar,
    Laptop,
} from "lucide-react";

// Defensive list of sensitive credential keys to strip from any frontend display
export const SENSITIVE_KEYS = [
    "password",
    "passwordhash",
    "currentpassword",
    "newpassword",
    "temppassword",
    "temporarypassword",
    "otp",
    "otphash",
    "resettoken",
    "token",
    "jwt",
    "authorization",
    "cookie",
];

export const isSensitiveKey = (key) => {
    const lower = String(key || "").toLowerCase();
    return SENSITIVE_KEYS.some((sensitive) => lower.includes(sensitive));
};

export const sanitizeDetailsFrontend = (details) => {
    if (!details || typeof details !== "object") return details;
    if (Array.isArray(details)) {
        return details.map(sanitizeDetailsFrontend);
    }
    const clean = {};
    for (const [k, v] of Object.entries(details)) {
        if (isSensitiveKey(k)) continue;
        if (v && typeof v === "object") {
            clean[k] = sanitizeDetailsFrontend(v);
        } else {
            clean[k] = v;
        }
    }
    return clean;
};

export const ACTION_LABELS = {
    AUTH_LOGIN_SUCCESS: "Login Successful",
    AUTH_LOGIN_FAILURE: "Login Failed",
    AUTH_ACCOUNT_LOCKED: "Account Locked",
    AUTH_LOCKOUT_EXPIRED: "Lockout Expired",
    AUTH_TEMP_PASSWORD_USED: "Temporary Password Used",
    AUTH_SESSION_INVALIDATED: "Session Invalidated",
    AUTH_PASSWORD_CHANGED: "Password Changed",
    AUTH_PASSWORD_RESET_REQUESTED: "Password Reset Requested",
    AUTH_PASSWORD_RESET_COMPLETED: "Password Reset Completed",
    AUTH_FORCED_PASSWORD_CHANGE: "Forced Password Change",
    AUTH_OTP_SENT: "OTP Sent",
    AUTH_OTP_VERIFIED: "OTP Verified",
    AUTH_OTP_FAILED: "OTP Failed",
    AUTH_OTP_EXPIRED: "OTP Expired",
    STAFF_TEMP_PASSWORD_ISSUED: "Temporary Password Issued",
    STAFF_CREATED: "Staff Created",
    STAFF_UPDATED: "Staff Updated",
    STAFF_ROLE_CHANGED: "Staff Role Changed",
    STAFF_ACCESS_UPDATED: "Staff Access Updated",
    STAFF_STATUS_CHANGED: "Staff Status Changed",
    STAFF_DELETED: "Staff Deleted",
    WAITER_ASSIGNED: "Waiter Assigned",
    WAITER_UNASSIGNED: "Waiter Unassigned",
    WAITER_REASSIGNED: "Waiter Reassigned",
    ORDER_CANCELLED: "Order Cancelled",
    KOT_ITEM_CANCELLED: "KOT Item Cancelled",
    ORDER_DISCOUNT_APPLIED: "Order Discount Applied",
    SESSION_DISCOUNT_APPLIED: "Session Discount Applied",
    KOT_REPRINTED: "KOT Reprinted",
};

export const formatActionLabel = (action) => {
    if (!action) return "Unknown Action";
    return (
        ACTION_LABELS[action] ||
        action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
};

export const getSeverityBadgeClass = (severity) => {
    const s = String(severity || "INFO").toUpperCase();
    switch (s) {
        case "CRITICAL":
        case "ERROR":
            return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
        case "WARN":
            return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
        case "INFO":
        default:
            return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
};

export const getStatusBadgeClass = (status) => {
    const s = String(status || "SUCCESS").toUpperCase();
    switch (s) {
        case "SUCCESS":
            return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
        case "FAILURE":
            return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
        case "BLOCKED":
            return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
        case "EXPIRED":
            return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
        default:
            return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
    }
};

export default function SecurityActivityDrawer({ isOpen, onClose, log }) {
    const [copiedIp, setCopiedIp] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                onClose?.();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !log) return null;

    const safeDetails = sanitizeDetailsFrontend(log.details);
    const hasDetails =
        safeDetails &&
        typeof safeDetails === "object" &&
        Object.keys(safeDetails).length > 0;

    const handleCopyIp = () => {
        if (!log.ipAddress) return;
        navigator.clipboard?.writeText(log.ipAddress);
        setCopiedIp(true);
        setTimeout(() => setCopiedIp(false), 2000);
    };

    const formattedDate = log.createdAt
        ? new Date(log.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "medium",
          })
        : "N/A";

    return (
        <div
            className="fixed inset-0 z-50 overflow-hidden bg-neutral-900/40 backdrop-blur-xs flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-labelledby="security-activity-title"
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
                data-testid="drawer-backdrop"
            />

            {/* Slide-over panel */}
            <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 h-full shadow-2xl flex flex-col border-l border-neutral-200 dark:border-neutral-800 z-10">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/80 dark:bg-neutral-900/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2
                                id="security-activity-title"
                                className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2"
                            >
                                Security Activity Detail
                            </h2>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                Event #{log.id} • {formattedDate}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close drawer"
                        className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                    {/* Event summary card */}
                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                Event Action
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getSeverityBadgeClass(
                                        log.severity
                                    )}`}
                                >
                                    {log.severity || "INFO"}
                                </span>
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getStatusBadgeClass(
                                        log.status
                                    )}`}
                                >
                                    {log.status || "SUCCESS"}
                                </span>
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-bold text-neutral-900 dark:text-white">
                                {formatActionLabel(log.action)}
                            </div>
                            <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                                {log.action}
                            </div>
                        </div>
                    </div>

                    {/* Actor details */}
                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5">
                        <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-semibold border-b border-neutral-100 dark:border-neutral-800 pb-2">
                            <User className="w-4 h-4 text-neutral-500" />
                            <span>Actor Information</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <div>
                                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                                    Actor Name
                                </span>
                                <span className="font-semibold text-neutral-900 dark:text-white">
                                    {log.actorName || "System"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                                    Actor Role
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                    {log.actorRole || "SYSTEM"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                                    Actor User ID
                                </span>
                                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                                    {log.actorUserId ? `#${log.actorUserId}` : "None"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Target entity card */}
                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5">
                        <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-semibold border-b border-neutral-100 dark:border-neutral-800 pb-2">
                            <Server className="w-4 h-4 text-neutral-500" />
                            <span>Target Entity</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <div>
                                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                                    Entity
                                </span>
                                <span className="font-semibold text-neutral-900 dark:text-white">
                                    {log.entity || "N/A"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                                    Entity ID
                                </span>
                                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                                    {log.entityId || "N/A"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                                    Restaurant ID
                                </span>
                                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                                    {log.restaurantId || "Global / System"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                                    Branch ID
                                </span>
                                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                                    {log.branchId !== null && log.branchId !== undefined
                                        ? `#${log.branchId}`
                                        : "All / Main"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Network & Device Info */}
                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5">
                        <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-semibold border-b border-neutral-100 dark:border-neutral-800 pb-2">
                            <Globe className="w-4 h-4 text-neutral-500" />
                            <span>Client Environment</span>
                        </div>
                        <div className="space-y-2 pt-0.5">
                            <div>
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                        IP Address
                                    </span>
                                    {log.ipAddress && (
                                        <button
                                            type="button"
                                            onClick={handleCopyIp}
                                            className="inline-flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                                        >
                                            {copiedIp ? (
                                                <>
                                                    <Check size={11} /> Copied
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={11} /> Copy IP
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <code className="block p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-mono text-neutral-800 dark:text-neutral-200 text-[11px]">
                                    {log.ipAddress || "Not Recorded"}
                                </code>
                            </div>

                            <div>
                                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-0.5">
                                    User Agent
                                </span>
                                <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-700 dark:text-neutral-300 break-words leading-relaxed max-h-24 overflow-y-auto">
                                    {log.userAgent || "Not Recorded"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sanitized Details / Metadata */}
                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5">
                        <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-semibold border-b border-neutral-100 dark:border-neutral-800 pb-2">
                            <FileJson className="w-4 h-4 text-neutral-500" />
                            <span>Sanitized Metadata & Changes</span>
                        </div>

                        {hasDetails ? (
                            <div className="space-y-2 pt-0.5">
                                <div className="grid grid-cols-1 gap-1.5">
                                    {Object.entries(safeDetails).map(([key, value]) => {
                                        const displayVal =
                                            value === null || value === undefined
                                                ? "null"
                                                : typeof value === "object"
                                                ? JSON.stringify(value, null, 2)
                                                : String(value);

                                        const isObj = typeof value === "object" && value !== null;

                                        return (
                                            <div
                                                key={key}
                                                className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800"
                                            >
                                                <div className="text-[10px] font-mono uppercase text-neutral-500 dark:text-neutral-400 mb-0.5">
                                                    {key}
                                                </div>
                                                {isObj ? (
                                                    <pre className="text-[11px] font-mono text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded overflow-x-auto">
                                                        {displayVal}
                                                    </pre>
                                                ) : (
                                                    <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 break-words">
                                                        {displayVal}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="py-4 text-center text-neutral-400 text-xs italic">
                                No additional metadata recorded for this event.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
