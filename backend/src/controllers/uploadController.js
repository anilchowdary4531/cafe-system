import { presignRestaurantUpload } from "../services/uploadService.js";

export const buildUploadController = () => {
  const presign = async (req, reply) => {
    try {
      const actor = req.staffActor;
      const restaurantId = Number(req.params?.restaurantId || actor?.restaurantId || 0);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });

      const body = req.body || {};
      const kind = body.kind || body.type || body.purpose || "";
      const contentType = body.contentType || body.mime || "";
      const fileName = body.fileName || body.name || "";
      const entityId = body.entityId || body.menuItemId || body.orderId || "";

      const result = await presignRestaurantUpload({ restaurantId, kind, contentType, fileName, entityId });
      return reply.send({ upload: result });
    } catch (err) {
      const code = String(err?.code || "");
      if (code === "S3_NOT_CONFIGURED") return reply.code(501).send({ message: "S3 is not configured on server" });
      return reply.code(400).send({ message: err?.message || "Unable to presign upload" });
    }
  };

  return { presign };
};

