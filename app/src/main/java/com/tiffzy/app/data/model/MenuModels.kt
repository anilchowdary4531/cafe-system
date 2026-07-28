package com.tiffzy.app.data.model

data class RestaurantMenuResponse(
    val restaurant: Restaurant,
    val menu: List<MenuItem>
)

data class MenuItem(
    val id: Int,
    val name: String,
    val description: String?,
    val category: String,
    val image: String?,
    val price: Double,
    val isAvailable: Boolean,
    val isFeatured: Boolean,
    val rating: Double,
    val reviewCount: Int,
    val orderCount: Int
)
