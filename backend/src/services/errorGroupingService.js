import crypto from "crypto";

/**
 * Normalizes an HTTP request path by replacing dynamic identifiers (IDs, UUIDs, numeric tokens)
 * with placeholders like `:id` or `:uuid` without altering static route definitions.
 *
 * @param {string} rawPath
 * @returns {string}
 */
export function normalizePath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") return "/";
  let path = rawPath.split("?")[0].trim(); // strip query params

  // Normalize UUIDs (8-4-4-4-12 hex format)
  path = path.replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=\/|$)/g, "/:uuid");

  // Normalize 10+ digit phone numbers or timestamps in path
  path = path.replace(/\/\d{10,}(?=\/|$)/g, "/:id");

  // Normalize numeric ID path segments (e.g. /api/orders/12345/checkout -> /api/orders/:id/checkout)
  path = path.replace(/\/\d+(?=\/|$)/g, "/:id");

  return path || "/";
}

/**
 * Normalizes error messages by stripping dynamic values like IP addresses and memory addresses.
 *
 * @param {string} rawMessage
 * @returns {string}
 */
export function normalizeMessage(rawMessage) {
  if (!rawMessage || typeof rawMessage !== "string") return "Unknown Error";
  let msg = rawMessage.trim();

  // Strip IPv4 addresses
  msg = msg.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ":ip");

  // Strip memory addresses (0x...)
  msg = msg.replace(/0x[0-9a-fA-F]+/g, ":addr");

  // Normalize whitespace
  return msg.replace(/\s+/g, " ").trim();
}

/**
 * Creates a deterministic SHA-256 fingerprint for an error event based on:
 * - HTTP method
 * - normalized request path
 * - HTTP status code
 * - normalized error message
 *
 * Dynamic values (UUIDs, timestamps, user IDs, request IDs) are excluded.
 *
 * @param {Object} error
 * @returns {string}
 */
export function createErrorFingerprint(error = {}) {
  const method = String(error.method || error.httpMethod || "UNKNOWN").toUpperCase();
  const path = normalizePath(error.path || error.url || "/");
  const statusCode = String(error.statusCode || error.status || 500);
  const message = normalizeMessage(error.message || "Unknown Error");

  const rawKey = `${method}|${path}|${statusCode}|${message}`;
  return crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
}

/**
 * Groups raw CloudWatch error log events by fingerprint.
 *
 * @param {Array<Object>} events
 * @returns {Array<Object>}
 */
export function groupErrorEvents(events = []) {
  if (!Array.isArray(events)) return [];

  const groupsMap = new Map();

  for (const event of events) {
    const fingerprint = createErrorFingerprint(event);
    const eventTs = event.timestamp || new Date().toISOString();
    const normPath = normalizePath(event.path || event.url || "/");
    const method = String(event.method || event.httpMethod || "UNKNOWN").toUpperCase();
    const statusCode = Number(event.statusCode || event.status || 500);
    const message = event.message || "Unknown Error";

    if (!groupsMap.has(fingerprint)) {
      groupsMap.set(fingerprint, {
        fingerprint,
        status: "OPEN",
        occurrences: 1,
        firstSeen: eventTs,
        lastSeen: eventTs,
        method,
        path: normPath,
        rawUrl: event.url || event.path || "/",
        statusCode,
        message,
        logStream: event.logStream || "default",
        events: [event],
      });
    } else {
      const group = groupsMap.get(fingerprint);
      group.occurrences += 1;
      group.events.push(event);

      const groupFirst = new Date(group.firstSeen).getTime();
      const groupLast = new Date(group.lastSeen).getTime();
      const currentTs = new Date(eventTs).getTime();

      if (currentTs < groupFirst) group.firstSeen = eventTs;
      if (currentTs > groupLast) group.lastSeen = eventTs;
    }
  }

  // Sort groups by lastSeen (latest error groups first)
  return Array.from(groupsMap.values()).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
}

// Alias for backward compatibility
export const groupErrorLogs = groupErrorEvents;
