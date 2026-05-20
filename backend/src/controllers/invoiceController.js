import { buildInvoicePdf } from "../services/invoiceService.js";
import { buffer as consumeBuffer } from "node:stream/consumers";
import { buildRestaurantAssetKey, isS3Configured, presignGetObject, putObject, buildS3PublicUrl } from "../services/s3Service.js";

export const buildInvoiceController = ({ prisma }) => {
  const getInvoice = async (req, reply) => {
    try {
      const actor = req.staffActor;
      const orderId = Number(req.params?.orderId || 0);
      if (!orderId) return reply.code(400).send({ message: "Invalid order id" });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              gstNumber: true,
              addressLine1: true,
              city: true,
              state: true,
              pincode: true,
              currency: true,
            },
          },
          items: true,
        },
      });
      if (!order) return reply.code(404).send({ message: "Order not found" });

      if (actor?.restaurantId && Number(order.restaurantId) !== Number(actor.restaurantId) && String(actor.role).toUpperCase() !== "SUPER_ADMIN") {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const fileStem = String(order.invoiceNo || order.orderNo || `invoice-${orderId}`);

      // Prefer S3 (persistent storage + CDN option).
      if (isS3Configured()) {
        let key = String(order.invoiceS3Key || "");

        if (!key) {
          // Generate and upload invoice once.
          const pdfStream = await buildInvoicePdf({ order });
          const pdfBuffer = await consumeBuffer(pdfStream);

          key = buildRestaurantAssetKey({
            restaurantId: order.restaurantId,
            kind: "invoice",
            fileName: `${fileStem}.pdf`,
            contentType: "application/pdf",
            entityId: fileStem,
          });

          if (key) {
            await putObject({ key, body: pdfBuffer, contentType: "application/pdf" });
            await prisma.order.update({
              where: { id: orderId },
              data: {
                invoiceS3Key: key,
                invoiceS3Url: buildS3PublicUrl(key),
              },
            });
          }
        }

        if (key) {
          const { url } = await presignGetObject({ key, expiresIn: 120, responseContentType: "application/pdf" });
          return reply.redirect(url);
        }
      }

      // Fallback: generate and stream directly.
      const pdf = await buildInvoicePdf({ order });
      reply.type("application/pdf");
      reply.header("content-disposition", `inline; filename=\"${fileStem}.pdf\"`);
      return reply.send(pdf);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to generate invoice" });
    }
  };

  return { getInvoice };
};
