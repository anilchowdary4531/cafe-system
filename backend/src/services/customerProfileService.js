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

  return prisma.customerAccount.upsert({
    where: { phone: normalizedPhone },
    update: {
      name: normalizedName || null,
      email: normalizedEmail || null,
    },
    create: {
      phone: normalizedPhone,
      name: normalizedName || null,
      email: normalizedEmail || null,
    },
  });
};

