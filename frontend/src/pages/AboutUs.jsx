import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SeoHead from "../components/SeoHead";
import { Building2, ShieldCheck, CheckCircle2, Utensils, Smartphone, Code2, UserCheck, ArrowRight } from "lucide-react";

export default function AboutUs() {
    const pageTitle = "About Tiffzy | Founder, Proprietor & SURVETRA SERVICES";
    const pageDescription = "Learn about Tiffzy, operated by SURVETRA SERVICES. Founded by Jekka Ramesh, with Thamineni Anil Kumar as Proprietor.";

    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": "https://www.tiffzy.com/#organization",
                "name": "SURVETRA SERVICES",
                "legalName": "SURVETRA SERVICES",
                "alternateName": "Tiffzy",
                "url": "https://www.tiffzy.com",
                "logo": "https://www.tiffzy.com/brand-logo.png",
                "description": "SURVETRA SERVICES is the business operating Tiffzy, a smart QR restaurant ordering and food technology platform.",
                "founder": {
                    "@type": "Person",
                    "@id": "https://www.tiffzy.com/about/jekka-ramesh#person",
                    "name": "Jekka Ramesh",
                    "jobTitle": "Founder"
                },
                "employee": {
                    "@type": "Person",
                    "@id": "https://www.tiffzy.com/about/thamineni-anil-kumar#person",
                    "name": "Thamineni Anil Kumar",
                    "jobTitle": "Proprietor"
                }
            },
            {
                "@type": "Brand",
                "@id": "https://www.tiffzy.com/#brand",
                "name": "Tiffzy",
                "description": "Smart QR Restaurant Ordering System & Food Business Platform",
                "url": "https://www.tiffzy.com"
            }
        ]
    };

    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <SeoHead
                title={pageTitle}
                description={pageDescription}
                keywords="Tiffzy, SURVETRA SERVICES, Jekka Ramesh, Founder, Thamineni Anil Kumar, Proprietor, Food Business Platform, QR Ordering"
                canonical="https://www.tiffzy.com/about-us"
                jsonLd={jsonLd}
            />
            <Navbar />

            <main className="flex-1 mx-auto max-w-5xl px-6 py-12 sm:px-8 lg:px-10 w-full">
                {/* Header */}
                <div className="space-y-4 border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Building2 size={14} />
                        <span>About Tiffzy &amp; SURVETRA SERVICES</span>
                    </div>

                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
                        Smart Restaurant &amp; Dine-In Management System
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

                {/* Our Leadership Section */}
                <section className="my-10 space-y-6">
                    <div className="space-y-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Leadership &amp; Management
                        </span>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                            Our Leadership
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
                            Meet the founder and proprietor behind Tiffzy and its operating business entity, SURVETRA SERVICES.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Jekka Ramesh - Founder */}
                        <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-4 shadow-sm flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 font-bold">
                                        <Code2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-xl text-gray-900 dark:text-white">
                                            Jekka Ramesh
                                        </h3>
                                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                            Founder
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic border-l-2 border-amber-500/50 pl-3 py-1">
                                    &quot;Jekka Ramesh is the Founder of Tiffzy. He is responsible for the product vision, software development, technology architecture, and development of the Tiffzy platform.&quot;
                                </p>
                            </div>
                            <div className="pt-3 border-t border-[var(--app-border,rgba(0,0,0,0.08))]">
                                <Link
                                    to="/about/jekka-ramesh"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
                                >
                                    <span>Jekka Ramesh – Founder Profile</span>
                                    <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>

                        {/* Thamineni Anil Kumar - Proprietor */}
                        <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-4 shadow-sm flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 font-bold">
                                        <UserCheck size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-xl text-gray-900 dark:text-white">
                                            Thamineni Anil Kumar
                                        </h3>
                                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                            Proprietor – SURVETRA SERVICES
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic border-l-2 border-amber-500/50 pl-3 py-1">
                                    &quot;Thamineni Anil Kumar is the Proprietor of SURVETRA SERVICES, the business operating Tiffzy.&quot;
                                </p>
                            </div>
                            <div className="pt-3 border-t border-[var(--app-border,rgba(0,0,0,0.08))]">
                                <Link
                                    to="/about/thamineni-anil-kumar"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
                                >
                                    <span>Thamineni Anil Kumar – Proprietor Profile</span>
                                    <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

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
                            <h3 className="font-bold text-base text-gray-900 dark:text-white">Customer App &amp; QR Ordering</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                Seamless digital menu browsing, table QR code ordering, customer profile management, order history, and instant digital payments.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-2 shadow-sm">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 font-bold">
                                <Building2 size={20} />
                            </div>
                            <h3 className="font-bold text-base text-gray-900 dark:text-white">Restaurant &amp; POS Dashboard</h3>
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
                            <span>Developer &amp; Entity Information</span>
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                            <p><strong className="text-gray-900 dark:text-gray-200">Legal Business Name:</strong> SURVETRA SERVICES</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">GSTIN:</strong> 37FJMPS3S3117Q1ZB</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Registered Address:</strong> 13/640, Sasthri Nagar, Tadipatri, Andhra Pradesh, India</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Brand Name:</strong> Tiffzy</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Founder:</strong> Jekka Ramesh</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Proprietor:</strong> Thamineni Anil Kumar</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Official Email:</strong> jekkaramesh@survetra.com</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Official Phone:</strong> +91 91777 64632</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Official Website:</strong> https://www.tiffzy.com</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Country:</strong> India</p>
                        </div>

                        <div className="pt-4 border-t border-[var(--app-border,rgba(0,0,0,0.1))] flex flex-wrap gap-4 text-xs">
                            <Link to="/legal-disclosure" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">
                                View Full Legal &amp; Business Disclosure Page →
                            </Link>
                            <Link to="/privacy" className="text-gray-500 hover:underline">
                                Privacy Policy
                            </Link>
                            <Link to="/terms" className="text-gray-500 hover:underline">
                                Terms &amp; Conditions
                            </Link>
                        </div>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
