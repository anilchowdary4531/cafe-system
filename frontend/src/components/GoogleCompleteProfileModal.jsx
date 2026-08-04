import React, { useState } from "react";
import { User, Phone, X, Sparkles, CheckCircle2 } from "lucide-react";

export default function GoogleCompleteProfileModal({
    isOpen,
    initialData = {},
    onSubmit,
    onClose,
    loading = false,
}) {
    if (!isOpen) return null;

    const [name, setName] = useState(initialData.name || "");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        setError("");

        const trimmedName = name.trim();
        const cleanedPhone = phone.replace(/\D/g, "");

        if (!trimmedName) {
            setError("Please enter your full name.");
            return;
        }

        if (cleanedPhone.length !== 10) {
            setError("Please enter a valid 10-digit mobile phone number.");
            return;
        }

        onSubmit({
            ...initialData,
            name: trimmedName,
            phone: cleanedPhone,
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-black/10 dark:border-white/15">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 font-bold">
                        <User size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Complete Your Profile</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Please provide your name & mobile number to finish signing in.
                        </p>
                    </div>
                </div>

                {initialData.email && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 p-3 border border-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {initialData.picture ? (
                            <img
                                src={initialData.picture}
                                alt="Google Avatar"
                                className="h-6 w-6 rounded-full object-cover border border-amber-500/30"
                            />
                        ) : (
                            <CheckCircle2 size={16} />
                        )}
                        <span>Google Email: {initialData.email}</span>
                    </div>
                )}

                {error && (
                    <div className="mb-4 rounded-xl bg-rose-500/10 p-3 border border-rose-500/20 text-xs font-semibold text-rose-500">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                            Full Name *
                        </label>
                        <div className="relative">
                            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your full name"
                                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:text-white transition"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                            Mobile Phone Number *
                        </label>
                        <div className="relative">
                            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="10-digit mobile number"
                                maxLength={10}
                                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:text-white transition"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="w-1/3 rounded-xl border border-gray-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-2/3 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 text-sm shadow-md transition disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <Sparkles size={16} className="animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>Complete Sign-In</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
