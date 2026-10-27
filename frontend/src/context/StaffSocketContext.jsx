import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API } from "../config";
import { useAuth } from "./AuthContext";

const StaffSocketContext = createContext(null);

const buildSocket = (token) => {
    return io(`${API}/staff`, {
        auth: { token },
        transports: ["websocket"], // avoid long-polling fallbacks
        reconnection: true,
        reconnectionDelayMax: 1200,
    });
};

export function StaffSocketProvider({ children }) {
    const { user, staffToken } = useAuth();
    const socketRef = useRef(null);
    const tokenRef = useRef("");

    const [socketInstance, setSocketInstance] = useState(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const token = String(staffToken || "").trim();

        if (!user || !token) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            tokenRef.current = "";
            setSocketInstance(null);
            setConnected(false);
            setError("");
            return undefined;
        }

        // Reuse the same connection while token is unchanged.
        if (socketRef.current && tokenRef.current === token) {
            if (socketInstance !== socketRef.current) setSocketInstance(socketRef.current);
            return undefined;
        }

        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        const socket = buildSocket(token);
        socketRef.current = socket;
        tokenRef.current = token;
        setSocketInstance(socket);

        const onConnect = () => {
            setConnected(true);
            setError("");
        };
        const onDisconnect = () => setConnected(false);
        const onConnectError = (err) => {
            setConnected(false);
            setError(String(err?.message || "socket_error"));
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onConnectError);

        setConnected(socket.connected);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onConnectError);
            socket.disconnect();
            if (socketRef.current === socket) {
                socketRef.current = null;
                tokenRef.current = "";
                setSocketInstance(null);
            }
        };
    }, [staffToken, user?.id]);

    const value = useMemo(
        () => ({
            socket: socketInstance,
            connected,
            error,
        }),
        [connected, error, socketInstance]
    );

    return <StaffSocketContext.Provider value={value}>{children}</StaffSocketContext.Provider>;
}

export function useStaffSocket() {
    const ctx = useContext(StaffSocketContext);
    if (!ctx) {
        throw new Error("useStaffSocket must be used inside StaffSocketProvider");
    }
    return ctx;
}
