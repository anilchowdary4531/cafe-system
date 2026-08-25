import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import useCachedGet from "../hooks/useCachedGet";
import { resolveImageUrl } from "../utils/resolveImageUrl";

const FALLBACK_BANNER_IMAGE = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";

export default function PromoBannerSlider({ className = "" }) {
    const navigate = useNavigate();
    const { data: bannersData } = useCachedGet("/banners", {
        ttlMs: 15_000,
        staleMs: 60_000,
    });

    const banners = Array.isArray(bannersData)
        ? bannersData.filter((b) => b?.isActive !== false)
        : Array.isArray(bannersData?.banners)
        ? bannersData.banners.filter((b) => b?.isActive !== false)
        : [];

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (banners.length <= 1) return undefined;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % banners.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [banners.length]);

    const handleBannerClick = (actionUrl) => {
        if (!actionUrl) return;
        const cleanUrl = String(actionUrl).trim();
        if (cleanUrl.startsWith("/")) {
            navigate(cleanUrl);
        } else if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
            window.open(cleanUrl, "_blank", "noopener,noreferrer");
        } else {
            navigate(`/${cleanUrl}`);
        }
    };

    if (banners.length === 0) {
        return (
            <div className={`relative overflow-hidden rounded-[24px] border border-[var(--app-border)] bg-[linear-gradient(135deg,#ff8a1f_0%,#e05600_50%,#8a2e00_100%)] p-5 text-white shadow-lg sm:p-6 md:p-8 ${className}`}>
                <div className="pointer-events-none absolute -right-10 -top-10 h-60 w-60 rounded-full bg-white/10 blur-2xl" />
                <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="max-w-xl space-y-2">
                        <span className="inline-flex items-center rounded-full bg-black/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200 backdrop-blur-md">
                            Special Offer
                        </span>
                        <h2 className="text-2xl font-black leading-tight sm:text-3xl md:text-4xl">
                            Tasty Food Delivered Fast
                        </h2>
                        <p className="text-xs text-white/85 sm:text-sm md:text-base">
                            Order now from top local kitchens and enjoy fresh meals delivered straight to your door!
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleBannerClick("/r/starbucks/menu")}
                        className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-xs font-bold text-white shadow-xl transition hover:bg-zinc-900 active:scale-95 sm:text-sm"
                    >
                        <span>Order Now</span>
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        );
    }

    const currentBanner = banners[currentIndex] || banners[0];
    const imageSrc = resolveImageUrl(currentBanner?.imageUrl) || FALLBACK_BANNER_IMAGE;

    return (
        <div className={`group relative overflow-hidden rounded-[24px] border border-[var(--app-border)] bg-black/40 shadow-xl ${className}`}>
            <div
                role="button"
                tabIndex={0}
                onClick={() => handleBannerClick(currentBanner?.actionUrl)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleBannerClick(currentBanner?.actionUrl);
                    }
                }}
                className="relative aspect-[21/9] min-h-[140px] max-h-[220px] w-full cursor-pointer overflow-hidden sm:min-h-[160px] md:min-h-[180px]"
            >
                <img
                    src={imageSrc}
                    alt={currentBanner?.title || "Promotion banner"}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.75)_100%)]" />

                {currentBanner?.title ? (
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 md:p-6">
                        <span className="inline-flex rounded-md bg-black/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300 backdrop-blur-md">
                            Featured
                        </span>
                        <h3 className="mt-1 text-lg font-black text-white sm:text-xl md:text-2xl drop-shadow-md">
                            {currentBanner.title}
                        </h3>
                    </div>
                ) : null}
            </div>

            {banners.length > 1 ? (
                <>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70"
                        aria-label="Previous banner"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setCurrentIndex((prev) => (prev + 1) % banners.length);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70"
                        aria-label="Next banner"
                    >
                        <ChevronRight size={18} />
                    </button>

                    <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-2 py-1 backdrop-blur-sm">
                        {banners.map((b, idx) => (
                            <button
                                key={b.id || idx}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentIndex(idx);
                                }}
                                className={`h-1.5 rounded-full transition-all ${
                                    currentIndex === idx ? "w-5 bg-[color:var(--app-accent)]" : "w-1.5 bg-white/40 hover:bg-white/70"
                                }`}
                                aria-label={`Go to slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}
