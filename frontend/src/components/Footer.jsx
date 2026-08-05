import React from "react";
import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

export default function Footer({
    showBrand = true,
    showCompanySection = true,
    showCopyrightBrand = true,
} = {}) {
    return (
        <footer className="theme-footer mt-20 border-t border-[var(--app-border,rgba(0,0,0,0.1))] bg-black/5 dark:bg-slate-900/60 backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
                <div className="grid gap-10 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
                    {showBrand && (
                        <div className="sm:col-span-2 md:col-span-1">
                            <div className="flex items-center gap-3">
                                <BrandLogo className="theme-brand-logo h-10 w-10" title="Tiffzy logo" />
                                <div className="leading-none">
                                    <h2 className="theme-brand-text bg-gradient-to-r from-[#ffb84d] via-[#f59e0b] to-[#ff6a00] bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-sm sm:text-3xl">
                                        Tiffzy
                                    </h2>
                                    <div className="mt-1 h-[2px] w-12 rounded-full bg-gradient-to-r from-[#ffb84d]/0 via-[#ffb84d]/75 to-[#ff6a00]/0" />
                                </div>
                            </div>

                            <p className="mt-4 max-w-[18rem] text-xs leading-6 text-gray-600 dark:text-gray-300">
                                Smart QR ordering & restaurant management platform for cafes, restaurants, and food courts.
                            </p>

                            <div className="mt-4 rounded-2xl bg-amber-500/10 p-3 border border-amber-500/20 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                <p className="font-bold">Legal Entity Notice</p>
                                <p className="mt-0.5 opacity-90">Tiffzy is owned & operated by <strong>SURVETRA SERVICES</strong>.</p>
                            </div>
                        </div>
                    )}

                    {showCompanySection && (
                        <div>
                            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Company</h3>
                            <ul className="space-y-2.5 text-xs text-gray-600 dark:text-gray-400">
                                <li>
                                    <Link to="/about-us" className="hover:text-amber-500 transition">
                                        About Us
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/contact-us" className="hover:text-amber-500 transition">
                                        Contact Us
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/legal" className="hover:text-amber-500 transition font-medium text-amber-600 dark:text-amber-400">
                                        Legal & Business Info
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/pricing" className="hover:text-amber-500 transition">
                                        Pricing
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    )}

                    <div>
                        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Product Features</h3>
                        <ul className="space-y-2.5 text-xs text-gray-600 dark:text-gray-400">
                            <li>
                                <Link to="/qr-ordering" className="hover:text-amber-500 transition">
                                    QR Ordering
                                </Link>
                            </li>
                            <li>
                                <Link to="/pos-dashboard" className="hover:text-amber-500 transition">
                                    POS Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link to="/analytics" className="hover:text-amber-500 transition">
                                    Analytics
                                </Link>
                            </li>
                            <li>
                                <Link to="/inventory" className="hover:text-amber-500 transition">
                                    Inventory Management
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Policies & Support</h3>
                        <ul className="space-y-2.5 text-xs text-gray-600 dark:text-gray-400">
                            <li>
                                <Link to="/privacy" className="hover:text-amber-500 transition">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link to="/terms" className="hover:text-amber-500 transition">
                                    Terms & Conditions
                                </Link>
                            </li>
                            <li>
                                <Link to="/refund-policy" className="hover:text-amber-500 transition">
                                    Refund & Cancellation
                                </Link>
                            </li>
                            <li>
                                <Link to="/shipping-policy" className="hover:text-amber-500 transition">
                                    Shipping & Delivery
                                </Link>
                            </li>
                            <li>
                                <Link to="/help-center" className="hover:text-amber-500 transition">
                                    Support & Help Center
                                </Link>
                            </li>
                            <li>
                                <Link to="/delete-account" className="hover:text-amber-500 transition text-rose-500">
                                    Delete Account Request
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Developer & Merchant Info</h3>
                        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                            <p><strong className="text-gray-900 dark:text-gray-200">Legal Entity:</strong> SURVETRA SERVICES</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">GSTIN:</strong> 37FJMPS3S3117Q1ZB</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Brand Name:</strong> Tiffzy</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Email:</strong> jekkaramesh@survetra.com</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Phone:</strong> +91 91777 64632</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Website:</strong> https://www.tiffzy.com</p>
                        </div>
                    </div>
                </div>

                <div className="mt-12 pt-6 border-t border-[var(--app-border,rgba(0,0,0,0.1))] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <div>
                        <p>© 2026 <strong>SURVETRA SERVICES</strong>. All Rights Reserved.</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">Brand: Tiffzy | Operated by SURVETRA SERVICES</p>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs">
                        <Link to="/privacy" className="hover:text-amber-500 transition">Privacy Policy</Link>
                        <span>•</span>
                        <Link to="/terms" className="hover:text-amber-500 transition">Terms</Link>
                        <span>•</span>
                        <Link to="/legal" className="hover:text-amber-500 transition">Legal Disclosure</Link>
                        <span>•</span>
                        <Link to="/contact-us" className="hover:text-amber-500 transition">Contact Us</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
