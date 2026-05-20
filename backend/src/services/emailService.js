export const sendEmailOtp = async ({ email, otp, expiresAt } = {}) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return { ok: false, skipped: true };

  const nodeEnv = String(process.env.NODE_ENV || "development").trim() || "development";
  const strict = String(process.env.EMAIL_STRICT || "").toLowerCase() === "true";
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  const replyTo = String(process.env.RESEND_REPLY_TO || "").trim();
  const subject = String(process.env.OTP_EMAIL_SUBJECT || "Your verification code").trim() || "Your verification code";
  const forceSimulate = String(process.env.EMAIL_SIMULATE || "").toLowerCase() === "true";

  if (forceSimulate) {
    // eslint-disable-next-line no-console
    console.log(`[emailService] OTP to ${normalizedEmail}: ${otp} (expires ${expiresAt})`);
    return { ok: true, simulated: true };
  }

  if (!apiKey || !from) {
    if (nodeEnv !== "production") {
      // eslint-disable-next-line no-console
      console.log(`[emailService] OTP to ${normalizedEmail}: ${otp} (expires ${expiresAt})`);
      return { ok: true, simulated: true, reason: "resend_not_configured" };
    }
    if (strict) {
      return {
        ok: false,
        error: "Email provider not configured (missing RESEND_API_KEY and/or RESEND_FROM)",
      };
    }
    return { ok: true, skipped: true };
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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [normalizedEmail],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const message = (json && (json.message || json.error)) || text || `Resend request failed (${res.status})`;
      return { ok: false, error: String(message).slice(0, 500), provider: "resend", status: res.status };
    }

    return { ok: true, provider: "resend", id: json?.id || null };
  } catch (err) {
    return { ok: false, error: `Resend error: ${err?.message || String(err)}`, provider: "resend" };
  }
};
