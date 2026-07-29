import bcrypt from "bcryptjs";
import { normalizePhone } from "../services/phoneService.js";

export const buildCustomerAuthController = ({ prisma, app }) => {
  const registerCustomer = async (req, reply) => {
    try {
      const body = req.body || {};
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "").trim();
      const phone = normalizePhone(body.phone || "");
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();

      if (!username) {
        return reply.code(400).send({ message: "Username is required" });
      }
      if (username.length < 3) {
        return reply.code(400).send({ message: "Username must be at least 3 characters" });
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        return reply.code(400).send({ message: "Username can only contain letters, numbers, underscores, dots, and hyphens" });
      }
      if (!password || password.length < 6) {
        return reply.code(400).send({ message: "Password must be at least 6 characters" });
      }

      // If no phone but email is provided, we use email as the phone identifier to satisfy the DB schema
      if (!phone && email) {
        // eslint-disable-next-line no-param-reassign
        body.phone = email;
      }

      const normalizedPhone = normalizePhone(body.phone || "");

      if (!normalizedPhone) {
        return reply.code(400).send({ message: "Phone number or Email is required" });
      }

      // Check username uniqueness
      const existingUsername = await prisma.customerAccount.findUnique({
        where: { username },
      });
      if (existingUsername) {
        return reply.code(400).send({ message: "Username is already taken" });
      }

      // Check phone uniqueness
      const existingPhoneAccount = await prisma.customerAccount.findUnique({
        where: { phone },
      });

      const hashedPassword = bcrypt.hashSync(password, 10);

      let account;
      if (existingPhoneAccount) {
        if (existingPhoneAccount.password) {
          return reply.code(400).send({ message: "An account with this phone number already exists. Please login." });
        }
        account = await prisma.customerAccount.update({
          where: { id: existingPhoneAccount.id },
          data: {
            username,
            password: hashedPassword,
            name: name || existingPhoneAccount.name || null,
            email: email || existingPhoneAccount.email || null,
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
      console.log(err);
      return reply.code(500).send({ message: "Failed to create account" });
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

      const normalizedPhone = normalizePhone(identifier);

      let account = await prisma.customerAccount.findFirst({
        where: {
          OR: [
            { username: identifier },
            { email: identifier },
            ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ],
        },
      });

      if (!account || !account.password) {
        return reply.code(401).send({ message: "Invalid credentials or account does not have a password set." });
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
      console.log(err);
      return reply.code(500).send({ message: "Login failed" });
    }
  };

  return {
    registerCustomer,
    loginWithPassword,
  };
};
