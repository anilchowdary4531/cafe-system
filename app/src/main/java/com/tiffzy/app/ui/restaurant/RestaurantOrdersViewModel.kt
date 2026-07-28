package com.tiffzy.app.ui.restaurant

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.data.remote.RestaurantSocketManager
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class RestaurantOrdersUiState {
    object Loading : RestaurantOrdersUiState()
    data class Success(val orders: List<OrderDetails>) : RestaurantOrdersUiState()
    data class Error(val message: String) : RestaurantOrdersUiState()
}

class RestaurantOrdersViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)
    private val authDataStore = AuthDataStore(application)
    private val socketManager = RestaurantSocketManager.getInstance()

    private val _uiState = MutableStateFlow<RestaurantOrdersUiState>(RestaurantOrdersUiState.Loading)
    val uiState: StateFlow<RestaurantOrdersUiState> = _uiState.asStateFlow()

    private val _ordersList = MutableStateFlow<List<OrderDetails>>(emptyList())

    init {
        loadOrders()
        connectSocket()
    }

    fun loadOrders(status: String? = null) {
        viewModelScope.launch {
            try {
                val response = repository.getLiveOrders(status)
                _ordersList.value = response.orders
                _uiState.value = RestaurantOrdersUiState.Success(_ordersList.value)
            } catch (e: Exception) {
                _uiState.value = RestaurantOrdersUiState.Error(e.message ?: "Failed to fetch orders")
            }
        }
    }

    private fun connectSocket() {
        viewModelScope.launch {
            val token = authDataStore.authToken.first()
            if (token != null) {
                socketManager.connect(getApplication(), RetrofitClient.BASE_URL, token) { updatedOrder ->
                    updateOrderInList(updatedOrder)
                }
            }
        }
    }

    private fun updateOrderInList(updatedOrder: OrderDetails) {
        val current = _ordersList.value.toMutableList()
        val index = current.indexOfFirst { it.id == updatedOrder.id }
        if (index != -1) {
            current[index] = updatedOrder
        } else {
            // New order - add to the top
            current.add(0, updatedOrder)
        }
        _ordersList.value = current
        _uiState.value = RestaurantOrdersUiState.Success(current)
    }

    fun updateStatus(orderId: Int, nextStatus: String) {
        viewModelScope.launch {
            try {
                val response = repository.updateOrderStatus(orderId, nextStatus)
                updateOrderInList(response.order)
            } catch (e: Exception) {
                // Could notify error
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        socketManager.disconnect()
    }
}
