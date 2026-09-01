import {
    getSupplierProfile,
    updateSupplierProfile,
    addSupplierAddress,
    updateSupplierAddress,
} from "../services/supplierProfileService.js";
import authorizeRoles from "../middleware/rbacGuard.js";

export default async function supplierProfileRoutes(app) {
    const authSupplier = authorizeRoles("SUPPLIER", "SUPER_ADMIN");

    const getProfileHandler = async (req, reply) => {
        try {
            const supplierId = req.user?.supplierId || req.user?.id;
            const profile = await getSupplierProfile(supplierId);
            return reply.code(200).send(profile);
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to fetch profile" });
        }
    };

    const updateProfileHandler = async (req, reply) => {
        try {
            const supplierId = req.user?.supplierId || req.user?.id;
            const updated = await updateSupplierProfile(supplierId, req.body || {});
            return reply.code(200).send({ message: "Supplier profile updated successfully", profile: updated });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to update profile" });
        }
    };

    const addAddressHandler = async (req, reply) => {
        try {
            const supplierId = req.user?.supplierId || req.user?.id;
            const address = await addSupplierAddress(supplierId, req.body || {});
            return reply.code(201).send({ message: "Address added successfully", address });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to add address" });
        }
    };

    const updateAddressHandler = async (req, reply) => {
        try {
            const supplierId = req.user?.supplierId || req.user?.id;
            const addressId = req.params?.addressId;
            const address = await updateSupplierAddress(supplierId, addressId, req.body || {});
            return reply.code(200).send({ message: "Address updated successfully", address });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to update address" });
        }
    };

    const endpoints = [
        { method: "GET", path: "/suppliers/me", handler: getProfileHandler },
        { method: "GET", path: "/api/v1/suppliers/me", handler: getProfileHandler },
        { method: "PUT", path: "/suppliers/me", handler: updateProfileHandler },
        { method: "PUT", path: "/api/v1/suppliers/me", handler: updateProfileHandler },
        { method: "POST", path: "/suppliers/me/address", handler: addAddressHandler },
        { method: "POST", path: "/api/v1/suppliers/me/address", handler: addAddressHandler },
        { method: "PUT", path: "/suppliers/me/address/:addressId", handler: updateAddressHandler },
        { method: "PUT", path: "/api/v1/suppliers/me/address/:addressId", handler: updateAddressHandler },
    ];

    for (const ep of endpoints) {
        if (ep.method === "GET") app.get(ep.path, { preHandler: [authSupplier] }, ep.handler);
        if (ep.method === "POST") app.post(ep.path, { preHandler: [authSupplier] }, ep.handler);
        if (ep.method === "PUT") app.put(ep.path, { preHandler: [authSupplier] }, ep.handler);
    }
}
