import bcrypt from "bcryptjs";
import prisma from "../prisma.js";

const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;

function generateNumericOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function isValidPhone(phone) {
    return /^\+?[0-9]{10,15}$/.test(String(phone || "").trim().replace(/[\s-]/g, ""));
}

export async function registerSupplier({ email, phone, password, businessName }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim().replace(/[\s-]/g, "");
    const cleanBusinessName = String(businessName || "").trim();

    if (!isValidEmail(cleanEmail)) {
        throw { statusCode: 400, message: "Invalid email format" };
    }
    if (cleanPhone && !isValidPhone(cleanPhone)) {
        throw { statusCode: 400, message: "Invalid phone number format" };
    }
    if (!password || password.length < 6) {
        throw { statusCode: 400, message: "Password must be at least 6 characters long" };
    }
    if (!cleanBusinessName) {
        throw { statusCode: 400, message: "Business name is required" };
    }

    const existingEmail = await prisma.supplier.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) {
        throw { statusCode: 409, message: "A supplier with this email already exists" };
    }

    if (cleanPhone) {
        const existingPhone = await prisma.supplier.findUnique({ where: { phone: cleanPhone } });
        if (existingPhone) {
            throw { statusCode: 409, message: "A supplier with this phone number already exists" };
        }
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const supplier = await prisma.$transaction(async (tx) => {
        const createdSupplier = await tx.supplier.create({
            data: {
                email: cleanEmail,
                phone: cleanPhone || `TEMP_${Date.now()}`,
                passwordHash,
                status: "PENDING",
                isVerified: false,
            },
        });

        await tx.supplierProfile.create({
            data: {
                supplierId: createdSupplier.id,
                businessName: cleanBusinessName,
            },
        });

        return createdSupplier;
    });

    const otpCode = generateNumericOtp();
    const otpHash = await bcrypt.hash(otpCode, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const otpKey = cleanPhone || cleanEmail;

    await prisma.authOtp.upsert({
        where: { phone_actorType: { phone: otpKey, actorType: "SUPPLIER" } },
        update: {
            otpHash,
            expiresAt,
            attempts: 0,
            lastSentAt: new Date(),
        },
        create: {
            phone: otpKey,
            actorType: "SUPPLIER",
            otpHash,
            expiresAt,
            attempts: 0,
            lastSentAt: new Date(),
        },
    });

    return {
        supplierId: supplier.id,
        email: supplier.email,
        phone: supplier.phone,
        status: supplier.status,
        message: `OTP sent to email: ${supplier.email}`,
        otpDebug: process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? otpCode : undefined,
    };
}

export async function verifySupplierOtp({ email, phone, otp }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim().replace(/[\s-]/g, "");
    const cleanOtp = String(otp || "").trim();

    if ((!cleanPhone && !cleanEmail) || !cleanOtp) {
        throw { statusCode: 400, message: "Email or phone number and OTP code are required" };
    }

    const supplier = await prisma.supplier.findFirst({
        where: {
            OR: [
                ...(cleanEmail ? [{ email: cleanEmail }] : []),
                ...(cleanPhone ? [{ phone: cleanPhone }] : []),
            ],
        },
    });

    const searchKeys = [
        ...(cleanEmail ? [cleanEmail] : []),
        ...(cleanPhone ? [cleanPhone] : []),
        ...(supplier?.email ? [supplier.email] : []),
        ...(supplier?.phone ? [supplier.phone] : []),
    ];

    let otpRecord = await prisma.authOtp.findFirst({
        where: {
            actorType: "SUPPLIER",
            phone: { in: searchKeys },
        },
    });

    if (!otpRecord) {
        throw { statusCode: 400, message: "No active OTP session found. Please request a new OTP." };
    }

    if (new Date() > otpRecord.expiresAt) {
        throw { statusCode: 400, message: "OTP has expired. Please request a new OTP." };
    }

    if (otpRecord.attempts >= 5) {
        throw { statusCode: 429, message: "Too many failed OTP attempts. Account temporarily locked." };
    }

    const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otpHash);
    if (!isMatch) {
        await prisma.authOtp.update({
            where: { id: otpRecord.id },
            data: { attempts: { increment: 1 } },
        });
        throw { statusCode: 400, message: "Invalid OTP code" };
    }

    if (!supplier) {
        throw { statusCode: 404, message: "Supplier account not found" };
    }

    const updatedSupplier = await prisma.supplier.update({
        where: { id: supplier.id },
        data: {
            isVerified: true,
            status: supplier.status === "PENDING" ? "ACTIVE" : supplier.status,
        },
        include: { profile: true },
    });

    await prisma.authOtp.delete({ where: { id: otpRecord.id } }).catch(() => {});

    return {
        supplierId: updatedSupplier.id,
        email: updatedSupplier.email,
        phone: updatedSupplier.phone,
        status: updatedSupplier.status,
        isVerified: updatedSupplier.isVerified,
        businessName: updatedSupplier.profile?.businessName || "",
        message: "OTP verified successfully. Supplier account activated.",
    };
}

export async function loginSupplier({ email, password }) {
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
        throw { statusCode: 400, message: "Invalid email format" };
    }
    if (!password) {
        throw { statusCode: 400, message: "Password is required" };
    }

    const supplier = await prisma.supplier.findUnique({
        where: { email: cleanEmail },
        include: { profile: true },
    });

    if (!supplier) {
        throw { statusCode: 401, message: "Invalid credentials" };
    }

    if (supplier.status === "BLOCKED" || supplier.status === "SUSPENDED") {
        throw { statusCode: 403, message: `Account is ${supplier.status.toLowerCase()}. Contact support.` };
    }

    const isPasswordValid = await bcrypt.compare(password, supplier.passwordHash);
    if (!isPasswordValid) {
        throw { statusCode: 401, message: "Invalid credentials" };
    }

    return {
        id: supplier.id,
        supplierId: supplier.id,
        email: supplier.email,
        phone: supplier.phone,
        role: "SUPPLIER",
        status: supplier.status,
        isVerified: supplier.isVerified,
        sessionVersion: supplier.sessionVersion,
        businessName: supplier.profile?.businessName || "",
    };
}

export async function forgotSupplierPassword({ email, phone }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim().replace(/[\s-]/g, "");

    if (!cleanEmail && !cleanPhone) {
        throw { statusCode: 400, message: "Email or phone number is required" };
    }

    const supplier = await prisma.supplier.findFirst({
        where: {
            OR: [
                ...(cleanEmail ? [{ email: cleanEmail }] : []),
                ...(cleanPhone ? [{ phone: cleanPhone }] : []),
            ],
        },
    });

    if (!supplier) {
        throw { statusCode: 404, message: "No supplier found with this email or phone number" };
    }

    const otpCode = generateNumericOtp();
    const otpHash = await bcrypt.hash(otpCode, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const otpKey = supplier.email || supplier.phone;

    await prisma.authOtp.upsert({
        where: { phone_actorType: { phone: otpKey, actorType: "SUPPLIER" } },
        update: {
            otpHash,
            expiresAt,
            attempts: 0,
            lastSentAt: new Date(),
        },
        create: {
            phone: otpKey,
            actorType: "SUPPLIER",
            otpHash,
            expiresAt,
            attempts: 0,
            lastSentAt: new Date(),
        },
    });

    return {
        message: `Password reset OTP sent to email: ${supplier.email}`,
        email: supplier.email,
        phone: supplier.phone,
        otpDebug: process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? otpCode : undefined,
    };
}

export async function resetSupplierPassword({ email, phone, otp, newPassword }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim().replace(/[\s-]/g, "");
    const cleanOtp = String(otp || "").trim();

    if ((!cleanEmail && !cleanPhone) || !cleanOtp || !newPassword) {
        throw { statusCode: 400, message: "Email or phone, OTP code, and new password are required" };
    }

    if (newPassword.length < 6) {
        throw { statusCode: 400, message: "New password must be at least 6 characters long" };
    }

    await verifySupplierOtp({ email: cleanEmail, phone: cleanPhone, otp: cleanOtp });

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const supplier = await prisma.supplier.findFirst({
        where: {
            OR: [
                ...(cleanEmail ? [{ email: cleanEmail }] : []),
                ...(cleanPhone ? [{ phone: cleanPhone }] : []),
            ],
        },
    });

    const updated = await prisma.supplier.update({
        where: { id: supplier.id },
        data: {
            passwordHash,
            sessionVersion: { increment: 1 },
        },
    });

    return {
        message: "Password reset successfully. Please log in with your new password.",
        supplierId: updated.id,
    };
}

export async function logoutSupplier({ supplierId }) {
    if (!supplierId) return;
    await prisma.supplier.update({
        where: { id: Number(supplierId) },
        data: { sessionVersion: { increment: 1 } },
    }).catch(() => {});
}
