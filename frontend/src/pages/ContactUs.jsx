import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Mail, Phone, MapPin, Clock, Building2, Send, CheckCircle2, ShieldCheck } from "lucide-react";
import { showToast } from "../utils/toast";

export default function ContactUs() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [message, setMessage] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !email || !message) {
            showToast({ title: "Validation Error", message: "Please complete all required fields.", variant: "error" });
            return;
        }
        setSubmitted(true);
        showToast({ title: "Message Sent", message: "Thank you for contacting Tiffzy. We will respond shortly.", variant: "success" });
    };

    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <Navbar />

            <main className="flex-1 mx-auto max-w-5xl px-6 py-12 sm:px-8 lg:px-10 w-full">
                {/* Header */}
                <div className="space-y-4 border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Building2 size={14} />
                        <span>Official Customer Support & Contact</span>
                    </div>

                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
                        Contact Us
                    </h1>
                    <p className="max-w-3xl text-base text-gray-600 dark:text-gray-300">
                        Have a question, feedback, or business inquiry? Get in touch with the <strong>Tiffzy</strong> team operated by <strong>SURVETRA SERVICES</strong>.
                    </p>
                </div>

                {/* Ownership Notice Callout */}
                <div className="my-8 rounded-3xl bg-amber-500/10 p-5 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
                    <p className="font-bold flex items-center gap-2">
                        <ShieldCheck size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Legal Business Notice</span>
                    </p>
                    <p className="mt-1">
                        <strong>Tiffzy is owned and operated by SURVETRA SERVICES.</strong> All customer support inquiries, payment settlements, and partner onboarding are managed under the legal business entity <strong>SURVETRA SERVICES</strong>.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 my-10">
                    {/* Contact Details Card */}
                    <div className="space-y-6">
                        <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-3">
                                Official Contact Information
                            </h2>

                            <div className="space-y-4 text-sm">
                                <div className="flex items-start gap-3">
                                    <Building2 className="text-amber-500 shrink-0 mt-1" size={18} />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Legal Business Name</p>
                                        <p className="text-gray-600 dark:text-gray-300">SURVETRA SERVICES</p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400">Brand: Tiffzy</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Mail className="text-amber-500 shrink-0 mt-1" size={18} />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Customer Support Email</p>
                                        <p className="text-gray-600 dark:text-gray-300">support@tiffzy.com</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Phone className="text-amber-500 shrink-0 mt-1" size={18} />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Phone Number</p>
                                        <p className="text-gray-600 dark:text-gray-300">+91 91779 39713</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Clock className="text-amber-500 shrink-0 mt-1" size={18} />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Support Operating Hours</p>
                                        <p className="text-gray-600 dark:text-gray-300">Monday – Saturday: 9:00 AM – 7:00 PM (IST)</p>
                                        <p className="text-xs text-gray-400">Sunday: Closed</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 pt-2 border-t border-[var(--app-border,rgba(0,0,0,0.1))]">
                                    <MapPin className="text-amber-500 shrink-0 mt-1" size={18} />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Registered Address</p>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-xs sm:text-sm">
                                            SURVETRA SERVICES<br />
                                            Main Road, Customer Desk,<br />
                                            Andhra Pradesh / Telangana, India - 500001
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl bg-amber-500/10 p-6 border border-amber-500/20 text-xs space-y-2">
                            <p className="font-bold text-amber-900 dark:text-amber-300">Looking for Legal Disclosures?</p>
                            <p className="text-amber-800 dark:text-amber-400">
                                View our full official company registration details on our <Link to="/legal" className="underline font-bold">Legal Information Page</Link>.
                            </p>
                        </div>
                    </div>

                    {/* Interactive Form */}
                    <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                            Send Us a Message
                        </h2>

                        {submitted ? (
                            <div className="py-12 text-center space-y-4">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                                    <CheckCircle2 size={36} />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Message Received</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
                                    Thank you for reaching out to <strong>SURVETRA SERVICES (Tiffzy)</strong>. Our customer support team will reply to your email within 24 hours.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Ramesh Nanda"
                                        className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="e.g. name@example.com"
                                        className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                        Phone Number (Optional)
                                    </label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="e.g. +91 91779 39713"
                                        className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                        Message / Inquiry *
                                    </label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Describe your inquiry or support request..."
                                        className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 text-sm shadow-md transition"
                                >
                                    <Send size={16} />
                                    <span>Send Message to Support</span>
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
