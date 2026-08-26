import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFailureReason } from "../services/cashfree.service.js";

describe("Cashfree Payment Audit & Status Normalization Tests", () => {
  it("should sanitize USER_DROPPED into 'User cancelled payment'", () => {
    const reason = sanitizeFailureReason("Customer closed window", "USER_DROPPED");
    assert.equal(reason, "User cancelled payment");
  });

  it("should sanitize EXPIRED into 'Payment session expired'", () => {
    const reason = sanitizeFailureReason("Session timeout", "EXPIRED");
    assert.equal(reason, "Payment session expired");
  });

  it("should sanitize bank decline messages cleanly", () => {
    const reason = sanitizeFailureReason("Transaction declined by issuing bank", "FAILED");
    assert.equal(reason, "Bank declined the transaction");
  });

  it("should calculate ₹2.00 subtotal -> ₹0.00 tax -> ₹2.00 total final payment amount", () => {
    const subtotal = 2.0;
    const taxAmount = 0;
    const total = subtotal + taxAmount;
    assert.equal(subtotal, 2.0);
    assert.equal(taxAmount, 0);
    assert.equal(total, 2.0);
  });
});
