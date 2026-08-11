import { requireCustomerPhoneFromJwt, getCustomerAccountByPhone } from "../services/customerProfileService.js";
import { createCustomerAddress, deleteCustomerAddress, listCustomerAddresses, updateCustomerAddress } from "../services/customerAddressService.js";

export const buildCustomerAddressController = ({ prisma }) => {
  const getAddresses = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req);
      if (!phone) return reply.code(401).send({ message: "Unauthorized" });

      const account = await getCustomerAccountByPhone({ prisma, phone });
      if (!account) return reply.code(404).send({ message: "Customer not found" });

      const addresses = await listCustomerAddresses({ prisma, customerAccountId: account.id });
      return { addresses };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch addresses" });
    }
  };

  const postAddress = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req);
      if (!phone) return reply.code(401).send({ message: "Unauthorized" });

      const account = await getCustomerAccountByPhone({ prisma, phone });
      if (!account) return reply.code(404).send({ message: "Customer not found" });

      const res = await createCustomerAddress({ prisma, customerAccountId: account.id, input: req.body || {} });
      if (!res.ok) return reply.code(res.status).send(res.payload);

      return { message: "Address created", address: res.address };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to create address" });
    }
  };

  const deleteAddress = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req);
      if (!phone) return reply.code(401).send({ message: "Unauthorized" });

      const account = await getCustomerAccountByPhone({ prisma, phone });
      if (!account) return reply.code(404).send({ message: "Customer not found" });

      const res = await deleteCustomerAddress({ prisma, customerAccountId: account.id, id: req.params?.id });
      if (!res.ok) return reply.code(res.status).send(res.payload);

      return { message: "Address deleted" };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete address" });
    }
  };

  const putAddress = async (req, reply) => {
    try {
      const phone = await requireCustomerPhoneFromJwt(req);
      if (!phone) return reply.code(401).send({ message: "Unauthorized" });

      const account = await getCustomerAccountByPhone({ prisma, phone });
      if (!account) return reply.code(404).send({ message: "Customer not found" });

      const res = await updateCustomerAddress({ prisma, customerAccountId: account.id, id: req.params?.id, input: req.body || {} });
      if (!res.ok) return reply.code(res.status).send(res.payload);

      return { message: "Address updated", address: res.address };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to update address" });
    }
  };

  return {
    getAddresses,
    postAddress,
    deleteAddress,
    putAddress,
  };
};

