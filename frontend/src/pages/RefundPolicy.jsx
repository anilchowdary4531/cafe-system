import { Link } from "react-router-dom";

const sections = [
    {
        title: "1. Subscription Services",
        paragraphs: [
            "Tiffzy may offer subscription-based services to restaurants and businesses.",
            "Subscription fees, once paid, are generally non-refundable.",
            "Merchants may cancel their subscription at any time.",
            "Cancellation of a subscription will stop future billing cycles but will not automatically entitle the merchant to a refund for the current billing period.",
            "Any exceptions to this policy will be communicated separately.",
        ],
    },
    {
        title: "2. Customer Orders",
        paragraphs: [
            "Tiffzy provides technology services that enable customers to place orders with restaurants and food businesses.",
            "Orders may be cancelled only if the restaurant has not yet accepted or started preparing the order.",
            "Once an order has been accepted or preparation has begun, cancellation requests may be declined.",
            "Restaurants are responsible for fulfilling customer orders and handling order-related issues.",
        ],
    },
    {
        title: "3. Refund Eligibility",
        paragraphs: [
            "Refunds may be considered in circumstances such as duplicate payment transactions, payments processed due to technical errors, orders cancelled before acceptance by the restaurant, or failure to deliver an order due to circumstances verified by the merchant.",
            "Refund approval is subject to verification by Tiffzy and/or the respective restaurant.",
        ],
    },
    {
        title: "4. Refund Process",
        paragraphs: [
            "To request a refund, users may contact us by providing the order ID or transaction reference number, registered email address or phone number, and a description of the issue.",
            "After verification, approved refunds will be processed through the original payment method.",
        ],
    },
    {
        title: "5. Refund Timelines",
        paragraphs: [
            "Approved refunds are generally processed within 5 to 10 business days, depending on the payment provider, bank, or payment gateway.",
            "Tiffzy is not responsible for delays caused by banks, payment processors, or other third-party financial institutions.",
        ],
    },
    {
        title: "6. Non-Refundable Situations",
        paragraphs: [
            "Refunds may not be provided for change of mind after an order has been accepted, incorrect orders placed by the customer, customer unavailability during delivery, dissatisfaction relating to taste or personal preference, subscription fees already utilized during the billing period, or circumstances beyond the reasonable control of Tiffzy or the merchant.",
        ],
    },
    {
        title: "7. Changes to This Policy",
        paragraphs: [
            "Tiffzy reserves the right to modify this Refund & Cancellation Policy at any time. Updated versions will be posted on this page with a revised Last Updated date.",
        ],
    },
    {
        title: "8. Contact Us",
        paragraphs: [
            "For questions regarding cancellations or refunds, please contact us:",
            "Tiffzy",
            "Website: https://www.tiffzy.com",
            "Email: rameshnanda@tiffzy.com",
            "Phone: +91 9177764632",
        ],
    },
];

export default function RefundPolicy() {
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
                    <p className="text-[11px] uppercase tracking-[0.42em] text-[#b06e2f]">Refund & Cancellation Policy</p>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Tiffzy Refund & Cancellation Policy</h1>
                    <p className="max-w-3xl text-lg leading-8 text-[#513a29]">
                        This page is written as a continuous policy notice for Tiffzy customers, merchants, and business users.
                        Please read it carefully before using the platform.
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
