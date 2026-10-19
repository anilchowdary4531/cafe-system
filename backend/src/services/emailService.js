import nodemailer from "nodemailer";

export const maskEmail = (emailStr) => {
  const str = String(emailStr || "").trim().toLowerCase();
  if (!str || !str.includes("@")) return "";
  const [name, domain] = str.split("@");
  if (!name) return "";
  const maskedName = name.length <= 2 ? `${name[0]}****` : `${name[0]}****${name[name.length - 1]}`;
  return `${maskedName}@${domain}`;
};

export const sendEmailOtp = async ({ email, otp, expiresAt } = {}) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const maskedEmail = maskEmail(normalizedEmail);
  if (!normalizedEmail) return { ok: false, skipped: true, providerAccepted: false, error: "Recipient email is required" };

  const nodeEnv = String(process.env.NODE_ENV || "development").trim() || "development";
  const strict = String(process.env.EMAIL_STRICT || "").toLowerCase() === "true";
  const subject = String(process.env.OTP_EMAIL_SUBJECT || "Your verification code").trim() || "Your verification code";
  const forceSimulate = String(process.env.EMAIL_SIMULATE || process.env.ALLOW_SIMULATED_OTP || "").toLowerCase() === "true";

  if (forceSimulate) {
    // Safe diagnostic log
    // eslint-disable-next-line no-console
    console.log(`[OTP DELIVERY]\nchannel=EMAIL\nidentifierType=EMAIL\ndestination=${maskedEmail}\nprovider=simulated\nproviderStatus=200\nproviderMessageId=sim_${Date.now()}\nproviderAccepted=true`);
    return {
      ok: true,
      simulated: true,
      provider: "simulated",
      providerAccepted: true,
      messageId: `sim_${Date.now()}`,
    };
  }

  const otpValue = String(otp || "").trim();
  const expiresText = expiresAt ? new Date(expiresAt).toLocaleString() : "";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">Verification code</h2>
      <p style="margin: 0 0 12px;">Use this one-time code to continue:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 0 0 14px;">${otpValue}</p>
      ${expiresText ? `<p style="margin: 0; color: #6b7280; font-size: 12px;">Expires: ${expiresText}</p>` : ""}
      <p style="margin: 14px 0 0; color: #6b7280; font-size: 12px;">If you didn’t request this code, you can ignore this email.</p>
    </div>
  `.trim();

  // 1. Check for SMTP / Nodemailer configuration
  const smtpHost = String(process.env.SMTP_HOST || process.env.MAIL_HOST || "").trim();
  const smtpUser = String(process.env.SMTP_USER || process.env.EMAIL_USER || process.env.MAIL_USER || process.env.GMAIL_USER || "").trim();
  const smtpPass = String(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.MAIL_PASS || process.env.GMAIL_APP_PASSWORD || "").trim();
  const smtpPort = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || (process.env.SMTP_SECURE === "true" ? 465 : 587));
  const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;
  const fromAddress = String(process.env.SMTP_FROM || process.env.RESEND_FROM || process.env.EMAIL_FROM || `"Tiffzy" <noreply@tiffzy.com>`).trim();

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: normalizedEmail,
        subject,
        html,
      });

      // Safe diagnostic log
      // eslint-disable-next-line no-console
      console.log(`[OTP DELIVERY]\nchannel=EMAIL\nidentifierType=EMAIL\ndestination=${maskedEmail}\nprovider=smtp\nproviderStatus=250\nproviderMessageId=${info.messageId || "accepted"}\nproviderAccepted=true`);
      return {
        ok: true,
        provider: "smtp",
        providerAccepted: true,
        status: 250,
        messageId: info.messageId,
      };
    } catch (err) {
      // Safe diagnostic log
      // eslint-disable-next-line no-console
      console.error(`[OTP DELIVERY]\nchannel=EMAIL\nidentifierType=EMAIL\ndestination=${maskedEmail}\nprovider=smtp\nproviderStatus=${err?.responseCode || 500}\nproviderMessageId=none\nproviderAccepted=false\nerror=${err?.message || "Delivery failed"}`);

      return {
        ok: false,
        provider: "smtp",
        providerAccepted: false,
        status: err?.responseCode || 500,
        error: `SMTP error (${err?.code || "UNKNOWN"}): ${err?.message || "Delivery failed"}`,
        code: err?.code || "SMTP_ERROR",
      };
    }
  }

  // 2. Check for Resend API configuration
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const resendFrom = String(process.env.RESEND_FROM || "").trim();
  const resendReplyTo = String(process.env.RESEND_REPLY_TO || "").trim();

  if (resendApiKey && resendFrom) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [normalizedEmail],
          subject,
          html,
          ...(resendReplyTo ? { reply_to: resendReplyTo } : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const message = (json && (json.message || json.error)) || text || `Resend request failed (${res.status})`;
        // Safe diagnostic log
        // eslint-disable-next-line no-console
        console.error(`[OTP DELIVERY]\nchannel=EMAIL\nidentifierType=EMAIL\ndestination=${maskedEmail}\nprovider=resend\nproviderStatus=${res.status}\nproviderMessageId=none\nproviderAccepted=false\nerror=${message}`);

        return {
          ok: false,
          provider: "resend",
          providerAccepted: false,
          status: res.status,
          error: `Resend error (${res.status}): ${String(message).slice(0, 500)}`,
          code: "PROVIDER_REJECTED",
        };
      }

      const messageId = json?.id || null;
      // Safe diagnostic log
      // eslint-disable-next-line no-console
      console.log(`[OTP DELIVERY]\nchannel=EMAIL\nidentifierType=EMAIL\ndestination=${maskedEmail}\nprovider=resend\nproviderStatus=${res.status}\nproviderMessageId=${messageId || "accepted"}\nproviderAccepted=true`);
      return {
        ok: true,
        provider: "resend",
        providerAccepted: true,
        status: res.status,
        messageId,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === "AbortError";
      const errMsg = isTimeout ? "Resend request timed out after 10s" : `Resend error: ${err?.message || String(err)}`;

      // Safe diagnostic log
      // eslint-disable-next-line no-console
      console.error(`[OTP DELIVERY]\nchannel=EMAIL\nidentifierType=EMAIL\ndestination=${maskedEmail}\nprovider=resend\nproviderStatus=${isTimeout ? "timeout" : "network_error"}\nproviderMessageId=none\nproviderAccepted=false\nerror=${errMsg}`);

      return {
        ok: false,
        provider: "resend",
        providerAccepted: false,
        status: isTimeout ? 504 : 500,
        error: errMsg,
        code: isTimeout ? "PROVIDER_TIMEOUT" : "NETWORK_ERROR",
      };
    }
  }

  // 3. Fallback when neither SMTP nor Resend is configured
  if (nodeEnv !== "production" && !strict) {
    // Safe diagnostic log
    // eslint-disable-next-line no-console
    console.log(`[OTP DELIVERY]\nchannel=EMAIL\nidentifierType=EMAIL\ndestination=${maskedEmail}\nprovider=simulated\nproviderStatus=200\nproviderMessageId=sim_${Date.now()}\nproviderAccepted=true\nreason=email_provider_not_configured`);
    return {
      ok: true,
      simulated: true,
      provider: "simulated",
      providerAccepted: true,
      messageId: `sim_${Date.now()}`,
      reason: "email_provider_not_configured",
    };
  }

  // Safe diagnostic log
  // eslint-disable-next-line no-console
  console.error(`[OTP DELIVERY]\nchannel=EMAIL\nidentifierType=EMAIL\ndestination=${maskedEmail}\nprovider=none\nproviderStatus=none\nproviderMessageId=none\nproviderAccepted=false\nerror=Email provider not configured`);

  return {
    ok: false,
    provider: "none",
    providerAccepted: false,
    error: "Email provider not configured (missing SMTP or RESEND credentials)",
    code: "PROVIDER_NOT_CONFIGURED",
  };
};
