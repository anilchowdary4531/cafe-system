import { normalizePhone } from "../services/phoneService.js";
import { requireCustomerPhoneFromJwt, getCustomerAccountByPhone, upsertCustomerAccount } from "../services/customerProfileService.js";

export const buildCustomerProfileController = ({ prisma }) => {
  const getProfile = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req);
      if (!phone) return reply.code(401).send({ message: "Unauthorized" });

      const account = await getCustomerAccountByPhone({ prisma, phone });
      if (!account) return reply.code(404).send({ message: "Customer not found" });

      const slug = req.query.slug || "";
      let rewardPoints = 0;
      if (slug) {
        const scoped = await prisma.customer.findFirst({
          where: { phone, restaurant: { slug } },
          select: { rewardPoints: true }
        });
        if (scoped) {
          rewardPoints = scoped.rewardPoints;
        }
      } else {
        const scopedSum = await prisma.customer.aggregate({
          where: { phone },
          _sum: { rewardPoints: true }
        });
        rewardPoints = scopedSum._sum?.rewardPoints || 0;
      }

      return { customer: { ...account, rewardPoints } };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch customer profile" });
    }
  };

  const putProfile = async (req, reply) => {
    try {
      const phoneFromToken = await requireCustomerPhoneFromJwt(req);
      if (!phoneFromToken) return reply.code(401).send({ message: "Unauthorized" });

      const body = req.body || {};
      const phone = normalizePhone(body.phone || phoneFromToken || "");
      if (!phone) return reply.code(400).send({ message: "Phone number is required" });
      if (phone !== phoneFromToken) return reply.code(403).send({ message: "Phone mismatch" });

      const account = await upsertCustomerAccount({
        prisma,
        phone,
        name: body.name,
        email: body.email,
      });

      return { message: "Profile updated", customer: account };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to update profile" });
    }
  };

  return {
    getProfile,
    putProfile,
  };
};

