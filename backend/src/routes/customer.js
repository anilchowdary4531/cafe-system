import { normalizePhone } from "../services/phoneService.js";
import { buildReadableOrderNo } from "../services/orderService.js";
import { requireCustomerPhoneFromJwt } from "../services/customerProfileService.js";
import { buildCustomerOtpController } from "../controllers/customerOtpController.js";
import { buildCustomerProfileController } from "../controllers/customerProfileController.js";
import { buildCustomerAddressController } from "../controllers/customerAddressController.js";

const normalizeDeliveryAddress = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim().replace(/\n{3,}/g, "\n\n");
  }

  if (typeof value === "object") {
    const label = String(value.label || "").trim();
    const line1 = String(value.line1 || value.addressLine1 || value.address || "").trim();
    const line2 = String(value.line2 || value.addressLine2 || "").trim();
    const locality = [value.city, value.mandal || value.state, value.postalCode || value.pincode]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(", ");
    const notes = String(value.notes || value.instructions || "").trim();

    return [label, line1, line2, locality, notes]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join("\n");
  }

  return String(value).trim();
};

const normalizeDeliveryCoordinate = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeFulfillment = (value) => {
  const fulfillment = String(value || "").trim().toLowerCase();
  if (["pickup", "takeaway", "take_away", "counter"].includes(fulfillment)) return "pickup";
  if (["delivery", "online", "home_delivery", "door_delivery"].includes(fulfillment)) return "delivery";
  return "";
};

const normalizeDeliveryLocation = (body) => {
  const source = body && typeof body === "object" ? body : {};
  const addressSource = source.deliveryAddress && typeof source.deliveryAddress === "object" ? source.deliveryAddress : {};
  return {
    latitude: normalizeDeliveryCoordinate(source.deliveryLatitude ?? source.latitude ?? addressSource.latitude ?? addressSource.lat),
    longitude: normalizeDeliveryCoordinate(source.deliveryLongitude ?? source.longitude ?? addressSource.longitude ?? addressSource.lng),
  };
};

export default async function customerRoutes(app, deps) {
  const { prisma, realtime } = deps;
  const otpController = buildCustomerOtpController({ prisma, app });
  const profileController = buildCustomerProfileController({ prisma });
  const addressController = buildCustomerAddressController({ prisma });

  app.get("/customer/orders", async (req, reply) => {
    try {
      let tokenPhone = "";
      try {
        tokenPhone = await requireCustomerPhoneFromJwt(req);
      } catch {
        tokenPhone = "";
      }

      const phone = normalizePhone(req.query?.phone || tokenPhone || "");
      if (!phone) return reply.code(400).send({ message: "Phone number is required" });

      const orders = await prisma.order.findMany({
        where: { phone },
        include: {
          restaurant: { select: { id: true, name: true, slug: true, city: true, state: true, logoUrl: true } },
          items: true,
          statusEvents: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      });

      const byRestaurantId = new Map();

      for (const order of orders) {
        const restaurant = order.restaurant
          ? { ...order.restaurant, logo: order.restaurant.logoUrl || "", logoUrl: undefined }
          : null;
        const restaurantId = Number(restaurant?.id || 0);
        const key = restaurantId || -1;

        if (!byRestaurantId.has(key)) {
          byRestaurantId.set(key, {
            restaurant,
            orders: [],
            stats: {
              totalOrders: 0,
              totalSpend: 0,
              activeOrders: 0,
              lastOrderAt: null,
            },
          });
        }

        const group = byRestaurantId.get(key);
        const { restaurant: _restaurant, ...orderPayload } = order;
        group.orders.push(orderPayload);
      }

      const activeStatuses = new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]);

      const groups = [...byRestaurantId.values()].map((group) => {
        const totalSpend = group.orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const activeOrders = group.orders.reduce((sum, o) => {
          const s = String(o.status || "").toUpperCase();
          return sum + (activeStatuses.has(s) ? 1 : 0);
        }, 0);

        const lastOrderAt = group.orders.length ? group.orders[0].createdAt : null;

        return {
          restaurant: group.restaurant,
          stats: {
            totalOrders: group.orders.length,
            totalSpend,
            activeOrders,
            lastOrderAt,
          },
          orders: group.orders,
        };
      });

      groups.sort((a, b) => {
        const at = a.stats?.lastOrderAt ? new Date(a.stats.lastOrderAt).getTime() : 0;
        const bt = b.stats?.lastOrderAt ? new Date(b.stats.lastOrderAt).getTime() : 0;
        return bt - at;
      });

      return { phone, groups };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch customer orders" });
    }
  });

  app.post("/customer/send-otp", otpController.sendOtp);
  app.post("/customer/verify-otp", otpController.verifyOtp);

  // Backward compatible alias.
  app.post("/customer/login", async (req, reply) => {
    const body = req.body || {};
    const otp = String(body.otp || "").trim();
    const step = String(body.step || (otp ? "verify" : "request")).trim().toLowerCase();
    if (step === "verify") return otpController.verifyOtp(req, reply);
    return otpController.sendOtp(req, reply);
  });

  app.get("/customer/profile", profileController.getProfile);
  app.put("/customer/profile", profileController.putProfile);

  app.get("/customer/address", addressController.getAddresses);
  app.post("/customer/address", addressController.postAddress);
  app.delete("/customer/address/:id", addressController.deleteAddress);

  app.post("/r/:slug/order", async (req, reply) => {
    try {
      const { slug } = req.params;
      const body = req.body || {};

      let tokenPhone = "";
      try {
        tokenPhone = await requireCustomerPhoneFromJwt(req);
      } catch {
        tokenPhone = "";
      }

      let normalizedPhone = normalizePhone(body.phone || tokenPhone || "");
      let normalizedEmail = String(body.email || "").trim().toLowerCase();
      let normalizedCustomerName = String(body.customerName || "").trim();
      const normalizedTableNo = String(body.tableNumber || "").trim() || null;
      const requestedFulfillment = normalizeFulfillment(body.fulfillment || body.orderSource);
      const isPickupOrder = !normalizedTableNo && requestedFulfillment === "pickup";
      const normalizedOrderSource = normalizedTableNo ? "QR" : isPickupOrder ? "PICKUP" : "DELIVERY";
      const normalizedDeliveryAddress = normalizeDeliveryAddress(body.deliveryAddress || body.address || body.shippingAddress || "");
      const normalizedDeliveryLocation = normalizeDeliveryLocation(body);

      const items = body.items;
      const notes = body.notes;

      if (!normalizedPhone) {
        return reply.code(400).send({ message: "Phone number is required to continue" });
      }

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

      if (normalizedOrderSource === "DELIVERY" && !normalizedDeliveryAddress) {
        return reply.code(400).send({
          message: "Delivery address is required for online orders",
        });
      }

      // If the UI didn't send name/email (because customer is already logged in),
      // enrich it from the account record if available.
      if (normalizedPhone && (!normalizedCustomerName || !normalizedEmail)) {
        const account = await prisma.customerAccount.findUnique({
          where: { phone: normalizedPhone },
          select: { name: true, email: true },
        });
        if (account) {
          if (!normalizedCustomerName) normalizedCustomerName = String(account.name || "").trim();
          if (!normalizedEmail) normalizedEmail = String(account.email || "").trim().toLowerCase();
        }
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

        const availableById = new Map(availableMenuItems.map((menuItem) => [menuItem.id, menuItem]));

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

      const subtotal = normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
      const taxAmount = restaurant.taxEnabled ? (subtotal * restaurant.defaultTaxPercent) / 100 : 0;
      const serviceChargeAmount = restaurant.serviceChargeEnabled
        ? (subtotal * restaurant.serviceChargePercent) / 100
        : 0;
      const total = subtotal + taxAmount + serviceChargeAmount;

      const invoiceSequence = Number(restaurant.nextInvoiceNumber || 1001);
      const orderNo = buildReadableOrderNo({
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        restaurantCode: restaurant.invoicePrefix,
        tableNo: normalizedTableNo,
        date: new Date(),
        sequence: invoiceSequence,
      });
      const invoiceNo = `${String(restaurant.invoicePrefix || "INV").toUpperCase()}-${invoiceSequence}`;

      let customerRecord = null;
      if (normalizedPhone) {
        await prisma.customerAccount.upsert({
          where: { phone: normalizedPhone },
          update: {
            name: normalizedCustomerName || undefined,
            email: normalizedEmail || undefined,
          },
          create: {
            phone: normalizedPhone,
            name: normalizedCustomerName || null,
            email: normalizedEmail || null,
          },
        });

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
      }

      const order = await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          orderNo,
          invoiceNo,
          orderSource: normalizedOrderSource,
          customerName: normalizedCustomerName || null,
          phone: normalizedPhone || null,
          email: normalizedEmail || null,
          tableNo: normalizedTableNo,
          notes,
          deliveryAddress: isPickupOrder ? null : normalizedDeliveryAddress || null,
          deliveryLatitude: isPickupOrder ? null : normalizedDeliveryLocation.latitude,
          deliveryLongitude: isPickupOrder ? null : normalizedDeliveryLocation.longitude,
          subtotal,
          taxAmount,
          serviceChargeAmount,
          total,
          status: "PLACED",
          customerId: customerRecord?.id || null,
          items: {
            create: normalizedItems.map((item) => ({
              menuItemId: item.menuItemId,
              itemName: item.itemName,
              qty: item.qty,
              price: item.price,
              total: item.total,
            })),
          },
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

      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          nextInvoiceNumber: {
            increment: 1,
          },
        },
      });

      realtime?.emitOrderCreated?.(order);

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
      const phone = normalizePhone(req.query?.phone || "");

      const restaurant = await prisma.restaurant.findUnique({
        where: { slug },
      });

      if (!restaurant) {
        return reply.code(404).send({
          message: "Restaurant not found",
        });
      }

      const orders = await prisma.order.findMany({
        where: {
          restaurantId: restaurant.id,
          ...(phone ? { phone } : {}),
        },
        include: {
          items: true,
          statusEvents: {
            orderBy: {
              createdAt: "asc",
            },
          },
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
}
