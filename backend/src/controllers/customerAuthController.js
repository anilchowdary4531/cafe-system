import bcrypt from "bcryptjs";
import { normalizePhone, getPhoneVariants, isValidPhone } from "../services/phoneService.js";

export const buildCustomerAuthController = ({ prisma, app }) => {
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

      const rawPhone = String(body.phone || body.b || body.identifier || "").trim();
      const phone = isValidPhone(rawPhone) ? normalizePhone(rawPhone) : null;

      console.log("DEBUG [registerCustomer] values:", { username, passwordLength: password.length, name, email, rawPhone, phone });

      if (!username) {
        console.log("FAILED HERE -> username missing");
        return reply.code(400).send({ message: "Username is required" });
      }
      if (username.length < 3) {
        console.log("FAILED HERE -> username too short", username);
        return reply.code(400).send({ message: "Username must be at least 3 characters" });
      }
      if (!password || password.length < 6) {
        console.log("FAILED HERE -> password invalid/too short");
        return reply.code(400).send({ message: "Password must be at least 6 characters" });
      }
      if (!phone && !email) {
        console.log("FAILED HERE -> phone/email missing");
        return reply.code(400).send({ message: "Identifier (Phone or Email) is required" });
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
            { phone },
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
          phone: account.phone,
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
      // Temporarily return the actual error message to diagnose the 500 error
      return reply.code(500).send({
        message: `Backend Error: ${err.message}`,
        detail: "If this mentions a missing column, you MUST run 'npx prisma db push' on your server."
      });
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

      const inputPhone = isValidPhone(body.phone) ? normalizePhone(body.phone) : null;
      const inputName = userName || (body.name ? String(body.name).trim() : "");

      // 3. If account does not exist or has no phone/name, and no valid inputPhone provided, prompt user for info
      const hasValidAccountPhone = account && isValidPhone(account.phone);
      const hasValidAccountName = account && account.name && account.name.trim() !== "Google User";

      if ((!account || !hasValidAccountPhone || !hasValidAccountName) && !inputPhone) {
        return reply.send({
          requiresInfo: true,
          googleId: userGoogleId || account?.googleId || null,
          email: userEmail || account?.email || null,
          name: inputName || account?.name || "",
          picture: userPicture || account?.avatarUrl || null,
        });
      }

      // 4. Update existing account or create new account with full name and phone number
      if (account) {
        try {
          const updateData = {
            email: userEmail || account.email || null,
            phone: inputPhone || account.phone,
            name: (inputName && inputName !== "Google User") ? inputName : account.name,
          };

          // Try to update with Google fields if they exist in the schema
          try {
            await prisma.customerAccount.update({
              where: { id: account.id },
              data: {
                ...updateData,
                googleId: userGoogleId || account.googleId || null,
                avatarUrl: userPicture || account.avatarUrl || null,
              }
            });
          } catch (dbErr) {
            // Fallback: If DB columns don't exist, update only basic info
            account = await prisma.customerAccount.update({
              where: { id: account.id },
              data: updateData,
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

        const baseCreateData = {
          email: userEmail || null,
          phone: inputPhone,
          username,
          name: inputName || "Customer",
        };

        try {
          account = await prisma.customerAccount.create({
            data: {
              ...baseCreateData,
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
            // Fallback: If avatarUrl causes Prisma Client validation error on server, retry without avatarUrl
            try {
              account = await prisma.customerAccount.create({
                data: {
                  ...baseCreateData,
                  googleId: userGoogleId || null,
                },
              });
            } catch (fallbackErr) {
              try {
                account = await prisma.customerAccount.create({
                  data: baseCreateData,
                });
              } catch (finalErr) {
                if (finalErr.code === "P2002") {
                  account = await prisma.customerAccount.findFirst({
                    where: {
                      OR: [
                        ...(userEmail ? [{ email: userEmail }, { phone: userEmail }] : []),
                        ...(inputPhone ? [{ phone: inputPhone }] : []),
                      ],
                    },
                  });
                } else {
                  throw finalErr;
                }
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
    registerCustomer,
    loginWithPassword,
    googleLogin,
  };
};
