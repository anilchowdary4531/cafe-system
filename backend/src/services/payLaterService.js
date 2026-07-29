import crypto from "node:crypto";
import { normalizePhone } from "./phoneService.js";
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

export const checkPayLaterEligibility = async ({ prisma, phone, restaurantSlug }) => {
  const normPhone = normalizePhone(phone);
  if (!normPhone) return { eligible: false };

  const account = await prisma.payLaterAccount.findFirst({
    where: {
      customer: { phone: normPhone },
      restaurant: { slug: restaurantSlug },
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
  if (!normPhone) {
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

  // 2. Look up global CustomerAccount
  const globalAccount = await prisma.customerAccount.findUnique({
    where: { phone: normPhone },
  });

  if (!globalAccount) {
    const err = new Error("customer_not_found");
    err.code = "customer_not_found";
    throw err;
  }

  // 3. Upsert restaurant-scoped Customer record
  let customer = await prisma.customer.findUnique({
    where: { restaurantId_phone: { restaurantId, phone: normPhone } },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        restaurantId,
        phone: normPhone,
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

export const getCustomerPayLaterAccounts = async ({ prisma, phone }) => {
  const normPhone = normalizePhone(phone);
  if (!normPhone) return [];

  const accounts = await prisma.payLaterAccount.findMany({
    where: {
      customer: { phone: normPhone },
      status: "ACTIVE",
    },
    include: {
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
    if (normalizePhone(account.customer.phone) !== normalizePhone(actor.phone)) {
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

    if (type === "MANUAL_CREDIT") {
      borrowDelta = cleanAmount;
      balanceDelta = cleanAmount;
    } else if (type === "OFFLINE_REPAYMENT") {
      payDelta = cleanAmount;
      balanceDelta = -cleanAmount;
    } else if (type === "ADJUSTMENT") {
      borrowDelta = cleanAmount;
      balanceDelta = cleanAmount;
    }

    const updatedAccount = await tx.payLaterAccount.update({
      where: { id: account.id },
      data: {
        totalBorrowed: { increment: borrowDelta },
        totalPaid: { increment: payDelta },
        pendingBalance: { increment: balanceDelta },
      },
    });

    return { transaction, account: updatedAccount };
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

    return { transaction, account: updatedAccount };
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

  return prisma.customerNotification.findMany({
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
