import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { FileText, Building2, ShieldCheck } from "lucide-react";

export default function Terms() {
    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <Navbar />

            <main className="flex-1 mx-auto max-w-4xl px-6 py-12 sm:px-10 lg:px-12 w-full">
                {/* Header */}
                <div className="space-y-4 border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <FileText size={14} />
                        <span>Official Terms of Service</span>
                    </div>

                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
                        Terms & Conditions
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Effective Date: August 5, 2026 | Last Updated: August 5, 2026
                    </p>
                </div>

                {/* Legal Entity Ownership Callout */}
                <div className="my-8 rounded-3xl bg-amber-500/10 p-6 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-3">
                        <Building2 className="text-amber-600 dark:text-amber-400 shrink-0" size={24} />
                        <h2 className="text-lg font-bold">Contractual Agreement Notice</h2>
                    </div>
                    <p className="text-sm leading-relaxed">
                        These Terms and Conditions constitute a legally binding agreement between you ("User" or "Partner") and <strong>SURVETRA SERVICES</strong> ("Company", "we", "us"). <strong>Tiffzy is owned and operated by SURVETRA SERVICES.</strong> By accessing or using our website (<a href="https://www.tiffzy.com" className="underline font-bold">https://www.tiffzy.com</a>) or mobile applications, you agree to be bound by these terms.
                    </p>
                </div>

                {/* Terms Sections */}
                <div className="space-y-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-10">
                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">1. Platform Services Overview</h2>
                        <p>
                            Tiffzy provides digital restaurant management software, QR code dine-in menu browsing, customer ordering systems, POS dashboard tooling, and payment gateway integration services to users and commercial restaurant partners.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">2. User Account & Security</h2>
                        <p>
                            Users are responsible for maintaining the confidentiality of their account credentials, OTP codes, and login sessions. You agree to provide accurate, complete information (including full name and valid 10-digit mobile phone number) during registration. SURVETRA SERVICES reserves the right to suspend or terminate accounts that violate these terms.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">3. Payments & Order Fulfillment</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>All menu prices, applicable taxes, and delivery or service fees are displayed prior to order confirmation.</li>
                            <li>Payments are processed securely via authorized third-party payment gateways.</li>
                            <li>Order fulfillment (preparation time, food quality, and table service) is managed by individual participating restaurant partners.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">4. Intellectual Property Rights</h2>
                        <p>
                            All software, mobile code, branding, logos, trademarks ("Tiffzy"), source code, and design elements are the exclusive intellectual property of <strong>SURVETRA SERVICES</strong>. Unauthorized duplication, modification, or distribution is strictly prohibited.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">5. Limitation of Liability</h2>
                        <p>
                            SURVETRA SERVICES provides the platform on an "as is" and "as available" basis. To the maximum extent permitted by law, SURVETRA SERVICES shall not be liable for indirect, incidental, or consequential damages resulting from platform downtime or third-party menu pricing errors.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">6. Governing Law & Jurisdiction</h2>
                        <p>
                            These terms shall be governed by and construed in accordance with the laws of India. Any legal disputes shall be subject to the exclusive jurisdiction of the competent courts in India.
                        </p>
                    </section>

                    <section className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-2 text-xs">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">Contact & Entity Details</h3>
                        <p><strong className="text-gray-900 dark:text-gray-200">Legal Entity:</strong> SURVETRA SERVICES</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Brand Name:</strong> Tiffzy</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Email:</strong> support@tiffzy.com | Phone: +91 91779 39713</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Website:</strong> https://www.tiffzy.com</p>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
