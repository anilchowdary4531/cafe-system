package com.tiffzy.app.ui.restaurant

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class OrderHistoryUiState {
    object Loading : OrderHistoryUiState()
    data class Success(val orders: List<OrderDetails>) : OrderHistoryUiState()
    data class Error(val message: String) : OrderHistoryUiState()
}

class RestaurantOrderHistoryViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)
    private val authDataStore = AuthDataStore(application)

    private val _uiState = MutableStateFlow<OrderHistoryUiState>(OrderHistoryUiState.Loading)
    val uiState: StateFlow<OrderHistoryUiState> = _uiState.asStateFlow()

    private val _currentStatusFilter = MutableStateFlow<String?>(null)
    val currentStatusFilter: StateFlow<String?> = _currentStatusFilter.asStateFlow()

    fun loadHistory(status: String? = null, query: String? = null) {
        _currentStatusFilter.value = status
        viewModelScope.launch {
            _uiState.value = OrderHistoryUiState.Loading
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    val restaurantId = ridString.toInt()
                    val response = repository.getOwnerOrders(
                        restaurantId = restaurantId,
                        status = status,
                        query = query
                    )
                    _uiState.value = OrderHistoryUiState.Success(response.orders)
                } else {
                    _uiState.value = OrderHistoryUiState.Error("Unauthorized")
                }
            } catch (e: Exception) {
                _uiState.value = OrderHistoryUiState.Error(e.message ?: "Failed to load history")
            }
        }
    }
}
