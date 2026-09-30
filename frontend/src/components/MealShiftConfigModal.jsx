import { useState } from "react";
import { Clock, LoaderCircle, Settings2, X } from "lucide-react";
import axios from "axios";
import { API } from "../config";
import { showToast } from "../utils/toast";

export default function MealShiftConfigModal({
    isOpen,
    onClose,
    restaurantId,
    initialShifts = {},
    onSaved,
}) {
    if (!isOpen) return null;

    const [breakfastStart, setBreakfastStart] = useState(initialShifts?.breakfast?.start || "07:00");
    const [breakfastEnd, setBreakfastEnd] = useState(initialShifts?.breakfast?.end || "11:30");
    const [lunchStart, setLunchStart] = useState(initialShifts?.lunch?.start || "11:30");
    const [lunchEnd, setLunchEnd] = useState(initialShifts?.lunch?.end || "16:00");
    const [dinnerStart, setDinnerStart] = useState(initialShifts?.dinner?.start || "16:00");
    const [dinnerEnd, setDinnerEnd] = useState(initialShifts?.dinner?.end || "23:00");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const rid = restaurantId || 1;
            const res = await axios.put(`${API}/owner/${rid}/settings/shifts`, {
                breakfastStart,
                breakfastEnd,
                lunchStart,
                lunchEnd,
                dinnerStart,
                dinnerEnd,
            });

            if (res.data?.success) {
                showToast({
                    title: "Shift Timings Saved",
                    message: "Meal shift hours updated successfully.",
                    variant: "success",
                });
                if (onSaved) onSaved(res.data.shifts);
                onClose();
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || "Failed to update shift timings.";
            showToast({ title: "Error", message: errMsg, variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2.5">
                        <div className="rounded-xl bg-orange-500/10 p-2 text-orange-500 border border-orange-500/20">
                            <Settings2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold tracking-tight">Configure Meal Shifts</h3>
                            <p className="text-[11px] theme-muted">Set start & end times for Breakfast, Lunch, Dinner filters</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                    {/* Breakfast Shift */}
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                        <h4 className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> 🍳 Breakfast Shift
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[11px] font-medium mb-1">Start Time</label>
                                <input
                                    type="time"
                                    value={breakfastStart}
                                    onChange={(e) => setBreakfastStart(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium mb-1">End Time</label>
                                <input
                                    type="time"
                                    value={breakfastEnd}
                                    onChange={(e) => setBreakfastEnd(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Lunch Shift */}
                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
                        <h4 className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> 🍱 Lunch Shift
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[11px] font-medium mb-1">Start Time</label>
                                <input
                                    type="time"
                                    value={lunchStart}
                                    onChange={(e) => setLunchStart(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium mb-1">End Time</label>
                                <input
                                    type="time"
                                    value={lunchEnd}
                                    onChange={(e) => setLunchEnd(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Dinner Shift */}
                    <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
                        <h4 className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> 🕯️ Dinner Shift
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[11px] font-medium mb-1">Start Time</label>
                                <input
                                    type="time"
                                    value={dinnerStart}
                                    onChange={(e) => setDinnerStart(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium mb-1">End Time</label>
                                <input
                                    type="time"
                                    value={dinnerEnd}
                                    onChange={(e) => setDinnerEnd(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                        <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold theme-muted hover:bg-slate-100 dark:hover:bg-slate-800">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition flex items-center gap-1.5"
                        >
                            {submitting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                            Save Shift Timings
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
