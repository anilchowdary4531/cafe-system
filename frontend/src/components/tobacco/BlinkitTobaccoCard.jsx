import React from "react";
import { Clock, Plus, Minus } from "lucide-react";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

export default function BlinkitTobaccoCard({
    item,
    quantity = 0,
    onAdd,
    onRemove,
}) {
    const name = item?.name || "Cigarette Pack";
    const price = Number(item?.price || 0);
    const packSize = item?.packSize || (name.includes("20 pcs") ? "20 pcs" : "10 pcs");
    const imageSrc = resolveImageUrl(item?.image) || "https://images.unsplash.com/photo-1527076580004-984e7a8e7e17";

    return (
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-rose-100 bg-[#fff5f5] dark:bg-zinc-900/90 dark:border-zinc-800 p-3.5 shadow-sm transition duration-200 hover:shadow-md hover:-translate-y-0.5">
            {/* Cigarette Pack Image */}
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white p-3 flex items-center justify-center shadow-inner">
                {/* 15 MINS Badge */}
                <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-zinc-100/90 dark:bg-zinc-800/90 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 backdrop-blur-xs">
                    <Clock size={10} className="text-emerald-600" />
                    <span>15 MINS</span>
                </div>

                <img
                    src={imageSrc}
                    alt={name}
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                    loading="lazy"
                />

                {/* Cigarette Pack Box Graphic Overlay if fallback */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div className="relative h-24 w-16 rounded-md bg-white p-1.5 shadow-md border border-zinc-200 flex flex-col justify-between text-center">
                        <div className="h-3 w-full bg-red-600 rounded-t-xs" />
                        <div className="my-auto space-y-0.5">
                            <span className="block text-[7px] font-black text-zinc-900 truncate uppercase">
                                {name.split(" ")[0] || "SMOKE"}
                            </span>
                            <div className="mx-auto h-0.5 w-6 bg-amber-600" />
                            <span className="block text-[5px] font-bold text-red-600 uppercase leading-tight">
                                Tobacco causes painful death
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product Details */}
            <div className="mt-3 space-y-1 text-left flex-1 flex flex-col justify-between">
                <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">
                        {name}
                    </h4>
                    <span className="inline-block mt-0.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                        {packSize}
                    </span>
                </div>

                {/* Bottom Row: Price + ADD Button */}
                <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-sm sm:text-base font-black text-zinc-950 dark:text-white">
                        ₹{price}
                    </span>

                    {quantity > 0 ? (
                        <div className="flex items-center gap-2 rounded-xl bg-emerald-700 p-1 text-white font-bold text-xs shadow-md">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove && onRemove(item);
                                }}
                                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-emerald-800 active:scale-95"
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
                                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-emerald-800 active:scale-95"
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
                            className="rounded-xl border-2 border-emerald-600 bg-white hover:bg-emerald-600 hover:text-white px-4 py-1.5 text-xs font-black text-emerald-700 shadow-sm transition active:scale-95"
                        >
                            ADD
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
