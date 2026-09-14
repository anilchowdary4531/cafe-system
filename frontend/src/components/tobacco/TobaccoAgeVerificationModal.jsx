import React from "react";
import { Link } from "react-router-dom";

export default function TobaccoAgeVerificationModal({
    isOpen,
    onConfirm,
    onCancel,
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 sm:p-7 text-zinc-900 shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
                {/* Header Title */}
                <h3 className="text-xl font-extrabold text-zinc-900 tracking-tight">
                    Please make sure...
                </h3>

                {/* Requirements List */}
                <div className="space-y-4">
                    {/* Requirement 1 */}
                    <div className="flex items-start gap-3.5">
                        <div className="shrink-0 mt-0.5">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-red-500 text-red-500 font-bold text-xs">
                                🚫
                            </div>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold leading-relaxed text-zinc-800">
                            You are above the legal age (as applicable from time to time in your area) and not buying tobacco on behalf of anyone who doesn't qualify the legal age.
                        </p>
                    </div>

                    {/* Requirement 2 */}
                    <div className="flex items-start gap-3.5">
                        <div className="shrink-0 mt-0.5">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-red-500 text-red-500 font-bold text-xs">
                                🚫
                            </div>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold leading-relaxed text-zinc-800">
                            Your location is not in and around a school or college premises.
                        </p>
                    </div>
                </div>

                {/* Legal Disclaimer */}
                <div className="text-xs text-zinc-500 pt-1 space-y-1">
                    <p className="font-medium">
                        We are bound to report your account in case of any transgressions!
                    </p>
                    <Link
                        to="/terms"
                        target="_blank"
                        className="inline-block font-bold text-emerald-700 underline hover:text-emerald-800"
                    >
                        Read Terms & Conditions
                    </Link>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 rounded-2xl border-2 border-emerald-600 bg-white py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 rounded-2xl bg-emerald-700 hover:bg-emerald-800 py-3 text-sm font-bold text-white shadow-md transition active:scale-95"
                    >
                        Yes, I confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
