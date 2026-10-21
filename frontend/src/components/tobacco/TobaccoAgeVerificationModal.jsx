import React from "react";

export default function TobaccoAgeVerificationModal({
    isOpen,
    onConfirm,
    onCancel,
}) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="age-verification-title"
        >
            <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 sm:p-8 text-center text-zinc-900 shadow-2xl animate-in zoom-in-95 duration-200 space-y-5 border border-orange-100">
                {/* 18+ Badge */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 border-2 border-orange-500 shadow-inner">
                    <span className="text-2xl font-black tracking-tight text-orange-600">
                        18+
                    </span>
                </div>

                {/* Title */}
                <div className="space-y-2">
                    <h3
                        id="age-verification-title"
                        className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight"
                    >
                        Age Verification
                    </h3>
                    <p className="text-xs sm:text-sm font-medium leading-relaxed text-zinc-600 px-2">
                        Tobacco products are available only to customers who meet the applicable legal age requirement.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-2">
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="w-full rounded-2xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 py-3.5 px-4 text-sm font-bold text-white shadow-md shadow-orange-500/25 transition active:scale-98"
                    >
                        I am 18 or older
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 active:bg-zinc-200 py-3 px-4 text-sm font-semibold text-zinc-700 transition active:scale-98"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
