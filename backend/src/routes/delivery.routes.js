import {
  createDeliveryPartner,
  getDeliveryPartners,
  updateDeliveryPartner,
  deleteDeliveryPartner,
  assignDeliveryPartner,
  reassignDeliveryPartner,
  updateDeliveryStatus,
  updateDriverLocation,
  getRestaurantDeliveries,
  getDriverDeliveries,
  getDeliveryTrackingForCustomer,
  getDeliveryMetricsReport,
} from "../controllers/delivery.controller.js";

export default async function deliveryRoutes(app, deps = {}) {
  // Public Customer Tracking Endpoint
  app.get("/api/delivery/track/:orderId", getDeliveryTrackingForCustomer);
  app.get("/delivery/track/:orderId", getDeliveryTrackingForCustomer);

  // Delivery Partner CRUD Endpoints
  app.post("/api/delivery/partners", createDeliveryPartner);
  app.post("/delivery/partners", createDeliveryPartner);
  app.get("/api/delivery/partners", getDeliveryPartners);
  app.get("/delivery/partners", getDeliveryPartners);
  app.put("/api/delivery/partners/:id", updateDeliveryPartner);
  app.put("/delivery/partners/:id", updateDeliveryPartner);
  app.delete("/api/delivery/partners/:id", deleteDeliveryPartner);
  app.delete("/delivery/partners/:id", deleteDeliveryPartner);

  // Delivery Assignment & Management Endpoints
  app.post("/api/delivery/assign", assignDeliveryPartner);
  app.post("/delivery/assign", assignDeliveryPartner);
  app.post("/api/delivery/reassign", reassignDeliveryPartner);
  app.post("/delivery/reassign", reassignDeliveryPartner);
  app.post("/api/delivery/status", updateDeliveryStatus);
  app.post("/delivery/status", updateDeliveryStatus);
  app.post("/api/delivery/location", updateDriverLocation);
  app.post("/delivery/location", updateDriverLocation);
  app.get("/api/delivery/orders", getRestaurantDeliveries);
  app.get("/delivery/orders", getRestaurantDeliveries);
  app.get("/api/delivery/driver/orders", getDriverDeliveries);
  app.get("/delivery/driver/orders", getDriverDeliveries);
  app.get("/api/delivery/reports/metrics", getDeliveryMetricsReport);
  app.get("/delivery/reports/metrics", getDeliveryMetricsReport);
}
