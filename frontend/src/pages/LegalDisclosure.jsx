import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BrandLogo from "../components/BrandLogo";

export default function LegalDisclosure() {
    return (
        <div className="theme-page min-h-screen flex flex-col bg-[#0a0a0a] text-[#f5efe0]">
            <Navbar />

            <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-16 sm:px-8">
                {/* Header Section */}
                <div className="mb-12 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
                        <div className="h-20 w-20 flex items-center justify-center rounded-3xl bg-white/5 border border-white/10 shadow-2xl p-4">
                            <BrandLogo className="h-full w-full" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.4em] text-[#f59e0b] mb-1">Official Verification</p>
                            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white">
                                Legal Disclosure
                            </h1>
                        </div>
                    </div>
                    <p className="text-xl text-[#f5efe0]/60 max-w-3xl leading-relaxed">
                        Official business disclosure & legal verification for the Tiffzy platform and SURVETRA SERVICES.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* Legal Business Information */}
                        <section className="rounded-[2.5rem] border border-white/10 bg-white/5 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
                            <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-6">Legal Business Information</h2>
                            <p className="text-lg leading-relaxed text-[#f5efe0]/80">
                                Tiffzy is a commercial digital food ordering and restaurant management platform owned and operated by <strong className="text-white">SURVETRA SERVICES</strong>.
                            </p>
                        </section>

                        {/* Ownership Declaration */}
                        <section className="rounded-[2.5rem] border border-white/10 bg-white/5 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
                            <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-6">Ownership Declaration</h2>
                            <div className="space-y-4 text-[#f5efe0]/70 text-[17px] leading-relaxed">
                                <p>
                                    This website (https://www.tiffzy.com), the Tiffzy Android mobile application available on Google Play, and all associated digital products and APIs are owned, registered, operated, and managed exclusively by <strong className="text-white">SURVETRA SERVICES</strong>.
                                </p>
                            </div>
                        </section>

                        {/* Registered Entity Details Grid */}
                        <section className="rounded-[2.5rem] border border-white/10 bg-white/5 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
                            <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-10">Registered Entity Details</h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
                                <DetailItem label="Legal Business Name" value="SURVETRA SERVICES" />
                                <DetailItem label="Brand / Trade Name" value="Tiffzy" />
                                <DetailItem label="Business Entity Type" value="Registered Business / Sole Proprietorship" />
                                <DetailItem label="Official Website" value="https://www.tiffzy.com" isLink />
                                <DetailItem label="Support Email" value="jekkaramesh@survetra.com" />
                                <DetailItem label="Customer Support Phone" value="+91 91777 64632" />
                                <DetailItem label="GSTIN (Tax ID)" value="37FJMPS3S3117Q1ZB" isMono />
                                <DetailItem label="MSME / UDYAM Reg No." value="UDYAM-AP-00-0000000" isMono />
                            </div>

                            <div className="mt-12 pt-10 border-t border-white/10">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f59e0b] mb-4">Registered Office & Contact Address</p>
                                <address className="not-italic text-2xl font-bold leading-tight text-white space-y-1">
                                    <p>SURVETRA SERVICES</p>
                                    <p className="text-[#f5efe0]/60 text-xl font-medium">13/640, Sasthri Nagar,</p>
                                    <p className="text-[#f5efe0]/60 text-xl font-medium">Tadipatri, Andhra Pradesh, India</p>
                                </address>
                            </div>
                        </section>

                        {/* Google Play Statement */}
                        <section className="rounded-[2.5rem] border border-blue-500/20 bg-blue-500/5 p-8 backdrop-blur-xl">
                            <h2 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-blue-400">Google Play Developer Verification</h2>
                            <p className="text-[15px] leading-relaxed text-blue-100/60">
                                This page serves as official public verification for Google Play Console, financial institutions, payment gateways, and regulatory authorities. All mobile applications published under the developer account <strong className="text-white">SURVETRA SERVICES</strong> on the Google Play Store represent official digital software products of SURVETRA SERVICES.
                            </p>
                        </section>
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="rounded-[2rem] bg-[#f59e0b] p-8 text-black shadow-2xl">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-black/50 mb-6">Quick Contact</h3>
                            <div className="space-y-8">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-black/40 mb-1">Email Support</p>
                                    <p className="text-lg font-black break-all">jekkaramesh@survetra.com</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-black/40 mb-1">Customer Care</p>
                                    <p className="text-2xl font-black">+91 91777 64632</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-white/5 bg-white/2 p-8 text-center">
                            <p className="text-xs font-bold uppercase tracking-widest text-[#f5efe0]/30">
                                Last Updated: Feb 2026
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

function DetailItem({ label, value, isMono = false, isLink = false }) {
    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f59e0b] mb-2">{label}</p>
            {isLink ? (
                <a href={value} target="_blank" rel="noreferrer" className="text-lg font-bold text-white underline decoration-white/20 underline-offset-8 transition hover:decoration-[#f59e0b]">{value}</a>
            ) : (
                <p className={`text-lg font-bold text-white ${isMono ? 'font-mono tracking-tighter' : ''}`}>{value}</p>
            )}
        </div>
    );
}
