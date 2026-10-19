package com.tiffzy.app.data.model

data class Address(
    val id: Int,
    val label: String,
    val name: String?,
    val phone: String?,
    val line1: String,
    val line2: String?,
    val city: String,
    val state: String,
    val postalCode: String?,
    val latitude: Double?,
    val longitude: Double?,
    val notes: String?,
    val isDefault: Boolean
)

data class AddressListResponse(
    val addresses: List<Address>
)

data class CreateAddressRequest(
    val label: String = "Home",
    val name: String? = null,
    val phone: String? = null,
    val line1: String,
    val line2: String? = null,
    val city: String,
    val state: String,
    val postalCode: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val notes: String? = null,
    val isDefault: Boolean = false
)

data class NearbyLocationCoords(
    val latitude: Double,
    val longitude: Double
)

data class NearbyRestaurant(
    val id: Int,
    val name: String,
    val slug: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val distanceKm: Double = 0.0,
    val deliveryRadiusKm: Double = 5.0,
    val isNearby: Boolean = true,
    val canDeliver: Boolean = true,
    val isOpen: Boolean = true,
    val estimatedDeliveryMinutes: Int = 25,
    val logoUrl: String? = null,
    val bannerUrl: String? = null,
    val city: String? = null,
    val state: String? = null,
    val addressLine1: String? = null,
    val pincode: String? = null
)

data class NearbyRestaurantsResponse(
    val location: NearbyLocationCoords,
    val radiusKm: Double,
    val count: Int,
    val total: Int,
    val restaurants: List<NearbyRestaurant>
)

