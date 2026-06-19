export default function OwnerDashboard() {
    return (
        <div>
            <h1 style={{ fontSize: 26, marginBottom: 20 }}>Dashboard</h1>

            <div style={{ display: "flex", gap: 20 }}>
                <Card title="Total Orders" value="12" />
                <Card title="Revenue" value="₹4,500" />
                <Card title="Active Tables" value="5" />
            </div>
        </div>
    );
}

function Card({ title, value }) {
    return (
        <div
            style={{
                flex: 1,
                background: "white",
                padding: 20,
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
        >
            <p style={{ color: "#6b7280" }}>{title}</p>
            <h2>{value}</h2>
        </div>
    );
}