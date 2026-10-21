import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    pathFromUrl,
    resolveEndpointScope,
    applyAuthHeaders,
    handleAuth401,
} from "../utils/authInterceptor";

describe("authInterceptor", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    describe("pathFromUrl", () => {
        it("extracts path from absolute URLs", () => {
            expect(pathFromUrl("https://api.tiffzy.com/owner/1/tables")).toBe("/owner/1/tables");
            expect(pathFromUrl("http://localhost:3000/api/wallet")).toBe("/api/wallet");
        });

        it("extracts path from root-relative URLs", () => {
            expect(pathFromUrl("/customer/orders")).toBe("/customer/orders");
            expect(pathFromUrl("/owner/5/staff?scope=test")).toBe("/owner/5/staff");
        });

        it("handles relative paths", () => {
            expect(pathFromUrl("customer/profile")).toBe("/customer/profile");
            expect(pathFromUrl("api/wallet")).toBe("/api/wallet");
        });
    });

    describe("resolveEndpointScope", () => {
        it("detects customer endpoints", () => {
            expect(resolveEndpointScope({ url: "/customer/orders" })).toBe("customer");
            expect(resolveEndpointScope({ url: "https://api.tiffzy.com/customer/profile" })).toBe("customer");
            expect(resolveEndpointScope({ url: "/api/wallet" })).toBe("customer");
            expect(resolveEndpointScope({ url: "/r/cafeking/orders" })).toBe("customer");
            expect(resolveEndpointScope({ url: "/api/something", params: { scope: "customer" } })).toBe("customer");
        });

        it("detects supplier endpoints", () => {
            expect(resolveEndpointScope({ url: "/supplier/products" })).toBe("supplier");
            expect(resolveEndpointScope({ url: "/suppliers/me" })).toBe("supplier");
            expect(resolveEndpointScope({ url: "/supply-chat/threads" })).toBe("supplier");
            expect(resolveEndpointScope({ url: "/any", params: { scope: "supplier" } })).toBe("supplier");
        });

        it("detects staff / owner / admin endpoints", () => {
            expect(resolveEndpointScope({ url: "/owner/1/tables" })).toBe("staff");
            expect(resolveEndpointScope({ url: "https://api.tiffzy.com/owner/1/tables" })).toBe("staff");
            expect(resolveEndpointScope({ url: "/super-admin/restaurants" })).toBe("staff");
            expect(resolveEndpointScope({ url: "/api/owner/suppliers" })).toBe("staff");
            expect(resolveEndpointScope({ url: "/supply-orders" })).toBe("staff");
            expect(resolveEndpointScope({ url: "/kitchen/orders" })).toBe("staff");
            expect(resolveEndpointScope({ url: "/tables" })).toBe("staff");
        });
    });

    describe("applyAuthHeaders", () => {
        it("NEVER attaches customerToken to staff endpoints when staffToken is absent", () => {
            localStorage.setItem("customerToken", "cust_jwt_123");
            const config = { url: "https://api.tiffzy.com/owner/1/tables", headers: {} };
            const result = applyAuthHeaders(config);
            expect(result.headers.Authorization).toBeUndefined();
        });

        it("attaches staffToken to staff endpoints", () => {
            localStorage.setItem("token", "staff_jwt_456");
            localStorage.setItem("customerToken", "cust_jwt_123");
            const config = { url: "https://api.tiffzy.com/owner/1/tables", headers: {} };
            const result = applyAuthHeaders(config);
            expect(result.headers.Authorization).toBe("Bearer staff_jwt_456");
        });

        it("NEVER attaches staffToken to customer endpoints", () => {
            localStorage.setItem("token", "staff_jwt_456");
            const config = { url: "/customer/orders", headers: {} };
            const result = applyAuthHeaders(config);
            expect(result.headers.Authorization).toBeUndefined();
        });

        it("attaches customerToken to customer endpoints", () => {
            localStorage.setItem("customerToken", "cust_jwt_123");
            localStorage.setItem("token", "staff_jwt_456");
            const config = { url: "/customer/orders", headers: {} };
            const result = applyAuthHeaders(config);
            expect(result.headers.Authorization).toBe("Bearer cust_jwt_123");
        });

        it("attaches supplierToken to supplier endpoints", () => {
            localStorage.setItem("supplierToken", "supp_jwt_789");
            localStorage.setItem("token", "staff_jwt_456");
            const config = { url: "/supplier/products", headers: {} };
            const result = applyAuthHeaders(config);
            expect(result.headers.Authorization).toBe("Bearer supp_jwt_789");
        });

        it("preserves explicitly passed Authorization header", () => {
            const config = {
                url: "/owner/1/tables",
                headers: { Authorization: "Bearer explicit_token" },
            };
            const result = applyAuthHeaders(config);
            expect(result.headers.Authorization).toBe("Bearer explicit_token");
        });
    });

    describe("handleAuth401", () => {
        it("only evicts customerToken on customer 401 without affecting staff session", async () => {
            localStorage.setItem("token", "staff_jwt_456");
            localStorage.setItem("user", JSON.stringify({ id: 1, role: "OWNER" }));
            localStorage.setItem("customerToken", "cust_jwt_123");
            localStorage.setItem("customer", JSON.stringify({ phone: "9876543210" }));

            const dispatchSpy = vi.spyOn(window, "dispatchEvent");

            const error = {
                response: { status: 401 },
                config: { url: "/api/notifications", params: { scope: "customer" } },
            };

            await expect(handleAuth401(error)).rejects.toBe(error);

            // Customer session removed
            expect(localStorage.getItem("customerToken")).toBeNull();
            expect(localStorage.getItem("customer")).toBeNull();

            // Staff session PRESERVED
            expect(localStorage.getItem("token")).toBe("staff_jwt_456");
            expect(localStorage.getItem("user")).not.toBeNull();

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: { scope: "customer" },
                })
            );
        });

        it("only evicts staffToken on staff 401 without affecting customer session", async () => {
            localStorage.setItem("token", "staff_jwt_456");
            localStorage.setItem("user", JSON.stringify({ id: 1, role: "OWNER" }));
            localStorage.setItem("customerToken", "cust_jwt_123");
            localStorage.setItem("customer", JSON.stringify({ phone: "9876543210" }));

            const dispatchSpy = vi.spyOn(window, "dispatchEvent");

            const error = {
                response: { status: 401 },
                config: { url: "https://api.tiffzy.com/owner/1/tables" },
            };

            await expect(handleAuth401(error)).rejects.toBe(error);

            // Staff session removed
            expect(localStorage.getItem("token")).toBeNull();
            expect(localStorage.getItem("user")).toBeNull();

            // Customer session PRESERVED
            expect(localStorage.getItem("customerToken")).toBe("cust_jwt_123");
            expect(localStorage.getItem("customer")).not.toBeNull();

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: { scope: "staff" },
                })
            );
        });
    });
});
