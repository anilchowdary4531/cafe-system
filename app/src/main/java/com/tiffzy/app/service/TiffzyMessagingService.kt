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

        // Support actual order events only
        val isOrderEvent = remoteMessage.data.containsKey("orderId") || 
                          remoteMessage.data["type"]?.contains("ORDER", ignoreCase = true) == true ||
                          remoteMessage.notification?.title?.contains("Order", ignoreCase = true) == true
        
        if (!isOrderEvent) {
            Log.d(TAG, "Skipping non-order notification")
            return
        }

        // Check if message contains a notification payload.
        remoteMessage.notification?.let {
            val orderId = remoteMessage.data["orderId"]?.toIntOrNull() ?: 0
            NotificationHelper.sendOrderNotification(this, it.title ?: "Order Update", it.body ?: "", orderId)
        } ?: run {
            // Check if message contains a data payload.
            if (remoteMessage.data.isNotEmpty()) {
                val title = remoteMessage.data["title"] ?: "Order Update"
                val message = remoteMessage.data["body"] ?: remoteMessage.data["message"] ?: "Your order has been updated"
                val orderId = remoteMessage.data["orderId"]?.toIntOrNull() ?: 0
                NotificationHelper.sendOrderNotification(this, title, message, orderId)
            }
        }
    }

    companion object {
        private const val TAG = "TiffzyMessagingService"
    }
}
