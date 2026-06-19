import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMenu } from "../../services/menuService";
import { useCartStore } from "../../store/cartStore";

export default function MenuPage() {
    const { slug } = useParams();
    const [menu, setMenu] = useState([]);
    const addItem = useCartStore((s) => s.addItem);

    useEffect(() => {
        getMenu(slug).then((data) => {
            setMenu(data.menu || []);
        });
    }, [slug]);

    return (
        <div>
            <h2>Menu</h2>

            {menu.map((item) => (
                <div key={item.id}>
                    {item.name} - ₹{item.price}

                    <button onClick={() => addItem(item)}>Add</button>
                </div>
            ))}
        </div>
    );
}