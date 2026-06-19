import { useEffect, useState } from "react";
import {
    getSession,
    addItemToSession,
    closeSession,
} from "../../services/tableService";

export default function RunningBill() {
    const TABLE_ID = 1;

    const [session, setSession] = useState(null);

    useEffect(() => {
        loadSession();
    }, []);

    const loadSession = async () => {
        const data = await getSession(TABLE_ID);
        setSession(data);
    };

    const addItem = async () => {
        await addItemToSession(TABLE_ID, {
            menuItemId: 1,
            qty: 1,
        });

        loadSession();
    };

    const handleClose = async () => {
        await closeSession(TABLE_ID);
        alert("Bill Closed");
    };

    if (!session) return <div>Loading...</div>;

    return (
        <div style={{ display: "flex", height: "100%" }}>

            {/* LEFT → ITEMS */}
            <div style={{ flex: 2, padding: 20 }}>
                <h2>Table #{TABLE_ID}</h2>

                <div style={{ display: "grid", gap: 10 }}>
                    {session.items.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                background: "white",
                                padding: 10,
                                borderRadius: 8,
                            }}
                        >
                            {item.itemName} x {item.qty}
                            <span style={{ float: "right" }}>₹{item.total}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT → BILL SUMMARY */}
            <div
                style={{
                    flex: 1,
                    padding: 20,
                    background: "#f1f5f9",
                }}
            >
                <h3>Bill Summary</h3>

                <p>Subtotal: ₹{session.subtotal}</p>
                <p>Tax: ₹{session.taxAmount}</p>

                <h2>Total: ₹{session.total}</h2>

                <button
                    onClick={addItem}
                    style={{
                        width: "100%",
                        padding: 10,
                        marginTop: 10,
                        background: "#2563eb",
                        color: "white",
                        borderRadius: 6,
                    }}
                >
                    Add Item
                </button>

                <button
                    onClick={handleClose}
                    style={{
                        width: "100%",
                        padding: 10,
                        marginTop: 10,
                        background: "#16a34a",
                        color: "white",
                        borderRadius: 6,
                    }}
                >
                    Close Bill
                </button>
            </div>
        </div>
    );
}