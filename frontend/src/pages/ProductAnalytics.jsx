import { Link } from "react-router-dom";

const sections = [
    {
        title: "Analytics in Tiffzy",
        paragraphs: [
            "Analytics helps restaurant owners understand orders, service trends, and performance across the platform.",
            "Tiffzy already includes owner analytics views and reporting-oriented pages, so this product page explains that part of the system in simple language.",
        ],
    },
    {
        title: "What It Helps You See",
        paragraphs: [
            "Analytics can help you understand busy hours, popular items, order patterns, and how the restaurant is operating over time.",
            "It is useful for making better decisions about staffing, menu changes, and day-to-day business planning.",
        ],
    },
    {
        title: "Why It Belongs in Tiffzy",
        paragraphs: [
            "A restaurant platform should not only take orders. It should also help the business learn from those orders and improve with confidence.",
            "That is why analytics is part of the larger Tiffzy stack rather than a separate reporting add-on.",
        ],
    },
];

export default function ProductAnalytics() {
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
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[#b06e2f]">Analytics</p>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Tiffzy Analytics</h1>
                    <p className="max-w-3xl text-lg leading-8 text-[#5b4030]">
                        This page explains Tiffzy analytics in a calm, text-first format without cards or panels.
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
