import { createCashfreeVendor } from "../services/vendor.service.js";

export const buildVendorController = ({ prisma }) => {
  const createVendor = async (req, reply) => {
    try {
      const body = req.body || {};
      const restaurantId = body.restaurantId || body.restaurant_id;

      if (!restaurantId) {
        return reply.code(400).send({
          success: false,
          message: "restaurantId is required to create Cashfree vendor",
        });
      }

      let dbRestaurant = null;
      if (prisma) {
        try {
          const numericId = Number(restaurantId);
          if (!Number.isNaN(numericId)) {
            dbRestaurant = await prisma.restaurant.findUnique({
              where: { id: numericId },
            });
          }
          if (!dbRestaurant) {
            dbRestaurant = await prisma.restaurant.findFirst({
              where: { slug: String(restaurantId) },
            });
          }
        } catch (dbErr) {
          console.warn("[VendorController] DB restaurant lookup warning:", dbErr.message);
        }
      }

      const vendorName = body.name || body.vendorName || dbRestaurant?.name || dbRestaurant?.legalName || "Tiffzy Vendor";
      const vendorEmail = body.email || dbRestaurant?.email || null;
      const vendorPhone = body.phone || dbRestaurant?.phone || null;
      const vendorUpi = body.upi || dbRestaurant?.upiId || null;

      // Invoke Cashfree Easy Split Vendor Creation Service (with automatic retry)
      const result = await createCashfreeVendor({
        restaurantId,
        vendorId: body.vendorId || body.vendor_id || null,
        name: vendorName,
        email: vendorEmail,
        phone: vendorPhone,
        bankAccount: body.bankAccount || null,
        ifsc: body.ifsc || null,
        upi: vendorUpi,
        maxRetries: 3,
      });

      // Update Restaurant record in database if available
      if (dbRestaurant && prisma) {
        try {
          await prisma.restaurant.update({
            where: { id: dbRestaurant.id },
            data: {
              upiId: vendorUpi || dbRestaurant.upiId || null,
            },
          });
        } catch (updateErr) {
          console.warn("[VendorController] Warning updating restaurant record:", updateErr.message);
        }
      }

      return reply.code(200).send({
        success: true,
        message: "Cashfree Easy Split vendor created successfully",
        vendorId: result.vendorId,
        vendorName: result.name,
        restaurantId: result.restaurantId,
        status: result.status,
      });
    } catch (err) {
      console.error("[VendorController] createVendor Error:", err);
      return reply.code(500).send({
        success: false,
        message: err.message || "Failed to create Cashfree Easy Split vendor",
      });
    }
  };

  return {
    createVendor,
  };
};
