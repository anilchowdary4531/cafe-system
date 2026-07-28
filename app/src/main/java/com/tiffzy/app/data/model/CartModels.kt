package com.tiffzy.app.data.model

data class CartItem(
    val menuItem: MenuItem,
    var quantity: Int,
    val restaurantSlug: String,
    val restaurantName: String
)
