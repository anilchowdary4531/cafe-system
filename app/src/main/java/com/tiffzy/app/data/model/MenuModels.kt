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
    val isAvailable: Boolean = true,
    val isFeatured: Boolean = false,
    val rating: Double = 0.0,
    val reviewCount: Int = 0,
    val orderCount: Int = 0,
    val isVeg: Boolean = true,
    val spicyLevel: String = "Medium",
    val discountPercentage: Int = 0,
    val preparationTime: String = "15-20 mins"
)

data class MenuItemRequest(
    val id: Int? = null,
    val name: String,
    val description: String? = null,
    val category: String,
    val image: String? = null,
    val price: Double,
    val isAvailable: Boolean = true,
    val isVeg: Boolean = true,
    val spicyLevel: String = "Medium",
    val discountPercentage: Int = 0,
    val preparationTime: String = "15-20 mins"
)
