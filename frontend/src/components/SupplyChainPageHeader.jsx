import React from "react";
import OwnerMenuButton from "./OwnerMenuButton";

export default function SupplyChainPageHeader({
    title,
    subtitle,
    actions,
    badge,
    onMenuClick,
    className = ""
}) {
    return (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 mb-5 ${className}`}>
            <div className="flex items-start gap-3 min-w-0">
                <OwnerMenuButton onClick={onMenuClick} className="mt-0.5" />
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
                            {title}
                        </h1>
                        {badge && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                                {badge}
                            </span>
                        )}
                    </div>
                    {subtitle && (
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-2.5 flex-wrap shrink-0 self-start sm:self-auto">
                    {actions}
                </div>
            )}
        </div>
    );
}
