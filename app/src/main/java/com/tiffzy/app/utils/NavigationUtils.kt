package com.tiffzy.app.utils

import android.content.Context
import android.content.Intent
import android.net.Uri

object NavigationUtils {

    /**
     * Launches external map/navigation application using Android Intents.
     * Tries Google Maps -> Any generic installed Map App -> Web Browser fallback.
     * Returns true if successfully launched, false if invalid coordinates or failed.
     */
    fun launchDirections(
        context: Context,
        latitude: Double?,
        longitude: Double?,
        restaurantName: String? = null
    ): Boolean {
        if (latitude == null || longitude == null || (latitude == 0.0 && longitude == 0.0)) {
            return false
        }

        val encodedLabel = Uri.encode(restaurantName ?: "Restaurant")
        val geoUri = Uri.parse("geo:$latitude,$longitude?q=$latitude,$longitude($encodedLabel)")
        
        // 1. Prefer Google Maps native app
        val googleMapsIntent = Intent(Intent.ACTION_VIEW, geoUri).apply {
            setPackage("com.google.android.apps.maps")
        }

        return try {
            context.startActivity(googleMapsIntent)
            true
        } catch (e: Exception) {
            // 2. Fallback to generic geo intent (opens any installed map application)
            try {
                val genericGeoIntent = Intent(Intent.ACTION_VIEW, geoUri)
                context.startActivity(genericGeoIntent)
                true
            } catch (e2: Exception) {
                // 3. Fallback to web browser Google Maps directions URL
                try {
                    val webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude")
                    val webIntent = Intent(Intent.ACTION_VIEW, webUri)
                    context.startActivity(webIntent)
                    true
                } catch (e3: Exception) {
                    false
                }
            }
        }
    }
}
