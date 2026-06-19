import prisma from "../prisma.js";

export default async function (fastify) {
    fastify.get("/owner/analytics/:restaurantId", async (req) => {
        const { restaurantId } = req.params;
        const rid = Number(restaurantId);

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const todayOrders = await prisma.order.findMany({
            where: {
                restaurantId: rid,
                createdAt: { gte: start, lte: end },
            },
            include: { items: true },
        });

        const salesToday = todayOrders.reduce(
            (sum, x) => sum + x.total,
            0
        );

        const totalOrders = todayOrders.length;

        const avgOrder =
            totalOrders > 0
                ? +(salesToday / totalOrders).toFixed(2)
                : 0;

        const paymentModes = {
            CASH: 0,
            UPI: 0,
            CARD: 0,
            OTHER: 0,
        };

        todayOrders.forEach((o) => {
            const key =
                o.paymentMode &&
                ["CASH", "UPI", "CARD"].includes(
                    o.paymentMode
                )
                    ? o.paymentMode
                    : "OTHER";

            paymentModes[key]++;
        });

        const itemMap = {};

        todayOrders.forEach((order) => {
            order.items.forEach((item) => {
                if (!itemMap[item.itemName]) {
                    itemMap[item.itemName] = 0;
                }

                itemMap[item.itemName] += item.qty;
            });
        });

        const topItems = Object.entries(itemMap)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        return {
            salesToday,
            totalOrders,
            avgOrder,
            paymentModes,
            topItems,
        };
    });
}