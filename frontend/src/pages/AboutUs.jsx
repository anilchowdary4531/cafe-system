import { Link } from "react-router-dom";

const sections = [
    {
        title: "What Tiffzy Is",
        paragraphs: [
            "Tiffzy is a restaurant operations platform built to connect public ordering, restaurant management, staff workflows, and owner controls in one system.",
            "The app is designed so customers can browse, order, and track more easily, while restaurants can manage menus, billing, tables, kitchen flow, analytics, finance, and staff without jumping between different tools.",
        ],
    },
    {
        title: "What the App Already Covers",
        paragraphs: [
            "The current codebase shows a full multi-role product, not just a landing site. The frontend already includes public pages, customer profiles, restaurant menu journeys, cart and checkout flows, staff screens, owner dashboards, and super-admin pages.",
            "On the backend, the system is organized around services and routes for authentication, orders, public menu data, analytics, uploads, payments, billing, staff sessions, and notifications.",
        ],
    },
    {
        title: "Who It Serves",
        paragraphs: [
            "Customers use Tiffzy to discover restaurants, open menus, place orders, and view order history or profile settings.",
            "Staff use it for live operations such as billing, kitchen work, server views, and staff profile handling.",
            "Owners and managers use it to monitor orders, edit menus, handle tables, inspect kitchen activity, review analytics, track finance, and manage staff and settings.",
            "Super admins use the system to create restaurants, manage users, and maintain platform-wide administration.",
        ],
    },
    {
        title: "How the Experience Flows",
        paragraphs: [
            "A visitor usually enters through the public home experience or through a restaurant-specific link.",
            "From there, the app moves them into a restaurant menu or ordering journey, and role-based routes take over for staff, owners, or administrators when needed.",
            "About Us, Contact Us, Terms, Privacy, and Refund Policy are kept as separate public pages so the company story and policy information are easy to find without interrupting the ordering experience.",
        ],
    },
    {
        title: "Our Goal",
        paragraphs: [
            "The goal of Tiffzy is to simplify restaurant operations while keeping the customer experience smooth and modern.",
            "We want the platform to feel dependable, fast, and easy to use for both front-of-house and back-office teams, with a clear digital path from menu browsing to order completion.",
        ],
    },
];

const stats = [
    "Separate public, customer, staff, owner, admin, and super-admin experiences",
    "React + Vite frontend paired with a Fastify + Prisma backend",
    "Environment-driven configuration instead of hardcoded deployment values",
];

const contactLines = [
    "Tiffzy",
    "Website: https://www.tiffzy.com",
    "Email: rameshnanda@tiffzy.com",
    "Phone: +91 9177764632",
];

export default function AboutUs() {
    return (
        <div
            className="min-h-screen"
            style={{
                background:
                    "radial-gradient(circle at top left, rgba(245,185,78,0.12), transparent 28%), radial-gradient(circle at top right, rgba(169,113,48,0.12), transparent 24%), linear-gradient(180deg, var(--app-bg) 0%, color-mix(in srgb, var(--app-bg) 88%, #1f1308 12%) 100%)",
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
                    <span className="uppercase tracking-[0.35em] text-[color:var(--app-muted)]">Company page</span>
                </div>

                <header className="max-w-4xl">
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[color:var(--app-primary)]">About Us</p>
                    <h1 className="mt-4 text-4xl font-bold leading-tight text-[color:var(--app-text)] sm:text-5xl lg:text-6xl">
                        Tiffzy is a complete restaurant operations platform built for customers, staff, and owners.
                    </h1>
                    <p className="mt-6 max-w-3xl text-lg leading-8 text-[color:var(--app-muted-strong)] sm:text-xl">
                        This page is a detailed company note written as a separate route. It explains what Tiffzy does, who
                        it serves, and how the current app is organized across the frontend and backend.
                    </p>
                    <p className="mt-5 text-sm uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
                        Current overview: public site, customer journeys, restaurant operations, and admin tooling
                    </p>
                </header>

                <section className="mt-12 border-t border-[color:var(--app-border)] pt-8">
                    <p className="text-sm uppercase tracking-[0.32em] text-[color:var(--app-muted)]">Quick notes</p>
                    <div className="mt-4 space-y-3 text-[17px] leading-8 text-[color:var(--app-muted-strong)]">
                        {stats.map((item) => (
                            <p key={item}>
                                <span className="text-[color:var(--app-primary)]">•</span> {item}
                            </p>
                        ))}
                    </div>
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
                    <h2 className="text-2xl font-bold text-[color:var(--app-text)]">Contact</h2>
                    <div className="mt-4 space-y-3 text-[17px] leading-8 text-[color:var(--app-muted-strong)]">
                        {contactLines.map((line) => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>
                </section>

                <p className="mt-12 max-w-4xl text-sm leading-7 text-[color:var(--app-muted)]">
                    The page is intentionally plain and text-first, so it reads like a note on paper rather than a set of
                    separate panels.
                </p>
            </main>
        </div>
    );
}
