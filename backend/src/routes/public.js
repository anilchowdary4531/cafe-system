import bcrypt from "bcryptjs";

export default async function publicRoutes(app, deps) {
  const { prisma, normalizeDbPermissions, buildQrTargetUrl } = deps;

  app.get("/", async () => {
    return {
      status: "ok",
      message: "Tiffzy Backend Running",
    };
  });

  app.get("/healthz", async () => {
    return { status: "ok" };
  });

  // Public restaurant list for customer-side auto selection (geo or manual).
  app.get("/restaurants", async (req, reply) => {
    try {
      const rows = await prisma.restaurant.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          state: true,
          country: true,
          pincode: true,
          logoUrl: true,
          latitude: true,
          longitude: true,
        },
        orderBy: { id: "asc" },
      });

      // Keep response shape stable (`logo` key) even though DB field is `logoUrl`.
      return rows.map((r) => ({ ...r, logo: r.logoUrl || "", logoUrl: undefined }));
    } catch (err) {
      req.log.error({ err: err?.message || err }, "restaurants_fetch_failed");
      return reply.code(500).send({
        message:
          process.env.NODE_ENV === "development"
            ? `Failed to load restaurants: ${err?.message || "Unknown error"}`
            : "Failed to load restaurants",
      });
    }
  });

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

      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          restaurant: true,
          staffAccess: {
            select: { permissions: true, role: true },
          },
        },
      });

      if (!user) {
        return reply.code(401).send({
          message: "Invalid email",
        });
      }

      const valid = user.password === password || bcrypt.compareSync(password, user.password);
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

      const baseRole = String(user.role || "STAFF").toUpperCase();
      const accessRole = String(user.staffAccess?.role || "").toUpperCase();
      const effectiveRole = baseRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : baseRole || accessRole || "STAFF";

      const token = app.jwt.sign({
        id: user.id,
        role: effectiveRole,
        restaurantId: user.restaurantId || null,
        branchId: user.branchId || null,
      });

      let access = null;
      if (effectiveRole !== "SUPER_ADMIN") {
        access = normalizeDbPermissions(user.staffAccess?.permissions, effectiveRole);
      }

      const userPayload = {
        ...user,
        role: effectiveRole,
        access,
      };
      delete userPayload.password;
      if (userPayload.staffAccess !== undefined) {
        delete userPayload.staffAccess;
      }

      return {
        message: "Login success",
        token,
        user: userPayload,
        offlineMode: false,
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

  app.get("/menu", async () => {
    return await prisma.menuItem.findMany({
      where: {
        isAvailable: true,
      },
      orderBy: {
        id: "desc",
      },
    });
  });

  app.post("/menu", async (req, reply) => {
    try {
      const { name, description, price, category, image, restaurantId, isAvailable } = req.body || {};
      if (!name || price === undefined || price === null) {
        return reply.code(400).send({ message: "Name and price are required" });
      }

      let resolvedRestaurantId = Number(restaurantId || 0);
      if (!resolvedRestaurantId) {
        const firstRestaurant = await prisma.restaurant.findFirst({ select: { id: true } });
        resolvedRestaurantId = firstRestaurant?.id || 0;
      }
      if (!resolvedRestaurantId) return reply.code(400).send({ message: "Restaurant is required" });

      return await prisma.menuItem.create({
        data: {
          restaurantId: resolvedRestaurantId,
          name: String(name).trim(),
          description: description ? String(description).trim() : "",
          category: category ? String(category).trim() : "General",
          image: image ? String(image).trim() : "",
          price: Number(price),
          isAvailable: isAvailable ?? true,
        },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to create menu item" });
    }
  });

  app.put("/menu/:id", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      const { name, description, price, category, image, isAvailable } = req.body || {};
      if (!id) return reply.code(400).send({ message: "Invalid menu item id" });

      const existing = await prisma.menuItem.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ message: "Menu item not found" });

      return await prisma.menuItem.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          description: description ?? existing.description,
          category: category ?? existing.category,
          image: image ?? existing.image,
          price: price === undefined ? existing.price : Number(price),
          isAvailable: isAvailable ?? existing.isAvailable,
        },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update menu item" });
    }
  });

  app.delete("/menu/:id", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ message: "Invalid menu item id" });
      await prisma.menuItem.delete({ where: { id } });
      return { message: "Menu item deleted" };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete menu item" });
    }
  });

  app.get("/orders", async (req, reply) => {
    try {
      const restaurantId = Number(req.query?.restaurantId || 0);
      const status = String(req.query?.status || "").trim().toUpperCase();
      const where = {
        ...(restaurantId ? { restaurantId } : {}),
        ...(status ? { status } : {}),
      };

      return await prisma.order.findMany({
        where,
        include: {
          restaurant: { select: { id: true, name: true, slug: true } },
          items: true,
          customer: true,
          statusEvents: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch orders" });
    }
  });

  app.get("/tables", async (req, reply) => {
    try {
      const restaurantId = Number(req.query?.restaurantId || 0);
      return await prisma.diningTable.findMany({
        where: restaurantId ? { restaurantId } : {},
        include: { restaurant: { select: { id: true, name: true, slug: true } } },
        orderBy: { id: "desc" },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch tables" });
    }
  });

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
            upiId: restaurant.upiId || null,
            taxEnabled: restaurant.taxEnabled,
            taxType: restaurant.taxType,
            defaultTaxPercent: restaurant.defaultTaxPercent,
          serviceChargeEnabled: restaurant.serviceChargeEnabled,
          serviceChargePercent: restaurant.serviceChargePercent,
          gstEnabled: restaurant.taxEnabled,
          taxPercent: restaurant.defaultTaxPercent,
          logo: restaurant.logoUrl,
          phone: restaurant.phone,
          email: restaurant.email,
        },
        menu: restaurant.menuItems,
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({
        message: "Failed to fetch menu",
      });
    }
  });

  app.get("/r/:slug/tables", async (req, reply) => {
    try {
      const { slug } = req.params;
      const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true, slug: true } });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      const tables = await prisma.diningTable.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: { id: "desc" },
      });

      return tables.map((table) => ({
        ...table,
        qrCodeUrl: table.qrCodeUrl || buildQrTargetUrl(restaurant.slug, table.tableNo),
      }));
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch restaurant tables" });
    }
  });
}
