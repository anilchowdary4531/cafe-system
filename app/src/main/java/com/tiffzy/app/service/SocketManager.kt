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

    fun getSocket(): Socket? {
        if (socket == null) {
            try {
                val baseUrl = BuildConfig.BASE_URL.ifEmpty { "https://api.tiffzy.com/" }
                val opts = IO.Options().apply {
                    forceNew = true
                    reconnection = true
                    reconnectionAttempts = 10
                    reconnectionDelay = 2000
                }
                socket = IO.socket(baseUrl, opts)
            } catch (e: URISyntaxException) {
                Log.e(TAG, "Socket URI Syntax Exception: ${e.message}", e)
            } catch (e: Exception) {
                Log.e(TAG, "Socket initialization error: ${e.message}", e)
            }
        }
        return socket
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
            socket?.off()
            socket = null
            Log.d(TAG, "Socket.IO disconnected cleanly.")
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting socket: ${e.message}", e)
        }
    }
}
