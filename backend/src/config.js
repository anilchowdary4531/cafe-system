const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const requiredEnv = (name) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
        `[env] Missing ${name}. Set it in backend/.env (dev), backend/.env.production (prod), or runtime env vars.`,
    );
  }

  return value;
};

const parseOrigin = (raw, name) => {
  const value = trimSlash(raw);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`[env] Invalid ${name}. Expected an absolute origin like https://example.com`);
  }

  const protocol = String(url.protocol || "").toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`[env] Invalid ${name}. Only http/https are allowed.`);
  }

  // Disallow path/query/hash to prevent subtle bugs in QR links + CORS checks.
  if (trimSlash(url.origin) !== value) {
    throw new Error(`[env] Invalid ${name}. Provide only the origin (no path/query).`);
  }

  return trimSlash(url.origin);
};

const parseDbHostname = (databaseUrl) => {
  try {
    const u = new URL(String(databaseUrl || ""));
    return String(u.hostname || "");
  } catch {
    return "";
  }
};

const isLocalHostname = (host) => {
  const h = String(host || "").trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h.endsWith(".localhost");
};

const parseCsv = (value) =>
    String(value || "")
        .split(",")
        .map((s) => trimSlash(s))
        .filter(Boolean);

export const getRuntimeConfig = () => {
  const nodeEnv = String(process.env.NODE_ENV || "development").trim() || "development";

  const portRaw = String(process.env.PORT || "").trim();

  const port = portRaw ? Number(portRaw) : 4000;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("[env] Invalid PORT. Provide a valid port number.");
  }

  const host = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";

  const databaseUrl = requiredEnv("DATABASE_URL");

  const jwtSecret = requiredEnv("JWT_SECRET");

  const frontendUrl = parseOrigin(requiredEnv("FRONTEND_URL"), "FRONTEND_URL");

  const corsOrigins = parseCsv(process.env.CORS_ORIGINS).map((o) => parseOrigin(o, "CORS_ORIGINS"));

  const allowedCorsOrigins = [
    ...new Set([frontendUrl, ...corsOrigins].filter(Boolean)),
  ];

  if (!allowedCorsOrigins.length) {
    throw new Error("[env] Missing CORS origins. Set FRONTEND_URL and/or CORS_ORIGINS.");
  }

  const dbHost = parseDbHostname(databaseUrl);
  if (!dbHost) {
    throw new Error("[env] Invalid DATABASE_URL. Could not parse hostname.");
  }

  if (nodeEnv === "production") {
    if (isLocalHostname(dbHost)) {
      throw new Error("[env] DATABASE_URL points to a local hostname. Production must use RDS/managed Postgres hostname.");
    }
    if (isLocalHostname(new URL(frontendUrl).hostname)) {
      throw new Error("[env] FRONTEND_URL points to a local hostname. Production must use your deployed frontend origin.");
    }
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    HOST: host,
    DATABASE_URL: databaseUrl,
    DB_HOST: dbHost,
    JWT_SECRET: jwtSecret,
    FRONTEND_URL: frontendUrl,
    CORS_ORIGINS: allowedCorsOrigins,
  };
};
