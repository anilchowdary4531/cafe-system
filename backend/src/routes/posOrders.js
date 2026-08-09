import prisma from "../prisma.js";

export default async function (fastify) {
    fastify.post("/owner/pos-order", async (req, reply) => {
        const {
            restaurantId,
            customerName,
            paymentMode,
            items,
        } = req.body;

        const subtotal = items.reduce(
            (sum, item) => sum + item.qty * item.price,
            0
        );

        const taxAmount = 0;
        const total = subtotal;

        const count = await prisma.order.count({
            where: { restaurantId },
        });

        const orderNo = `POS-${count + 1}`;

        const order = await prisma.order.create({
            data: {
                restaurantId,
                orderNo,
                orderType: "POS",
                customerName,
                subtotal,
                taxAmount,
                total,
                paymentMode,
                paymentStatus: "PAID",
                status: "PLACED",

                items: {
                    create: items.map((item) => ({
                        menuItemId: item.menuItemId,
                        itemName: item.itemName,
                        qty: item.qty,
                        price: item.price,
                        total: item.qty * item.price,
                    })),
                },
            },
            include: { items: true },
        });

        reply.send(order);
    });
}