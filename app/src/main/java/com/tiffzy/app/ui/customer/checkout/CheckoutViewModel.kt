package com.tiffzy.app.ui.customer.checkout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.repository.CheckoutRepository
import com.tiffzy.app.ui.customer.cart.CartViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CheckoutUiState(
    val isLoading: Boolean = false,
    val addresses: List<Address> = emptyList(),
    val selectedAddress: Address? = null,
    val walletAccounts: List<PayLaterAccount> = emptyList(),
    val useWallet: Boolean = false,
    val deliveryInstructions: String = "",
    val restaurant: Restaurant? = null,
    val checkoutPreview: CheckoutPreviewResponse? = null,
    val orderSuccess: OrderResponse? = null,
    val error: String? = null
)

class CheckoutViewModel(
    private val repository: CheckoutRepository,
    private val cartViewModel: CartViewModel
) : ViewModel() {

    private val _uiState = MutableStateFlow(CheckoutUiState())
    val uiState: StateFlow<CheckoutUiState> = _uiState.asStateFlow()

    fun getCartState() = cartViewModel.uiState

    fun loadCheckoutData(restaurantSlug: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val addresses = repository.getAddresses()
                val wallet = repository.getWalletAccounts()
                val restaurant = repository.getRestaurant(restaurantSlug)
                
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    addresses = addresses,
                    selectedAddress = addresses.find { it.isDefault } ?: addresses.firstOrNull(),
                    walletAccounts = wallet,
                    restaurant = restaurant
                )
                calculateBill()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun selectAddress(address: Address) {
        _uiState.value = _uiState.value.copy(selectedAddress = address)
        calculateBill()
    }

    fun toggleWallet(use: Boolean) {
        _uiState.value = _uiState.value.copy(useWallet = use)
        calculateBill()
    }

    fun setInstructions(text: String) {
        _uiState.value = _uiState.value.copy(deliveryInstructions = text)
    }

    private fun calculateBill() {
        val cartState = cartViewModel.uiState.value
        val restaurant = _uiState.value.restaurant ?: return

        val subtotal = cartState.subtotal
        val taxAmount = cartState.tax
        
        // Mocking packing charges and delivery fee for now as they are not in schema
        val packingCharges = if (subtotal > 0) 20.0 else 0.0
        val deliveryFee = if (subtotal > 0 && subtotal < 500) 40.0 else 0.0
        
        val walletApplied = if (_uiState.value.useWallet) {
            val account = _uiState.value.walletAccounts.find { it.restaurantId == restaurant.id }
            account?.pendingBalance ?: 0.0
        } else 0.0

        val total = subtotal + taxAmount + packingCharges + deliveryFee - walletApplied

        _uiState.value = _uiState.value.copy(
            checkoutPreview = CheckoutPreviewResponse(
                subtotal = subtotal,
                taxAmount = taxAmount,
                gstAmount = taxAmount,
                packingCharges = packingCharges,
                deliveryFee = deliveryFee,
                couponDiscount = 0.0,
                walletApplied = walletApplied,
                total = total,
                savings = 0.0,
                taxes = listOf(TaxDetail("GST", taxAmount, restaurant.taxPercent)),
                availableCoupons = emptyList()
            )
        )
    }

    fun placeOrder(customerName: String, phone: String, email: String?) {
        val state = _uiState.value
        val restaurant = state.restaurant ?: return
        val cartState = cartViewModel.uiState.value
        val items = cartState.items

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true)
            try {
                val request = OrderRequest(
                    customerName = customerName,
                    phone = phone,
                    email = email,
                    tableNumber = cartViewModel.cartRepository.getTable(),
                    fulfillment = if (cartViewModel.cartRepository.getTable() != null) "dinein" else "delivery",
                    deliveryAddress = state.selectedAddress?.let { "${it.label}: ${it.line1}, ${it.line2 ?: ""}, ${it.city}" },
                    deliveryLatitude = state.selectedAddress?.latitude,
                    deliveryLongitude = state.selectedAddress?.longitude,
                    notes = state.deliveryInstructions,
                    items = items.map { OrderItemRequest(it.menuItem.id, it.menuItem.name, it.menuItem.price, it.quantity) }
                )
                val response = repository.placeOrder(restaurant.slug, request)
                _uiState.value = _uiState.value.copy(isLoading = false, orderSuccess = response)
                cartViewModel.clearCart()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }
}
