import { Link } from "react-router-dom";

export default function AdminSidebar() {
    return (
        <div className="w-60 h-screen bg-[#111827] p-4 fixed">
            <h2 className="text-xl font-bold mb-6">Admin</h2>

            <div className="flex flex-col gap-3">
                <Link to="/admin">Dashboard</Link>
                <Link to="/admin/menu">Menu</Link>
                <Link to="/admin/orders">Orders</Link>
                <Link to="/admin/tables">Tables</Link>
            </div>
        </div>
    );
}