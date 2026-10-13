import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getItemImages, getItemFallbackImage } from "../utils/resolveImageUrl";

export default function ItemImageCarousel({
    item,
    className = "",
    imageClassName = "",
    alt = "Menu item",
    aspectRatio = "aspect-[16/10]",
    fallback,
    children,
}) {
    const images = getItemImages(item);
    const resolvedFallback = fallback || getItemFallbackImage(item);
    const [activeIndex, setActiveIndex] = useState(0);
    const touchStartXRef = useRef(null);
    const hasMultiple = images.length > 1;

    const safeIndex = hasMultiple && activeIndex < images.length ? activeIndex : 0;
    const currentSrc = images[safeIndex] || resolvedFallback;

    const handlePrev = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    };

    const handleTouchStart = (e) => {
        if (!hasMultiple) return;
        touchStartXRef.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
        if (!hasMultiple || touchStartXRef.current === null) return;
        const diff = e.changedTouches[0].clientX - touchStartXRef.current;
        if (diff > 25) {
            e.stopPropagation();
            setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
        } else if (diff < -25) {
            e.stopPropagation();
            setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
        }
        touchStartXRef.current = null;
    };

    return (
        <div
            className={`relative ${aspectRatio} overflow-hidden rounded-lg bg-black/5 select-none ${className}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <img
                src={currentSrc}
                alt={alt}
                className={`h-full w-full object-cover transition-transform duration-300 ${imageClassName}`}
                loading="lazy"
                onError={(e) => {
                    if (e.currentTarget.src !== resolvedFallback) {
                        e.currentTarget.src = resolvedFallback;
                    }
                }}
            />

            {/* Carousel Controls & Indicators - strictly rendered only when multiple images exist */}
            {hasMultiple && (
                <>
                    {/* Previous Button (subtle, non-intrusive) */}
                    <button
                        type="button"
                        onClick={handlePrev}
                        aria-label="Previous image"
                        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/60 text-white shadow-xs opacity-75 hover:opacity-100 hover:bg-black/85 transition active:scale-90"
                    >
                        <ChevronLeft size={11} strokeWidth={2.5} />
                    </button>

                    {/* Next Button (subtle, non-intrusive) */}
                    <button
                        type="button"
                        onClick={handleNext}
                        aria-label="Next image"
                        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/60 text-white shadow-xs opacity-75 hover:opacity-100 hover:bg-black/85 transition active:scale-90"
                    >
                        <ChevronRight size={11} strokeWidth={2.5} />
                    </button>

                    {/* Compact Image Counter: 1/3 */}
                    <div className="absolute bottom-1 left-1 z-10 rounded-full bg-black/65 px-1.5 py-0.2 text-[8px] font-bold text-white backdrop-blur-xs tracking-tight pointer-events-none">
                        {safeIndex + 1}/{images.length}
                    </div>

                    {/* Minimal Dots Indicator */}
                    <div className="absolute bottom-1 inset-x-0 z-10 flex justify-center items-center gap-0.5 pointer-events-none">
                        {images.map((_, idx) => (
                            <span
                                key={idx}
                                className={`h-1 rounded-full transition-all duration-200 ${
                                    idx === safeIndex ? "w-2.5 bg-white shadow-xs" : "w-1 bg-white/50"
                                }`}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Overlays (e.g. Favorite Heart or Rating badge) */}
            {children}
        </div>
    );
}
