import { normalizePhone, getPhoneVariants, isValidPhone } from "../services/phoneService.js";
import { requireCustomerPhoneFromJwt, getCustomerAccountByPhone, upsertCustomerAccount } from "../services/customerProfileService.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";
import { sendEmailOtp } from "../services/emailService.js";
import { sendSmsOtp } from "../services/smsService.js";

export const buildCustomerProfileController = ({ prisma }) => {
  const getProfile = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req);
      if (!phone) return reply.code(401).send({ message: "Unauthorized" });

      let account = await getCustomerAccountByPhone({ prisma, phone });

      // Fallback search if findUnique failed (handles phone variant mismatches)
      if (!account) {
        const normalized = normalizePhone(phone);
        const variants = getPhoneVariants(phone);
        account = await prisma.customerAccount.findFirst({
          where: {
            OR: [
              { phone: normalized },
              { email: normalized },
              { phone: { in: variants } },
              { username: normalized }
            ]
          }
        });
      }

      if (!account) return reply.code(404).send({ message: "Customer not found" });

      const slug = req.query.slug || "";
      let rewardPoints = 0;
      if (slug) {
        const scoped = await prisma.customer.findFirst({
          where: { phone, restaurant: { slug } },
          select: { rewardPoints: true }
        });
        if (scoped) {
          rewardPoints = scoped.rewardPoints;
        }
      } else {
        const scopedSum = await prisma.customer.aggregate({
          where: { phone },
          _sum: { rewardPoints: true }
        });
        rewardPoints = scopedSum._sum?.rewardPoints || 0;
      }

      return { customer: { ...account, rewardPoints } };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch customer profile" });
    }
  };

  const putProfile = async (req, reply) => {
    try {
      const phoneFromToken = await requireCustomerPhoneFromJwt(req);
      if (!phoneFromToken) return reply.code(401).send({ message: "Unauthorized" });

      const body = req.body || {};
      const newName = String(body.name || "").trim();
      const newEmail = String(body.email || "").trim().toLowerCase();
      const newPhone = isValidPhone(body.phone) ? normalizePhone(body.phone) : null;
      const rawAvatar = body.avatarUrl ?? body.avatarDataUrl ?? body.avatar;
      const newAvatarUrl = rawAvatar !== undefined ? (String(rawAvatar || "").trim() || null) : undefined;

      const phoneVariants = getPhoneVariants(phoneFromToken);
      let account = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            { phone: { in: phoneVariants } },
            ...(phoneFromToken.includes("@") ? [{ email: phoneFromToken.toLowerCase() }] : []),
          ],
        },
      });

      if (!account) {
        account = await prisma.customerAccount.create({
          data: {
            phone: newPhone,
            name: newName || null,
            email: newEmail || null,
            avatarUrl: newAvatarUrl !== undefined ? newAvatarUrl : null,
          },
        });
      } else {
        account = await prisma.customerAccount.update({
          where: { id: account.id },
          data: {
            name: newName || account.name || null,
            email: newEmail || account.email || null,
            phone: newPhone || (isValidPhone(account.phone) ? account.phone : null),
            ...(newAvatarUrl !== undefined ? { avatarUrl: newAvatarUrl } : {}),
          },
        });
      }

      // Sync matching Customer records in restaurant tables
      const allPhoneVariants = getPhoneVariants(account.phone || newPhone || phoneFromToken);
      await prisma.customer.updateMany({
        where: {
          OR: [
            ...(allPhoneVariants.length > 0 ? [{ phone: { in: allPhoneVariants } }] : []),
            ...(account.email ? [{ email: account.email.toLowerCase() }] : []),
          ],
        },
        data: {
          name: newName || account.name || undefined,
          phone: account.phone || newPhone || undefined,
          email: account.email || newEmail || undefined,
        },
      });

      return { message: "Profile updated successfully", customer: account };
    } catch (err) {
      console.error("[putProfile] Error:", err);
      return reply.code(500).send({ message: "Failed to update profile" });
    }
  };

  const requestDeleteOtp = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req);
      if (!phone) return reply.code(401).send({ message: "Unauthorized" });

      const account = await getCustomerAccountByPhone({ prisma, phone });
      if (!account) return reply.code(404).send({ message: "Customer account not found" });

      const otpRes = await requestOtp({ prisma, phone });
      if (!otpRes.ok) return reply.code(otpRes.status).send(otpRes.payload);

      const devOtp = otpRes.devOtp || "";
      const otpToSend = otpRes.code;
      const email = account.email || "";

      await Promise.all([
        sendSmsOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }),
        email ? sendEmailOtp({ email, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
      ]);

      const payload = {
        message: "Deletion OTP sent to your registered phone",
        phone: account.phone,
        email: account.email || null,
        expiresAt: otpRes.expiresAt,
      };
      if (devOtp) payload.devOtp = devOtp;
      return payload;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to send deletion OTP" });
    }
  };

  const deleteAccount = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req);
      if (!phone) return reply.code(401).send({ message: "Unauthorized" });

      const body = req.body || {};
      const otp = String(body.otp || "").trim();
      if (!otp) return reply.code(400).send({ message: "OTP is required to delete account" });

      const okRes = await verifyOtp({ prisma, phone, otp });
      if (!okRes.ok) return reply.code(okRes.status).send(okRes.payload);

      const account = await getCustomerAccountByPhone({ prisma, phone });
      if (account) {
        await prisma.customerAccount.delete({
          where: { id: account.id },
        });
      }

      return { success: true, message: "Account deleted successfully." };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete account" });
    }
  };

  const publicRequestDeleteOtp = async (req, reply) => {
    try {
      const body = req.body || {};
      const identifier = String(body.identifier || "").trim().toLowerCase();
      if (!identifier) return reply.code(400).send({ message: "Identifier (Email or Phone) is required" });

      const normalizedPhone = normalizePhone(identifier);

      const account = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            { phone: identifier },
            { email: identifier },
            { phone: normalizedPhone }
          ],
        },
      });

      if (!account) return reply.code(404).send({ message: "Account not found" });

      const phone = account.phone;
      const otpRes = await requestOtp({ prisma, phone });
      if (!otpRes.ok) return reply.code(otpRes.status).send(otpRes.payload);

      const devOtp = otpRes.devOtp || "";
      const otpToSend = otpRes.code;
      const email = account.email || "";

      await Promise.all([
        sendSmsOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }),
        email ? sendEmailOtp({ email, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
      ]);

      const payload = {
        message: "Deletion OTP sent to your registered contact",
        expiresAt: otpRes.expiresAt,
      };
      if (devOtp) payload.devOtp = devOtp;
      return payload;
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ message: "Failed to send deletion OTP" });
    }
  };

  const publicDeleteAccount = async (req, reply) => {
    try {
      const body = req.body || {};
      const identifier = String(body.identifier || "").trim().toLowerCase();
      const otp = String(body.otp || "").trim();

      if (!identifier || !otp) {
        return reply.code(400).send({ message: "Identifier and OTP are required" });
      }

      const normalizedIdentifier = normalizePhone(identifier);

      const account = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            { phone: identifier },
            { email: identifier },
            { phone: normalizedIdentifier },
          ],
        },
      });

      if (!account) return reply.code(404).send({ message: "Account not found" });

      const okRes = await verifyOtp({ prisma, phone: account.phone, otp });
      if (!okRes.ok) return reply.code(okRes.status).send(okRes.payload);

      await prisma.customerAccount.delete({
        where: { id: account.id },
      });

      return { success: true, message: "Account deleted successfully." };
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ message: "Failed to delete account" });
    }
  };

  return {
    getProfile,
    putProfile,
    requestDeleteOtp,
    deleteAccount,
    publicRequestDeleteOtp,
    publicDeleteAccount,
  };
};

