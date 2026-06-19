import { useEffect } from "react";
import { socket } from "../services/socket";

export default function useSocket(restaurantId, onNewOrder) {
    useEffect(() => {
        if (!restaurantId) return;

        // ✅ connect once
        if (!socket.connected) {
            socket.connect();
        }

        // ✅ join room
        socket.emit("join_restaurant", restaurantId);

        // ✅ listen
        socket.on("new_order", onNewOrder);

        return () => {
            // ✅ cleanup listener only (NOT disconnect globally)
            socket.off("new_order", onNewOrder);
        };
    }, [restaurantId, onNewOrder]);
}