package com.tiffzy.app.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.net.toUri
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.tiffzy.app.MainActivity
import com.tiffzy.app.R
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.RegisterFcmTokenRequest
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.utils.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class TiffzyMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "Refreshed token: $token")
        
        val authDataStore = AuthDataStore(applicationContext)
        val apiService = RetrofitClient.apiService
        
        CoroutineScope(Dispatchers.IO).launch {
            val authToken = authDataStore.authToken.first()
            if (!authToken.isNullOrEmpty()) {
                RetrofitClient.setToken(authToken)
                try {
                    apiService.registerFcmToken(RegisterFcmTokenRequest(token))
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to register token", e)
                }
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "From: ${remoteMessage.from}")

        val data = remoteMessage.data
        val notification = remoteMessage.notification

        val title = notification?.title ?: data["title"] ?: "Tiffzy Notification"
        val body = notification?.body ?: data["body"] ?: data["message"] ?: "You have a new update"
        val type = data["type"] ?: "GENERAL"
        val orderId = data["orderId"]?.toIntOrNull() ?: 0

        Log.d(TAG, "Received FCM Notification: Type=$type, Title=$title, Body=$body, OrderId=$orderId")

        when (type.uppercase()) {
            "ORDER_CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED" -> {
                NotificationHelper.sendOrderNotification(this, title, body, orderId)
            }
            "NEW_ORDER", "PAYMENT_SUCCESS", "REFUND", "SETTLEMENT" -> {
                NotificationHelper.sendOrderNotification(this, "🔔 Restaurant Alert: $title", body, orderId)
            }
            "RESTAURANT_REGISTRATION", "PAYMENT_FAILURE" -> {
                NotificationHelper.sendOrderNotification(this, "⚠️ Admin Alert: $title", body, orderId)
            }
            else -> {
                NotificationHelper.sendOrderNotification(this, title, body, orderId)
            }
        }
    }

    companion object {
        private const val TAG = "TiffzyMessagingService"
    }
}
