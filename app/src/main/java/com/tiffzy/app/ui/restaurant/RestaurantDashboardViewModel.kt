package com.tiffzy.app.ui.restaurant

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.AnalyticsResponse
import com.tiffzy.app.data.model.RestaurantSettings
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class DashboardUiState {
    object Idle : DashboardUiState()
    object Loading : DashboardUiState()
    data class Success(
        val analytics: AnalyticsResponse,
        val settings: RestaurantSettings
    ) : DashboardUiState()
    data class Error(val message: String) : DashboardUiState()
}

class RestaurantDashboardViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)
    private val authDataStore = AuthDataStore(application)

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Idle)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    fun loadDashboard() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    val restaurantId = ridString.toInt()
                    // Fetch both analytics and settings in parallel
                    val analytics = repository.getRestaurantAnalytics(restaurantId, "24h")
                    val settingsResponse = repository.getRestaurantSettings(restaurantId)
                    _uiState.value = DashboardUiState.Success(analytics, settingsResponse.restaurant)
                } else {
                    _uiState.value = DashboardUiState.Error("Unauthorized: No restaurant linked to this account.")
                }
            } catch (e: Exception) {
                _uiState.value = DashboardUiState.Error(e.message ?: "Failed to load dashboard")
            }
        }
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            authDataStore.clearAuth()
            onLoggedOut()
        }
    }

    fun toggleRestaurantStatus(currentIsActive: Boolean) {
        viewModelScope.launch {
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    val restaurantId = ridString.toInt()
                    repository.updateRestaurantStatus(restaurantId, !currentIsActive)
                    loadDashboard() // Refresh dashboard data
                }
            } catch (e: Exception) {
                // Error handling
            }
        }
    }
}
