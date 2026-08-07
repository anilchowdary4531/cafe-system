package com.tiffzy.app.ui.payment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class OffersUiState(
    val isLoading: Boolean = false,
    val coupons: List<CouponItem> = emptyList(),
    val validatedCoupon: ValidateCouponResponse? = null,
    val couponMessage: String? = null,
    val error: String? = null
)

class OffersViewModel(
    private val repository: RestaurantRepository = RestaurantRepository(RetrofitClient.apiService)
) : ViewModel() {

    private val _uiState = MutableStateFlow(OffersUiState())
    val uiState: StateFlow<OffersUiState> = _uiState.asStateFlow()

    fun loadCoupons() {
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            repository.getCoupons().onSuccess { resp ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        coupons = resp.coupons.ifEmpty { defaultMockCoupons() }
                    )
                }
            }.onFailure {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        coupons = defaultMockCoupons()
                    )
                }
            }
        }
    }

    fun validateCoupon(code: String, subtotal: Double, deliveryFee: Double = 40.0) {
        _uiState.update { it.copy(isLoading = true, couponMessage = null, error = null) }
        viewModelScope.launch {
            val req = ValidateCouponRequest(code = code, subtotal = subtotal, deliveryFee = deliveryFee)
            repository.validateCoupon(req).onSuccess { resp ->
                if (resp.valid) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            validatedCoupon = resp,
                            couponMessage = resp.message
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            validatedCoupon = null,
                            error = resp.message
                        )
                    }
                }
            }.onFailure { exc ->
                // Local fallback validation rules
                val clean = code.trim().uppercase()
                if (clean == "TIFFZY50" && subtotal >= 249) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            validatedCoupon = ValidateCouponResponse(true, "TIFFZY50", "FLAT", 50.0, "Coupon TIFFZY50 applied! ₹50 OFF"),
                            couponMessage = "Coupon TIFFZY50 applied! ₹50 OFF"
                        )
                    }
                } else if (clean == "WELCOME20" && subtotal >= 199) {
                    val disc = Math.min(100.0, (subtotal * 0.20))
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            validatedCoupon = ValidateCouponResponse(true, "WELCOME20", "PERCENTAGE", disc, "Coupon WELCOME20 applied! 20% OFF"),
                            couponMessage = "Coupon WELCOME20 applied! 20% OFF"
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            validatedCoupon = null,
                            error = exc.message ?: "Invalid coupon code"
                        )
                    }
                }
            }
        }
    }

    fun createCoupon(request: CreateCouponRequest) {
        viewModelScope.launch {
            repository.createCoupon(request)
            loadCoupons()
        }
    }

    fun clearCoupon() {
        _uiState.update { it.copy(validatedCoupon = null, couponMessage = null, error = null) }
    }

    private fun defaultMockCoupons(): List<CouponItem> {
        return listOf(
            CouponItem(1, "TIFFZY50", "FLAT", 50.0, 249.0, 50.0, true),
            CouponItem(2, "WELCOME20", "PERCENTAGE", 20.0, 199.0, 100.0, true),
            CouponItem(3, "FREEDEL", "FREE_DELIVERY", 40.0, 149.0, 40.0, true)
        )
    }
}
