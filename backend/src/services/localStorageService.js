import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { buildRestaurantAssetKey } from "./s3Service.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const uploadsRoot = path.join(backendRoot, "uploads");

const safeKey = (key) => {
  const k = String(key || "").replace(/^\/+/, "");
  if (!k || k.includes("..")) return "";
  return k;
};

const localUploadOrigin = () => {
  const configured = String(process.env.LOCAL_UPLOAD_BASE_URL || process.env.BACKEND_PUBLIC_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return `http://localhost:${process.env.PORT || 4000}`;
};

const publicUrlForLocalKey = (key) => `${localUploadOrigin()}/uploads/${String(key || "").replace(/^\/+/, "")}`;

export const getUploadsRoot = () => uploadsRoot;

export const getLocalUploadPathMode = () => path.join(uploadsRoot, "public");

export const uploadRestaurantAssetLocal = async ({ restaurantId, kind, contentType, fileName, entityId, stream } = {}) => {
  const key = buildRestaurantAssetKey({ restaurantId, kind, fileName, contentType, entityId });
  const safe = safeKey(key);
  if (!safe) throw new Error("Failed to build key");

  const targetPath = path.join(uploadsRoot, safe);
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await pipeline(stream, fs.createWriteStream(targetPath));

  return {
    key: safe,
    publicUrl: publicUrlForLocalKey(safe),
    contentType,
    driver: "local",
  };
};

export const deleteAssetLocal = async ({ key } = {}) => {
  const safe = safeKey(key);
  if (!safe) throw new Error("key is required");

  const targetPath = path.join(uploadsRoot, safe);
  try {
    await fsp.unlink(targetPath);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  return { key: safe, driver: "local" };
};
