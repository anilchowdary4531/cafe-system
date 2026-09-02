import { Navigate, useLocation } from "react-router-dom";

export default function SupplierProtectedRoute({ children }) {
    const location = useLocation();
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    if (!token) {
        return <Navigate to="/supplier/login" replace state={{ from: location }} />;
    }

    return children;
}
