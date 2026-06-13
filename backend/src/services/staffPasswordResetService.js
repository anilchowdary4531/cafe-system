const DEFAULT_STAFF_PASSWORD_RESET_EXPIRES_IN = process.env.STAFF_PASSWORD_RESET_EXPIRES_IN || "30m";
const STAFF_PASSWORD_RESET_PURPOSE = "STAFF_PASSWORD_RESET";

const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

export const buildStaffPasswordResetToken = ({ app, user, expiresIn = DEFAULT_STAFF_PASSWORD_RESET_EXPIRES_IN }) =>
  app.jwt.sign(
    {
      purpose: STAFF_PASSWORD_RESET_PURPOSE,
      staffUserId: user.id,
      email: user.email,
      restaurantId: user.restaurantId || null,
      branchId: user.branchId || null,
    },
    { expiresIn }
  );

export const buildStaffPasswordResetUrl = ({ frontendUrl, token, email }) => {
  const base = trimSlash(frontendUrl);
  const params = new URLSearchParams({
    mode: "staff",
    resetToken: String(token || ""),
  });

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (normalizedEmail) {
    params.set("email", normalizedEmail);
  }

  const path = `/login?${params.toString()}`;
  return base ? `${base}${path}` : path;
};

export const getStaffPasswordResetExpiresIn = () => DEFAULT_STAFF_PASSWORD_RESET_EXPIRES_IN;

export const isStaffPasswordResetToken = (payload) => String(payload?.purpose || "") === STAFF_PASSWORD_RESET_PURPOSE;
