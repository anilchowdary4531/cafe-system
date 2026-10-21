package com.tiffzy.app.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.net.toUri
import com.tiffzy.app.MainActivity
import com.tiffzy.app.R

import android.media.RingtoneManager
import android.net.Uri
import com.tiffzy.app.data.local.AuthDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

object NotificationHelper {

    const val CHANNEL_SOUND_VIBRATE = "order_updates_sound_vibrate"
    const val CHANNEL_SOUND_ONLY = "order_updates_sound_only"
    const val CHANNEL_VIBRATE_ONLY = "order_updates_vibrate_only"
    const val CHANNEL_SILENT = "order_updates_silent"

    fun getChannelIdForConfig(soundEnabled: Boolean, vibrationEnabled: Boolean): String {
        return when {
            soundEnabled && vibrationEnabled -> CHANNEL_SOUND_VIBRATE
            soundEnabled && !vibrationEnabled -> CHANNEL_SOUND_ONLY
            !soundEnabled && vibrationEnabled -> CHANNEL_VIBRATE_ONLY
            else -> CHANNEL_SILENT
        }
    }

    fun sendOrderNotification(
        context: Context,
        title: String,
        message: String,
        orderId: Int,
        isStaff: Boolean = false
    ) {
        val authDataStore = AuthDataStore(context)
        val (soundEnabled, vibrationEnabled) = try {
            runBlocking {
                val sound = authDataStore.notificationSoundEnabled.first()
                val vibration = authDataStore.notificationVibrationEnabled.first()
                Pair(sound, vibration)
            }
        } catch (_: Exception) {
            Pair(true, true)
        }

        sendOrderNotification(
            context = context,
            title = title,
            message = message,
            orderId = orderId,
            isStaff = isStaff,
            soundEnabled = soundEnabled,
            vibrationEnabled = vibrationEnabled
        )
    }

    fun sendOrderNotification(
        context: Context,
        title: String,
        message: String,
        orderId: Int,
        isStaff: Boolean = false,
        soundEnabled: Boolean = true,
        vibrationEnabled: Boolean = true
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channelId = when {
            soundEnabled && vibrationEnabled -> CHANNEL_SOUND_VIBRATE
            soundEnabled && !vibrationEnabled -> CHANNEL_SOUND_ONLY
            !soundEnabled && vibrationEnabled -> CHANNEL_VIBRATE_ONLY
            else -> CHANNEL_SILENT
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelName = when {
                soundEnabled && vibrationEnabled -> "Order Updates (Sound & Vibration)"
                soundEnabled && !vibrationEnabled -> "Order Updates (Sound Only)"
                !soundEnabled && vibrationEnabled -> "Order Updates (Vibration Only)"
                else -> "Order Updates (Silent)"
            }

            val importance = if (soundEnabled || vibrationEnabled) {
                NotificationManager.IMPORTANCE_HIGH
            } else {
                NotificationManager.IMPORTANCE_LOW
            }

            val channel = NotificationChannel(channelId, channelName, importance).apply {
                description = "Notifications for order status updates"
                enableVibration(vibrationEnabled)
                if (vibrationEnabled) {
                    vibrationPattern = longArrayOf(0, 250, 250, 250)
                } else {
                    vibrationPattern = longArrayOf(0)
                }

                if (soundEnabled) {
                    val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    setSound(defaultSoundUri, null)
                } else {
                    setSound(null, null)
                }
            }
            notificationManager.createNotificationChannel(channel)
        }

        val deepLink = if (isStaff) {
            "tiffzy://restaurant/order/$orderId"
        } else {
            "tiffzy://order/$orderId"
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            data = deepLink.toUri()
        }

        val pendingIntent = PendingIntent.getActivity(
            context, orderId, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.tiffzy_logo)
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .setPriority(
                if (soundEnabled || vibrationEnabled) NotificationCompat.PRIORITY_HIGH
                else NotificationCompat.PRIORITY_LOW
            )
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_STATUS)

        // Pre-Android O compatibility or builder-level specification
        var defaults = 0
        if (soundEnabled) {
            defaults = defaults or NotificationCompat.DEFAULT_SOUND
        }
        if (vibrationEnabled) {
            notificationBuilder.setVibrate(longArrayOf(0, 250, 250, 250))
        } else {
            notificationBuilder.setVibrate(longArrayOf(0))
        }
        notificationBuilder.setDefaults(defaults)

        notificationManager.notify(orderId, notificationBuilder.build())
    }
}
