package com.tiffzy.app.ui.customer.details

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.Restaurant
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class RestaurantDetailUiState {
    object Loading : RestaurantDetailUiState()
    data class Success(val restaurant: Restaurant) : RestaurantDetailUiState()
    data class Error(val message: String) : RestaurantDetailUiState()
}

class RestaurantDetailViewModel(
    private val repository: RestaurantRepository = RestaurantRepository(RetrofitClient.apiService)
) : ViewModel() {

    private val _uiState = MutableStateFlow<RestaurantDetailUiState>(RestaurantDetailUiState.Loading)
    val uiState: StateFlow<RestaurantDetailUiState> = _uiState.asStateFlow()

    fun loadRestaurantDetails(slug: String) {
        viewModelScope.launch {
            _uiState.value = RestaurantDetailUiState.Loading
            try {
                // Fetch the specific restaurant with menu
                val menuResponse = repository.getRestaurantMenu(slug)
                var restaurant = menuResponse.restaurant
                
                // Enrichment: The menu endpoint is stripped, so we fetch all restaurants 
                // to get full address, banner, and isActive status if missing.
                try {
                    val allRestaurants = repository.getRestaurants()
                    val detailed = allRestaurants.find { it.slug == slug }
                    if (detailed != null) {
                        restaurant = restaurant.copy(
                            city = detailed.city,
                            state = detailed.state,
                            addressLine1 = detailed.addressLine1,
                            bannerUrl = detailed.bannerUrl,
                            isActive = detailed.isActive,
                            latitude = detailed.latitude,
                            longitude = detailed.longitude,
                            pincode = detailed.pincode
                        )
                    }
                } catch (e: Exception) {
                    // Silently fail enrichment
                }

                _uiState.value = RestaurantDetailUiState.Success(restaurant)
            } catch (e: Exception) {
                _uiState.value = RestaurantDetailUiState.Error(e.message ?: "Failed to load restaurant details")
            }
        }
    }
}
