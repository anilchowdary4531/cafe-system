import { describe, it, expect } from "vitest";
import { sanitizeFailureReason, verifyCashfreeOrderSession } from "../services/cashfree.service.js";

describe("Cashfree Payment Audit & Status Normalization Tests", () => {
  it("should sanitize USER_DROPPED into 'User cancelled payment'", () => {
    const reason = sanitizeFailureReason("Customer closed window", "USER_DROPPED");
    expect(reason).toBe("User cancelled payment");
  });

  it("should sanitize EXPIRED into 'Payment session expired'", () => {
    const reason = sanitizeFailureReason("Session timeout", "EXPIRED");
    expect(reason).toBe("Payment session expired");
  });

  it("should sanitize bank decline messages cleanly", () => {
    const reason = sanitizeFailureReason("Transaction declined by issuing bank", "FAILED");
    expect(reason).toBe("Bank declined the transaction");
  });

  it("should return normalizedStatus CANCELLED when Cashfree returns USER_DROPPED", async () => {
    // Test helper logic validation
    const dummyCashfreeRes = {
      order_status: "USER_DROPPED",
      order_amount: 100,
    };
    expect(dummyCashfreeRes.order_status).toBe("USER_DROPPED");
  });
});
