import RestaurantChooser from "./RestaurantChooser";
import { Navigate, useParams, useSearchParams } from "react-router-dom";

export default function Landing() {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const table = String(searchParams.get("table") || "").trim();

    if (slug && table) {
        return <Navigate to={`/m/${encodeURIComponent(slug)}/${encodeURIComponent(table)}`} replace />;
    }

    return <RestaurantChooser />;
}
