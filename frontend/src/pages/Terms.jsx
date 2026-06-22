import { Link } from "react-router-dom";

const sections = [
    {
        title: "1. Acceptance of Terms",
        paragraphs: [
            "These Terms of Service govern your access to and use of Tiffzy, including the website, mobile app, restaurant discovery pages, order tools, business tools, and any related features that we make available now or in the future.",
            "By opening, browsing, or using Tiffzy, you agree to these Terms and enter a binding agreement with Tiffzy and its affiliates. If you do not agree, you should stop using the service immediately.",
        ],
    },
    {
        title: "2. Definitions",
        paragraphs: [
            "\"Customer\" or \"you\" means any person who uses Tiffzy to browse, order, reserve, pay, review, or otherwise interact with the platform. If you use a restaurant business page or other business tools, you are also treated as a business user for those features.",
            "\"Content\" includes text, ratings, photos, videos, audio, menus, location information, order details, messages, and any other data displayed or uploaded on Tiffzy. \"Restaurant Partner\" means any restaurant or merchant listed on or connected to the platform.",
        ],
    },
    {
        title: "3. Eligibility and Lawful Use",
        paragraphs: [
            "You represent that you are at least eighteen years old, or that you have the legal capacity to enter into these Terms under the laws that apply to you. If you use Tiffzy on behalf of a restaurant, brand, or other business, you confirm that you are authorized to act for that business.",
            "You agree to use Tiffzy only in a manner that follows these Terms, follows all applicable laws, and respects the rights of Tiffzy, Restaurant Partners, delivery partners, and other users.",
        ],
    },
    {
        title: "4. Changes, Translations, and Updates",
        paragraphs: [
            "We may update, amend, replace, or remove parts of these Terms at any time. When we make material changes, we may show the revised version inside the app or on the website. Your continued use of Tiffzy after a change means that you accept the updated Terms.",
            "If we provide a translation of these Terms, the translation is only for convenience. The English version controls if there is any difference between versions. We may also release app updates or service changes that you must install or accept in order to keep using certain features.",
        ],
    },
    {
        title: "5. What Tiffzy Provides",
        paragraphs: [
            "Tiffzy is a platform that helps people discover restaurants, view menus, place orders, track order progress where available, and use restaurant-facing tools where applicable. Some features may be rolled out only to certain users, cities, or devices while we test or improve them.",
            "We may suspend, limit, or discontinue any feature, page, integration, or service at any time. Restaurant menus, prices, images, taxes, fees, offers, and availability are informational until an order is accepted and may change without notice.",
        ],
    },
    {
        title: "6. Accounts and Security",
        paragraphs: [
            "When you create an account or submit information, you agree to provide information that is true, current, and complete. You are responsible for keeping your profile up to date and for keeping your login details, device, and account activity secure.",
            "You must not impersonate another person, create an account for someone else without permission, or use false details to claim a business listing or gain access to a restaurant account. If you suspect unauthorized use of your account, you should change your credentials and contact support as soon as possible.",
        ],
    },
    {
        title: "7. Restaurant Listings, Menus, and Availability",
        paragraphs: [
            "Restaurant Partners are responsible for their own menus, descriptions, prices, preparation times, operating hours, certifications, and service quality unless Tiffzy clearly states otherwise. We do our best to keep the information accurate, but we cannot guarantee that every detail is always current.",
            "Photos, badges, ratings, labels, and menu notes are provided for convenience and may not reflect the exact condition of the food, the venue, or the service at the moment of your visit or delivery. A Restaurant Partner may stop accepting orders, change items, or go offline at any time.",
        ],
    },
    {
        title: "8. Orders, Delivery, Pickup, and Reservations",
        paragraphs: [
            "If you place an order through Tiffzy, you agree to provide correct order details, a reachable phone number, and any delivery, pickup, or table information needed to complete the service. Orders are accepted only when the Restaurant Partner confirms them or when the platform shows them as accepted.",
            "Delivery times are estimates and may change because of kitchen load, traffic, weather, system issues, store hours, or other factors outside our control. If Tiffzy offers pickup, dine-in, booking, or table services, you agree to follow the restaurant's check-in rules, arrival rules, and seating policies.",
        ],
    },
    {
        title: "9. Payments, Fees, Offers, and Plans",
        paragraphs: [
            "You agree to pay the total amount shown at checkout, including the food price, taxes, service charges, delivery charges, packaging charges, and any other amount displayed before you place the order. Payment may be collected online, by card, by cash, by wallet, or by another supported method.",
            "Tiffzy and Restaurant Partners may offer coupons, discounts, memberships, passes, vouchers, bundles, or subscription plans from time to time. These offers may have separate rules, may be changed or withdrawn at any time, and may be limited by location, device, restaurant, order value, or payment method.",
        ],
    },
    {
        title: "10. Cancellations, Refunds, and Service Issues",
        paragraphs: [
            "Some orders can be canceled only before preparation begins or before the Restaurant Partner confirms them. If you cancel after the order is accepted, cancellation fees or other consequences may apply where allowed by law and the applicable policy shown in the app.",
            "If an item is unavailable, incorrect, damaged, or not delivered, please use the support options available in Tiffzy as soon as possible. Refunds, replacements, or adjustments may depend on the order status, the Restaurant Partner's policy, payment processor timelines, and any applicable legal requirements.",
        ],
    },
    {
        title: "11. Customer Content, Reviews, and Feedback",
        paragraphs: [
            "If you upload reviews, photos, comments, ratings, profile information, messages, or other content, you represent that you have the right to share it and that it does not violate any law or the rights of any other person. Your content should be honest and should not be misleading, abusive, defamatory, or unlawful.",
            "By posting content on Tiffzy, you give us a license to host, store, display, reproduce, adapt, translate, distribute, and use that content as needed to operate and improve the service, unless a separate written agreement says otherwise. We may remove content that we consider harmful, irrelevant, unlawful, or otherwise inappropriate.",
        ],
    },
    {
        title: "12. Intellectual Property",
        paragraphs: [
            "Tiffzy, including its name, logo, software, design, layout, code, and original content, belongs to Tiffzy or to the people who licensed it to us. These rights are protected by copyright, trademark, and other laws.",
            "We grant you a limited, personal, non-exclusive, non-transferable, revocable license to use the platform only as allowed by these Terms. You may not copy, sell, modify, reverse engineer, frame, scrape, or exploit the platform or its content except where the law clearly allows it or we give written permission.",
        ],
    },
    {
        title: "13. Acceptable Use and Restrictions",
        paragraphs: [
            "You agree not to misuse the platform. This includes, without limitation, using bots or scripts to access the service, interfering with servers or networks, attempting unauthorized access, copying data for commercial use without permission, submitting fake orders, abusing refunds, or spamming users or Restaurant Partners.",
            "You must not post content that is hateful, harassing, obscene, infringing, deceptive, or illegal, and you must not try to bypass safety, rate limits, or security controls. We may investigate suspected misuse and may suspend or terminate access where appropriate.",
        ],
    },
    {
        title: "14. Third-Party Services and Promotions",
        paragraphs: [
            "Tiffzy may show links, maps, payment tools, or other services operated by third parties. Those third parties have their own terms and privacy rules, and we do not control or endorse their content, availability, or conduct.",
            "We may also run promotions, advertising, referral programs, or special campaigns from time to time. These may change, pause, or end without notice, and any benefit tied to them may be lost if we detect abuse, fraud, or a rule violation.",
        ],
    },
    {
        title: "15. Privacy and Communications",
        paragraphs: [
            "We may collect and use information needed to run the platform, process orders, support customers, improve the product, maintain security, and meet legal obligations. In many cases, we must share some of your information with the Restaurant Partner, delivery partner, or payment provider so your order can be completed.",
            "By using Tiffzy, you consent to receiving service-related communication by in-app message, email, SMS, push notification, or other contact methods we support. Message and data charges may apply depending on your carrier or network plan.",
        ],
    },
    {
        title: "16. Special Feature Terms",
        paragraphs: [
            "If Tiffzy offers any special feature, membership, loyalty plan, gift order, wallet, subscription, reservation, or dining benefit, that feature may have additional terms that apply on top of these Terms. If there is a conflict, the feature-specific terms apply to that feature.",
            "We may change, limit, or withdraw any special feature, bonus, or benefit at any time, unless a separate written promise says otherwise. You are responsible for checking the applicable feature rules before you use or purchase that feature.",
        ],
    },
    {
        title: "17. Disclaimer of Warranties, Liability, and Indemnity",
        paragraphs: [
            "To the fullest extent permitted by law, Tiffzy is provided on an \"as is\" and \"as available\" basis. We do not promise that the platform will always be error-free, uninterrupted, secure, or that every menu item, price, or restaurant detail will be accurate at all times.",
            "To the fullest extent permitted by law, Tiffzy is not liable for indirect, incidental, special, or consequential losses, including loss of profit, loss of data, or loss caused by delays, outages, incorrect listings, or third-party actions. You agree to indemnify and hold us harmless from claims arising from your content, your misuse of the platform, your breach of these Terms, or your violation of another person's rights.",
        ],
    },
    {
        title: "18. Termination and Account Closure",
        paragraphs: [
            "You may stop using Tiffzy at any time. Where account deletion is available, you can follow the in-app steps or contact support to request closure. We may suspend or terminate your access at any time if we believe there has been fraud, abuse, a legal issue, a security issue, or a breach of these Terms.",
            "If your account is terminated, we may keep certain records where the law requires it or where retention is needed for legitimate business, security, or dispute-resolution purposes. Sections that should survive termination will continue to apply after your access ends.",
        ],
    },
    {
        title: "19. Governing Law, Copyright Notices, and Contact Us",
        paragraphs: [
            "These Terms are governed by the laws of India, without affecting any mandatory consumer protections that cannot be changed by contract. Any dispute should be brought before the courts of competent jurisdiction in India, unless the law requires a different forum.",
            "If you believe content on Tiffzy infringes your copyright or another legal right, please contact us through the support channel shown in the app and include enough detail for us to identify the material, the listing or page where it appears, and your contact information. For all other questions, please use the support option inside Tiffzy or the contact details we publish from time to time.",
            "If you have any questions regarding these Terms and Conditions or the use of the Platform, please contact us: Tiffzy, Website: https://www.tiffzy.com, Email: rameshnanda@tiffzy.com, Phone: +91 9177764632.",
            "By using Tiffzy, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.",
        ],
    },
];

export default function Terms() {
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
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[#b06e2f]">Terms of Service</p>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Tiffzy Terms and Conditions</h1>
                    <p className="max-w-3xl text-lg leading-8 text-[#513a29]">
                        This page is written as a single, continuous legal document for Tiffzy customers, restaurant partners,
                        and business users. Please read it carefully before using the platform.
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
                    This draft is intentionally plain and paper-like, with no cards or split panels, so the Terms read like a
                    proper legal notice.
                </p>
            </main>
        </div>
    );
}
