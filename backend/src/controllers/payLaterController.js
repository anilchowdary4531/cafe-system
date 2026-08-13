import * as payLaterService from "../services/payLaterService.js";
import { requireCustomerPhoneFromJwt } from "../services/customerProfileService.js";

const mapError = (err, reply) => {
  const code = err.code || "";
  if (code === "restaurant_access_denied" || code === "access_denied" || code === "insufficient_role") {
    return reply.code(403).send({ message: err.message || "Access denied" });
  }
  if (code === "account_not_found" || code === "customer_not_found" || code === "transaction_not_found") {
    return reply.code(404).send({ message: err.message || "Not found" });
  }
  if (code === "already_exists" || code === "invalid_amount" || code === "amount_exceeds_balance" || code === "invalid_signature") {
    return reply.code(400).send({ message: err.message || "Bad request" });
  }
  return reply.code(500).send({ message: err.message || "Internal server error" });
};

export const buildPayLaterController = ({ prisma }) => {
  // ==========================================
  // Owner Endpoints
  // ==========================================

  const getCustomers = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const actor = req.staffActor;
      const customers = await payLaterService.getRestaurantPayLaterCustomers({ prisma, restaurantId, actor });
      return { customers };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const addCustomer = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { phone } = req.body || {};
      const actor = req.staffActor;
      const account = await payLaterService.addCustomerToPayLater({ prisma, restaurantId, phone, actor });
      return { message: "Customer added to Pay Later", account };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const adjustBalance = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const customerId = Number(req.params.customerId);
      const { type, amount, description } = req.body || {};
      const actor = req.staffActor;
      const result = await payLaterService.adjustPayLaterBalance({
        prisma,
        restaurantId,
        customerId,
        type,
        amount,
        description,
        actor,
      });
      return { message: "Balance adjusted successfully", ...result };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  // ==========================================
  // Customer Endpoints
  // ==========================================

  const getEligibility = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const { slug } = req.query || {};
      if (!slug) return reply.code(400).send({ message: "Restaurant slug is required" });

      const eligibility = await payLaterService.checkPayLaterEligibility({ prisma, phone, restaurantSlug: slug });
      return eligibility;
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const getAccounts = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      const customerAccountId = req.user?.customerAccountId;
      if (!phone && !customerAccountId) return reply.code(401).send({ message: "Authentication required" });

      const accounts = await payLaterService.getCustomerPayLaterAccounts({ prisma, phone, customerAccountId });
      return { accounts };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const getDetails = async (req, reply) => {
    try {
      const accountId = Number(req.params.accountId);
      let actor = null;

      if (req.staffActor) {
        actor = req.staffActor;
      } else {
        const phone = await requireCustomerPhoneFromJwt(req, prisma);
        if (phone) {
          actor = { type: "customer", phone };
        }
      }

      if (!actor) {
        return reply.code(401).send({ message: "Authentication required" });
      }

      const account = await payLaterService.getPayLaterAccountDetails({ prisma, accountId, actor });
      return { account };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const repay = async (req, reply) => {
    try {
      let accountId = Number(req.params.accountId);
      const { amount } = req.body || {};
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      if (!accountId) {
        // Find first account for this customer if none specified (for wallet recharge)
        const accounts = await payLaterService.getCustomerPayLaterAccounts({ prisma, phone });
        if (!accounts.length) return reply.code(404).send({ message: "No wallet account found" });
        accountId = accounts[0].accountId;
      }

      const actor = { type: "customer", phone };
      const repayment = await payLaterService.createPayLaterRepayment({ prisma, accountId, amount, actor });
      return repayment;
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const verifyRepay = async (req, reply) => {
    try {
      let accountId = Number(req.params.accountId);
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      if (!accountId) {
        // If it's a wallet verify, the razorpay order id is in the body, we can find the transaction and account from there
        const body = req.body || {};
        const rzpOrderId = String(body.razorpayOrderId || body.razorpay_order_id || "");
        const pendingTx = await prisma.payLaterTransaction.findFirst({
          where: { paymentReference: rzpOrderId, status: "PENDING" }
        });
        if (!pendingTx) return reply.code(404).send({ message: "Transaction not found" });
        accountId = pendingTx.accountId;
      }

      const actor = { type: "customer", phone };
      const result = await payLaterService.verifyPayLaterRepayment({ prisma, accountId, input: req.body, actor });
      return { message: "Repayment successful", ...result };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const adjustPoints = async (req, reply) => {
    try {
      const customerId = Number(req.params.customerId);
      const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
      const { points } = req.body || {};
      const actor = req.staffActor;

      if (points === undefined || points === null) return reply.code(400).send({ message: "Points value is required" });

      const customer = await payLaterService.adjustRewardPoints({ prisma, restaurantId, customerId, points, actor });
      return { message: "Reward points adjusted successfully", customer };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const sendReminder = async (req, reply) => {
    try {
      const customerId = Number(req.params.customerId);
      const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId || 0);
      const { title, message } = req.body || {};
      const actor = req.staffActor;

      const notification = await payLaterService.sendDueReminder({ prisma, restaurantId, customerId, title, message, actor });
      return { message: "Intimation notification sent successfully", notification };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const getNotifications = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const notifications = await payLaterService.getCustomerNotifications({ prisma, phone });
      return { notifications };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const readNotification = async (req, reply) => {
    try {
      const notificationId = Number(req.params.notificationId);
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const notification = await payLaterService.markNotificationRead({ prisma, notificationId, phone });
      return { message: "Notification marked read", notification };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  const getWalletHistory = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (!phone) return reply.code(401).send({ message: "Authentication required" });

      const accounts = await payLaterService.getCustomerPayLaterAccounts({ prisma, phone });
      if (!accounts.length) {
        return { balance: 0, transactions: [] };
      }

      // Aggregate all accounts for this phone
      const totalBalance = accounts.reduce((sum, acc) => sum + (acc.totalPaid - acc.totalBorrowed), 0);

      const accountIds = accounts.map(a => a.accountId);
      const transactions = await prisma.payLaterTransaction.findMany({
        where: { accountId: { in: accountIds }, status: "SUCCESS" },
        orderBy: { createdAt: "desc" }
      });

      const mappedTransactions = transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: (t.type.includes("REPAYMENT") || t.type.includes("CASHBACK")) ? "credit" : "debit",
        description: t.description || t.type.replace(/_/g, " "),
        createdAt: t.createdAt
      }));

      return { balance: totalBalance, transactions: mappedTransactions };
    } catch (err) {
      return mapError(err, reply);
    }
  };

  return {
    getCustomers,
    addCustomer,
    adjustBalance,
    getEligibility,
    getAccounts,
    getDetails,
    repay,
    verifyRepay,
    adjustPoints,
    sendReminder,
    getNotifications,
    readNotification,
    getWalletHistory,
  };
};
