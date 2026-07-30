import bcrypt from "bcryptjs";
import { normalizePhone } from "../services/phoneService.js";

export const buildCustomerAuthController = ({ prisma, app }) => {
  const registerCustomer = async (req, reply) => {
    try {
      const body = req.body || {};
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "").trim();
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();

      // Use email as fallback for phone if phone is missing
      const rawPhone = String(body.phone || "").trim();
      const phone = normalizePhone(rawPhone || email);

      if (!username) return reply.code(400).send({ message: "Username is required" });
      if (username.length < 3) return reply.code(400).send({ message: "Username must be at least 3 characters" });
      if (!password || password.length < 6) return reply.code(400).send({ message: "Password must be at least 6 characters" });
      if (!phone) return reply.code(400).send({ message: "Identifier (Phone or Email) is required" });

      // Check username uniqueness
      const existingUsername = await prisma.customerAccount.findUnique({
        where: { username },
      });
      if (existingUsername) {
        return reply.code(400).send({ message: "Username is already taken" });
      }

      // Check identifier uniqueness
      const existingAccount = await prisma.customerAccount.findUnique({
        where: { phone },
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
      return reply.code(500).send({ message: "Internal server error. Database schema might be out of sync." });
    }
  };

  const loginWithPassword = async (req, reply) => {
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
      return reply.code(500).send({ message: "Login failed" });
    }
  };

  return {
    registerCustomer,
    loginWithPassword,
  };
};
