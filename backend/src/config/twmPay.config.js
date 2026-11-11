/**
 * TWM Pay (The Website Makers Pay) Configuration
 * Reads credentials dynamically from environment variables.
 * Never logs or exposes API secret or HMAC signing key.
 */

const DEFAULT_TWM_BASE_URL = "https://pay.thewebsitemakers.in";

export const maskTwmSecret = (value) => {
  const str = String(value || "").trim();
  if (!str) return null;
  if (str.length <= 6) return "***";
  return `${str.slice(0, 4)}***${str.slice(-4)}`;
};

export const getTwmPayConfig = () => {
  const merchantId = String(process.env.TWM_MERCHANT_ID || "").trim();
  const apiSecret = String(process.env.TWM_API_SECRET || "").trim();
  const signingKey = String(process.env.TWM_SIGNING_KEY || "").trim();
  const rawUrl = String(process.env.TWM_URL || DEFAULT_TWM_BASE_URL).trim();
  const baseUrl = (rawUrl || DEFAULT_TWM_BASE_URL).replace(/\/+$/, "");

  const enabledFlag = String(process.env.TWM_ENABLED ?? "true").trim().toLowerCase();
  const enabled = enabledFlag !== "false" && enabledFlag !== "0" && enabledFlag !== "no";

  const timeoutRaw = Number(process.env.TWM_TIMEOUT_MS || 15000);
  const requestTimeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw >= 1000 ? timeoutRaw : 15000;

  const isConfigured = Boolean(enabled && merchantId && apiSecret && signingKey);

  return {
    enabled,
    isConfigured,
    merchantId,
    apiSecret,
    signingKey,
    baseUrl,
    requestTimeoutMs,
    merchantIdMasked: maskTwmSecret(merchantId),
    notifyUrlOverride: String(process.env.TWM_NOTIFY_URL || "").trim() || null,
    returnUrlOverride: String(process.env.TWM_RETURN_URL || "").trim() || null,
  };
};

export const assertTwmPayConfigured = () => {
  const cfg = getTwmPayConfig();
  if (!cfg.enabled) {
    const err = new Error("TWM Pay is disabled");
    err.code = "TWM_DISABLED";
    err.statusCode = 503;
    throw err;
  }
  if (!cfg.merchantId || !cfg.apiSecret || !cfg.signingKey) {
    const err = new Error(
      "TWM Pay credentials missing: TWM_MERCHANT_ID, TWM_API_SECRET, and TWM_SIGNING_KEY must be configured"
    );
    err.code = "TWM_NOT_CONFIGURED";
    err.statusCode = 503;
    throw err;
  }
  return cfg;
};
