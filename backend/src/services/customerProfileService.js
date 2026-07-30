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

export const upsertCustomerAccount = async ({ prisma, phone, name, email } = {}) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) throw new Error("phone_required");

  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const existing = await prisma.customerAccount.findUnique({
    where: { phone: normalizedPhone },
  });

  if (existing) {
    const updateData = {};
    if (normalizedName && normalizedName !== existing.name) {
      updateData.name = normalizedName;
    }
    if (normalizedEmail && normalizedEmail !== existing.email) {
      updateData.email = normalizedEmail;
    }

    if (Object.keys(updateData).length > 0) {
      return prisma.customerAccount.update({
        where: { id: existing.id },
        data: updateData,
      });
    }
    return existing;
  }

  return prisma.customerAccount.create({
    data: {
      phone: normalizedPhone,
      name: normalizedName || null,
      email: normalizedEmail || null,
    },
  });
};

