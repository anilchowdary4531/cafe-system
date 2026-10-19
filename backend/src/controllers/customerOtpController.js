import { normalizePhone, getPhoneVariants, isValidName, isValidPhone, isValidMobilePhone } from "../services/phoneService.js";
import { requestOtp, verifyOtp, clearOtpCooldown } from "../services/otpService.js";
import { sendEmailOtp } from "../services/emailService.js";
import { sendWhatsAppOtp } from "../services/msg91WhatsAppService.js";
import { upsertCustomerAccount } from "../services/customerProfileService.js";
import { extractVerifiedIdentifier, verifyMsg91AccessToken } from "../services/msg91OtpWidgetService.js";

export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
};

export const maskEmail = (emailStr) => {
  const str = String(emailStr || "").trim().toLowerCase();
  if (!str || !str.includes("@")) return "";
  const [name, domain] = str.split("@");
  if (!name) return "";
  const maskedName = name.length <= 2 ? `${name[0]}****` : `${name[0]}****${name[name.length - 1]}`;
  return `${maskedName}@${domain}`;
};

export const maskPhone = (phoneStr) => {
  const str = String(phoneStr || "").trim();
  if (!str) return "";
  const digits = str.replace(/[^\d]/g, "");
  if (!digits) return "";
  const last4 = digits.slice(-4);
  return `******${last4}`;
};

const isPlayReviewAccount = (phone) => {
  if (String(process.env.PLAY_REVIEW_ACCOUNT_ENABLED).toLowerCase() !== "true") {
    return false;
  }

  const configuredPhone = normalizePhone(
    String(process.env.PLAY_REVIEW_PHONE || "").trim()
  );

  return Boolean(configuredPhone && phone === configuredPhone);
};

export const buildCustomerOtpController = ({ prisma, app }) => {
  const sendOtp = async (req, reply) => {
    try {
      const body = req.body || {};
      const rawInput = String(
        body.identifier !== undefined && body.identifier !== null && String(body.identifier).trim() !== ""
          ? body.identifier
          : (body.email && !body.phone ? body.email : (body.phone || body.email || ""))
      ).trim();

      if (!rawInput) {
        return reply.code(400).send({ message: "Phone number or Email is required" });
      }

      let channel = "";
      let destination = "";
      let identifierType = "";

      if (isValidEmail(rawInput)) {
        channel = "EMAIL";
        identifierType = "EMAIL";
        destination = rawInput.toLowerCase();
      } else if (isValidMobilePhone(rawInput) || isValidPhone(rawInput)) {
        channel = "WHATSAPP";
        identifierType = "MOBILE";
        destination = normalizePhone(rawInput);
      } else {
        return reply.code(400).send({ message: "Please enter a valid email address or mobile phone number" });
      }

      // DO NOT use stored customer profile phone/email to override channel or destination.
      // Lookup customer account ONLY for greeting/existingName.
      let account = null;
      let phoneVariants = [];
      if (channel === "EMAIL") {
        account = await prisma.customerAccount.findFirst({
          where: { email: destination },
        });
      } else {
        phoneVariants = getPhoneVariants(destination);
        account = await prisma.customerAccount.findFirst({
          where: {
            OR: [
              ...(phoneVariants.length > 0
                ? [
                    { phone: { in: phoneVariants } },
                    { username: { in: phoneVariants } },
                  ]
                : []),
              { phone: destination },
              { username: destination },
            ],
          },
        });
      }

      if (channel === "WHATSAPP" && isPlayReviewAccount(destination)) {
        let existingName = null;
        if (account) {
          if (isValidName(account.name)) {
            existingName = account.name.trim();
          } else if (isValidName(account.username)) {
            existingName = account.username.trim();
          }
        }

        return {
          success: true,
          channel: "WHATSAPP",
          identifierType: "MOBILE",
          destination,
          maskedDestination: maskPhone(destination),
          message: "OTP sent",
          phone: destination,
          email: null,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          hasName: Boolean(existingName),
          existingName,
          delivery: {
            whatsApp: { ok: true, simulated: true },
            sms: { ok: true, simulated: true },
            email: null,
          },
        };
      }

      const otpRes = await requestOtp({ prisma, phone: destination });
      if (!otpRes.ok) return reply.code(otpRes.status).send(otpRes.payload);

      const devOtp = otpRes.devOtp || "";
      const otpToSend = otpRes.code;

      let whatsAppRes = null;
      let emailRes = null;

      if (channel === "EMAIL") {
        emailRes = await sendEmailOtp({
          email: destination,
          otp: otpToSend || devOtp,
          expiresAt: otpRes.expiresAt,
        });

        const isAllowedEmailSimulated = Boolean(
          emailRes?.simulated &&
          (process.env.ALLOW_SIMULATED_OTP === "true" || process.env.NODE_ENV === "test")
        );

        const deliveredByEmail = Boolean(
          emailRes &&
          emailRes.ok === true &&
          emailRes.providerAccepted !== false &&
          !emailRes.skipped &&
          (!emailRes.simulated || isAllowedEmailSimulated)
        );

        if (!deliveredByEmail) {
          await clearOtpCooldown({ prisma, phone: destination });

          const emailErr =
            (emailRes?.simulated && !isAllowedEmailSimulated)
              ? "Email provider not configured (missing or invalid credentials). Message could not be sent."
              : (emailRes?.error || "Failed to deliver OTP to email. Provider request was not accepted.");

          return reply.code(502).send({
            success: false,
            channel: "EMAIL",
            message: emailErr,
            code: emailRes?.code || "EMAIL_DELIVERY_FAILED",
            provider: emailRes?.provider || "resend",
            hint: "Please verify your email address or retry after a moment.",
          });
        }
      } else {
        whatsAppRes = await sendWhatsAppOtp({
          phone: destination,
          otp: otpToSend || devOtp,
          expiresAt: otpRes.expiresAt,
        });

        const isAllowedWhatsAppSimulated = Boolean(
          whatsAppRes?.simulated &&
          (process.env.ALLOW_SIMULATED_OTP === "true" || process.env.NODE_ENV === "test")
        );

        const deliveredByWhatsApp = Boolean(
          whatsAppRes &&
          whatsAppRes.ok === true &&
          whatsAppRes.providerAccepted !== false &&
          !whatsAppRes.skipped &&
          (!whatsAppRes.simulated || isAllowedWhatsAppSimulated)
        );

        if (!deliveredByWhatsApp) {
          await clearOtpCooldown({ prisma, phone: destination });

          const waErr =
            (whatsAppRes?.simulated && !isAllowedWhatsAppSimulated)
              ? "WhatsApp provider not configured (missing MSG91_AUTHKEY on server). Message could not be sent."
              : (whatsAppRes?.error || "Failed to deliver WhatsApp OTP. Provider request was not accepted.");

          return reply.code(502).send({
            success: false,
            channel: "WHATSAPP",
            message: waErr,
            code: whatsAppRes?.code || "WHATSAPP_DELIVERY_FAILED",
            provider: whatsAppRes?.provider || "msg91_whatsapp",
            hint: "Verify your WhatsApp number and retry after a moment.",
          });
        }
      }

      let existingName = null;
      if (account) {
        if (isValidName(account.name)) {
          existingName = account.name.trim();
        } else if (isValidName(account.username)) {
          existingName = account.username.trim();
        }
      }

      if (!existingName && phoneVariants.length > 0) {
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            phone: { in: phoneVariants },
            name: { not: null },
          },
          select: { name: true },
        });

        if (existingCustomer && isValidName(existingCustomer.name)) {
          existingName = existingCustomer.name.trim();
        }
      }

      if (!existingName && (phoneVariants.length > 0 || channel === "EMAIL")) {
        const lastOrderWithName = await prisma.order.findFirst({
          where: {
            OR: [
              ...(phoneVariants.length > 0 ? [{ phone: { in: phoneVariants } }] : []),
              ...(channel === "EMAIL" ? [{ email: destination }] : []),
            ],
            customerName: { not: "" },
          },
          orderBy: { createdAt: "desc" },
          select: { customerName: true },
        });

        if (lastOrderWithName && isValidName(lastOrderWithName.customerName)) {
          existingName = lastOrderWithName.customerName.trim();
        }
      }

      if (account && existingName && !isValidName(account.name)) {
        try {
          await prisma.customerAccount.update({
            where: { id: account.id },
            data: { name: existingName },
          });
        } catch {
          // ignore
        }
      }

      const hasName = Boolean(existingName);
      const maskedDestination = channel === "EMAIL" ? maskEmail(destination) : maskPhone(destination);
      const isSimulated = Boolean(
        (channel === "EMAIL" && emailRes?.simulated) ||
        (channel === "WHATSAPP" && whatsAppRes?.simulated)
      );

      const successMessage = isSimulated
        ? `[Dev Simulation] OTP generated for ${maskedDestination}`
        : channel === "EMAIL"
        ? `OTP request accepted by email provider; sent to ${maskedDestination}`
        : `OTP request accepted by WhatsApp provider; sent to ${maskedDestination}`;

      const payload = {
        success: true,
        channel,
        identifierType,
        destination,
        maskedDestination,
        message: successMessage,
        deliveryStatus: isSimulated ? "SIMULATED" : "ACCEPTED",
        phone: channel === "WHATSAPP" ? destination : "",
        email: channel === "EMAIL" ? destination : null,
        expiresAt: otpRes.expiresAt,
        hasName,
        existingName,
        delivery: {
          whatsApp: whatsAppRes
            ? {
                ok: whatsAppRes.ok === true,
                accepted: Boolean(whatsAppRes.providerAccepted),
                simulated: Boolean(whatsAppRes.simulated),
                provider: whatsAppRes.provider,
                messageId: whatsAppRes.messageId || null,
              }
            : null,
          sms: null,
          email: emailRes
            ? {
                ok: emailRes.ok === true,
                accepted: Boolean(emailRes.providerAccepted),
                simulated: Boolean(emailRes.simulated),
                provider: emailRes.provider,
                messageId: emailRes.messageId || null,
              }
            : null,
        },
      };
      if (devOtp && process.env.NODE_ENV !== "production") payload.devOtp = devOtp;
      return payload;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[customerOtpController.sendOtp] Error:", {
        message: err?.message,
        code: err?.code,
      });
      return reply.code(500).send({ message: "Failed to send OTP" });
    }
  };

  const verifyOtpHandler = async (req, reply) => {
    try {
      const body = req.body || {};
      const rawIdentifier = String(
        body.identifier !== undefined && body.identifier !== null && String(body.identifier).trim() !== ""
          ? body.identifier
          : (body.channel === "EMAIL" ? body.email : (body.phone || body.email)) || ""
      ).trim();

      const accessToken = String(body.accessToken || body.access_token || "").trim();
      const otp = String(body.otp || "").trim();
      const name = String(body.name || "").trim();

      let phone = "";
      let email = "";
      let channel = "WHATSAPP";

      if (rawIdentifier) {
        if (isValidEmail(rawIdentifier)) {
          channel = "EMAIL";
          email = rawIdentifier.toLowerCase();
          phone = email;
        } else {
          channel = "WHATSAPP";
          phone = normalizePhone(rawIdentifier);
          email = String(body.email || "").trim().toLowerCase();
        }
      } else {
        const rawPhone = String(body.phone || "").trim();
        const rawEmail = String(body.email || "").trim().toLowerCase();
        if (rawEmail && !rawPhone) {
          channel = "EMAIL";
          email = rawEmail;
          phone = rawEmail;
        } else {
          channel = "WHATSAPP";
          phone = normalizePhone(rawPhone);
          email = rawEmail;
        }
      }

      if (!phone) return reply.code(400).send({ message: "Phone number or Email is required" });
      if (!accessToken && !otp) return reply.code(400).send({ message: "OTP (or accessToken) is required" });

      if (channel === "WHATSAPP" && isPlayReviewAccount(phone)) {
        const configuredOtp = String(process.env.PLAY_REVIEW_OTP || "").trim();
        if (!configuredOtp || otp !== configuredOtp) {
          return reply.code(401).send({ message: "Invalid OTP" });
        }
      } else if (accessToken) {
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
      console.error("[customerOtpController.verifyOtp] Error:", err?.message || err);
      return reply.code(500).send({ message: "Customer login failed" });
    }
  };

  return {
    sendOtp,
    verifyOtp: verifyOtpHandler,
  };
};
