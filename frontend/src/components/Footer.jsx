import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

export default function Footer() {
    return (
        <footer className="theme-footer mt-20 border-t">
            <div className="mx-auto max-w-7xl px-8 py-16">
                {/* TOP GRID */}
                <div className="grid gap-10 md:grid-cols-5">
                    {/* LOGO */}
                    <div>
                        <div className="flex items-center gap-3">
                            <BrandLogo className="theme-brand-logo h-12 w-12" title="Tiffzy logo" />
                            <h1 className="theme-brand-text text-5xl font-bold tracking-tight">Tiffzy</h1>
                        </div>

                        <p className="theme-muted mt-4 leading-7">
                            Smart ordering platform for restaurants,
                            cafes and dine-in businesses.
                        </p>
                    </div>

                    {/* COMPANY */}
                    <div>
                        <h3 className="mb-5 text-xl font-semibold">Company</h3>

                        <ul className="theme-muted space-y-3">
                            <li className="cursor-pointer hover:opacity-80">About Us</li>
                            <li className="cursor-pointer hover:opacity-80">Careers</li>
                            <li className="cursor-pointer hover:opacity-80">Blog</li>
                            <li className="cursor-pointer hover:opacity-80">Investors</li>
                        </ul>
                    </div>

                    {/* PRODUCTS */}
                    <div>
                        <h3 className="mb-5 text-xl font-semibold">Products</h3>

                        <ul className="theme-muted space-y-3">
                            <li className="cursor-pointer hover:opacity-80">QR Ordering</li>
                            <li className="cursor-pointer hover:opacity-80">POS Dashboard</li>
                            <li className="cursor-pointer hover:opacity-80">Analytics</li>
                            <li className="cursor-pointer hover:opacity-80">Inventory</li>
                        </ul>
                    </div>

                    {/* SUPPORT */}
                    <div>
                        <h3 className="mb-5 text-xl font-semibold">Support</h3>

                        <ul className="theme-muted space-y-3">
                            <li className="cursor-pointer hover:opacity-80">Help Center</li>
                            <li>
                                <Link to="/terms" className="hover:opacity-80">
                                    Terms
                                </Link>
                            </li>
                            <li className="cursor-pointer hover:opacity-80">Privacy</li>
                            <li className="cursor-pointer hover:opacity-80">Contact Us</li>
                        </ul>
                    </div>

                    {/* APP */}
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

                {/* LINE */}
                <div className="theme-muted theme-border mt-12 border-t pt-6 text-sm">
                    © 2026 Tiffzy Technologies Pvt Ltd. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
