import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Building2, ShieldCheck, CheckCircle2, Utensils, Smartphone, Globe, Mail, Phone } from "lucide-react";

export default function AboutUs() {
    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <Navbar />

            <main className="flex-1 mx-auto max-w-5xl px-6 py-12 sm:px-8 lg:px-10 w-full">
                {/* Header */}
                <div className="space-y-4 border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Building2 size={14} />
                        <span>About Tiffzy & SURVETRA SERVICES</span>
                    </div>

                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
                        Smart Restaurant & Dine-In Management System
                    </h1>
                    <p className="max-w-3xl text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                        Tiffzy is a commercial digital food ordering and restaurant technology platform owned, operated, and maintained by <strong>SURVETRA SERVICES</strong>.
                    </p>
                </div>

                {/* Legal Entity Ownership Callout */}
                <div className="my-8 rounded-3xl bg-amber-500/10 p-6 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="text-amber-600 dark:text-amber-400 shrink-0" size={24} />
                        <h2 className="text-lg font-bold">Official Business Ownership Notice</h2>
                    </div>
                    <p className="text-sm leading-relaxed">
                        <strong>Tiffzy is owned and operated by SURVETRA SERVICES.</strong> All software applications, mobile apps published on the Google Play Store, domain names (<a href="https://www.tiffzy.com" className="underline font-bold">https://www.tiffzy.com</a>), trade names, logos, APIs, and commercial services are the exclusive property of <strong>SURVETRA SERVICES</strong>.
                    </p>
                </div>

                {/* Company Story & Platform Features */}
                <div className="space-y-10 my-10">
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Utensils className="text-amber-500" size={22} />
                            <span>What Tiffzy Provides</span>
                        </h2>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                            Tiffzy connects customers, restaurant partners, kitchen staff, and management teams through a single, unified digital ordering system. The platform allows diners to scan QR codes at tables or browse digital menus, place orders, and pay seamlessly, while empowering restaurant owners with POS dashboards, kitchen displays, table tracking, analytics, inventory, and staff management.
                        </p>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-2 shadow-sm">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 font-bold">
                                <Smartphone size={20} />
                            </div>
                            <h3 className="font-bold text-base text-gray-900 dark:text-white">Customer App & QR Ordering</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                Seamless digital menu browsing, table QR code ordering, customer profile management, order history, and instant digital payments.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-2 shadow-sm">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 font-bold">
                                <Building2 size={20} />
                            </div>
                            <h3 className="font-bold text-base text-gray-900 dark:text-white">Restaurant & POS Dashboard</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                Complete order tracking, live kitchen displays (KDS), table management, sales analytics, inventory tracking, and staff management.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-2 shadow-sm">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 font-bold">
                                <ShieldCheck size={20} />
                            </div>
                            <h3 className="font-bold text-base text-gray-900 dark:text-white">Enterprise Standards</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                High-speed cloud deployment on GCP, SSL encryption, OAuth 2.0 authentication, and strict user data privacy protections.
                            </p>
                        </div>
                    </section>

                    {/* Developer Information Card */}
                    <section className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <CheckCircle2 className="text-emerald-500" size={20} />
                            <span>Developer & Entity Information</span>
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                            <p><strong className="text-gray-900 dark:text-gray-200">Legal Business Name:</strong> SURVETRA SERVICES</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Brand Name:</strong> Tiffzy</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Official Email:</strong> support@tiffzy.com</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Official Phone:</strong> +91 91779 39713</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Official Website:</strong> https://www.tiffzy.com</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Country:</strong> India</p>
                        </div>

                        <div className="pt-4 border-t border-[var(--app-border,rgba(0,0,0,0.1))] flex flex-wrap gap-4 text-xs">
                            <Link to="/legal" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">
                                View Full Legal & Business Disclosure Page →
                            </Link>
                            <Link to="/privacy" className="text-gray-500 hover:underline">
                                Privacy Policy
                            </Link>
                            <Link to="/terms" className="text-gray-500 hover:underline">
                                Terms & Conditions
                            </Link>
                        </div>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
