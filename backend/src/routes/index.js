import publicRoutes from "./public.js";
import authRoutes from "./auth.js";
import customerRoutes from "./customer.js";
import staffRoutes from "./staff.js";
import ownerRoutes from "./owner.js";
import superAdminRoutes from "./superAdmin.js";
import kitchenRoutes from "./kitchen.js";
import paymentRoutes from "./payment.routes.js";
import vendorRoutes from "./vendor.routes.js";
import walletRoutes from "./wallet.routes.js";
import notificationRoutes from "./notification.routes.js";
import healthRoutes from "./health.routes.js";
import supplierAuthRoutes from "./supplierAuth.routes.js";
import supplierProfileRoutes from "./supplierProfile.routes.js";
import supplierProductRoutes from "./supplierProduct.routes.js";
import supplyMarketplaceRoutes from "./supplyMarketplace.routes.js";
import superAdminSupplyRoutes from "./superAdminSupply.routes.js";
import supplyChatRoutes from "./supplyChat.routes.js";

// Single route entrypoint to keep server.js simple.
export default async function routes(app, deps) {
  await healthRoutes(app, deps);
  await supplierAuthRoutes(app, deps);
  await supplierProfileRoutes(app, deps);
  await supplierProductRoutes(app, deps);
  await supplyMarketplaceRoutes(app, deps);
  await superAdminSupplyRoutes(app, deps);
  await supplyChatRoutes(app, deps);
  await publicRoutes(app, deps);
  await authRoutes(app, deps);
  await customerRoutes(app, deps);
  await staffRoutes(app, deps);
  await ownerRoutes(app, deps);
  await superAdminRoutes(app, deps);
  await kitchenRoutes(app, deps);
  await paymentRoutes(app, deps);
  await vendorRoutes(app, deps);
  await walletRoutes(app, deps);
  await notificationRoutes(app, deps);
}
