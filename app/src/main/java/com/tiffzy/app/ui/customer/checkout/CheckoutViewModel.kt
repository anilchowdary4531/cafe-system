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

    private val _addresses = MutableStateFlow<List<Address>>(emptyList())
    val addresses: StateFlow<List<Address>> = _addresses.asStateFlow()

    private val _selectedAddress = MutableStateFlow<Address?>(null)
    val selectedAddress: StateFlow<Address?> = _selectedAddress.asStateFlow()

    private val _customerName = MutableStateFlow("")
    val customerName: StateFlow<String> = _customerName.asStateFlow()

    private val _customerPhone = MutableStateFlow("")
    val customerPhone: StateFlow<String> = _customerPhone.asStateFlow()

    var fulfillment = MutableStateFlow("delivery")
    var paymentMethod = MutableStateFlow("UPI")
    var notes = MutableStateFlow("")
    var manualAddress = MutableStateFlow("")

    init {
        loadAddresses()
        loadCustomerInfo()
        val restaurant = cartRepository.currentRestaurant.value
        if (restaurant?.isActive == true) {
            // Default fulfillment
            // If we have a table number in context, it's dinein
            // In a real app, we might get tableNo from a QR code scan.
            // For now, let's assume delivery if no tableNo.
        }
    }

    fun loadAddresses() {
        viewModelScope.launch {
            try {
                val response = restaurantRepository.getAddresses()
                _addresses.value = response.addresses
                _selectedAddress.value = response.addresses.find { it.isDefault } ?: response.addresses.firstOrNull()
            } catch (e: Exception) {
                // Not logged in or error
            }
        }
    }

    private fun loadCustomerInfo() {
        viewModelScope.launch {
            _customerName.value = authDataStore.customerName.first() ?: ""
            _customerPhone.value = authDataStore.customerPhone.first() ?: ""
        }
    }

    fun selectAddress(address: Address) {
        _selectedAddress.value = address
        manualAddress.value = "" // Clear manual if saved is selected
    }

    fun addAddress(label: String, line1: String, city: String, state: String, pincode: String) {
        viewModelScope.launch {
            _uiState.value = CheckoutUiState.Loading
            try {
                val request = CreateAddressRequest(
                    label = label,
                    line1 = line1,
                    city = city,
                    state = state,
                    postalCode = pincode,
                    isDefault = addresses.value.isEmpty()
                )
                val newAddress = restaurantRepository.createAddress(request)
                loadAddresses()
                _selectedAddress.value = newAddress
                _uiState.value = CheckoutUiState.Idle
            } catch (e: Exception) {
                _uiState.value = CheckoutUiState.Error(e.message ?: "Failed to add address")
            }
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
                
                val addressText = if (fulfillment.value == "delivery") {
                    if (selectedAddress.value != null) {
                        formatAddress(selectedAddress.value!!)
                    } else {
                        manualAddress.value
                    }
                } else null

                val request = OrderRequest(
                    customerName = customerName,
                    phone = phone,
                    email = null, // Can be added to DataStore if needed
                    tableNumber = null, // Add to context if needed
                    fulfillment = fulfillment.value,
                    deliveryAddress = addressText,
                    deliveryLatitude = selectedAddress.value?.latitude,
                    deliveryLongitude = selectedAddress.value?.longitude,
                    notes = notes.value,
                    items = cartItems.map { 
                        OrderItemRequest(it.menuItem.id, it.menuItem.name, it.menuItem.price, it.quantity)
                    }
                )

                val response = restaurantRepository.placeOrder(restaurant.slug, request)
                
                if (paymentMethod.value == "ONLINE") {
                    initiateRazorpayPayment(response.order)
                } else if (paymentMethod.value == "CASH") {
                    // For cash, we might still want to call verifyPayment with status SUCCESS
                    // matching React logic for "isUpiPayment" = false
                    verifyOfflinePayment(response.order, "CASH")
                } else if (paymentMethod.value == "UPI") {
                    // This is for manual UPI, maybe we just show success for now as placeholder
                    _uiState.value = CheckoutUiState.Success(response.order)
                    cartRepository.clearCart()
                }
            } catch (e: Exception) {
                _uiState.value = CheckoutUiState.Error(e.message ?: "Failed to place order")
            }
        }
    }

    private fun initiateRazorpayPayment(order: OrderDetails) {
        viewModelScope.launch {
            try {
                val createRequest = CreatePaymentRequest(
                    orderId = order.id,
                    paymentMethod = "ONLINE",
                    provider = "RAZORPAY"
                )
                val createResponse = restaurantRepository.createPayment(createRequest)
                if (createResponse.razorpay != null) {
                    _uiState.value = CheckoutUiState.RazorpayReady(
                        createResponse.razorpay,
                        createResponse.payment.id,
                        order
                    )
                } else {
                    _uiState.value = CheckoutUiState.Error("Razorpay not configured on server")
                }
            } catch (e: Exception) {
                _uiState.value = CheckoutUiState.Error("Failed to initiate payment: ${e.message}")
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

    private fun formatAddress(address: Address): String {
        return listOfNotNull(
            address.label,
            address.name,
            address.line1,
            address.line2,
            address.city,
            address.state,
            address.postalCode
        ).joinToString(", ")
    }
}
