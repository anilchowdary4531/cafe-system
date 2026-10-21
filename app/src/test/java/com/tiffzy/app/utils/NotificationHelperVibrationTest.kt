package com.tiffzy.app.utils

import org.junit.Assert.assertEquals
import org.junit.Test

class NotificationHelperVibrationTest {

    @Test
    fun testChannelSelection_soundOn_vibrationOn() {
        val channelId = NotificationHelper.getChannelIdForConfig(soundEnabled = true, vibrationEnabled = true)
        assertEquals("order_updates_sound_vibrate", channelId)
    }

    @Test
    fun testChannelSelection_soundOn_vibrationOff() {
        val channelId = NotificationHelper.getChannelIdForConfig(soundEnabled = true, vibrationEnabled = false)
        assertEquals("order_updates_sound_only", channelId)
    }

    @Test
    fun testChannelSelection_soundOff_vibrationOn() {
        val channelId = NotificationHelper.getChannelIdForConfig(soundEnabled = false, vibrationEnabled = true)
        assertEquals("order_updates_vibrate_only", channelId)
    }

    @Test
    fun testChannelSelection_soundOff_vibrationOff() {
        val channelId = NotificationHelper.getChannelIdForConfig(soundEnabled = false, vibrationEnabled = false)
        assertEquals("order_updates_silent", channelId)
    }

    @Test
    fun testConstantsValues() {
        assertEquals("order_updates_sound_vibrate", NotificationHelper.CHANNEL_SOUND_VIBRATE)
        assertEquals("order_updates_sound_only", NotificationHelper.CHANNEL_SOUND_ONLY)
        assertEquals("order_updates_vibrate_only", NotificationHelper.CHANNEL_VIBRATE_ONLY)
        assertEquals("order_updates_silent", NotificationHelper.CHANNEL_SILENT)
    }
}
