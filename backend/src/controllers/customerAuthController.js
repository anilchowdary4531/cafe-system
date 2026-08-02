import bcrypt from "bcryptjs";
import { normalizePhone } from "../services/phoneService.js";

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

      // Use email as fallback for phone if phone is missing
      const rawPhone = String(body.phone || body.b || body.identifier || "").trim();
      const phone = normalizePhone(rawPhone || email);

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
      if (!phone) {
        console.log("FAILED HERE -> phone/email missing");
        return reply.code(400).send({ message: "Identifier (Phone or Email) is required" });
      }

      // Check username uniqueness
      const existingUsername = await prisma.customerAccount.findUnique({
        where: { username },
      });
      if (existingUsername) {
        console.log("FAILED HERE -> duplicate username", username);
        return reply.code(400).send({ message: "Username is already taken" });
      }

      // Check identifier uniqueness
      const existingAccount = await prisma.customerAccount.findUnique({
        where: { phone },
      });
      console.log("DEBUG [registerCustomer] existingAccount check:", !!existingAccount);

      const hashedPassword = bcrypt.hashSync(password, 10);

      let account;
      if (existingAccount) {
        if (existingAccount.password) {
          console.log("FAILED HERE -> duplicate identifier (account exists and has password)", phone);
          return reply.code(400).send({ message: "An account with this identifier already exists. Please login." });
        }
        console.log("DEBUG [registerCustomer] upgrading existing partial account");
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
    console.log("========== AUTH REQUEST ==========");
    console.log("URL:", req.url);
    console.log("Method:", req.method);
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("==================================");
    try {
      const body = req.body || {};
      const identifier = String(body.username || body.identifier || "").trim().toLowerCase();
      const password = String(body.password || "").trim();

      if (!identifier || !password) {
        return reply.code(400).send({ message: "Username/Phone/Email and password are required" });
      }

      const normalizedIdentifier = normalizePhone(identifier);

      let account = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            { username: identifier },
            { email: identifier },
            { phone: normalizedIdentifier },
          ],
        },
      });

      if (!account || !account.password) {
        return reply.code(401).send({ message: "Invalid credentials." });
      }

      const valid = bcrypt.compareSync(password, account.password);
      if (!valid) {
        return reply.code(401).send({ message: "Invalid username or password" });
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
      const { googleId, email, name, picture, credential, idToken } = body;

      const userEmail = String(email || "").trim().toLowerCase();
      const userGoogleId = String(googleId || "").trim();
      const userName = String(name || "").trim();

      if (!userEmail && !userGoogleId && !credential && !idToken) {
        return reply.code(400).send({ message: "Google credentials or payload are required" });
      }

      let account = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            ...(userGoogleId ? [{ googleId: userGoogleId }] : []),
            ...(userEmail ? [{ email: userEmail }, { phone: userEmail }] : []),
          ],
        },
      });

      if (!account) {
        const baseUsername = userEmail ? userEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "") : `user_${Date.now()}`;
        let username = baseUsername;
        let counter = 1;
        while (await prisma.customerAccount.findUnique({ where: { username } })) {
          username = `${baseUsername}_${counter++}`;
        }

        account = await prisma.customerAccount.create({
          data: {
            googleId: userGoogleId || null,
            email: userEmail || null,
            phone: userEmail || `google_${userGoogleId || Date.now()}`,
            username,
            name: userName || "Google User",
          },
        });
      } else if (!account.googleId && userGoogleId) {
        account = await prisma.customerAccount.update({
          where: { id: account.id },
          data: {
            googleId: userGoogleId,
            name: account.name || userName || null,
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
