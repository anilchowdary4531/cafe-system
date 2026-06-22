import { Link } from "react-router-dom";

const sections = [
    {
        title: "Restaurant Subscription",
        paragraphs: [
            "Tiffzy offers a subscription-based plan for restaurants, cafés, cloud kitchens, and food businesses.",
        ],
    },
    {
        title: "Standard Plan",
        paragraphs: [
            "Subscription Fee: ₹500 per month per restaurant",
            "Access to Tiffzy's restaurant management platform",
            "Online ordering features",
            "Digital menu management",
            "Billing and payment management tools",
            "Customer engagement features",
            "Basic support services",
        ],
    },
    {
        title: "Custom Pricing",
        paragraphs: [
            "The subscription fee is negotiable and may vary depending on business requirements, number of outlets or branches, additional features requested, custom integrations and services, and enterprise support requirements.",
            "Final pricing will be mutually agreed upon between Tiffzy and the restaurant before activation of services.",
        ],
    },
    {
        title: "Changes to Pricing",
        paragraphs: [
            "Tiffzy reserves the right to modify its pricing and subscription plans at any time. Existing customers will be informed of any applicable changes before they take effect.",
        ],
    },
    {
        title: "Contact Us",
        paragraphs: [
            "Tiffzy",
            "Website: https://www.tiffzy.com",
            "Email: rameshnanda@tiffzy.com",
            "Phone: +91 9177764632",
        ],
    },
];

export default function Pricing() {
    return (
        <div className="min-h-screen bg-[#f7f0e3] text-[#2f2217]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            <main className="mx-auto max-w-4xl px-6 py-10 sm:px-10 sm:py-14 lg:px-12 lg:py-16">
                <div className="flex items-center justify-between gap-4 text-sm">
                    <Link to="/" className="text-[#8a5b2b] transition hover:text-[#5d3c1f]">
                        Back to Tiffzy
                    </Link>
                    <p className="uppercase tracking-[0.32em] text-[#a07b58]">Company page</p>
                </div>

                <header className="mt-10 space-y-4">
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[#b06e2f]">Pricing</p>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Tiffzy Pricing</h1>
                    <p className="max-w-3xl text-lg leading-8 text-[#513a29]">
                        Welcome to Tiffzy Pricing.
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

            </main>
        </div>
    );
}
