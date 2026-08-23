import { normalizePhone } from "../services/phoneService.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";
import { sendEmailOtp } from "../services/emailService.js";
import { sendSmsOtp } from "../services/smsService.js";
import { upsertCustomerAccount } from "../services/customerProfileService.js";
import { extractVerifiedIdentifier, verifyMsg91AccessToken } from "../services/msg91OtpWidgetService.js";

export const buildCustomerOtpController = ({ prisma, app }) => {
  const sendOtp = async (req, reply) => {
    console.log("========== AUTH REQUEST ==========");
    console.log("URL:", req.url);
    console.log("Method:", req.method);
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("==================================");
    try {
      const body = req.body || {};
      let phone = normalizePhone(body.phone || "");
      const email = String(body.email || "").trim().toLowerCase();

      // If no phone but email is provided, we use email as the identifier
      if (!phone && email) {
        phone = email;
      }

      if (!phone) return reply.code(400).send({ message: "Phone number or Email is required" });

      const otpRes = await requestOtp({ prisma, phone });
      if (!otpRes.ok) return reply.code(otpRes.status).send(otpRes.payload);

      const devOtp = otpRes.devOtp || "";
      const otpToSend = otpRes.code;

      // Send OTP to available channels. If both exist -> both.
      const [smsRes, emailRes] = await Promise.all([
        sendSmsOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }),
        email ? sendEmailOtp({ email, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
      ]);

      if (process.env.NODE_ENV === "production") {
        // eslint-disable-next-line no-console
        console.log("[customerOtpController] otp_delivery", { phone, smsRes, emailProvided: Boolean(email), emailRes });
      }

      const deliveredBySms = Boolean(smsRes && smsRes.ok !== false && !smsRes.skipped);
      const deliveredByEmail = Boolean(emailRes && emailRes.ok !== false && !emailRes.skipped);
      const delivered = deliveredBySms || deliveredByEmail;

      if (!delivered) {
        const smsErr = smsRes && smsRes.ok === false ? smsRes.error : null;
        const emailErr = emailRes && emailRes.ok === false ? emailRes.error : null;
        const primaryErr = email ? emailErr || smsErr : smsErr || emailErr;
        const hint = email
          ? "Please retry after a moment."
          : "Provide an email (optional) or configure SMS provider and retry.";

        return reply.code(502).send({
          message: primaryErr || "Failed to send OTP",
          hint,
        });
      }

      const payload = {
        message: "OTP sent",
        phone,
        expiresAt: otpRes.expiresAt,
      };
      if (devOtp) payload.devOtp = devOtp;
      if (process.env.NODE_ENV !== "production") {
        payload.delivery = {
          sms: smsRes ? { ok: smsRes.ok !== false, simulated: Boolean(smsRes.simulated) } : null,
          email: emailRes ? { ok: emailRes.ok !== false, simulated: Boolean(emailRes.simulated), skipped: Boolean(emailRes.skipped) } : null,
        };
      }
      return payload;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to send OTP" });
    }
  };

  const verifyOtpHandler = async (req, reply) => {
    try {
      const body = req.body || {};
      let phone = normalizePhone(body.phone || "");
      const accessToken = String(body.accessToken || body.access_token || "").trim();
      const otp = String(body.otp || "").trim();
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();

      if (!phone && email) {
        phone = email;
      }

      if (!phone) return reply.code(400).send({ message: "Phone number or Email is required" });
      if (!accessToken && !otp) return reply.code(400).send({ message: "OTP (or accessToken) is required" });

      if (accessToken) {
        const verified = await verifyMsg91AccessToken({ accessToken });
        if (!verified.ok) return reply.code(verified.status).send(verified.payload);

        const identifier = extractVerifiedIdentifier(verified.data);
        const verifiedDigits = identifier.replace(/[^\d]/g, "");
        const normalizedVerifiedPhone =
          verifiedDigits.length > 10 && verifiedDigits.startsWith("91") ? verifiedDigits.slice(2) : verifiedDigits;

        if (normalizedVerifiedPhone && normalizePhone(normalizedVerifiedPhone) !== phone) {
          return reply.code(401).send({ message: "OTP verification mismatch. Please retry with the same phone number." });
        }
      } else {
        const okRes = await verifyOtp({ prisma, phone, otp });
        if (!okRes.ok) return reply.code(okRes.status).send(okRes.payload);
      }

      const account = await upsertCustomerAccount({ prisma, phone, name, email });

      const token = app.jwt.sign(
        {
          type: "customer",
          phone: account.phone || account.email || phone,
          customerAccountId: account.id,
        },
        { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || "30d" }
      );

      return {
        message: "Customer login success",
        token,
        customer: account,
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Customer login failed" });
    }
  };

  return {
    sendOtp,
    verifyOtp: verifyOtpHandler,
  };
};
