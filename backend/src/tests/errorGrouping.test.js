import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePath,
  normalizeMessage,
  createErrorFingerprint,
  groupErrorEvents,
} from "../services/errorGroupingService.js";

test("Path Normalization", async (t) => {
  await t.test("D: Normalizes numeric IDs in path to :id", () => {
    assert.equal(normalizePath("/api/orders/12345/checkout"), "/api/orders/:id/checkout");
    assert.equal(normalizePath("/api/orders/67890/checkout"), "/api/orders/:id/checkout");
  });

  await t.test("Normalizes UUID path segments to :uuid", () => {
    assert.equal(
      normalizePath("/api/users/550e8400-e29b-41d4-a716-446655440000/details"),
      "/api/users/:uuid/details"
    );
  });
});

test("Error Fingerprinting & Grouping", async (t) => {
  await t.test("A: Same error repeated 3 times produces 1 group with occurrences = 3", () => {
    const rawEvents = [
      {
        method: "POST",
        url: "/api/orders/checkout",
        statusCode: 500,
        message: "Database connection failed",
        timestamp: "2026-10-10T10:00:00.000Z",
      },
      {
        method: "POST",
        url: "/api/orders/checkout",
        statusCode: 500,
        message: "Database connection failed",
        timestamp: "2026-10-10T10:05:00.000Z",
      },
      {
        method: "POST",
        url: "/api/orders/checkout",
        statusCode: 500,
        message: "Database connection failed",
        timestamp: "2026-10-10T10:10:00.000Z",
      },
    ];

    const groups = groupErrorEvents(rawEvents);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].occurrences, 3);
    assert.equal(groups[0].firstSeen, "2026-10-10T10:00:00.000Z");
    assert.equal(groups[0].lastSeen, "2026-10-10T10:10:00.000Z");
    assert.equal(groups[0].events.length, 3);
    assert.equal(groups[0].status, "OPEN");
  });

  await t.test("B: Same endpoint but different status produces separate groups", () => {
    const events = [
      { method: "POST", url: "/api/orders/checkout", statusCode: 500, message: "Error" },
      { method: "POST", url: "/api/orders/checkout", statusCode: 504, message: "Error" },
    ];

    const groups = groupErrorEvents(events);
    assert.equal(groups.length, 2);
    assert.notEqual(groups[0].fingerprint, groups[1].fingerprint);
  });

  await t.test("C: Same endpoint/status but different message produces separate groups", () => {
    const events = [
      { method: "POST", url: "/api/orders/checkout", statusCode: 500, message: "DB timeout" },
      { method: "POST", url: "/api/orders/checkout", statusCode: 500, message: "Out of memory" },
    ];

    const groups = groupErrorEvents(events);
    assert.equal(groups.length, 2);
    assert.notEqual(groups[0].fingerprint, groups[1].fingerprint);
  });

  await t.test("D: Dynamic IDs in URL produce the same group", () => {
    const events = [
      { method: "POST", url: "/api/orders/12345/checkout", statusCode: 500, message: "Connection lost" },
      { method: "POST", url: "/api/orders/67890/checkout", statusCode: 500, message: "Connection lost" },
    ];

    const groups = groupErrorEvents(events);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].occurrences, 2);
    assert.equal(groups[0].path, "/api/orders/:id/checkout");
  });

  await t.test("E: Different endpoints produce separate groups", () => {
    const events = [
      { method: "POST", url: "/api/orders/checkout", statusCode: 500, message: "Error" },
      { method: "GET", url: "/api/wallet/balance", statusCode: 500, message: "Error" },
    ];

    const groups = groupErrorEvents(events);
    assert.equal(groups.length, 2);
  });
});
