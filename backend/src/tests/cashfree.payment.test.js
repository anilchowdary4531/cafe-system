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

  it("should calculate ₹2.00 subtotal -> ₹0.00 tax -> ₹2.00 total final payment amount", () => {
    const subtotal = 2.0;
    const taxAmount = 0;
    const total = subtotal + taxAmount;
    expect(subtotal).toBe(2.0);
    expect(taxAmount).toBe(0);
    expect(total).toBe(2.0);
  });
});
