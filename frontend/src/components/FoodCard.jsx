import { resolveImageUrl } from "../utils/resolveImageUrl";

export default function FoodCard({ item, addToCart }) {
    return (
        <div className="bg-white rounded-2xl shadow-md p-4 hover:shadow-xl transition">
            <img
                src={resolveImageUrl(item.image)}
                alt={item.name}
                className="w-full h-40 object-cover rounded-xl"
            />
            <h2 className="text-lg font-semibold mt-2">{item.name}</h2>
            <p className="text-gray-500">₹{item.price}</p>

            <button
                onClick={() => addToCart(item)}
                className="mt-3 w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700"
            >
                Add to Cart
            </button>
        </div>
    );
}
