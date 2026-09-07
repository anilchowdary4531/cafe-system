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

export const sendWhatsAppOtp = async ({ phone, otp, expiresAt } = {}) => {
  const formattedPhone = formatWhatsAppPhone(phone);
  if (!formattedPhone) return { ok: false, skipped: true, error: "Recipient phone number is required" };

  const authkey = String(
    process.env.MSG91_AUTHKEY ||
    process.env.MSG91_AUTH_KEY ||
    process.env.MSG91_WIDGET_AUTHKEY ||
    ""
  ).trim();

  const integratedNumber = String(
    process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER || "918143106178"
  ).trim();

  // Safe server logging (NEVER log AuthKey or OTP)
  // eslint-disable-next-line no-console
  console.log("[msg91WhatsApp] send started");
  // eslint-disable-next-line no-console
  console.log(`[msg91WhatsApp] authkey configured: ${Boolean(authkey)}`);

  if (!authkey) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[msg91WhatsApp] MSG91_AUTHKEY missing in process.env - returning simulated dev status");
      return { ok: true, simulated: true, reason: "msg91_authkey_missing" };
    }
    return { ok: false, error: "MSG91_AUTHKEY is not configured on the server" };
  }

  const otpValue = String(otp || "").trim();
  if (!otpValue) return { ok: false, error: "OTP value is required" };

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

  // eslint-disable-next-line no-console
  console.log("[msg91WhatsApp] MSG91 request sent");

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

    // eslint-disable-next-line no-console
    console.log(`[msg91WhatsApp] MSG91 HTTP status: ${res.status}`);
    // eslint-disable-next-line no-console
    console.log(`[msg91WhatsApp] MSG91 accepted: ${res.ok}`);

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        (json && (json.message || json.error || json.type)) ||
        `MSG91 WhatsApp API returned HTTP ${res.status}`;
      return {
        ok: false,
        status: res.status,
        error: msg,
        simulated: false,
      };
    }

    return {
      ok: true,
      provider: "msg91_whatsapp",
      status: res.status,
      json,
      simulated: false,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === "AbortError";
    const errMsg = isTimeout ? "MSG91 WhatsApp request timed out after 10s" : `MSG91 WhatsApp error: ${err?.message || String(err)}`;
    // eslint-disable-next-line no-console
    console.log(`[msg91WhatsApp] Request error: ${errMsg}`);
    return { ok: false, error: errMsg, simulated: false };
  }
};
