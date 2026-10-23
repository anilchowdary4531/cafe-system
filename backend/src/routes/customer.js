import { normalizePhone, isValidPhone, getPhoneVariants } from "../services/phoneService.js";
import { buildReadableOrderNo } from "../services/orderService.js";
import { requireCustomerPhoneFromJwt } from "../services/customerProfileService.js";
import { buildCustomerOtpController } from "../controllers/customerOtpController.js";
import { buildCustomerProfileController } from "../controllers/customerProfileController.js";
import { buildCustomerAddressController } from "../controllers/customerAddressController.js";
import { buildCustomerAuthController } from "../controllers/customerAuthController.js";
import { buildPayLaterController } from "../controllers/payLaterController.js";
import { createAndDispatchNotification } from "../services/notificationService.js";
import { RECIPIENT_TYPES, NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import { validateAndCalculateDiscount } from "../services/promotionService.js";
import {
  getOrCreateLoyaltyAccount,
  getLoyaltyConfig,
  validateAndCalculateLoyaltyRedemption,
  redeemPointsForOrder,
  listLoyaltyHistory,
} from "../services/loyaltyService.js";
import { computeBill } from "../services/billingService.js";
import defaultPrisma from "../prisma.js";
import { toSubunit, fromSubunit } from "../services/moneyService.js";
import { getOrCreateActiveSession, recalculateSessionTotals } from "../services/tableSessionService.js";

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

const isTransientPrismaError = (err) => {
  if (!err) return false;
  const transientCodes = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);
  if (err.code && transientCodes.has(err.code)) return true;
  if (err.name === "PrismaClientInitializationError" || err.name === "PrismaClientRustPanicError") return true;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("connection closed") ||
    msg.includes("connection pool timeout") ||
    msg.includes("timed out fetching a new connection") ||
    msg.includes("connection terminated") ||
    msg.includes("connection reset")
  );
};

export default async function customerRoutes(app, deps = {}) {
  const prisma = deps?.prisma || defaultPrisma;
  const realtime = deps?.realtime || null;
  const otpController = buildCustomerOtpController({ prisma, app });
  const profileController = buildCustomerProfileController({ prisma });
  const addressController = buildCustomerAddressController({ prisma });
  const authController = buildCustomerAuthController({ prisma, app });

  app.get("/customer/orders", async (req, reply) => {
    let phone = "";
    try {
      let tokenPhone = "";
      if (req.headers?.authorization) {
        try {
          await req.jwtVerify();
          tokenPhone = normalizePhone(req.user?.phone || "");
          if (!tokenPhone && req.user?.id) {
            const user = await prisma.user.findUnique({
              where: { id: Number(req.user.id) },
              select: { phone: true },
            });
            if (user?.phone) tokenPhone = normalizePhone(user.phone);
          }
          if (!tokenPhone) {
            return reply.code(401).send({ message: "Unauthorized" });
          }
        } catch {
          return reply.code(401).send({ message: "Unauthorized" });
        }
      }

      phone = normalizePhone(tokenPhone || req.query?.phone || "");
      if (!phone) return reply.code(400).send({ message: "Phone number is required" });

      const queryOrders = () =>
        prisma.order.findMany({
          where: {
            phone: {
              in: getPhoneVariants(phone),
            },
          },
          select: {
            id: true,
            restaurantId: true,
            branchId: true,
            customerId: true,
            orderNo: true,
            invoiceNo: true,
            invoiceS3Key: true,
            invoiceS3Url: true,
            orderSource: true,
            fulfillment: true,
            createdByRole: true,
            createdByUserId: true,
            customerType: true,
            customerName: true,
            phone: true,
            email: true,
            tableNo: true,
            tableSessionId: true,
            notes: true,
            deliveryAddress: true,
            deliveryLatitude: true,
            deliveryLongitude: true,
            subtotal: true,
            taxAmount: true,
            serviceChargeAmount: true,
            discountAmount: true,
            total: true,
            promotionId: true,
            couponCode: true,
            discountType: true,
            discountReason: true,
            loyaltyPointsRedeemed: true,
            loyaltyDiscountAmount: true,
            loyaltyPointsEarned: true,
            paymentMode: true,
            paymentStatus: true,
            status: true,
            priority: true,
            clientOperationId: true,
            createdAt: true,
            updatedAt: true,
            restaurant: { select: { id: true, name: true, slug: true, city: true, state: true, logoUrl: true } },
            items: true,
            statusEvents: { orderBy: { createdAt: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        });

      let orders;
      try {
        orders = await queryOrders();
      } catch (firstErr) {
        if (isTransientPrismaError(firstErr)) {
          const logPayload = {
            errName: firstErr.name,
            errCode: firstErr.code,
            errMsg: firstErr.message,
            msg: "Transient Prisma error on customer orders, retrying once",
          };
          if (req.log?.warn) {
            req.log.warn(logPayload);
          } else {
            console.warn(logPayload);
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
          orders = await queryOrders();
        } else {
          throw firstErr;
        }
      }

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
      const maskedPhone = phone ? `${phone.slice(0, 3)}****${phone.slice(-2)}` : "";
      const errorLog = {
        name: err.name,
        code: err.code,
        message: err.message,
        meta: err.meta,
        url: req.raw?.url || req.url,
        phone: maskedPhone,
      };
      if (req.log?.error) {
        req.log.error(errorLog, "Failed to fetch customer orders");
      } else {
        console.error("Failed to fetch customer orders:", errorLog);
      }
      return reply.code(500).send({ message: "Failed to fetch customer orders" });
    }
  });

  app.post("/customer/send-otp", otpController.sendOtp);
  app.post("/customer/verify-otp", otpController.verifyOtp);

  app.post("/customer/request-signup-otp", authController.requestSignupOtp);
  app.post("/customer/register", authController.registerCustomer);
  app.post("/customer/forgot-password", authController.requestForgotPasswordOtp);
  app.post("/customer/reset-password", authController.resetPasswordWithOtp);
  app.post("/customer/login-password", authController.loginWithPassword);
  app.post("/customer/password-login", authController.loginWithPassword);
  app.post("/customer/google-auth", authController.googleLogin);
  app.post("/customer/google-login", authController.googleLogin);

  // Backward compatible alias.
  app.post("/customer/login", async (req, reply) => {
    const body = req.body || {};
    const hasPassword = Boolean(body.password || body.c);
    if (hasPassword) {
      return authController.loginWithPassword(req, reply);
    }
    const otp = String(body.otp || "").trim();
    const step = String(body.step || (otp ? "verify" : "request")).trim().toLowerCase();
    if (step === "verify") return otpController.verifyOtp(req, reply);
    return otpController.sendOtp(req, reply);
  });

  app.get("/customer/profile", profileController.getProfile);
  app.put("/customer/profile", profileController.putProfile);
  app.post("/customer/delete-account/request-otp", profileController.requestDeleteOtp);
  app.post("/customer/delete-account/verify", profileController.deleteAccount);
  app.post("/customer/public/delete-account/request-otp", profileController.publicRequestDeleteOtp);
  app.post("/customer/public/delete-account/verify", profileController.publicDeleteAccount);
  app.delete("/customer/account", profileController.deleteAccount);

  app.get("/customer/address", addressController.getAddresses);
  app.post("/customer/address", addressController.postAddress);
  app.put("/customer/address/:id", addressController.putAddress);
  app.delete("/customer/address/:id", addressController.deleteAddress);

  app.post("/customer/fcm-token", async (req, reply) => {
    return { success: true };
  });

  app.post("/r/:slug/order", async (req, reply) => {
    try {
      const { slug } = req.params;
      const body = req.body || {};

      let tokenPhone = "";
      try {
        tokenPhone = await requireCustomerPhoneFromJwt(req, prisma);
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
      const itemNames = items.map((i) => String(i.name || i.itemName || "").trim().toLowerCase()).filter(Boolean);

      if (requestedIds.length > 0 || itemNames.length > 0) {
        let availableMenuItems = await prisma.menuItem.findMany({
          where: {
            restaurantId: restaurant.id,
            isAvailable: true,
            OR: [
              ...(requestedIds.length > 0 ? [{ id: { in: requestedIds } }] : []),
              ...(itemNames.length > 0 ? [{ name: { in: itemNames } }] : []),
            ],
          },
          select: {
            id: true,
            name: true,
            price: true,
          },
        });

        if (!availableMenuItems.length) {
          availableMenuItems = await prisma.menuItem.findMany({
            where: { restaurantId: restaurant.id, isAvailable: true },
            select: { id: true, name: true, price: true },
          });
        }

        const availableById = new Map(availableMenuItems.map((menuItem) => [menuItem.id, menuItem]));
        const availableByName = new Map(availableMenuItems.map((menuItem) => [menuItem.name.toLowerCase(), menuItem]));

        for (const rawItem of items) {
          const itemId = Number(rawItem.id || rawItem.menuItemId);
          const itemName = String(rawItem.name || rawItem.itemName || "").trim().toLowerCase();

          let dbItem = availableById.get(itemId) || availableByName.get(itemName);
          const rawPrice = Number(rawItem.price);
          const hasValidRawPrice = rawItem.price !== undefined && rawItem.price !== null && !Number.isNaN(rawPrice) && rawPrice >= 0;

          if (!dbItem && !hasValidRawPrice) {
            return reply.code(400).send({
              message: "One or more items are unavailable",
            });
          }

          const qty = Math.max(1, Number(rawItem.qty || rawItem.quantity || 1));
          const price = dbItem ? Number(dbItem.price) : (hasValidRawPrice ? rawPrice : 0);
          normalizedItems.push({
            menuItemId: dbItem?.id || null,
            itemName: dbItem?.name || String(rawItem.name || rawItem.itemName || "Item").trim(),
            qty,
            price,
            total: price * qty,
          });
        }
      } else {
        normalizedItems = items.map((rawItem) => {
          const qty = Math.max(1, Number(rawItem.qty || rawItem.quantity || 1));
          const price = Number(rawItem.price || 0);
          return {
            menuItemId: null,
            itemName: String(rawItem.name || rawItem.itemName || "Item").trim(),
            qty,
            price,
            total: price * qty,
          };
        });
      }

      const subtotal = normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
      const subtotalSubunit = toSubunit(subtotal);

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

      // Coupon discount calculation
      let promoSubunit = 0;
      let couponCodeApplied = null;
      if (body.couponCode) {
        const promoRes = await validateAndCalculateDiscount({
          prisma,
          restaurantId: restaurant.id,
          couponCode: body.couponCode,
          items: normalizedItems,
          orderType: normalizedOrderSource,
          customerId: customerRecord?.id,
          subtotal,
        });
        if (promoRes.ok) {
          promoSubunit = promoRes.discountSubunit;
          couponCodeApplied = promoRes.promotion?.code || String(body.couponCode).toUpperCase();
        }
      }

      // Loyalty points redemption calculation
      let loyaltySubunit = 0;
      let redeemedPoints = 0;
      const requestedPoints = Math.max(0, Math.floor(Number(body.pointsToRedeem || 0)));

      if (requestedPoints > 0 && customerRecord?.id) {
        const loyaltyRes = await validateAndCalculateLoyaltyRedemption({
          db: prisma,
          restaurantId: restaurant.id,
          customerId: customerRecord.id,
          pointsToRedeem: requestedPoints,
          subtotal,
          hasCoupon: Boolean(promoSubunit > 0),
        });

        if (loyaltyRes.valid) {
          loyaltySubunit = loyaltyRes.discountSubunit;
          redeemedPoints = loyaltyRes.pointsToRedeem;
        }
      }

      // Authoritative Bill Calculation via billingService
      const effectiveOrderType = normalizedTableNo
        ? "DINE_IN"
        : isPickupOrder
        ? "PICKUP"
        : requestedFulfillment
        ? String(requestedFulfillment).toUpperCase()
        : "DELIVERY";

      const bill = computeBill({
        items: normalizedItems.map((i) => ({ priceSubunit: toSubunit(i.price), qty: i.qty })),
        orderType: effectiveOrderType,
        billingConfig: restaurant.billingConfig,
        taxEnabled: Boolean(restaurant.taxEnabled || restaurant.defaultTaxPercent > 0),
        taxType: restaurant.taxType || "EXCLUSIVE",
        taxPercent: Number(restaurant.defaultTaxPercent || restaurant.taxPercent || 0),
        serviceChargeEnabled: Boolean(restaurant.serviceChargeEnabled),
        serviceChargePercent: Number(restaurant.serviceChargePercent || 0),
        discountSubunit: promoSubunit,
        loyaltyDiscountSubunit: loyaltySubunit,
        tip: body.tip,
      });


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

      let activeTableSessionId = null;
      if (normalizedTableNo) {
        const rawTable = String(normalizedTableNo).trim();
        const strippedTable = rawTable.replace(/^(table|tbl)[-\s]*/i, "");
        const possibleTableNos = Array.from(new Set([
          rawTable,
          strippedTable,
          `Table ${strippedTable}`,
          `Table-${strippedTable}`,
          `Table ${rawTable}`,
        ].filter(Boolean)));

        const diningTable = await prisma.diningTable.findFirst({
          where: {
            restaurantId: restaurant.id,
            OR: [
              { tableNo: { in: possibleTableNos, mode: "insensitive" } },
              ...(Number.isInteger(Number(rawTable)) ? [{ id: Number(rawTable) }] : []),
              ...(Number.isInteger(Number(strippedTable)) ? [{ id: Number(strippedTable) }] : []),
            ],
          },
        });

        if (diningTable) {
          try {
            const session = await getOrCreateActiveSession({
              prisma,
              restaurantId: restaurant.id,
              tableId: diningTable.id,
              guestCount: 1,
            });
            if (session) {
              activeTableSessionId = session.id;
            }
          } catch (sessionErr) {
            if (sessionErr?.code === "table_dirty") {
              return reply.code(400).send({
                message: sessionErr.message,
                code: "table_dirty",
              });
            }
            throw sessionErr;
          }
        }
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
          tableSessionId: activeTableSessionId,
          notes,
          deliveryAddress: isPickupOrder ? null : normalizedDeliveryAddress || null,
          deliveryLatitude: isPickupOrder ? null : normalizedDeliveryLocation.latitude,
          deliveryLongitude: isPickupOrder ? null : normalizedDeliveryLocation.longitude,
          subtotal: bill.subtotal,
          taxAmount: bill.taxAmount ?? bill.tax ?? 0,
          serviceChargeAmount: bill.serviceChargeAmount ?? bill.serviceCharge ?? 0,
          discountAmount: bill.discountAmount ?? bill.totalDiscount ?? 0,
          total: bill.total,
          billingSnapshot: bill.snapshot,
          loyaltyPointsRedeemed: redeemedPoints,
          loyaltyDiscountAmount: bill.loyaltyDiscountAmount ?? bill.loyaltyDiscount ?? 0,
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

      if (redeemedPoints > 0 && customerRecord?.id) {
        await redeemPointsForOrder({
          db: prisma,
          restaurantId: restaurant.id,
          customerId: customerRecord.id,
          orderId: order.id,
          pointsToRedeem: redeemedPoints,
        }).catch((e) => console.log("Loyalty redemption error:", e?.message));
      }

      if (activeTableSessionId) {
        await recalculateSessionTotals({ prisma, sessionId: activeTableSessionId }).catch((e) =>
          console.warn("[CustomerOrder] Error recalculating session totals:", e?.message)
        );
      }


      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          nextInvoiceNumber: {
            increment: 1,
          },
        },
      });

      realtime?.emitOrderCreated?.(order);

      // 🔔 Dispatch Realtime Notifications & Save in DB
      try {
        const io = req.server.io;
        if (io) {
          io.to(`restaurant_${restaurant.id}`).emit("new_order", order);
          io.to(`restaurant:${restaurant.id}`).emit("new_order", order);
        }

        const summaryText = `New order #${order.orderNo} for ₹${order.total}${order.customerName ? ` from ${order.customerName}` : ""}${order.tableNo ? ` (Table ${order.tableNo})` : ""}.`;

        await createAndDispatchNotification({
          prisma,
          realtime: { io },
          recipientType: RECIPIENT_TYPES.RESTAURANT,
          recipientId: restaurant.id,
          restaurantId: restaurant.id,
          orderId: order.id,
          notificationType: NOTIFICATION_TYPES.NEW_ORDER,
          title: "🔔 New Order Received!",
          message: summaryText,
          data: { orderId: order.id, orderNo: order.orderNo, total: order.total, tableNo: order.tableNo },
          idempotencyKey: `cust_route_order_rest_${order.id}`,
        }).catch((e) => console.log("Notif dispatch error:", e?.message));

        if (customerRecord?.id) {
          await createAndDispatchNotification({
            prisma,
            realtime: { io },
            recipientType: RECIPIENT_TYPES.CUSTOMER,
            recipientId: customerRecord.id,
            restaurantId: restaurant.id,
            orderId: order.id,
            notificationType: NOTIFICATION_TYPES.ORDER_PLACED,
            title: "Order Placed Successfully! 🛒",
            message: `Your order #${order.orderNo} for ₹${order.total} has been received by ${restaurant.name}.`,
            data: { orderId: order.id, orderNo: order.orderNo, total: order.total },
            idempotencyKey: `cust_route_order_cust_${order.id}`,
          }).catch((e) => console.log("Notif dispatch error:", e?.message));
        }
      } catch (notifErr) {
        console.log("Order notification dispatch error:", notifErr?.message);
      }

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

  const payLaterController = buildPayLaterController({ prisma });
  app.get("/customer/pay-later/eligibility", payLaterController.getEligibility);
  app.get("/customer/pay-later/accounts", payLaterController.getAccounts);
  app.get("/customer/pay-later/accounts/:accountId/details", payLaterController.getDetails);
  app.post("/customer/pay-later/accounts/:accountId/repay", payLaterController.repay);
  app.post("/customer/pay-later/accounts/:accountId/repay/verify", payLaterController.verifyRepay);
  app.get("/customer/wallet/history", payLaterController.getWalletHistory);
  app.post("/customer/wallet/recharge", payLaterController.repay); // Alias for now
  app.post("/customer/wallet/verify", payLaterController.verifyRepay); // Alias for now
  app.get("/customer/notifications", payLaterController.getNotifications);
  app.patch("/customer/notifications/:notificationId/read", payLaterController.readNotification);
  app.post("/customer/notifications/:notificationId/read", payLaterController.readNotification);
  app.patch("/customer/notifications/read-all", payLaterController.readAllNotifications);
  app.post("/customer/notifications/read-all", payLaterController.readAllNotifications);
  app.delete("/customer/notifications/:notificationId", async (req, reply) => {
    try {
      const notificationId = Number(req.params.notificationId);
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const variants = getPhoneVariants(phone);
      const [customerAccount, customerRecords] = await Promise.all([
        prisma.customerAccount.findFirst({
          where: {
            OR: [
              { phone: { in: variants } },
              ...(phone.includes("@") ? [{ email: phone.toLowerCase() }] : []),
            ],
          },
        }),
        prisma.customer.findMany({ where: { phone: { in: variants } } }),
      ]);

      const recipientIds = new Set();
      if (customerAccount?.id) recipientIds.add(Number(customerAccount.id));
      customerRecords.forEach((c) => recipientIds.add(Number(c.id)));

      await prisma.notification.deleteMany({
        where: {
          id: notificationId,
          recipientType: "CUSTOMER",
          recipientId: { in: Array.from(recipientIds) },
        },
      });
      await prisma.customerNotification.deleteMany({
        where: {
          id: notificationId,
          customer: { phone: { in: variants } },
        },
      }).catch(() => {});
      return { message: "Notification deleted" };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete notification" });
    }
  });

  // ==========================================
  // FEATURE 15: CUSTOMER CHECKOUT PREVIEW (AUTHORITATIVE)
  // ==========================================
  app.post("/customer/checkout/preview", async (req, reply) => {
    try {
      const body = req.body || {};
      const { slug, items = [], couponCode, pointsToRedeem, restaurantId: rawRestId } = body;

      let restaurant = null;
      const parsedRestId = Number(rawRestId);
      if (Number.isInteger(parsedRestId) && parsedRestId > 0) {
        restaurant = await prisma.restaurant.findUnique({ where: { id: parsedRestId } });
      }
      if (!restaurant && slug) {
        restaurant = await prisma.restaurant.findUnique({ where: { slug: String(slug).trim() } });
      }

      if (!restaurant) {
        return reply.code(404).send({ message: "Restaurant not found" });
      }

      let phone = "";
      try {
        phone = await requireCustomerPhoneFromJwt(req, prisma);
      } catch {
        phone = "";
      }
      if (!phone && body.phone) {
        phone = normalizePhone(body.phone);
      }

      let customerRecord = null;
      if (phone) {
        customerRecord = await prisma.customer.findUnique({
          where: {
            restaurantId_phone: {
              restaurantId: restaurant.id,
              phone,
            },
          },
        });
      }

      if (!items.length) {
        return {
          ok: true,
          restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
          billing: {
            subtotal: 0,
            couponDiscount: 0,
            loyaltyDiscount: 0,
            totalDiscount: 0,
            netSubtotal: 0,
            tax: 0,
            serviceCharge: 0,
            deliveryFee: 0,
            total: 0,
          },
          coupon: null,
          couponError: null,
          loyalty: null,
          loyaltyError: null,
          items: [],
        };
      }

      // Re-verify items against DB active menu items by both ID and Name
      const requestedIds = items
        .map((item) => Number(item.id || item.menuItemId))
        .filter((id) => Number.isInteger(id) && id > 0);
      const itemNames = items
        .map((i) => String(i.name || i.itemName || "").trim().toLowerCase())
        .filter(Boolean);

      let availableMenuItems = [];
      if (requestedIds.length > 0 || itemNames.length > 0) {
        availableMenuItems = await prisma.menuItem.findMany({
          where: {
            restaurantId: restaurant.id,
            isAvailable: true,
            OR: [
              ...(requestedIds.length > 0 ? [{ id: { in: requestedIds } }] : []),
              ...(itemNames.length > 0 ? [{ name: { in: itemNames } }] : []),
            ],
          },
          select: { id: true, name: true, price: true },
        });

        if (!availableMenuItems.length) {
          availableMenuItems = await prisma.menuItem.findMany({
            where: { restaurantId: restaurant.id, isAvailable: true },
            select: { id: true, name: true, price: true },
          });
        }
      }

      const availableById = new Map(availableMenuItems.map((item) => [item.id, item]));
      const availableByName = new Map(availableMenuItems.map((item) => [item.name.toLowerCase(), item]));

      const normalizedItems = [];
      for (const rawItem of items) {
        const itemId = Number(rawItem.id || rawItem.menuItemId);
        const itemName = String(rawItem.name || rawItem.itemName || "").trim().toLowerCase();
        const dbItem = availableById.get(itemId) || (itemName ? availableByName.get(itemName) : null);

        const rawPrice = Number(rawItem.price);
        const hasValidRawPrice = rawItem.price !== undefined && rawItem.price !== null && !Number.isNaN(rawPrice) && rawPrice >= 0;

        if (!dbItem && !hasValidRawPrice) {
          return reply.code(400).send({
            message: `One or more items are unavailable`,
          });
        }

        const qty = Math.max(1, Number(rawItem.qty || rawItem.quantity || 1));
        const price = hasValidRawPrice ? rawPrice : Number(dbItem.price);
        normalizedItems.push({
          menuItemId: dbItem?.id || null,
          itemName: dbItem?.name || String(rawItem.name || rawItem.itemName || "Item").trim(),
          qty,
          price,
          total: price * qty,
        });
      }

      const subtotal = normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
      const subtotalSubunit = toSubunit(subtotal);

      // Coupon Validation
      let promoSubunit = 0;
      let couponInfo = null;
      let couponError = null;

      if (couponCode) {
        const promoRes = await validateAndCalculateDiscount({
          prisma,
          restaurantId: restaurant.id,
          couponCode,
          items: normalizedItems,
          orderType: body.orderSource || "DELIVERY",
          customerId: customerRecord?.id,
          subtotal,
        });

        if (promoRes.ok) {
          promoSubunit = promoRes.discountSubunit;
          couponInfo = {
            code: promoRes.promotion?.code || String(couponCode).toUpperCase(),
            title: promoRes.promotion?.title || "",
            discountAmount: promoRes.discountAmount,
          };
        } else {
          couponError = promoRes.message || "Invalid coupon code";
        }
      }

      // Loyalty Points Validation
      let loyaltySubunit = 0;
      let loyaltyInfo = null;
      let loyaltyError = null;
      const requestedPoints = Math.max(0, Math.floor(Number(pointsToRedeem || 0)));

      if (requestedPoints > 0) {
        if (!customerRecord) {
          loyaltyError = "Customer authentication required to redeem loyalty points.";
        } else {
          const loyaltyRes = await validateAndCalculateLoyaltyRedemption({
            db: prisma,
            restaurantId: restaurant.id,
            customerId: customerRecord.id,
            pointsToRedeem: requestedPoints,
            subtotal,
            hasCoupon: Boolean(promoSubunit > 0),
          });

          if (loyaltyRes.valid) {
            loyaltySubunit = loyaltyRes.discountSubunit;
            loyaltyInfo = {
              pointsRedeemed: loyaltyRes.pointsToRedeem,
              discountAmount: loyaltyRes.discountAmount,
              currentBalance: loyaltyRes.currentBalance,
            };
          } else {
            loyaltyError = loyaltyRes.message;
          }
        }
      }

      // Compute Authoritative Bill
      const effectiveOrderType = body.tableNumber
        ? "DINE_IN"
        : body.fulfillment
        ? String(body.fulfillment).toUpperCase()
        : body.orderType
        ? String(body.orderType).toUpperCase()
        : "ALL";

      const bill = computeBill({
        items: normalizedItems.map((i) => ({ priceSubunit: toSubunit(i.price), qty: i.qty })),
        orderType: effectiveOrderType,
        billingConfig: restaurant.billingConfig,
        taxEnabled: Boolean(restaurant.taxEnabled || restaurant.defaultTaxPercent > 0),
        taxType: restaurant.taxType || "EXCLUSIVE",
        taxPercent: Number(restaurant.defaultTaxPercent || restaurant.taxPercent || 0),
        serviceChargeEnabled: Boolean(restaurant.serviceChargeEnabled),
        serviceChargePercent: Number(restaurant.serviceChargePercent || 0),
        discountSubunit: promoSubunit,
        loyaltyDiscountSubunit: loyaltySubunit,
        tip: body.tip,
      });

      return {
        ok: true,
        restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
        billing: {
          subtotal: bill.subtotal,
          couponDiscount: bill.couponDiscount ?? bill.promoDiscountAmount ?? 0,
          loyaltyDiscount: bill.loyaltyDiscount ?? bill.loyaltyDiscountAmount ?? 0,
          totalDiscount: bill.totalDiscount ?? bill.discountAmount ?? 0,
          netSubtotal: bill.netSubtotal ?? bill.subtotal,
          tax: bill.tax ?? bill.taxAmount ?? 0,
          taxes: bill.taxes,
          serviceCharge: bill.serviceCharge ?? bill.serviceChargeAmount ?? 0,
          charges: bill.charges,
          totalCharges: bill.totalCharges,
          tip: bill.tip,
          roundOff: bill.roundOff,
          deliveryFee: bill.deliveryFee ?? 0,
          total: bill.total,
          grandTotal: bill.total,
        },
        coupon: couponInfo,
        couponError,
        loyalty: loyaltyInfo,
        loyaltyError,
        items: normalizedItems,
      };
    } catch (err) {
      console.log("Checkout preview error:", err);
      return reply.code(500).send({ message: "Failed to calculate order preview" });
    }
  });

  // ==========================================
  // FEATURE 15: PROMOTION VALIDATION FOR CUSTOMER
  // ==========================================
  app.post("/customer/promotions/validate", async (req, reply) => {
    try {
      const { restaurantId, couponCode, subtotal = 0 } = req.body || {};
      const rId = Number(restaurantId);
      if (!rId || !couponCode) {
        return reply.code(400).send({ ok: false, message: "Restaurant ID and coupon code are required" });
      }

      let phone = "";
      try {
        phone = await requireCustomerPhoneFromJwt(req, prisma);
      } catch {
        phone = "";
      }

      let customerRecord = null;
      if (phone) {
        customerRecord = await prisma.customer.findUnique({
          where: { restaurantId_phone: { restaurantId: rId, phone } },
        });
      }

      const res = await validateAndCalculateDiscount({
        prisma,
        restaurantId: rId,
        couponCode,
        customerId: customerRecord?.id,
        subtotal: Number(subtotal),
      });

      if (!res.ok) {
        return reply.code(400).send({ ok: false, message: res.message });
      }

      return {
        ok: true,
        code: res.promotion.code,
        title: res.promotion.title,
        discountAmount: res.discountAmount,
        discountSubunit: res.discountSubunit,
        discountType: res.promotion.discountType,
        discountValue: res.promotion.discountValue,
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ ok: false, message: "Failed to validate coupon" });
    }
  });

  // ==========================================
  // FEATURE 15: CUSTOMER LOYALTY & REWARDS
  // ==========================================
  app.get("/customer/loyalty", async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const restaurantId = Number(req.query?.restaurantId || 0);
      let customerRecord = null;

      if (restaurantId) {
        customerRecord = await prisma.customer.findUnique({
          where: { restaurantId_phone: { restaurantId, phone } },
        });
      } else {
        customerRecord = await prisma.customer.findFirst({
          where: { phone },
          orderBy: { updatedAt: "desc" },
        });
      }

      if (!customerRecord) {
        return {
          currentBalance: 0,
          lifetimeEarned: 0,
          lifetimeRedeemed: 0,
          config: null,
        };
      }

      const account = await getOrCreateLoyaltyAccount({
        db: prisma,
        restaurantId: customerRecord.restaurantId,
        customerId: customerRecord.id,
      });

      const config = await getLoyaltyConfig({
        db: prisma,
        restaurantId: customerRecord.restaurantId,
      });

      const currencyPerPoint = Number(config?.currencyPerPoint || 0.1);
      const equivalentValue = account ? (account.currentBalance * currencyPerPoint).toFixed(2) : "0.00";

      return {
        restaurantId: customerRecord.restaurantId,
        currentBalance: account?.currentBalance || 0,
        lifetimeEarned: account?.lifetimeEarned || 0,
        lifetimeRedeemed: account?.lifetimeRedeemed || 0,
        equivalentValue: Number(equivalentValue),
        config: config
          ? {
              enabled: config.enabled,
              pointsPerCurrency: config.pointsPerCurrency,
              currencyPerPoint: config.currencyPerPoint,
              minPointsToRedeem: config.minPointsToRedeem,
              maxRedeemablePercent: config.maxRedeemablePercent,
              allowCouponStacking: config.allowCouponStacking,
            }
          : null,
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch customer loyalty details" });
    }
  });

  app.get("/customer/loyalty/history", async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const restaurantId = Number(req.query?.restaurantId || 0);
      let customerRecord = null;

      if (restaurantId) {
        customerRecord = await prisma.customer.findUnique({
          where: { restaurantId_phone: { restaurantId, phone } },
        });
      } else {
        customerRecord = await prisma.customer.findFirst({
          where: { phone },
          orderBy: { updatedAt: "desc" },
        });
      }

      if (!customerRecord) return { transactions: [] };

      const account = await getOrCreateLoyaltyAccount({
        db: prisma,
        restaurantId: customerRecord.restaurantId,
        customerId: customerRecord.id,
      });

      if (!account) return { transactions: [] };

      const history = await listLoyaltyHistory({
        db: prisma,
        loyaltyAccountId: account.id,
        limit: 50,
      });

      return { transactions: history };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch loyalty history" });
    }
  });

  // ==========================================
  // FEATURE 15: CUSTOMER AVAILABLE PROMOTIONS
  // ==========================================
  app.get("/customer/promotions", async (req, reply) => {
    try {
      const restaurantId = Number(req.query?.restaurantId || 0);
      const slug = req.query?.slug;

      let rId = restaurantId;
      if (!rId && slug) {
        const rest = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
        if (rest) rId = rest.id;
      }

      const now = new Date();
      const promotions = await prisma.promotion.findMany({
        where: {
          ...(rId ? { restaurantId: rId } : {}),
          active: true,
          OR: [{ startDate: null }, { startDate: { lte: now } }],
          AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
        },
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          discountType: true,
          discountValue: true,
          minSubtotalSubunit: true,
          maxDiscountSubunit: true,
          endDate: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const formatted = promotions.map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title,
        description: p.description,
        discountType: p.discountType,
        discountValue: p.discountValue,
        minOrderAmount: fromSubunit(p.minSubtotalSubunit || 0),
        maxDiscountAmount: p.maxDiscountSubunit ? fromSubunit(p.maxDiscountSubunit) : null,
        expiresAt: p.endDate,
      }));

      return { promotions: formatted };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch promotions" });
    }
  });

  // ==========================================
  // FEATURE 15: CUSTOMER RESERVATIONS
  // ==========================================
  app.get("/customer/reservations", async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const reservations = await prisma.reservation.findMany({
        where: { phone },
        include: {
          restaurant: { select: { id: true, name: true, slug: true } },
          table: { select: { id: true, tableNo: true } },
        },
        orderBy: { reservationTime: "desc" },
      });

      return { reservations };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch customer reservations" });
    }
  });

  // ==========================================
  // FEATURE 15: SINGLE ORDER DETAILS WITH OWNERSHIP CHECK
  // ==========================================
  app.get("/customer/orders/:orderId", async (req, reply) => {
    try {
      const orderId = Number(req.params.orderId);
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          restaurant: { select: { id: true, name: true, slug: true, logoUrl: true, address: true, city: true, phone: true } },
          items: { include: { menuItem: { select: { id: true, name: true, imageUrl: true } } } },
          statusEvents: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!order) return reply.code(404).send({ message: "Order not found" });

      if (normalizePhone(order.phone) !== normalizePhone(phone)) {
        return reply.code(403).send({ message: "Access denied. Order belongs to another customer." });
      }

      return { order };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch order details" });
    }
  });

  // ==========================================
  // FEATURE 15: REORDER API
  // ==========================================
  app.post("/customer/orders/:orderId/reorder", async (req, reply) => {
    try {
      const orderId = Number(req.params.orderId);
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const pastOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          restaurant: { select: { id: true, slug: true, name: true } },
        },
      });

      if (!pastOrder) return reply.code(404).send({ message: "Order not found" });

      if (normalizePhone(pastOrder.phone) !== normalizePhone(phone)) {
        return reply.code(403).send({ message: "Access denied" });
      }

      const itemIds = pastOrder.items.map((i) => i.menuItemId).filter(Boolean);
      const currentMenuItems = await prisma.menuItem.findMany({
        where: {
          restaurantId: pastOrder.restaurantId,
          id: { in: itemIds },
          isAvailable: true,
        },
      });

      const currentItemMap = new Map(currentMenuItems.map((item) => [item.id, item]));

      const cartItems = [];
      const warnings = [];

      for (const oldItem of pastOrder.items) {
        const currentItem = oldItem.menuItemId ? currentItemMap.get(oldItem.menuItemId) : null;
        if (!currentItem) {
          warnings.push(`"${oldItem.itemName}" is no longer available.`);
          continue;
        }

        const currentPrice = Number(currentItem.price);
        const oldPrice = Number(oldItem.price);
        if (currentPrice !== oldPrice) {
          warnings.push(`Price for "${currentItem.name}" updated from ₹${oldPrice} to ₹${currentPrice}.`);
        }

        cartItems.push({
          id: currentItem.id,
          menuItemId: currentItem.id,
          name: currentItem.name,
          price: currentPrice,
          quantity: Math.max(1, oldItem.qty || 1),
          image: currentItem.imageUrl,
        });
      }

      return {
        ok: true,
        restaurant: pastOrder.restaurant,
        items: cartItems,
        warnings,
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to process reorder" });
    }
  });
}

