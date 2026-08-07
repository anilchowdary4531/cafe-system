package com.tiffzy.app.ui.payment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import com.tiffzy.app.service.SocketManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class KdsTab(val title: String, val statusFilter: String) {
    NEW("New Orders", "NEW"),
    ACCEPTED("Accepted", "CONFIRMED"),
    PREPARING("Preparing", "PREPARING"),
    READY("Ready for Pickup", "READY_FOR_PICKUP"),
    DELIVERED("Delivered", "DELIVERED")
}

data class KitchenDisplayUiState(
    val isLoading: Boolean = false,
    val selectedTab: KdsTab = KdsTab.NEW,
    val orders: List<OrderDetails> = emptyList(),
    val error: String? = null
)

class KitchenDisplayViewModel(
    private val repository: RestaurantRepository = RestaurantRepository(RetrofitClient.apiService)
) : ViewModel() {

    private val _uiState = MutableStateFlow(KitchenDisplayUiState())
    val uiState: StateFlow<KitchenDisplayUiState> = _uiState.asStateFlow()

    init {
        initRealtimeSocket()
    }

    private fun initRealtimeSocket() {
        viewModelScope.launch {
            SocketManager.connect()
            SocketManager.listenOrderStatusUpdates { _, _ ->
                loadKitchenOrders()
            }
        }
    }

    fun loadKitchenOrders(restaurantId: Int? = null) {
        _uiState.update { it.copy(isLoading = true, error = null) }

        viewModelScope.launch {
            try {
                val fetchedOrders = repository.getKitchenOrders(restaurantId)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        orders = fetchedOrders
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load kitchen orders"
                    )
                }
            }
        }
    }

    fun selectTab(tab: KdsTab) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    fun updateStatus(orderId: Int, nextStatus: String, restaurantId: Int? = null) {
        viewModelScope.launch {
            try {
                repository.updateOrderStatus(orderId, nextStatus)
                loadKitchenOrders(restaurantId)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Status update failed: ${e.message}") }
            }
        }
    }
}
