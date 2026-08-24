import bcrypt from "bcryptjs";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { getPhoneVariants, isValidPhone } from "../services/phoneService.js";
import { createCashfreeVendor } from "../services/vendor.service.js";
import { buildAdminSettlementController } from "../controllers/adminSettlementController.js";

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const fullOwnerAccess = (modules) => modules.reduce((acc, key) => ({ ...acc, [key]: true }), {});

export default async function superAdminRoutes(app, deps) {
  const { prisma, STAFF_ACCESS_MODULES } = deps;
  const adminSettlementController = buildAdminSettlementController({ prisma });

  const requireSuperAdmin = async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, { prisma, allowedRoles: ["SUPER_ADMIN"] });
    if (!actor) return reply;
    req.staffActor = actor;
    return null;
  };

  const serializeRestaurant = (restaurant) => {
    const orders = restaurant.orders || [];
    const owners = (restaurant.users || []).filter((user) => String(user.role || "").toUpperCase() === "OWNER");

    return {
      id: restaurant.id,
      name: restaurant.name,
      legalName: restaurant.legalName,
      slug: restaurant.slug,
      ownerName: restaurant.ownerName,
      logoUrl: restaurant.logoUrl,
      email: restaurant.email,
      phone: restaurant.phone,
      city: restaurant.city,
      state: restaurant.state,
      country: restaurant.country,
      pincode: restaurant.pincode,
      gstNumber: restaurant.gstNumber,
      isActive: restaurant.isActive,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
      owner: owners[0]
        ? {
            id: owners[0].id,
            name: owners[0].name,
            email: owners[0].email,
            phone: owners[0].phone,
            isActive: owners[0].isActive,
          }
        : null,
      counts: {
        users: restaurant._count?.users || 0,
        menuItems: restaurant._count?.menuItems || 0,
        orders: restaurant._count?.orders || 0,
        tables: restaurant._count?.tables || 0,
      },
      revenue: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    };
  };

  app.get("/super-admin/restaurants", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const q = String(req.query?.q || "").trim().toLowerCase();

      const restaurants = await prisma.restaurant.findMany({
        where: q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
                { ownerName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        include: {
          users: {
            where: { role: "OWNER" },
            select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
            orderBy: { id: "asc" },
          },
          orders: { select: { id: true, total: true } },
          _count: {
            select: {
              users: true,
              menuItems: true,
              orders: true,
              tables: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const items = restaurants.map(serializeRestaurant);
      return {
        restaurants: items,
        summary: {
          restaurants: items.length,
          activeRestaurants: items.filter((item) => item.isActive).length,
          owners: items.filter((item) => item.owner).length,
          revenue: items.reduce((sum, item) => sum + Number(item.revenue || 0), 0),
        },
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch restaurants" });
    }
  });

  const getStaffUsersHandler = async (req, reply) => {
    try {
      const q = String(req.query?.q || "").trim();

      const restaurants = await prisma.restaurant.findMany({
        where: q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
                {
                  users: {
                    some: {
                      OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { email: { contains: q, mode: "insensitive" } },
                        { phone: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              ],
            }
          : {},
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          logoUrl: true,
          isActive: true,
          users: {
            where: { role: { not: "SUPER_ADMIN" } },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              isActive: true,
            },
            orderBy: { id: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      const items = restaurants.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        city: restaurant.city,
        logoUrl: restaurant.logoUrl,
        isActive: restaurant.isActive,
        users: (restaurant.users || []).map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
        })),
      }));

      return {
        restaurants: items,
        summary: {
          restaurants: items.length,
          users: items.reduce((sum, item) => sum + (item.users?.length || 0), 0),
          staffCount: items.reduce((sum, item) => sum + (item.users?.length || 0), 0),
        },
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch staff users" });
    }
  };

  app.get("/super-admin/users", { preHandler: requireSuperAdmin }, getStaffUsersHandler);
  app.get("/super-admin/staff", { preHandler: requireSuperAdmin }, getStaffUsersHandler);

  app.get("/super-admin/customers", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const q = String(req.query?.q || "").trim();

      const customerAccounts = await prisma.customerAccount.findMany({
        where: q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { username: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        orderBy: { createdAt: "desc" },
      });

      const customersData = await Promise.all(
        customerAccounts.map(async (acc) => {
          const phoneVariants = acc.phone ? getPhoneVariants(acc.phone) : [];
          const linkedCustomerRecords = await prisma.customer.findMany({
            where: {
              OR: [
                ...(phoneVariants.length > 0 ? [{ phone: { in: phoneVariants } }] : []),
                ...(acc.email ? [{ email: acc.email.toLowerCase() }] : []),
              ],
            },
            select: { rewardPoints: true },
          });

          const maxPoints = linkedCustomerRecords.reduce(
            (max, c) => Math.max(max, Number(c.rewardPoints || 0)),
            0
          );

          return {
            id: acc.id,
            name: acc.name || "Customer",
            username: acc.username || "Not set",
            phone: (acc.phone && isValidPhone(acc.phone)) ? acc.phone : "Not set",
            email: acc.email || "Not set",
            avatarUrl: acc.avatarUrl || null,
            googleId: acc.googleId,
            rewardPoints: maxPoints,
            createdAt: acc.createdAt,
          };
        })
      );

      return {
        customers: customersData,
        summary: {
          totalCustomers: customersData.length,
        },
      };
    } catch (err) {
      console.error("[/super-admin/customers] Error:", err);
      return reply.code(500).send({ message: "Failed to fetch customer accounts" });
    }
  });

  app.delete("/super-admin/customers/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const customerId = Number(req.params.id);
      if (!customerId) return reply.code(400).send({ message: "Invalid customer id" });

      const existing = await prisma.customerAccount.findUnique({ where: { id: customerId } });
      if (!existing) return reply.code(404).send({ message: "Customer account not found" });

      await prisma.customerAccount.delete({ where: { id: customerId } });

      return { message: "Customer account deleted successfully", id: customerId };
    } catch (err) {
      console.error("[/super-admin/customers/:id DELETE] Error:", err);
      return reply.code(500).send({ message: "Failed to delete customer account" });
    }
  });

  app.post("/super-admin/restaurants", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const body = req.body || {};
      const restaurantName = String(body.name || body.restaurantName || "").trim();
      const ownerName = String(body.ownerName || "").trim();
      const ownerEmail = normalizeEmail(body.ownerEmail || body.email);
      const ownerPhone = String(body.ownerPhone || body.phone || "").trim();
      const ownerPassword = String(body.ownerPassword || body.password || "").trim();
      const slug = slugify(body.slug || restaurantName);

      if (!restaurantName || !slug || !ownerName || !ownerEmail || !ownerPassword) {
        return reply.code(400).send({
          message: "Restaurant name, slug, owner name, owner email, and owner password are required",
        });
      }

      if (ownerPassword.length < 6) {
        return reply.code(400).send({ message: "Owner password must be at least 6 characters" });
      }

      const existingRestaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
      if (existingRestaurant) {
        return reply.code(409).send({ message: "Restaurant slug already exists" });
      }

      const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
      if (existingUser) {
        return reply.code(409).send({ message: "Owner email already exists" });
      }

      const access = fullOwnerAccess(STAFF_ACCESS_MODULES);
      const result = await prisma.$transaction(async (tx) => {
        const restaurant = await tx.restaurant.create({
          data: {
            name: restaurantName,
            legalName: body.legalName ? String(body.legalName).trim() : null,
            slug,
            ownerName,
            email: body.restaurantEmail ? normalizeEmail(body.restaurantEmail) : ownerEmail,
            phone: body.restaurantPhone ? String(body.restaurantPhone).trim() : ownerPhone || null,
            addressLine1: body.addressLine1 ? String(body.addressLine1).trim() : null,
            city: body.city ? String(body.city).trim() : null,
            state: body.state ? String(body.state).trim() : null,
            country: body.country ? String(body.country).trim() : "India",
            pincode: body.pincode ? String(body.pincode).trim() : null,
            gstNumber: body.gstNumber ? String(body.gstNumber).trim() : null,
            timezone: body.timezone ? String(body.timezone).trim() : "Asia/Kolkata",
            currency: body.currency ? String(body.currency).trim().toUpperCase() : "INR",
            taxEnabled: Boolean(body.taxEnabled ?? true),
            taxType: String(body.taxType || "EXCLUSIVE").toUpperCase(),
            defaultTaxPercent: Number(body.defaultTaxPercent ?? 5),
            serviceChargeEnabled: Boolean(body.serviceChargeEnabled ?? false),
            serviceChargePercent: Number(body.serviceChargePercent ?? 0),
            invoicePrefix: body.invoicePrefix ? String(body.invoicePrefix).trim().toUpperCase() : "INV",
            nextInvoiceNumber: Number(body.nextInvoiceNumber || 1001),
            isActive: body.isActive ?? true,
          },
        });

        const owner = await tx.user.create({
          data: {
            name: ownerName,
            email: ownerEmail,
            phone: ownerPhone || null,
            password: bcrypt.hashSync(ownerPassword, 10),
            role: "OWNER",
            restaurantId: restaurant.id,
            isActive: true,
          },
        });

        await tx.staffAccess.create({
          data: {
            restaurantId: restaurant.id,
            userId: owner.id,
            role: "OWNER",
            permissions: access,
          },
        });

        return { restaurant, owner };
      });

      return reply.code(201).send({
        message: "Restaurant and owner created",
        restaurant: result.restaurant,
        owner: {
          id: result.owner.id,
          name: result.owner.name,
          email: result.owner.email,
          phone: result.owner.phone,
          role: result.owner.role,
          restaurantId: result.owner.restaurantId,
          isActive: result.owner.isActive,
        },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to create restaurant and owner" });
    }
  });

  app.patch("/super-admin/restaurants/:restaurantId/status", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });

      const isActive = Boolean(req.body?.isActive);
      const restaurant = await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { isActive },
      });

      await prisma.user.updateMany({
        where: { restaurantId, role: { not: "SUPER_ADMIN" } },
        data: { isActive },
      });

      // Automatically create Cashfree Easy Split Vendor when restaurant is activated/approved
      if (isActive) {
        createCashfreeVendor({
          restaurantId: restaurant.id,
          name: restaurant.name || restaurant.legalName || "Tiffzy Vendor",
          email: restaurant.email,
          phone: restaurant.phone,
          upi: restaurant.upiId,
          maxRetries: 3,
        }).catch((vErr) => console.warn("[SuperAdmin] Automatic Cashfree vendor creation warning:", vErr.message));
      }

      return { message: isActive ? "Restaurant activated and Cashfree vendor onboarding initiated" : "Restaurant disabled", restaurant };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update restaurant status" });
    }
  });

  ///////////////////////////////////////////////////////////
  // GLOBAL CATEGORIES
  ///////////////////////////////////////////////////////////

  app.get("/super-admin/categories", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      if (!prisma.globalCategory) {
        return { categories: [] };
      }
      let categories = await prisma.globalCategory.findMany({
        orderBy: { priority: "desc" },
      });
      if (categories.length === 0) {
        const defaults = [
          { name: "Biryani", imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80", priority: 100 },
          { name: "Pizza", imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80", priority: 90 },
          { name: "Burger", imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80", priority: 80 },
          { name: "Coffee", imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80", priority: 70 },
          { name: "Fast Food", imageUrl: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=300&q=80", priority: 60 },
          { name: "Desserts", imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80", priority: 50 },
          { name: "Beverages", imageUrl: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=300&q=80", priority: 40 },
          { name: "Ice Cream", imageUrl: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=300&q=80", priority: 30 }
        ];
        await prisma.globalCategory.createMany({ data: defaults, skipDuplicates: true }).catch(() => {});
        categories = await prisma.globalCategory.findMany({ orderBy: { priority: "desc" } });
      }
      return { categories: categories || [] };
    } catch (err) {
      console.warn("[SuperAdmin] fetch categories warning:", err?.message || err);
      return { categories: [] };
    }
  });

  app.post("/super-admin/categories", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const { name, imageUrl, priority, isActive } = req.body || {};
      if (!name) return reply.code(400).send({ message: "Category name is required" });

      if (!prisma.globalCategory) {
        return reply.code(500).send({ message: "Database model not initialized. Please run npx prisma db push on server." });
      }

      const category = await prisma.globalCategory.create({
        data: {
          name: String(name).trim(),
          imageUrl: imageUrl ? String(imageUrl).trim() : null,
          priority: Number(priority || 0),
          isActive: isActive !== false,
        },
      });
      return { message: "Category created", category };
    } catch (err) {
      console.error("[SuperAdmin] create category error:", err);
      if (err.code === "P2002") return reply.code(409).send({ message: "Category name already exists" });
      return reply.code(500).send({ message: `Failed to create category: ${err.message || "Unknown error"}` });
    }
  });

  app.patch("/super-admin/categories/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const id = Number(req.params.id);
      const data = req.body || {};

      if (!prisma.globalCategory) {
        return reply.code(500).send({ message: "Database model not initialized." });
      }

      const category = await prisma.globalCategory.update({
        where: { id },
        data: {
          name: data.name !== undefined ? String(data.name).trim() : undefined,
          imageUrl: data.imageUrl !== undefined ? (data.imageUrl ? String(data.imageUrl).trim() : null) : undefined,
          priority: data.priority !== undefined ? Number(data.priority) : undefined,
          isActive: data.isActive,
        },
      });
      return { message: "Category updated", category };
    } catch (err) {
      console.error("[SuperAdmin] update category error:", err);
      return reply.code(500).send({ message: "Failed to update category" });
    }
  });

  app.delete("/super-admin/categories/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const id = Number(req.params.id);
      if (!prisma.globalCategory) return reply.code(500).send({ message: "Database model not initialized." });
      await prisma.globalCategory.delete({ where: { id } });
      return { message: "Category deleted" };
    } catch (err) {
      console.error("[SuperAdmin] delete category error:", err);
      return reply.code(500).send({ message: "Failed to delete category" });
    }
  });

  ///////////////////////////////////////////////////////////
  // BANNERS
  ///////////////////////////////////////////////////////////

  app.get("/super-admin/banners", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      if (!prisma.banner) {
        return { banners: [] };
      }
      let banners = await prisma.banner.findMany({
        orderBy: { priority: "desc" },
      });
      if (banners.length === 0) {
        const defaults = [
          {
            title: "50% Off On First Order",
            imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80",
            actionUrl: "/r/starbucks/menu",
            priority: 100,
            isActive: true
          },
          {
            title: "Delicious Meals Delivered Fast",
            imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80",
            actionUrl: "/r/cafe-king/menu",
            priority: 90,
            isActive: true
          }
        ];
        await prisma.banner.createMany({ data: defaults, skipDuplicates: true }).catch(() => {});
        banners = await prisma.banner.findMany({ orderBy: { priority: "desc" } });
      }
      return { banners: banners || [] };
    } catch (err) {
      console.warn("[SuperAdmin] fetch banners warning:", err?.message || err);
      return { banners: [] };
    }
  });

  app.post("/super-admin/banners", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const { title, imageUrl, actionUrl, priority, isActive } = req.body || {};
      if (!imageUrl) return reply.code(400).send({ message: "Banner image URL is required" });

      if (!prisma.banner) {
        return reply.code(500).send({ message: "Database model not initialized. Please run npx prisma db push on server." });
      }

      const banner = await prisma.banner.create({
        data: {
          title: title ? String(title).trim() : null,
          imageUrl: String(imageUrl).trim(),
          actionUrl: actionUrl ? String(actionUrl).trim() : null,
          priority: Number(priority || 0),
          isActive: isActive !== false,
        },
      });
      return { message: "Banner created", banner };
    } catch (err) {
      console.error("[SuperAdmin] create banner error:", err);
      return reply.code(500).send({ message: `Failed to create banner: ${err.message || "Unknown error"}` });
    }
  });

  app.patch("/super-admin/banners/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const id = Number(req.params.id);
      const data = req.body || {};

      if (!prisma.banner) {
        return reply.code(500).send({ message: "Database model not initialized." });
      }

      const banner = await prisma.banner.update({
        where: { id },
        data: {
          title: data.title !== undefined ? (data.title ? String(data.title).trim() : null) : undefined,
          imageUrl: data.imageUrl !== undefined ? String(data.imageUrl).trim() : undefined,
          actionUrl: data.actionUrl !== undefined ? (data.actionUrl ? String(data.actionUrl).trim() : null) : undefined,
          priority: data.priority !== undefined ? Number(data.priority) : undefined,
          isActive: data.isActive,
        },
      });
      return { message: "Banner updated", banner };
    } catch (err) {
      console.error("[SuperAdmin] update banner error:", err);
      return reply.code(500).send({ message: "Failed to update banner" });
    }
  });

  app.delete("/super-admin/banners/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const id = Number(req.params.id);
      if (!prisma.banner) return reply.code(500).send({ message: "Database model not initialized." });
      await prisma.banner.delete({ where: { id } });
      return { message: "Banner deleted" };
    } catch (err) {
      console.error("[SuperAdmin] delete banner error:", err);
      return reply.code(500).send({ message: "Failed to delete banner" });
    }
  });

  // ADMIN SETTLEMENT DASHBOARD ENDPOINTS
  app.get("/super-admin/settlements/summary", { preHandler: requireSuperAdmin }, adminSettlementController.getSummary);
  app.get("/super-admin/settlements/payment-logs", { preHandler: requireSuperAdmin }, adminSettlementController.getPaymentLogs);
  app.get("/super-admin/settlements/webhook-logs", { preHandler: requireSuperAdmin }, adminSettlementController.getWebhookLogs);
  app.get("/super-admin/settlements/vendors", { preHandler: requireSuperAdmin }, adminSettlementController.getVendorDetails);
}
