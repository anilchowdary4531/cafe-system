import bcrypt from "bcryptjs";
import { normalizePhone, getPhoneVariants, isValidPhone, isValidMobilePhone, isValidName } from "../services/phoneService.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";
import { sendWhatsAppOtp } from "../services/msg91WhatsAppService.js";
import { sendSmsOtp } from "../services/smsService.js";
import { sendEmailOtp } from "../services/emailService.js";

export const buildCustomerAuthController = ({ prisma, app }) => {
  const requestSignupOtp = async (req, reply) => {
    try {
      const body = req.body || {};
      const username = String(body.username || body.a || "").trim().toLowerCase();
      const password = String(body.password || body.c || body.b || "").trim();
      const name = String(body.name || body.d || "").trim();
      const email = String(body.email || (String(body.phone || body.b || "").includes("@") ? (body.phone || body.b) : "") || "").trim().toLowerCase();

      const rawPhone = String(body.phone || body.b || body.identifier || "").trim();
      const phone = isValidPhone(rawPhone) ? normalizePhone(rawPhone) : null;

      if (!username) return reply.code(400).send({ message: "Username is required" });
      if (username.length < 3) return reply.code(400).send({ message: "Username must be at least 3 characters" });
      if (!password || password.length < 6) return reply.code(400).send({ message: "Password must be at least 6 characters" });
      if (!phone && !email) return reply.code(400).send({ message: "Phone number or Email is required" });

      // Duplicate checks
      if (email) {
        const existingEmailAccount = await prisma.customerAccount.findFirst({
          where: { email: email.toLowerCase() },
        });
        if (existingEmailAccount && existingEmailAccount.password) {
          return reply.code(400).send({ message: "An account with this email address already exists. Please login instead." });
        }
      }

      if (phone) {
        const phoneVariants = getPhoneVariants(phone);
        const existingPhoneAccount = await prisma.customerAccount.findFirst({
          where: {
            OR: [
              { phone },
              ...(phoneVariants.length > 0 ? [{ phone: { in: phoneVariants } }] : []),
            ],
          },
        });
        if (existingPhoneAccount && existingPhoneAccount.password) {
          return reply.code(400).send({ message: "An account with this phone number already exists. Please login instead." });
        }
      }

      if (username) {
        const existingUsername = await prisma.customerAccount.findFirst({
          where: { username: { equals: username, mode: "insensitive" } },
        });
        if (existingUsername && existingUsername.password) {
          return reply.code(400).send({ message: "This username is already taken. Please choose another username or log in." });
        }
      }

      const otpRes = await requestOtp({ prisma, phone: phone || email });
      if (!otpRes.ok) return reply.code(otpRes.status).send(otpRes.payload);

      const devOtp = otpRes.devOtp || "";
      const otpToSend = otpRes.code;

      const [whatsAppRes, smsRes, emailRes] = await Promise.all([
        phone ? sendWhatsAppOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
        phone ? sendSmsOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
        email ? sendEmailOtp({ email, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
      ]);

      const payload = {
        message: "OTP sent to your WhatsApp and email.",
        phone: phone || null,
        email: email || null,
        expiresAt: otpRes.expiresAt,
        delivery: {
          whatsApp: whatsAppRes ? { ok: whatsAppRes.ok !== false, simulated: Boolean(whatsAppRes.simulated) } : null,
          sms: smsRes ? { ok: smsRes.ok !== false, simulated: Boolean(smsRes.simulated) } : null,
          email: emailRes ? { ok: emailRes.ok !== false, simulated: Boolean(emailRes.simulated), skipped: Boolean(emailRes.skipped) } : null,
        },
      };
      if (devOtp && process.env.NODE_ENV !== "production") payload.devOtp = devOtp;
      return payload;
    } catch (err) {
      console.error("[requestSignupOtp] Error:", err);
      return reply.code(500).send({ message: "Failed to send signup OTP" });
    }
  };

  const registerCustomer = async (req, reply) => {
    console.log("========== AUTH REQUEST ==========");
    console.log("URL:", req.url);
    console.log("Method:", req.method);
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("==================================");
    try {
      const body = req.body || {};
      const username = String(body.username || body.a || "").trim().toLowerCase();
      const password = String(body.password || body.c || body.b || "").trim();
      const name = String(body.name || body.d || "").trim();
      const email = String(body.email || (String(body.phone || body.b || "").includes("@") ? (body.phone || body.b) : "") || "").trim().toLowerCase();
      const otp = String(body.otp || "").trim();

      const rawPhone = String(body.phone || body.b || body.identifier || "").trim();
      const phone = isValidPhone(rawPhone) ? normalizePhone(rawPhone) : null;

      console.log("DEBUG [registerCustomer] values:", { username, passwordLength: password.length, name, email, rawPhone, phone, hasOtp: Boolean(otp) });

      if (!username) return reply.code(400).send({ message: "Username is required" });
      if (username.length < 3) return reply.code(400).send({ message: "Username must be at least 3 characters" });
      if (!password || password.length < 6) return reply.code(400).send({ message: "Password must be at least 6 characters" });
      if (!phone) return reply.code(400).send({ message: "Valid 10-digit mobile phone number is strictly required to create a customer account" });

      // If OTP was sent during signup, verify it before creating account
      if (otp) {
        const verifyRes = await verifyOtp({ prisma, phone: phone || email, otp });
        if (!verifyRes.ok) {
          return reply.code(verifyRes.status || 400).send(verifyRes.payload || { message: "Invalid or expired OTP" });
        }
      }

      // 1. Strict duplicate email check
      if (email) {
        const existingEmailAccount = await prisma.customerAccount.findFirst({
          where: { email: email.toLowerCase() },
        });
        if (existingEmailAccount && existingEmailAccount.password) {
          return reply.code(400).send({
            message: "An account with this email address already exists. Please login instead.",
          });
        }
      }

      // 2. Strict duplicate phone check
      if (phone) {
        const phoneVariants = getPhoneVariants(phone);
        const existingPhoneAccount = await prisma.customerAccount.findFirst({
          where: {
            OR: [
              { phone },
              ...(phoneVariants.length > 0 ? [{ phone: { in: phoneVariants } }] : []),
            ],
          },
        });
        if (existingPhoneAccount && existingPhoneAccount.password) {
          return reply.code(400).send({
            message: "An account with this phone number already exists. Please login instead.",
          });
        }
      }

      // 3. Strict duplicate username check
      if (username) {
        const existingUsername = await prisma.customerAccount.findFirst({
          where: { username: { equals: username, mode: "insensitive" } },
        });
        if (existingUsername && existingUsername.password) {
          return reply.code(400).send({
            message: "This username is already taken. Please choose another username or log in.",
          });
        }
      }

      const existingAccount = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            ...(phone ? [{ phone }] : []),
            ...(email ? [{ email: email.toLowerCase() }] : []),
          ],
        },
      });

      const hashedPassword = bcrypt.hashSync(password, 10);

      let account;
      if (existingAccount) {
        if (existingAccount.password) {
          return reply.code(400).send({ message: "An account with this identifier already exists. Please login." });
        }
        account = await prisma.customerAccount.update({
          where: { id: existingAccount.id },
          data: {
            username,
            password: hashedPassword,
            name: name || existingAccount.name || null,
            email: email || existingAccount.email || null,
          },
        });
      } else {
        account = await prisma.customerAccount.create({
          data: {
            phone,
            username,
            password: hashedPassword,
            name: name || null,
            email: email || null,
          },
        });
      }

      const token = app.jwt.sign(
        {
          type: "customer",
          phone: account.phone || account.email,
          customerAccountId: account.id,
        },
        { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || "30d" }
      );

      const { password: _, ...accountWithoutPassword } = account;

      return {
        message: "Account created successfully",
        token,
        customer: accountWithoutPassword,
      };
    } catch (err) {
      console.error("[registerCustomer] Error:", err);
      return reply.code(500).send({
        message: `Backend Error: ${err.message}`,
      });
    }
  };

  const requestForgotPasswordOtp = async (req, reply) => {
    try {
      const body = req.body || {};
      const rawIdentifier = String(body.identifier || body.phone || body.email || body.username || "").trim();
      if (!rawIdentifier) {
        return reply.code(400).send({ message: "Phone number, email, or username is required" });
      }

      const inputLower = rawIdentifier.toLowerCase();
      const phoneVariants = getPhoneVariants(rawIdentifier);

      const account = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            { username: { equals: rawIdentifier, mode: "insensitive" } },
            { email: { equals: inputLower, mode: "insensitive" } },
            { phone: rawIdentifier },
            ...(phoneVariants.length > 0 ? [{ phone: { in: phoneVariants } }] : []),
          ],
        },
      });

      if (!account) {
        return reply.code(404).send({ message: "No account found with this phone number, email, or username." });
      }

      const phone = account.phone;
      const email = account.email;

      if (!phone && !email) {
        return reply.code(400).send({ message: "No phone or email contact method registered for this account." });
      }

      const targetIdentifier = phone || email;
      const otpRes = await requestOtp({ prisma, phone: targetIdentifier });
      if (!otpRes.ok) return reply.code(otpRes.status).send(otpRes.payload);

      const devOtp = otpRes.devOtp || "";
      const otpToSend = otpRes.code;

      const [whatsAppRes, smsRes, emailRes] = await Promise.all([
        phone ? sendWhatsAppOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
        phone ? sendSmsOtp({ phone, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
        email ? sendEmailOtp({ email, otp: otpToSend || devOtp, expiresAt: otpRes.expiresAt }) : Promise.resolve(null),
      ]);

      const payload = {
        message: "OTP sent to your WhatsApp and email.",
        phone: phone || null,
        email: email || null,
        expiresAt: otpRes.expiresAt,
        delivery: {
          whatsApp: whatsAppRes ? { ok: whatsAppRes.ok !== false, simulated: Boolean(whatsAppRes.simulated) } : null,
          sms: smsRes ? { ok: smsRes.ok !== false, simulated: Boolean(smsRes.simulated) } : null,
          email: emailRes ? { ok: emailRes.ok !== false, simulated: Boolean(emailRes.simulated), skipped: Boolean(emailRes.skipped) } : null,
        },
      };
      if (devOtp && process.env.NODE_ENV !== "production") payload.devOtp = devOtp;
      return payload;
    } catch (err) {
      console.error("[requestForgotPasswordOtp] Error:", err);
      return reply.code(500).send({ message: "Failed to send password reset OTP" });
    }
  };

  const resetPasswordWithOtp = async (req, reply) => {
    try {
      const body = req.body || {};
      const rawIdentifier = String(body.identifier || body.phone || body.email || body.username || "").trim();
      const otp = String(body.otp || "").trim();
      const newPassword = String(body.newPassword || body.password || "").trim();

      if (!rawIdentifier || !otp || !newPassword) {
        return reply.code(400).send({ message: "Identifier, OTP, and new password are required." });
      }

      if (newPassword.length < 6) {
        return reply.code(400).send({ message: "New password must be at least 6 characters." });
      }

      const inputLower = rawIdentifier.toLowerCase();
      const phoneVariants = getPhoneVariants(rawIdentifier);

      const account = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            { username: { equals: rawIdentifier, mode: "insensitive" } },
            { email: { equals: inputLower, mode: "insensitive" } },
            { phone: rawIdentifier },
            ...(phoneVariants.length > 0 ? [{ phone: { in: phoneVariants } }] : []),
          ],
        },
      });

      if (!account) {
        return reply.code(404).send({ message: "No account found with this phone number, email, or username." });
      }

      const targetIdentifier = account.phone || account.email;
      const verifyRes = await verifyOtp({ prisma, phone: targetIdentifier, otp });
      if (!verifyRes.ok) {
        return reply.code(verifyRes.status || 400).send(verifyRes.payload || { message: "Invalid or expired OTP" });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await prisma.customerAccount.update({
        where: { id: account.id },
        data: { password: hashedPassword },
      });

      return {
        success: true,
        message: "Password reset successful. Please log in with your new password.",
      };
    } catch (err) {
      console.error("[resetPasswordWithOtp] Error:", err);
      return reply.code(500).send({ message: "Failed to reset password" });
    }
  };

  const loginWithPassword = async (req, reply) => {
    try {
      const body = req.body || {};
      const rawIdentifier = String(body.username || body.identifier || body.a || "").trim();
      const password = String(body.password || body.c || body.b || "").trim();

      if (!rawIdentifier || !password) {
        return reply.code(400).send({ message: "Username/Phone/Email and password are required" });
      }

      const inputLower = rawIdentifier.toLowerCase();
      const phoneVariants = getPhoneVariants(rawIdentifier);

      let account = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            { username: { equals: rawIdentifier, mode: "insensitive" } },
            { email: { equals: inputLower, mode: "insensitive" } },
            { phone: rawIdentifier },
            ...(phoneVariants.length > 0 ? [{ phone: { in: phoneVariants } }] : []),
            ...(phoneVariants.length > 0 ? [{ username: { in: phoneVariants } }] : []),
          ],
        },
      });

      if (!account) {
        return reply.code(401).send({ message: "No account found with this username, phone, or email." });
      }

      // If account exists but password was not set yet (e.g. created via Google/OTP), set password on login
      if (!account.password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        account = await prisma.customerAccount.update({
          where: { id: account.id },
          data: {
            password: hashedPassword,
            username: account.username || (rawIdentifier.includes("@") ? null : rawIdentifier),
          },
        });
      } else {
        const valid = bcrypt.compareSync(password, account.password);
        if (!valid) {
          return reply.code(401).send({ message: "Incorrect password. Please try again or use OTP Login." });
        }
      }

      const token = app.jwt.sign(
        {
          type: "customer",
          phone: account.phone || account.email || account.username,
          customerAccountId: account.id,
        },
        { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || "30d" }
      );

      const { password: _, ...accountWithoutPassword } = account;

      return {
        message: "Customer login success",
        token,
        customer: accountWithoutPassword,
      };
    } catch (err) {
      console.error("[loginWithPassword] Error:", err);
      return reply.code(500).send({
        message: `Backend Error: ${err.message}`,
        detail: "If this mentions a missing column, you MUST run 'npx prisma db push' on your server."
      });
    }
  };

  const googleLogin = async (req, reply) => {
    console.log("========== AUTH REQUEST ==========");
    console.log("URL:", req.url);
    console.log("Method:", req.method);
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("==================================");
    try {
      const body = req.body || {};
      const { googleId, email, name, picture, photoUrl, avatarUrl, credential, idToken } = body;

      const userEmail = String(email || "").trim().toLowerCase();
      const userGoogleId = String(googleId || "").trim();
      const userName = String(name || "").trim();
      const userPicture = String(picture || photoUrl || avatarUrl || "").trim() || null;

      if (!userEmail && !userGoogleId && !credential && !idToken) {
        return reply.code(400).send({ message: "Google credentials or payload are required" });
      }

      let account = null;

      // 1. Try finding by Google ID first (Highest priority)
      if (userGoogleId) {
        account = await prisma.customerAccount.findFirst({
          where: { googleId: userGoogleId }
        });
      }

      // 2. If not found by Google ID, try finding by Email or Phone in CustomerAccount or Customer
      if (!account) {
        const phoneVariants = body.phone ? getPhoneVariants(body.phone) : [];
        account = await prisma.customerAccount.findFirst({
          where: {
            OR: [
              ...(userEmail ? [{ email: userEmail }, { phone: userEmail }, { username: userEmail }] : []),
              ...(phoneVariants.length > 0 ? [{ phone: { in: phoneVariants } }, { username: { in: phoneVariants } }] : []),
            ]
          }
        });
      }

      const inputPhone = isValidMobilePhone(body.phone) ? normalizePhone(body.phone) : null;
      const inputName = isValidName(userName) ? userName : (isValidName(body.name) ? String(body.name).trim() : "");

      // 3. If account does not exist or has no valid 10-digit mobile phone or name, and no valid inputPhone provided, prompt user for info
      const hasValidAccountPhone = account && isValidMobilePhone(account.phone);
      const hasValidAccountName = account && isValidName(account.name);

      if ((!account || !hasValidAccountPhone || !hasValidAccountName) && !inputPhone) {
        return reply.send({
          requiresInfo: true,
          googleId: userGoogleId || account?.googleId || null,
          email: userEmail || account?.email || null,
          name: inputName || (isValidName(account?.name) ? account.name : ""),
          picture: userPicture || account?.avatarUrl || null,
          customer: {
            id: account?.id || null,
            name: inputName || (isValidName(account?.name) ? account.name : "Customer"),
            email: userEmail || account?.email || "",
            phone: account?.phone || "",
            avatarUrl: userPicture || account?.avatarUrl || null,
          },
        });
      }

      // 4. Update existing account or create new account with full name, phone number, and avatar
      if (account) {
        try {
          const basicData = {
            email: userEmail || account.email || null,
            phone: inputPhone || (isValidMobilePhone(account.phone) ? account.phone : null),
            name: inputName || (isValidName(account.name) ? account.name : "Customer"),
          };

          try {
            // Try updating everything including avatarUrl
            account = await prisma.customerAccount.update({
              where: { id: account.id },
              data: {
                ...basicData,
                googleId: userGoogleId || account.googleId || null,
                avatarUrl: userPicture || account.avatarUrl || null,
              }
            });
          } catch (dbErr) {
            // If it fails, the database structure is old. Update only basic info.
            account = await prisma.customerAccount.update({
              where: { id: account.id },
              data: basicData
            });
          }
        } catch (updateErr) {
          console.warn("[googleLogin] Update warning:", updateErr.message);
        }
      } else {
        const baseUsername = userEmail ? userEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "") : `user_${Date.now()}`;
        let username = baseUsername;
        let counter = 1;
        while (await prisma.customerAccount.findUnique({ where: { username } })) {
          username = `${baseUsername}_${counter++}`;
        }

        const basicCreateData = {
          email: userEmail || null,
          phone: inputPhone,
          username,
          name: inputName || "Customer",
        };

        try {
          // Try full create
          account = await prisma.customerAccount.create({
            data: {
              ...basicCreateData,
              googleId: userGoogleId || null,
              avatarUrl: userPicture || null,
            },
          });
        } catch (createErr) {
          if (createErr.code === "P2002") {
            account = await prisma.customerAccount.findFirst({
              where: {
                OR: [
                  ...(userGoogleId ? [{ googleId: userGoogleId }] : []),
                  ...(userEmail ? [{ email: userEmail }, { phone: userEmail }] : []),
                  ...(inputPhone ? [{ phone: inputPhone }] : []),
                ],
              },
            });
          } else {
            // Database is likely old. Create with basic info.
            try {
              account = await prisma.customerAccount.create({
                data: basicCreateData
              });
            } catch (fallbackErr) {
               if (fallbackErr.code === "P2002") {
                  account = await prisma.customerAccount.findFirst({
                    where: {
                      OR: [
                        ...(userEmail ? [{ email: userEmail }, { phone: userEmail }] : []),
                        ...(inputPhone ? [{ phone: inputPhone }] : []),
                      ],
                    },
                  });
               } else {
                 throw fallbackErr;
               }
            }
          }
        }
      }

      if (!account) {
        return reply.code(500).send({ message: "Unable to process Google login account creation." });
      }

      const token = app.jwt.sign(
        {
          type: "customer",
          phone: account.phone || account.email,
          customerAccountId: account.id,
        },
        { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || "30d" }
      );

      const { password: _, ...accountWithoutPassword } = account;

      return {
        message: "Google login successful",
        token,
        customer: accountWithoutPassword,
      };
    } catch (err) {
      console.error("[googleLogin] Error:", err);
      return reply.code(500).send({ message: `Google Auth Error: ${err.message}` });
    }
  };

  return {
    requestSignupOtp,
    registerCustomer,
    requestForgotPasswordOtp,
    resetPasswordWithOtp,
    loginWithPassword,
    googleLogin,
  };
};
