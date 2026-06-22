import { Link } from "react-router-dom";

const sections = [
    {
        title: "Inventory in Tiffzy",
        paragraphs: [
            "Inventory keeps track of ingredients, stock movement, and item availability so the restaurant can stay ahead of shortages.",
            "It supports the operational side of the platform by helping the team understand what needs to be replenished and what is running low.",
        ],
    },
    {
        title: "Why It Matters",
        paragraphs: [
            "A restaurant loses time and money when stock is not visible. Inventory makes it easier to plan purchases and avoid missing menu items during service.",
            "For a multi-role system like Tiffzy, inventory is an important part of keeping the kitchen, billing, and menu experiences aligned.",
        ],
    },
    {
        title: "How It Fits the Product",
        paragraphs: [
            "Inventory belongs beside orders, analytics, and menu management because all of them affect the same live restaurant operation.",
            "Tiffzy is meant to give the business a fuller picture, and inventory is one of the core layers that makes that possible.",
        ],
    },
];

export default function InventoryPage() {
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
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[#b06e2f]">Inventory</p>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Tiffzy Inventory</h1>
                    <p className="max-w-3xl text-lg leading-8 text-[#5b4030]">
                        This page explains inventory as part of the Tiffzy restaurant operations stack.
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
