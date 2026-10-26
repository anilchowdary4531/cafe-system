import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API } from "../config";
import { useAuth } from "./AuthContext";
import { getActiveStaffToken } from "../utils/staffSessionStorage";

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
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const [error, setError] = useState("");

    useEffect(() => {
        const token = String(staffToken || getActiveStaffToken() || "").trim();

        if (!user || !token) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            tokenRef.current = "";
            setSocketInstance(null);
            setConnected(false);
            setConnectionStatus("disconnected");
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

        setConnectionStatus("connecting");
        const socket = buildSocket(token);
        socketRef.current = socket;
        tokenRef.current = token;
        setSocketInstance(socket);

        const onConnect = () => {
            setConnected(true);
            setConnectionStatus("connected");
            setError("");
        };
        const onDisconnect = (reason) => {
            setConnected(false);
            if (reason === "io server disconnect" || reason === "io client disconnect") {
                setConnectionStatus("disconnected");
            } else {
                setConnectionStatus("reconnecting");
            }
        };
        const onConnectError = (err) => {
            setConnected(false);
            setConnectionStatus("disconnected");
            setError(String(err?.message || "socket_error"));
        };

        const onReconnectAttempt = () => {
            const latestToken = String(staffToken || getActiveStaffToken() || "").trim();
            if (latestToken && socket.auth) {
                socket.auth.token = latestToken;
            }
            setConnected(false);
            setConnectionStatus("reconnecting");
        };
        const onReconnect = () => {
            setConnected(true);
            setConnectionStatus("connected");
            setError("");
        };
        const onReconnectError = (err) => {
            setConnected(false);
            setConnectionStatus("reconnecting");
            setError(String(err?.message || "reconnect_error"));
        };
        const onReconnectFailed = () => {
            setConnected(false);
            setConnectionStatus("disconnected");
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onConnectError);

        if (socket.io) {
            socket.io.on("reconnect_attempt", onReconnectAttempt);
            socket.io.on("reconnect", onReconnect);
            socket.io.on("reconnect_error", onReconnectError);
            socket.io.on("reconnect_failed", onReconnectFailed);
        }

        const isCurrentlyConnected = Boolean(socket.connected);
        setConnected(isCurrentlyConnected);
        setConnectionStatus(isCurrentlyConnected ? "connected" : "connecting");

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onConnectError);

            if (socket.io) {
                socket.io.off("reconnect_attempt", onReconnectAttempt);
                socket.io.off("reconnect", onReconnect);
                socket.io.off("reconnect_error", onReconnectError);
                socket.io.off("reconnect_failed", onReconnectFailed);
            }

            socket.disconnect();
            if (socketRef.current === socket) {
                socketRef.current = null;
                tokenRef.current = "";
                setSocketInstance(null);
                setConnected(false);
                setConnectionStatus("disconnected");
            }
        };
    }, [staffToken, user?.id]);

    const value = useMemo(
        () => ({
            socket: socketInstance,
            connected,
            isConnected: connected,
            connectionStatus,
            status: connectionStatus,
            isConnecting: connectionStatus === "connecting",
            isReconnecting: connectionStatus === "reconnecting",
            error,
        }),
        [connected, connectionStatus, error, socketInstance]
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
