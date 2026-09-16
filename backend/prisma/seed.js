import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const seedData = JSON.parse(new TextDecoder().decode(await readFile(new URL("./seed-data.json", import.meta.url))));

const serializeAccess = (access) => access || seedData.accessByRole.STAFF;

const passwordFor = (passwordKey) => {
    const password = seedData.passwords[passwordKey];
    if (!password) throw new Error(`Missing seed password for key: ${passwordKey}`);
    return password;
};

const accessForRole = (role) => {
    const normalizedRole = String(role || "STAFF").toUpperCase();
    return seedData.accessByRole[normalizedRole] || seedData.accessByRole.STAFF;
};

const resetDatabase = async () => {
    console.log("Cleaning existing records...");
    await prisma.customerOtp.deleteMany();
    await prisma.orderStatusEvent.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.payLaterTransaction.deleteMany();
    await prisma.payLaterAccount.deleteMany();
    await prisma.order.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.customerNotification.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.customerAccount.deleteMany();
    await prisma.diningTable.deleteMany();
    await prisma.inventoryStock.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.staffAccess.deleteMany();
    await prisma.user.deleteMany();
    await prisma.restaurant.deleteMany();
};

const createUser = async ({ restaurantId = null, user }) => {
    const createdUser = await prisma.user.create({
        data: {
            name: user.name,
            email: String(user.email).trim().toLowerCase(),
            phone: user.phone || null,
            password: bcrypt.hashSync(passwordFor(user.passwordKey), 10),
            role: String(user.role || "STAFF").toUpperCase(),
            restaurantId,
            isActive: user.isActive !== false,
        },
    });

    if (restaurantId && createdUser.role !== "SUPER_ADMIN") {
        await prisma.staffAccess.create({
            data: {
                restaurantId,
                userId: createdUser.id,
                role: createdUser.role,
                permissions: serializeAccess(accessForRole(createdUser.role)),
            },
        });
    }

    return createdUser;
};

const CUSTOMER_POOL = [
    { name: "Rahul Sharma", phone: "9000000001", email: "rahul.sharma@example.com", vip: true },
    { name: "Nisha Verma", phone: "9000000002", email: "nisha.verma@example.com" },
    { name: "Arjun Reddy", phone: "9000000003", email: "arjun.reddy@example.com" },
    { name: "Priya Patel", phone: "9000000004", email: "priya.patel@example.com" },
    { name: "Vikram Singh", phone: "9000000005", email: "vikram.singh@example.com" },
    { name: "Sneha Rao", phone: "9000000006", email: "sneha.rao@example.com" },
    { name: "Rohan Mehta", phone: "9000000007", email: "rohan.mehta@example.com" },
    { name: "Ananya Iyer", phone: "9000000008", email: "ananya.iyer@example.com" },
    { name: "Aditya Verma", phone: "9000000009", email: "aditya.verma@example.com" },
    { name: "Kavita Nair", phone: "9000000015", email: "kavita.nair@example.com" },
    { name: "Sameer Khan", phone: "9000000016", email: "sameer.khan@example.com" },
    { name: "Pooja Deshmukh", phone: "9000000017", email: "pooja.d@example.com" },
];

const PAYMENT_MODES = ["UPI", "UPI", "UPI", "CARD", "CARD", "CASH", "ONLINE"];
const ORDER_NOTES = [
    "",
    "",
    "Less spicy please",
    "Extra napkins & cutlery",
    "Serve hot",
    "No onions",
    "Pack separately",
    "Table by the window",
    "Mild spice for kids",
    "Extra mint dip",
];

// Seed single order helper
const createSeededOrder = async ({
    restaurant,
    customerInfo,
    orderNo,
    invoiceNo,
    orderDate,
    status = "DELIVERED",
    tableNo = null,
    fulfillment = "DINEIN",
    orderSource = "QR",
    paymentMode = "UPI",
    items,
    notes = "",
    prepMinutes = 18,
}) => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const taxAmount = restaurant.taxEnabled ? (subtotal * Number(restaurant.defaultTaxPercent || 0)) / 100 : 0;
    const serviceChargeAmount = restaurant.serviceChargeEnabled
        ? (subtotal * Number(restaurant.serviceChargePercent || 0)) / 100
        : 0;
    const total = subtotal + taxAmount + serviceChargeAmount;

    let customer = null;
    if (customerInfo?.phone) {
        customer = await prisma.customer.upsert({
            where: {
                restaurantId_phone: {
                    restaurantId: restaurant.id,
                    phone: customerInfo.phone,
                },
            },
            update: {
                name: customerInfo.name || null,
                email: customerInfo.email || null,
            },
            create: {
                restaurantId: restaurant.id,
                name: customerInfo.name || null,
                phone: customerInfo.phone,
                email: customerInfo.email || null,
                rewardPoints: Math.floor(total / 10),
            },
        });

        await prisma.customerAccount.upsert({
            where: { phone: customerInfo.phone },
            update: {
                name: customerInfo.name || null,
                email: customerInfo.email || null,
            },
            create: {
                phone: customerInfo.phone,
                name: customerInfo.name || null,
                email: customerInfo.email || null,
            },
        });
    }

    const updatedAt = new Date(orderDate.getTime() + prepMinutes * 60 * 1000);
    const paymentStatus = status === "CANCELLED" ? "REFUNDED" : status === "PLACED" ? "PENDING" : "COMPLETED";

    const orderRecord = await prisma.order.create({
        data: {
            restaurantId: restaurant.id,
            customerId: customer?.id || null,
            orderNo,
            invoiceNo,
            orderSource,
            fulfillment,
            customerName: customerInfo?.name || null,
            phone: customerInfo?.phone || null,
            email: customerInfo?.email || null,
            tableNo,
            notes: notes || null,
            subtotal,
            taxAmount,
            serviceChargeAmount,
            total,
            paymentMode,
            paymentStatus,
            status,
            createdAt: orderDate,
            updatedAt: status === "DELIVERED" ? updatedAt : orderDate,
            items: {
                create: items.map((it) => ({
                    menuItemId: it.menuItemId,
                    itemName: it.itemName,
                    qty: it.qty,
                    price: it.price,
                    total: it.total,
                    createdAt: orderDate,
                })),
            },
            statusEvents: {
                create: [
                    {
                        status: "PLACED",
                        source: orderSource,
                        changedByName: customerInfo?.name || "Customer",
                        createdAt: orderDate,
                    },
                    ...(status !== "PLACED"
                        ? [
                              {
                                  status,
                                  source: "KITCHEN",
                                  changedByName: "Staff",
                                  createdAt: status === "DELIVERED" ? updatedAt : orderDate,
                              },
                          ]
                        : []),
                ],
            },
        },
    });

    if (paymentStatus === "COMPLETED") {
        await prisma.payment.create({
            data: {
                restaurantId: restaurant.id,
                orderId: orderRecord.id,
                amount: total,
                currency: "INR",
                method: paymentMode,
                status: "SUCCESS",
                createdAt: orderDate,
            },
        });
    }

    return orderRecord;
};

// Generates 30 days of realistic orders for a given restaurant
const generate30DayOrders = async (restaurant, menuItems, tables) => {
    console.log(`Generating 30-day rich order history for ${restaurant.name}...`);
    const prefix = restaurant.invoicePrefix || "ORD";
    let orderSeq = 1000;

    const now = new Date();
    const tableList = tables.map((t) => t.tableNo);

    // Peak rush times:
    // 08:30 - 10:30 (Breakfast)
    // 12:30 - 15:00 (Lunch peak)
    // 16:30 - 18:30 (Evening snack / coffee)
    // 19:30 - 22:30 (Dinner peak)
    const timeSlots = [
        { hour: 9, minRange: [0, 50], weight: 1.2 },
        { hour: 10, minRange: [10, 50], weight: 1.5 },
        { hour: 12, minRange: [15, 55], weight: 2.5 },
        { hour: 13, minRange: [0, 55], weight: 3.2 },
        { hour: 14, minRange: [10, 45], weight: 2.0 },
        { hour: 16, minRange: [30, 55], weight: 2.2 },
        { hour: 17, minRange: [0, 50], weight: 2.8 },
        { hour: 18, minRange: [10, 45], weight: 2.0 },
        { hour: 19, minRange: [30, 55], weight: 3.5 },
        { hour: 20, minRange: [0, 55], weight: 4.0 },
        { hour: 21, minRange: [0, 50], weight: 3.2 },
        { hour: 22, minRange: [0, 30], weight: 1.4 },
    ];

    // Loop through past 30 days (from 29 days ago up to day 0 = today)
    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
        const orderDateBase = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
        const dayOfWeek = orderDateBase.getDay(); // 0 = Sun, 6 = Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Base order count for this day (6 to 11 orders, slightly more on weekends)
        const orderCountForDay = isWeekend ? Math.floor(7 + Math.random() * 5) : Math.floor(5 + Math.random() * 4);

        for (let oIdx = 0; oIdx < orderCountForDay; oIdx++) {
            orderSeq++;
            const slot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
            const minute = slot.minRange[0] + Math.floor(Math.random() * (slot.minRange[1] - slot.minRange[0]));
            const second = Math.floor(Math.random() * 60);

            const orderDate = new Date(
                orderDateBase.getFullYear(),
                orderDateBase.getMonth(),
                orderDateBase.getDate(),
                slot.hour,
                minute,
                second
            );

            // Don't generate future orders for today
            if (dayOffset === 0 && orderDate > now) {
                continue;
            }

            // Customer selection: Rahul Sharma (VIP) gets ~20% of orders so his history is rich!
            const isRahul = Math.random() < 0.22;
            const customer = isRahul
                ? CUSTOMER_POOL[0]
                : CUSTOMER_POOL[Math.floor(Math.random() * CUSTOMER_POOL.length)];

            // Item selection: 1 to 4 distinct items
            const itemCount = Math.random() < 0.35 ? 1 : Math.random() < 0.7 ? 2 : Math.random() < 0.9 ? 3 : 4;
            const shuffledMenu = [...menuItems].sort(() => 0.5 - Math.random());
            const chosenMenu = shuffledMenu.slice(0, itemCount);

            const items = chosenMenu.map((m) => {
                const qty = Math.random() < 0.7 ? 1 : Math.random() < 0.9 ? 2 : 3;
                return {
                    menuItemId: m.id,
                    itemName: m.name,
                    qty,
                    price: m.price,
                    total: m.price * qty,
                };
            });

            // Status:
            // Past days: mostly DELIVERED (94%), some CANCELLED (6%)
            // Today (dayOffset === 0): varied depending on time of order
            let status = "DELIVERED";
            if (dayOffset === 0) {
                const minsAgo = (now.getTime() - orderDate.getTime()) / (60 * 1000);
                if (minsAgo < 10) status = "PLACED";
                else if (minsAgo < 22) status = "PREPARING";
                else if (minsAgo < 35) status = "READY";
                else status = "DELIVERED";
            } else {
                if (Math.random() < 0.05) status = "CANCELLED";
            }

            // Dining style & table
            const isDineIn = Math.random() < 0.65;
            const tableNo = isDineIn ? tableList[Math.floor(Math.random() * tableList.length)] : null;
            const fulfillment = isDineIn ? "DINEIN" : Math.random() < 0.5 ? "TAKEAWAY" : "DELIVERY";
            const orderSource = isDineIn ? (Math.random() < 0.75 ? "QR" : "POS") : "ONLINE";
            const paymentMode = PAYMENT_MODES[Math.floor(Math.random() * PAYMENT_MODES.length)];
            const notes = ORDER_NOTES[Math.floor(Math.random() * ORDER_NOTES.length)];
            const prepMinutes = Math.floor(12 + Math.random() * 16);

            await createSeededOrder({
                restaurant,
                customerInfo: customer,
                orderNo: `ORD-${prefix}-${orderSeq}`,
                invoiceNo: `${prefix}-${orderSeq}`,
                orderDate,
                status,
                tableNo,
                fulfillment,
                orderSource,
                paymentMode,
                items,
                notes,
                prepMinutes,
            });
        }
    }
};

const seedRestaurant = async (restaurantData) => {
    const { users, menuItems, tables, ...restaurantFields } = restaurantData;
    const restaurant = await prisma.restaurant.create({ data: restaurantFields });

    for (const user of users || []) {
        await createUser({ restaurantId: restaurant.id, user });
    }

    const createdMenuItems = [];
    for (const menuItem of menuItems || []) {
        const item = await prisma.menuItem.create({
            data: {
                ...menuItem,
                restaurantId: restaurant.id,
            },
        });
        createdMenuItems.push(item);
    }

    const createdTables = [];
    for (const table of tables || []) {
        const tbl = await prisma.diningTable.create({
            data: {
                ...table,
                restaurantId: restaurant.id,
            },
        });
        createdTables.push(tbl);
    }

    // Generate 30-day realistic order traffic across different times of day
    await generate30DayOrders(restaurant, createdMenuItems, createdTables);

    console.log(`Seeded ${restaurant.name} with ${createdMenuItems.length} menu items and 30-day order history.`);
};

const main = async () => {
    console.log("Starting comprehensive seed process...");
    await resetDatabase();
    await createUser({ user: seedData.admin });

    for (const restaurant of seedData.restaurants || []) {
        await seedRestaurant(restaurant);
    }

    console.log("\n========================================================");
    console.log("Seeding finished successfully!");
    console.log("========================================================");
    console.log(`Admin    : ${seedData.admin.email} / ${passwordFor(seedData.admin.passwordKey)}`);
    console.log(`Owner 1  : owner@cafeking.com / ${passwordFor("cafeKingOwner")}`);
    console.log(`Owner 2  : owner@beanhouse.com / ${passwordFor("beanHouseOwner")}`);
    console.log(`Customer : 9000000001 (Rahul Sharma - 30-day rich history)`);
    console.log("========================================================\n");
};

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
