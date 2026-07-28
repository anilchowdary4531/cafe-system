package com.tiffzy.app.data.model

data class HealthResponse(
    val status: String
)

data class Restaurant(
    val id: Int,
    val name: String,
    val slug: String,
    val city: String?,
    val state: String?,
    val country: String?,
    val pincode: String?,
    val logo: String?,
    val addressLine1: String? = null,
    val bannerUrl: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val isActive: Boolean = true,
    val taxEnabled: Boolean = false,
    val taxPercent: Double = 0.0,
    val upiId: String? = null
)
