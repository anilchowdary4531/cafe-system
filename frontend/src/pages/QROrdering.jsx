import { Link } from "react-router-dom";

const sections = [
    {
        title: "What QR Ordering Means in Tiffzy",
        paragraphs: [
            "QR Ordering lets customers open a restaurant menu from a scan or a link and move straight into browsing and ordering without extra steps.",
            "It is designed for dine-in speed, simple table journeys, and a cleaner front-of-house experience for both the customer and the restaurant team.",
        ],
    },
    {
        title: "How It Fits the App",
        paragraphs: [
            "In the current Tiffzy flow, QR Ordering connects the public menu journey with restaurant-specific routing, table context, and customer checkout paths.",
            "It supports the idea that a guest can arrive with a table number or restaurant slug and immediately land on the right menu experience.",
        ],
    },
    {
        title: "Why It Helps",
        paragraphs: [
            "QR Ordering reduces waiting time, cuts down manual menu handling, and makes it easier for customers to explore items at their own pace.",
            "For restaurants, it helps reduce order friction, keeps the ordering flow organized, and supports a more modern dine-in service style.",
        ],
    },
];

export default function QROrdering() {
    return (
        <div className="min-h-screen bg-white text-[#24160d]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            <main className="mx-auto max-w-4xl px-6 py-10 sm:px-10 sm:py-14 lg:px-12 lg:py-16">
                <div className="flex items-center justify-between gap-4 text-sm">
                    <Link to="/" className="text-[#8a5b2b] transition hover:text-[#5d3c1f]">
                        Back to Tiffzy
                    </Link>
                    <span className="uppercase tracking-[0.32em] text-[#a07b58]">Product page</span>
                </div>

                <header className="mt-10 space-y-4">
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[#b06e2f]">QR Ordering</p>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Tiffzy QR Ordering</h1>
                    <p className="max-w-3xl text-lg leading-8 text-[#5b4030]">
                        This page explains how QR Ordering works inside Tiffzy and why it matters for dine-in restaurants.
                    </p>
                </header>

                <article className="mt-12 space-y-10 text-[17px] leading-8">
                    {sections.map((section) => (
                        <section key={section.title} className="space-y-4">
                            <h2 className="text-2xl font-bold text-[#3b2819]">{section.title}</h2>
                            {section.paragraphs.map((paragraph) => (
                                <p key={paragraph} className="text-[#4d3728]">
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
