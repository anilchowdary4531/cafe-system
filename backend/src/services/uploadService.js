import {
  buildRestaurantAssetKey,
  buildS3PublicUrl,
  isS3Configured,
  presignPutObject,
} from "./s3Service.js";

const normalizeKind = (kind) => String(kind || "").trim().toLowerCase();

const isAllowedImageType = (contentType) => {
  const ct = String(contentType || "").toLowerCase();
  return ct === "image/png" || ct === "image/jpeg" || ct === "image/jpg" || ct === "image/webp" || ct === "image/svg+xml";
};

export const presignRestaurantUpload = async ({ restaurantId, kind, contentType, fileName, entityId } = {}) => {
  if (!isS3Configured()) {
    const err = new Error("S3 is not configured");
    err.code = "S3_NOT_CONFIGURED";
    throw err;
  }

  const rid = Number(restaurantId || 0);
  if (!rid) throw new Error("restaurantId is required");

  const k = normalizeKind(kind);
  const ct = String(contentType || "").trim();
  if (!ct) throw new Error("contentType is required");

  if ((k === "restaurant_logo" || k === "logo" || k === "menu_item_image" || k === "menu_image" || k === "menu") && !isAllowedImageType(ct)) {
    throw new Error("Unsupported image contentType");
  }
  if ((k === "invoice_pdf" || k === "invoice") && ct !== "application/pdf") {
    throw new Error("Invoice must be application/pdf");
  }

  const key = buildRestaurantAssetKey({ restaurantId: rid, kind: k, fileName, contentType: ct, entityId });
  if (!key) throw new Error("Failed to build key");

  const { url } = await presignPutObject({
    key,
    contentType: ct,
    expiresIn: 300,
  });

  return {
    key,
    uploadUrl: url,
    publicUrl: key.startsWith("public/") ? buildS3PublicUrl(key) : "",
    contentType: ct,
  };
};

