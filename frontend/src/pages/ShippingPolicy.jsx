import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function ShippingPolicy() {
    return (
        <>
            <Navbar />
            <div className="mx-auto max-w-4xl px-8 py-20">
                <h1 className="mb-10 text-4xl font-black tracking-tight text-white">
                    Shipping & Delivery Policy
                </h1>

                <div className="space-y-8 text-[17px] leading-relaxed text-[#f5efe0]/80">
                    <section>
                        <h2 className="mb-4 text-xl font-bold text-white">1. Overview</h2>
                        <p>
                            Tiffzy is a smart ordering platform operated by <strong>SURVETRA SERVICES</strong>.
                            We provide technology solutions for food ordering and delivery.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-bold text-white">2. Delivery Partners</h2>
                        <p>
                            Delivery services are provided either by the respective restaurant's own staff or
                            by third-party delivery partners assigned through our platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-bold text-white">3. Delivery Timeline</h2>
                        <p>
                            Estimated delivery times are provided at the time of order placement.
                            Typically, orders are delivered within 30-60 minutes depending on
                            distance and restaurant preparation time.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-bold text-white">4. Shipping Charges</h2>
                        <p>
                            Delivery fees are calculated based on the distance between the restaurant
                            and your delivery location. These charges are clearly displayed
                            in the cart before payment.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-bold text-white">5. Service Areas</h2>
                        <p>
                            We currently operate in selected cities in India. Delivery is only
                            available within the operational radius of each restaurant.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-xl font-bold text-white">6. Contact Us</h2>
                        <p>
                            If you have questions about your delivery, please contact us at
                            <strong> support@tiffzy.com</strong> or reach out to the restaurant
                            directly via the contact number provided in your order details.
                        </p>
                    </section>
                </div>
            </div>
            <Footer />
        </>
    );
}
