import { Link } from "react-router-dom";

const sections = [
    {
        title: "Get in Touch",
        paragraphs: [
            "We are here to assist you with any questions, support requests, feedback, or business inquiries.",
            "Website: https://www.tiffzy.com",
            "Email: rameshnanda@tiffzy.com",
            "Phone: +91 9177764632",
        ],
    },
    {
        title: "Support Hours",
        paragraphs: [
            "Monday - Saturday: 9:00 AM - 7:00 PM (IST)",
            "Sunday: Closed",
        ],
    },
    {
        title: "Business Inquiries",
        paragraphs: [
            "For partnerships, payment integration support, restaurant onboarding, or other business-related queries, please contact us at:",
            "Email: rameshnanda@tiffzy.com",
        ],
    },
];

export default function ContactUs() {
    return (
        <div className="min-h-screen bg-[#f7f0e3] text-[#2f2217]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            <main className="mx-auto max-w-4xl px-6 py-10 sm:px-10 sm:py-14 lg:px-12 lg:py-16">
                <div className="flex items-center justify-between gap-4 text-sm">
                    <Link to="/" className="text-[#8a5b2b] transition hover:text-[#5d3c1f]">
                        Back to Tiffzy
                    </Link>
                    <p className="uppercase tracking-[0.32em] text-[#a07b58]">Support page</p>
                </div>

                <header className="mt-10 space-y-4">
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[#b06e2f]">Contact Us</p>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Tiffzy Contact Us</h1>
                    <p className="max-w-3xl text-lg leading-8 text-[#513a29]">
                        This page provides the main contact details for Tiffzy support, business inquiries, and general assistance.
                    </p>
                </header>

                <article className="mt-12 space-y-10 text-[17px] leading-8">
                    {sections.map((section) => (
                        <section key={section.title} className="space-y-4">
                            <h2 className="text-2xl font-bold text-[#3b2819]">{section.title}</h2>
                            {section.paragraphs.map((paragraph, index) => (
                                <p key={`${section.title}-${index}`} className="text-[#4d3728]">
                                    {paragraph}
                                </p>
                            ))}
                        </section>
                    ))}
                </article>

                <p className="mt-12 text-sm leading-7 text-[#6f5340]">
                    We aim to respond to all inquiries as quickly as possible and appreciate your interest in Tiffzy.
                </p>
            </main>
        </div>
    );
}
