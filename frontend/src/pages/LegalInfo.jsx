import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Building2, ShieldCheck, Mail, Phone, Globe, MapPin, FileText, CheckCircle2 } from "lucide-react";

export default function LegalInfo() {
    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <Navbar />

            <main className="flex-1 mx-auto max-w-4xl px-6 py-12 sm:px-10 lg:px-12 w-full">
                {/* Header */}
                <div className="space-y-4 border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <ShieldCheck size={14} />
                        <span>Official Business Disclosure & Legal Verification</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
                        Legal Business Information
                    </h1>
                    <p className="text-base text-gray-600 dark:text-gray-300">
                        Tiffzy is a commercial digital food ordering and restaurant management platform owned and operated by <strong>SURVETRA SERVICES</strong>.
                    </p>
                </div>

                {/* Ownership Notice Banner */}
                <div className="my-8 rounded-3xl bg-amber-500/10 p-6 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-3">
                        <Building2 className="text-amber-600 dark:text-amber-400 shrink-0" size={24} />
                        <h2 className="text-lg font-bold">Ownership Declaration</h2>
                    </div>
                    <p className="text-sm leading-relaxed">
                        This website (<a href="https://www.tiffzy.com" className="underline font-semibold">https://www.tiffzy.com</a>), the Tiffzy Android mobile application available on Google Play, and all associated digital products and APIs are owned, registered, operated, and managed exclusively by <strong>SURVETRA SERVICES</strong>.
                    </p>
                </div>

                {/* Company Details Table */}
                <div className="space-y-8">
                    <section className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-3 flex items-center gap-2">
                            <FileText className="text-amber-500" size={20} />
                            <span>Registered Entity Details</span>
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="space-y-1">
                                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Legal Business Name</span>
                                <p className="font-bold text-gray-900 dark:text-white text-base">SURVETRA SERVICES</p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Brand / Trade Name</span>
                                <p className="font-bold text-amber-500 text-base">Tiffzy</p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Business Entity Type</span>
                                <p className="font-semibold text-gray-700 dark:text-gray-300">Registered Business / Sole Proprietorship</p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Official Website</span>
                                <p className="font-semibold text-amber-600 dark:text-amber-400">
                                    <a href="https://www.tiffzy.com" target="_blank" rel="noopener noreferrer">https://www.tiffzy.com</a>
                                </p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Support Email</span>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">support@tiffzy.com</p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Customer Support Phone</span>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">+91 91779 39713</p>
                            </div>

                            <div className="space-y-1 md:col-span-2">
                                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Registered Office & Contact Address</span>
                                <p className="font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
                                    SURVETRA SERVICES<br />
                                    Main Road, Near Bus Station, Customer Support Desk,<br />
                                    Andhra Pradesh / Telangana, India - 500001
                                </p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">GSTIN (Tax ID)</span>
                                <p className="font-mono font-bold text-gray-700 dark:text-gray-300">36XXXXX0000X1Z5 (Provided upon invoice)</p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">MSME / UDYAM Reg No.</span>
                                <p className="font-mono font-bold text-gray-700 dark:text-gray-300">UDYAM-AP-00-0000000</p>
                            </div>
                        </div>
                    </section>

                    {/* Developer Verification Notice */}
                    <section className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <CheckCircle2 className="text-emerald-500" size={20} />
                            <span>Google Play Developer Verification Statement</span>
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            This page serves as official public verification for Google Play Console, financial institutions, payment gateways, and regulatory authorities. All mobile applications published under the developer account <strong>SURVETRA SERVICES</strong> on the Google Play Store represent official digital software products of SURVETRA SERVICES.
                        </p>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
