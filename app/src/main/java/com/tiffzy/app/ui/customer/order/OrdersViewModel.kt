package com.tiffzy.app.ui.customer.order

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.data.model.OrderGroup
import com.tiffzy.app.data.model.Restaurant
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.CartRepository
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class OrdersUiState {
    object Idle : OrdersUiState()
    object Loading : OrdersUiState()
    data class Success(val groups: List<OrderGroup>) : OrdersUiState()
    data class Error(val message: String) : OrdersUiState()
}

sealed class OrderDetailUiState {
    object Idle : OrderDetailUiState()
    object Loading : OrderDetailUiState()
    data class Success(val order: OrderDetails) : OrderDetailUiState()
    data class Error(val message: String) : OrderDetailUiState()
}

class OrdersViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)
    private val cartRepository = CartRepository.getInstance()
    private val authDataStore = AuthDataStore(application)

    private val _uiState = MutableStateFlow<OrdersUiState>(OrdersUiState.Idle)
    val uiState: StateFlow<OrdersUiState> = _uiState.asStateFlow()

    private val _orderDetailState = MutableStateFlow<OrderDetailUiState>(OrderDetailUiState.Idle)
    val orderDetailState: StateFlow<OrderDetailUiState> = _orderDetailState.asStateFlow()

    private var pollingJob: kotlinx.coroutines.Job? = null

    fun loadOrders() {
        viewModelScope.launch {
            _uiState.value = OrdersUiState.Loading
            try {
                val phone = authDataStore.customerPhone.first()
                if (phone != null) {
                    val response = repository.getCustomerOrders(phone)
                    _uiState.value = OrdersUiState.Success(response.groups)
                } else {
                    _uiState.value = OrdersUiState.Error("Please log in to see your orders")
                }
            } catch (e: Exception) {
                _uiState.value = OrdersUiState.Error(e.message ?: "Failed to load orders")
            }
        }
    }

    fun loadOrderDetail(orderId: Int) {
        viewModelScope.launch {
            _orderDetailState.value = OrderDetailUiState.Loading
            fetchOrderDetail(orderId)
        }
    }

    private suspend fun fetchOrderDetail(orderId: Int) {
        try {
            val phone = authDataStore.customerPhone.first()
            if (phone != null) {
                val response = repository.getCustomerOrders(phone)
                val order = response.groups.flatMap { it.orders }.find { it.id == orderId }
                if (order != null) {
                    _orderDetailState.value = OrderDetailUiState.Success(order)
                } else {
                    _orderDetailState.value = OrderDetailUiState.Error("Order not found")
                }
            } else {
                _orderDetailState.value = OrderDetailUiState.Error("Authentication required")
            }
        } catch (e: Exception) {
            _orderDetailState.value = OrderDetailUiState.Error(e.message ?: "Failed to load order details")
        }
    }

    fun startPollingOrder(orderId: Int) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(10000) // Poll every 10 seconds
                fetchOrderDetail(orderId)
                
                // If status is terminal, stop polling
                val currentState = _orderDetailState.value
                if (currentState is OrderDetailUiState.Success) {
                    val status = currentState.order.status.uppercase()
                    if (status == "DELIVERED" || status == "CANCELLED" || status == "PICKED_UP") {
                        break
                    }
                }
            }
        }
    }

    fun reorder(order: OrderDetails) {
        val restaurantSummary = order.restaurant ?: return
        val restaurant = Restaurant(
            id = restaurantSummary.id,
            name = restaurantSummary.name,
            slug = restaurantSummary.slug,
            city = restaurantSummary.city,
            state = restaurantSummary.state,
            country = null,
            pincode = null,
            logo = restaurantSummary.logo
        )

        order.items.forEach { item ->
            val menuItem = MenuItem(
                id = item.menuItemId ?: item.id,
                name = item.itemName,
                description = null,
                category = "General",
                image = null,
                price = item.price,
                isAvailable = true,
                isFeatured = false,
                rating = 0.0,
                reviewCount = 0,
                orderCount = 0
            )
            // addToCart adds 1 quantity at a time.
            repeat(item.qty) {
                cartRepository.addToCart(menuItem, restaurant)
            }
        }
    }

    fun stopPolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    override fun onCleared() {
        super.onCleared()
        stopPolling()
    }
}
