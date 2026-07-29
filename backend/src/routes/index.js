import publicRoutes from "./public.js";
import authRoutes from "./auth.js";
import customerRoutes from "./customer.js";
import staffRoutes from "./staff.js";
import ownerRoutes from "./owner.js";
import superAdminRoutes from "./superAdmin.js";
import kitchenRoutes from "./kitchen.js";

// Single route entrypoint to keep server.js simple.
export default async function routes(app, deps) {
  await publicRoutes(app, deps);
  await authRoutes(app, deps);
  await customerRoutes(app, deps);
  await staffRoutes(app, deps);
  await ownerRoutes(app, deps);
  await superAdminRoutes(app, deps);
  await kitchenRoutes(app, deps);
}
