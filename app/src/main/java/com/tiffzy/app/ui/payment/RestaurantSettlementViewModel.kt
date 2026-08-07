package com.tiffzy.app.ui.payment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.repository.PaymentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RestaurantSettlementUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val range: String = "daily",
    val summary: SettlementSummaryData = SettlementSummaryData(),
    val vendorInfo: RestaurantVendorInfo = RestaurantVendorInfo(),
    val orders: List<SettlementOrderItem> = emptyList(),
    val currentPage: Int = 1,
    val totalPages: Int = 1,
    val totalCount: Int = 0,
    val error: String? = null
)

class RestaurantSettlementViewModel(
    private val paymentRepository: PaymentRepository = PaymentRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow(RestaurantSettlementUiState())
    val uiState: StateFlow<RestaurantSettlementUiState> = _uiState.asStateFlow()

    fun loadDashboard(restaurantId: Int? = null, isRefresh: Boolean = false) {
        if (isRefresh) {
            _uiState.update { it.copy(isRefreshing = true, error = null) }
        } else {
            _uiState.update { it.copy(isLoading = true, error = null) }
        }

        viewModelScope.launch {
            val range = _uiState.value.range
            val summaryResult = paymentRepository.getRestaurantSettlements(restaurantId, range)
            val ordersResult = paymentRepository.getRestaurantPayments(restaurantId, page = 1, limit = 10, range = range)

            summaryResult.onSuccess { summaryResp ->
                _uiState.update { state ->
                    state.copy(
                        summary = summaryResp.summary,
                        vendorInfo = summaryResp.restaurant ?: state.vendorInfo
                    )
                }
            }

            ordersResult.onSuccess { ordersResp ->
                _uiState.update { state ->
                    state.copy(
                        orders = ordersResp.orders,
                        currentPage = ordersResp.pagination.page,
                        totalPages = ordersResp.pagination.totalPages,
                        totalCount = ordersResp.pagination.totalCount
                    )
                }
            }.onFailure { exc ->
                _uiState.update { it.copy(error = exc.message ?: "Failed to load settlement data") }
            }

            _uiState.update { it.copy(isLoading = false, isRefreshing = false) }
        }
    }

    fun setRange(range: String, restaurantId: Int? = null) {
        _uiState.update { it.copy(range = range) }
        loadDashboard(restaurantId = restaurantId, isRefresh = false)
    }

    fun loadNextPage(restaurantId: Int? = null) {
        val currentState = _uiState.value
        if (currentState.currentPage >= currentState.totalPages || currentState.isLoading) return

        val nextPage = currentState.currentPage + 1
        viewModelScope.launch {
            paymentRepository.getRestaurantPayments(
                restaurantId = restaurantId,
                page = nextPage,
                limit = 10,
                range = currentState.range
            ).onSuccess { ordersResp ->
                _uiState.update { state ->
                    state.copy(
                        orders = state.orders + ordersResp.orders,
                        currentPage = ordersResp.pagination.page,
                        totalPages = ordersResp.pagination.totalPages
                    )
                }
            }
        }
    }
}
