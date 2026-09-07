import test from "node:test";
import assert from "node:assert/strict";
import { formatWhatsAppPhone, sendWhatsAppOtp } from "../services/msg91WhatsAppService.js";

test("MSG91 WhatsApp Service — Phone Number Normalization Audit", () => {
  assert.equal(formatWhatsAppPhone("9177764632"), "919177764632", "10-digit Indian phone should be prepended with 91");
  assert.equal(formatWhatsAppPhone("919177764632"), "919177764632", "12-digit Indian phone with 91 prefix should be preserved");
  assert.equal(formatWhatsAppPhone("09177764632"), "919177764632", "11-digit phone with leading 0 should strip 0 and format with 91");
  assert.equal(formatWhatsAppPhone("+91 91777 64632"), "919177764632", "Formatted string with spaces/plus should format cleanly");
  assert.equal(formatWhatsAppPhone("91919177764632"), "919177764632", "Double 9191 prefix should be corrected");
});

test("MSG91 WhatsApp Service — Simulated Dev Execution", async () => {
  const originalEnv = process.env.MSG91_AUTHKEY;
  delete process.env.MSG91_AUTHKEY;
  delete process.env.MSG91_AUTH_KEY;

  const res = await sendWhatsAppOtp({
    phone: "9177764632",
    otp: "583214",
    expiresAt: new Date(Date.now() + 300000),
  });

  assert.equal(res.ok, true, "Should return ok: true in development simulation");
  assert.equal(res.simulated, true, "Should flag as simulated when MSG91_AUTHKEY is missing");

  if (originalEnv) {
    process.env.MSG91_AUTHKEY = originalEnv;
  }
});

test("MSG91 WhatsApp Service — Production Missing Key Rejection", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAuthKey = process.env.MSG91_AUTHKEY;

  process.env.NODE_ENV = "production";
  delete process.env.MSG91_AUTHKEY;
  delete process.env.MSG91_AUTH_KEY;

  const res = await sendWhatsAppOtp({
    phone: "9177764632",
    otp: "583214",
  });

  assert.equal(res.ok, false, "Should return ok: false in production when MSG91_AUTHKEY is missing");
  assert.ok(res.error.includes("MSG91_AUTHKEY is not configured"), "Should report clear error message");

  process.env.NODE_ENV = originalNodeEnv;
  if (originalAuthKey) process.env.MSG91_AUTHKEY = originalAuthKey;
});

test("MSG91 WhatsApp Service — Real Request Execution when AuthKey present", async () => {
  const originalAuthKey = process.env.MSG91_AUTHKEY;
  const originalFetch = globalThis.fetch;

  process.env.MSG91_AUTHKEY = "dummy_test_authkey";

  let capturedUrl = "";
  let capturedOptions = {};

  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ type: "success", message: "Message sent successfully" }),
    };
  };

  try {
    const res = await sendWhatsAppOtp({
      phone: "9133222614",
      otp: "285073",
      expiresAt: new Date(Date.now() + 300000),
    });

    assert.equal(res.ok, true, "Should return ok: true");
    assert.equal(res.simulated, false, "Should return simulated: false when AuthKey is present");
    assert.equal(res.provider, "msg91_whatsapp");
    assert.equal(capturedUrl, "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/");
    assert.equal(capturedOptions.headers.authkey, "dummy_test_authkey");
    const payload = JSON.parse(capturedOptions.body);
    assert.equal(payload.payload.template.name, "tiffzy_login_otp");
    assert.equal(payload.payload.template.language.code, "en");
    assert.equal(payload.payload.template.to_and_components[0].to[0], "919133222614");
    assert.equal(payload.payload.template.to_and_components[0].components.body_1.value, "285073");
    assert.equal(payload.payload.template.to_and_components[0].components.button_1.value, "285073");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalAuthKey) process.env.MSG91_AUTHKEY = originalAuthKey;
    else delete process.env.MSG91_AUTHKEY;
  }
});

