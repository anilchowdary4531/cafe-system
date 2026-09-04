package com.tiffzy.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.util.Log
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.remote.RetrofitClient

class TiffzyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        try {
            // Initialize Retrofit with DataStore
            RetrofitClient.init(AuthDataStore(this))
            
            // Initialize MapLibre SDK
            org.maplibre.android.MapLibre.getInstance(this)
            Log.d("TiffzyApp", "MapLibre SDK initialized successfully")
            
            // Setup notification channel
            createNotificationChannel()
        } catch (e: Exception) {
            Log.e("TiffzyApp", "Critical initialization failure", e)
        }
    }

    private fun createNotificationChannel() {
        try {
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
        } catch (e: Exception) {
            Log.e("TiffzyApp", "Failed to create notification channel", e)
        }
    }
}
