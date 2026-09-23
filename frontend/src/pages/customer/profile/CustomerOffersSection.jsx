import { useState } from "react";
import { Gift, Copy, Check, Tag } from "lucide-react";
import useCachedGet from "../../../hooks/useCachedGet";

export default function CustomerOffersSection() {
    const [copiedCode, setCopiedCode] = useState("");
    const { data, loading, error } = useCachedGet("/customer/promotions", {
        ttlMs: 30_000,
    });

    const promotions = Array.isArray(data?.promotions) ? data.promotions : [];

    const handleCopy = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(""), 2500);
    };

    return (
        <div className="space-y-6">
            <header className="theme-panel rounded-3xl p-6">
                <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.26em]">Promotions & Offers</p>
                <h1 className="mt-1 text-2xl font-bold md:text-3xl">Available Coupons</h1>
                <p className="theme-muted mt-2 text-sm">Use these promo codes at checkout for instant discounts on your order.</p>
            </header>

            {loading ? (
                <div className="py-12 text-center text-sm theme-muted">Loading available offers...</div>
            ) : error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">{error}</div>
            ) : !promotions.length ? (
                <div className="theme-panel rounded-3xl p-8 text-center text-sm theme-muted">
                    No active offers available right now. Check back soon!
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {promotions.map((promo) => (
                        <div key={promo.id} className="theme-panel flex flex-col justify-between rounded-3xl p-5 border border-white/10">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                                        <Tag size={13} />
                                        {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`}
                                    </span>
                                    {promo.expiresAt && (
                                        <span className="theme-muted text-[11px]">
                                            Expires {new Date(promo.expiresAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                <h3 className="mt-3 text-lg font-bold">{promo.title || promo.code}</h3>
                                {promo.description && <p className="theme-muted mt-1 text-xs">{promo.description}</p>}

                                <div className="mt-3 text-xs theme-muted space-y-1">
                                    {promo.minOrderAmount > 0 && <p>• Min order: ₹{promo.minOrderAmount}</p>}
                                    {promo.maxDiscountAmount > 0 && <p>• Max discount: ₹{promo.maxDiscountAmount}</p>}
                                </div>
                            </div>

                            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 font-mono text-sm font-extrabold text-amber-300 tracking-wider">
                                    {promo.code}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(promo.code)}
                                    className="theme-button inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
                                >
                                    {copiedCode === promo.code ? (
                                        <>
                                            <Check size={14} className="text-emerald-400" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={14} />
                                            Copy Code
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
