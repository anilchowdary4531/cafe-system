export default function KitchenPage() {
    return (
        <div>
            <h1 style={{ marginBottom: 20 }}>Kitchen</h1>

            <div style={{ display: "flex", gap: 20 }}>
                <Column title="PLACED" />
                <Column title="PREPARING" />
                <Column title="READY" />
            </div>
        </div>
    );
}

function Column({ title }) {
    return (
        <div style={{ flex: 1 }}>
            <h3>{title}</h3>

            <div style={{ display: "grid", gap: 10 }}>
                {[1,2].map((i) => (
                    <div
                        key={i}
                        style={{
                            background: "white",
                            padding: 12,
                            borderRadius: 10,
                        }}
                    >
                        Order #{i}
                    </div>
                ))}
            </div>
        </div>
    );
}