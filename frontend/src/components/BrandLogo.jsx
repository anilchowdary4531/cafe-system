import brandLogo from "../assets/tiffzy-logo.png";

export default function BrandLogo({ className = "", title = "Tiffzy logo" } = {}) {
    return (
        <img
            src={brandLogo}
            alt={title}
            className={`${className} object-contain`}
            loading="eager"
            decoding="async"
        />
    );
}
