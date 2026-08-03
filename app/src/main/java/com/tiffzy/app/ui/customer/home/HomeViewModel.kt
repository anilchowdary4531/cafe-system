package com.tiffzy.app.ui.customer.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.Restaurant
import com.tiffzy.app.data.model.SearchItem
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class HomeUiState {
    object Loading : HomeUiState()
    data class Success(
        val restaurants: List<Restaurant>,
        val items: List<SearchItem> = emptyList(),
        val isSearching: Boolean = false
    ) : HomeUiState()
    data class Error(val message: String) : HomeUiState()
}

class HomeViewModel(
    private val repository: RestaurantRepository = RestaurantRepository(RetrofitClient.apiService)
) : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private var allRestaurants: List<Restaurant> = emptyList()

    init {
        loadRestaurants()
    }

    fun loadRestaurants() {
        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading
            try {
                // Wrap in a safe check
                val restaurants = repository.getRestaurants()
                allRestaurants = restaurants
                _uiState.value = HomeUiState.Success(restaurants)
            } catch (e: Exception) {
                android.util.Log.e("HomeViewModel", "Failed to load restaurants", e)
                _uiState.value = HomeUiState.Error(e.message ?: "Could not connect to server. Please check your internet.")
            }
        }
    }

    fun search(query: String) {
        if (query.length < 2) {
            _uiState.value = HomeUiState.Success(allRestaurants, isSearching = false)
            return
        }

        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading
            try {
                val searchResponse = repository.searchCatalog(query)
                _uiState.value = HomeUiState.Success(
                    restaurants = searchResponse.restaurants,
                    items = searchResponse.items,
                    isSearching = true
                )
            } catch (e: Exception) {
                _uiState.value = HomeUiState.Error(e.message ?: "Search failed")
            }
        }
    }
}
