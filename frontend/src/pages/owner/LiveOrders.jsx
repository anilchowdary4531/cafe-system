export default function LiveOrders() {
    return (
        <div>
            <h1>Live Orders</h1>

            <div style={{ display: "grid", gap: 12 }}>
                {[1,2,3].map((id) => (
                    <div
                        key={id}
                        style={{
                            background: "white",
                            padding: 15,
                            borderRadius: 10,
                            display: "flex",
                            justifyContent: "space-between",
                        }}
                    >
                        <div>
                            <b>Order #{id}</b>
                            <p style={{ color: "#6b7280" }}>2 items</p>
                        </div>

                        <span style={status("PREPARING")}>Preparing</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function status(type) {
    const map = {
        PLACED: "#2563eb",
        PREPARING: "#f59e0b",
        READY: "#16a34a",
    };

    return {
        background: map[type],
        color: "white",
        padding: "4px 10px",
        borderRadius: 6,
    };
}