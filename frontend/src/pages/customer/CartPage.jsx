import { useCartStore } from "../../store/cartStore";
import { placeOrder } from "../../services/orderService";
import { useParams } from "react-router-dom";

export default function CartPage() {
    const { slug } = useParams();
    const { items, clearCart } = useCartStore();

    const handleOrder = async () => {
        await placeOrder(slug, {
            items: items.map((i) => ({
                id: i.id,
                qty: i.qty,
            })),
        });

        clearCart();
        alert("Order placed!");
    };

    return (
        <div>
            <h2>Cart</h2>

            {items.map((i) => (
                <div key={i.id}>
                    {i.name} x {i.qty}
                </div>
            ))}

            <button onClick={handleOrder}>Place Order</button>
        </div>
    );
}