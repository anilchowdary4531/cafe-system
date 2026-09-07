import test from "node:test";
import assert from "node:assert/strict";
import { formatWhatsAppPhone } from "../services/msg91WhatsAppService.js";

test("Customer Dual OTP — Phone masking helper test", () => {
  const phone = "919133222614";
  const formatted = formatWhatsAppPhone(phone);
  assert.equal(formatted, "919133222614");
});
