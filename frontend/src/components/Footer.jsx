import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

export default function Footer({
    showBrand = true,
    showCompanySection = true,
    showCopyrightBrand = true,
} = {}) {
    const visibleColumns = 3 + (showBrand ? 1 : 0) + (showCompanySection ? 1 : 0);
    const gridColumnsClass =
        visibleColumns === 6
            ? "md:grid-cols-6"
            : visibleColumns === 5
              ? "md:grid-cols-5"
              : "md:grid-cols-4";

    return (
        <footer className="theme-footer mt-20 border-t">
            <div className="mx-auto max-w-7xl px-8 py-16">
                <div className={`grid gap-10 ${gridColumnsClass}`}>
                    {showBrand ? (
                        <div>
                            <div className="flex items-center gap-3">
                                <BrandLogo className="theme-brand-logo h-12 w-12" title="Tiffzy logo" />
                                <div className="leading-none">
                                    <h1 className="theme-brand-text bg-gradient-to-r from-[#ffb84d] via-[#f59e0b] to-[#ff6a00] bg-clip-text text-3xl font-black tracking-[0.01em] text-transparent drop-shadow-[0_2px_0_rgba(0,0,0,0.22)] sm:text-4xl">
                                        Tiffzy
                                    </h1>
                                    <div className="mt-1 h-[2px] w-16 rounded-full bg-gradient-to-r from-[#ffb84d]/0 via-[#ffb84d]/75 to-[#ff6a00]/0" />
                                </div>
                            </div>

                            <p className="mt-4 max-w-[18rem] text-[15px] leading-7 tracking-wide text-[#f5efe0]">
                                Smart ordering platform for restaurants, cafes and dine-in businesses.
                            </p>
                        </div>
                    ) : null}

                    {showCompanySection ? (
                        <div>
                            <h3 className="mb-5 text-xl font-semibold">Company</h3>

                            <ul className="theme-muted space-y-3">
                                <li>
                                    <Link to="/about-us" className="hover:opacity-80">
                                        About Us
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/contact-us" className="hover:opacity-80">
                                        Contact Us
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    ) : null}

                    <div>
                        <h3 className="mb-5 text-xl font-semibold">Products</h3>

                        <ul className="theme-muted space-y-3">
                            <li>
                                <Link to="/qr-ordering" className="hover:opacity-80">
                                    QR Ordering
                                </Link>
                            </li>
                            <li>
                                <Link to="/pos-dashboard" className="hover:opacity-80">
                                    POS Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link to="/analytics" className="hover:opacity-80">
                                    Analytics
                                </Link>
                            </li>
                            <li>
                                <Link to="/inventory" className="hover:opacity-80">
                                    Inventory
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                            <h3 className="mb-5 text-xl font-semibold">Support</h3>

                            <ul className="theme-muted space-y-3">
                                <li>
                                    <Link to="/help-center" className="hover:opacity-80">
                                        Help Center
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/terms" className="hover:opacity-80">
                                        Terms
                                </Link>
                            </li>
                            <li>
                                <Link to="/privacy" className="hover:opacity-80">
                                    Privacy
                                </Link>
                            </li>
                            <li>
                                <Link to="/refund-policy" className="hover:opacity-80">
                                    Refund Policy
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="mb-5 text-xl font-semibold">Get Our App</h3>

                        <div className="space-y-4">
                            <button className="theme-soft-button w-full rounded-xl px-4 py-3 transition">
                                Download for iOS
                            </button>

                            <button className="theme-soft-button w-full rounded-xl px-4 py-3 transition">
                                Download for Android
                            </button>
                        </div>

                        <div className="mt-6 flex gap-3 text-2xl">
                            <span className="cursor-pointer hover:opacity-80">FB</span>
                            <span className="cursor-pointer hover:opacity-80">IG</span>
                            <span className="cursor-pointer hover:opacity-80">X</span>
                            <span className="cursor-pointer hover:opacity-80">LI</span>
                        </div>
                    </div>
                </div>

                <div className="theme-muted theme-border mt-12 border-t pt-6 text-sm">
                    {showCopyrightBrand
                        ? "© 2026 Tiffzy Technologies Pvt Ltd. All rights reserved."
                        : "© 2026 All rights reserved."}
                </div>
            </div>
        </footer>
    );
}
