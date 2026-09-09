import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SeoHead from "../components/SeoHead";
import { User, Code2, Building2, ChevronRight, ArrowLeft, Camera, Trash2 } from "lucide-react";
import { showToast } from "../utils/toast";

const STORAGE_KEY = "jekka_ramesh_profile_photo_v1";

export default function JekkaRameshProfile() {
    const fileInputRef = useRef(null);
    const [profilePic, setProfilePic] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || "";
        } catch {
            return "";
        }
    });

    const pageTitle = "Jekka Ramesh – Founder & Developer | Tiffzy";
    const pageDescription = "Jekka Ramesh is the Founder and Developer of Tiffzy, a smart QR restaurant ordering and food technology platform operated by SURVETRA SERVICES.";

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": "https://www.tiffzy.com/about/jekka-ramesh#person",
        "name": "Jekka Ramesh",
        "jobTitle": "Founder & Developer",
        "description": "Jekka Ramesh is the Founder and Developer of Tiffzy, a smart QR restaurant ordering and food technology platform.",
        "worksFor": {
            "@type": "Organization",
            "name": "SURVETRA SERVICES",
            "url": "https://www.tiffzy.com"
        },
        "url": "https://www.tiffzy.com/about/jekka-ramesh"
    };

    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            showToast({ title: "Invalid File", message: "Please select an image file (.png, .jpg, .webp)", variant: "error" });
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            const dataUrl = evt.target?.result;
            if (dataUrl) {
                setProfilePic(dataUrl);
                try {
                    localStorage.setItem(STORAGE_KEY, dataUrl);
                } catch {
                    // ignore
                }
                showToast({ title: "Photo Updated", message: "Profile photo updated from local device.", variant: "success" });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRemovePhoto = () => {
        setProfilePic("");
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
        showToast({ title: "Photo Removed", message: "Profile photo reset to default icon.", variant: "info" });
    };

    return (
        <div className="min-h-screen theme-adaptive flex flex-col">
            <SeoHead
                title={pageTitle}
                description={pageDescription}
                canonical="https://www.tiffzy.com/about/jekka-ramesh"
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
                    <span className="text-gray-900 dark:text-white font-bold">Jekka Ramesh</span>
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
                        <div className="flex flex-col items-center gap-2.5">
                            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-2 border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-md">
                                {profilePic ? (
                                    <img src={profilePic} alt="Jekka Ramesh" className="h-full w-full object-cover" />
                                ) : (
                                    <Code2 size={40} />
                                )}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/*"
                                onChange={handlePhotoUpload}
                                className="hidden"
                            />

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition active:scale-95"
                                >
                                    <Camera size={13} />
                                    <span>{profilePic ? "Change Photo" : "Upload Photo"}</span>
                                </button>
                                {profilePic ? (
                                    <button
                                        type="button"
                                        onClick={handleRemovePhoto}
                                        className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 p-1.5 text-xs font-bold text-red-500 hover:bg-red-500/20 transition active:scale-95"
                                        title="Remove Photo"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div>
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
                                <User size={13} />
                                <span>Leadership Profile</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                Jekka Ramesh
                            </h1>
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                                Founder &amp; Developer
                            </p>
                        </div>
                    </div>

                    <hr className="border-[var(--app-border,rgba(0,0,0,0.08))]" />

                    {/* Biography Section */}
                    <div className="space-y-4 text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Biography &amp; Role</h2>
                        <p className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-gray-800 dark:text-gray-200 font-medium">
                            &quot;Jekka Ramesh is the Founder and Developer of Tiffzy, a smart QR restaurant ordering and food technology platform. He leads the technology, software architecture, product development, and engineering of the Tiffzy platform.&quot;
                        </p>
                        <p>
                            As Founder &amp; Developer, Jekka Ramesh conceived the technical architecture and product vision behind Tiffzy. He oversees full-stack development, mobile user experiences, cloud integrations, QR ordering systems, live kitchen dispatches, and point-of-sale infrastructure for food businesses.
                        </p>
                    </div>

                    {/* Operating Entity Relation */}
                    <div className="rounded-2xl border border-[var(--app-border,rgba(0,0,0,0.1))] bg-gray-50 dark:bg-slate-800/60 p-6 space-y-3">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                            <Building2 size={16} className="text-amber-500" />
                            <span>Operating Entity Relation</span>
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            Tiffzy is owned and operated by <strong>SURVETRA SERVICES</strong> (Proprietor: <Link to="/about/thamineni-anil-kumar" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">Thamineni Anil Kumar</Link>). Jekka Ramesh serves as the Founder &amp; Developer leading the software platform.
                        </p>
                    </div>

                    {/* Internal Links Navigation */}
                    <div className="pt-4 flex flex-wrap gap-4 text-xs font-bold border-t border-[var(--app-border,rgba(0,0,0,0.08))]">
                        <Link to="/about-us" className="text-amber-600 dark:text-amber-400 hover:underline">
                            About Tiffzy &amp; Leadership →
                        </Link>
                        <Link to="/about/thamineni-anil-kumar" className="text-gray-600 dark:text-gray-400 hover:underline">
                            Thamineni Anil Kumar – Proprietor Profile →
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

