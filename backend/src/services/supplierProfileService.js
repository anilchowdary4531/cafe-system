import prisma from "../prisma.js";

export async function getSupplierProfile(supplierId) {
    const id = Number(supplierId);
    if (!id) throw { statusCode: 400, message: "Invalid supplier ID" };

    const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
            profile: true,
            addresses: true,
        },
    });

    if (!supplier) throw { statusCode: 404, message: "Supplier profile not found" };

    return {
        id: supplier.id,
        email: supplier.email,
        phone: supplier.phone,
        status: supplier.status,
        isVerified: supplier.isVerified,
        profile: supplier.profile || {},
        addresses: supplier.addresses || [],
    };
}

export async function updateSupplierProfile(supplierId, data) {
    const id = Number(supplierId);
    if (!id) throw { statusCode: 400, message: "Invalid supplier ID" };

    const {
        businessName,
        legalName,
        gstin,
        fssaiLicense,
        logoUrl,
        bannerUrl,
        description,
        bankAccountNumber,
        bankIfscCode,
        bankAccountName,
        bankName,
    } = data || {};

    const existingProfile = await prisma.supplierProfile.findUnique({ where: { supplierId: id } });

    if (gstin && gstin !== existingProfile?.gstin) {
        const duplicateGst = await prisma.supplierProfile.findUnique({ where: { gstin } });
        if (duplicateGst) throw { statusCode: 409, message: "GSTIN is already registered to another supplier" };
    }

    const updatedProfile = await prisma.supplierProfile.upsert({
        where: { supplierId: id },
        update: {
            ...(businessName ? { businessName: String(businessName).trim() } : {}),
            ...(legalName !== undefined ? { legalName: legalName ? String(legalName).trim() : null } : {}),
            ...(gstin !== undefined ? { gstin: gstin ? String(gstin).trim().toUpperCase() : null } : {}),
            ...(fssaiLicense !== undefined ? { fssaiLicense: fssaiLicense ? String(fssaiLicense).trim() : null } : {}),
            ...(logoUrl !== undefined ? { logoUrl: logoUrl ? String(logoUrl).trim() : null } : {}),
            ...(bannerUrl !== undefined ? { bannerUrl: bannerUrl ? String(bannerUrl).trim() : null } : {}),
            ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
            ...(bankAccountNumber !== undefined ? { bankAccountNumber: bankAccountNumber ? String(bankAccountNumber).trim() : null } : {}),
            ...(bankIfscCode !== undefined ? { bankIfscCode: bankIfscCode ? String(bankIfscCode).trim().toUpperCase() : null } : {}),
            ...(bankAccountName !== undefined ? { bankAccountName: bankAccountName ? String(bankAccountName).trim() : null } : {}),
            ...(bankName !== undefined ? { bankName: bankName ? String(bankName).trim() : null } : {}),
        },
        create: {
            supplierId: id,
            businessName: String(businessName || "Supplier Business").trim(),
            legalName: legalName ? String(legalName).trim() : null,
            gstin: gstin ? String(gstin).trim().toUpperCase() : null,
            fssaiLicense: fssaiLicense ? String(fssaiLicense).trim() : null,
            logoUrl: logoUrl ? String(logoUrl).trim() : null,
            bannerUrl: bannerUrl ? String(bannerUrl).trim() : null,
            description: description ? String(description).trim() : null,
            bankAccountNumber: bankAccountNumber ? String(bankAccountNumber).trim() : null,
            bankIfscCode: bankIfscCode ? String(bankIfscCode).trim().toUpperCase() : null,
            bankAccountName: bankAccountName ? String(bankAccountName).trim() : null,
            bankName: bankName ? String(bankName).trim() : null,
        },
    });

    return updatedProfile;
}

export async function addSupplierAddress(supplierId, addressData) {
    const id = Number(supplierId);
    if (!id) throw { statusCode: 400, message: "Invalid supplier ID" };

    const { label, line1, line2, city, state, pincode, country, latitude, longitude, isPrimary } = addressData || {};

    if (!line1 || !city || !state || !pincode) {
        throw { statusCode: 400, message: "Address line1, city, state, and pincode are required" };
    }

    if (isPrimary) {
        await prisma.supplierAddress.updateMany({
            where: { supplierId: id },
            data: { isPrimary: false },
        });
    }

    const createdAddress = await prisma.supplierAddress.create({
        data: {
            supplierId: id,
            label: label ? String(label).trim() : "Warehouse",
            line1: String(line1).trim(),
            line2: line2 ? String(line2).trim() : null,
            city: String(city).trim(),
            state: String(state).trim(),
            pincode: String(pincode).trim(),
            country: country ? String(country).trim() : "India",
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            isPrimary: Boolean(isPrimary),
        },
    });

    return createdAddress;
}

export async function updateSupplierAddress(supplierId, addressId, addressData) {
    const sId = Number(supplierId);
    const aId = Number(addressId);
    if (!sId || !aId) throw { statusCode: 400, message: "Invalid IDs" };

    const existing = await prisma.supplierAddress.findFirst({
        where: { id: aId, supplierId: sId },
    });

    if (!existing) throw { statusCode: 404, message: "Supplier address not found" };

    const { label, line1, line2, city, state, pincode, country, latitude, longitude, isPrimary } = addressData || {};

    if (isPrimary) {
        await prisma.supplierAddress.updateMany({
            where: { supplierId: sId },
            data: { isPrimary: false },
        });
    }

    const updatedAddress = await prisma.supplierAddress.update({
        where: { id: aId },
        data: {
            ...(label ? { label: String(label).trim() } : {}),
            ...(line1 ? { line1: String(line1).trim() } : {}),
            ...(line2 !== undefined ? { line2: line2 ? String(line2).trim() : null } : {}),
            ...(city ? { city: String(city).trim() } : {}),
            ...(state ? { state: String(state).trim() } : {}),
            ...(pincode ? { pincode: String(pincode).trim() } : {}),
            ...(country ? { country: String(country).trim() } : {}),
            ...(latitude !== undefined ? { latitude: latitude ? Number(latitude) : null } : {}),
            ...(longitude !== undefined ? { longitude: longitude ? Number(longitude) : null } : {}),
            ...(isPrimary !== undefined ? { isPrimary: Boolean(isPrimary) } : {}),
        },
    });

    return updatedAddress;
}
