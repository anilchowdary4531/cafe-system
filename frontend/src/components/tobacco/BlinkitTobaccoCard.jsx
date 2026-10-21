import React from "react";
import { Plus, Minus } from "lucide-react";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

export default function BlinkitTobaccoCard({
    item,
    quantity = 0,
    onAdd,
    onRemove,
}) {
    const name = item?.name || "Cigarette Pack";
    const price = Number(item?.price || 0);
    const packSize = item?.packSize || (name.includes("20 pcs") || name.includes("Pack of 20") ? "20 pcs" : "10 pcs");
    const imageSrc = resolveImageUrl(item?.image) || "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17";

    return (
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white dark:bg-zinc-900/90 dark:border-zinc-800 p-3 shadow-xs transition duration-200 hover:shadow-md hover:border-orange-300">
            {/* Product Image */}
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-2 flex items-center justify-center">
                <span className="absolute top-1.5 right-1.5 z-10 rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-700 dark:text-amber-400">
                    18+
                </span>

                <img
                    src={imageSrc}
                    alt={name}
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17";
                    }}
                />
            </div>

            {/* Product Details */}
            <div className="mt-2.5 space-y-1 text-left flex-1 flex flex-col justify-between">
                <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                        {name}
                    </h4>
                    <span className="inline-block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {packSize}
                    </span>
                </div>

                {/* Bottom Row: Price + ADD Button */}
                <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
                    <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                        ₹{price}
                    </span>

                    {quantity > 0 ? (
                        <div className="flex items-center gap-1.5 rounded-xl bg-orange-500 p-1 text-white font-bold text-xs shadow-xs">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove && onRemove(item);
                                }}
                                aria-label="Decrease quantity"
                                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-orange-600 active:scale-95"
                            >
                                <Minus size={12} />
                            </button>
                            <span className="px-1 tabular-nums">{quantity}</span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAdd && onAdd(item);
                                }}
                                aria-label="Increase quantity"
                                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-orange-600 active:scale-95"
                            >
                                <Plus size={12} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAdd && onAdd(item);
                            }}
                            className="rounded-xl border border-orange-500 bg-orange-50 hover:bg-orange-500 hover:text-white px-3.5 py-1.5 text-xs font-bold text-orange-600 shadow-2xs transition active:scale-95"
                        >
                            + ADD
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
