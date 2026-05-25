import { useId } from "react";

export default function BrandLogo({ className = "", title = "Tiffzy logo" } = {}) {
    // Avoid SVG id collisions when multiple logos are rendered on the same page.
    const uid = useId().replace(/:/g, "");
    const ringId = `brandRing_${uid}`;
    const steamId = `brandSteam_${uid}`;
    const clocheId = `brandCloche_${uid}`;
    const handId = `brandHand_${uid}`;

    return (
        <svg
            viewBox="0 0 64 64"
            role="img"
            aria-label={title}
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id={ringId} x1="6" y1="40" x2="58" y2="24" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#e6dece" />
                    <stop offset="0.54" stopColor="#f0eadd" />
                    <stop offset="1" stopColor="#e6dece" />
                </linearGradient>
                <linearGradient id={steamId} x1="28" y1="18" x2="38" y2="18" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#f3ede2" />
                    <stop offset="1" stopColor="#e6dece" />
                </linearGradient>
                <linearGradient id={clocheId} x1="24" y1="20" x2="49" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#f3ede2" />
                    <stop offset="1" stopColor="#e6dece" />
                </linearGradient>
                <linearGradient id={handId} x1="12" y1="38" x2="54" y2="56" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#ddd4c3" />
                    <stop offset="1" stopColor="#eee7d9" />
                </linearGradient>
            </defs>

            {/* Outer ring */}
            <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke={`url(#${ringId})`}
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray="150 18"
                strokeDashoffset="8"
                opacity="0.95"
            />

            {/* Steam */}
            <path
                d="M33 14c-2 3-1 5 1 7 2 2 3 5 1 8"
                fill="none"
                stroke={`url(#${steamId})`}
                strokeWidth="2.8"
                strokeLinecap="round"
            />
            <path
                d="M28 16c-2 3-1 5 1 7 2 2 3 5 1 8"
                fill="none"
                stroke={`url(#${steamId})`}
                strokeWidth="2.4"
                strokeLinecap="round"
                opacity="0.9"
            />
            <path
                d="M38 16c-2 3-1 5 1 7 2 2 3 5 1 8"
                fill="none"
                stroke={`url(#${steamId})`}
                strokeWidth="2.4"
                strokeLinecap="round"
                opacity="0.9"
            />

            {/* Cloche */}
            <path
                d="M24 33c0-6.8 5.5-12.3 12.3-12.3S49 26.2 49 33v1.6H24V33z"
                fill={`url(#${clocheId})`}
            />
            <rect x="34.4" y="18.2" width="3.2" height="4.4" rx="1.6" fill="#e8dfcf" />
            <path d="M22.5 36.6h28.9c1 0 1.9.8 1.9 1.9s-.8 1.9-1.9 1.9H22.5c-1 0-1.9-.8-1.9-1.9s.8-1.9 1.9-1.9z" fill="#e8dfcf" />

            {/* Hand */}
            <path
                d="M17 45.5c4.8-3.3 10.8-5.5 17.8-5.5 6.1 0 9.6 1.7 12.5 3.3 2.4 1.4 4.6 2.5 7.7 2.5 2.2 0 3.8 1.6 3.8 3.6 0 2.4-2 4.3-5.1 4.6-8.8.8-15.2-2.2-20.9-2.2-4.5 0-7.8 1.3-11.4 2.3-3.1.9-6.5 1.5-10.7 1.1-2.1-.2-3.7-1.8-3.7-3.8 0-1.5.9-2.9 2.3-3.7z"
                fill={`url(#${handId})`}
            />
        </svg>
    );
}
