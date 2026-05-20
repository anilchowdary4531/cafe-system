import { api } from "./apiClient";

export async function uploadToS3Presigned({ restaurantId, kind, file, entityId } = {}) {
    const rid = Number(restaurantId || 0);
    if (!rid) throw new Error("restaurantId is required");
    if (!file) throw new Error("file is required");

    const contentType = String(file.type || "").trim();
    if (!contentType) throw new Error("contentType is required");

    try {
        const res = await api.post(`/owner/${rid}/uploads/presign`, {
            kind,
            contentType,
            fileName: file.name,
            entityId,
        });

        const upload = res.data?.upload || null;
        if (!upload?.uploadUrl) throw new Error("Failed to presign upload");

        const putRes = await fetch(upload.uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": upload.contentType || contentType,
            },
            body: file,
        });

        if (!putRes.ok) {
            let details = "";
            try {
                details = await putRes.text();
            } catch {
                // ignore
            }
            throw new Error(details || `Upload failed (${putRes.status})`);
        }

        return upload;
    } catch (err) {
        const status = err?.response?.status;
        const message = String(err?.response?.data?.message || err?.message || "");

        // Local dev fallback when S3 isn't configured.
        if (status === 501 || message.toLowerCase().includes("s3 is not configured")) {
            const form = new FormData();
            form.append("file", file);

            const k = String(kind || "").trim().toLowerCase();

            if (k === "logo" || k === "restaurant_logo") {
                const res = await api.post(`/owner/${rid}/assets/logo`, form);
                return res.data?.upload;
            }
            if (k === "banner" || k === "restaurant_banner") {
                const res = await api.post(`/owner/${rid}/assets/banner`, form);
                return res.data?.upload;
            }
            if (k === "menu_item_image" || k === "menu_image" || k === "menu") {
                const q = entityId ? `?entityId=${encodeURIComponent(String(entityId))}` : "";
                const res = await api.post(`/owner/${rid}/assets/menu-image${q}`, form);
                return res.data?.upload;
            }
        }

        throw err;
    }
}
