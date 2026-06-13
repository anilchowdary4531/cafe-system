const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

const sendResendEmail = async ({ to, subject, html } = {}) => {
  const normalizedTo = Array.isArray(to)
    ? to.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [String(to || "").trim().toLowerCase()].filter(Boolean);

  if (!normalizedTo.length) return { ok: false, skipped: true };

  const nodeEnv = String(process.env.NODE_ENV || "development").trim() || "development";
  const strict = String(process.env.EMAIL_STRICT || "").toLowerCase() === "true";
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  const replyTo = String(process.env.RESEND_REPLY_TO || "").trim();
  const forceSimulate = String(process.env.EMAIL_SIMULATE || "").toLowerCase() === "true";

  if (forceSimulate) {
    // eslint-disable-next-line no-console
    console.log(`[emailService] Email to ${normalizedTo.join(", ")}: ${subject}`);
    return { ok: true, simulated: true };
  }

  if (!apiKey || !from) {
    if (nodeEnv !== "production") {
      // eslint-disable-next-line no-console
      console.log(`[emailService] Email to ${normalizedTo.join(", ")}: ${subject}`);
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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: normalizedTo,
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

export const sendEmailOtp = async ({ email, otp, expiresAt } = {}) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return { ok: false, skipped: true };

  const subject = String(process.env.OTP_EMAIL_SUBJECT || "Your verification code").trim() || "Your verification code";
  const otpValue = String(otp || "").trim();
  const expiresText = expiresAt ? new Date(expiresAt).toLocaleString() : "";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">Verification code</h2>
      <p style="margin: 0 0 12px;">Use this one-time code to continue:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 0 0 14px;">${escapeHtml(otpValue)}</p>
      ${expiresText ? `<p style="margin: 0; color: #6b7280; font-size: 12px;">Expires: ${escapeHtml(expiresText)}</p>` : ""}
      <p style="margin: 14px 0 0; color: #6b7280; font-size: 12px;">If you didn't request this code, you can ignore this email.</p>
    </div>
  `.trim();

  return sendResendEmail({ to: normalizedEmail, subject, html });
};

export const sendPasswordResetEmail = async ({ email, resetUrl, expiresIn = "30m" } = {}) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return { ok: false, skipped: true };

  const subject = "Reset your Tiffzy password";
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">Reset your password</h2>
      <p style="margin: 0 0 12px;">We received a request to reset the password for <strong>${escapeHtml(normalizedEmail)}</strong>.</p>
      <p style="margin: 0 0 16px;">Click the button below to choose a new password.</p>
      <p style="margin: 0 0 18px;">
        <a href="${escapeHtml(String(resetUrl || ""))}" style="display: inline-block; background: #f97316; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">Reset password</a>
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 12px;">This link expires in ${escapeHtml(String(expiresIn || "30m"))}.</p>
      <p style="margin: 14px 0 0; color: #6b7280; font-size: 12px;">If you did not request this reset, you can safely ignore this email.</p>
    </div>
  `.trim();

  return sendResendEmail({ to: normalizedEmail, subject, html });
};
