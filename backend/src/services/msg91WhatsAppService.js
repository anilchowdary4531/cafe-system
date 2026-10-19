export const formatWhatsAppPhone = (raw) => {
  const input = String(raw || "").trim();
  if (!input) return "";
  let digits = input.replace(/[^\d]/g, "");
  if (!digits) return "";
  // Fix triple 919191 or double 9191 prefix if length > 12
  if (digits.length === 14 && digits.startsWith("9191")) {
    digits = digits.slice(2);
  }
  // Remove leading 0 if 11 digits (e.g. 09133222614 -> 9133222614)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  // Prepend India country code 91 if 10 digits (e.g. 9133222614 -> 919133222614)
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
};

export const maskPhone = (phoneStr) => {
  const str = String(phoneStr || "").trim();
  if (!str) return "";
  const digits = str.replace(/[^\d]/g, "");
  if (!digits) return "";
  const last4 = digits.slice(-4);
  return `******${last4}`;
};

export const sendWhatsAppOtp = async ({ phone, otp, expiresAt } = {}) => {
  const formattedPhone = formatWhatsAppPhone(phone);
  const maskedDestination = maskPhone(formattedPhone || phone);
  if (!formattedPhone) return { ok: false, skipped: true, providerAccepted: false, error: "Recipient phone number is required" };

  const nodeEnv = String(process.env.NODE_ENV || "development").trim() || "development";
  const strict = String(process.env.WHATSAPP_STRICT || "").toLowerCase() === "true";
  const forceSimulate = String(process.env.WHATSAPP_SIMULATE || process.env.ALLOW_SIMULATED_OTP || "").toLowerCase() === "true";

  if (forceSimulate) {
    // eslint-disable-next-line no-console
    console.log(`[OTP DELIVERY]\nchannel=WHATSAPP\ndestination=${maskedDestination}\nprovider=simulated\nproviderStatus=200\nproviderMessageId=sim_${Date.now()}\nproviderAccepted=true`);
    return {
      ok: true,
      simulated: true,
      provider: "simulated",
      providerAccepted: true,
      messageId: `sim_${Date.now()}`,
    };
  }

  const authkey = String(
    process.env.MSG91_AUTHKEY ||
    process.env.MSG91_AUTH_KEY ||
    process.env.MSG91_WIDGET_AUTHKEY ||
    ""
  ).trim();

  const integratedNumber = String(
    process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER || "918143106178"
  ).trim();

  if (!authkey) {
    if (nodeEnv !== "production" && !strict) {
      // Safe diagnostic log
      // eslint-disable-next-line no-console
      console.log(`[OTP DELIVERY]\nchannel=WHATSAPP\ndestination=${maskedDestination}\nprovider=simulated\nproviderStatus=200\nproviderMessageId=sim_${Date.now()}\nproviderAccepted=true\nreason=msg91_authkey_missing`);
      return {
        ok: true,
        simulated: true,
        provider: "simulated",
        providerAccepted: true,
        messageId: `sim_${Date.now()}`,
        reason: "msg91_authkey_missing",
      };
    }

    // Safe diagnostic log
    // eslint-disable-next-line no-console
    console.error(`[OTP DELIVERY]\nchannel=WHATSAPP\ndestination=${maskedDestination}\nprovider=msg91_whatsapp\nproviderStatus=none\nproviderMessageId=none\nproviderAccepted=false\nerror=MSG91_AUTHKEY is not configured on the server`);

    return {
      ok: false,
      provider: "msg91_whatsapp",
      providerAccepted: false,
      error: "MSG91_AUTHKEY is not configured on the server",
      code: "PROVIDER_NOT_CONFIGURED",
    };
  }

  const otpValue = String(otp || "").trim();
  if (!otpValue) return { ok: false, error: "OTP value is required", providerAccepted: false };

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: "tiffzy_login_otp",
        language: {
          code: "en",
          policy: "deterministic",
        },
        namespace: null,
        to_and_components: [
          {
            to: [formattedPhone],
            components: {
              body_1: {
                type: "text",
                value: otpValue,
              },
              button_1: {
                subtype: "url",
                type: "text",
                value: otpValue,
              },
            },
          },
        ],
      },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          authkey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const hasProviderError =
      !res.ok ||
      Boolean(
        json &&
        (json.type === "error" ||
          json.status === "error" ||
          json.hasError === true ||
          (json.status && String(json.status).toLowerCase() === "fail"))
      );

    if (hasProviderError) {
      const msg =
        (json && (json.message || json.error || json.type)) ||
        text ||
        `MSG91 WhatsApp API returned HTTP ${res.status}`;

      // Safe diagnostic log
      // eslint-disable-next-line no-console
      console.error(`[OTP DELIVERY]\nchannel=WHATSAPP\ndestination=${maskedDestination}\nprovider=msg91_whatsapp\nproviderStatus=${res.status}\nproviderMessageId=none\nproviderAccepted=false\nerror=${msg}`);

      return {
        ok: false,
        provider: "msg91_whatsapp",
        providerAccepted: false,
        status: res.status,
        error: String(msg).slice(0, 500),
        code: "PROVIDER_REJECTED",
      };
    }

    const messageId =
      json?.data?.id ||
      json?.request_id ||
      json?.message_id ||
      json?.id ||
      (Array.isArray(json?.data) && json.data[0]?.id) ||
      "accepted";

    // Safe diagnostic log
    // eslint-disable-next-line no-console
    console.log(`[OTP DELIVERY]\nchannel=WHATSAPP\ndestination=${maskedDestination}\nprovider=msg91_whatsapp\nproviderStatus=${res.status}\nproviderMessageId=${messageId}\nproviderAccepted=true`);

    return {
      ok: true,
      provider: "msg91_whatsapp",
      providerAccepted: true,
      status: res.status,
      messageId,
      json,
      simulated: false,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === "AbortError";
    const errMsg = isTimeout
      ? "MSG91 WhatsApp request timed out after 10s"
      : `MSG91 WhatsApp error: ${err?.message || String(err)}`;

    // Safe diagnostic log
    // eslint-disable-next-line no-console
    console.error(`[OTP DELIVERY]\nchannel=WHATSAPP\ndestination=${maskedDestination}\nprovider=msg91_whatsapp\nproviderStatus=${isTimeout ? "timeout" : "network_error"}\nproviderMessageId=none\nproviderAccepted=false\nerror=${errMsg}`);

    return {
      ok: false,
      provider: "msg91_whatsapp",
      providerAccepted: false,
      status: isTimeout ? 504 : 500,
      error: errMsg,
      code: isTimeout ? "PROVIDER_TIMEOUT" : "NETWORK_ERROR",
    };
  }
};
