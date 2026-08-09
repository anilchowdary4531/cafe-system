import { Cashfree, CFEnvironment } from "cashfree-pg";

/**
 * Mask sensitive secrets in logs
 */
export const maskSecret = (secret) => {
  if (!secret) return "NOT_SET";
  const str = String(secret).trim();
  if (str.length <= 8) return "****";
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
};

/**
 * Configure Cashfree Payment Gateway SDK
 * Environment: TEST (SANDBOX) or PRODUCTION
 */
export const initCashfree = () => {
  const env = String(process.env.CASHFREE_ENV || "TEST").trim().toUpperCase();
  const clientId = String(process.env.CASHFREE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CASHFREE_CLIENT_SECRET || "").trim();

  const isProduction = env === "PRODUCTION" || env === "PROD" || env === "LIVE";

  Cashfree.XClientId = clientId;
  Cashfree.XClientSecret = clientSecret;
  Cashfree.XEnvironment = isProduction ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;

  const isConfigured = Boolean(clientId && clientSecret);

  if (isProduction && (!clientId || !clientSecret)) {
    console.error("[CashfreeConfig] CRITICAL WARNING: CASHFREE_ENV is PRODUCTION but API credentials are missing!");
  }

  return {
    env,
    isProduction,
    clientId,
    clientSecret,
    clientIdMasked: maskSecret(clientId),
    clientSecretMasked: maskSecret(clientSecret),
    isConfigured,
  };
};

export const CASHFREE_API_VERSION = "2023-08-01";

export const getCashfreeInstance = () => {
  initCashfree();
  return new Cashfree();
};

