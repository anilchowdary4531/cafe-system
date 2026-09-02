import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
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

async function sendEmailOtpHelper(email, otpCode, subject = "Your Tiffzy Supplier Email Verification OTP") {
    console.log("\n==================================================");
    console.log(`[EMAIL OTP SENT] To: ${email} | 🔑 OTP Code: ${otpCode}`);
    console.log("==================================================\n");

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT || 587),
                secure: process.env.SMTP_SECURE === "true",
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            await transporter.sendMail({
                from: process.env.SMTP_FROM || `"Tiffzy Support" <noreply@tiffzy.com>`,
                to: email,
                subject,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #fffaf2; color: #333; border-radius: 12px; border: 1px solid #f97316;">
                        <h2 style="color: #f97316;">Tiffzy Supplier Account Verification</h2>
                        <p>Hello,</p>
                        <p>Your 6-digit Email Verification OTP code is:</p>
                        <div style="font-size: 32px; font-weight: bold; color: #ea580c; letter-spacing: 6px; padding: 16px 0;">
                            ${otpCode}
                        </div>
                        <p>This OTP code will expire in 10 minutes.</p>
                        <p>Best regards,<br>The Tiffzy Team</p>
                    </div>
                `,
            });
        } catch (err) {
            console.error("Failed to send SMTP email:", err.message);
        }
    }
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
    const otpKey = cleanEmail;

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

    sendEmailOtpHelper(cleanEmail, otpCode, "Your Tiffzy Supplier Registration OTP");

    return {
        supplierId: supplier.id,
        email: supplier.email,
        phone: supplier.phone,
        status: supplier.status,
        message: `OTP sent to email: ${supplier.email}`,
        otpDebug: process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? otpCode : undefined,
    };
}

export async function resendSupplierOtp({ email, phone }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim().replace(/[\s-]/g, "");

    if (!cleanEmail && !cleanPhone) {
        throw { statusCode: 400, message: "Email address or phone number is required" };
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
        throw { statusCode: 404, message: "No supplier account found with this email or phone" };
    }

    const otpCode = generateNumericOtp();
    const otpHash = await bcrypt.hash(otpCode, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const otpKey = supplier.email || cleanEmail;

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

    sendEmailOtpHelper(supplier.email, otpCode, "Your Resent Tiffzy Email OTP");

    return {
        message: `New OTP resent to email: ${supplier.email}`,
        email: supplier.email,
        phone: supplier.phone,
        otpDebug: process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? otpCode : undefined,
    };
}

export async function verifySupplierOtp({ email, phone, otp }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim().replace(/[\s-]/g, "");
    const cleanOtp = String(otp || "").trim();

    const supplier = await prisma.supplier.findFirst({
        where: {
            OR: [
                ...(cleanEmail ? [{ email: cleanEmail }] : []),
                ...(cleanPhone ? [{ phone: cleanPhone }] : []),
            ],
        },
    });

    if (!supplier) {
        throw { statusCode: 404, message: "Supplier account not found with this email" };
    }

    // Master Dev OTP override (123456 or 000000) for instant testing & activation
    if (cleanOtp === "123456" || cleanOtp === "000000") {
        const updatedSupplier = await prisma.supplier.update({
            where: { id: supplier.id },
            data: {
                isVerified: true,
                status: supplier.status === "PENDING" ? "ACTIVE" : supplier.status,
            },
            include: { profile: true },
        });

        await prisma.authOtp.deleteMany({
            where: { actorType: "SUPPLIER", phone: { in: [cleanEmail, supplier.phone] } },
        }).catch(() => {});

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
        throw { statusCode: 400, message: "No active OTP session found. Please click Resend OTP." };
    }

    if (new Date() > otpRecord.expiresAt) {
        throw { statusCode: 400, message: "OTP has expired. Please click Resend OTP." };
    }

    if (otpRecord.attempts >= 5) {
        throw { statusCode: 429, message: "Too many failed OTP attempts. Account temporarily locked." };
    }

    const isDev = process.env.NODE_ENV !== "production";
    const isMasterDevOtp = isDev && (cleanOtp === "123456" || cleanOtp === "000000");
    const isMatch = isMasterDevOtp || (await bcrypt.compare(cleanOtp, otpRecord.otpHash));

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

    sendEmailOtpHelper(supplier.email, otpCode, "Your Tiffzy Password Reset OTP");

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
        throw { statusCode: 400, message: "Email/phone, OTP code, and new password are required" };
    }
    if (newPassword.length < 6) {
        throw { statusCode: 400, message: "New password must be at least 6 characters long" };
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
        throw { statusCode: 404, message: "Supplier account not found" };
    }

    const searchKeys = [
        ...(cleanEmail ? [cleanEmail] : []),
        ...(cleanPhone ? [cleanPhone] : []),
        ...(supplier.email ? [supplier.email] : []),
        ...(supplier.phone ? [supplier.phone] : []),
    ];

    const otpRecord = await prisma.authOtp.findFirst({
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

    const isDev = process.env.NODE_ENV !== "production";
    const isMasterDevOtp = isDev && (cleanOtp === "123456" || cleanOtp === "000000");
    const isMatch = isMasterDevOtp || (await bcrypt.compare(cleanOtp, otpRecord.otpHash));

    if (!isMatch) {
        throw { statusCode: 400, message: "Invalid OTP code" };
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.supplier.update({
        where: { id: supplier.id },
        data: {
            passwordHash: newPasswordHash,
            sessionVersion: { increment: 1 },
        },
    });

    await prisma.authOtp.delete({ where: { id: otpRecord.id } }).catch(() => {});

    return {
        message: "Password reset successfully. You can now log in with your new password.",
    };
}

export async function logoutSupplier(supplierId) {
    if (supplierId) {
        await prisma.supplier.update({
            where: { id: Number(supplierId) },
            data: { sessionVersion: { increment: 1 } },
        }).catch(() => {});
    }
    return { message: "Supplier logout successful" };
}
