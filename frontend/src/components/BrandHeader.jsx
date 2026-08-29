import { useState } from "react";
import brandLogo from "../assets/tiffzy-logo.png";
import fallbackLogo from "../assets/brand-logo.png";

export default function BrandHeader({
  size = "md",
  showText = true,
  className = "",
  textClassName = "",
  onClick = null,
} = {}) {
  const [useFallback, setUseFallback] = useState(false);

  const sizeStyles = {
    sm: {
      box: "h-9 w-9 rounded-xl p-1.5",
      img: "h-6 w-6",
      text: "text-lg tracking-[0.35em]",
      gap: "gap-2.5",
    },
    md: {
      box: "h-11 w-11 sm:h-12 sm:w-12 rounded-[20px] p-2",
      img: "h-7 w-7 sm:h-8 sm:w-8",
      text: "text-xl sm:text-2xl tracking-[0.4em]",
      gap: "gap-3 sm:gap-3.5",
    },
    lg: {
      box: "h-14 w-14 sm:h-16 sm:w-16 rounded-[24px] p-2.5",
      img: "h-9 w-9 sm:h-10 sm:w-10",
      text: "text-2xl sm:text-3xl tracking-[0.45em]",
      gap: "gap-3.5 sm:gap-4",
    },
  };

  const current = sizeStyles[size] || sizeStyles.md;

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${current.gap} ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {/* Rounded square container matching Image 2 */}
      <div className={`${current.box} flex shrink-0 items-center justify-center border border-[#eadace] bg-[#faf6f0] shadow-sm transition hover:border-[#dfcebe]`}>
        <img
          src={useFallback ? fallbackLogo : brandLogo}
          alt="Tiffzy"
          className={`${current.img} object-contain`}
          loading="eager"
          decoding="async"
          onError={() => setUseFallback(true)}
        />
      </div>

      {/* TIFFZY wordmark matching Image 2 */}
      {showText && (
        <span
          className={`font-black uppercase bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#b45309] bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] ${current.text} ${textClassName}`}
        >
          TIFFZY
        </span>
      )}
    </div>
  );
}
