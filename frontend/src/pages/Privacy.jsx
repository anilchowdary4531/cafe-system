import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { ShieldCheck, Building2, Lock, Trash2, Mail, CheckCircle2 } from "lucide-react";

export default function Privacy() {
    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <Navbar />

            <main className="flex-1 mx-auto max-w-4xl px-6 py-12 sm:px-10 lg:px-12 w-full">
                {/* Header */}
                <div className="space-y-4 border-b border-[var(--app-border,rgba(0,0,0,0.1))] pb-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <ShieldCheck size={14} />
                        <span>Google Play Compliant Privacy Policy</span>
                    </div>

                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
                        Privacy Policy
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Effective Date: August 9, 2026 | Last Updated: August 9, 2026
                    </p>
                </div>

                {/* Legal Entity Ownership Callout */}
                <div className="my-8 rounded-3xl bg-amber-500/10 p-6 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-3">
                        <Building2 className="text-amber-600 dark:text-amber-400 shrink-0" size={24} />
                        <h2 className="text-lg font-bold">Data Controller & Business Ownership</h2>
                    </div>
                    <p className="text-sm leading-relaxed">
                        This Privacy Policy applies to the Tiffzy web platform (<a href="https://www.tiffzy.com" className="underline font-bold">https://www.tiffzy.com</a>) and the Tiffzy Android mobile application. <strong>Tiffzy is owned and operated by SURVETRA SERVICES</strong> ("we", "us", or "our"). SURVETRA SERVICES is the primary Data Controller responsible for your personal information.
                    </p>
                </div>

                {/* Policy Sections */}
                <div className="space-y-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-10">
                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">1. Information We Collect</h2>
                        <p>We collect information to provide smart restaurant menu ordering, table management, payment processing, and account management services:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Account Information:</strong> Full Name, Email Address, Mobile Phone Number, Google OAuth Profile Picture URL, and encrypted passwords.</li>
                            <li><strong>Order & Transaction Data:</strong> Items ordered, table numbers, delivery addresses, order history, and payment status (processed securely via regulated third-party payment gateways like Razorpay/Cashfree).</li>
                            <li><strong>Technical & Device Data:</strong> Device model, operating system version, IP address, browser type, log data, and app usage metrics.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">2. How We Use Your Information</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>To create, authenticate, and manage your Tiffzy customer account.</li>
                            <li>To process dine-in, takeaway, or delivery food orders with participating restaurant partners.</li>
                            <li>To send transaction receipts, order status updates, and customer support responses.</li>
                            <li>To detect and prevent fraudulent transactions, unauthorized access, and security breaches.</li>
                            <li>To comply with legal obligations under applicable laws.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">3. Use of Location Services</h2>
                        <p>The Tiffzy Restaurant app requires access to your location (<strong>ACCESS_FINE_LOCATION</strong>) while the app is in use. This data is used solely to:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Display a list of restaurants currently serving your area.</li>
                            <li>Help users set precise delivery markers for food orders.</li>
                            <li><strong>Notice:</strong> We do not track your location in the background or sell your movement data to third parties.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">4. Third-Party Service Disclosures</h2>
                        <p>We do NOT sell, rent, or trade your personal data. We share minimal necessary data only with trusted infrastructure providers:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Google Sign-In / OAuth 2.0:</strong> For secure single sign-on authentication.</li>
                            <li><strong>Payment Gateway Partners:</strong> To securely process payment transactions (Tiffzy does not store raw credit card numbers or UPI PINs).</li>
                            <li><strong>Cloud Infrastructure (AWS / GCP):</strong> Encrypted database hosting and API processing.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Trash2 size={20} className="text-rose-500" />
                            <span>4. Account & Data Deletion Rights (Google Play Policy Compliance)</span>
                        </h2>
                        <p>
                            In compliance with Google Play Developer Policies, all Tiffzy users have the right to request full deletion of their account and associated data.
                        </p>
                        <div className="rounded-2xl bg-rose-500/10 p-4 border border-rose-500/20 text-rose-800 dark:text-rose-300 space-y-2">
                            <p className="font-bold text-sm">How to Request Account Deletion:</p>
                            <p className="text-xs">
                                You can delete your account instantly through our web portal by visiting our dedicated <Link to="/delete-account" className="underline font-bold">Account Deletion Page</Link> or by sending an email request to <strong>jekkaramesh@survetra.com</strong>. Upon verification, your profile, authentication records, and personal addresses will be permanently removed within 7 business days.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">5. Data Security Standards</h2>
                        <p>
                            We enforce industry-standard security measures including SSL/TLS 256-bit encryption for data in transit, AES-256 database encryption at rest, and strict role-based authorization controls to safeguard your data against unauthorized access.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">6. Children's Privacy</h2>
                        <p>
                            Tiffzy is intended for general audiences aged 18 and above. We do not knowingly collect personal information from children under 13 years of age.
                        </p>
                    </section>

                    <section className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-6 space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">7. Data Privacy Contact Information</h2>
                        <p>If you have any questions, privacy concerns, or data requests, please contact our Privacy Officer:</p>
                        <div className="text-xs space-y-1">
                            <p><strong className="text-gray-900 dark:text-gray-200">Legal Entity:</strong> SURVETRA SERVICES</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Registered Address:</strong> 13/640, Sasthri Nagar, Tadipatri, Andhra Pradesh, India</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">GSTIN:</strong> 37FJMPS3S3117Q1ZB</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Brand:</strong> Tiffzy</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Privacy Contact Email:</strong> jekkaramesh@survetra.com</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Phone:</strong> +91 91777 64632</p>
                            <p><strong className="text-gray-900 dark:text-gray-200">Official Website:</strong> https://www.tiffzy.com</p>
                        </div>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
