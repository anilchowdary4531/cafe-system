package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class FavoriteItem(
    @SerializedName("key") val key: String,
    @SerializedName("menuItemId") val menuItemId: Int,
    @SerializedName("itemName") val itemName: String,
    @SerializedName("price") val price: Double,
    @SerializedName("image") val image: String?,
    @SerializedName("restaurantSlug") val restaurantSlug: String,
    @SerializedName("restaurantName") val restaurantName: String
)
