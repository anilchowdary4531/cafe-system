import { normalizePhone } from "./phoneService.js";

export const requireCustomerPhoneFromJwt = async (req) => {
  if (!req.headers?.authorization) return "";
  await req.jwtVerify();
  if (String(req.user?.type || "") !== "customer") return "";
  return normalizePhone(req.user?.phone || "");
};

export const getCustomerAccountByPhone = async ({ prisma, phone }) => {
  if (!phone) return null;
  return prisma.customerAccount.findUnique({
    where: { phone },
  });
};

export const upsertCustomerAccount = async ({ prisma, phone, name, email, avatarUrl } = {}) => {
  const rawPhone = String(phone || "").trim();
  const isEmailInput = rawPhone.includes("@");
  const normalizedPhone = isEmailInput ? rawPhone.toLowerCase() : normalizePhone(rawPhone);
  if (!normalizedPhone) throw new Error("phone_required");

  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase() || (isEmailInput ? normalizedPhone : "");
  const normalizedAvatar = avatarUrl !== undefined ? String(avatarUrl || "").trim() || null : undefined;

  const existing = await prisma.customerAccount.findFirst({
    where: {
      OR: [
        { phone: normalizedPhone },
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ],
    },
  });

  if (existing) {
    const updateData = {};
    if (normalizedName && normalizedName !== existing.name) {
      updateData.name = normalizedName;
    }
    if (normalizedEmail && normalizedEmail !== existing.email) {
      updateData.email = normalizedEmail;
    }
    if (normalizedAvatar !== undefined && normalizedAvatar !== existing.avatarUrl) {
      updateData.avatarUrl = normalizedAvatar;
    }

    if (Object.keys(updateData).length > 0) {
      try {
        return await prisma.customerAccount.update({
          where: { id: existing.id },
          data: updateData,
        });
      } catch (err) {
        delete updateData.avatarUrl;
        if (Object.keys(updateData).length > 0) {
          return await prisma.customerAccount.update({
            where: { id: existing.id },
            data: updateData,
          });
        }
      }
    }
    return existing;
  }

  try {
    return await prisma.customerAccount.create({
      data: {
        phone: normalizedPhone,
        name: normalizedName || null,
        email: normalizedEmail || null,
        avatarUrl: normalizedAvatar || null,
      },
    });
  } catch (err) {
    return await prisma.customerAccount.create({
      data: {
        phone: normalizedPhone,
        name: normalizedName || null,
        email: normalizedEmail || null,
      },
    });
  }
};

