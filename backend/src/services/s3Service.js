import crypto from "node:crypto";
import path from "node:path";

let client = null;
let awsSdkPromise = null;

const getS3Env = () => ({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "",
  bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "",
  endpoint: process.env.AWS_S3_ENDPOINT || process.env.S3_ENDPOINT || "",
  publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || process.env.CDN_BASE_URL || "",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  sse: String(process.env.S3_SSE || "").trim().toUpperCase(),
  kmsKeyId: String(process.env.S3_KMS_KEY_ID || "").trim(),
});

const getAwsSdk = async () => {
  if (!awsSdkPromise) {
    awsSdkPromise = Promise.all([import("@aws-sdk/client-s3"), import("@aws-sdk/s3-request-presigner")])
      .then(([s3, presigner]) => ({
        S3Client: s3.S3Client,
        PutObjectCommand: s3.PutObjectCommand,
        GetObjectCommand: s3.GetObjectCommand,
        DeleteObjectCommand: s3.DeleteObjectCommand,
        getSignedUrl: presigner.getSignedUrl,
      }))
      .catch((err) => {
        awsSdkPromise = null;
        const e = new Error(
          "[s3] AWS SDK packages are missing. Install backend deps (npm -C backend install) or add @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner."
        );
        e.cause = err;
        throw e;
      });
  }
  return awsSdkPromise;
};

export const isS3Configured = () => {
  const { region, bucket, accessKeyId, secretAccessKey } = getS3Env();
  return Boolean(region && bucket && accessKeyId && secretAccessKey);
};

export const getS3Bucket = () => getS3Env().bucket;

const buildClient = async () => {
  const { S3Client } = await getAwsSdk();
  const { region, accessKeyId, secretAccessKey, endpoint } = getS3Env();
  const base = {
    region,
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }
      : {}),
  };

  if (endpoint) {
    // Useful for LocalStack / MinIO.
    return new S3Client({
      ...base,
      endpoint,
      forcePathStyle: true,
    });
  }
  return new S3Client(base);
};

export const getS3Client = async () => {
  if (!client) client = await buildClient();
  return client;
};

const safeUuid = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return crypto.randomBytes(16).toString("hex");
};

const dateKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const extFromContentType = (contentType) => {
  const ct = String(contentType || "").toLowerCase();
  if (ct === "image/png") return "png";
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
  if (ct === "image/webp") return "webp";
  if (ct === "image/svg+xml") return "svg";
  if (ct === "application/pdf") return "pdf";
  return "";
};

const safeExt = ({ fileName, contentType } = {}) => {
  const raw = String(fileName || "");
  const parsed = path.extname(raw).replace(".", "").toLowerCase();
  if (parsed && /^[a-z0-9]{1,8}$/.test(parsed)) return parsed;
  return extFromContentType(contentType) || "bin";
};

const safeJoinUrl = (base, key) => {
  const b = String(base || "").replace(/\/+$/, "");
  const k = String(key || "").replace(/^\/+/, "");
  return `${b}/${k}`;
};

export const buildS3PublicUrl = (key) => {
  const k = String(key || "");
  if (!k) return "";
  const { publicBaseUrl, region, bucket } = getS3Env();
  if (publicBaseUrl) return safeJoinUrl(publicBaseUrl, k);
  if (!region || !bucket) return "";
  // Fallback (works if bucket/object is public).
  return `https://${bucket}.s3.${region}.amazonaws.com/${k}`;
};

export const buildRestaurantAssetKey = ({ restaurantId, kind, fileName, contentType, entityId } = {}) => {
  const rid = Number(restaurantId || 0);
  if (!rid) return "";
  const normalizedKind = String(kind || "").trim().toLowerCase();

  if (normalizedKind === "restaurant_logo" || normalizedKind === "logo") {
    const ext = safeExt({ fileName, contentType });
    return `public/restaurants/${rid}/logo/${dateKey()}-${safeUuid()}.${ext}`;
  }

  if (normalizedKind === "restaurant_banner" || normalizedKind === "banner") {
    const ext = safeExt({ fileName, contentType });
    return `public/restaurants/${rid}/banner/${dateKey()}-${safeUuid()}.${ext}`;
  }

  if (normalizedKind === "restaurant_favicon" || normalizedKind === "favicon") {
    const ext = safeExt({ fileName, contentType });
    return `public/restaurants/${rid}/favicon/${dateKey()}-${safeUuid()}.${ext}`;
  }

  if (normalizedKind === "menu_item_image" || normalizedKind === "menu_image" || normalizedKind === "menu") {
    const ext = safeExt({ fileName, contentType });
    const eid = entityId ? String(entityId).replace(/[^a-zA-Z0-9_-]/g, "") : "misc";
    return `public/restaurants/${rid}/menu/${eid}/${dateKey()}-${safeUuid()}.${ext}`;
  }

  if (normalizedKind === "invoice_pdf" || normalizedKind === "invoice") {
    const eid = entityId ? String(entityId).replace(/[^a-zA-Z0-9_-]/g, "") : safeUuid();
    return `private/restaurants/${rid}/invoices/${eid}.pdf`;
  }

  const ext = safeExt({ fileName, contentType });
  return `public/restaurants/${rid}/uploads/${dateKey()}-${safeUuid()}.${ext}`;
};

const addEncryption = (input) => {
  const { sse, kmsKeyId } = getS3Env();
  if (!sse) return input;
  if (sse === "AES256") return { ...input, ServerSideEncryption: "AES256" };
  if (sse === "AWS:KMS" || sse === "AWS_KMS" || sse === "AWS-KMS" || sse === "AWSKMS") {
    return { ...input, ServerSideEncryption: "aws:kms", ...(kmsKeyId ? { SSEKMSKeyId: kmsKeyId } : {}) };
  }
  return input;
};

export const presignPutObject = async ({ key, contentType, cacheControl, expiresIn = 300 } = {}) => {
  if (!isS3Configured()) throw new Error("S3 is not configured");
  const k = String(key || "");
  if (!k) throw new Error("key is required");
  const { bucket } = getS3Env();

  const { PutObjectCommand, getSignedUrl } = await getAwsSdk();
  const cmd = new PutObjectCommand(
    addEncryption({
      Bucket: bucket,
      Key: k,
      ContentType: contentType ? String(contentType) : undefined,
      CacheControl: cacheControl ? String(cacheControl) : undefined,
    })
  );

  const url = await getSignedUrl(await getS3Client(), cmd, {
    expiresIn: Math.max(30, Math.min(3600, Number(expiresIn || 300))),
    ...(contentType ? { signableHeaders: new Set(["content-type"]) } : {}),
  });
  return { url };
};

export const presignGetObject = async ({ key, expiresIn = 300, responseContentType } = {}) => {
  if (!isS3Configured()) throw new Error("S3 is not configured");
  const k = String(key || "");
  if (!k) throw new Error("key is required");
  const { bucket } = getS3Env();

  const { GetObjectCommand, getSignedUrl } = await getAwsSdk();
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: k,
    ResponseContentType: responseContentType ? String(responseContentType) : undefined,
  });

  const url = await getSignedUrl(await getS3Client(), cmd, {
    expiresIn: Math.max(30, Math.min(3600, Number(expiresIn || 300))),
  });
  return { url };
};

export const putObject = async ({ key, body, contentType, cacheControl } = {}) => {
  if (!isS3Configured()) throw new Error("S3 is not configured");
  const k = String(key || "");
  if (!k) throw new Error("key is required");
  const { bucket } = getS3Env();

  const { PutObjectCommand } = await getAwsSdk();
  const cmd = new PutObjectCommand(
    addEncryption({
      Bucket: bucket,
      Key: k,
      Body: body,
      ContentType: contentType ? String(contentType) : undefined,
      CacheControl: cacheControl ? String(cacheControl) : undefined,
    })
  );

  await (await getS3Client()).send(cmd);
  return { key: k };
};

export const deleteObject = async ({ key } = {}) => {
  if (!isS3Configured()) throw new Error("S3 is not configured");
  const k = String(key || "");
  if (!k) throw new Error("key is required");
  const { bucket } = getS3Env();

  const { DeleteObjectCommand } = await getAwsSdk();
  await (await getS3Client()).send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: k,
    })
  );
  return { key: k };
};
