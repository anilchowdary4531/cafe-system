import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, role, roles }) {
    const { user } = useAuth();
    const location = useLocation();

    // Not logged in
    if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

    // Role check
    const normalizedUserRole = String(user.role || "").toUpperCase();
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
