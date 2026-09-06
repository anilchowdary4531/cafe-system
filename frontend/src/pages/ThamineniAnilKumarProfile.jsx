import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SeoHead from "../components/SeoHead";
import { User, Building2, ShieldCheck, ChevronRight, ArrowLeft } from "lucide-react";

export default function ThamineniAnilKumarProfile() {
    const pageTitle = "Thamineni Anil Kumar – Proprietor | SURVETRA SERVICES";
    const pageDescription = "Thamineni Anil Kumar is the Proprietor of SURVETRA SERVICES, the business operating Tiffzy.";

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": "https://www.tiffzy.com/about/thamineni-anil-kumar#person",
        "name": "Thamineni Anil Kumar",
        "jobTitle": "Proprietor",
        "description": "Thamineni Anil Kumar is the Proprietor of SURVETRA SERVICES, the business operating Tiffzy.",
        "worksFor": {
            "@type": "Organization",
            "name": "SURVETRA SERVICES",
            "url": "https://www.tiffzy.com"
        },
        "url": "https://www.tiffzy.com/about/thamineni-anil-kumar"
    };

    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <SeoHead
                title={pageTitle}
                description={pageDescription}
                canonical="https://www.tiffzy.com/about/thamineni-anil-kumar"
                jsonLd={jsonLd}
            />
            <Navbar />

            <main className="flex-1 mx-auto max-w-4xl px-6 py-12 sm:px-8 lg:px-10 w-full">
                {/* Breadcrumbs */}
                <nav className="mb-8 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <Link to="/" className="hover:text-amber-600 dark:hover:text-amber-400">Home</Link>
                    <ChevronRight size={12} />
                    <Link to="/about-us" className="hover:text-amber-600 dark:hover:text-amber-400">About Us</Link>
                    <ChevronRight size={12} />
                    <span className="text-gray-900 dark:text-white font-bold">Thamineni Anil Kumar</span>
                </nav>

                {/* Back button */}
                <Link
                    to="/about-us"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline mb-6"
                >
                    <ArrowLeft size={14} />
                    <span>Back to About Tiffzy</span>
                </Link>

                {/* Header Card */}
                <div className="rounded-3xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
                            <Building2 size={36} />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
                                <User size={13} />
                                <span>Leadership Profile</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                Thamineni Anil Kumar
                            </h1>
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                                Proprietor – SURVETRA SERVICES
                            </p>
                        </div>
                    </div>

                    <hr className="border-[var(--app-border,rgba(0,0,0,0.08))]" />

                    {/* Biography Section */}
                    <div className="space-y-4 text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Business Ownership &amp; Management</h2>
                        <p className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-gray-800 dark:text-gray-200 font-medium">
                            &quot;Thamineni Anil Kumar is the Proprietor of SURVETRA SERVICES, the business operating Tiffzy.&quot;
                        </p>
                        <p>
                            As Proprietor of SURVETRA SERVICES, Thamineni Anil Kumar leads the commercial operations, business management, legal compliance, and operational execution for SURVETRA SERVICES and its commercial food business platform, Tiffzy.
                        </p>
                    </div>

                    {/* Legal Entity Card */}
                    <div className="rounded-2xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-gray-50 dark:bg-slate-800/60 p-6 space-y-3">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck size={16} className="text-emerald-500" />
                            <span>Business Operating Entity</span>
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            SURVETRA SERVICES is the registered sole proprietorship operating Tiffzy. The software platform product vision and technology development are led by Founder &amp; Developer <Link to="/about/jekka-ramesh" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">Jekka Ramesh</Link>.
                        </p>
                    </div>

                    {/* Internal Links Navigation */}
                    <div className="pt-4 flex flex-wrap gap-4 text-xs font-bold border-t border-[var(--app-border,rgba(0,0,0,0.08))]">
                        <Link to="/about-us" className="text-amber-600 dark:text-amber-400 hover:underline">
                            About Tiffzy &amp; Leadership →
                        </Link>
                        <Link to="/about/jekka-ramesh" className="text-gray-600 dark:text-gray-400 hover:underline">
                            Jekka Ramesh – Founder &amp; Developer Profile →
                        </Link>
                        <Link to="/" className="text-gray-500 hover:underline">
                            Return to Homepage
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
