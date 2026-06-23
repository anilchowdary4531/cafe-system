import { useState } from "react";
import brandLogo from "../assets/tiffzy-logo.png";
import fallbackLogo from "../assets/brand-logo.png";

export default function BrandLogo({ className = "", title = "Tiffzy logo" } = {}) {
    const [useFallback, setUseFallback] = useState(false);

    return (
        <img
            src={useFallback ? fallbackLogo : brandLogo}
            alt={title}
            className={`${className} object-contain`}
            loading="eager"
            decoding="async"
            onError={() => setUseFallback(true)}
        />
    );
}
