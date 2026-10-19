package com.tiffzy.app.service

import android.util.Log
import com.tiffzy.app.BuildConfig
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URISyntaxException

object SocketManager {

    private const val TAG = "SocketManager"
    private var socket: Socket? = null
    private var authToken: String? = null

    fun getSocket(token: String? = null): Socket? {
        val effectiveToken = token ?: authToken
        if (socket == null || (token != null && token != authToken)) {
            try {
                if (socket != null) {
                    socket?.disconnect()
                    socket?.off()
                    socket = null
                }
                authToken = effectiveToken
                val baseUrl = BuildConfig.BASE_URL.ifEmpty { "https://api.tiffzy.com/" }
                val opts = IO.Options().apply {
                    forceNew = true
                    reconnection = true
                    reconnectionAttempts = 10
                    reconnectionDelay = 2000
                    if (!effectiveToken.isNullOrBlank()) {
                        auth = mapOf("token" to effectiveToken)
                    }
                }
                socket = IO.socket(baseUrl, opts)

                socket?.on(Socket.EVENT_CONNECT) {
                    Log.d(TAG, "Socket connected successfully. ID: ${socket?.id()}")
                    if (!authToken.isNullOrBlank()) {
                        val authPayload = JSONObject().apply {
                            put("token", authToken)
                        }
                        socket?.emit("authenticate", authPayload)
                    }
                }

                socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                    val err = if (args.isNotEmpty()) args[0].toString() else "Unknown"
                    Log.w(TAG, "Socket connect error: $err")
                }

                socket?.on(Socket.EVENT_DISCONNECT) { args ->
                    val reason = if (args.isNotEmpty()) args[0].toString() else "Unknown"
                    Log.d(TAG, "Socket disconnected: $reason")
                }
            } catch (e: URISyntaxException) {
                Log.e(TAG, "Socket URI Syntax Exception: ${e.message}", e)
            } catch (e: Exception) {
                Log.e(TAG, "Socket initialization error: ${e.message}", e)
            }
        }
        return socket
    }

    fun connectWithAuth(token: String?) {
        try {
            if (!token.isNullOrBlank()) {
                authToken = token
            }
            val sock = getSocket(token)
            if (sock != null && !sock.connected()) {
                sock.connect()
                Log.d(TAG, "Connecting Realtime Socket.IO with authentication...")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error connecting socket with auth: ${e.message}", e)
        }
    }

    fun connect() {
        try {
            val sock = getSocket()
            if (sock != null && !sock.connected()) {
                sock.connect()
                Log.d(TAG, "Connecting Realtime Socket.IO connection...")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error connecting socket: ${e.message}", e)
        }
    }

    fun joinOrderRoom(orderId: Int) {
        try {
            connect()
            val sock = getSocket()
            val roomData = JSONObject().apply {
                put("orderId", orderId)
                put("room", "order_$orderId")
            }
            sock?.emit("join_order", roomData)
            Log.d(TAG, "Joined Socket.IO room for Order #$orderId")
        } catch (e: Exception) {
            Log.e(TAG, "Error joining order room: ${e.message}", e)
        }
    }

    fun listenOrderStatusUpdates(onStatusUpdate: (orderId: Int, newStatus: String) -> Unit) {
        try {
            val sock = getSocket()
            sock?.off("order_status_update")
            sock?.on("order_status_update") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as? JSONObject
                        if (data != null) {
                            val orderId = data.optInt("orderId", data.optInt("id", 0))
                            val newStatus = data.optString("status", data.optString("paymentStatus", "CONFIRMED"))
                            onStatusUpdate(orderId, newStatus)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing order_status_update: ${e.message}", e)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error attaching order_status_update listener: ${e.message}", e)
        }
    }

    fun disconnect() {
        try {
            socket?.disconnect()
            Log.d(TAG, "Socket.IO paused/disconnected.")
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting socket: ${e.message}", e)
        }
    }

    fun disconnectOnLogout() {
        try {
            if (socket != null && socket!!.connected()) {
                socket?.emit("customer:logout", JSONObject())
            }
            socket?.disconnect()
            socket?.off()
            socket = null
            authToken = null
            Log.d(TAG, "Socket.IO disconnected cleanly on logout.")
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting socket on logout: ${e.message}", e)
        }
    }
}
