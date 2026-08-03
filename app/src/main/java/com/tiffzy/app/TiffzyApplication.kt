package com.tiffzy.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.utils.LanguageHelper
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

class TiffzyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        try {
            // Initialize Retrofit with DataStore
            RetrofitClient.init(AuthDataStore(this))
            
            // Setup notification channel
            createNotificationChannel()
        } catch (e: Exception) {
            android.util.Log.e("TiffzyApp", "Error during app init", e)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = getString(R.string.default_notification_channel_id)
            val channelName = getString(R.string.default_notification_channel_name)
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(channelId, channelName, importance).apply {
                description = "Notifications for order status updates"
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }
}
