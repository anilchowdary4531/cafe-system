import https from "node:https";

const postJson = ({ hostname, path, headers, body }) =>
  new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...(headers || {}),
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const status = Number(res.statusCode || 0) || 0;
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({ status, ok: status >= 200 && status < 300, json, raw });
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });

export const verifyMsg91AccessToken = async ({ accessToken } = {}) => {
  const authkey = String(
    process.env.MSG91_WIDGET_AUTHKEY ||
      process.env.MSG91_AUTHKEY ||
      process.env.MSG91_AUTH_KEY ||
      process.env.MSG91_AUTH_KEY ||
      ""
  ).trim();
  if (!authkey) {
    return { ok: false, status: 500, payload: { message: "MSG91 auth key is not configured" } };
  }

  const token = String(accessToken || "").trim();
  if (!token) {
    return { ok: false, status: 400, payload: { message: "accessToken is required" } };
  }

  const res = await postJson({
    hostname: "control.msg91.com",
    path: "/api/v5/widget/verifyAccessToken",
    headers: { authkey },
    body: {
      // MSG91 docs/snippets sometimes include authkey in the body as well; include for compatibility.
      authkey,
      "access-token": token,
    },
  });

  if (!res.ok) {
    const message =
      (res.json && (res.json.message || res.json.error || res.json.type)) ||
      (res.raw ? String(res.raw).slice(0, 200) : "") ||
      "MSG91 verification failed";
    return { ok: false, status: res.status || 502, payload: { message } };
  }

  return { ok: true, status: 200, data: res.json || {} };
};

export const extractVerifiedIdentifier = (data) => {
  // MSG91 response shapes vary a bit across integrations. Try a few likely fields.
  const candidate =
    data?.identifier ||
    data?.data?.identifier ||
    data?.mobile ||
    data?.data?.mobile ||
    data?.email ||
    data?.data?.email ||
    data?.phone ||
    data?.data?.phone ||
    "";

  return String(candidate || "").trim();
};
