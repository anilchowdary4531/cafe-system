import {
  buildRestaurantAssetKey,
  buildS3PublicUrl,
  deleteObject,
  getS3Bucket,
  isS3Configured,
  putObject,
} from "./s3Service.js";

const safeKey = (key) => {
  const k = String(key || "").replace(/^\/+/, "");
  if (!k || k.includes("..")) return "";
  return k;
};

export const getS3UploadPathMode = () => `s3://${getS3Bucket()}/public`;

export const uploadRestaurantAssetS3 = async ({ restaurantId, kind, contentType, fileName, entityId, stream } = {}) => {
  if (!isS3Configured()) throw new Error("S3 is not configured");

  const key = buildRestaurantAssetKey({ restaurantId, kind, fileName, contentType, entityId });
  const safe = safeKey(key);
  if (!safe) throw new Error("Failed to build key");

  await putObject({ key: safe, body: stream, contentType });

  return {
    key: safe,
    publicUrl: buildS3PublicUrl(safe),
    contentType,
    driver: "s3",
  };
};

export const deleteAssetS3 = async ({ key } = {}) => {
  const safe = safeKey(key);
  if (!safe) throw new Error("key is required");
  if (!isS3Configured()) throw new Error("S3 is not configured");

  await deleteObject({ key: safe });
  return { key: safe, driver: "s3" };
};
