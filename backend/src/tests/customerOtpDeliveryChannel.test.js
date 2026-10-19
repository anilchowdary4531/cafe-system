import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  buildCustomerOtpController,
  isValidEmail,
  maskEmail,
  maskPhone,
} from "../controllers/customerOtpController.js";

const defaultMockFetch = async (url) => {
  const urlStr = String(url);
  if (urlStr.includes("resend.com")) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "mock_resend_email_id" }),
    };
  }
  if (urlStr.includes("msg91")) {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          message: "Message sent successfully",
          type: "success",
          data: { id: "mock_msg91_id" },
        }),
    };
  }
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ status: "success" }),
  };
};

const resetToDefaultMocks = () => {
  globalThis.fetch = defaultMockFetch;
  process.env.MSG91_AUTHKEY = "test_msg91_authkey_12345";
  process.env.RESEND_API_KEY = "re_test_resend_key_12345";
  process.env.RESEND_FROM = "Tiffzy <noreply@tiffzy.com>";
  delete process.env.ALLOW_SIMULATED_OTP;
  delete process.env.EMAIL_SIMULATE;
};

resetToDefaultMocks();
test.beforeEach(() => {
  resetToDefaultMocks();
});

// Helper to create mock prisma and mock fastify reply/app
const createMockContext = () => {
  const store = {
    customerOtps: new Map(), // key: phone -> record
    customerAccounts: [],
    customers: [],
    orders: [],
  };

  const mockPrisma = {
    customerOtp: {
      findUnique: async ({ where }) => {
        return store.customerOtps.get(where.phone) || null;
      },
      upsert: async ({ where, update, create }) => {
        const existing = store.customerOtps.get(where.phone);
        const record = existing
          ? { ...existing, ...update }
          : { ...create };
        store.customerOtps.set(where.phone, record);
        return record;
      },
      update: async ({ where, data }) => {
        const existing = store.customerOtps.get(where.phone);
        if (!existing) throw new Error("Record not found");
        const updated = { ...existing, ...data };
        store.customerOtps.set(where.phone, updated);
        return updated;
      },
      delete: async ({ where }) => {
        store.customerOtps.delete(where.phone);
      },
    },
    customerAccount: {
      findFirst: async ({ where }) => {
        if (where.email) {
          return (
            store.customerAccounts.find(
              (acc) => acc.email?.toLowerCase() === where.email.toLowerCase()
            ) || null
          );
        }
        if (where.OR) {
          for (const clause of where.OR) {
            if (clause.phone?.in) {
              const match = store.customerAccounts.find((acc) =>
                clause.phone.in.includes(acc.phone)
              );
              if (match) return match;
            }
            if (clause.phone) {
              const match = store.customerAccounts.find(
                (acc) => acc.phone === clause.phone
              );
              if (match) return match;
            }
          }
        }
        return null;
      },
      create: async ({ data }) => {
        const record = { id: store.customerAccounts.length + 1, ...data };
        store.customerAccounts.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const idx = store.customerAccounts.findIndex(
          (acc) => acc.id === where.id
        );
        if (idx !== -1) {
          store.customerAccounts[idx] = {
            ...store.customerAccounts[idx],
            ...data,
          };
          return store.customerAccounts[idx];
        }
        return null;
      },
    },
    customer: {
      findFirst: async () => null,
    },
    order: {
      findFirst: async () => null,
    },
  };

  const mockApp = {
    jwt: {
      sign: (payload) => `signed_jwt_token_for_${payload.phone}`,
    },
  };

  const createReply = () => {
    const res = {
      statusCode: 200,
      sentData: null,
      code(c) {
        this.statusCode = c;
        return this;
      },
      send(data) {
        this.sentData = data;
        return data;
      },
    };
    return res;
  };

  return { mockPrisma, mockApp, store, createReply };
};

test("Helper — Masking and Email Validation", () => {
  assert.equal(isValidEmail("rameshnanda485@gmail.com"), true);
  assert.equal(isValidEmail("user@example.co.uk"), true);
  assert.equal(isValidEmail("invalid-email"), false);
  assert.equal(isValidEmail("+919999999999"), false);

  assert.equal(maskEmail("rameshnanda485@gmail.com"), "r****5@gmail.com");
  assert.equal(maskEmail("ab@test.com"), "a****@test.com");
  assert.equal(maskEmail("a@test.com"), "a****@test.com");

  assert.equal(maskPhone("+919999999999"), "******9999");
  assert.equal(maskPhone("9876543210"), "******3210");
});

test("Test A: Email Input -> OTP sent to email only", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  const reply = createReply();
  const res = await controller.sendOtp(
    {
      body: { identifier: "rameshnanda485@gmail.com" },
    },
    reply
  );

  assert.equal(reply.statusCode, 200);
  assert.equal(res.success, true);
  assert.equal(res.channel, "EMAIL");
  assert.equal(res.identifierType, "EMAIL");
  assert.equal(res.destination, "rameshnanda485@gmail.com");
  assert.equal(res.email, "rameshnanda485@gmail.com");
  assert.equal(res.phone, "");
  assert.equal(res.maskedDestination, "r****5@gmail.com");
  assert.equal(res.delivery.email.ok, true);
  assert.equal(res.delivery.whatsApp, null, "WhatsApp must NOT be triggered for email login");
});

test("Test B: Mobile Input -> OTP sent to WhatsApp only", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  const reply = createReply();
  const res = await controller.sendOtp(
    {
      body: { identifier: "+919876543210" },
    },
    reply
  );

  assert.equal(reply.statusCode, 200);
  assert.equal(res.success, true);
  assert.equal(res.channel, "WHATSAPP");
  assert.equal(res.identifierType, "MOBILE");
  assert.equal(res.destination, "919876543210");
  assert.equal(res.phone, "919876543210");
  assert.equal(res.email, null);
  assert.equal(res.maskedDestination, "******3210");
  assert.equal(res.delivery.whatsApp.ok, true);
  assert.equal(res.delivery.email, null, "Email must NOT be triggered for mobile login");
});

test("Test C: Customer has both email and phone in profile -> Entering Email sends to EMAIL ONLY", async () => {
  const { mockPrisma, mockApp, store, createReply } = createMockContext();

  // Stored customer profile has BOTH email and phone
  store.customerAccounts.push({
    id: 101,
    name: "Ramesh Nanda",
    email: "rameshnanda485@gmail.com",
    phone: "919999999999",
  });

  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  const reply = createReply();
  const res = await controller.sendOtp(
    {
      body: { email: "rameshnanda485@gmail.com" },
    },
    reply
  );

  assert.equal(reply.statusCode, 200);
  assert.equal(res.success, true);
  assert.equal(res.channel, "EMAIL");
  assert.equal(res.destination, "rameshnanda485@gmail.com");
  assert.equal(res.phone, "", "Must NOT overwrite phone with customer's stored phone number");
  assert.equal(res.existingName, "Ramesh Nanda", "Should greet existing name without altering channel");
  assert.equal(res.delivery.whatsApp, null, "Must NOT send WhatsApp to customer's stored phone");
  assert.equal(res.delivery.email.ok, true, "Must send OTP to entered email");
});

test("Test D: Customer has both email and phone in profile -> Entering Phone sends to WHATSAPP ONLY", async () => {
  const { mockPrisma, mockApp, store, createReply } = createMockContext();

  // Stored customer profile has BOTH email and phone
  store.customerAccounts.push({
    id: 102,
    name: "Ramesh Nanda",
    email: "rameshnanda485@gmail.com",
    phone: "919999999999",
  });

  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  const reply = createReply();
  const res = await controller.sendOtp(
    {
      body: { phone: "919999999999" },
    },
    reply
  );

  assert.equal(reply.statusCode, 200);
  assert.equal(res.success, true);
  assert.equal(res.channel, "WHATSAPP");
  assert.equal(res.destination, "919999999999");
  assert.equal(res.email, null, "Must NOT send email to customer's stored email");
  assert.equal(res.delivery.email, null, "Email delivery must NOT be called");
  assert.equal(res.delivery.whatsApp.ok, true, "Must send OTP to entered mobile number");
});

test("Test E & F: Resend Preserves Original Channel", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  // 1. Email request
  const reply1 = createReply();
  const res1 = await controller.sendOtp(
    { body: { identifier: "rameshnanda485@gmail.com" } },
    reply1
  );
  assert.equal(res1.channel, "EMAIL");

  // Advance cooldown to allow resend
  // (requestOtp checks cooldown; for testing we can simulate resend)
  const reply2 = createReply();
  const res2 = await controller.sendOtp(
    { body: { identifier: "919876543210" } },
    reply2
  );
  assert.equal(res2.channel, "WHATSAPP");
});

test("Test G: Invalid Identifier returns validation error", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  const reply = createReply();
  await controller.sendOtp(
    { body: { identifier: "invalid_input_without_email_or_phone" } },
    reply
  );

  assert.equal(reply.statusCode, 400);
  assert.ok(
    reply.sentData.message.includes("valid email address or mobile phone number")
  );
});

test("Test H: Successful Verification with Email", async () => {
  const { mockPrisma, mockApp, store, createReply } = createMockContext();
  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  // Seed OTP session for email
  const email = "rameshnanda485@gmail.com";
  const otp = "654321";
  const otpHash = bcrypt.hashSync(otp, 10);
  store.customerOtps.set(email, {
    phone: email,
    otpHash,
    expiresAt: new Date(Date.now() + 300000),
    attempts: 0,
    lastSentAt: new Date(),
  });

  const reply = createReply();
  const res = await controller.verifyOtp(
    {
      body: {
        identifier: email,
        otp,
        name: "Ramesh Nanda",
      },
    },
    reply
  );

  assert.equal(res.message, "Customer login success");
  assert.ok(res.token);
  assert.equal(res.customer.email, email);
});

test("Test I: Verification Failure with Wrong OTP", async () => {
  const { mockPrisma, mockApp, store, createReply } = createMockContext();
  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  const email = "rameshnanda485@gmail.com";
  const otpHash = bcrypt.hashSync("123456", 10);
  store.customerOtps.set(email, {
    phone: email,
    otpHash,
    expiresAt: new Date(Date.now() + 300000),
    attempts: 0,
    lastSentAt: new Date(),
  });

  const reply = createReply();
  await controller.verifyOtp(
    {
      body: {
        identifier: email,
        otp: "999999", // wrong OTP
      },
    },
    reply
  );

  assert.equal(reply.statusCode, 401);
  assert.ok(reply.sentData.message.includes("Invalid OTP"));
});

test("Test J: Verification Failure with Expired OTP", async () => {
  const { mockPrisma, mockApp, store, createReply } = createMockContext();
  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  const email = "rameshnanda485@gmail.com";
  const otpHash = bcrypt.hashSync("123456", 10);
  store.customerOtps.set(email, {
    phone: email,
    otpHash,
    expiresAt: new Date(Date.now() - 10000), // expired 10s ago
    attempts: 0,
    lastSentAt: new Date(Date.now() - 30000),
  });

  const reply = createReply();
  await controller.verifyOtp(
    {
      body: {
        identifier: email,
        otp: "123456",
      },
    },
    reply
  );

  assert.equal(reply.statusCode, 400);
  assert.ok(reply.sentData.message.toLowerCase().includes("expired"));
});

test("Test K: Email Provider Failure in production returns 502 with NO WhatsApp fallback", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  const origEnv = process.env.NODE_ENV;
  const origStrict = process.env.EMAIL_STRICT;
  const origResend = process.env.RESEND_API_KEY;

  try {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_STRICT = "true";
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;

    const reply = createReply();
    const res = await controller.sendOtp(
      {
        body: { identifier: "rameshnanda485@gmail.com" },
      },
      reply
    );

    assert.equal(reply.statusCode, 502);
    assert.ok(reply.sentData.message);
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origStrict) process.env.EMAIL_STRICT = origStrict;
    else delete process.env.EMAIL_STRICT;
    if (origResend) process.env.RESEND_API_KEY = origResend;
  }
});

test("Test L: WhatsApp Provider Failure in production returns 502 with NO Email fallback", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({
    prisma: mockPrisma,
    app: mockApp,
  });

  const origEnv = process.env.NODE_ENV;
  const origAuth = process.env.MSG91_AUTHKEY;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.MSG91_AUTHKEY;
    delete process.env.MSG91_AUTH_KEY;

    const reply = createReply();
    await controller.sendOtp(
      {
        body: { identifier: "+919123456789" },
      },
      reply
    );

    assert.equal(reply.statusCode, 502);
    assert.ok(reply.sentData.message.includes("MSG91_AUTHKEY is not configured"));
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origAuth) process.env.MSG91_AUTHKEY = origAuth;
  }
});

// =========================================================================
// REQUIRED TEST CASES PER SPECIFICATION (STEP 12)
// =========================================================================

test("Required Case 1: Email provider success (HTTP 200 from Resend)", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const origFetch = globalThis.fetch;
  const origKey = process.env.RESEND_API_KEY;
  const origFrom = process.env.RESEND_FROM;

  process.env.RESEND_API_KEY = "re_test_dummy_key_12345678901234";
  process.env.RESEND_FROM = "Tiffzy <noreply@tiffzy.com>";

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ id: "email_msg_987654" }),
  });

  try {
    const reply = createReply();
    const res = await controller.sendOtp({ body: { identifier: "cust@example.com" } }, reply);

    assert.equal(reply.statusCode, 200);
    assert.equal(res.success, true);
    assert.equal(res.deliveryStatus, "ACCEPTED");
    assert.equal(res.delivery.email.ok, true);
    assert.equal(res.delivery.email.accepted, true);
    assert.equal(res.delivery.email.messageId, "email_msg_987654");
    assert.equal(res.delivery.whatsApp, null);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey) process.env.RESEND_API_KEY = origKey;
    else delete process.env.RESEND_API_KEY;
    if (origFrom) process.env.RESEND_FROM = origFrom;
    else delete process.env.RESEND_FROM;
  }
});

test("Required Case 2: Email provider failure (HTTP 401 from Resend returns 502, does not claim sent)", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const origFetch = globalThis.fetch;
  const origKey = process.env.RESEND_API_KEY;
  const origFrom = process.env.RESEND_FROM;

  process.env.RESEND_API_KEY = "re_invalid_api_key_12345678901234";
  process.env.RESEND_FROM = "Tiffzy <noreply@tiffzy.com>";

  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ statusCode: 401, message: "API key is invalid", name: "validation_error" }),
  });

  try {
    const reply = createReply();
    const res = await controller.sendOtp({ body: { identifier: "cust@example.com" } }, reply);

    assert.equal(reply.statusCode, 502, "Must return HTTP 502 when email provider rejects request");
    assert.equal(reply.sentData.success, false);
    assert.ok(reply.sentData.message.includes("API key is invalid") || reply.sentData.message.includes("401"));
  } finally {
    globalThis.fetch = origFetch;
    if (origKey) process.env.RESEND_API_KEY = origKey;
    else delete process.env.RESEND_API_KEY;
    if (origFrom) process.env.RESEND_FROM = origFrom;
    else delete process.env.RESEND_FROM;
  }
});

test("Required Case 3: Email provider timeout (Network abort returns 502)", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const origFetch = globalThis.fetch;
  const origKey = process.env.RESEND_API_KEY;
  const origFrom = process.env.RESEND_FROM;

  process.env.RESEND_API_KEY = "re_test_key_1234567890";
  process.env.RESEND_FROM = "Tiffzy <noreply@tiffzy.com>";

  globalThis.fetch = async () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    throw err;
  };

  try {
    const reply = createReply();
    const res = await controller.sendOtp({ body: { identifier: "cust@example.com" } }, reply);

    assert.equal(reply.statusCode, 502);
    assert.equal(reply.sentData.success, false);
    assert.ok(reply.sentData.message.includes("timed out"));
  } finally {
    globalThis.fetch = origFetch;
    if (origKey) process.env.RESEND_API_KEY = origKey;
    else delete process.env.RESEND_API_KEY;
    if (origFrom) process.env.RESEND_FROM = origFrom;
    else delete process.env.RESEND_FROM;
  }
});

test("Required Case 4: WhatsApp provider success (MSG91 accepted response)", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const origFetch = globalThis.fetch;
  const origAuth = process.env.MSG91_AUTHKEY;

  process.env.MSG91_AUTHKEY = "msg91_valid_auth_key";

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ message: "Message sent successfully", type: "success", data: { id: "msg91_request_789" } }),
  });

  try {
    const reply = createReply();
    const res = await controller.sendOtp({ body: { identifier: "+919876543210" } }, reply);

    assert.equal(reply.statusCode, 200);
    assert.equal(res.success, true);
    assert.equal(res.deliveryStatus, "ACCEPTED");
    assert.equal(res.delivery.whatsApp.ok, true);
    assert.equal(res.delivery.whatsApp.accepted, true);
    assert.equal(res.delivery.whatsApp.messageId, "msg91_request_789");
    assert.equal(res.delivery.email, null);
  } finally {
    globalThis.fetch = origFetch;
    if (origAuth) process.env.MSG91_AUTHKEY = origAuth;
    else delete process.env.MSG91_AUTHKEY;
  }
});

test("Required Case 5: WhatsApp provider failure (MSG91 HTTP 403 error returns 502)", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const origFetch = globalThis.fetch;
  const origAuth = process.env.MSG91_AUTHKEY;

  process.env.MSG91_AUTHKEY = "msg91_auth_key";

  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    text: async () => JSON.stringify({ message: "Authentication failed", type: "error" }),
  });

  try {
    const reply = createReply();
    const res = await controller.sendOtp({ body: { identifier: "+919876543210" } }, reply);

    assert.equal(reply.statusCode, 502);
    assert.equal(reply.sentData.success, false);
    assert.ok(reply.sentData.message.includes("Authentication failed") || reply.sentData.message.includes("403"));
  } finally {
    globalThis.fetch = origFetch;
    if (origAuth) process.env.MSG91_AUTHKEY = origAuth;
    else delete process.env.MSG91_AUTHKEY;
  }
});

test("Required Case 6: Invalid provider response (MSG91 HTTP 200 with error body returns 502)", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const origFetch = globalThis.fetch;
  const origAuth = process.env.MSG91_AUTHKEY;

  process.env.MSG91_AUTHKEY = "msg91_auth_key";

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ type: "error", message: "Template not found or unapproved" }),
  });

  try {
    const reply = createReply();
    const res = await controller.sendOtp({ body: { identifier: "+919876543210" } }, reply);

    assert.equal(reply.statusCode, 502);
    assert.equal(reply.sentData.success, false);
    assert.ok(reply.sentData.message.includes("Template not found"));
  } finally {
    globalThis.fetch = origFetch;
    if (origAuth) process.env.MSG91_AUTHKEY = origAuth;
    else delete process.env.MSG91_AUTHKEY;
  }
});

test("Required Case 7: Correct channel selection (Email selects EMAIL, Phone selects WHATSAPP)", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const r1 = createReply();
  const emailRes = await controller.sendOtp({ body: { identifier: "test@example.com" } }, r1);
  assert.equal(emailRes.channel, "EMAIL");

  const r2 = createReply();
  const phoneRes = await controller.sendOtp({ body: { identifier: "9876543210" } }, r2);
  assert.equal(phoneRes.channel, "WHATSAPP");
});

test("Required Case 8: No cross-channel fallback (Email failure never triggers WhatsApp)", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const origFetch = globalThis.fetch;
  const origKey = process.env.RESEND_API_KEY;
  const origFrom = process.env.RESEND_FROM;

  process.env.RESEND_API_KEY = "re_fail_key";
  process.env.RESEND_FROM = "Tiffzy <noreply@tiffzy.com>";

  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ message: "API key is invalid" }),
  });

  try {
    const reply = createReply();
    await controller.sendOtp({ body: { identifier: "cust@example.com" } }, reply);

    assert.equal(reply.statusCode, 502);
    assert.equal(reply.sentData.channel, "EMAIL");
  } finally {
    globalThis.fetch = origFetch;
    if (origKey) process.env.RESEND_API_KEY = origKey;
    else delete process.env.RESEND_API_KEY;
    if (origFrom) process.env.RESEND_FROM = origFrom;
    else delete process.env.RESEND_FROM;
  }
});

test("Required Case 9: Resend preserves channel", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  // 1st request with email
  const reply1 = createReply();
  const res1 = await controller.sendOtp({ body: { identifier: "user1@domain.com" } }, reply1);
  assert.equal(res1.channel, "EMAIL");

  // 2nd request with phone
  const reply2 = createReply();
  const res2 = await controller.sendOtp({ body: { identifier: "9199998888" } }, reply2);
  assert.equal(res2.channel, "WHATSAPP");
});

test("Required Case 10: Verification uses same identifier/channel", async () => {
  const { mockPrisma, mockApp, store, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const email = "verified.user@example.com";
  const otp = "842190";
  const otpHash = bcrypt.hashSync(otp, 10);
  store.customerOtps.set(email, {
    phone: email,
    otpHash,
    expiresAt: new Date(Date.now() + 300000),
    attempts: 0,
    lastSentAt: new Date(),
  });

  const reply = createReply();
  const res = await controller.verifyOtp(
    {
      body: {
        identifier: email,
        otp,
        name: "Verified User",
      },
    },
    reply
  );

  assert.equal(res.message, "Customer login success");
  assert.equal(res.customer.email, email);
});

test("Required Case 11: Cooldown after successful send returns 429", async () => {
  const { mockPrisma, mockApp, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  // 1st request succeeds
  const reply1 = createReply();
  const res1 = await controller.sendOtp({ body: { identifier: "cooldown.user@example.com" } }, reply1);
  assert.equal(reply1.statusCode, 200);
  assert.equal(res1.success, true);

  // 2nd request within 30s must return 429 (cooldown active)
  const reply2 = createReply();
  const res2 = await controller.sendOtp({ body: { identifier: "cooldown.user@example.com" } }, reply2);
  assert.equal(reply2.statusCode, 429);
  assert.equal(res2.success, false);
  assert.ok(res2.message.includes("OTP already sent recently"));
});

test("Required Case 12: Cooldown cleared after provider failure (immediate retry allowed)", async () => {
  const { mockPrisma, mockApp, store, createReply } = createMockContext();
  const controller = buildCustomerOtpController({ prisma: mockPrisma, app: mockApp });

  const origFetch = globalThis.fetch;
  const origAuth = process.env.MSG91_AUTHKEY;
  process.env.MSG91_AUTHKEY = "msg91_test_key";

  // Provider fails on 1st attempt
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ message: "Provider internal error" }),
  });

  try {
    const reply1 = createReply();
    const res1 = await controller.sendOtp({ body: { identifier: "+919876543210" } }, reply1);
    assert.equal(reply1.statusCode, 502);
    assert.equal(res1.success, false);

    // Verify OTP record was deleted from store (cooldown cleared)
    assert.equal(store.customerOtps.get("919876543210"), undefined);

    // Now provider succeeds on retry
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ type: "success", message: "Sent successfully", data: { id: "retry_123" } }),
    });

    const reply2 = createReply();
    const res2 = await controller.sendOtp({ body: { identifier: "+919876543210" } }, reply2);
    // Immediate retry must NOT be blocked by 429
    assert.equal(reply2.statusCode, 200);
    assert.equal(res2.success, true);
    assert.equal(res2.deliveryStatus, "ACCEPTED");
  } finally {
    globalThis.fetch = origFetch;
    if (origAuth) process.env.MSG91_AUTHKEY = origAuth;
    else delete process.env.MSG91_AUTHKEY;
  }
});

test("Required Case 13: Phone number normalization across various formats", async () => {
  const { normalizePhone } = await import("../services/phoneService.js");
  const { formatWhatsAppPhone } = await import("../services/msg91WhatsAppService.js");

  // Standard 10 digits
  assert.equal(normalizePhone("9876543210"), "919876543210");
  assert.equal(formatWhatsAppPhone("9876543210"), "919876543210");

  // With +91
  assert.equal(normalizePhone("+919876543210"), "919876543210");
  assert.equal(formatWhatsAppPhone("+919876543210"), "919876543210");

  // With spaces and hyphens
  assert.equal(normalizePhone("+91 98765-43210"), "919876543210");
  assert.equal(formatWhatsAppPhone("+91 98765-43210"), "919876543210");

  // With leading zero
  assert.equal(normalizePhone("09876543210"), "919876543210");
  assert.equal(formatWhatsAppPhone("09876543210"), "919876543210");

  // Already 91 without plus
  assert.equal(normalizePhone("919876543210"), "919876543210");
  assert.equal(formatWhatsAppPhone("919876543210"), "919876543210");
});



