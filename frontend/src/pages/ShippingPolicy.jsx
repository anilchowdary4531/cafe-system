import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Truck, Building2, Clock, CheckCircle2 } from "lucide-react";

export default function ShippingPolicy() {
    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <Navbar />

            <main className="flex-1 mx-auto max-w-4xl px-6 py-12 sm:px-10 lg:px-12 w-full">
                {/* Header */}
                <div className="space-y-4 border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Truck size={14} />
                        <span>Official Fulfillment & Shipping Policy</span>
                    </div>

                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
                        Shipping & Delivery Policy
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Effective Date: August 5, 2026 | Last Updated: August 5, 2026
                    </p>
                </div>

                {/* Legal Entity Ownership Callout */}
                <div className="my-8 rounded-3xl bg-amber-500/10 p-6 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-3">
                        <Building2 className="text-amber-600 dark:text-amber-400 shrink-0" size={24} />
                        <h2 className="text-lg font-bold">Business Ownership Disclosure</h2>
                    </div>
                    <p className="text-sm leading-relaxed">
                        This Shipping and Delivery Policy applies to services operated via the Tiffzy platform (<a href="https://www.tiffzy.com" className="underline font-bold">https://www.tiffzy.com</a>) and Tiffzy Android application. <strong>Tiffzy is owned and operated by SURVETRA SERVICES.</strong>
                    </p>
                </div>

                {/* Policy Content */}
                <div className="space-y-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-10">
                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">1. Service Fulfillment Methods</h2>
                        <p>Tiffzy provides three main service fulfillment modes across participating restaurant partners:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Dine-In Table Service:</strong> Orders placed via table QR code scanning are prepared by the kitchen and served directly to your designated table inside the restaurant.</li>
                            <li><strong>Counter Takeaway / Pickup:</strong> Orders are prepared for takeaway. Customers receive real-time notifications on screen when their order is ready for pickup at the counter.</li>
                            <li><strong>Direct Restaurant Delivery:</strong> For partners offering local delivery, orders are dispatched directly via restaurant personnel or local logistics providers to the address specified during checkout.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">2. Delivery Timelines & Fees</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Dine-In / Counter Pickup:</strong> Standard preparation times range between 15 to 30 minutes depending on order volume.</li>
                            <li><strong>Local Delivery:</strong> Delivery timelines vary by distance (typically 30 to 45 minutes). Estimated delivery times are shown prior to payment.</li>
                            <li><strong>Delivery Fees:</strong> Delivery charges, if applicable, are determined by distance and displayed transparently on the checkout screen.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">3. Digital Software & QR Code Instant Delivery</h2>
                        <p>
                            SaaS subscriptions, restaurant POS software licenses, and digital menu QR code generation services are delivered instantly via digital access upon account creation and payment confirmation.
                        </p>
                    </section>

                    <section className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-2 text-xs">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">Delivery Support</h3>
                        <p>If you experience delays or issues with order fulfillment, contact customer support:</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Legal Entity:</strong> SURVETRA SERVICES (Tiffzy)</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Support Email:</strong> support@tiffzy.com</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Phone:</strong> +91 91779 39713</p>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
