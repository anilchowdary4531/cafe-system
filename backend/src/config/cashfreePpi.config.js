/**
 * Cashfree PPI (Prepaid Payment Instruments) Configuration Module Skeleton
 *
 * NOTE: This is a preparation configuration module for future Cashfree PPI closed-loop wallet.
 * Cashfree Onboarding Ticket ID: 8374090 (Pending approval & credentials).
 *
 * Supported Environment Variables:
 * - CASHFREE_PPI_CLIENT_ID
 * - CASHFREE_PPI_CLIENT_SECRET
 * - CASHFREE_PPI_PROGRAM_ID
 * - CASHFREE_PPI_ENV (SANDBOX | PRODUCTION)
 */

export const PPI_ENVIRONMENTS = {
  SANDBOX: "https://sandbox.cashfree.com/ppi",
  PRODUCTION: "https://api.cashfree.com/ppi",
};

/**
 * Get Cashfree PPI Base URL based on environment configuration
 * @returns {string}
 */
export const getPpiBaseUrl = () => {
  const env = String(process.env.CASHFREE_PPI_ENV || "SANDBOX").trim().toUpperCase();
  return env === "PRODUCTION" ? PPI_ENVIRONMENTS.PRODUCTION : PPI_ENVIRONMENTS.SANDBOX;
};

/**
 * Check whether Cashfree PPI is fully configured with required credentials
 * @returns {boolean}
 */
export const isPpiConfigured = () => {
  const clientId = String(process.env.CASHFREE_PPI_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CASHFREE_PPI_CLIENT_SECRET || "").trim();
  const programId = String(process.env.CASHFREE_PPI_PROGRAM_ID || "").trim();

  return Boolean(clientId && clientSecret && programId);
};

/**
 * Get sanitized Cashfree PPI configuration status for internal inspection.
 * NEVER exposes secrets.
 * @returns {object}
 */
export const getPpiConfigStatus = () => {
  const env = String(process.env.CASHFREE_PPI_ENV || "SANDBOX").trim().toUpperCase();
  const clientId = String(process.env.CASHFREE_PPI_CLIENT_ID || "").trim();
  const programId = String(process.env.CASHFREE_PPI_PROGRAM_ID || "").trim();
  const configured = isPpiConfigured();

  const clientIdMasked = clientId.length > 8
    ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}`
    : configured ? "****" : "NOT_CONFIGURED";

  return {
    isConfigured: configured,
    env: env === "PRODUCTION" ? "PRODUCTION" : "SANDBOX",
    baseUrl: getPpiBaseUrl(),
    programId: programId || "PENDING_TICKET_8374090",
    clientIdMasked,
    statusMessage: configured
      ? "Cashfree PPI is configured and ready"
      : "Cashfree PPI is not configured (Awaiting Ticket ID 8374090 credentials)",
  };
};

/**
 * Retrieve PPI API headers safely for server-to-server calls
 * @throws {Error} If PPI is not configured
 * @returns {object}
 */
export const getPpiApiHeaders = () => {
  if (!isPpiConfigured()) {
    throw new Error("Cashfree PPI integration is not configured. Missing credentials.");
  }

  const clientId = String(process.env.CASHFREE_PPI_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CASHFREE_PPI_CLIENT_SECRET || "").trim();

  return {
    "Content-Type": "application/json",
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
  };
};
