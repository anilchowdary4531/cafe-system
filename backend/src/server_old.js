import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import tableSessions from "./routes/tableSessions.js";

import kitchen from "./routes/kitchen.js";

import superAdmin from "./routes/superAdmin.js";

dotenv.config();

const prisma = new PrismaClient();

const app = Fastify({
  logger: true,
});

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

const fallbackRestaurants = [
  { id: 11, name: "Cafe King", slug: "cafeking" },
  { id: 12, name: "Bean House", slug: "beanhouse" },
];

const seededPasswords = {
  cafeKingOwner: "ioVa3hRmNqQvTF",
  cafeKingManager: "dbVvrdeL6YZ9K5",
  cafeKingChef: "PACrQ1F6T1jnQ6",
  cafeKingChefR14: "fdfzCC8x8lTV7Q",
  cafeKingCashier: "IVBzlTRiJ3bcln",
  beanHouseOwner: "LAVt6Pqmt1TP9p",
  beanHouseManager: "JSD2iOxRcGTpmQ",
  beanHouseChef: "5GByUscLFOxMM5",
  beanHouseWaiter: "7w7dXVvDBmfI4T",
};

const fallbackRestaurantSettingsStore = {
  11: {
    legalName: "Cafe King Pvt Ltd",
    ownerName: "Cafe King Owner",
    email: "owner@cafeking.com",
    phone: "9999999999",
    addressLine1: "MG Road",
    city: "Bangalore",
    state: "Karnataka",
    country: "India",
    pincode: "560001",
    gstNumber: "29ABCDE1234F1Z5",
    logo: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxEnabled: true,
    taxType: "EXCLUSIVE",
    defaultTaxPercent: 5,
    serviceChargeEnabled: false,
    serviceChargePercent: 0,
    invoicePrefix: "CK",
    nextInvoiceNumber: 1001,
    isActive: true,
  },
  12: {
    legalName: "Bean House LLP","
    ownerName: "Bean House Owner",
    email: "owner@beanhouse.com,
    phone: "8888888888",
    addressLine1: "Banjara Hills",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    pincode: "500001",
    gstNumber: "36ABCDE1234F1Z5",
    logo: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxEnabled: true,
    taxType: "INCLUSIVE",
    defaultTaxPercent: 5,
    serviceChargeEnabled: false,
    serviceChargePercent: 0,
    invoicePrefix: "BH",
    nextInvoiceNumber: 1001,
    isActive: true,
  },
};

const fallbackUsers = [
  {
    id: 1,
    name: "Super Admin",
    email: "admin@suretra.com",
    password: "admin123",
    role: "SUPER_ADMIN",
    restaurantId: null,
    restaurant: null,
  },
  {
    id: 2,
    name: "Cafe King Owner",
    email: "owner@cafeking.com",
    password: seededPasswords.cafeKingOwner,
    role: "OWNER",
    restaurantId: 11,
    restaurant: fallbackRestaurants[0],
  },
  {
    id: 3,
    name: "Bean House Owner",
    email: "owner@beanhouse.com",
    password: seededPasswords.beanHouseOwner,
    role: "OWNER",
    restaurantId: 12,
    restaurant: fallbackRestaurants[1],
  },
  {
    id: 4,
    name: "Cafe King Manager",
    email: "manager.cafeking@suretra.com",
    phone: "9000000010",
    password: seededPasswords.cafeKingManager,
    role: "MANAGER",
    isActive: true,
    restaurantId: 11,
    restaurant: fallbackRestaurants[0],
  },
  {
    id: 5,
    name: "Cafe King Chef",
    email: "chef.cafeking@suretra.com",
    phone: "9000000011",
    password: seededPasswords.cafeKingChef,
    role: "CHEF",
    isActive: true,
    restaurantId: 11,
    restaurant: fallbackRestaurants[0],
  },
  {
    id: 6,
    name: "Cafe King Chef R14",
    email: "chef1.r14@cafeking.com",
    phone: "9000000099",
    password: seededPasswords.cafeKingChefR14,
    role: "CHEF",
    isActive: true,
    restaurantId: 11,
    restaurant: fallbackRestaurants[0],
  },
  {
    id: 7,
    name: "Cafe King Cashier",
    email: "cashier.cafeking@suretra.com",
    phone: "9000000012",
    password: seededPasswords.cafeKingCashier,
    role: "CASHIER",
    isActive: true,
    restaurantId: 11,
    restaurant: fallbackRestaurants[0],
  },
  {
    id: 8,
    name: "Bean House Manager",
    email: "manager.beanhouse@suretra.com",
    phone: "9000000020",
    password: seededPasswords.beanHouseManager,
    role: "MANAGER",
    isActive: true,
    restaurantId: 12,
    restaurant: fallbackRestaurants[1],
  },
  {
    id: 9,
    name: "Bean House Chef",
    email: "chef.beanhouse@suretra.com",
    phone: "9000000021",
    password: seededPasswords.beanHouseChef,
    role: "CHEF",
    isActive: true,
    restaurantId: 12,
    restaurant: fallbackRestaurants[1],
  },
  {
    id: 10,
    name: "Bean House Waiter",
    email: "waiter.beanhouse@suretra.com",
    phone: "9000000022",
    password: seededPasswords.beanHouseWaiter,
    role: "WAITER",
    isActive: true,
    restaurantId: 12,
    restaurant: fallbackRestaurants[1],
  },
];

let fallbackUserSeq = Math.max(...fallbackUsers.map((user) => Number(user.id || 0)), 10);

const fallbackMenuStore = {
  11: [
    {
      id: 1101,
      name: "Veg Biryani",
      description: "Aromatic rice with fresh spices.",
      category: "Food",
      image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d",
      price: 150,
      rating: 4.7,
      isAvailable: true,
      restaurantId: 11,
    },
  ],
  12: [
    {
      id: 1201,
      name: "Latte",
      description: "Smooth espresso with milk.",
      category: "Coffee",
      image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735",
      price: 170,
      rating: 4.8,
      isAvailable: true,
      restaurantId: 12,
    },
  ],
};

let fallbackMenuSeq = 2000;
let fallbackTableSeq = 3000;
let fallbackExpenseSeq = 4000;

const fallbackTableStore = {
  11: [
    {
      id: 3101,
      restaurantId: 11,
      tableNo: "T1",
      seats: 4,
      isActive: true,
      qrCodeUrl: "http://localhost:5173/r/cafeking?table=T1",
    },
    {
      id: 3102,
      restaurantId: 11,
      tableNo: "T2",
      seats: 4,
      isActive: true,
      qrCodeUrl: "http://localhost:5173/r/cafeking?table=T2",
    },
  ],
  12: [
    {
      id: 3201,
      restaurantId: 12,
      tableNo: "A1",
      seats: 2,
      isActive: true,
      qrCodeUrl: "http://localhost:5173/r/beanhouse?table=A1",
    },
    {
      id: 3202,
      restaurantId: 12,
      tableNo: "A2",
      seats: 4,
      isActive: true,
      qrCodeUrl: "http://localhost:5173/r/beanhouse?table=A2",
    },
  ],
};

const fallbackExpenseStore = {
  11: [
    {
      id: 4101,
      restaurantId: 11,
      title: "Milk & Dairy",
      category: "Supplies",
      amount: 2400,
      notes: "Weekly dairy restock",
      spentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 4102,
      restaurantId: 11,
      title: "Kitchen Gas",
      category: "Utilities",
      amount: 1800,
      notes: "",
      spentAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ],
  12: [
    {
      id: 4201,
      restaurantId: 12,
      title: "Coffee Beans",
      category: "Supplies",
      amount: 3200,
      notes: "Premium blend bag",
      spentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ],
};

const STAFF_ACCESS_MODULES = [
  "dashboard",
  "orders",
  "menu",
  "tables",
  "kitchen",
  "analytics",
  "finance",
  "staff",
  "settings",
];
const STAFF_ALLOWED_ROLES = ["OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"];

const staffAccessStore = {};
const staffPhoneStore = {};

const defaultAccessByRole = (role) => {
  const normalizedRole = String(role || "STAFF").toUpperCase();

  if (normalizedRole === "OWNER") {
    return STAFF_ACCESS_MODULES.reduce((acc, key) => ({ ...acc, [key]: true }), {});
  }
  if (normalizedRole === "MANAGER") {
    return {
      dashboard: true,
      orders: true,
      menu: true,
      tables: true,
      kitchen: true,
      analytics: true,
      finance: false,
      staff: false,
      settings: false,
    };
  }
  if (normalizedRole === "CHEF") {
    return {
      dashboard: true,
      orders: true,
      menu: false,
      tables: false,
      kitchen: true,
      analytics: false,
      finance: false,
      staff: false,
      settings: false,
    };
  }
  if (normalizedRole === "WAITER") {
    return {
      dashboard: true,
      orders: true,
      menu: true,
      tables: true,
      kitchen: false,
      analytics: false,
      finance: false,
      staff: false,
      settings: false,
    };
  }
  if (normalizedRole === "CASHIER") {
    return {
      dashboard: true,
      orders: true,
      menu: false,
      tables: false,
      kitchen: false,
      analytics: true,
      finance: true,
      staff: false,
      settings: false,
    };
  }

  return {
    dashboard: true,
    orders: false,
    menu: false,
    tables: false,
    kitchen: false,
    analytics: false,
    finance: false,
    staff: false,
    settings: false,
  };
};

const normalizeAccess = (rawAccess, role) => {
  const fallbackAccess = defaultAccessByRole(role);
  if (!rawAccess || typeof rawAccess !== "object") return fallbackAccess;

  return STAFF_ACCESS_MODULES.reduce((acc, key) => {
    const value = rawAccess[key];
    acc[key] = value === undefined ? fallbackAccess[key] : Boolean(value);
    return acc;
  }, {});
};

const normalizeDbPermissions = (permissions, role) => {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    return defaultAccessByRole(role);
  }
  return normalizeAccess(permissions, role);
};

const getStaffAccess = (restaurantId, staffId, role) => {
  const byRestaurant = staffAccessStore[restaurantId] || {};
  return byRestaurant[staffId] || defaultAccessByRole(role);
};

const setStaffAccess = (restaurantId, staffId, access) => {
  staffAccessStore[restaurantId] = staffAccessStore[restaurantId] || {};
  staffAccessStore[restaurantId][staffId] = access;
};

const getStaffPhone = (restaurantId, staffId, fallback = "") => {
  const byRestaurant = staffPhoneStore[restaurantId] || {};
  return byRestaurant[staffId] || fallback || "";
};

const setStaffPhone = (restaurantId, staffId, phone) => {
  staffPhoneStore[restaurantId] = staffPhoneStore[restaurantId] || {};
  staffPhoneStore[restaurantId][staffId] = phone || "";
};

const deleteStaffAccess = (restaurantId, staffId) => {
  if (!staffAccessStore[restaurantId]) return;
  delete staffAccessStore[restaurantId][staffId];
};

const deleteStaffPhone = (restaurantId, staffId) => {
  if (!staffPhoneStore[restaurantId]) return;
  delete staffPhoneStore[restaurantId][staffId];
};

const isDbUnavailable = (err) => {
  const msg = String(err?.message || "");
  return (
    err?.name === "PrismaClientInitializationError" ||
    msg.includes("Can't reach database server") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("P1001") ||
    msg.includes("P2021") ||
    msg.includes("P2022")
  );
};

const isOrderArchitectureUnavailable = (err) => {
  const msg = String(err?.message || "");
  return (
    msg.includes("Cannot read properties of undefined") ||
    msg.includes("Unknown argument `customerId`") ||
    msg.includes("Unknown argument `statusEvents`") ||
    msg.includes("Unknown field `customer`") ||
    msg.includes("Unknown field `statusEvents`") ||
    msg.includes("Unknown field `customerId`") ||
    msg.includes("Unknown field `restaurantId_phone`") ||
    msg.includes("Could not find mapping for model Customer") ||
    msg.includes("Could not find mapping for model OrderStatusEvent") ||
    msg.includes("Customer") && msg.includes("does not exist") ||
    msg.includes("OrderStatusEvent") && msg.includes("does not exist") ||
    msg.includes("column") && msg.includes("customerId") ||
    msg.includes("P2021") ||
    msg.includes("P2022")
  );
};

const getFrontendBaseUrl = () =>
  process.env.FRONTEND_URL || "http://localhost:5173";

const buildQrTargetUrl = (slug, tableNo) =>
  `${getFrontendBaseUrl()}/r/${slug}?table=${encodeURIComponent(tableNo)}`;

const ensureDefaultUsersInDatabase = async () => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, slug: true },
    });
    const restaurantIdBySlug = new Map(restaurants.map((restaurant) => [restaurant.slug, restaurant.id]));

    for (const fallbackUser of fallbackUsers) {
      const normalizedEmail = String(fallbackUser.email || "").trim().toLowerCase();
      const restaurantSlug = fallbackUser.restaurant?.slug || null;
      const restaurantId = restaurantSlug ? restaurantIdBySlug.get(restaurantSlug) || null : null;

      if (fallbackUser.role !== "SUPER_ADMIN" && restaurantSlug && !restaurantId) {
        continue;
      }

      const user = await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {
          name: fallbackUser.name,
          phone: fallbackUser.phone || null,
          role: fallbackUser.role,
          isActive: fallbackUser.isActive !== false,
          restaurantId,
        },
        create: {
          name: fallbackUser.name,
          email: normalizedEmail,
          phone: fallbackUser.phone || null,
          password: bcrypt.hashSync(String(fallbackUser.password), 10),
          role: fallbackUser.role,
          isActive: fallbackUser.isActive !== false,
          restaurantId,
        },
      });

      if (fallbackUser.role !== "SUPER_ADMIN" && restaurantId) {
        await prisma.staffAccess.upsert({
          where: { userId: user.id },
          update: {
            restaurantId,
            permissions: defaultAccessByRole(fallbackUser.role),
          },
          create: {
            restaurantId,
            userId: user.id,
            permissions: defaultAccessByRole(fallbackUser.role),
          },
        });
      }
    }
  } catch (err) {
    if (isDbUnavailable(err)) {
      app.log.warn("Skipping default user sync because the database is unavailable");
      return;
    }
    throw err;
  }
};

// ======================
// CORS
// ======================
const allowedCorsOrigins = new Set(
  [
    "http://localhost:5175",
    "http://localhost:5173",
    "https://suretra.com",
    "https://www.suretra.com",
    "https://cafe-system-nu.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean)
);

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowedCorsOrigins.has(origin)) {
      cb(null, true);
      return;
    }

    cb(new Error(`Origin ${origin} not allowed by CORS`), false);
  },
  credentials: true,
});

// ======================
// JWT
// ======================
await app.register(jwt, {
  secret: JWT_SECRET,
});

// ======================
// ROOT
// ======================
app.get("/", async () => {
  return {
    status: "ok",
    message: "Suretra Backend Running 🚀",
  };
});

// ======================
// LOGIN
// ======================
app.post("/login", async (req, reply) => {
  try {
    const body = req.body || {};
    const { email, password } = body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return reply.code(400).send({
        message: "Missing credentials",
      });
    }

    let user;
    let offlineMode = false;

    try {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          restaurant: true,
          staffAccess: {
            select: { permissions: true },
          },
        },
      });
    } catch (err) {
      if (!isDbUnavailable(err)) throw err;
      offlineMode = true;
      user = fallbackUsers.find((u) => String(u.email).toLowerCase() === normalizedEmail) || null;
    }

    if (!user) {
      user = fallbackUsers.find((u) => String(u.email).toLowerCase() === normalizedEmail) || null;
      if (user) {
        offlineMode = true;
      }
    }

    if (!user) {
      return reply.code(401).send({
        message: "Invalid email",
      });
    }

    const valid =
        user.password === password ||
        bcrypt.compareSync(password, user.password);

    if (!valid) {
      return reply.code(401).send({
        message: "Invalid password",
      });
    }
    if (user.isActive === false) {
      return reply.code(403).send({
        message: "Account is disabled. Contact owner/admin.",
      });
    }

    const token = app.jwt.sign({
      id: user.id,
      role: user.role,
      restaurantId: user.restaurantId || null,
    });

    let access = null;
    if (user.role !== "SUPER_ADMIN") {
      if (offlineMode) {
        const restaurantId = Number(user.restaurantId || 0);
        access = restaurantId
          ? getStaffAccess(restaurantId, user.id, user.role)
          : defaultAccessByRole(user.role);
      } else {
        access = normalizeDbPermissions(user.staffAccess?.permissions, user.role);
      }
    }

    const userPayload = {
      ...user,
      access,
    };
    if (userPayload.staffAccess !== undefined) {
      delete userPayload.staffAccess;
    }

    return {
      message: "Login success",
      token,
      user: userPayload,
      offlineMode,
    };
  } catch (err) {
    console.log(err);
    return reply.code(500).send({
      message:
          process.env.NODE_ENV === "development"
              ? `Login failed: ${err?.message || "Unknown error"}`
              : "Login failed",
    });
  }
});

// ======================
// GLOBAL MENU
// ======================
app.get("/menu", async () => {
  try {
    return await prisma.menuItem.findMany({
      where: {
        isAvailable: true,
      },
      orderBy: {
        id: "desc",
      },
    });
  } catch (err) {
    if (!isDbUnavailable(err)) throw err;

    return Object.values(fallbackMenuStore)
      .flat()
      .filter((item) => item.isAvailable)
      .sort((a, b) => b.id - a.id);
  }
});

// ======================
// RESTAURANT MENU BY SLUG
// ======================
app.get("/r/:slug/menu", async (req, reply) => {
  try {
    const { slug } = req.params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      include: {
        menuItems: {
          where: {
            isAvailable: true,
          },
          orderBy: {
            id: "desc",
          },
        },
      },
    });

    if (!restaurant) {
      return reply.code(404).send({
        message: "Restaurant not found",
      });
    }

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        gstEnabled: restaurant.gstEnabled,
        taxPercent: restaurant.taxPercent,
        logo: restaurant.logo,
        phone: restaurant.phone,
        email: restaurant.email,
      },
      menu: restaurant.menuItems,
    };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const { slug } = req.params;
      const restaurant = fallbackRestaurants.find((r) => r.slug === slug);

      if (!restaurant) {
        return reply.code(404).send({ message: "Restaurant not found" });
      }

      return {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          gstEnabled: true,
          taxPercent: 5,
          logo: null,
          phone: null,
          email: null,
        },
        menu: (fallbackMenuStore[restaurant.id] || []).filter((item) => item.isAvailable),
      };
    }

    console.log(err);
    return reply.code(500).send({
      message: "Failed to fetch menu",
    });
  }
});

// ======================
// OWNER DASHBOARD
// ======================
app.get("/owner/dashboard/:restaurantId", async (req, reply) => {
  try {
    const { restaurantId } = req.params;

    const id = Number(restaurantId);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        menuItems: true,
        orders: true,
        tables: true,
      },
    });

    if (!restaurant) {
      return reply.code(404).send({
        message: "Restaurant not found",
      });
    }

    const revenue = restaurant.orders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
    );

    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      menuCount: restaurant.menuItems.length,
      ordersCount: restaurant.orders.length,
      tablesCount: restaurant.tables.length,
      revenue,
      gstEnabled: restaurant.gstEnabled,
      taxPercent: restaurant.taxPercent,
    };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const id = Number(req.params.restaurantId);
      const restaurant = fallbackRestaurants.find((r) => r.id === id);
      const menuCount = (fallbackMenuStore[id] || []).length;

      if (!restaurant) {
        return reply.code(404).send({ message: "Restaurant not found" });
      }

      return {
        restaurantId: id,
        restaurantName: restaurant.name,
        menuCount,
        ordersCount: 0,
        tablesCount: 0,
        revenue: 0,
        gstEnabled: true,
        taxPercent: 5,
      };
    }

    console.log(err);
    return reply.code(500).send({
      message: "Dashboard failed",
    });
  }
});

// ======================
// OWNER MENU STUDIO
// ======================
app.get("/owner/:restaurantId/menu", async (req, reply) => {
  try {
    const id = Number(req.params.restaurantId);

    if (!id) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }

    const items = await prisma.menuItem.findMany({
      where: { restaurantId: id },
      orderBy: { id: "desc" },
    });

    return items;
  } catch (err) {
    if (isDbUnavailable(err)) {
      const id = Number(req.params.restaurantId);
      if (!id) {
        return reply.code(400).send({ message: "Invalid restaurant id" });
      }
      return fallbackMenuStore[id] || [];
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to fetch menu items" });
  }
});

app.post("/owner/:restaurantId/menu", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const { name, description, category, image, price, isAvailable } = req.body || {};

    if (!restaurantId) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }

    if (!name || !category || price === undefined || price === null) {
      return reply.code(400).send({ message: "Missing required fields" });
    }

    const item = await prisma.menuItem.create({
      data: {
        restaurantId,
        name,
        description: description || "",
        category,
        image: image || "",
        price: Number(price),
        isAvailable: isAvailable ?? true,
      },
    });

    return item;
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const { name, description, category, image, price, isAvailable } = req.body || {};

      if (!restaurantId) {
        return reply.code(400).send({ message: "Invalid restaurant id" });
      }

      if (!name || !category || price === undefined || price === null) {
        return reply.code(400).send({ message: "Missing required fields" });
      }

      const newItem = {
        id: ++fallbackMenuSeq,
        restaurantId,
        name,
        description: description || "",
        category,
        image: image || "",
        price: Number(price),
        isAvailable: isAvailable ?? true,
      };

      fallbackMenuStore[restaurantId] = fallbackMenuStore[restaurantId] || [];
      fallbackMenuStore[restaurantId].unshift(newItem);
      return newItem;
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to create menu item" });
  }
});

app.put("/owner/:restaurantId/menu/:menuId", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const menuId = Number(req.params.menuId);
    const { name, description, category, image, price, isAvailable } = req.body || {};

    if (!restaurantId || !menuId) {
      return reply.code(400).send({ message: "Invalid id values" });
    }

    const item = await prisma.menuItem.findUnique({
      where: { id: menuId },
    });

    if (!item || item.restaurantId !== restaurantId) {
      return reply.code(404).send({ message: "Menu item not found" });
    }

    const updated = await prisma.menuItem.update({
      where: { id: menuId },
      data: {
        name: name ?? item.name,
        description: description ?? item.description,
        category: category ?? item.category,
        image: image ?? item.image,
        price: price === undefined ? item.price : Number(price),
        isAvailable: isAvailable ?? item.isAvailable,
      },
    });

    return updated;
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const menuId = Number(req.params.menuId);
      const { name, description, category, image, price, isAvailable } = req.body || {};

      const list = fallbackMenuStore[restaurantId] || [];
      const idx = list.findIndex((i) => i.id === menuId);

      if (idx === -1) {
        return reply.code(404).send({ message: "Menu item not found" });
      }

      list[idx] = {
        ...list[idx],
        name: name ?? list[idx].name,
        description: description ?? list[idx].description,
        category: category ?? list[idx].category,
        image: image ?? list[idx].image,
        price: price === undefined ? list[idx].price : Number(price),
        isAvailable: isAvailable ?? list[idx].isAvailable,
      };

      return list[idx];
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to update menu item" });
  }
});

app.delete("/owner/:restaurantId/menu/:menuId", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const menuId = Number(req.params.menuId);

    if (!restaurantId || !menuId) {
      return reply.code(400).send({ message: "Invalid id values" });
    }

    const item = await prisma.menuItem.findUnique({
      where: { id: menuId },
    });

    if (!item || item.restaurantId !== restaurantId) {
      return reply.code(404).send({ message: "Menu item not found" });
    }

    await prisma.menuItem.delete({
      where: { id: menuId },
    });

    return { message: "Menu item deleted" };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const menuId = Number(req.params.menuId);
      const list = fallbackMenuStore[restaurantId] || [];
      const idx = list.findIndex((i) => i.id === menuId);

      if (idx === -1) {
        return reply.code(404).send({ message: "Menu item not found" });
      }

      list.splice(idx, 1);
      return { message: "Menu item deleted" };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to delete menu item" });
  }
});

// ======================
// OWNER TABLES & QR
// ======================
app.get("/owner/:restaurantId/tables", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);

    if (!restaurantId) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }

    const tables = await prisma.diningTable.findMany({
      where: { restaurantId },
      orderBy: { id: "desc" },
    });

    return tables;
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      return fallbackTableStore[restaurantId] || [];
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to fetch tables" });
  }
});

app.post("/owner/:restaurantId/tables", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const { tableNo, seats, isActive } = req.body || {};

    if (!restaurantId) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }

    if (!tableNo) {
      return reply.code(400).send({ message: "Table number is required" });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, slug: true },
    });

    if (!restaurant) {
      return reply.code(404).send({ message: "Restaurant not found" });
    }

    const existing = await prisma.diningTable.findFirst({
      where: {
        restaurantId,
        tableNo,
      },
      select: { id: true },
    });

    if (existing) {
      return reply.code(400).send({ message: "Table number already exists" });
    }

    const targetUrl = buildQrTargetUrl(restaurant.slug, tableNo);

    const table = await prisma.diningTable.create({
      data: {
        restaurantId,
        tableNo,
        seats: Number(seats || 4),
        isActive: isActive ?? true,
        qrCodeUrl: targetUrl,
      },
    });

    return table;
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const { tableNo, seats, isActive } = req.body || {};
      const restaurant = fallbackRestaurants.find((r) => r.id === restaurantId);

      if (!restaurantId) {
        return reply.code(400).send({ message: "Invalid restaurant id" });
      }

      if (!tableNo) {
        return reply.code(400).send({ message: "Table number is required" });
      }

      fallbackTableStore[restaurantId] = fallbackTableStore[restaurantId] || [];

      if (fallbackTableStore[restaurantId].some((t) => t.tableNo === tableNo)) {
        return reply.code(400).send({ message: "Table number already exists" });
      }

      const table = {
        id: ++fallbackTableSeq,
        restaurantId,
        tableNo,
        seats: Number(seats || 4),
        isActive: isActive ?? true,
        qrCodeUrl: buildQrTargetUrl(restaurant?.slug || "cafeking", tableNo),
      };

      fallbackTableStore[restaurantId].unshift(table);
      return table;
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to create table" });
  }
});

app.put("/owner/:restaurantId/tables/:tableId", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const tableId = Number(req.params.tableId);
    const { tableNo, seats, isActive } = req.body || {};

    if (!restaurantId || !tableId) {
      return reply.code(400).send({ message: "Invalid id values" });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, slug: true },
    });

    if (!restaurant) {
      return reply.code(404).send({ message: "Restaurant not found" });
    }

    const existing = await prisma.diningTable.findUnique({
      where: { id: tableId },
    });

    if (!existing || existing.restaurantId !== restaurantId) {
      return reply.code(404).send({ message: "Table not found" });
    }

    if (tableNo && tableNo !== existing.tableNo) {
      const duplicate = await prisma.diningTable.findFirst({
        where: {
          restaurantId,
          tableNo,
          NOT: { id: tableId },
        },
      });
      if (duplicate) {
        return reply.code(400).send({ message: "Table number already exists" });
      }
    }

    const nextTableNo = tableNo ?? existing.tableNo;

    const updated = await prisma.diningTable.update({
      where: { id: tableId },
      data: {
        tableNo: nextTableNo,
        seats: seats === undefined ? existing.seats : Number(seats),
        isActive: isActive ?? existing.isActive,
        qrCodeUrl: buildQrTargetUrl(restaurant.slug, nextTableNo),
      },
    });

    return updated;
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      const { tableNo, seats, isActive } = req.body || {};
      const restaurant = fallbackRestaurants.find((r) => r.id === restaurantId);

      const list = fallbackTableStore[restaurantId] || [];
      const idx = list.findIndex((t) => t.id === tableId);

      if (idx === -1) {
        return reply.code(404).send({ message: "Table not found" });
      }

      if (tableNo && tableNo !== list[idx].tableNo) {
        const duplicate = list.find((t) => t.tableNo === tableNo && t.id !== tableId);
        if (duplicate) {
          return reply.code(400).send({ message: "Table number already exists" });
        }
      }

      const nextTableNo = tableNo ?? list[idx].tableNo;
      list[idx] = {
        ...list[idx],
        tableNo: nextTableNo,
        seats: seats === undefined ? list[idx].seats : Number(seats),
        isActive: isActive ?? list[idx].isActive,
        qrCodeUrl: buildQrTargetUrl(restaurant?.slug || "cafeking", nextTableNo),
      };

      return list[idx];
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to update table" });
  }
});

app.delete("/owner/:restaurantId/tables/:tableId", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const tableId = Number(req.params.tableId);

    if (!restaurantId || !tableId) {
      return reply.code(400).send({ message: "Invalid id values" });
    }

    const table = await prisma.diningTable.findUnique({
      where: { id: tableId },
      select: { id: true, restaurantId: true },
    });

    if (!table || table.restaurantId !== restaurantId) {
      return reply.code(404).send({ message: "Table not found" });
    }

    await prisma.diningTable.delete({
      where: { id: tableId },
    });

    return { message: "Table deleted" };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      const list = fallbackTableStore[restaurantId] || [];
      const idx = list.findIndex((t) => t.id === tableId);

      if (idx === -1) {
        return reply.code(404).send({ message: "Table not found" });
      }

      list.splice(idx, 1);
      return { message: "Table deleted" };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to delete table" });
  }
});

// ======================
// START
// ======================
const start = async () => {
  try {
    await ensureDefaultUsersInDatabase();
    await app.listen({
      port: PORT,
      host: "0.0.0.0",
    });

    console.log(`🚀 Running on ${PORT}`);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};
app.post("/r/:slug/order", async (req, reply) => {
  try {
    const { slug } = req.params;

    const {
      customerName,
      phone,
      email,
      tableNumber,
      items,
      notes,
    } = req.body;
    const normalizedPhone = String(phone || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCustomerName = String(customerName || "").trim();

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
    });

    if (!restaurant) {
      return reply.code(404).send({
        message: "Restaurant not found",
      });
    }

    if (!items || items.length === 0) {
      return reply.code(400).send({
        message: "No items selected",
      });
    }

    const requestedIds = items
      .map((item) => Number(item.id || item.menuItemId))
      .filter((id) => Number.isInteger(id) && id > 0);

    let normalizedItems = [];

    if (requestedIds.length > 0) {
      const availableMenuItems = await prisma.menuItem.findMany({
        where: {
          restaurantId: restaurant.id,
          id: { in: requestedIds },
          isAvailable: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
        },
      });

      const availableById = new Map(
        availableMenuItems.map((menuItem) => [menuItem.id, menuItem])
      );

      for (const rawItem of items) {
        const itemId = Number(rawItem.id || rawItem.menuItemId);
        const dbItem = availableById.get(itemId);

        if (!itemId || !dbItem) {
          return reply.code(400).send({
            message: "One or more items are unavailable",
          });
        }

        const qty = Math.max(1, Number(rawItem.qty || 1));
        const price = Number(dbItem.price);

        normalizedItems.push({
          menuItemId: dbItem.id,
          itemName: dbItem.name,
          qty,
          price,
          total: price * qty,
        });
      }
    } else {
      normalizedItems = items.map((rawItem) => {
        const qty = Math.max(1, Number(rawItem.qty || 1));
        const price = Number(rawItem.price);

        return {
          menuItemId: null,
          itemName: rawItem.name,
          qty,
          price,
          total: price * qty,
        };
      });
    }

    const subtotal = normalizedItems.reduce(
      (sum, item) => sum + Number(item.total || 0),
      0
    );

    // Tax
    const taxAmount = restaurant.taxEnabled
        ? (subtotal * restaurant.defaultTaxPercent) / 100
        : 0;

    // Service Charge
    const serviceChargeAmount =
        restaurant.serviceChargeEnabled
            ? (subtotal *
                restaurant.serviceChargePercent) /
            100
            : 0;

    const total =
        subtotal + taxAmount + serviceChargeAmount;

    // Order Number
    const orderNo =
        "ORD-" + Date.now();

    const invoiceNo =
        `${restaurant.invoicePrefix}-${restaurant.nextInvoiceNumber}`;

    let customerRecord = null;
    if (normalizedPhone) {
      try {
        customerRecord = await prisma.customer.upsert({
          where: {
            restaurantId_phone: {
              restaurantId: restaurant.id,
              phone: normalizedPhone,
            },
          },
          update: {
            name: normalizedCustomerName || undefined,
            email: normalizedEmail || undefined,
          },
          create: {
            restaurantId: restaurant.id,
            name: normalizedCustomerName || null,
            phone: normalizedPhone,
            email: normalizedEmail || null,
          },
        });
      } catch (err) {
        if (!isOrderArchitectureUnavailable(err)) {
          throw err;
        }
      }
    }

    const baseOrderData = {
      restaurantId: restaurant.id,

      orderNo,
      invoiceNo,

      customerName: normalizedCustomerName || null,
      phone: normalizedPhone || null,
      email: normalizedEmail || null,
      tableNo: tableNumber,
      notes,

      subtotal,
      taxAmount,
      serviceChargeAmount,
      total,

      status: "PLACED",

      items: {
        create: normalizedItems.map((item) => ({
          menuItemId: item.menuItemId,
          itemName: item.itemName,
          qty: item.qty,
          price: item.price,
          total: item.total,
        })),
      },
    };

    let order;
    try {
      order = await prisma.order.create({
        data: {
          ...baseOrderData,
          customerId: customerRecord?.id || null,
          statusEvents: {
            create: {
              status: "PLACED",
              source: "CUSTOMER",
              changedByName: normalizedCustomerName || normalizedPhone || "Customer",
            },
          },
        },
        include: {
          items: true,
          customer: true,
          statusEvents: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
    } catch (err) {
      if (!isOrderArchitectureUnavailable(err)) {
        throw err;
      }

      order = await prisma.order.create({
        data: baseOrderData,
        include: {
          items: true,
        },
      });
    }

    // Increment invoice
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        nextInvoiceNumber: {
          increment: 1,
        },
      },
    });

    return {
      message: "Order placed successfully",
      order,
    };
  } catch (err) {
    console.log(err);

    return reply.code(500).send({
      message: "Order failed",
    });
  }
});
app.get("/r/:slug/orders", async (req, reply) => {
  try {
    const { slug } = req.params;
    const phone = String(req.query?.phone || "").trim();

    const restaurant =
        await prisma.restaurant.findUnique({
          where: { slug },
        });

    if (!restaurant) {
      return reply.code(404).send({
        message: "Restaurant not found",
      });
    }

    const orders =
        await prisma.order.findMany({
          where: {
            restaurantId: restaurant.id,
            ...(phone ? { phone } : {}),
          },
          include: {
            items: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

    return orders;
  } catch (err) {
    console.log(err);

    return reply.code(500).send({
      message: "Failed to fetch orders",
    });
  }
});

app.get("/owner/:restaurantId/analytics", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const range = String(req.query?.range || "7d").toLowerCase();
    const validRanges = ["24h", "7d", "30d"];

    if (!restaurantId) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }

    if (!validRanges.includes(range)) {
      return reply.code(400).send({
        message: `Invalid range. Allowed: ${validRanges.join(", ")}`,
      });
    }

    const now = new Date();
    const bucketCount = range === "24h" ? 24 : range === "7d" ? 7 : 30;
    const bucketMs = range === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const seriesStart = new Date(now.getTime() - (bucketCount - 1) * bucketMs);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        defaultTaxPercent: true,
        serviceChargePercent: true,
        taxEnabled: true,
        serviceChargeEnabled: true,
      },
    });

    if (!restaurant) {
      return reply.code(404).send({ message: "Restaurant not found" });
    }

    const [orders, menuItems, tables] = await Promise.all([
      prisma.order.findMany({
        where: {
          restaurantId,
          createdAt: {
            gte: seriesStart,
          },
        },
        include: {
          items: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.menuItem.findMany({
        where: { restaurantId },
        select: {
          id: true,
          name: true,
          category: true,
          isAvailable: true,
          price: true,
        },
      }),
      prisma.diningTable.findMany({
        where: { restaurantId },
        select: {
          id: true,
          tableNo: true,
          isActive: true,
          seats: true,
        },
      }),
    ]);

    const statusKeys = [
      "PLACED",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "DELIVERED",
      "CANCELLED",
    ];
    const activeStatuses = ["PLACED", "ACCEPTED", "PREPARING", "READY"];
    const terminalStatuses = ["DELIVERED", "CANCELLED"];
    const statusCounts = statusKeys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});

    const totalOrders = orders.length;
    let totalRevenue = 0;
    let totalSubtotal = 0;
    let delayedTickets = 0;
    let totalCycleMinutes = 0;
    let deliveredWithCycle = 0;

    const timeseries = Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(seriesStart.getTime() + index * bucketMs);
      const label =
          range === "24h"
              ? `${String(start.getHours()).padStart(2, "0")}:00`
              : `${String(start.getDate()).padStart(2, "0")}/${String(
                  start.getMonth() + 1
              ).padStart(2, "0")}`;
      return {
        idx: index,
        ts: start.toISOString(),
        label,
        orders: 0,
        revenue: 0,
      };
    });

    const itemMap = new Map();
    const categoryMap = new Map();
    const tableMap = new Map();
    const menuById = new Map(menuItems.map((m) => [m.id, m]));

    for (const order of orders) {
      const orderStatus = String(order.status || "PLACED").toUpperCase();
      if (statusCounts[orderStatus] !== undefined) {
        statusCounts[orderStatus] += 1;
      } else {
        statusCounts.PLACED += 1;
      }

      const orderTotal = Number(order.total || 0);
      const orderSubtotal = Number(order.subtotal || 0);
      totalRevenue += orderTotal;
      totalSubtotal += orderSubtotal;

      const createdAtMs = new Date(order.createdAt).getTime();
      const ageMin = (now.getTime() - createdAtMs) / 60000;
      if (activeStatuses.includes(orderStatus) && ageMin > 20) {
        delayedTickets += 1;
      }

      if (orderStatus === "DELIVERED") {
        const updatedAtMs = new Date(order.updatedAt).getTime();
        const cycleMin = Math.max(0, (updatedAtMs - createdAtMs) / 60000);
        totalCycleMinutes += cycleMin;
        deliveredWithCycle += 1;
      }

      const bucketIndex = Math.floor((createdAtMs - seriesStart.getTime()) / bucketMs);
      if (bucketIndex >= 0 && bucketIndex < timeseries.length) {
        timeseries[bucketIndex].orders += 1;
        timeseries[bucketIndex].revenue += orderTotal;
      }

      const tableNo = order.tableNo || "Walk-in";
      const tableAgg = tableMap.get(tableNo) || { tableNo, orders: 0, revenue: 0 };
      tableAgg.orders += 1;
      tableAgg.revenue += orderTotal;
      tableMap.set(tableNo, tableAgg);

      for (const item of order.items || []) {
        const itemName = item.itemName || "Unknown Item";
        const qty = Number(item.qty || 0);
        const revenue = Number(item.total || 0);
        const itemAgg = itemMap.get(itemName) || { name: itemName, qty: 0, revenue: 0 };
        itemAgg.qty += qty;
        itemAgg.revenue += revenue;
        itemMap.set(itemName, itemAgg);

        const categoryFromMenu = item.menuItemId
            ? menuById.get(item.menuItemId)?.category
            : null;
        const categoryName = categoryFromMenu || "Uncategorized";
        const categoryAgg = categoryMap.get(categoryName) || {
          name: categoryName,
          qty: 0,
          revenue: 0,
        };
        categoryAgg.qty += qty;
        categoryAgg.revenue += revenue;
        categoryMap.set(categoryName, categoryAgg);
      }
    }

    const totalActiveOrders = activeStatuses.reduce(
        (sum, key) => sum + Number(statusCounts[key] || 0),
        0
    );
    const deliveredOrders = Number(statusCounts.DELIVERED || 0);
    const cancelledOrders = Number(statusCounts.CANCELLED || 0);
    const closedOrders = deliveredOrders + cancelledOrders;

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const completionRate = closedOrders > 0 ? (deliveredOrders / closedOrders) * 100 : 0;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const avgPrepMinutes = deliveredWithCycle > 0 ? totalCycleMinutes / deliveredWithCycle : 0;

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter((o) => new Date(o.createdAt) >= todayStart);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const elapsedHoursToday = Math.max(
        1,
        (now.getTime() - todayStart.getTime()) / (60 * 60 * 1000)
    );
    const runRatePerHour = todayRevenue / elapsedHoursToday;
    const projectedEodRevenue = runRatePerHour * 24;

    let forecastConfidence = "low";
    if (todayOrders.length >= 20) forecastConfidence = "high";
    else if (todayOrders.length >= 8) forecastConfidence = "medium";

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    const categories = Array.from(categoryMap.values()).sort(
        (a, b) => b.revenue - a.revenue
    );

    const tableHeatmap = Array.from(tableMap.values())
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10)
      .map((row) => ({
        ...row,
        avgTicket: row.orders > 0 ? row.revenue / row.orders : 0,
      }));

    const peakWindows = [...timeseries]
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 3)
      .map((slot) => ({
        label: slot.label,
        orders: slot.orders,
        revenue: slot.revenue,
      }));

    const insights = [];
    if (delayedTickets > 0) {
      insights.push({
        level: "warning",
        title: "SLA Alert",
        description: `${delayedTickets} live ticket(s) are older than 20 minutes.`,
      });
    }
    if (cancellationRate >= 12) {
      insights.push({
        level: "warning",
        title: "Cancellation Risk",
        description: `Cancellation rate is ${cancellationRate.toFixed(1)}%. Check bottlenecks.`,
      });
    }
    if (completionRate >= 80 && totalOrders >= 10) {
      insights.push({
        level: "success",
        title: "Healthy Throughput",
        description: `${completionRate.toFixed(1)}% completion from closed orders.`,
      });
    }
    if (peakWindows[0]?.orders > 0) {
      insights.push({
        level: "info",
        title: "Peak Window",
        description: `Highest demand around ${peakWindows[0].label}.`,
      });
    }

    return {
      generatedAt: now.toISOString(),
      range,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        timezone: restaurant.timezone || "Asia/Kolkata",
      },
      overview: {
        totalOrders,
        totalRevenue,
        totalSubtotal,
        avgOrderValue,
        deliveredOrders,
        cancelledOrders,
        completionRate,
        cancellationRate,
      },
      realtime: {
        activeQueue: totalActiveOrders,
        delayedTickets,
        avgPrepMinutes,
        activeTables: tables.filter((t) => t.isActive).length,
        totalTables: tables.length,
        availableMenuItems: menuItems.filter((m) => m.isAvailable).length,
        totalMenuItems: menuItems.length,
      },
      forecast: {
        todayRevenue,
        runRatePerHour,
        projectedEodRevenue,
        confidence: forecastConfidence,
      },
      statusFunnel: statusKeys.map((key) => ({
        status: key,
        count: statusCounts[key] || 0,
      })),
      charts: {
        timeseries,
        peakWindows,
        topItems,
        categories,
        tableHeatmap,
      },
      insights,
    };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const fallbackRestaurant = fallbackRestaurants.find((r) => r.id === restaurantId);
      const fallbackMenu = fallbackMenuStore[restaurantId] || [];
      const fallbackTables = fallbackTableStore[restaurantId] || [];

      if (!fallbackRestaurant) {
        return reply.code(404).send({ message: "Restaurant not found" });
      }

      return {
        generatedAt: new Date().toISOString(),
        range: String(req.query?.range || "7d").toLowerCase(),
        restaurant: fallbackRestaurant,
        overview: {
          totalOrders: 0,
          totalRevenue: 0,
          totalSubtotal: 0,
          avgOrderValue: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          completionRate: 0,
          cancellationRate: 0,
        },
        realtime: {
          activeQueue: 0,
          delayedTickets: 0,
          avgPrepMinutes: 0,
          activeTables: fallbackTables.filter((t) => t.isActive).length,
          totalTables: fallbackTables.length,
          availableMenuItems: fallbackMenu.filter((m) => m.isAvailable).length,
          totalMenuItems: fallbackMenu.length,
        },
        forecast: {
          todayRevenue: 0,
          runRatePerHour: 0,
          projectedEodRevenue: 0,
          confidence: "low",
        },
        statusFunnel: [
          { status: "PLACED", count: 0 },
          { status: "ACCEPTED", count: 0 },
          { status: "PREPARING", count: 0 },
          { status: "READY", count: 0 },
          { status: "DELIVERED", count: 0 },
          { status: "CANCELLED", count: 0 },
        ],
        charts: {
          timeseries: [],
          peakWindows: [],
          topItems: [],
          categories: [],
          tableHeatmap: [],
        },
        insights: [
          {
            level: "info",
            title: "Offline Mode",
            description: "Database unavailable. Showing fallback analytics shell.",
          },
        ],
      };
    }

    console.log(err);
    return reply.code(500).send({
      message: "Failed to fetch analytics",
    });
  }
});

app.get("/owner/:restaurantId/finance", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const range = String(req.query?.range || "7d").toLowerCase();
    const validRanges = ["24h", "7d", "30d"];

    if (!restaurantId) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }
    if (!validRanges.includes(range)) {
      return reply.code(400).send({
        message: `Invalid range. Allowed: ${validRanges.join(", ")}`,
      });
    }

    const now = new Date();
    const fromDate = new Date(
        now.getTime() - (range === "24h" ? 1 : range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000
    );

    const [restaurant, orders, tables, menuItems] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, slug: true },
      }),
      prisma.order.findMany({
        where: {
          restaurantId,
          createdAt: { gte: fromDate },
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.diningTable.findMany({
        where: { restaurantId },
        select: { id: true, isActive: true },
      }),
      prisma.menuItem.findMany({
        where: { restaurantId },
        select: { id: true, isAvailable: true },
      }),
    ]);

    if (!restaurant) {
      return reply.code(404).send({ message: "Restaurant not found" });
    }

    const expenses = [...(fallbackExpenseStore[restaurantId] || [])].filter(
        (expense) => new Date(expense.spentAt || expense.createdAt) >= fromDate
    );

    let grossSales = 0;
    let netSales = 0;
    let taxCollected = 0;
    let serviceChargeCollected = 0;
    let discountGiven = 0;
    let refundAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;

    const paymentSplit = {};
    const statusMix = {};
    const invoices = orders.map((order) => {
      const total = Number(order.total || 0);
      const discount = Number(order.discountAmount || 0);
      const taxAmount = Number(order.taxAmount || 0);
      const serviceCharge = Number(order.serviceChargeAmount || 0);
      const status = String(order.status || "PLACED").toUpperCase();
      const paymentStatus = String(order.paymentStatus || "PENDING").toUpperCase();
      const paymentMode = String(order.paymentMode || "UNKNOWN").toUpperCase();

      grossSales += total;
      netSales += total - discount;
      taxCollected += taxAmount;
      serviceChargeCollected += serviceCharge;
      discountGiven += discount;

      if (status === "CANCELLED") {
        refundAmount += total;
      }

      if (paymentStatus === "PAID") {
        paidAmount += total;
      } else {
        unpaidAmount += total;
      }

      paymentSplit[paymentMode] = (paymentSplit[paymentMode] || 0) + total;
      statusMix[status] = (statusMix[status] || 0) + 1;

      return {
        id: order.id,
        orderNo: order.orderNo,
        invoiceNo: order.invoiceNo,
        customerName: order.customerName,
        tableNo: order.tableNo,
        total,
        taxAmount,
        serviceCharge,
        paymentMode,
        paymentStatus,
        status,
        createdAt: order.createdAt,
      };
    });

    const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const operatingProfit = netSales - expenseTotal;
    const collectionEfficiency = grossSales > 0 ? (paidAmount / grossSales) * 100 : 0;
    const marginPct = netSales > 0 ? (operatingProfit / netSales) * 100 : 0;

    return {
      generatedAt: now.toISOString(),
      range,
      restaurant,
      summary: {
        invoiceCount: invoices.length,
        grossSales,
        netSales,
        taxCollected,
        serviceChargeCollected,
        discountGiven,
        refundAmount,
        paidAmount,
        unpaidAmount,
        expenseTotal,
        operatingProfit,
        collectionEfficiency,
        marginPct,
      },
      operational: {
        activeTables: tables.filter((table) => table.isActive).length,
        totalTables: tables.length,
        liveMenuItems: menuItems.filter((item) => item.isAvailable).length,
        totalMenuItems: menuItems.length,
      },
      paymentSplit: Object.entries(paymentSplit)
        .map(([mode, amount]) => ({ mode, amount }))
        .sort((a, b) => b.amount - a.amount),
      statusMix: Object.entries(statusMix)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      expenses: expenses.sort(
          (a, b) => new Date(b.spentAt || b.createdAt) - new Date(a.spentAt || a.createdAt)
      ),
      invoices,
      aiSignals: [
        {
          type: "INSIGHT",
          title: "Collection Efficiency",
          message: `Collections settled ${collectionEfficiency.toFixed(1)}% in selected window.`,
        },
        {
          type: marginPct >= 20 ? "GOOD" : "WARNING",
          title: "Operating Margin",
          message: `Estimated operating margin is ${marginPct.toFixed(1)}%.`,
        },
        {
          type: unpaidAmount > grossSales * 0.25 ? "WARNING" : "INFO",
          title: "Outstanding Risk",
          message:
              unpaidAmount > 0
                  ? `${unpaidAmount.toFixed(2)} remains unpaid.`
                  : "All invoices fully collected.",
        },
      ],
    };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const restaurant = fallbackRestaurants.find((r) => r.id === restaurantId);
      const expenses = fallbackExpenseStore[restaurantId] || [];
      const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

      if (!restaurant) {
        return reply.code(404).send({ message: "Restaurant not found" });
      }

      return {
        generatedAt: new Date().toISOString(),
        range: String(req.query?.range || "7d").toLowerCase(),
        restaurant,
        summary: {
          invoiceCount: 0,
          grossSales: 0,
          netSales: 0,
          taxCollected: 0,
          serviceChargeCollected: 0,
          discountGiven: 0,
          refundAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          expenseTotal,
          operatingProfit: -expenseTotal,
          collectionEfficiency: 0,
          marginPct: 0,
        },
        operational: {
          activeTables: (fallbackTableStore[restaurantId] || []).filter((table) => table.isActive).length,
          totalTables: (fallbackTableStore[restaurantId] || []).length,
          liveMenuItems: (fallbackMenuStore[restaurantId] || []).filter((item) => item.isAvailable).length,
          totalMenuItems: (fallbackMenuStore[restaurantId] || []).length,
        },
        paymentSplit: [],
        statusMix: [],
        expenses,
        invoices: [],
        aiSignals: [
          {
            type: "INFO",
            title: "Offline Mode",
            message: "Database unavailable. Showing fallback finance shell.",
          },
        ],
      };
    }

    console.log(err);
    return reply.code(500).send({
      message: "Failed to fetch finance analytics",
    });
  }
});

app.get("/owner/:restaurantId/settings", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);

    if (!restaurantId) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        legalName: true,
        slug: true,
        ownerName: true,
        email: true,
        phone: true,
        addressLine1: true,
        city: true,
        state: true,
        country: true,
        pincode: true,
        gstNumber: true,
        logo: true,
        timezone: true,
        currency: true,
        taxEnabled: true,
        taxType: true,
        defaultTaxPercent: true,
        serviceChargeEnabled: true,
        serviceChargePercent: true,
        invoicePrefix: true,
        nextInvoiceNumber: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (!restaurant) {
      return reply.code(404).send({ message: "Restaurant not found" });
    }

    return { restaurant };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const base = fallbackRestaurants.find((r) => r.id === restaurantId);
      const settings = fallbackRestaurantSettingsStore[restaurantId];
      if (!base || !settings) {
        return reply.code(404).send({ message: "Restaurant not found" });
      }

      return {
        restaurant: {
          id: base.id,
          name: base.name,
          slug: base.slug,
          ...settings,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to fetch restaurant settings" });
  }
});

app.put("/owner/:restaurantId/settings", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const body = req.body || {};

    if (!restaurantId) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }

    const updates = {
      name: body.name,
      legalName: body.legalName,
      ownerName: body.ownerName,
      email: body.email,
      phone: body.phone,
      addressLine1: body.addressLine1,
      city: body.city,
      state: body.state,
      country: body.country,
      pincode: body.pincode,
      gstNumber: body.gstNumber,
      logo: body.logo,
      timezone: body.timezone,
      currency: body.currency,
      taxEnabled: body.taxEnabled,
      taxType: body.taxType,
      defaultTaxPercent: body.defaultTaxPercent,
      serviceChargeEnabled: body.serviceChargeEnabled,
      serviceChargePercent: body.serviceChargePercent,
      invoicePrefix: body.invoicePrefix,
      nextInvoiceNumber: body.nextInvoiceNumber,
      isActive: body.isActive,
    };

    const filteredData = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    if (filteredData.defaultTaxPercent !== undefined) {
      filteredData.defaultTaxPercent = Number(filteredData.defaultTaxPercent);
    }
    if (filteredData.serviceChargePercent !== undefined) {
      filteredData.serviceChargePercent = Number(filteredData.serviceChargePercent);
    }
    if (filteredData.nextInvoiceNumber !== undefined) {
      filteredData.nextInvoiceNumber = Number(filteredData.nextInvoiceNumber);
    }
    if (filteredData.taxType !== undefined) {
      const taxType = String(filteredData.taxType).toUpperCase();
      if (!["INCLUSIVE", "EXCLUSIVE"].includes(taxType)) {
        return reply.code(400).send({ message: "taxType must be INCLUSIVE or EXCLUSIVE" });
      }
      filteredData.taxType = taxType;
    }
    ["taxEnabled", "serviceChargeEnabled", "isActive"].forEach((key) => {
      if (filteredData[key] !== undefined) {
        filteredData[key] = Boolean(filteredData[key]);
      }
    });

    const updated = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: filteredData,
      select: {
        id: true,
        name: true,
        legalName: true,
        slug: true,
        ownerName: true,
        email: true,
        phone: true,
        addressLine1: true,
        city: true,
        state: true,
        country: true,
        pincode: true,
        gstNumber: true,
        logo: true,
        timezone: true,
        currency: true,
        taxEnabled: true,
        taxType: true,
        defaultTaxPercent: true,
        serviceChargeEnabled: true,
        serviceChargePercent: true,
        invoicePrefix: true,
        nextInvoiceNumber: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return {
      message: "Settings updated",
      restaurant: updated,
    };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const base = fallbackRestaurants.find((r) => r.id === restaurantId);
      if (!base) {
        return reply.code(404).send({ message: "Restaurant not found" });
      }

      const settings = fallbackRestaurantSettingsStore[restaurantId] || {};
      const body = req.body || {};
      const updates = {
        name: body.name,
        legalName: body.legalName,
        ownerName: body.ownerName,
        email: body.email,
        phone: body.phone,
        addressLine1: body.addressLine1,
        city: body.city,
        state: body.state,
        country: body.country,
        pincode: body.pincode,
        gstNumber: body.gstNumber,
        logo: body.logo,
        timezone: body.timezone,
        currency: body.currency,
        taxEnabled: body.taxEnabled,
        taxType: body.taxType ? String(body.taxType).toUpperCase() : undefined,
        defaultTaxPercent: body.defaultTaxPercent,
        serviceChargeEnabled: body.serviceChargeEnabled,
        serviceChargePercent: body.serviceChargePercent,
        invoicePrefix: body.invoicePrefix,
        nextInvoiceNumber: body.nextInvoiceNumber,
        isActive: body.isActive,
      };

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) settings[key] = value;
      });
      fallbackRestaurantSettingsStore[restaurantId] = settings;
      if (body.name) base.name = body.name;
      if (body.slug) base.slug = body.slug;

      return {
        message: "Settings updated",
        restaurant: {
          id: base.id,
          name: base.name,
          slug: base.slug,
          ...settings,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to update settings" });
  }
});

app.get("/owner/:restaurantId/staff", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const q = String(req.query?.q || "").trim().toLowerCase();

    if (!restaurantId) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      const users = fallbackUsers
        .filter((user) => user.restaurantId === restaurantId)
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: getStaffPhone(restaurantId, user.id, user.phone),
          role: user.role,
          isActive: user.isActive ?? true,
          restaurantId: user.restaurantId,
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: user.updatedAt || new Date().toISOString(),
          access: getStaffAccess(restaurantId, user.id, user.role),
        }))
        .filter((user) => {
          if (!q) return true;
          return (
              String(user.name || "").toLowerCase().includes(q) ||
              String(user.email || "").toLowerCase().includes(q) ||
              String(user.phone || "").toLowerCase().includes(q) ||
              String(user.role || "").toLowerCase().includes(q)
          );
        });

      return { users, modules: STAFF_ACCESS_MODULES };
    }

    const users = await prisma.user.findMany({
      where: {
        restaurantId,
        role: { not: "SUPER_ADMIN" },
      },
      include: {
        staffAccess: {
          select: { permissions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = users
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        isActive: user.isActive,
        restaurantId: user.restaurantId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        access: normalizeDbPermissions(user.staffAccess?.permissions, user.role),
      }))
      .filter((user) => {
        if (!q) return true;
        return (
            String(user.name || "").toLowerCase().includes(q) ||
            String(user.email || "").toLowerCase().includes(q) ||
            String(user.phone || "").toLowerCase().includes(q) ||
            String(user.role || "").toLowerCase().includes(q)
        );
      });

    return { users: mapped, modules: STAFF_ACCESS_MODULES };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const q = String(req.query?.q || "").trim().toLowerCase();

      const users = fallbackUsers
        .filter((user) => user.restaurantId === restaurantId)
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: getStaffPhone(restaurantId, user.id, user.phone),
          role: user.role,
          isActive: user.isActive ?? true,
          restaurantId: user.restaurantId,
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: user.updatedAt || new Date().toISOString(),
          access: getStaffAccess(restaurantId, user.id, user.role),
        }))
        .filter((user) => {
          if (!q) return true;
          return (
              String(user.name || "").toLowerCase().includes(q) ||
              String(user.email || "").toLowerCase().includes(q) ||
              String(user.phone || "").toLowerCase().includes(q) ||
              String(user.role || "").toLowerCase().includes(q)
          );
        });

      return { users, modules: STAFF_ACCESS_MODULES };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to fetch staff users" });
  }
});

app.post("/owner/:restaurantId/staff", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const {
      name,
      email,
      phone,
      password,
      role = "STAFF",
      isActive = true,
      access,
    } = req.body || {};

    if (!restaurantId) {
      return reply.code(400).send({ message: "Invalid restaurant id" });
    }
    if (!name || !email || !phone || !password) {
      return reply.code(400).send({
        message: "Name, email, phone, and password are required",
      });
    }

    const normalizedRole = String(role || "STAFF").toUpperCase();
    if (!STAFF_ALLOWED_ROLES.includes(normalizedRole)) {
      return reply.code(400).send({ message: `Invalid role: ${normalizedRole}` });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phone).trim();
    const normalizedAccess = normalizeAccess(access, normalizedRole);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      const exists = fallbackUsers.some((user) => String(user.email).toLowerCase() === normalizedEmail);
      if (exists) {
        return reply.code(400).send({ message: "Email already exists" });
      }

      const user = {
        id: ++fallbackUserSeq,
        name: String(name).trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password: String(password),
        role: normalizedRole,
        isActive: Boolean(isActive),
        restaurantId,
        restaurant: fallbackRestaurants.find((r) => r.id === restaurantId) || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      fallbackUsers.push(user);

      setStaffAccess(restaurantId, user.id, normalizedAccess);
      setStaffPhone(restaurantId, user.id, user.phone);

      return {
        message: "Staff user created",
        user: {
          ...user,
          access: normalizedAccess,
        },
      };
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      return reply.code(400).send({ message: "Email already exists" });
    }

    const hashedPassword = bcrypt.hashSync(String(password), 10);
    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password: hashedPassword,
        role: normalizedRole,
        isActive: Boolean(isActive),
        restaurantId,
      },
    });

    await prisma.staffAccess.upsert({
      where: { userId: user.id },
      create: {
        restaurantId,
        userId: user.id,
        permissions: normalizedAccess,
      },
      update: {
        restaurantId,
        permissions: normalizedAccess,
      },
    });

    return {
      message: "Staff user created",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        isActive: user.isActive,
        restaurantId: user.restaurantId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        access: normalizedAccess,
      },
    };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const {
        name,
        email,
        phone,
        password,
        role = "STAFF",
        isActive = true,
        access,
      } = req.body || {};

      if (!restaurantId) {
        return reply.code(400).send({ message: "Invalid restaurant id" });
      }
      if (!name || !email || !phone || !password) {
        return reply.code(400).send({
          message: "Name, email, phone, and password are required",
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const exists = fallbackUsers.some((user) => String(user.email).toLowerCase() === normalizedEmail);
      if (exists) {
        return reply.code(400).send({ message: "Email already exists" });
      }

      const normalizedRole = String(role || "STAFF").toUpperCase();
      if (!STAFF_ALLOWED_ROLES.includes(normalizedRole)) {
        return reply.code(400).send({ message: `Invalid role: ${normalizedRole}` });
      }

      const user = {
        id: ++fallbackUserSeq,
        name: String(name).trim(),
        email: normalizedEmail,
        phone: String(phone).trim(),
        password: String(password),
        role: normalizedRole,
        isActive: Boolean(isActive),
        restaurantId,
        restaurant: fallbackRestaurants.find((r) => r.id === restaurantId) || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      fallbackUsers.push(user);

      const normalizedAccess = normalizeAccess(access, normalizedRole);
      setStaffAccess(restaurantId, user.id, normalizedAccess);
      setStaffPhone(restaurantId, user.id, user.phone);

      return {
        message: "Staff user created",
        user: {
          ...user,
          access: normalizedAccess,
        },
      };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to create staff user" });
  }
});

app.put("/owner/:restaurantId/staff/:staffId", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const staffId = Number(req.params.staffId);
    const {
      name,
      email,
      phone,
      role,
      password,
      isActive,
    } = req.body || {};

    if (!restaurantId || !staffId) {
      return reply.code(400).send({ message: "Invalid id values" });
    }

    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      include: {
        staffAccess: {
          select: { permissions: true },
        },
      },
    });
    if (!staff || staff.restaurantId !== restaurantId) {
      return reply.code(404).send({ message: "Staff user not found" });
    }

    if (role && !STAFF_ALLOWED_ROLES.includes(String(role).toUpperCase())) {
      return reply.code(400).send({ message: `Invalid role: ${String(role).toUpperCase()}` });
    }

    if (staff.role === "OWNER" && role && String(role).toUpperCase() !== "OWNER") {
      return reply.code(400).send({
        message: "Owner role cannot be changed from staff management",
      });
    }

    if (email && String(email).trim().toLowerCase() !== String(staff.email).toLowerCase()) {
      const emailExists = await prisma.user.findUnique({
        where: { email: String(email).trim().toLowerCase() },
        select: { id: true },
      });
      if (emailExists) {
        return reply.code(400).send({ message: "Email already exists" });
      }
    }

    const nextRole = role ? String(role).toUpperCase() : staff.role;
    const data = {
      name: name ?? staff.name,
      email: email ? String(email).trim().toLowerCase() : staff.email,
      phone: phone === undefined ? staff.phone : String(phone).trim(),
      role: nextRole,
      isActive: isActive === undefined ? staff.isActive : Boolean(isActive),
    };

    if (password) {
      data.password = bcrypt.hashSync(String(password), 10);
    }

    const updated = await prisma.user.update({
      where: { id: staffId },
      data,
      include: {
        staffAccess: {
          select: { permissions: true },
        },
      },
    });

    return {
      message: "Staff user updated",
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone || "",
        role: updated.role,
        isActive: updated.isActive,
        restaurantId: updated.restaurantId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        access: normalizeDbPermissions(updated.staffAccess?.permissions, updated.role),
      },
    };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);
      const { name, email, phone, role, password, isActive } = req.body || {};

      const idx = fallbackUsers.findIndex((user) => user.id === staffId && user.restaurantId === restaurantId);
      if (idx === -1) {
        return reply.code(404).send({ message: "Staff user not found" });
      }

      const existing = fallbackUsers[idx];
      if (existing.role === "OWNER" && role && String(role).toUpperCase() !== "OWNER") {
        return reply.code(400).send({
          message: "Owner role cannot be changed from staff management",
        });
      }
      if (role && !STAFF_ALLOWED_ROLES.includes(String(role).toUpperCase())) {
        return reply.code(400).send({ message: `Invalid role: ${String(role).toUpperCase()}` });
      }

      if (email && String(email).trim().toLowerCase() !== String(existing.email).toLowerCase()) {
        const emailExists = fallbackUsers.some(
            (user) => user.id !== staffId && String(user.email).toLowerCase() === String(email).trim().toLowerCase()
        );
        if (emailExists) {
          return reply.code(400).send({ message: "Email already exists" });
        }
      }

      fallbackUsers[idx] = {
        ...existing,
        name: name ?? existing.name,
        email: email ? String(email).trim().toLowerCase() : existing.email,
        phone: phone !== undefined ? String(phone).trim() : existing.phone,
        role: role ? String(role).toUpperCase() : existing.role,
        password: password ? String(password) : existing.password,
        isActive: isActive === undefined ? existing.isActive : Boolean(isActive),
        updatedAt: new Date().toISOString(),
      };

      if (phone !== undefined) {
        setStaffPhone(restaurantId, staffId, String(phone).trim());
      }

      return {
        message: "Staff user updated",
        user: {
          ...fallbackUsers[idx],
          access: getStaffAccess(restaurantId, staffId, fallbackUsers[idx].role),
        },
      };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to update staff user" });
  }
});

app.patch("/owner/:restaurantId/staff/:staffId/status", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const staffId = Number(req.params.staffId);
    const { isActive } = req.body || {};

    if (!restaurantId || !staffId) {
      return reply.code(400).send({ message: "Invalid id values" });
    }
    if (typeof isActive !== "boolean") {
      return reply.code(400).send({ message: "isActive must be boolean" });
    }

    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      include: {
        staffAccess: {
          select: { permissions: true },
        },
      },
    });
    if (!staff || staff.restaurantId !== restaurantId) {
      return reply.code(404).send({ message: "Staff user not found" });
    }
    if (staff.role === "OWNER") {
      return reply.code(400).send({ message: "Owner account cannot be disabled" });
    }

    const updated = await prisma.user.update({
      where: { id: staffId },
      data: { isActive },
      include: {
        staffAccess: {
          select: { permissions: true },
        },
      },
    });

    return {
      message: `Staff user ${isActive ? "enabled" : "disabled"}`,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone || "",
        role: updated.role,
        isActive: updated.isActive,
        restaurantId: updated.restaurantId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        access: normalizeDbPermissions(updated.staffAccess?.permissions, updated.role),
      },
    };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);
      const { isActive } = req.body || {};

      const idx = fallbackUsers.findIndex((user) => user.id === staffId && user.restaurantId === restaurantId);
      if (idx === -1) {
        return reply.code(404).send({ message: "Staff user not found" });
      }
      if (fallbackUsers[idx].role === "OWNER") {
        return reply.code(400).send({ message: "Owner account cannot be disabled" });
      }

      fallbackUsers[idx] = {
        ...fallbackUsers[idx],
        isActive: Boolean(isActive),
        updatedAt: new Date().toISOString(),
      };

      return {
        message: `Staff user ${isActive ? "enabled" : "disabled"}`,
        user: {
          ...fallbackUsers[idx],
          phone: getStaffPhone(restaurantId, staffId, fallbackUsers[idx].phone),
          access: getStaffAccess(restaurantId, staffId, fallbackUsers[idx].role),
        },
      };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to update staff status" });
  }
});

app.put("/owner/:restaurantId/staff/:staffId/access", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const staffId = Number(req.params.staffId);
    const { access } = req.body || {};

    if (!restaurantId || !staffId) {
      return reply.code(400).send({ message: "Invalid id values" });
    }

    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, role: true, restaurantId: true },
    });
    if (!staff || staff.restaurantId !== restaurantId) {
      return reply.code(404).send({ message: "Staff user not found" });
    }

    const normalizedAccess = normalizeAccess(access, staff.role);
    await prisma.staffAccess.upsert({
      where: { userId: staffId },
      create: {
        restaurantId,
        userId: staffId,
        permissions: normalizedAccess,
      },
      update: {
        restaurantId,
        permissions: normalizedAccess,
      },
    });

    return {
      message: "Staff access updated",
      access: normalizedAccess,
      modules: STAFF_ACCESS_MODULES,
    };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);
      const { access } = req.body || {};

      const staff = fallbackUsers.find((user) => user.id === staffId && user.restaurantId === restaurantId);
      if (!staff) {
        return reply.code(404).send({ message: "Staff user not found" });
      }

      const normalizedAccess = normalizeAccess(access, staff.role);
      setStaffAccess(restaurantId, staffId, normalizedAccess);
      return {
        message: "Staff access updated",
        access: normalizedAccess,
        modules: STAFF_ACCESS_MODULES,
      };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to update staff access" });
  }
});

app.delete("/owner/:restaurantId/staff/:staffId", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const staffId = Number(req.params.staffId);

    if (!restaurantId || !staffId) {
      return reply.code(400).send({ message: "Invalid id values" });
    }

    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, role: true, restaurantId: true },
    });
    if (!staff || staff.restaurantId !== restaurantId) {
      return reply.code(404).send({ message: "Staff user not found" });
    }
    if (staff.role === "OWNER") {
      return reply.code(400).send({ message: "Owner account cannot be deleted" });
    }

    await prisma.user.delete({
      where: { id: staffId },
    });

    return { message: "Staff user deleted" };
  } catch (err) {
    if (isDbUnavailable(err)) {
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);

      const idx = fallbackUsers.findIndex((user) => user.id === staffId && user.restaurantId === restaurantId);
      if (idx === -1) {
        return reply.code(404).send({ message: "Staff user not found" });
      }
      if (fallbackUsers[idx].role === "OWNER") {
        return reply.code(400).send({ message: "Owner account cannot be deleted" });
      }

      fallbackUsers.splice(idx, 1);
      deleteStaffAccess(restaurantId, staffId);
      deleteStaffPhone(restaurantId, staffId);
      return { message: "Staff user deleted" };
    }

    console.log(err);
    return reply.code(500).send({ message: "Failed to delete staff user" });
  }
});

app.get("/owner/:restaurantId/finance/expenses", async (req, reply) => {
  const restaurantId = Number(req.params.restaurantId);
  if (!restaurantId) {
    return reply.code(400).send({ message: "Invalid restaurant id" });
  }

  const list = [...(fallbackExpenseStore[restaurantId] || [])].sort(
      (a, b) => new Date(b.spentAt || b.createdAt) - new Date(a.spentAt || a.createdAt)
  );
  return list;
});

app.post("/owner/:restaurantId/finance/expenses", async (req, reply) => {
  const restaurantId = Number(req.params.restaurantId);
  const { title, category, amount, notes, spentAt } = req.body || {};

  if (!restaurantId) {
    return reply.code(400).send({ message: "Invalid restaurant id" });
  }
  if (!title || amount === undefined || amount === null || Number(amount) <= 0) {
    return reply.code(400).send({ message: "Title and valid amount are required" });
  }

  const expense = {
    id: ++fallbackExpenseSeq,
    restaurantId,
    title: String(title).trim(),
    category: category ? String(category).trim() : "General",
    amount: Number(amount),
    notes: notes ? String(notes).trim() : "",
    spentAt: spentAt ? new Date(spentAt).toISOString() : new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  fallbackExpenseStore[restaurantId] = fallbackExpenseStore[restaurantId] || [];
  fallbackExpenseStore[restaurantId].unshift(expense);
  return expense;
});

app.delete("/owner/:restaurantId/finance/expenses/:expenseId", async (req, reply) => {
  const restaurantId = Number(req.params.restaurantId);
  const expenseId = Number(req.params.expenseId);

  if (!restaurantId || !expenseId) {
    return reply.code(400).send({ message: "Invalid id values" });
  }

  const list = fallbackExpenseStore[restaurantId] || [];
  const idx = list.findIndex((expense) => expense.id === expenseId);
  if (idx === -1) {
    return reply.code(404).send({ message: "Expense not found" });
  }

  list.splice(idx, 1);
  return { message: "Expense deleted" };
});

app.put("/owner/:restaurantId/orders/:orderId/status", async (req, reply) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const orderId = Number(req.params.orderId);
    const nextStatus = String(req.body?.status || "").toUpperCase();
    const changedByName = String(req.body?.changedByName || "Staff").trim();
    const statusNotes = String(req.body?.notes || "").trim();
    const allowedStatuses = [
      "PLACED",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!restaurantId || !orderId) {
      return reply.code(400).send({ message: "Invalid id values" });
    }

    if (!allowedStatuses.includes(nextStatus)) {
      return reply.code(400).send({
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, restaurantId: true, status: true },
    });

    if (!order || order.restaurantId !== restaurantId) {
      return reply.code(404).send({ message: "Order not found" });
    }

    let updated;
    try {
      updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          statusEvents: {
            create: {
              status: nextStatus,
              source: "STAFF",
              changedByName: changedByName || "Staff",
              notes: statusNotes || null,
            },
          },
        },
        include: {
          items: true,
          customer: true,
          statusEvents: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
    } catch (err) {
      if (!isOrderArchitectureUnavailable(err)) {
        throw err;
      }

      updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
        include: { items: true },
      });
    }

    return {
      message: "Order status updated",
      order: updated,
    };
  } catch (err) {
    console.log(err);
    return reply.code(500).send({
      message: "Failed to update order status",
    });
  }
});

start();
