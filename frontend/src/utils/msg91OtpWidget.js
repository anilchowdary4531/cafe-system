const PROVIDER_URLS = ["https://verify.msg91.com/otp-provider.js", "https://verify.phone91.com/otp-provider.js"];

let initPromise = null;

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-msg91-otp-provider="true"][src="${src}"]`);
    if (existing) return resolve();

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.setAttribute("data-msg91-otp-provider", "true");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

const ensureProviderLoaded = async () => {
  if (typeof window !== "undefined" && typeof window.initSendOTP === "function") return;

  let lastErr = null;
  for (const url of PROVIDER_URLS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await loadScript(url);
      if (typeof window.initSendOTP === "function") return;
      lastErr = new Error("MSG91 provider loaded, but initSendOTP is missing");
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Unable to load MSG91 OTP provider");
};

export const initMsg91OtpWidget = async ({ widgetId, tokenAuth } = {}) => {
  const id = String(widgetId || "").trim();
  const token = String(tokenAuth || "").trim();
  if (!id) throw new Error("MSG91 widgetId is missing");
  if (!token) throw new Error("MSG91 tokenAuth is missing");

  if (!initPromise) {
    initPromise = (async () => {
      await ensureProviderLoaded();
      window.initSendOTP({
        widgetId: id,
        tokenAuth: token,
        exposeMethods: true,
        // We listen to the per-call callbacks (sendOtp/verifyOtp), so these can be no-ops.
        success: () => {},
        failure: () => {},
      });
    })();
  }

  await initPromise;

  if (typeof window.sendOtp !== "function" || typeof window.verifyOtp !== "function") {
    throw new Error("MSG91 OTP methods are not available on window");
  }
};

export const toMsg91Identifier = (rawPhoneOrEmail) => {
  const raw = String(rawPhoneOrEmail || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.toLowerCase();

  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.length > 10) return digits; // assume caller included country code already
  // Default to India if only 10 digits are entered.
  return `91${digits}`;
};

export const extractMsg91AccessToken = (data) => {
  if (!data) return "";
  return (
    String(
      data.accessToken ||
        data["access-token"] ||
        data.access_token ||
        data.token ||
        data.jwt ||
        data?.data?.accessToken ||
        data?.data?.["access-token"] ||
        data?.data?.token ||
        ""
    ).trim() || ""
  );
};

