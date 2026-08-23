package com.tiffzy.app.utils

import com.tiffzy.app.data.remote.RetrofitClient
import java.net.URL

object ImageUtils {
    /**
     * Resolves a raw image path into a full URL that can be loaded by Coil.
     * Matches the logic in the frontend's resolveImageUrl.js including "healing" local URLs.
     */
    fun resolveImageUrl(raw: String?): String? {
        val value = raw?.trim() ?: return null
        if (value.isEmpty() || value == "null" || value == "undefined") return null
        
        val baseUrl = RetrofitClient.BASE_URL.removeSuffix("/")

        // Handle absolute URLs
        if (value.startsWith("http://", ignoreCase = true) || 
            value.startsWith("https://", ignoreCase = true) ||
            value.startsWith("content://", ignoreCase = true) ||
            value.startsWith("file://", ignoreCase = true)) {
            
            try {
                val url = URL(value)
                val host = url.host.lowercase()
                
                // Heal stale local URLs (localhost/127.0.0.1) often found in dev DBs
                if ((host == "localhost" || host == "127.0.0.1" || host == "10.0.2.2") && 
                    url.path.startsWith("/uploads/")) {
                    return "$baseUrl${url.path}${if (url.query != null) "?" + url.query else ""}"
                }
            } catch (e: Exception) {
                // Ignore parsing errors and return original
            }
            return value
        }
        
        if (value.startsWith("data:", ignoreCase = true)) {
            return value
        }
        
        return when {
            value.startsWith("/uploads/") -> "$baseUrl$value"
            value.startsWith("uploads/") -> "$baseUrl/$value"
            value.startsWith("public/") || value.startsWith("private/") -> "$baseUrl/uploads/$value"
            else -> {
                // If it's a relative path, we must decide where it lives.
                // Web app falls back to relative browser resolution. 
                // For Android, we assume it's either at the root or needs /uploads/
                if (value.startsWith("/")) {
                    "$baseUrl$value"
                } else {
                    // If it contains a dot (likely a filename) but no slash, 
                    // it's probably in the uploads folder.
                    if (!value.contains("/") && value.contains(".")) {
                        "$baseUrl/uploads/$value"
                    } else {
                        "$baseUrl/$value"
                    }
                }
            }
        }
    }
}
