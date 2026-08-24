package com.tiffzy.app.ui.customer.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.data.model.Restaurant
import com.tiffzy.app.data.model.SearchItem
import com.tiffzy.app.data.model.SearchItemRestaurant
import com.tiffzy.app.data.model.BannerResponse
import com.tiffzy.app.data.model.GlobalCategoryResponse
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.CartRepository
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeCategory(
    val name: String,
    val imageUrl: String? = null
)

sealed class HomeUiState {
    object Loading : HomeUiState()
    data class Success(
        val restaurants: List<Restaurant>,
        val items: List<SearchItem> = emptyList(),
        val categories: List<HomeCategory> = emptyList(),
        val banners: List<BannerResponse> = emptyList(),
        val groupedItems: Map<String, List<SearchItem>> = emptyMap(),
        val isSearching: Boolean = false
    ) : HomeUiState()
    data class Error(val message: String) : HomeUiState()
}

class HomeViewModel(
    private val repository: RestaurantRepository = RestaurantRepository(RetrofitClient.apiService),
    private val cartRepository: CartRepository = CartRepository.getInstance()
) : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private var allRestaurants: List<Restaurant> = emptyList()
    private var discoveryCategories: List<HomeCategory> = emptyList()
    private var discoveryItems: List<SearchItem> = emptyList()
    private var discoveryBanners: List<BannerResponse> = emptyList()

    init {
        loadRestaurants()
    }

    fun loadRestaurants(lat: Double? = null, lon: Double? = null) {
        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading
            try {
                // Parallel fetch with fallback protection for optional catalog metadata
                val restaurants = repository.getRestaurants()
                val banners = runCatching { repository.getBanners() }.getOrDefault(emptyList())
                val globalCategories = runCatching { repository.getGlobalCategories() }.getOrDefault(emptyList())

                allRestaurants = restaurants
                discoveryBanners = banners
                
                // Fetch mixed items for discovery
                var fetchedItems = try {
                    val response = repository.searchCatalog("")
                    Log.d("HomeViewModel", "Discovery: search catalog returned ${response.items.size} items")
                    response.items
                } catch (e: Exception) {
                    Log.e("HomeViewModel", "Discovery: search catalog failed", e)
                    emptyList()
                }

                // If searchCatalog("") is empty, aggregate items from all restaurants
                if (fetchedItems.isEmpty() && restaurants.isNotEmpty()) {
                    Log.d("HomeViewModel", "Discovery: fallback to per-restaurant menu fetch")
                    val fallbackItems = mutableListOf<SearchItem>()
                    // Try top 10 restaurants to get variety
                    for (restaurant in restaurants.take(10)) {
                        try {
                            val menuResponse = repository.getRestaurantMenu(restaurant.slug)
                            Log.d("HomeViewModel", "Discovery: fetched ${menuResponse.menu.size} items for ${restaurant.slug}")
                            val restaurantItems = menuResponse.menu.map { menuItem ->
                                SearchItem(
                                    id = menuItem.id,
                                    name = menuItem.name,
                                    description = menuItem.description,
                                    category = menuItem.category,
                                    image = menuItem.image,
                                    price = menuItem.price,
                                    rating = menuItem.rating,
                                    reviewCount = null,
                                    orderCount = null,
                                    isFeatured = menuItem.isFeatured,
                                    restaurant = SearchItemRestaurant(
                                        id = restaurant.id,
                                        name = restaurant.name,
                                        slug = restaurant.slug,
                                        city = restaurant.city,
                                        state = restaurant.state,
                                        logo = restaurant.logo
                                    )
                                )
                            }
                            fallbackItems.addAll(restaurantItems)
                            if (fallbackItems.size >= 16) break // Enough for discovery
                        } catch (e: Exception) {
                            Log.e("HomeViewModel", "Discovery: menu fetch failed for ${restaurant.slug}", e)
                        }
                    }
                    fetchedItems = fallbackItems
                }

                discoveryItems = fetchedItems.shuffled()
                Log.d("HomeViewModel", "Discovery: total items available: ${discoveryItems.size}")

                val dynamicCategories = fetchedItems
                    .groupBy { it.category }
                    .map { (name, items) ->
                        HomeCategory(
                            name = name ?: "Other",
                            imageUrl = items.firstOrNull { !it.image.isNullOrEmpty() }?.image
                        )
                    }

                val defaultFallbackCategories = listOf(
                    HomeCategory("Biryani"),
                    HomeCategory("Pizza"),
                    HomeCategory("Burger"),
                    HomeCategory("Coffee"),
                    HomeCategory("Fast Food"),
                    HomeCategory("Desserts"),
                    HomeCategory("Beverages"),
                    HomeCategory("Ice Cream")
                )

                // Merge with global categories from super admin and fallback categories
                val mergedCategories = (globalCategories.map { HomeCategory(it.name, it.imageUrl) } + dynamicCategories + defaultFallbackCategories)
                    .distinctBy { it.name.lowercase() }
                    .take(12)

                discoveryCategories = mergedCategories

                val grouped = discoveryItems.groupBy { it.category ?: "General" }
                Log.d("HomeViewModel", "Success: ${restaurants.size} restaurants, ${discoveryItems.size} items, ${grouped.size} groups")

                _uiState.value = HomeUiState.Success(
                    restaurants = restaurants,
                    items = discoveryItems,
                    categories = discoveryCategories,
                    banners = discoveryBanners,
                    groupedItems = grouped
                )
            } catch (e: Exception) {
                Log.e("HomeViewModel", "Failed to load restaurants", e)
                _uiState.value = HomeUiState.Error(e.message ?: "Could not connect to server. Please check your internet.")
            }
        }
    }

    fun search(query: String) {
        if (query.length < 2) {
            _uiState.value = HomeUiState.Success(
                restaurants = allRestaurants,
                items = discoveryItems,
                categories = discoveryCategories,
                groupedItems = discoveryItems.groupBy { it.category ?: "General" },
                isSearching = false
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading
            try {
                val searchResponse = repository.searchCatalog(query)
                _uiState.value = HomeUiState.Success(
                    restaurants = searchResponse.restaurants,
                    items = searchResponse.items,
                    categories = discoveryCategories,
                    groupedItems = searchResponse.items.groupBy { it.category ?: "General" },
                    isSearching = true
                )
            } catch (e: Exception) {
                _uiState.value = HomeUiState.Error(e.message ?: "Search failed")
            }
        }
    }

    fun addToCart(item: SearchItem) {
        val restaurant = Restaurant(
            id = item.restaurant.id ?: 0,
            name = item.restaurant.name,
            slug = item.restaurant.slug,
            city = item.restaurant.city,
            state = item.restaurant.state,
            country = "India",
            pincode = null,
            logo = item.restaurant.logo,
            addressLine1 = null,
            bannerUrl = null,
            phone = null,
            email = null,
            latitude = 0.0,
            longitude = 0.0,
            isActive = true,
            taxEnabled = false,
            taxPercent = 0.0,
            upiId = null
        )

        val menuItem = MenuItem(
            id = item.id,
            name = item.name,
            description = item.description,
            price = item.price,
            image = item.image,
            category = item.category ?: "General",
            isAvailable = true,
            isFeatured = item.isFeatured,
            rating = item.rating ?: 0.0
        )

        cartRepository.addToCart(menuItem, restaurant)
    }
}
