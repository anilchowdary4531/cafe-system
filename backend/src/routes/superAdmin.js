import bcrypt from "bcryptjs";
import { requireStaffJwt } from "../services/staffAuthService.js";

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

  app.get("/super-admin/users", { preHandler: requireSuperAdmin }, async (req, reply) => {
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
        },
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch users" });
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

      return { message: isActive ? "Restaurant activated" : "Restaurant disabled", restaurant };
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
      const categories = await prisma.globalCategory.findMany({
        orderBy: { priority: "desc" },
      });
      return { categories };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch categories" });
    }
  });

  app.post("/super-admin/categories", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const { name, imageUrl, priority, isActive } = req.body || {};
      if (!name) return reply.code(400).send({ message: "Category name is required" });

      const category = await prisma.globalCategory.create({
        data: {
          name,
          imageUrl,
          priority: Number(priority || 0),
          isActive: isActive !== false,
        },
      });
      return { message: "Category created", category };
    } catch (err) {
      console.log(err);
      if (err.code === "P2002") return reply.code(409).send({ message: "Category name already exists" });
      return reply.code(500).send({ message: "Failed to create category" });
    }
  });

  app.patch("/super-admin/categories/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const id = Number(req.params.id);
      const data = req.body || {};

      const category = await prisma.globalCategory.update({
        where: { id },
        data: {
          name: data.name,
          imageUrl: data.imageUrl,
          priority: data.priority !== undefined ? Number(data.priority) : undefined,
          isActive: data.isActive,
        },
      });
      return { message: "Category updated", category };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update category" });
    }
  });

  app.delete("/super-admin/categories/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const id = Number(req.params.id);
      await prisma.globalCategory.delete({ where: { id } });
      return { message: "Category deleted" };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete category" });
    }
  });

  ///////////////////////////////////////////////////////////
  // BANNERS
  ///////////////////////////////////////////////////////////

  app.get("/super-admin/banners", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const banners = await prisma.banner.findMany({
        orderBy: { priority: "desc" },
      });
      return { banners };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch banners" });
    }
  });

  app.post("/super-admin/banners", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const { title, imageUrl, actionUrl, priority, isActive } = req.body || {};
      if (!imageUrl) return reply.code(400).send({ message: "Banner image URL is required" });

      const banner = await prisma.banner.create({
        data: {
          title,
          imageUrl,
          actionUrl,
          priority: Number(priority || 0),
          isActive: isActive !== false,
        },
      });
      return { message: "Banner created", banner };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to create banner" });
    }
  });

  app.patch("/super-admin/banners/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const id = Number(req.params.id);
      const data = req.body || {};

      const banner = await prisma.banner.update({
        where: { id },
        data: {
          title: data.title,
          imageUrl: data.imageUrl,
          actionUrl: data.actionUrl,
          priority: data.priority !== undefined ? Number(data.priority) : undefined,
          isActive: data.isActive,
        },
      });
      return { message: "Banner updated", banner };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update banner" });
    }
  });

  app.delete("/super-admin/banners/:id", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const id = Number(req.params.id);
      await prisma.banner.delete({ where: { id } });
      return { message: "Banner deleted" };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete banner" });
    }
  });
}
