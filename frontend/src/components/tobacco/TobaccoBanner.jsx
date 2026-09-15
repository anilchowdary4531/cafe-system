import React from "react";
import { ChevronRight, ShieldAlert } from "lucide-react";

export default function TobaccoBanner({ onViewItems, className = "" }) {
    return (
        <div
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#fcd34d] via-[#f59e0b] to-[#d97706] p-4 sm:p-5 text-zinc-950 shadow-lg border border-amber-300/40 w-full sm:w-1/2 sm:max-w-lg ${className}`}
        >
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="max-w-md space-y-3">
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950">
                        Looking for tobacco products?
                    </h3>

                    <button
                        type="button"
                        onClick={onViewItems}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white shadow-md transition duration-200 active:scale-95"
                    >
                        <span>View items</span>
                    </button>

                    <p className="text-xs sm:text-sm font-semibold text-zinc-900/90 pt-0.5">
                        Caution: Tobacco products are injurious to health
                    </p>
                </div>

                {/* Right Cigarette Box & Lighter Illustration */}
                <div className="shrink-0 self-end sm:self-center">
                    <div className="relative flex items-center justify-center">
                        {/* Cigarette Pack Graphic */}
                        <div className="relative h-24 w-20 rounded-lg bg-white p-2 shadow-xl border border-zinc-200 -rotate-6 transform transition duration-300 hover:rotate-0">
                            <div className="h-4 w-full bg-amber-600 rounded-t-sm mb-1" />
                            <div className="space-y-1 text-center">
                                <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-800">
                                    TIFFZY
                                </span>
                                <div className="mx-auto h-0.5 w-8 bg-red-600" />
                                <span className="block text-[6px] font-bold text-red-700 uppercase">
                                    Tobacco causes painful death
                                </span>
                            </div>
                        </div>

                        {/* Lighter Graphic */}
                        <div className="relative -ml-4 h-16 w-7 rounded-md bg-emerald-700 p-1 shadow-xl border border-emerald-800 rotate-12 transform">
                            <div className="h-3 w-full bg-zinc-300 rounded-t-sm" />
                            <div className="h-1.5 w-full bg-zinc-400 mt-0.5" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
