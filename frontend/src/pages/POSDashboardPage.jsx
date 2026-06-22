import { Link } from "react-router-dom";

const sections = [
    {
        title: "What the POS Dashboard Does",
        paragraphs: [
            "The POS Dashboard is the working screen for restaurant billing, order handling, and front-of-house operations inside Tiffzy.",
            "It brings fast actions into one place so staff can focus on serving guests instead of switching between tools.",
        ],
    },
    {
        title: "How Staff Use It",
        paragraphs: [
            "Billing teams can take new orders, handle payment-related steps, and move work through the flow without leaving the operational screen.",
            "The design of the app already shows that billing and service roles are meant to work in real time, alongside kitchen and server screens.",
        ],
    },
    {
        title: "Why It Matters",
        paragraphs: [
            "A good POS view reduces mistakes, shortens queues, and keeps the restaurant moving even during busy hours.",
            "In Tiffzy, the POS Dashboard acts as part of the wider operations system rather than a separate disconnected tool.",
        ],
    },
];

export default function POSDashboardPage() {
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
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[#b06e2f]">POS Dashboard</p>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Tiffzy POS Dashboard</h1>
                    <p className="max-w-3xl text-lg leading-8 text-[#5b4030]">
                        This page describes the billing and operations side of Tiffzy in a simple paper-style layout.
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
