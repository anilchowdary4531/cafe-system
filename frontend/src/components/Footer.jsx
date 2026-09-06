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
                            Tiffzy is a Smart QR Restaurant Ordering System and Food Business Platform providing online ordering, restaurant operations, live kitchen orders, POS billing &amp; payments, analytics, and supply chain management.
                        </p>

                        <div className="mt-6 p-4 rounded-2xl bg-[color:color-mix(in_srgb,var(--app-text)_5%,transparent)] border border-[color:var(--app-border)] space-y-1 text-xs">
                            <p className="font-bold text-[#f59e0b] uppercase tracking-wider">Business Notice</p>
                            <p className="text-[color:var(--app-text)] font-semibold">
                                Operated by <strong>SURVETRA SERVICES</strong>
                            </p>
                        </div>

                    </div>

                    {/* Company Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[color:var(--app-text)]">Company &amp; People</h3>
                        <ul className="space-y-3 text-[14px] text-[color:var(--app-muted)]">
                            <li><Link to="/about-us" className="hover:text-[color:var(--app-text)] transition font-medium">About Us</Link></li>
                            <li><Link to="/about/jekka-ramesh" className="hover:text-[color:var(--app-text)] transition text-xs font-semibold">Jekka Ramesh – Founder &amp; Developer</Link></li>
                            <li><Link to="/about/thamineni-anil-kumar" className="hover:text-[color:var(--app-text)] transition text-xs font-semibold">Thamineni Anil Kumar – Proprietor</Link></li>
                            <li><Link to="/legal-disclosure" className="text-[#f59e0b] font-bold hover:underline">Legal &amp; Business Info</Link></li>
                            <li><Link to="/contact-us" className="hover:text-[color:var(--app-text)] transition">Contact Us</Link></li>
                            <li><Link to="/pricing" className="hover:text-[color:var(--app-text)] transition">Pricing</Link></li>
                        </ul>
                    </div>

                    {/* Features Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[color:var(--app-text)]">Product Features</h3>
                        <ul className="space-y-3 text-[14px] text-[color:var(--app-muted)]">
                            <li><Link to="/qr-ordering" className="hover:text-[color:var(--app-text)] transition">QR Ordering</Link></li>
                            <li><Link to="/pos-dashboard" className="hover:text-[color:var(--app-text)] transition">POS Dashboard</Link></li>
                            <li><Link to="/analytics" className="hover:text-[color:var(--app-text)] transition">Analytics</Link></li>
                            <li><Link to="/inventory" className="hover:text-[color:var(--app-text)] transition">Inventory Management</Link></li>
                        </ul>
                    </div>

                    {/* Policies Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[color:var(--app-text)]">Policies &amp; Support</h3>
                        <ul className="space-y-3 text-[14px] text-[color:var(--app-muted)]">
                            <li><Link to="/privacy" className="hover:text-[color:var(--app-text)] transition">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="hover:text-[color:var(--app-text)] transition">Terms &amp; Conditions</Link></li>
                            <li><Link to="/refund-policy" className="hover:text-[color:var(--app-text)] transition">Refund &amp; Cancellation</Link></li>
                            <li><Link to="/shipping-policy" className="hover:text-[color:var(--app-text)] transition">Shipping &amp; Delivery</Link></li>
                            <li><Link to="/help-center" className="hover:text-[color:var(--app-text)] transition">Support &amp; Help Center</Link></li>
                            <li><Link to="/delete-account" className="text-red-500 font-semibold hover:underline transition">Delete Account</Link></li>
                        </ul>
                    </div>

                    {/* App & Developer Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[color:var(--app-text)]">Get Our App</h3>
                        <div className="space-y-3 mb-6">
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

                        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[color:var(--app-muted)] opacity-80">Support Contact</h3>
                        <div className="space-y-1 text-[13px] text-[color:var(--app-muted)]">
                            <p>jekkaramesh@survetra.com</p>
                            <p>+91 91777 64632</p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-16 pt-8 border-t border-[color:var(--app-border)] flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-xs text-[color:var(--app-muted)] text-center md:text-left space-y-1">
                        <p>© 2026 <strong>SURVETRA SERVICES</strong>. All Rights Reserved.</p>
                        <p className="opacity-90">
                            Tiffzy | Operated by <strong>SURVETRA SERVICES</strong> | Founder &amp; Developer: <strong>Jekka Ramesh</strong> | Proprietor: <strong>Thamineni Anil Kumar</strong>
                        </p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-4 text-xs font-medium text-[color:var(--app-muted)] uppercase tracking-widest">
                        <Link to="/about-us" className="hover:text-[color:var(--app-text)] transition">About</Link>
                        <span className="opacity-30">•</span>
                        <Link to="/privacy" className="hover:text-[color:var(--app-text)] transition">Privacy</Link>
                        <span className="opacity-30">•</span>
                        <Link to="/terms" className="hover:text-[color:var(--app-text)] transition">Terms</Link>
                        <span className="opacity-30">•</span>
                        <Link to="/legal-disclosure" className="hover:text-[color:var(--app-text)] transition">Legal</Link>
                        <span className="opacity-30">•</span>
                        <Link to="/contact-us" className="hover:text-[color:var(--app-text)] transition">Contact</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
