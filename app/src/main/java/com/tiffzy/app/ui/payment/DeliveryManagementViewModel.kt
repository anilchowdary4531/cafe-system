package com.tiffzy.app.ui.payment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import com.tiffzy.app.service.SocketManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DeliveryManagementUiState(
    val isLoading: Boolean = false,
    val partners: List<DeliveryPartnerItem> = emptyList(),
    val assignedPartners: Map<Int, DeliveryPartnerItem> = emptyMap(),
    val deliveryStatuses: Map<Int, String> = emptyMap(),
    val error: String? = null
)

class DeliveryManagementViewModel(
    private val repository: RestaurantRepository = RestaurantRepository(RetrofitClient.apiService)
) : ViewModel() {

    private val _uiState = MutableStateFlow(DeliveryManagementUiState())
    val uiState: StateFlow<DeliveryManagementUiState> = _uiState.asStateFlow()

    init {
        initSocket()
    }

    private fun initSocket() {
        viewModelScope.launch {
            SocketManager.connect()
        }
    }

    fun loadPartners() {
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            repository.getDeliveryPartners().onSuccess { resp ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        partners = resp.partners.ifEmpty { defaultMockPartners() }
                    )
                }
            }.onFailure {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        partners = defaultMockPartners()
                    )
                }
            }
        }
    }

    fun assignPartnerToOrder(orderId: Int, partner: DeliveryPartnerItem) {
        viewModelScope.launch {
            val req = AssignDeliveryPartnerRequest(
                orderId = orderId,
                partnerId = partner.id,
                partnerName = partner.name,
                partnerPhone = partner.phone,
                vehicleNo = partner.vehicleNo
            )
            repository.assignDeliveryPartner(req)
            _uiState.update { state ->
                val updatedAssigned = state.assignedPartners + (orderId to partner)
                val updatedStatuses = state.deliveryStatuses + (orderId to "ACCEPTED")
                state.copy(assignedPartners = updatedAssigned, deliveryStatuses = updatedStatuses)
            }
        }
    }

    fun updateDeliveryStatus(orderId: Int, nextStatus: String) {
        viewModelScope.launch {
            val req = UpdateDeliveryStatusRequest(orderId = orderId, status = nextStatus)
            repository.updateDeliveryStatus(req)
            _uiState.update { state ->
                val updatedStatuses = state.deliveryStatuses + (orderId to nextStatus)
                state.copy(deliveryStatuses = updatedStatuses)
            }
        }
    }

    private fun defaultMockPartners(): List<DeliveryPartnerItem> {
        return listOf(
            DeliveryPartnerItem(101, "Ramesh Kumar", "+91 9876543210", "TS09-EZ-4589", 4.9, true),
            DeliveryPartnerItem(102, "Suresh Reddy", "+91 9876543211", "TS07-FX-1234", 4.8, true),
            DeliveryPartnerItem(103, "Vikram Singh", "+91 9876543212", "TS08-AB-9876", 4.7, false)
        )
    }
}
