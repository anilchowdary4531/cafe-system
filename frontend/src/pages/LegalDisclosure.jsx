import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function LegalDisclosure() {
    return (
        <>
            <Navbar />
            <div className="mx-auto max-w-4xl px-8 py-20">
                <h1 className="mb-10 text-4xl font-black tracking-tight text-white">
                    Legal & Business Information
                </h1>

                <div className="space-y-8 text-[17px] leading-relaxed text-[#f5efe0]/80">
                    <section className="bg-white/5 p-8 rounded-2xl border border-white/10">
                        <h2 className="mb-6 text-xl font-bold text-white uppercase tracking-widest">Entity Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Legal Business Name</p>
                                <p className="text-lg text-white font-semibold">SURVETRA SERVICES</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Brand Name</p>
                                <p className="text-lg text-white font-semibold">Tiffzy</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Entity Type</p>
                                <p className="text-white">Proprietorship / Registered Business</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Registered Address</p>
                                <p className="text-white">H.No 1-1-1, Near Main Road, Hyderabad, Telangana, India - 500001</p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white/5 p-8 rounded-2xl border border-white/10">
                        <h2 className="mb-6 text-xl font-bold text-white uppercase tracking-widest">Compliance</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">GSTIN</p>
                                <p className="text-white font-mono">[Insert GST Number Here]</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Registration No</p>
                                <p className="text-white font-mono">[Insert CIN/Registration No]</p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white/5 p-8 rounded-2xl border border-white/10">
                        <h2 className="mb-6 text-xl font-bold text-white uppercase tracking-widest">Contact Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Official Email</p>
                                <p className="text-white">support@tiffzy.com</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Phone</p>
                                <p className="text-white">+91 91779 39713</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-[#f59e0b] uppercase mb-1">Website</p>
                                <p className="text-white">https://www.tiffzy.com</p>
                            </div>
                        </div>
                    </section>

                    <p className="text-sm italic text-center mt-12">
                        Tiffzy is a smart QR ordering and restaurant management platform developed and maintained by SURVETRA SERVICES.
                    </p>
                </div>
            </div>
            <Footer />
        </>
    );
}
