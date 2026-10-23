import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    LayoutDashboard,
    Utensils,
    Receipt,
    ChefHat,
    Sparkles,
    BarChart3,
    Clock,
    Shield,
    CheckCircle2,
    Lock,
    ExternalLink,
} from "lucide-react";
import StaffShell from "../../components/StaffShell";
import { useAuth } from "../../context/AuthContext";

export default function CustomWorkspace() {
    const { user } = useAuth();

    const access = user?.access || {};
    const designation = user?.designation || "STAFF";

    const capabilities = [
        {
            key: "tables",
            title: "Tables & Floor Plan",
            desc: "View dining tables and floor plan layout",
            icon: Utensils,
            path: "/server",
            enabled: Boolean(access.tables),
        },
        {
            key: "billing",
            title: "Billing & Cashier Desk",
            desc: "Process payments and manage bills",
            icon: Receipt,
            path: "/staff/cashier",
            enabled: Boolean(access.billing),
        },
        {
            key: "kitchen",
            title: "Kitchen Station",
            desc: "View active KOTs and food prep queues",
            icon: ChefHat,
            path: "/kitchen",
            enabled: Boolean(access.kitchen),
        },
        {
            key: "reports",
            title: "Analytics & Reports",
            desc: "View shift summaries and sales reporting",
            icon: BarChart3,
            path: "/owner/reports",
            enabled: Boolean(access.reports),
        },
        {
            key: "shifts",
            title: "Shifts & Scheduling",
            desc: "View duty schedules and shift roster",
            icon: Clock,
            path: "/owner/shifts",
            enabled: Boolean(access.shifts),
        },
    ];

    const enabledCaps = capabilities.filter((c) => c.enabled);

    return (
        <StaffShell title="Custom Staff Workspace" designation={designation}>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Welcome Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center font-bold text-xl">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Welcome, {user?.name || "Staff Member"}</h2>
                            <p className="text-xs text-neutral-400">
                                Assigned Designation: <span className="text-orange-400 font-semibold">{designation}</span>
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
                        Your workspace features are dynamically governed by the custom permissions configured by the restaurant owner.
                    </p>
                </div>

                {/* Permitted Modules Grid */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Authorized Workspaces ({enabledCaps.length})
                    </h3>

                    {enabledCaps.length === 0 ? (
                        <div className="p-12 text-center bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-2">
                            <Lock className="w-12 h-12 text-neutral-600 mx-auto mb-2" />
                            <h4 className="font-bold text-white text-base">Limited Staff Permissions</h4>
                            <p className="text-xs text-neutral-400 max-w-md mx-auto">
                                You do not currently have operational modules enabled. Please contact your restaurant manager or owner to update your staff permissions.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {enabledCaps.map((c) => {
                                const Icon = c.icon;
                                return (
                                    <Link
                                        key={c.key}
                                        to={c.path}
                                        className="bg-neutral-900 border border-neutral-800 hover:border-orange-500/60 rounded-2xl p-5 shadow-md transition group flex flex-col justify-between gap-4"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="w-10 h-10 rounded-xl bg-neutral-800 group-hover:bg-orange-600/20 group-hover:text-orange-400 flex items-center justify-center text-neutral-300 transition">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-neutral-600 group-hover:text-orange-400 transition" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-base group-hover:text-orange-400 transition">
                                                {c.title}
                                            </h4>
                                            <p className="text-xs text-neutral-400 mt-1">{c.desc}</p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </StaffShell>
    );
}
