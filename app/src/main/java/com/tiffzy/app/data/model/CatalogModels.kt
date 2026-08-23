package com.tiffzy.app.data.model

data class SearchResponse(
    val query: String,
    val restaurants: List<Restaurant>,
    val items: List<SearchItem>,
    val totalRestaurants: Int,
    val totalItems: Int,
    val hasMoreRestaurants: Boolean
)

data class SearchItem(
    val id: Int,
    val name: String,
    val description: String?,
    val category: String?,
    val image: String?,
    val price: Double,
    val rating: Double?,
    val reviewCount: Int?,
    val orderCount: Int?,
    val isFeatured: Boolean,
    val restaurant: SearchItemRestaurant
)

data class SearchItemRestaurant(
    val id: Int?,
    val name: String,
    val slug: String,
    val city: String?,
    val state: String?,
    val logo: String?
)

data class BannerResponse(
    val id: Int,
    val title: String?,
    val imageUrl: String,
    val actionUrl: String?,
    val isActive: Boolean,
    val priority: Int
)

data class GlobalCategoryResponse(
    val id: Int,
    val name: String,
    val imageUrl: String?,
    val isActive: Boolean,
    val priority: Int
)
