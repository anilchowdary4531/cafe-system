package com.tiffzy.app.ui.restaurant

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.AnalyticsResponse
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class SalesUiState {
    object Loading : SalesUiState()
    data class Success(val analytics: AnalyticsResponse) : SalesUiState()
    data class Error(val message: String) : SalesUiState()
}

class RestaurantSalesViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)
    private val authDataStore = AuthDataStore(application)

    private val _uiState = MutableStateFlow<SalesUiState>(SalesUiState.Loading)
    val uiState: StateFlow<SalesUiState> = _uiState.asStateFlow()

    private val _currentRange = MutableStateFlow("24h")
    val currentRange: StateFlow<String> = _currentRange.asStateFlow()

    fun loadAnalytics(range: String = "24h") {
        _currentRange.value = range
        viewModelScope.launch {
            _uiState.value = SalesUiState.Loading
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    val restaurantId = ridString.toInt()
                    val analytics = repository.getRestaurantAnalytics(restaurantId, range)
                    _uiState.value = SalesUiState.Success(analytics)
                } else {
                    _uiState.value = SalesUiState.Error("Unauthorized")
                }
            } catch (e: Exception) {
                _uiState.value = SalesUiState.Error(e.message ?: "Failed to load analytics")
            }
        }
    }
}
