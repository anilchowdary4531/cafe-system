import { buildVendorController } from "../controllers/vendor.controller.js";

export default async function vendorRoutes(app, deps = {}) {
  const prisma = deps.prisma;
  const vendorController = buildVendorController({ prisma });

  // Endpoint: POST /api/vendors/create
  app.post("/api/vendors/create", vendorController.createVendor);

  // Alias endpoint: POST /vendors/create for maximum framework compatibility
  app.post("/vendors/create", vendorController.createVendor);
}
