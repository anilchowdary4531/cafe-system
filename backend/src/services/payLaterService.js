import crypto from "node:crypto";
import { normalizePhone, getPhoneVariants } from "./phoneService.js";
import { toSubunit } from "./moneyService.js";

const razorpayAuthHeader = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return { keyId, header: `Basic ${token}` };
};

const createRazorpayOrder = async ({ amountSubunit, currency, receipt, notes }) => {
  const auth = razorpayAuthHeader();
  if (!auth) {
    const err = new Error("razorpay_not_configured");
    err.code = "razorpay_not_configured";
    throw err;
  }

  if (typeof fetch !== "function") {
    const err = new Error("fetch_unavailable");
    err.code = "fetch_unavailable";
    throw err;
  }

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: auth.header,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number(amountSubunit),
      currency: String(currency || "INR"),
      receipt: receipt ? String(receipt).slice(0, 40) : undefined,
      notes: notes && typeof notes === "object" ? notes : undefined,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload?.error?.description || "razorpay_order_failed");
    err.code = "razorpay_order_failed";
    err.details = payload;
    throw err;
  }

  return { keyId: auth.keyId, order: payload };
};

/**
 * Calculates loyalty points based on repayment timing relative to a ₹500 base amount:
 * - Paid within 15 days: +20 points per ₹500
 * - Paid within 30 days (16-30 days): +10 points per ₹500
 * - After 30 days: -3 points per week overdue per ₹500
 * Point values scale dynamically with repaid/pending amount (amount / 500).
 */
export const calculatePayLaterLoyaltyPoints = ({ repaidAmount, creditDate, paymentDate = new Date() }) => {
  const amount = Number(repaidAmount || 0);
  if (amount <= 0) return 0;

  const start = creditDate ? new Date(creditDate) : new Date();
  const end = new Date(paymentDate);
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Multiplier relative to base ₹500
  const multiplier = amount / 500;

  if (daysElapsed <= 15) {
    // Paid within 15 days -> +20 points per ₹500
    return Math.max(1, Math.round(20 * multiplier));
  } else if (daysElapsed <= 30) {
    // Paid within 16 to 30 days -> +10 points per ₹500
    return Math.max(1, Math.round(10 * multiplier));
  } else {
    // Overdue after 30 days -> -3 points per week overdue per ₹500
    const overdueDays = daysElapsed - 30;
    const overdueWeeks = Math.max(1, Math.floor(overdueDays / 7));
    const pointsDeducted = Math.round(3 * overdueWeeks * multiplier);
    return -pointsDeducted;
  }
};

export const checkPayLaterEligibility = async ({ prisma, phone, restaurantSlug }) => {
  const normPhone = normalizePhone(phone);
  const variants = getPhoneVariants(phone);
  if (!normPhone && variants.length === 0) return { eligible: false };

  const account = await prisma.payLaterAccount.findFirst({
    where: {
      restaurant: { slug: restaurantSlug },
      customer: {
        phone: { in: variants },
      },
    },
    select: { id: true, status: true, pendingBalance: true },
  });

  if (!account || account.status !== "ACTIVE") {
    return { eligible: false };
  }

  return { eligible: true, accountId: account.id, pendingBalance: account.pendingBalance };
};

export const addCustomerToPayLater = async ({ prisma, restaurantId, phone, actor }) => {
  const normPhone = normalizePhone(phone);
  const variants = getPhoneVariants(phone);
  if (!normPhone && variants.length === 0) {
    const err = new Error("invalid_phone");
    err.code = "invalid_phone";
    throw err;
  }

  // 1. Authorization: Only allow staff/owners of this restaurant
  if (actor?.restaurantId && Number(actor.restaurantId) !== Number(restaurantId) && actor.role !== "SUPER_ADMIN") {
    const err = new Error("restaurant_access_denied");
    err.code = "restaurant_access_denied";
    throw err;
  }

  // 2. Look up global CustomerAccount by phone variants or email
  let globalAccount = await prisma.customerAccount.findFirst({
    where: {
      OR: [
        { phone: { in: variants } },
        ...(phone?.includes("@") ? [{ email: phone.toLowerCase() }] : []),
      ],
    },
  });

  if (!globalAccount) {
    const err = new Error("customer_not_found");
    err.code = "customer_not_found";
    throw err;
  }

  const matchedPhone = globalAccount.phone || normPhone;

  // 3. Upsert restaurant-scoped Customer record
  let customer = await prisma.customer.findFirst({
    where: {
      restaurantId,
      OR: [
        { phone: { in: getPhoneVariants(matchedPhone) } },
        ...(globalAccount.email ? [{ email: globalAccount.email }] : []),
      ],
    },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        restaurantId,
        phone: matchedPhone,
        name: globalAccount.name,
        email: globalAccount.email,
      },
    });
  }

  // 4. Create PayLaterAccount
  try {
    const account = await prisma.payLaterAccount.create({
      data: {
        restaurantId,
        customerId: customer.id,
        status: "ACTIVE",
      },
      include: {
        customer: true,
      },
    });
    return account;
  } catch (e) {
    if (e.code === "P2002") {
      const err = new Error("already_exists");
      err.code = "already_exists";
      throw err;
    }
    throw e;
  }
};

export const getRestaurantPayLaterCustomers = async ({ prisma, restaurantId, actor }) => {
  if (actor?.restaurantId && Number(actor.restaurantId) !== Number(restaurantId) && actor.role !== "SUPER_ADMIN") {
    const err = new Error("restaurant_access_denied");
    err.code = "restaurant_access_denied";
    throw err;
  }

  const accounts = await prisma.payLaterAccount.findMany({
    where: { restaurantId },
    include: {
      customer: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return accounts.map((acc) => ({
    id: acc.id,
    customerId: acc.customerId,
    name: acc.customer.name || "Customer",
    phone: acc.customer.phone,
    totalBorrowed: acc.totalBorrowed,
    totalPaid: acc.totalPaid,
    pendingBalance: acc.pendingBalance,
    status: acc.status,
    lastTransactionDate: acc.transactions[0]?.createdAt || acc.updatedAt,
  }));
};

export const getCustomerPayLaterAccounts = async ({ prisma, phone, customerAccountId }) => {
  let customerAccount = null;

  if (customerAccountId) {
    customerAccount = await prisma.customerAccount.findUnique({
      where: { id: Number(customerAccountId) },
    });
  }

  if (!customerAccount && phone) {
    const variants = getPhoneVariants(phone);
    customerAccount = await prisma.customerAccount.findFirst({
      where: {
        OR: [
          { phone: { in: variants } },
          ...(phone.includes("@") ? [{ email: phone.toLowerCase() }] : []),
        ],
      },
    });
  }

  const phoneVariantsSet = new Set();
  const emailSet = new Set();

  if (phone) {
    getPhoneVariants(phone).forEach((v) => phoneVariantsSet.add(v));
    if (phone.includes("@")) emailSet.add(phone.toLowerCase());
  }

  if (customerAccount) {
    if (customerAccount.phone) {
      getPhoneVariants(customerAccount.phone).forEach((v) => phoneVariantsSet.add(v));
      if (customerAccount.phone.includes("@")) emailSet.add(customerAccount.phone.toLowerCase());
    }
    if (customerAccount.email) {
      emailSet.add(customerAccount.email.toLowerCase());
    }
  }

  const phoneList = Array.from(phoneVariantsSet);
  const emailList = Array.from(emailSet);

  if (phoneList.length === 0 && emailList.length === 0) return [];

  const accounts = await prisma.payLaterAccount.findMany({
    where: {
      status: "ACTIVE",
      customer: {
        OR: [
          ...(phoneList.length > 0 ? [{ phone: { in: phoneList } }] : []),
          ...(emailList.length > 0 ? [{ email: { in: emailList } }] : []),
        ],
      },
    },
    include: {
      customer: {
        select: { id: true, rewardPoints: true },
      },
      restaurant: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return accounts.map((acc) => ({
    accountId: acc.id,
    restaurantId: acc.restaurant.id,
    restaurantName: acc.restaurant.name,
    restaurantSlug: acc.restaurant.slug,
    totalBorrowed: acc.totalBorrowed,
    totalPaid: acc.totalPaid,
    pendingBalance: acc.pendingBalance,
    rewardPoints: acc.customer?.rewardPoints || 0,
  }));
};

export const getPayLaterAccountDetails = async ({ prisma, accountId, actor }) => {
  const account = await prisma.payLaterAccount.findUnique({
    where: { id: Number(accountId) },
    include: {
      customer: true,
      restaurant: {
        select: { name: true, slug: true },
      },
      transactions: {
        where: { status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            include: {
              items: true,
            },
          },
        },
      },
    },
  });

  if (!account) {
    const err = new Error("account_not_found");
    err.code = "account_not_found";
    throw err;
  }

  // Auth check: Customer must match the account owner. Staff must belong to the restaurant.
  if (actor.type === "customer") {
    const actorVariants = new Set(getPhoneVariants(actor.phone));
    if (actor.email) actorVariants.add(actor.email.toLowerCase());

    const isOwner =
      actorVariants.has(account.customer.phone) ||
      (account.customer.email && actorVariants.has(account.customer.email.toLowerCase())) ||
      (actor.phone && normalizePhone(account.customer.phone).includes(normalizePhone(actor.phone))) ||
      (actor.phone && normalizePhone(actor.phone).includes(normalizePhone(account.customer.phone)));

    if (!isOwner) {
      const err = new Error("access_denied");
      err.code = "access_denied";
      throw err;
    }
  } else {
    if (actor.restaurantId && Number(actor.restaurantId) !== Number(account.restaurantId) && actor.role !== "SUPER_ADMIN") {
      const err = new Error("access_denied");
      err.code = "access_denied";
      throw err;
    }
  }

  return account;
};

export const adjustPayLaterBalance = async ({ prisma, restaurantId, customerId, type, amount, description, actor }) => {
  const cleanAmount = Number(amount);
  if (Number.isNaN(cleanAmount) || cleanAmount <= 0) {
    const err = new Error("invalid_amount");
    err.code = "invalid_amount";
    throw err;
  }

  if (actor.restaurantId && Number(actor.restaurantId) !== Number(restaurantId) && actor.role !== "SUPER_ADMIN") {
    const err = new Error("access_denied");
    err.code = "access_denied";
    throw err;
  }

  const account = await prisma.payLaterAccount.findFirst({
    where: { restaurantId, customerId },
  });

  if (!account) {
    const err = new Error("account_not_found");
    err.code = "account_not_found";
    throw err;
  }

  const allowedTypes = ["MANUAL_CREDIT", "OFFLINE_REPAYMENT", "ADJUSTMENT"];
  if (!allowedTypes.includes(type)) {
    const err = new Error("invalid_transaction_type");
    err.code = "invalid_transaction_type";
    throw err;
  }

  const createdBy = `${actor.role} (ID: ${actor.userId})`;

  return await prisma.$transaction(async (tx) => {
    // 1. Create Transaction Ledger entry
    const transaction = await tx.payLaterTransaction.create({
      data: {
        accountId: account.id,
        restaurantId,
        customerId,
        type,
        amount: cleanAmount,
        description: description || null,
        status: "SUCCESS",
        createdBy,
      },
    });

    // 2. Calculate balance updates
    let borrowDelta = 0;
    let payDelta = 0;
    let balanceDelta = 0;
    let pointsDelta = 0;

    if (type === "MANUAL_CREDIT") {
      borrowDelta = cleanAmount;
      balanceDelta = cleanAmount;
    } else if (type === "OFFLINE_REPAYMENT") {
      payDelta = cleanAmount;
      balanceDelta = -cleanAmount;

      const oldestCredit = await tx.payLaterTransaction.findFirst({
        where: {
          accountId: account.id,
          status: "SUCCESS",
          type: { in: ["MANUAL_CREDIT", "FOOD_ORDER", "ADJUSTMENT"] },
        },
        orderBy: { createdAt: "asc" },
      });
      const creditDate = oldestCredit?.createdAt || account.createdAt;
      pointsDelta = calculatePayLaterLoyaltyPoints({ repaidAmount: cleanAmount, creditDate });
    } else if (type === "ADJUSTMENT") {
      borrowDelta = cleanAmount;
      balanceDelta = cleanAmount;
    }

    if (pointsDelta !== 0 && account.customerId) {
      const currentPoints = Number(account.customer?.rewardPoints || 0);
      const newPoints = Math.max(0, currentPoints + pointsDelta);
      await tx.customer.update({
        where: { id: account.customerId },
        data: { rewardPoints: newPoints },
      });
    }

    const updatedAccount = await tx.payLaterAccount.update({
      where: { id: account.id },
      data: {
        totalBorrowed: { increment: borrowDelta },
        totalPaid: { increment: payDelta },
        pendingBalance: { increment: balanceDelta },
      },
    });

    return { transaction, account: updatedAccount, pointsDelta };
  });
};

export const createPayLaterRepayment = async ({ prisma, accountId, amount, actor }) => {
  const cleanAmount = Number(amount);
  if (Number.isNaN(cleanAmount) || cleanAmount <= 0) {
    const err = new Error("invalid_amount");
    err.code = "invalid_amount";
    throw err;
  }

  const account = await prisma.payLaterAccount.findUnique({
    where: { id: Number(accountId) },
    include: { customer: true },
  });

  if (!account) {
    const err = new Error("account_not_found");
    err.code = "account_not_found";
    throw err;
  }

  if (normalizePhone(account.customer.phone) !== normalizePhone(actor.phone)) {
    const err = new Error("access_denied");
    err.code = "access_denied";
    throw err;
  }

  if (cleanAmount > account.pendingBalance) {
    const err = new Error("amount_exceeds_balance");
    err.code = "amount_exceeds_balance";
    throw err;
  }

  // Create Razorpay order
  const amountSubunit = toSubunit(cleanAmount);
  const rzp = await createRazorpayOrder({
    amountSubunit,
    currency: "INR",
    receipt: `repay-${account.id}-${Date.now()}`,
    notes: { accountId: String(account.id) },
  });

  // Save PENDING transaction
  const transaction = await prisma.payLaterTransaction.create({
    data: {
      accountId: account.id,
      restaurantId: account.restaurantId,
      customerId: account.customerId,
      type: "ONLINE_REPAYMENT",
      amount: cleanAmount,
      status: "PENDING",
      paymentReference: rzp.order.id,
      createdBy: "Customer",
      description: "Razorpay Online Repayment",
    },
  });

  return { keyId: rzp.keyId, order: rzp.order, transactionId: transaction.id };
};

export const verifyPayLaterRepayment = async ({ prisma, accountId, input, actor }) => {
  const body = input || {};
  const rzpOrderId = String(body.razorpayOrderId || body.razorpay_order_id || "");
  const rzpPaymentId = String(body.razorpayPaymentId || body.razorpay_payment_id || "");
  const rzpSignature = String(body.razorpaySignature || body.razorpay_signature || "");

  if (!rzpOrderId || !rzpPaymentId || !rzpSignature) {
    const err = new Error("razorpay_fields_required");
    err.code = "razorpay_fields_required";
    throw err;
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    const err = new Error("razorpay_not_configured");
    err.code = "razorpay_not_configured";
    throw err;
  }

  const account = await prisma.payLaterAccount.findUnique({
    where: { id: Number(accountId) },
    include: { customer: true },
  });

  if (!account) {
    const err = new Error("account_not_found");
    err.code = "account_not_found";
    throw err;
  }

  if (normalizePhone(account.customer.phone) !== normalizePhone(actor.phone)) {
    const err = new Error("access_denied");
    err.code = "access_denied";
    throw err;
  }

  // 1. Find the pending transaction
  const pendingTx = await prisma.payLaterTransaction.findFirst({
    where: {
      accountId: account.id,
      type: "ONLINE_REPAYMENT",
      paymentReference: rzpOrderId,
      status: "PENDING",
    },
  });

  if (!pendingTx) {
    const err = new Error("transaction_not_found");
    err.code = "transaction_not_found";
    throw err;
  }

  // 2. Cryptographic signature check
  const generated = crypto.createHmac("sha256", secret).update(`${rzpOrderId}|${rzpPaymentId}`).digest("hex");
  const a = Buffer.from(generated);
  const b = Buffer.from(rzpSignature);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    await prisma.payLaterTransaction.update({
      where: { id: pendingTx.id },
      data: { status: "FAILED" },
    });
    const err = new Error("invalid_signature");
    err.code = "invalid_signature";
    throw err;
  }

  // 3. Mark successful repayment and update balance in a transaction
  return await prisma.$transaction(async (tx) => {
    const oldestCredit = await tx.payLaterTransaction.findFirst({
      where: {
        accountId: account.id,
        status: "SUCCESS",
        type: { in: ["MANUAL_CREDIT", "FOOD_ORDER", "ADJUSTMENT"] },
      },
      orderBy: { createdAt: "asc" },
    });
    const creditDate = oldestCredit?.createdAt || account.createdAt;
    const pointsDelta = calculatePayLaterLoyaltyPoints({ repaidAmount: pendingTx.amount, creditDate });

    if (pointsDelta !== 0 && account.customerId) {
      const currentPoints = Number(account.customer?.rewardPoints || 0);
      const newPoints = Math.max(0, currentPoints + pointsDelta);
      await tx.customer.update({
        where: { id: account.customerId },
        data: { rewardPoints: newPoints },
      });
    }

    const transaction = await tx.payLaterTransaction.update({
      where: { id: pendingTx.id },
      data: {
        status: "SUCCESS",
        paymentReference: rzpPaymentId, // update with payment ID
      },
    });

    const updatedAccount = await tx.payLaterAccount.update({
      where: { id: account.id },
      data: {
        totalPaid: { increment: pendingTx.amount },
        pendingBalance: { decrement: pendingTx.amount },
      },
    });

    return { transaction, account: updatedAccount, pointsDelta };
  });
};

export const adjustRewardPoints = async ({ prisma, restaurantId, customerId, points, actor }) => {
  if (actor?.restaurantId && Number(actor.restaurantId) !== Number(restaurantId) && actor.role !== "SUPER_ADMIN") {
    const err = new Error("restaurant_access_denied");
    err.code = "restaurant_access_denied";
    throw err;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
  });

  if (!customer) {
    const err = new Error("customer_not_found");
    err.code = "customer_not_found";
    throw err;
  }

  const updatedCustomer = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      rewardPoints: { increment: Number(points) },
    },
  });

  // Also create a notification informing the customer about points change!
  await prisma.customerNotification.create({
    data: {
      restaurantId,
      customerId,
      title: "Loyalty Points Update",
      message: `${points >= 0 ? "Credited" : "Debited"} ${Math.abs(points)} reward points. Your new balance is ${updatedCustomer.rewardPoints} points.`,
    },
  });

  return updatedCustomer;
};

export const sendDueReminder = async ({ prisma, restaurantId, customerId, title, message, actor }) => {
  if (actor?.restaurantId && Number(actor.restaurantId) !== Number(restaurantId) && actor.role !== "SUPER_ADMIN") {
    const err = new Error("restaurant_access_denied");
    err.code = "restaurant_access_denied";
    throw err;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
  });

  if (!customer) {
    const err = new Error("customer_not_found");
    err.code = "customer_not_found";
    throw err;
  }

  const notification = await prisma.customerNotification.create({
    data: {
      restaurantId,
      customerId,
      title: title || "Payment Due Reminder",
      message: message || "You have an outstanding credit balance. Please clear it at your earliest convenience.",
    },
  });

  return notification;
};

export const getCustomerNotifications = async ({ prisma, phone }) => {
  const normPhone = normalizePhone(phone);
  if (!normPhone) return [];

  const dbNotifications = await prisma.customerNotification.findMany({
    where: {
      customer: { phone: normPhone },
    },
    include: {
      restaurant: {
        select: { name: true, slug: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Map to the format expected by the Android app
  return dbNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.message,
    type: "promotion", // Default type since it's not in DB yet
    isRead: n.read,
    createdAt: n.createdAt,
    metadata: {
      restaurantId: String(n.restaurantId),
      restaurantName: n.restaurant?.name || "",
    },
  }));
};

export const markNotificationRead = async ({ prisma, notificationId, phone }) => {
  const normPhone = normalizePhone(phone);
  if (!normPhone) {
    const err = new Error("invalid_phone");
    err.code = "invalid_phone";
    throw err;
  }

  const notification = await prisma.customerNotification.findFirst({
    where: {
      id: notificationId,
      customer: { phone: normPhone },
    },
  });

  if (!notification) {
    const err = new Error("notification_not_found");
    err.code = "notification_not_found";
    throw err;
  }

  return prisma.customerNotification.update({
    where: { id: notification.id },
    data: { read: true },
  });
};

export const processWeeklyOverduePayLaterPenalties = async ({ prisma }) => {
  const overdueAccounts = await prisma.payLaterAccount.findMany({
    where: {
      status: "ACTIVE",
      pendingBalance: { gt: 0 },
    },
    include: {
      customer: true,
      transactions: {
        where: { status: "SUCCESS", type: { in: ["MANUAL_CREDIT", "FOOD_ORDER", "ADJUSTMENT"] } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const now = new Date();
  let penalizedCount = 0;

  for (const acc of overdueAccounts) {
    const creditDate = acc.transactions[0]?.createdAt || acc.createdAt;
    const diffTime = Math.max(0, now.getTime() - new Date(creditDate).getTime());
    const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (daysElapsed > 30) {
      const overdueDays = daysElapsed - 30;
      const overdueWeeks = Math.max(1, Math.floor(overdueDays / 7));
      const multiplier = Number(acc.pendingBalance) / 500;
      const penaltyPoints = Math.round(3 * overdueWeeks * multiplier);

      if (penaltyPoints > 0 && acc.customerId) {
        const currentPoints = Number(acc.customer?.rewardPoints || 0);
        const newPoints = Math.max(0, currentPoints - penaltyPoints);

        await prisma.customer.update({
          where: { id: acc.customerId },
          data: { rewardPoints: newPoints },
        });

        penalizedCount++;
      }
    }
  }

  return { penalizedCount };
};
