package com.tiffzy.app.data.remote

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.utils.NotificationHelper
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

class RestaurantSocketManager {
    private var socket: Socket? = null
    private val gson = Gson()

    fun connect(context: Context, baseUrl: String, token: String, onOrderUpdate: (OrderDetails) -> Unit) {
        try {
            val opts = IO.Options()
            opts.auth = mapOf("token" to token)
            
            // Adjust baseUrl if it ends with /
            val url = if (baseUrl.endsWith("/")) baseUrl.substring(0, baseUrl.length - 1) else baseUrl
            
            socket = IO.socket("$url/staff", opts)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Socket connected to /staff")
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e(TAG, "Socket connect error: ${args.getOrNull(0)}")
            }

            socket?.on("order:created") { args ->
                val data = args.getOrNull(0) as? JSONObject
                data?.let {
                    val order = gson.fromJson(it.toString(), OrderDetails::class.java)
                    onOrderUpdate(order)
                    
                    NotificationHelper.sendOrderNotification(
                        context = context,
                        title = "New Order Recieved!",
                        message = "Order #${order.orderNo.takeLast(6)} for ₹${order.total.toInt()}",
                        orderId = order.id,
                        isStaff = true
                    )
                }
            }

            socket?.on("order:updated") { args ->
                val data = args.getOrNull(0) as? JSONObject
                data?.let {
                    val order = gson.fromJson(it.toString(), OrderDetails::class.java)
                    onOrderUpdate(order)
                    
                    if (order.status.uppercase() == "CANCELLED") {
                        NotificationHelper.sendOrderNotification(
                            context = context,
                            title = "Order Cancelled",
                            message = "Order #${order.orderNo.takeLast(6)} has been cancelled",
                            orderId = order.id,
                            isStaff = true
                        )
                    }
                }
            }

            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Socket initialization failed", e)
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }

    companion object {
        private const val TAG = "RestaurantSocket"
        
        @Volatile
        private var INSTANCE: RestaurantSocketManager? = null

        fun getInstance(): RestaurantSocketManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: RestaurantSocketManager().also { INSTANCE = it }
            }
        }
    }
}
