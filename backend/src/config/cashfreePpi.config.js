/**
 * Cashfree PPI (Prepaid Payment Instruments) & Triple Credential Configuration
 */

export const DEFAULT_PROGRAM_ID = "19222";
export const CASHFREE_API_VERSION = "2025-11-01";

export const BASE_URLS = {
  PPI_SANDBOX: "https://sandbox.cashfree.com/ppi",
  PPI_PRODUCTION: "https://api.cashfree.com/ppi",
  PG_SANDBOX: "https://sandbox.cashfree.com/pg",
  PG_PRODUCTION: "https://api.cashfree.com/pg",
};

export const getEnvironment = () => {
  const envVar = String(process.env.CASHFREE_ENVIRONMENT || process.env.CASHFREE_PPI_ENV || "").trim().toUpperCase();
  if (envVar === "PRODUCTION") return "PRODUCTION";
  if (envVar === "SANDBOX" || envVar === "TEST") return "SANDBOX";

  const clientId = String(process.env.CASHFREE_PPI_CLIENT_ID || process.env.CASHFREE_CLIENT_ID || "").trim();
  if (clientId && !clientId.toUpperCase().includes("TEST") && !clientId.toUpperCase().includes("SANDBOX")) {
    return "PRODUCTION";
  }
  return "SANDBOX";
};

export const getPpiBaseUrl = () => {
  return getEnvironment() === "PRODUCTION" ? BASE_URLS.PPI_PRODUCTION : BASE_URLS.PPI_SANDBOX;
};

export const getPgBaseUrl = () => {
  return getEnvironment() === "PRODUCTION" ? BASE_URLS.PG_PRODUCTION : BASE_URLS.PG_SANDBOX;
};

export const getProgramId = () => {
  return String(process.env.CASHFREE_PPI_PROGRAM_ID || DEFAULT_PROGRAM_ID).trim();
};

export const isPpiConfigured = () => {
  const clientId = String(process.env.CASHFREE_PPI_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CASHFREE_PPI_CLIENT_SECRET || "").trim();
  const programId = String(process.env.CASHFREE_PPI_PROGRAM_ID || "").trim();
  return Boolean(clientId && clientSecret && programId);
};

export const getPpiConfigStatus = () => {
  const env = getEnvironment();
  const clientId = String(process.env.CASHFREE_PPI_CLIENT_ID || "").trim();
  const programId = String(process.env.CASHFREE_PPI_PROGRAM_ID || "PENDING_TICKET_8374090").trim();
  const configured = isPpiConfigured();

  const clientIdMasked = clientId.length > 8
    ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}`
    : configured ? "****" : "NOT_CONFIGURED";

  return {
    isConfigured: configured,
    env,
    baseUrl: getPpiBaseUrl(),
    programId: configured ? programId : "PENDING_TICKET_8374090",
    clientIdMasked,
    statusMessage: configured
      ? "Cashfree PPI is configured and ready"
      : "Cashfree PPI is not configured (Awaiting Ticket ID 8374090 credentials)",
  };
};

export const getPpiHeaders = () => {
  if (!isPpiConfigured()) {
    throw new Error("Cashfree PPI integration is not configured. Missing credentials.");
  }

  const clientId = String(process.env.CASHFREE_PPI_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CASHFREE_PPI_CLIENT_SECRET || "").trim();

  return {
    "Content-Type": "application/json",
    "x-api-version": CASHFREE_API_VERSION,
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
  };
};

export const getPpiApiHeaders = getPpiHeaders;

export const getPgCreditHeaders = () => {
  const clientId = String(process.env.CASHFREE_PG_CREDIT_CLIENT_ID || process.env.CASHFREE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CASHFREE_PG_CREDIT_CLIENT_SECRET || process.env.CASHFREE_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("Cashfree PG Credit credentials missing (CASHFREE_PG_CREDIT_CLIENT_ID)");
  }

  return {
    "Content-Type": "application/json",
    "x-api-version": CASHFREE_API_VERSION,
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
  };
};

export const getPgDebitHeaders = () => {
  const clientId = String(process.env.CASHFREE_PG_DEBIT_CLIENT_ID || process.env.CASHFREE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CASHFREE_PG_DEBIT_CLIENT_SECRET || process.env.CASHFREE_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("Cashfree PG Debit credentials missing (CASHFREE_PG_DEBIT_CLIENT_ID)");
  }

  return {
    "Content-Type": "application/json",
    "x-api-version": CASHFREE_API_VERSION,
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
  };
};
