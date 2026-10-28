import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { API } from "../config";

/**
 * Custom hook to dynamically monitor restaurant staff capabilities (Cleaner, Steward, etc.)
 * Authoritative single source of truth: Owner staff configuration.
 * Realtime synchronization via Socket.IO events ('capabilities:updated', 'staff:updated').
 */
export function useStaffCapabilities(overrideRestaurantId = null) {
    const { token, user } = useAuth();
    const { socket } = useStaffSocket();

    const restaurantId = Number(
        overrideRestaurantId ||
        user?.restaurantId ||
        user?.restaurant?.id ||
        localStorage.getItem("restaurantId") ||
        0
    );

    const [capabilities, setCapabilities] = useState({
        hasCleaner: false,
        hasSteward: false,
        cleanerCount: 0,
        stewardCount: 0,
    });
    const [loading, setLoading] = useState(true);

    const fetchCapabilities = useCallback(async () => {
        if (!restaurantId) {
            setLoading(false);
            return;
        }

        try {
            // First attempt staff capabilities endpoint
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API}/api/v1/staff/capabilities`, {
                headers,
                params: { restaurantId },
            });

            if (res.data?.success && res.data?.capabilities) {
                setCapabilities(res.data.capabilities);
            }
        } catch (err) {
            // Fallback to owner capabilities endpoint if accessible
            try {
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const fallbackRes = await axios.get(`${API}/owner/${restaurantId}/capabilities`, { headers });
                if (fallbackRes.data?.capabilities) {
                    setCapabilities(fallbackRes.data.capabilities);
                }
            } catch (fallbackErr) {
                // Silently maintain current capabilities if offline/unauthorized
            }
        } finally {
            setLoading(false);
        }
    }, [restaurantId, token]);

    useEffect(() => {
        fetchCapabilities();
    }, [fetchCapabilities]);

    // Socket.IO realtime listener
    useEffect(() => {
        if (!socket) return;

        const onCapabilitiesUpdated = (data) => {
            if (!data?.restaurantId || Number(data.restaurantId) === Number(restaurantId)) {
                if (data.capabilities) {
                    setCapabilities(data.capabilities);
                } else if (data.hasCleaner !== undefined || data.hasSteward !== undefined) {
                    setCapabilities((prev) => ({ ...prev, ...data }));
                } else {
                    fetchCapabilities();
                }
            }
        };

        const onStaffUpdated = (data) => {
            if (!data?.restaurantId || Number(data.restaurantId) === Number(restaurantId)) {
                fetchCapabilities();
            }
        };

        socket.on("capabilities:updated", onCapabilitiesUpdated);
        socket.on("staff:updated", onStaffUpdated);

        return () => {
            socket.off("capabilities:updated", onCapabilitiesUpdated);
            socket.off("staff:updated", onStaffUpdated);
        };
    }, [socket, restaurantId, fetchCapabilities]);

    return {
        capabilities,
        hasCleaner: Boolean(capabilities.hasCleaner),
        hasSteward: Boolean(capabilities.hasSteward),
        cleanerCount: Number(capabilities.cleanerCount || 0),
        stewardCount: Number(capabilities.stewardCount || 0),
        loading,
        refreshCapabilities: fetchCapabilities,
    };
}

export default useStaffCapabilities;
