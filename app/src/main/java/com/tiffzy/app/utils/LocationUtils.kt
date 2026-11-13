package com.tiffzy.app.utils

import android.content.Context
import android.location.Geocoder
import android.location.Location
import java.util.Locale

object LocationUtils {

    /**
     * Calculates and formats distance between user coordinates and restaurant coordinates.
     * Returns e.g. "350 m" for < 1000m, "2.4 km" for >= 1000m.
     * Returns null if any coordinate is missing or invalid.
     */
    fun formatDistance(
        startLat: Double?,
        startLng: Double?,
        endLat: Double?,
        endLng: Double?
    ): String? {
        if (startLat == null || startLng == null || endLat == null || endLng == null) {
            return null
        }
        if (startLat == 0.0 && startLng == 0.0) {
            return null
        }
        if (endLat == 0.0 && endLng == 0.0) {
            return null
        }

        val results = FloatArray(1)
        try {
            Location.distanceBetween(startLat, startLng, endLat, endLng, results)
            val distanceMeters = results[0]
            return if (distanceMeters < 1000) {
                "${distanceMeters.toInt()} m"
            } else {
                String.format(Locale.US, "%.1f km", distanceMeters / 1000.0)
            }
        } catch (e: Exception) {
            return null
        }
    }

    /**
     * Resolves human-readable place name (locality, area, city) from lat/lng using Geocoder.
     * Falls back to formatted lat/lng string if offline or unavailable.
     */
    fun getAddressName(context: Context, latitude: Double, longitude: Double): String {
        return try {
            val geocoder = Geocoder(context, Locale.getDefault())
            @Suppress("DEPRECATION")
            val addresses = geocoder.getFromLocation(latitude, longitude, 1)
            if (!addresses.isNullOrEmpty()) {
                val addr = addresses[0]
                val subLocality = addr.subLocality
                val locality = addr.locality ?: addr.subAdminArea ?: addr.adminArea
                when {
                    !subLocality.isNullOrBlank() && !locality.isNullOrBlank() -> "$subLocality, $locality"
                    !subLocality.isNullOrBlank() -> subLocality
                    !locality.isNullOrBlank() -> locality
                    !addr.thoroughfare.isNullOrBlank() -> addr.thoroughfare
                    !addr.featureName.isNullOrBlank() -> addr.featureName
                    else -> String.format(Locale.US, "%.4f, %.4f", latitude, longitude)
                }
            } else {
                String.format(Locale.US, "%.4f, %.4f", latitude, longitude)
            }
        } catch (e: Exception) {
            String.format(Locale.US, "%.4f, %.4f", latitude, longitude)
        }
    }
}
