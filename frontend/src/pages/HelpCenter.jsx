import { Link } from "react-router-dom";

const sections = [
    {
        title: "Getting Started",
        paragraphs: [
            "Welcome to the Tiffzy Help Center. This page is here to help customers, restaurant teams, and business users understand how the platform works and where to go when they need support.",
            "If you are visiting Tiffzy for the first time, start by choosing a restaurant, opening its menu, and checking whether you want to order for delivery, pickup, or dine-in where supported.",
        ],
    },
    {
        title: "For Customers",
        paragraphs: [
            "You can browse menus, add items to your cart, sign in to manage your profile, and view your order history from the customer sections of the app.",
            "If something looks wrong with an order, the fastest next step is to use the contact details on this page so the team can review your issue and guide you through the right support path.",
        ],
    },
    {
        title: "For Restaurant Teams",
        paragraphs: [
            "Staff members can use the billing desk, kitchen tools, server screens, and staff profile pages to manage live restaurant activity.",
            "Owners and managers can use the owner dashboard, menu studio, tables, kitchen live board, analytics, finance, staff, settings, and notifications to control operations.",
        ],
    },
    {
        title: "Common Questions",
        paragraphs: [
            "How do I open a restaurant menu? Use the restaurant link or home screen and navigate into the restaurant-specific menu or ordering flow.",
            "How do I get help with a payment or refund? Use the support contact details below so the team can review the order and the payment state.",
            "How do I access business tools? Business users sign in through the appropriate protected route and only see the tools allowed by their role.",
        ],
    },
    {
        title: "Need More Help",
        paragraphs: [
            "If your question is not covered here, please reach out using the contact details below. Include as much detail as possible so the team can respond faster, such as your restaurant name, order number, screen name, or the time the problem happened.",
        ],
    },
];

const contactLines = [
    "Tiffzy",
    "Website: https://www.tiffzy.com",
    "Email: rameshnanda@tiffzy.com",
    "Phone: +91 9177764632",
];

export default function HelpCenter() {
    return (
        <div
            className="min-h-screen"
            style={{
                background:
                    "radial-gradient(circle at top left, rgba(245,185,78,0.10), transparent 26%), radial-gradient(circle at top right, rgba(169,113,48,0.10), transparent 24%), linear-gradient(180deg, var(--app-bg) 0%, color-mix(in srgb, var(--app-bg) 86%, #1a1208 14%) 100%)",
                color: "var(--app-text)",
                fontFamily: 'Georgia, "Times New Roman", serif',
            }}
        >
            <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14">
                <div className="mb-10 flex items-center justify-between gap-4 text-sm">
                    <Link
                        to="/"
                        className="text-[color:var(--app-primary)] transition hover:text-[color:var(--app-primary-hover)]"
                    >
                        Back to Tiffzy
                    </Link>
                    <span className="uppercase tracking-[0.35em] text-[color:var(--app-muted)]">Support page</span>
                </div>

                <header className="max-w-4xl">
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[color:var(--app-primary)]">Help Center</p>
                    <h1 className="mt-4 text-4xl font-bold leading-tight text-[color:var(--app-text)] sm:text-5xl lg:text-6xl">
                        Tiffzy Help Center
                    </h1>
                    <p className="mt-6 max-w-3xl text-lg leading-8 text-[color:var(--app-muted-strong)] sm:text-xl">
                        This page is written for real Tiffzy users who need quick help with ordering, restaurant tools,
                        staff workflows, and account support.
                    </p>
                </header>

                <section className="mt-12 border-t border-[color:var(--app-border)] pt-8">
                    <p className="text-sm uppercase tracking-[0.32em] text-[color:var(--app-muted)]">Support overview</p>
                    <p className="mt-4 max-w-4xl text-[17px] leading-8 text-[color:var(--app-muted-strong)]">
                        Tiffzy support is organized to help both sides of the platform. Customers can get help with browsing,
                        ordering, and account issues, while restaurant teams can get guidance on live operations, billing,
                        kitchen flow, and owner tools.
                    </p>
                </section>

                <article className="mt-12 space-y-12">
                    {sections.map((section) => (
                        <section key={section.title} className="max-w-4xl">
                            <h2 className="text-2xl font-bold text-[color:var(--app-text)]">{section.title}</h2>
                            <div className="mt-4 space-y-5 text-[17px] leading-8 text-[color:var(--app-muted-strong)]">
                                {section.paragraphs.map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                            </div>
                        </section>
                    ))}
                </article>

                <section className="mt-14 border-t border-[color:var(--app-border)] pt-8">
                    <h2 className="text-2xl font-bold text-[color:var(--app-text)]">Contact Tiffzy Support</h2>
                    <div className="mt-4 space-y-3 text-[17px] leading-8 text-[color:var(--app-muted-strong)]">
                        {contactLines.map((line) => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>
                </section>

                <p className="mt-12 max-w-4xl text-sm leading-7 text-[color:var(--app-muted)]">
                    If you want, we can also add a small FAQ link or a dedicated contact form later.
                </p>
            </main>
        </div>
    );
}
