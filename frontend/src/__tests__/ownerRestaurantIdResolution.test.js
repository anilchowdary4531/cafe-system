import { describe, it, expect } from "vitest";
import { resolveAuthoritativeRestaurantId } from "../utils/restaurantContext";

describe("Authoritative Restaurant ID Resolution for Multiple Owner Accounts", () => {
  it("resolves restaurantId from owner with direct restaurantId", () => {
    const ownerA = { id: 14, email: "owner@cafeking.com", role: "OWNER", restaurantId: 4 };
    expect(resolveAuthoritativeRestaurantId(ownerA)).toBe(4);
  });

  it("resolves restaurantId from owner with nested restaurant relation", () => {
    const ownerB = { id: 19, email: "owner@beanhouse.com", role: "OWNER", restaurant: { id: 5, name: "Bean House" } };
    expect(resolveAuthoritativeRestaurantId(ownerB)).toBe(5);
  });

  it("resolves restaurantId from explicit outlet context or fallback candidate", () => {
    const ownerC = { id: 100, email: "owner_a_1790918312914@tiffzy.com", role: "OWNER" };
    expect(resolveAuthoritativeRestaurantId(ownerC, 623)).toBe(623);
  });

  it("returns 0 (unresolved) when no restaurant data exists instead of defaulting to invalid ID 1", () => {
    expect(resolveAuthoritativeRestaurantId(null)).toBe(0);
    expect(resolveAuthoritativeRestaurantId({})).toBe(0);
  });
});
