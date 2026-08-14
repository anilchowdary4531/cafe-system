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
    val selectedPaymentMethod: String = "CASHFREE",
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

    fun selectPaymentMethod(method: String) {
        _uiState.value = _uiState.value.copy(selectedPaymentMethod = method)
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
        val taxAmount = 0.0 // Set taxes to 0
        val packingCharges = 0.0 // Set packing charges to 0
        val deliveryFee = 0.0 // Set delivery fee to 0
        
        val walletApplied = if (_uiState.value.useWallet) {
            val account = _uiState.value.walletAccounts.find { it.restaurantId == restaurant.id }
            account?.pendingBalance ?: 0.0
        } else 0.0

        val total = subtotal - walletApplied

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
                taxes = emptyList(),
                availableCoupons = emptyList()
            )
        )
    }

    fun resetOrderState() {
        _uiState.value = _uiState.value.copy(orderSuccess = null, error = null)
    }

    fun placeOrder(customerName: String, phone: String, email: String?) {
        val state = _uiState.value
        val restaurant = state.restaurant ?: return
        val cartState = cartViewModel.uiState.value
        val items = cartState.items

        if (items.isEmpty()) {
            _uiState.value = state.copy(error = "Cart is empty")
            return
        }

        val isDineIn = cartViewModel.cartRepository.getTable() != null
        if (!isDineIn && state.selectedAddress == null) {
            _uiState.value = state.copy(error = "Please select a delivery address")
            return
        }

        if (phone.isBlank()) {
            _uiState.value = state.copy(error = "Phone number is required")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, error = null)
            try {
                val request = OrderRequest(
                    customerName = customerName,
                    phone = phone,
                    email = email,
                    tableNumber = cartViewModel.cartRepository.getTable(),
                    fulfillment = if (isDineIn) "dinein" else "delivery",
                    deliveryAddress = state.selectedAddress?.let { "${it.label}: ${it.line1}, ${it.line2 ?: ""}, ${it.city}" },
                    deliveryLatitude = state.selectedAddress?.latitude,
                    deliveryLongitude = state.selectedAddress?.longitude,
                    notes = state.deliveryInstructions,
                    items = items.map { OrderItemRequest(it.menuItem.id, it.menuItem.name, it.menuItem.price, it.quantity) }
                )
                val response = repository.placeOrder(restaurant.slug, request)
                
                // Handle payment verification for CASH or full PAY_LATER orders
                val order = response.order
                val finalPaymentMethod = if (state.checkoutPreview?.total == 0.0 && state.useWallet) "PAY_LATER" else state.selectedPaymentMethod
                
                if (finalPaymentMethod == "CASH" || finalPaymentMethod == "PAY_LATER") {
                    try {
                        repository.verifyPayment(
                            VerifyPaymentRequest(
                                orderId = order.id,
                                status = "SUCCESS",
                                paymentMode = finalPaymentMethod
                            )
                        )
                    } catch (e: Exception) {
                        // Log verification failure but don't stop the flow
                        e.printStackTrace()
                    }
                    // For CASH/Wallet success, we clear cart immediately as we are navigating to success screen
                    cartViewModel.clearCart()
                }

                _uiState.value = _uiState.value.copy(isLoading = false, orderSuccess = response)
            } catch (e: Exception) {
                val errorMsg = if (e is retrofit2.HttpException) {
                    try {
                        val body = e.response()?.errorBody()?.string()
                        if (body?.contains("message") == true) {
                            com.google.gson.Gson().fromJson(body, Map::class.java)["message"] as String
                        } else body ?: e.message()
                    } catch (ex: Exception) { e.message() }
                } else e.message
                _uiState.value = _uiState.value.copy(isLoading = false, error = errorMsg ?: "Order failed")
            }
        }
    }
}
