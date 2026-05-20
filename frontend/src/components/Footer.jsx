export default function Footer() {
    return (
        <footer className="theme-footer mt-20 border-t">

            <div className="max-w-7xl mx-auto px-8 py-16">

                {/* TOP GRID */}
                <div className="grid md:grid-cols-5 gap-10">

                    {/* LOGO */}
                    <div>
                        <h1 className="text-5xl font-bold tracking-tight">
                            ☕ Cafe
                        </h1>

                        <p className="theme-muted mt-4 leading-7">
                            Smart ordering platform for restaurants,
                            cafes and dine-in businesses.
                        </p>
                    </div>

                    {/* COMPANY */}
                    <div>
                        <h3 className="text-xl font-semibold mb-5">
                            Company
                        </h3>

                        <ul className="theme-muted space-y-3">
                            <li className="cursor-pointer hover:opacity-80">
                                About Us
                            </li>
                            <li className="cursor-pointer hover:opacity-80">
                                Careers
                            </li>
                            <li className="cursor-pointer hover:opacity-80">
                                Blog
                            </li>
                            <li className="cursor-pointer hover:opacity-80">
                                Investors
                            </li>
                        </ul>
                    </div>

                    {/* PRODUCTS */}
                    <div>
                        <h3 className="text-xl font-semibold mb-5">
                            Products
                        </h3>

                        <ul className="theme-muted space-y-3">
                            <li className="cursor-pointer hover:opacity-80">
                                QR Ordering
                            </li>
                            <li className="cursor-pointer hover:opacity-80">
                                POS Dashboard
                            </li>
                            <li className="cursor-pointer hover:opacity-80">
                                Analytics
                            </li>
                            <li className="cursor-pointer hover:opacity-80">
                                Inventory
                            </li>
                        </ul>
                    </div>

                    {/* SUPPORT */}
                    <div>
                        <h3 className="text-xl font-semibold mb-5">
                            Support
                        </h3>

                        <ul className="theme-muted space-y-3">
                            <li className="cursor-pointer hover:opacity-80">
                                Help Center
                            </li>
                            <li className="cursor-pointer hover:opacity-80">
                                Terms
                            </li>
                            <li className="cursor-pointer hover:opacity-80">
                                Privacy
                            </li>
                            <li className="cursor-pointer hover:opacity-80">
                                Contact Us
                            </li>
                        </ul>
                    </div>

                    {/* SOCIAL */}
                    <div>
                        <h3 className="text-xl font-semibold mb-5">
                            Get Our App
                        </h3>

                        <div className="space-y-4">

                            <button className="theme-soft-button w-full rounded-xl px-4 py-3 transition">
                                🍎 Download for iOS
                            </button>

                            <button className="theme-soft-button w-full rounded-xl px-4 py-3 transition">
                                ▶ Download for Android
                            </button>

                        </div>

                        <div className="flex gap-3 mt-6 text-2xl">
                            <span className="cursor-pointer hover:opacity-80">📘</span>
                            <span className="cursor-pointer hover:opacity-80">📷</span>
                            <span className="cursor-pointer hover:opacity-80">🐦</span>
                            <span className="cursor-pointer hover:opacity-80">💼</span>
                        </div>

                    </div>

                </div>

                {/* LINE */}
                <div className="theme-muted mt-12 border-t pt-6 text-sm theme-border">

                    © 2026 Cafe Technologies Pvt Ltd. All rights reserved.

                </div>

            </div>

        </footer>
    );
}
