import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { resolveEffectiveStaffRole } from "../utils/staffRole";

export default function ProtectedRoute({ children, role, roles }) {
    const { user, staffToken } = useAuth();
    const location = useLocation();
    const hasStaffSession = Boolean(user && staffToken);

    // Not logged in
    if (!hasStaffSession) return <Navigate to="/login?mode=staff" replace state={{ from: location }} />;

    // Role check
    const normalizedUserRole = resolveEffectiveStaffRole(user?.role, user?.designation);
    const required = Array.isArray(roles) ? roles : role ? [role] : [];
    const normalizedRequiredRoles = required
        .map((r) => String(r || "").toUpperCase())
        .filter(Boolean);

    if (
        normalizedRequiredRoles.length > 0 &&
        !normalizedRequiredRoles.includes(normalizedUserRole) &&
        !(normalizedRequiredRoles.includes("ADMIN") && normalizedUserRole === "SUPER_ADMIN")
    ) {
        return <Navigate to="/" replace />;
    }

    return children;
}
