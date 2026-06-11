export const listCustomerAddresses = async ({ prisma, customerAccountId }) => {
  return prisma.customerAddress.findMany({
    where: { customerAccountId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
};

export const createCustomerAddress = async ({ prisma, customerAccountId, input }) => {
  const patch = input && typeof input === "object" ? input : {};
  const normalizeNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const label = String(patch.label || "Home").trim() || "Home";
  const name = patch.name ? String(patch.name).trim() : null;
  const phone = patch.phone ? String(patch.phone).trim() : null;
  const line1 = String(patch.line1 || "").trim();
  const line2 = patch.line2 ? String(patch.line2).trim() : null;
  const city = patch.city ? String(patch.city).trim() : null;
  const state = patch.mandal ? String(patch.mandal).trim() : patch.state ? String(patch.state).trim() : null;
  const postalCode = patch.postalCode ? String(patch.postalCode).trim() : null;
  const latitude = normalizeNumber(patch.latitude ?? patch.lat);
  const longitude = normalizeNumber(patch.longitude ?? patch.lng);
  const notes = patch.notes ? String(patch.notes).trim() : null;
  const isDefault = Boolean(patch.isDefault);

  if (!line1) {
    return { ok: false, status: 400, payload: { message: "Address line1 is required" } };
  }
  if (!city) {
    return { ok: false, status: 400, payload: { message: "City is required" } };
  }
  if (!state) {
    return { ok: false, status: 400, payload: { message: "Mandal / area is required" } };
  }

  const existingCount = await prisma.customerAddress.count({ where: { customerAccountId } });

  // Ensure single default.
  if (isDefault || existingCount === 0) {
    await prisma.customerAddress.updateMany({
      where: { customerAccountId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.customerAddress.create({
    data: {
      customerAccountId,
      label,
      name,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      latitude,
      longitude,
      notes,
      isDefault: isDefault || existingCount === 0,
    },
  });

  return { ok: true, address };
};

export const deleteCustomerAddress = async ({ prisma, customerAccountId, id }) => {
  const addressId = Number(id || 0);
  if (!addressId) return { ok: false, status: 400, payload: { message: "Invalid address id" } };

  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, customerAccountId },
    select: { id: true, isDefault: true },
  });
  if (!existing) return { ok: false, status: 404, payload: { message: "Address not found" } };

  await prisma.customerAddress.delete({ where: { id: addressId } });

  // If we deleted the default, promote the latest address to default.
  if (existing.isDefault) {
    const nextDefault = await prisma.customerAddress.findFirst({
      where: { customerAccountId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (nextDefault) {
      await prisma.customerAddress.update({
        where: { id: nextDefault.id },
        data: { isDefault: true },
      });
    }
  }

  return { ok: true };
};
