import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { resolveEffectiveStaffRole } from "../utils/staffRole";

export default function ProtectedRoute({ children, role, roles }) {
    const { user, staffToken } = useAuth();
    const location = useLocation();

    const token = staffToken || localStorage.getItem("token") || localStorage.getItem("supplierToken") || localStorage.getItem("staffToken");
    const storedUser = user || (() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || JSON.parse(localStorage.getItem("supplier")) || null;
        } catch {
            return null;
        }
    })();

    const activeUser = storedUser || (token ? { role: "OWNER", access: { supply: true } } : null);
    const hasSession = Boolean(token);

    // Not logged in
    if (!hasSession) return <Navigate to="/login?mode=staff" replace state={{ from: location }} />;

    // Role-based authorization check
    const allowedRoles = Array.isArray(roles)
        ? roles.map((r) => String(r).toUpperCase())
        : role
        ? [String(role).toUpperCase()]
        : null;

    if (allowedRoles && allowedRoles.length > 0) {
        const userRole = resolveEffectiveStaffRole(activeUser?.role, activeUser?.designation);
        const isAllowed = allowedRoles.some(
            (r) => r === userRole || (r === "WAITER" && userRole === "SERVER") || (r === "SERVER" && userRole === "WAITER")
        );
        if (!isAllowed) {
            return <Navigate to="/" replace state={{ from: location }} />;
        }
    }

    return children;
}
