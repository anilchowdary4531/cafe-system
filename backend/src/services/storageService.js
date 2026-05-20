import { deleteAssetLocal, getLocalUploadPathMode, getUploadsRoot, uploadRestaurantAssetLocal } from "./localStorageService.js";
import { deleteAssetS3, getS3UploadPathMode, uploadRestaurantAssetS3 } from "./s3StorageService.js";

export { getUploadsRoot };

const normalizeKind = (kind) => String(kind || "").trim().toLowerCase();

const isAllowedImageType = (contentType) => {
  const ct = String(contentType || "").toLowerCase();
  return ct === "image/png" || ct === "image/jpeg" || ct === "image/jpg" || ct === "image/webp" || ct === "image/svg+xml";
};

const effectiveDriver = () => {
  return String(process.env.NODE_ENV || "development").trim() === "production" ? "s3" : "local";
};

export const getStorageDriver = () => effectiveDriver();

export const getStorageInfo = () => {
  const driver = effectiveDriver();
  return {
    provider: driver,
    uploadPathMode: driver === "s3" ? getS3UploadPathMode() : getLocalUploadPathMode(),
  };
};

export const uploadRestaurantAsset = async ({ restaurantId, kind, contentType, fileName, entityId, stream } = {}) => {
  const rid = Number(restaurantId || 0);
  if (!rid) throw new Error("restaurantId is required");

  const k = normalizeKind(kind);
  const ct = String(contentType || "").trim();
  if (!ct) throw new Error("contentType is required");
  if (!stream) throw new Error("stream is required");

  // Currently only images are supported here.
  if (!isAllowedImageType(ct)) throw new Error("Unsupported image contentType");

  const driver = effectiveDriver();
  if (driver === "s3") {
    return uploadRestaurantAssetS3({ restaurantId: rid, kind: k, contentType: ct, fileName, entityId, stream });
  }

  return uploadRestaurantAssetLocal({ restaurantId: rid, kind: k, contentType: ct, fileName, entityId, stream });
};

export const deleteAssetByKey = async ({ key } = {}) => {
  const driver = effectiveDriver();
  if (driver === "s3") {
    return deleteAssetS3({ key });
  }

  return deleteAssetLocal({ key });
};
