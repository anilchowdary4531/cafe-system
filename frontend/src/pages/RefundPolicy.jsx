import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { RefreshCw, Building2, ShieldCheck, Mail, Phone } from "lucide-react";

export default function RefundPolicy() {
    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <Navbar />

            <main className="flex-1 mx-auto max-w-4xl px-6 py-12 sm:px-10 lg:px-12 w-full">
                {/* Header */}
                <div className="space-y-4 border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <RefreshCw size={14} />
                        <span>Official Cancellation & Refund Policy</span>
                    </div>

                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
                        Refund & Cancellation Policy
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Effective Date: August 5, 2026 | Last Updated: August 5, 2026
                    </p>
                </div>

                {/* Legal Entity Ownership Notice */}
                <div className="my-8 rounded-3xl bg-amber-500/10 p-6 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-3">
                        <Building2 className="text-amber-600 dark:text-amber-400 shrink-0" size={24} />
                        <h2 className="text-lg font-bold">Business Ownership Disclosure</h2>
                    </div>
                    <p className="text-sm leading-relaxed">
                        This Refund and Cancellation Policy governs orders placed through the Tiffzy web platform (<a href="https://www.tiffzy.com" className="underline font-bold">https://www.tiffzy.com</a>) and mobile applications. <strong>Tiffzy is owned and operated by SURVETRA SERVICES.</strong> All payment settlements and refund processing are handled by SURVETRA SERVICES.
                    </p>
                </div>

                {/* Policy Details */}
                <div className="space-y-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-10">
                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">1. Order Cancellation Terms</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Before Kitchen Acceptance:</strong> Customers may cancel an order free of charge before the participating restaurant confirms or begins preparing the order.</li>
                            <li><strong>After Kitchen Acceptance:</strong> Once an order is accepted and entered into kitchen preparation, cancellations are subject to restaurant approval due to food wastage considerations.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">2. Refund Eligibility Criteria</h2>
                        <p>A full or partial refund will be granted by <strong>SURVETRA SERVICES</strong> under the following circumstances:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>An order was paid for but canceled prior to kitchen acceptance.</li>
                            <li>Payment was debited from your account due to a network glitch, but the order failed to generate in the restaurant system.</li>
                            <li>The restaurant partner was unable to fulfill the ordered items due to stock depletion.</li>
                            <li>Delivered or served items were incorrect or defective, verified by customer support.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">3. Refund Processing Timeline & Methods</h2>
                        <div className="rounded-2xl bg-emerald-500/10 p-5 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 space-y-2 text-xs sm:text-sm">
                            <p className="font-bold">Turnaround Time:</p>
                            <p>
                                Approved refunds will be initiated immediately by <strong>SURVETRA SERVICES</strong> and credited back to your original payment method (Credit/Debit Card, Net Banking, UPI, or Wallet) within <strong>5 to 7 business days</strong> depending on your banking provider.
                            </p>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-2 text-xs">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">Refund Support & Queries</h3>
                        <p>To request a refund or check the status of a pending refund, contact our support desk:</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Legal Entity:</strong> SURVETRA SERVICES (Tiffzy)</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Refund Email:</strong> support@tiffzy.com</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Support Phone:</strong> +91 91779 39713</p>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
