import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { HelpCircle, Building2, ShieldCheck, Mail, Phone, Search, Trash2, CreditCard, ChevronDown } from "lucide-react";

const faqs = [
    {
        q: "Who owns and operates Tiffzy?",
        a: "Tiffzy is owned and operated by SURVETRA SERVICES. All software, web platforms, and mobile apps published under Tiffzy are commercial products of SURVETRA SERVICES.",
    },
    {
        q: "How do I place an order via QR Code?",
        a: "Scan the QR code placed on your restaurant table using your smartphone camera or app scanner. Select menu items, add special instructions, and complete payment on screen.",
    },
    {
        q: "How do I request a refund for an order?",
        a: "If an order was debited but failed to prepare or fulfill, contact support@tiffzy.com or call +91 91779 39713 with your order ID. Approved refunds are credited to your original payment method within 5-7 business days.",
    },
    {
        q: "How do I request deletion of my account?",
        a: "In compliance with Google Play Policy, you can request account deletion immediately via our Delete Account page (/delete-account) or by emailing support@tiffzy.com.",
    },
    {
        q: "Is payment information stored securely?",
        a: "Yes. All payments are processed through PCI-DSS compliant third-party payment gateways. Tiffzy does not store raw credit card numbers or UPI PINs.",
    },
];

export default function HelpCenter() {
    const [openFaq, setOpenFaq] = useState(null);

    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <Navbar />

            <main className="flex-1 mx-auto max-w-5xl px-6 py-12 sm:px-8 lg:px-10 w-full">
                {/* Header */}
                <div className="space-y-4 border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <HelpCircle size={14} />
                        <span>Official Support & Help Center</span>
                    </div>

                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
                        Help & Support Center
                    </h1>
                    <p className="max-w-3xl text-base text-gray-600 dark:text-gray-300">
                        Find answers to common questions, get assistance with orders, or contact the <strong>Tiffzy</strong> customer support desk operated by <strong>SURVETRA SERVICES</strong>.
                    </p>
                </div>

                {/* Legal Entity Ownership Callout */}
                <div className="my-8 rounded-3xl bg-amber-500/10 p-6 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-3">
                        <Building2 className="text-amber-600 dark:text-amber-400 shrink-0" size={24} />
                        <h2 className="text-lg font-bold">Official Business Notice</h2>
                    </div>
                    <p className="text-sm leading-relaxed">
                        <strong>Tiffzy is owned and operated by SURVETRA SERVICES.</strong> Customer support tickets, payment resolutions, and partner inquiries are serviced by <strong>SURVETRA SERVICES</strong>.
                    </p>
                </div>

                {/* FAQ Accordion */}
                <div className="space-y-6 my-10">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>

                    <div className="space-y-3">
                        {faqs.map((faq, idx) => (
                            <div key={idx} className="rounded-2xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                                <button
                                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                    className="w-full text-left p-5 font-bold text-sm text-gray-900 dark:text-white flex items-center justify-between gap-4"
                                >
                                    <span>{faq.q}</span>
                                    <ChevronDown size={18} className={`transition-transform ${openFaq === idx ? "rotate-180 text-amber-500" : "text-gray-400"}`} />
                                </button>
                                {openFaq === idx && (
                                    <div className="p-5 pt-0 text-xs sm:text-sm text-gray-600 dark:text-gray-300 border-t border-[var(--app-border,rgba(0,0,0,0.1))] leading-relaxed">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Support Contact Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-10">
                    <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-3 shadow-sm">
                        <Mail className="text-amber-500" size={24} />
                        <h3 className="font-bold text-base text-gray-900 dark:text-white">Email Support</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Email our support team for order inquiries or partner support.</p>
                        <p className="font-semibold text-xs text-amber-600 dark:text-amber-400">support@tiffzy.com</p>
                    </div>

                    <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-3 shadow-sm">
                        <Phone className="text-amber-500" size={24} />
                        <h3 className="font-bold text-base text-gray-900 dark:text-white">Phone Support</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Call our desk Mon-Sat 9am-7pm IST for urgent assistance.</p>
                        <p className="font-semibold text-xs text-amber-600 dark:text-amber-400">+91 91779 39713</p>
                    </div>

                    <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-3 shadow-sm">
                        <Trash2 className="text-rose-500" size={24} />
                        <h3 className="font-bold text-base text-gray-900 dark:text-white">Account Deletion</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Submit an online request to delete your account data.</p>
                        <Link to="/delete-account" className="font-bold text-xs text-rose-500 underline inline-block">
                            Go to Delete Account Page →
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
