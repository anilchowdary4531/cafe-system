import bcrypt from "bcryptjs";
import {
  buildStaffLoginPayload,
  issueStaffSession,
} from "../services/staffSessionService.js";
import { resolveMenuPricing } from "../services/menuPricingService.js";
import { staffLoginRateLimiter } from "../middleware/rateLimiter.js";
import { getLoginLockoutConfig } from "../services/staffAuthService.js";
import { logAuditEvent } from "../services/auditLogService.js";

export default async function publicRoutes(app, deps = {}) {
  const { prisma, buildQrTargetUrl, STAFF_ACCESS_MODULES } = deps || {};
  const normalizeDbPermissions = deps?.normalizeDbPermissions || ((p) => (p && typeof p === "object" ? p : {}));

  const parsePositiveInt = (value, fallback, max = null) => {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    if (max !== null) return Math.min(parsed, max);
    return parsed;
  };

  const normalizeQuery = (value) => String(value || "").trim();

  const restaurantSearchOr = (query) => [
    { name: { contains: query, mode: "insensitive" } },
    { legalName: { contains: query, mode: "insensitive" } },
    { slug: { contains: query, mode: "insensitive" } },
    { city: { contains: query, mode: "insensitive" } },
    { state: { contains: query, mode: "insensitive" } },
    { country: { contains: query, mode: "insensitive" } },
    { pincode: { contains: query, mode: "insensitive" } },
    { addressLine1: { contains: query, mode: "insensitive" } },
    {
      menuItems: {
        some: {
          isAvailable: true,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
          ],
        },
      },
    },
  ];

  const itemSearchOr = (query) => [
    { name: { contains: query, mode: "insensitive" } },
    { description: { contains: query, mode: "insensitive" } },
    { category: { contains: query, mode: "insensitive" } },
  ];

  const parseItemImages = (imgVal) => {
    if (!imgVal) return [];
    if (Array.isArray(imgVal)) return imgVal.map(String).filter(Boolean);
    if (typeof imgVal === "string") {
      const trimmed = imgVal.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(String).filter(Boolean);
        } catch {}
      }
      if (trimmed.includes(",")) {
        const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.length > 1 && parts.every((p) => p.startsWith("http") || p.startsWith("/"))) {
          return parts;
        }
      }
      return [trimmed];
    }
    return [];
  };

  app.get("/", async () => {
    return {
      status: "ok",
      message: "Tiffzy Backend Running",
    };
  });

  app.get("/healthz", async () => {
    return { status: "ok" };
  });

  app.get("/banners", async () => {
    try {
      if (!prisma.banner) return [];
      let banners = await prisma.banner.findMany({
        where: { isActive: true },
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
        await prisma.banner.createMany({ data: defaults, skipDuplicates: true }).catch(() => { });
        banners = await prisma.banner.findMany({ where: { isActive: true }, orderBy: { priority: "desc" } });
      }
      return banners || [];
    } catch {
      return [];
    }
  });

  const PUBLIC_CATEGORY_FALLBACK_IMAGES = {
    biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80",
    pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80",
    burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80",
    coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80",
    "fast food": "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=300&q=80",
    desserts: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80",
    beverages: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=300&q=80",
    "ice cream": "https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=300&q=80",
    food: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80",
    sweet: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=300&q=80",
  };

  const normalizePublicCat = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    const lower = s.toLowerCase();
    if (lower === "cofee") return "Coffee";
    if (lower === "dessert") return "Desserts";
    if (lower === "briyani") return "Biryani";
    if (lower === "beverage") return "Beverages";
    if (lower === "sweet" || lower === "sweets") return "Sweet";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const isTobaccoProduct = (item) => {
    const isTerm = (s = "") => /cigarette|tobacco|marlboro|gold flake|classic|cigar|pan|hookah/i.test(String(s || ""));
    return isTerm(item?.name) || isTerm(item?.category) || isTerm(item?.description);
  };

  app.get("/global-categories", async () => {
    try {
      let categories = [];
      if (prisma.globalCategory) {
        try {
          categories = await prisma.globalCategory.findMany({
            where: { isActive: true },
            orderBy: { priority: "desc" },
          });
        } catch {
          categories = [];
        }
      }

      if (!categories || categories.length === 0) {
        const menuItems = await prisma.menuItem.findMany({
          where: { isAvailable: true },
          select: { category: true, name: true },
        }).catch(() => []);

        const discovered = new Set();
        for (const item of menuItems) {
          if (isTobaccoProduct(item)) continue;
          const cat = normalizePublicCat(item.category);
          if (cat) discovered.add(cat);
        }
        ["Biryani", "Pizza", "Burger", "Coffee", "Fast Food", "Desserts", "Beverages", "Ice Cream", "Food", "Sweet"].forEach((d) => discovered.add(d));

        let p = 100;
        categories = Array.from(discovered).map((name, idx) => ({
          id: idx + 1,
          name,
          imageUrl: PUBLIC_CATEGORY_FALLBACK_IMAGES[name.toLowerCase()] || PUBLIC_CATEGORY_FALLBACK_IMAGES.food,
          priority: p - idx * 5,
          isActive: true,
        }));
      }

      // Deduplicate by normalized name and filter out tobacco categories
      const deduplicatedMap = new Map();
      for (const cat of categories) {
        const normName = normalizePublicCat(cat.name);
        const lowerKey = normName.toLowerCase();
        if (/cigarette|tobacco|paan corner|cigar|hookah/i.test(lowerKey)) continue;
        if (!deduplicatedMap.has(lowerKey)) {
          deduplicatedMap.set(lowerKey, {
            ...cat,
            name: normName,
          });
        }
      }

      return Array.from(deduplicatedMap.values());
    } catch {
      return [];
    }
  });

  // Public restaurant list for customer-side auto selection (geo or manual).
  app.get("/restaurants", async (req, reply) => {
    try {
      const query = normalizeQuery(req.query?.q || req.query?.query);
      const hasQuery = query.length >= 2;
      const limit = parsePositiveInt(req.query?.limit, null, 100);
      const offset = parsePositiveInt(req.query?.offset, 0, 10_000);
      const coordsOnly = String(req.query?.coordsOnly || "").trim().toLowerCase();
      const isCoordsOnly = coordsOnly === "1" || coordsOnly === "true";

      const where = {
        isActive: true,
        ...(hasQuery
          ? {
            OR: restaurantSearchOr(query),
          }
          : {}),
      };

      const rows = await prisma.restaurant.findMany({
        where,
        select: isCoordsOnly
          ? {
            id: true,
            name: true,
            slug: true,
            city: true,
            state: true,
            logoUrl: true,
            latitude: true,
            longitude: true,
          }
          : {
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
        orderBy: { name: "asc" },
        ...(limit !== null ? { take: limit, skip: offset } : {}),
      });

      // Keep response shape stable (`logo` key) even though DB field is `logoUrl`.
      const restaurantRows = rows.map((r) => ({ ...r, logo: r.logoUrl || "", logoUrl: undefined }));

      if (limit === null && !hasQuery) {
        return restaurantRows;
      }

      const total = await prisma.restaurant.count({ where });
      return {
        restaurants: restaurantRows,
        total,
        hasMore: offset + restaurantRows.length < total,
        nextOffset: offset + restaurantRows.length,
        query: query || "",
      };
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

  app.get("/catalog/search", async (req, reply) => {
    try {
      const query = normalizeQuery(req.query?.q || req.query?.query);
      const restaurantLimit = parsePositiveInt(req.query?.restaurantLimit, 24, 60);
      const itemLimit = parsePositiveInt(req.query?.itemLimit, 12, 50);


      const mapItem = (item) => {
        const imagesList = parseItemImages(item.image);
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          category: item.category,
          image: imagesList[0] || item.image || null,
          images: imagesList.length > 0 ? imagesList : (item.image ? [item.image] : []),
          imageUrls: imagesList.length > 0 ? imagesList : (item.image ? [item.image] : []),
          price: item.price,
          rating: item.rating,
          reviewCount: item.reviewCount,
          orderCount: item.orderCount,
          isFeatured: item.isFeatured,
          restaurant: {
            id: item.restaurant?.id || null,
            name: item.restaurant?.name || "",
            slug: item.restaurant?.slug || "",
            city: item.restaurant?.city || "",
            state: item.restaurant?.state || "",
            logo: item.restaurant?.logoUrl || "",
          },
        };
      };

      if (query.length < 2) {
        const [rawItems, itemTotal] = await Promise.all([
          prisma.menuItem.findMany({
            where: {
              isAvailable: true,
            },
            include: {
              restaurant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  city: true,
                  state: true,
                  logoUrl: true,
                  isActive: true,
                },
              },
            },
            orderBy: [{ isFeatured: "desc" }, { id: "desc" }, { name: "asc" }],
            take: 200,
          }),
          prisma.menuItem.count({
            where: {
              isAvailable: true,
            },
          }),
        ]);

        const items = rawItems
          .filter((item) => {
            if (!item?.restaurant || item.restaurant.isActive === false) return false;
            if (isTobaccoProduct(item)) return false;
            return true;
          })
          .map(mapItem);

        return {
          query: "",
          restaurants: [],
          items,
          totalRestaurants: 0,
          totalItems: itemTotal,
          hasMoreRestaurants: false,
        };
      }

      const restaurantWhere = {
        isActive: true,
        OR: restaurantSearchOr(query),
      };

      const itemWhere = {
        isAvailable: true,
        OR: itemSearchOr(query),
      };

      const [restaurantRows, restaurantTotal, rawItems, itemTotal] = await Promise.all([
        prisma.restaurant.findMany({
          where: restaurantWhere,
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
          orderBy: { name: "asc" },
          take: restaurantLimit,
        }),
        prisma.restaurant.count({ where: restaurantWhere }),
        prisma.menuItem.findMany({
          where: itemWhere,
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                slug: true,
                city: true,
                state: true,
                logoUrl: true,
                isActive: true,
              },
            },
          },
          orderBy: [{ orderCount: "desc" }, { rating: "desc" }, { name: "asc" }],
          take: itemLimit * 4,
        }),
        prisma.menuItem.count({ where: itemWhere }),
      ]);

      const restaurants = restaurantRows.map((r) => ({ ...r, logo: r.logoUrl || "", logoUrl: undefined }));

      const items = rawItems
        .filter((item) => {
          if (!item?.restaurant || item.restaurant.isActive === false) return false;
          if (isTobaccoProduct(item)) return false;
          return true;
        })
        .slice(0, itemLimit)
        .map(mapItem);

      return {
        query,
        restaurants,
        items,
        totalRestaurants: restaurantTotal,
        totalItems: itemTotal,
        hasMoreRestaurants: restaurantTotal > restaurants.length,
      };
    } catch (err) {
      req.log.error({ err: err?.message || err }, "catalog_search_failed");
      return reply.code(500).send({
        message:
          process.env.NODE_ENV === "development"
            ? `Search failed: ${err?.message || "Unknown error"}`
            : "Search failed",
      });
    }
  });

  const handleTobaccoItems = async (req, reply) => {
    try {
      const search = normalizeQuery(req.query?.q || req.query?.query || req.query?.search);
      const isTobaccoTerm = (s = "") => {
        return /\b(cigarette|cigarettes|tobacco|cigar|cigars|marlboro|gold flake|goldflake|classic|bidi|bidis|beedi|beedis|hookah|nicotine|vape)\b/i.test(String(s || ""));
      };

      let rawTobaccoMap = {};
      try {
        const rawList = await prisma.$queryRawUnsafe(`SELECT id, tobacco_approved FROM "restaurants";`)
          .catch(() => prisma.$queryRawUnsafe(`SELECT id, tobacco_approved FROM "Restaurant";`));
        if (Array.isArray(rawList)) {
          rawList.forEach((r) => {
            if (r.id !== undefined && r.tobacco_approved !== undefined && r.tobacco_approved !== null) {
              rawTobaccoMap[r.id] = Boolean(r.tobacco_approved);
            }
          });
        }
      } catch {}

      let resolvedRestaurantId = req.query?.restaurantId ? Number(req.query.restaurantId) : null;
      if (!resolvedRestaurantId && req.query?.slug) {
        const rest = await prisma.restaurant.findUnique({
          where: { slug: String(req.query.slug).trim() },
          select: { id: true },
        });
        if (rest) resolvedRestaurantId = rest.id;
      }
      if (!resolvedRestaurantId && req.query?.token) {
        const tbl = await prisma.diningTable.findFirst({
          where: { qrToken: String(req.query.token).trim() },
          select: { restaurantId: true },
        });
        if (tbl) resolvedRestaurantId = tbl.restaurantId;
      }

      const itemWhere = {
        isAvailable: true,
        restaurant: {
          isActive: true,
        },
      };

      if (resolvedRestaurantId) {
        itemWhere.restaurantId = resolvedRestaurantId;
      }

      if (search) {
        itemWhere.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ];
      }

      const rawItems = await prisma.menuItem.findMany({
        where: itemWhere,
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
              city: true,
              state: true,
              logoUrl: true,
              isActive: true,
              tobaccoApproved: true,
            },
          },
        },
        orderBy: [{ isFeatured: "desc" }, { id: "desc" }],
        take: 100,
      });

      const items = rawItems
        .filter((item) => {
          const isAppr = item.restaurant?.tobaccoApproved === true || rawTobaccoMap[item.restaurant?.id] === true;
          if (!item?.restaurant || item.restaurant.isActive === false || !isAppr) {
            return false;
          }
          // CRITICAL: Item must ALWAYS be a tobacco product regardless of search term
          const isTobacco = isTobaccoTerm(item.category) || isTobaccoTerm(item.name) || isTobaccoTerm(item.description);
          if (!isTobacco) {
            return false;
          }
          if (search) {
            const q = search.toLowerCase();
            const matchesSearch =
              (item.name && item.name.toLowerCase().includes(q)) ||
              (item.description && item.description.toLowerCase().includes(q)) ||
              (item.category && item.category.toLowerCase().includes(q));
            if (!matchesSearch) return false;
          }
          return true;
        })
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          category: item.category,
          image: item.image,
          price: item.price,
          rating: item.rating,
          reviewCount: item.reviewCount,
          orderCount: item.orderCount,
          isFeatured: item.isFeatured,
          restaurant: {
            id: item.restaurant?.id || null,
            name: item.restaurant?.name || "",
            slug: item.restaurant?.slug || "",
            city: item.restaurant?.city || "",
            state: item.restaurant?.state || "",
            logo: item.restaurant?.logoUrl || "",
          },
        }));

      return {
        items,
        total: items.length,
      };
    } catch (err) {
      req.log.error({ err: err?.message || err }, "tobacco_items_fetch_failed");
      return reply.code(500).send({
        message: "Failed to fetch tobacco items",
        items: [],
        total: 0,
      });
    }
  };

  app.get("/tobacco/items", handleTobaccoItems);
  app.get("/api/tobacco/items", handleTobaccoItems);
  app.get("/api/v1/tobacco/items", handleTobaccoItems);

  const DUMMY_BCRYPT_HASH = "$2a$10$wT0vV274Lz58sF8x8y0ncuX8e9V3eF6.oI9xT5tK4T2Fk7Z1y6ZGi";

  const handleStaffLogin = async (req, reply) => {
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
        bcrypt.compareSync(String(password), DUMMY_BCRYPT_HASH);
        return reply.code(401).send({
          message: "Invalid email or password",
        });
      }

      const now = new Date();
      const isLocked = Boolean(user.lockedUntil && new Date(user.lockedUntil) > now);
      if (isLocked) {
        bcrypt.compareSync(String(password), DUMMY_BCRYPT_HASH);
        await logAuditEvent({
          prisma,
          restaurantId: user.restaurantId,
          branchId: user.branchId,
          actor: { id: user.id, name: user.name, role: user.role },
          action: "AUTH_LOGIN_FAILURE",
          entity: "USER",
          entityId: user.id,
          status: "FAILURE",
          severity: "WARN",
          details: { reason: "ACCOUNT_LOCKED" },
          req,
        });

        return reply.code(401).send({
          message: "Invalid email or password",
        });
      }

      const valid = Boolean(user.password && bcrypt.compareSync(String(password), user.password));
      if (!valid) {
        const { threshold, durationMinutes } = getLoginLockoutConfig();
        const wasExpired = Boolean(user.lockedUntil && new Date(user.lockedUntil) <= now);
        let didLock = false;

        await prisma.$transaction(async (tx) => {
          const current = await tx.user.findUnique({
            where: { id: user.id },
            select: { failedLoginAttempts: true, lockedUntil: true },
          });
          const isCurrentExpired = Boolean(current?.lockedUntil && new Date(current.lockedUntil) <= now);
          const newCount = (wasExpired || isCurrentExpired) ? 1 : ((current?.failedLoginAttempts || 0) + 1);
          const lockTime = newCount >= threshold ? new Date(now.getTime() + durationMinutes * 60 * 1000) : null;
          if (lockTime) {
            didLock = true;
          }
          await tx.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newCount,
              lastFailedLoginAt: now,
              lockedUntil: lockTime,
            },
          });
        });

        await logAuditEvent({
          prisma,
          restaurantId: user.restaurantId,
          branchId: user.branchId,
          actor: { id: user.id, name: user.name, role: user.role },
          action: "AUTH_LOGIN_FAILURE",
          entity: "USER",
          entityId: user.id,
          status: "FAILURE",
          severity: "WARN",
          details: { reason: "INVALID_CREDENTIALS" },
          req,
        });

        if (didLock) {
          await logAuditEvent({
            prisma,
            restaurantId: user.restaurantId,
            branchId: user.branchId,
            actor: { id: user.id, name: user.name, role: user.role },
            action: "AUTH_ACCOUNT_LOCKED",
            entity: "USER",
            entityId: user.id,
            status: "LOCKED",
            severity: "WARN",
            details: {
              threshold,
              lockoutMinutes: durationMinutes,
            },
            req,
          });
        }

        return reply.code(401).send({
          message: "Invalid email or password",
        });
      }

      if (user.isActive === false) {
        return reply.code(403).send({
          message: "Account is disabled. Contact owner/admin.",
        });
      }

      const isTempExpired =
        Boolean(user.mustChangePassword) &&
        Boolean(user.temporaryPasswordExpiresAt) &&
        new Date(user.temporaryPasswordExpiresAt).getTime() < Date.now();

      if (isTempExpired) {
        await logAuditEvent({
          prisma,
          restaurantId: user.restaurantId,
          branchId: user.branchId,
          actor: { id: user.id, name: user.name, role: user.role },
          action: "AUTH_LOGIN_FAILURE",
          entity: "USER",
          entityId: user.id,
          status: "FAILURE",
          severity: "WARN",
          details: { reason: "TEMP_PASSWORD_EXPIRED" },
          req,
        });

        return reply.code(401).send({
          message: "Invalid email or password",
        });
      }

      const hadExpiredLockout = Boolean(user.lockedUntil && new Date(user.lockedUntil) <= now);
      if (hadExpiredLockout) {
        await logAuditEvent({
          prisma,
          restaurantId: user.restaurantId,
          branchId: user.branchId,
          actor: { id: user.id, name: user.name, role: user.role },
          action: "AUTH_LOCKOUT_EXPIRED",
          entity: "USER",
          entityId: user.id,
          status: "SUCCESS",
          severity: "INFO",
          details: { reason: "LOCKOUT_EXPIRED" },
          req,
        });
      }

      // Reset lockout state on successful authentication
      if ((user.failedLoginAttempts || 0) > 0 || user.lastFailedLoginAt || user.lockedUntil) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lastFailedLoginAt: null,
            lockedUntil: null,
          },
        });
      }

      const mustChangePassword = Boolean(user.mustChangePassword);
      const { userPayload, effectiveRole } = buildStaffLoginPayload({ user, normalizeDbPermissions });
      const { token, refreshToken, sessionVersion } = await issueStaffSession({ prisma, app, user, effectiveRole });
      userPayload.sessionVersion = sessionVersion;

      if (mustChangePassword) {
        await logAuditEvent({
          prisma,
          restaurantId: user.restaurantId,
          branchId: user.branchId,
          actor: { id: user.id, name: user.name, role: user.role },
          action: "AUTH_TEMP_PASSWORD_USED",
          entity: "USER",
          entityId: user.id,
          status: "SUCCESS",
          severity: "INFO",
          details: { role: effectiveRole, branchId: user.branchId || null },
          req,
        });
      }

      await logAuditEvent({
        prisma,
        restaurantId: user.restaurantId,
        branchId: user.branchId,
        actor: { id: user.id, name: user.name, role: user.role },
        action: "AUTH_LOGIN_SUCCESS",
        entity: "USER",
        entityId: user.id,
        status: "SUCCESS",
        severity: "INFO",
        details: {
          role: effectiveRole,
          branchId: user.branchId || null,
        },
        req,
      });

      if (mustChangePassword) {
        return {
          message: "Password change required",
          mustChangePassword: true,
          token,
          refreshToken,
          user: userPayload,
          offlineMode: false,
        };
      }

      return {
        message: "Login success",
        mustChangePassword: false,
        token,
        refreshToken,
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
  };

  app.post("/login", { preHandler: [staffLoginRateLimiter] }, handleStaffLogin);
  app.post("/api/login", { preHandler: [staffLoginRateLimiter] }, handleStaffLogin);

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
      const { name, description, price, originalPrice, discountPercent, category, image, restaurantId, isAvailable } = req.body || {};
      if (!name || (price === undefined && originalPrice === undefined)) {
        return reply.code(400).send({ message: "Name and price are required" });
      }

      let resolvedRestaurantId = Number(restaurantId || 0);
      if (!resolvedRestaurantId) {
        const firstRestaurant = await prisma.restaurant.findFirst({ select: { id: true } });
        resolvedRestaurantId = firstRestaurant?.id || 0;
      }
      if (!resolvedRestaurantId) return reply.code(400).send({ message: "Restaurant is required" });

      const pricing = resolveMenuPricing({ price, originalPrice, discountPercent });

      return await prisma.menuItem.create({
        data: {
          restaurantId: resolvedRestaurantId,
          name: String(name).trim(),
          description: description ? String(description).trim() : "",
          category: category ? String(category).trim() : "General",
          image: image ? String(image).trim() : "",
          price: pricing.price,
          originalPrice: pricing.originalPrice,
          discountPercent: pricing.discountPercent,
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
      const { name, description, price, originalPrice, discountPercent, category, image, isAvailable } = req.body || {};
      if (!id) return reply.code(400).send({ message: "Invalid menu item id" });

      const existing = await prisma.menuItem.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ message: "Menu item not found" });

      const pricing = resolveMenuPricing({ price, originalPrice, discountPercent }, existing);

      return await prisma.menuItem.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          description: description ?? existing.description,
          category: category ?? existing.category,
          image: image ?? existing.image,
          price: pricing.price,
          originalPrice: pricing.originalPrice,
          discountPercent: pricing.discountPercent,
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
      const tables = await prisma.diningTable.findMany({
        where: restaurantId ? { restaurantId } : {},
        include: { restaurant: { select: { id: true, name: true, slug: true } } },
        orderBy: { id: "desc" },
      });
      return tables.map((table) => ({
        ...table,
        qrCodeUrl: table.restaurant?.slug
          ? buildQrTargetUrl(table.restaurant.slug, table.tableNo)
          : table.qrCodeUrl || "",
      }));
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
            include: {
              variants: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
              modifierGroups: {
                orderBy: { sortOrder: "asc" },
                include: {
                  modifiers: {
                    where: { isAvailable: true },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
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
        menu: (restaurant.menuItems || []).map((item) => {
          const imagesList = parseItemImages(item.image);
          return {
            ...item,
            image: imagesList[0] || item.image || null,
            images: imagesList.length > 0 ? imagesList : (item.image ? [item.image] : []),
            imageUrls: imagesList.length > 0 ? imagesList : (item.image ? [item.image] : []),
          };
        }),
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
        qrCodeUrl: buildQrTargetUrl(restaurant.slug, table.tableNo),
      }));
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch restaurant tables" });
    }
  });

  const slugify = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  app.post("/register-restaurant", async (req, reply) => {
    try {
      const body = req.body || {};
      const restaurantName = String(body.restaurantName || "").trim();
      const ownerName = String(body.ownerName || "").trim();
      const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase();
      const ownerPhone = String(body.ownerPhone || "").trim();
      const ownerPassword = String(body.ownerPassword || "").trim();

      if (!restaurantName || !ownerName || !ownerEmail || !ownerPhone || !ownerPassword) {
        return reply.code(400).send({
          message: "Restaurant name, owner name, owner email, owner mobile phone number, and password are required",
        });
      }

      const cleanPhoneDigits = ownerPhone.replace(/\D/g, "");
      if (cleanPhoneDigits.length < 10) {
        return reply.code(400).send({
          message: "Owner mobile phone number must contain at least 10 valid digits",
        });
      }

      if (ownerPassword.length < 6) {
        return reply.code(400).send({
          message: "Password must be at least 6 characters",
        });
      }

      const slug = slugify(restaurantName);
      if (!slug) {
        return reply.code(400).send({
          message: "Invalid restaurant name",
        });
      }

      // Check slug uniqueness
      const existingRestaurant = await prisma.restaurant.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (existingRestaurant) {
        return reply.code(409).send({
          message: "A restaurant with a similar name already exists. Please choose a different name.",
        });
      }

      // Check email uniqueness
      const existingUser = await prisma.user.findUnique({
        where: { email: ownerEmail },
        select: { id: true },
      });
      if (existingUser) {
        return reply.code(409).send({
          message: "Email address is already registered.",
        });
      }

      const modulesList = STAFF_ACCESS_MODULES || [
        "dashboard",
        "orders",
        "menu",
        "tables",
        "kitchen",
        "analytics",
        "finance",
        "staff",
        "settings",
        "notifications",
      ];
      const access = modulesList.reduce((acc, key) => ({ ...acc, [key]: true }), {});

      const result = await prisma.$transaction(async (tx) => {
        const restaurant = await tx.restaurant.create({
          data: {
            name: restaurantName,
            slug,
            ownerName,
            email: ownerEmail,
            phone: ownerPhone || null,
            timezone: "Asia/Kolkata",
            currency: "INR",
            taxEnabled: true,
            taxType: "EXCLUSIVE",
            defaultTaxPercent: 5,
            invoicePrefix: "INV",
            nextInvoiceNumber: 1001,
            isActive: true,
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

      // Automatically log the newly registered user in!
      const user = await prisma.user.findUnique({
        where: { id: result.owner.id },
        include: {
          restaurant: true,
          staffAccess: {
            select: { permissions: true, role: true },
          },
        },
      });

      const { userPayload, effectiveRole } = buildStaffLoginPayload({ user, normalizeDbPermissions });
      const { token, refreshToken, sessionVersion } = await issueStaffSession({ prisma, app, user, effectiveRole });
      userPayload.sessionVersion = sessionVersion;

      return {
        message: "Registration success",
        token,
        refreshToken,
        user: userPayload,
        offlineMode: false,
      };
    } catch (err) {
      console.error(err);
      return reply.code(500).send({
        message:
          process.env.NODE_ENV === "development"
            ? `Registration failed: ${err?.message || "Unknown error"}`
            : "Registration failed",
      });
    }
  });
}
