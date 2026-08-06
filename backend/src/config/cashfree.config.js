import { Cashfree, CFEnvironment } from "cashfree-pg";

/**
 * Configure Cashfree Payment Gateway SDK
 * Environment: TEST (SANDBOX) or PRODUCTION
 */
export const initCashfree = () => {
  const env = String(process.env.CASHFREE_ENV || "TEST").trim().toUpperCase();
  const clientId = String(process.env.CASHFREE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CASHFREE_CLIENT_SECRET || "").trim();

  Cashfree.XClientId = clientId;
  Cashfree.XClientSecret = clientSecret;
  Cashfree.XEnvironment = env === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;

  return {
    env,
    clientId,
    isConfigured: Boolean(clientId && clientSecret),
  };
};

export const CASHFREE_API_VERSION = "2023-08-01";

export const getCashfreeInstance = () => {
  initCashfree();
  return new Cashfree();
};
