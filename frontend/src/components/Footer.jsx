import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

export default function Footer() {
    return (
        <footer className="theme-footer mt-20 border-t border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_95%,#000_5%)] text-[color:var(--app-text)]">
            <div className="mx-auto max-w-7xl px-8 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
                    {/* Brand Column */}
                    <div className="lg:col-span-1">
                        <div className="flex items-center gap-3">
                            <BrandLogo className="h-10 w-10" />
                            <h1 className="theme-brand-text bg-gradient-to-r from-[#ffb84d] to-[#ff6a00] bg-clip-text text-3xl font-black text-transparent">
                                Tiffzy
                            </h1>
                        </div>
                        <p className="mt-6 text-[15px] leading-relaxed text-[color:var(--app-muted)]">
                            Tiffzy is a Food Business Platform providing online ordering, restaurant operations, QR table ordering, live kitchen orders, billing &amp; payments, analytics, and supply chain management.
                        </p>

                        <div className="mt-8 p-5 rounded-2xl bg-[color:color-mix(in_srgb,var(--app-text)_5%,transparent)] border border-[color:var(--app-border)]">
                            <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Legal Entity Notice</p>
                            <p className="text-sm font-medium text-[color:var(--app-text)]">
                                Tiffzy is owned & operated by <br/><strong>SURVETRA SERVICES</strong>.
                            </p>
                        </div>
                    </div>

                    {/* Company Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[color:var(--app-text)]">Company</h3>
                        <ul className="space-y-4 text-[15px] text-[color:var(--app-muted)]">
                            <li><Link to="/about-us" className="hover:text-[color:var(--app-text)] transition">About Us</Link></li>
                            <li><Link to="/contact-us" className="hover:text-[color:var(--app-text)] transition">Contact Us</Link></li>
                            <li><Link to="/legal-disclosure" className="text-[#f59e0b] font-bold hover:underline">Legal & Business Info</Link></li>
                            <li><Link to="/pricing" className="hover:text-[color:var(--app-text)] transition">Pricing</Link></li>
                        </ul>
                    </div>

                    {/* Features Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[color:var(--app-text)]">Product Features</h3>
                        <ul className="space-y-4 text-[15px] text-[color:var(--app-muted)]">
                            <li><Link to="/qr-ordering" className="hover:text-[color:var(--app-text)] transition">QR Ordering</Link></li>
                            <li><Link to="/pos-dashboard" className="hover:text-[color:var(--app-text)] transition">POS Dashboard</Link></li>
                            <li><Link to="/analytics" className="hover:text-[color:var(--app-text)] transition">Analytics</Link></li>
                            <li><Link to="/inventory" className="hover:text-[color:var(--app-text)] transition">Inventory Management</Link></li>
                        </ul>
                    </div>

                    {/* Policies Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[color:var(--app-text)]">Policies & Support</h3>
                        <ul className="space-y-4 text-[15px] text-[color:var(--app-muted)]">
                            <li><Link to="/privacy" className="hover:text-[color:var(--app-text)] transition">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="hover:text-[color:var(--app-text)] transition">Terms & Conditions</Link></li>
                            <li><Link to="/refund-policy" className="hover:text-[color:var(--app-text)] transition">Refund & Cancellation</Link></li>
                            <li><Link to="/shipping-policy" className="hover:text-[color:var(--app-text)] transition">Shipping & Delivery</Link></li>
                            <li><Link to="/help-center" className="hover:text-[color:var(--app-text)] transition">Support & Help Center</Link></li>
                            <li><Link to="/delete-account" className="text-red-500 font-semibold hover:underline transition">Delete Account</Link></li>
                        </ul>
                    </div>

                    {/* App & Developer Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[color:var(--app-text)]">Get Our App</h3>
                        <div className="space-y-3 mb-8">
                            <a
                                href="https://play.google.com/apps/testing/com.tiffzy.app"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-center gap-2 rounded-xl bg-[color:color-mix(in_srgb,var(--app-text)_6%,transparent)] border border-[color:var(--app-border)] px-4 py-2.5 text-sm font-bold text-[color:var(--app-text)] hover:bg-[color:color-mix(in_srgb,var(--app-text)_12%,transparent)] transition"
                            >
                                Download for Android
                            </a>
                            <button
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[color:color-mix(in_srgb,var(--app-text)_3%,transparent)] border border-[color:var(--app-border)] px-4 py-2.5 text-sm font-bold text-[color:var(--app-muted)] opacity-50 cursor-not-allowed"
                                disabled
                            >
                                Download for iOS (Soon)
                            </button>
                        </div>

                        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[color:var(--app-muted)] opacity-80">Developer Info</h3>
                        <div className="space-y-2 text-[13px] text-[color:var(--app-muted)]">
                            <p>support@tiffzy.com</p>
                            <p>+91 91779 39713</p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-20 pt-8 border-t border-[color:var(--app-border)] flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-sm text-[color:var(--app-muted)]">
                        <p>© 2026 <strong>SURVETRA SERVICES</strong>. All Rights Reserved.</p>
                        <p className="mt-1">Brand: Tiffzy (Food Business Platform) | Operated by SURVETRA SERVICES</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 text-xs font-medium text-[color:var(--app-muted)] uppercase tracking-widest">
                        <Link to="/privacy" className="hover:text-[color:var(--app-text)] transition">Privacy Policy</Link>
                        <span className="opacity-30">•</span>
                        <Link to="/terms" className="hover:text-[color:var(--app-text)] transition">Terms</Link>
                        <span className="opacity-30">•</span>
                        <Link to="/legal-disclosure" className="hover:text-[color:var(--app-text)] transition">Legal Disclosure</Link>
                        <span className="opacity-30">•</span>
                        <Link to="/contact-us" className="hover:text-[color:var(--app-text)] transition">Contact Us</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
