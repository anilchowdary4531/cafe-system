import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

export default function Footer() {
    return (
        <footer className="theme-footer mt-20 border-t border-white/5 bg-[#121212]">
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
                        <p className="mt-6 text-[15px] leading-relaxed text-[#f5efe0]/60">
                            Smart QR ordering & restaurant management platform for cafes, restaurants, and food courts.
                        </p>

                        <div className="mt-8 p-5 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Legal Entity Notice</p>
                            <p className="text-sm text-white font-medium">
                                Tiffzy is owned & operated by <br/><strong>SURVETRA SERVICES</strong>.
                            </p>
                        </div>
                    </div>

                    {/* Company Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-white">Company</h3>
                        <ul className="space-y-4 text-[15px] text-[#f5efe0]/60">
                            <li><Link to="/about-us" className="hover:text-white transition">About Us</Link></li>
                            <li><Link to="/contact-us" className="hover:text-white transition">Contact Us</Link></li>
                            <li><Link to="/legal-disclosure" className="text-[#f59e0b] hover:underline">Legal & Business Info</Link></li>
                            <li><Link to="/pricing" className="hover:text-white transition">Pricing</Link></li>
                        </ul>
                    </div>

                    {/* Features Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-white">Product Features</h3>
                        <ul className="space-y-4 text-[15px] text-[#f5efe0]/60">
                            <li><Link to="/qr-ordering" className="hover:text-white transition">QR Ordering</Link></li>
                            <li><Link to="/pos-dashboard" className="hover:text-white transition">POS Dashboard</Link></li>
                            <li><Link to="/analytics" className="hover:text-white transition">Analytics</Link></li>
                            <li><Link to="/inventory" className="hover:text-white transition">Inventory Management</Link></li>
                        </ul>
                    </div>

                    {/* Policies Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-white">Policies & Support</h3>
                        <ul className="space-y-4 text-[15px] text-[#f5efe0]/60">
                            <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="hover:text-white transition">Terms & Conditions</Link></li>
                            <li><Link to="/refund-policy" className="hover:text-white transition">Refund & Cancellation</Link></li>
                            <li><Link to="/shipping-policy" className="hover:text-white transition">Shipping & Delivery</Link></li>
                            <li><Link to="/help-center" className="hover:text-white transition">Support & Help Center</Link></li>
                            <li><Link to="/profile/delete" className="text-red-500 hover:text-red-400">Delete Account Request</Link></li>
                        </ul>
                    </div>

                    {/* Developer Column */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-white">Developer Info</h3>
                        <div className="space-y-3 text-[14px] text-[#f5efe0]/60">
                            <p><strong>Legal Entity:</strong> SURVETRA SERVICES</p>
                            <p><strong>Brand Name:</strong> Tiffzy</p>
                            <p><strong>Email:</strong> support@tiffzy.com</p>
                            <p><strong>Phone:</strong> +91 91779 39713</p>
                            <p><strong>Website:</strong> https://www.tiffzy.com</p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-sm text-[#f5efe0]/40">
                        <p>© 2026 <strong>SURVETRA SERVICES</strong>. All Rights Reserved.</p>
                        <p className="mt-1">Brand: Tiffzy | Operated by SURVETRA SERVICES</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 text-xs font-medium text-[#f5efe0]/40 uppercase tracking-widest">
                        <Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link>
                        <span className="text-white/5">•</span>
                        <Link to="/terms" className="hover:text-white transition">Terms</Link>
                        <span className="text-white/5">•</span>
                        <Link to="/legal-disclosure" className="hover:text-white transition">Legal Disclosure</Link>
                        <span className="text-white/5">•</span>
                        <Link to="/contact-us" className="hover:text-white transition">Contact Us</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
