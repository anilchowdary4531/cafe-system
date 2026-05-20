import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const seedData = JSON.parse(new TextDecoder().decode(await readFile(new URL("./seed-data.json", import.meta.url))));

const serializeAccess = (access) => access || seedData.accessByRole.STAFF;
const minutesAgo = (mins) => new Date(Date.now() - Number(mins || 0) * 60 * 1000);

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
    await prisma.customerOtp.deleteMany();
    await prisma.orderStatusEvent.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.customerAccount.deleteMany();
    await prisma.diningTable.deleteMany();
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

const buildOrderItems = (orderItems, menuByName) => {
    return orderItems.map((item) => {
        const menuItem = menuByName.get(item.name);
        if (!menuItem) throw new Error(`Missing menu item for seeded order: ${item.name}`);
        const qty = Math.max(1, Number(item.qty || 1));
        const price = Number(menuItem.price || 0);
        return {
            menuItemId: menuItem.id,
            itemName: menuItem.name,
            qty,
            price,
            total: price * qty,
        };
    });
};

const createOrder = async ({ restaurant, order, menuByName }) => {
    const items = buildOrderItems(order.items || [], menuByName);
    const subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const taxAmount = restaurant.taxEnabled ? (subtotal * Number(restaurant.defaultTaxPercent || 0)) / 100 : 0;
    const serviceChargeAmount = restaurant.serviceChargeEnabled
        ? (subtotal * Number(restaurant.serviceChargePercent || 0)) / 100
        : 0;
    const total = subtotal + taxAmount + serviceChargeAmount;

    const customer = order.phone
        ? await prisma.customer.upsert({
              where: {
                  restaurantId_phone: {
                      restaurantId: restaurant.id,
                      phone: order.phone,
                  },
              },
              update: {
                  name: order.customerName || null,
                  email: order.email || null,
              },
              create: {
                  restaurantId: restaurant.id,
                  name: order.customerName || null,
                  phone: order.phone,
                  email: order.email || null,
              },
          })
        : null;

    if (order.phone) {
        await prisma.customerAccount.upsert({
            where: { phone: order.phone },
            update: {
                name: order.customerName || null,
                email: order.email || null,
            },
            create: {
                phone: order.phone,
                name: order.customerName || null,
                email: order.email || null,
            },
        });
    }

    await prisma.order.create({
        data: {
            restaurantId: restaurant.id,
            customerId: customer?.id || null,
            // We intentionally keep customerAccount separate from restaurant-scoped customer records.
            orderNo: order.orderNo,
            invoiceNo: order.invoiceNo || null,
            customerName: order.customerName || null,
            phone: order.phone || null,
            email: order.email || null,
            tableNo: order.tableNo || null,
            notes: order.notes || null,
            subtotal,
            taxAmount,
            serviceChargeAmount,
            total,
            status: String(order.status || "PLACED").toUpperCase(),
            createdAt: minutesAgo(order.minutesAgo),
            items: {
                create: items,
            },
            statusEvents: {
                create: {
                    status: String(order.status || "PLACED").toUpperCase(),
                    source: "SEED",
                    changedByName: "Seed Data",
                },
            },
        },
    });
};

const seedRestaurant = async (restaurantData) => {
    const { users, menuItems, tables, orders, ...restaurantFields } = restaurantData;
    const restaurant = await prisma.restaurant.create({ data: restaurantFields });

    for (const user of users || []) {
        await createUser({ restaurantId: restaurant.id, user });
    }

    for (const menuItem of menuItems || []) {
        await prisma.menuItem.create({
            data: {
                ...menuItem,
                restaurantId: restaurant.id,
            },
        });
    }

    for (const table of tables || []) {
        await prisma.diningTable.create({
            data: {
                ...table,
                restaurantId: restaurant.id,
            },
        });
    }

    const menu = await prisma.menuItem.findMany({
        where: { restaurantId: restaurant.id },
        select: { id: true, name: true, price: true },
    });
    const menuByName = new Map(menu.map((item) => [item.name, item]));

    for (const order of orders || []) {
        await createOrder({ restaurant, order, menuByName });
    }

    console.log(`Seeded ${restaurant.name}`);
};

const main = async () => {
    console.log("Seed started");
    await resetDatabase();
    await createUser({ user: seedData.admin });

    for (const restaurant of seedData.restaurants || []) {
        await seedRestaurant(restaurant);
    }

    console.log("Seed completed");
    console.log(`Admin  : ${seedData.admin.email} / ${passwordFor(seedData.admin.passwordKey)}`);
    console.log(`Owner1 : owner@cafeking.com / ${passwordFor("cafeKingOwner")}`);
    console.log(`Owner2 : owner@beanhouse.com / ${passwordFor("beanHouseOwner")}`);
};

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
