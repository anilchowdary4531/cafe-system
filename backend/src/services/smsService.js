export const sendSmsOtp = async ({ phone, otp, expiresAt } = {}) => {
  const normalizedPhone = String(phone || "").trim();
  if (!normalizedPhone) return { ok: false, skipped: true };

  // In development we default to logging the OTP (so local setup works without a provider).
  // If you want *real* SMS in non-production (staging/dev), set SMS_SEND_IN_DEV=true and configure MSG91 env vars.
  const nodeEnv = String(process.env.NODE_ENV || "development").trim() || "development";
  const sendInDev = String(process.env.SMS_SEND_IN_DEV || "").toLowerCase() === "true";
  const sendInDevUntilRaw = String(process.env.SMS_SEND_IN_DEV_UNTIL || "").trim();
  let sendInDevUntilMs = null;
  if (sendInDevUntilRaw) {
    const parsed = new Date(sendInDevUntilRaw).getTime();
    sendInDevUntilMs = Number.isNaN(parsed) ? null : parsed;
  }

  const devSendAllowed = sendInDev && (!sendInDevUntilMs || Date.now() < sendInDevUntilMs);

  if (nodeEnv !== "production" && !devSendAllowed) {
    // eslint-disable-next-line no-console
    console.log(`[smsService] OTP to ${normalizedPhone}: ${otp} (expires ${expiresAt})`);
    return { ok: true, simulated: true };
  }

  // MSG91 integration (recommended).
  //
  // IMPORTANT:
  // This app generates the OTP server-side (see otpService/authOtpService) and verifies it locally.
  // Therefore the SMS provider must send *the same OTP value*.
  // - If you use MSG91 "Flow" API, we pass OTP variables into the flow.
  // - If you use MSG91 "SendOTP" API, we explicitly pass `otp=<value>` so provider doesn't generate a different code.
  //
  // We send the OTP via MSG91 "Flow" API (template variables are configured in MSG91).
  //
  // Env:
  // - MSG91_AUTHKEY or MSG91_AUTH_KEY (required)
  // - MSG91_FLOW_ID or MSG91_TEMPLATE_ID (required)  (MSG91 flow_id / template id)
  // - MSG91_MODE=otp to use SendOTP API instead of Flow
  // - MSG91_OTP_TEMPLATE_ID (required when MSG91_MODE=otp; falls back to MSG91_TEMPLATE_ID)
  // - MSG91_SENDER_ID (optional; include only if your flow expects it)
  // - SMS_STRICT=true to hard-fail if provider isn't configured
  const strict = String(process.env.SMS_STRICT || "").toLowerCase() === "true";

  // Backward-compatible env var names (repo already uses MSG91_AUTH_KEY + MSG91_TEMPLATE_ID in places).
  const authkey = String(process.env.MSG91_AUTHKEY || process.env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY || "").trim();
  const mode = String(process.env.MSG91_MODE || "flow").trim().toLowerCase() || "flow";
  const flowId = String(process.env.MSG91_FLOW_ID || process.env.MSG91_TEMPLATE_ID || "").trim();
  const otpTemplateId = String(process.env.MSG91_OTP_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID || "").trim();
  const senderId = String(process.env.MSG91_SENDER_ID || "").trim();

  const missingTemplate = mode === "otp" ? !otpTemplateId : !flowId;
  if (!authkey || missingTemplate) {
    if (nodeEnv !== "production" && sendInDev) {
      // eslint-disable-next-line no-console
      console.log(
        `[smsService] SMS_SEND_IN_DEV=true but MSG91 is not configured; falling back to console OTP log for ${normalizedPhone}`
      );
      // eslint-disable-next-line no-console
      console.log(`[smsService] OTP to ${normalizedPhone}: ${otp} (expires ${expiresAt})`);
      return { ok: true, simulated: true, reason: "msg91_not_configured" };
    }
    return {
      ok: false,
      error:
        mode === "otp"
          ? "MSG91 is not configured for SendOTP (missing MSG91_AUTHKEY/MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID/MSG91_TEMPLATE_ID)"
          : "MSG91 is not configured (missing MSG91_AUTHKEY/MSG91_AUTH_KEY and MSG91_FLOW_ID/MSG91_TEMPLATE_ID)",
      strict,
    };
  }

  // MSG91 expects country code included. App normalizes phone to 10-digit India numbers.
  const mobiles = normalizedPhone.length === 10 ? `91${normalizedPhone}` : normalizedPhone;

  try {
    const otpValue = String(otp || "").trim();

    let res;
    if (mode === "otp") {
      // MSG91 SendOTP V5 API.
      // Endpoint per MSG91 help: https://api.msg91.com/api/v5/otp
      const url = new URL("https://api.msg91.com/api/v5/otp");
      url.searchParams.set("template_id", otpTemplateId);
      url.searchParams.set("mobile", mobiles);
      // Ensure provider sends OUR OTP (do not let MSG91 generate a different code).
      if (otpValue) url.searchParams.set("otp", otpValue);
      // Some MSG91 setups require sender param even for OTP API.
      if (senderId) url.searchParams.set("sender", senderId);

      res = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          authkey,
        },
      });
    } else {
      // MSG91 "Send SMS via Flow" expects a `recipients` array, with `mobiles` inside each item.
      // Ref: https://api.msg91.com/apidoc/textsms/send-sms-flow.php
      const payload = {
        flow_id: flowId,
        ...(senderId ? { sender: senderId } : {}),
        recipients: [
          {
            mobiles,
            // Common variable names used in MSG91 flows; keep both for compatibility.
            OTP: otpValue,
            otp: otpValue,
          },
        ],
      };

      res = await fetch("https://api.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          authkey,
        },
        body: JSON.stringify(payload),
      });
    }

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        error:
          (json && (json.message || json.error || json.type)) ||
          `MSG91 request failed (${res.status}): ${text.slice(0, 500)}`,
      };
    }

    return { ok: true, provider: "msg91", mode, status: res.status, json, raw: text };
  } catch (err) {
    return { ok: false, error: `MSG91 error: ${err?.message || String(err)}` };
  }
};
