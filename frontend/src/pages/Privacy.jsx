import { Link } from "react-router-dom";

const sections = [
    {
        title: "1. Information We Collect",
        paragraphs: [
            "We may collect information that you voluntarily provide, including name, email address, phone number, business information, restaurant details, profile information, customer support communications, and information submitted during account registration.",
            "When you use the Platform, we may automatically collect device information, IP address, browser type and version, operating system, usage information, log data, cookies, and similar technologies.",
            "Payments may be processed through third-party payment providers. Tiffzy does not store sensitive payment information such as card numbers, CVV numbers, UPI PINs, or banking passwords.",
        ],
    },
    {
        title: "2. How We Use Your Information",
        paragraphs: [
            "We may use your information to create and manage your account, provide and improve our services, process transactions, verify business and merchant accounts, respond to customer support requests, send service-related communications, detect fraud and security threats, comply with legal obligations, and analyze platform performance and usage trends.",
        ],
    },
    {
        title: "3. Sharing of Information",
        paragraphs: [
            "We may share information with payment gateway providers, technology service providers, analytics providers, cloud hosting providers, government authorities when required by law, and business partners necessary for providing services.",
            "We do not sell your personal information to third parties.",
        ],
    },
    {
        title: "4. Cookies and Tracking Technologies",
        paragraphs: [
            "Tiffzy may use cookies and similar technologies to keep you signed in, remember preferences, improve website functionality, analyze usage and performance, and enhance user experience.",
            "You may disable cookies through your browser settings, although certain features may not function properly.",
        ],
    },
    {
        title: "5. Data Security",
        paragraphs: [
            "We implement reasonable administrative, technical, and organizational safeguards to protect your information from unauthorized access, disclosure, alteration, or destruction.",
            "However, no method of internet transmission or electronic storage is completely secure, and we cannot guarantee absolute security.",
        ],
    },
    {
        title: "6. Data Retention",
        paragraphs: [
            "We retain personal information only for as long as necessary to provide our services, comply with legal obligations, resolve disputes, enforce agreements, and maintain business records.",
        ],
    },
    {
        title: "7. Your Rights",
        paragraphs: [
            "Depending on applicable law, you may have the right to access your personal information, correct inaccurate information, request deletion of your information, withdraw consent where applicable, and request information regarding how your data is used.",
            "To exercise these rights, please contact us using the details below.",
        ],
    },
    {
        title: "8. Children's Privacy",
        paragraphs: [
            "Tiffzy is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.",
            "If we become aware that information has been collected from a child, we will take reasonable steps to delete it.",
        ],
    },
    {
        title: "9. Third-Party Services",
        paragraphs: [
            "Our Platform may contain links or integrations with third-party services, including payment providers and external applications.",
            "We are not responsible for the privacy practices of third-party services and encourage you to review their privacy policies.",
        ],
    },
    {
        title: "10. Changes to This Privacy Policy",
        paragraphs: [
            "We may update this Privacy Policy from time to time. Updated versions will be posted on this page with a revised Last Updated date.",
            "Continued use of the Platform after changes become effective constitutes acceptance of the updated Privacy Policy.",
        ],
    },
    {
        title: "11. Contact Us",
        paragraphs: [
            "If you have any questions regarding this Privacy Policy or your personal information, please contact us:",
            "Tiffzy",
            "Website: https://www.tiffzy.com",
            "Email: rameshnanda@tiffzy.com",
            "Phone: +91 9177764632",
        ],
    },
];

export default function Privacy() {
    return (
        <div className="min-h-screen bg-[#f7f0e3] text-[#2f2217]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            <main className="mx-auto max-w-4xl px-6 py-10 sm:px-10 sm:py-14 lg:px-12 lg:py-16">
                <div className="flex items-center justify-between gap-4 text-sm">
                    <Link to="/" className="text-[#8a5b2b] transition hover:text-[#5d3c1f]">
                        Back to Tiffzy
                    </Link>
                    <p className="uppercase tracking-[0.32em] text-[#a07b58]">Legal document</p>
                </div>

                <header className="mt-10 space-y-4">
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[#b06e2f]">Privacy Policy</p>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Tiffzy Privacy Policy</h1>
                    <p className="max-w-3xl text-lg leading-8 text-[#513a29]">
                        This page is written as a continuous privacy notice for Tiffzy users, restaurant partners, and business
                        users. Please read it carefully before using the platform.
                    </p>
                    <p className="text-sm uppercase tracking-[0.28em] text-[#8e6a45]">Last updated: June 21, 2026</p>
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
                    This draft is intentionally plain and paper-like, with no cards or split panels, so the Privacy Policy
                    reads like a proper legal notice.
                </p>
            </main>
        </div>
    );
}
