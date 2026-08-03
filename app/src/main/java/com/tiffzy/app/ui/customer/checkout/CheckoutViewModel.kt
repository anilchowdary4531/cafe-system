package com.tiffzy.app.ui.customer.checkout

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.CartRepository
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class CheckoutUiState {
    object Idle : CheckoutUiState()
    object Loading : CheckoutUiState()
    data class Success(val orderDetails: OrderDetails) : CheckoutUiState()
    data class RazorpayReady(val razorpayData: RazorpayOrderData, val paymentId: Int, val orderDetails: OrderDetails) : CheckoutUiState()
    data class Error(val message: String) : CheckoutUiState()
}

class CheckoutViewModel(application: Application) : AndroidViewModel(application) {
    private val restaurantRepository = RestaurantRepository(RetrofitClient.apiService)
    private val cartRepository = CartRepository.getInstance()
    private val authDataStore = AuthDataStore(application)

    private val _uiState = MutableStateFlow<CheckoutUiState>(CheckoutUiState.Idle)
    val uiState: StateFlow<CheckoutUiState> = _uiState.asStateFlow()

    private val _customerName = MutableStateFlow("")
    val customerName: StateFlow<String> = _customerName.asStateFlow()

    private val _customerPhone = MutableStateFlow("")
    val customerPhone: StateFlow<String> = _customerPhone.asStateFlow()

    private val _isPayLaterEligible = MutableStateFlow(false)
    val isPayLaterEligible: StateFlow<Boolean> = _isPayLaterEligible.asStateFlow()

    var fulfillment = MutableStateFlow("dinein")
    var paymentMethod = MutableStateFlow("CASH")
    var notes = MutableStateFlow("")

    init {
        loadCustomerInfo()
        checkPayLaterEligibility()
        // Set default fulfillment to dinein if a table is selected
        if (cartRepository.selectedTable.value != null) {
            fulfillment.value = "dinein"
        } else {
            fulfillment.value = "pickup"
        }
    }

    private fun checkPayLaterEligibility() {
        viewModelScope.launch {
            val restaurant = cartRepository.currentRestaurant.value ?: return@launch
            try {
                val response = restaurantRepository.checkPayLaterEligibility(restaurant.slug)
                _isPayLaterEligible.value = response.eligible
            } catch (e: Exception) {
                _isPayLaterEligible.value = false
            }
        }
    }

    private fun loadCustomerInfo() {
        viewModelScope.launch {
            _customerName.value = authDataStore.customerName.first() ?: ""
            _customerPhone.value = authDataStore.customerPhone.first() ?: ""
        }
    }

    fun placeOrder() {
        val restaurant = cartRepository.currentRestaurant.value ?: return
        val cartItems = cartRepository.cartItems.value
        if (cartItems.isEmpty()) return

        viewModelScope.launch {
            _uiState.value = CheckoutUiState.Loading
            try {
                val token = authDataStore.authToken.first()
                if (token == null) {
                    _uiState.value = CheckoutUiState.Error("Please login to place an order")
                    return@launch
                }

                val customerName = authDataStore.customerName.first() ?: "Guest"
                val phone = authDataStore.customerPhone.first() ?: ""
                
                val request = OrderRequest(
                    customerName = customerName,
                    phone = phone,
                    email = null,
                    tableNumber = cartRepository.selectedTable.value,
                    fulfillment = fulfillment.value,
                    deliveryAddress = null,
                    deliveryLatitude = null,
                    deliveryLongitude = null,
                    notes = notes.value,
                    items = cartItems.map { 
                        OrderItemRequest(it.menuItem.id, it.menuItem.name, it.menuItem.price, it.quantity)
                    }
                )

                val response = restaurantRepository.placeOrder(restaurant.slug, request)
                
                // If it's dine-in (has table), we might also want to link it to a table session
                val tableNo = cartRepository.selectedTable.value
                if (tableNo != null) {
                    try {
                        val session = restaurantRepository.openTable(restaurant.id, tableNo)
                        restaurantRepository.placeDineInOrder(
                            session.id,
                            cartItems.map { OrderItemRequest(it.menuItem.id, it.menuItem.name, it.menuItem.price, it.quantity) }
                        )
                    } catch (e: Exception) {
                        // Table session failed, but main order was placed
                    }
                }
                
                if (paymentMethod.value == "CASH" || paymentMethod.value == "PAY_LATER") {
                    verifyOfflinePayment(response.order, paymentMethod.value)
                } else {
                    // Default fallback
                    _uiState.value = CheckoutUiState.Success(response.order)
                    cartRepository.clearCart()
                }
            } catch (e: Exception) {
                _uiState.value = CheckoutUiState.Error(e.message ?: "Failed to place order")
            }
        }
    }

    fun onRazorpaySuccess(
        razorpayPaymentId: String,
        razorpayOrderId: String,
        razorpaySignature: String,
        paymentId: Int,
        order: OrderDetails
    ) {
        viewModelScope.launch {
            _uiState.value = CheckoutUiState.Loading
            try {
                val verifyRequest = VerifyPaymentRequest(
                    paymentId = paymentId,
                    razorpayOrderId = razorpayOrderId,
                    razorpayPaymentId = razorpayPaymentId,
                    razorpaySignature = razorpaySignature
                )
                val verifyResponse = restaurantRepository.verifyPayment(verifyRequest)
                if (verifyResponse.verified) {
                    _uiState.value = CheckoutUiState.Success(order)
                    cartRepository.clearCart()
                } else {
                    _uiState.value = CheckoutUiState.Error("Payment verification failed. Please contact support with Payment ID: $razorpayPaymentId")
                }
            } catch (e: Exception) {
                _uiState.value = CheckoutUiState.Error("Verification failed: ${e.message}. Your payment was successful. If your order is not confirmed, please contact us.")
            }
        }
    }

    fun onRazorpayFailure(code: Int, message: String) {
        val errorMessage = when (code) {
            2 -> "Payment cancelled by user" // Checkout.PAYMENT_CANCELED
            0 -> "Network error. Please check your internet connection." // Checkout.NETWORK_ERROR
            else -> "Payment failed: $message"
        }
        
        if (code == 2) {
            _uiState.value = CheckoutUiState.Idle
        } else {
            _uiState.value = CheckoutUiState.Error(errorMessage)
        }
    }

    fun onRazorpayFailure(message: String) {
        onRazorpayFailure(-1, message)
    }

    private fun verifyOfflinePayment(order: OrderDetails, method: String) {
        viewModelScope.launch {
            try {
                // Matching React: api.post("/payments/verify", { orderId, status: "SUCCESS", paymentMode: "CASH" })
                val verifyRequest = VerifyPaymentRequest(
                    orderId = order.id,
                    status = "SUCCESS",
                    paymentMode = method
                )
                restaurantRepository.verifyPayment(verifyRequest)
                _uiState.value = CheckoutUiState.Success(order)
                cartRepository.clearCart()
            } catch (e: Exception) {
                // Even if verification fails, order was placed. 
                // But for consistency let's show success if the order creation succeeded.
                _uiState.value = CheckoutUiState.Success(order)
                cartRepository.clearCart()
            }
        }
    }
}
