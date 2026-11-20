package com.tiffzy.app.ui.payment

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.repository.PaymentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PaymentUiState(
    val status: PaymentResultStatus = PaymentResultStatus.IDLE,
    val provider: String = "CASHFREE",
    val paymentSessionId: String? = null,
    val orderId: String? = null,
    val isProduction: Boolean = false,
    val amount: Double = 0.0,
    val errorMessage: String? = null,
    val txMsg: String? = null
)

class PaymentViewModel(
    private val paymentRepository: PaymentRepository = PaymentRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow(PaymentUiState())
    val uiState: StateFlow<PaymentUiState> = _uiState.asStateFlow()

    fun fetchPaymentSession(
        orderId: String,
        amount: Double,
        customerId: String? = null,
        customerPhone: String? = null,
        customerName: String? = null,
        customerEmail: String? = null,
        restaurantId: String? = null,
        paymentProvider: String = "CASHFREE",
        forceFreshNonce: Boolean = false
    ) {
        if (orderId.isBlank() || amount <= 0) {
            _uiState.update {
                it.copy(
                    status = PaymentResultStatus.FAILED,
                    errorMessage = "Invalid Order ID or Amount"
                )
            }
            return
        }

        _uiState.update {
            it.copy(
                status = PaymentResultStatus.LOADING,
                provider = "CASHFREE",
                orderId = orderId,
                amount = amount,
                errorMessage = null,
                txMsg = "Initializing Cashfree...",
                paymentSessionId = null
            )
        }

        viewModelScope.launch {
            val request = CashfreeCreateOrderRequest(
                customerId = customerId,
                orderId = orderId,
                restaurantId = restaurantId,
                amount = amount,
                customerPhone = customerPhone,
                customerName = customerName,
                customerEmail = customerEmail,
                provider = "CASHFREE",
                idempotencyKey = null
            )

            val result = paymentRepository.createCashfreeOrder(request)
            result.onSuccess { response ->
                val finalOrderId = response.resolvedOrderId() ?: orderId
                val sessionId = response.paymentSessionId
                if (!sessionId.isNullOrBlank()) {
                    val resolvedIsProd = response.isProduction || response.cfEnv.equals("PRODUCTION", ignoreCase = true)
                    _uiState.update {
                        it.copy(
                            status = PaymentResultStatus.SESSION_CREATED,
                            provider = "CASHFREE",
                            paymentSessionId = sessionId,
                            orderId = finalOrderId,
                            isProduction = resolvedIsProd
                        )
                    }
                    Log.d("CASHFREE_DEBUG", "Session created: orderId=$finalOrderId, isProd=$resolvedIsProd, cfEnv=${response.cfEnv}")
                } else {
                    val msg = response.message ?: "Failed to generate payment session"
                    _uiState.update {
                        it.copy(
                            status = PaymentResultStatus.FAILED,
                            errorMessage = msg
                        )
                    }
                }
            }.onFailure { exception ->
                val errorCode = extractHttpErrorField(exception, "code")?.uppercase()
                if (errorCode == "PAYMENT_VERIFICATION_PENDING" || errorCode == "ORDER_ALREADY_PAID") {
                    verifyPaymentWithBackend(orderId)
                    return@launch
                }
                val errorMsg = extractHttpErrorMessage(exception, "Network error creating payment session")
                _uiState.update {
                    it.copy(
                        status = PaymentResultStatus.FAILED,
                        errorMessage = errorMsg
                    )
                }
            }
        }
    }

    fun handlePaymentResult(
        resultStatus: PaymentResultStatus,
        orderId: String,
        paymentId: String? = null,
        message: String? = null
    ) {
        verifyPaymentWithBackend(
            orderId = orderId,
            fallbackStatus = resultStatus,
            message = message
        )
    }

    fun verifyPaymentWithBackend(
        orderId: String,
        fallbackStatus: PaymentResultStatus = PaymentResultStatus.LOADING,
        message: String? = null
    ) {
        _uiState.update {
            it.copy(
                status = PaymentResultStatus.LOADING,
                txMsg = "Verifying payment with gateway..."
            )
        }

        viewModelScope.launch {
            val result = paymentRepository.getPaymentStatus(orderId)
                .mapCatching { it }
                .recoverCatching { paymentRepository.verifyCashfreeOrder(CashfreeVerifyOrderRequest(orderId = orderId)).getOrThrow() }

            result.onSuccess { response ->
                val finalStatus = when (response.status) {
                    "SUCCESS", "PAID" -> PaymentResultStatus.SUCCESS
                    "FAILED" -> PaymentResultStatus.FAILED
                    "CANCELLED" -> PaymentResultStatus.CANCELLED
                    "PENDING" -> PaymentResultStatus.PENDING
                    else -> if (response.verified) PaymentResultStatus.SUCCESS else fallbackStatus
                }

                _uiState.update {
                    it.copy(
                        status = finalStatus,
                        errorMessage = if (!response.verified && finalStatus == PaymentResultStatus.FAILED) response.message else null,
                        txMsg = response.message ?: if (response.verified) "Payment Verified Successfully" else "Verification completed"
                    )
                }
            }.onFailure { exception ->
                _uiState.update {
                    it.copy(
                        status = fallbackStatus,
                        errorMessage = exception.message ?: message ?: "Verification failed",
                        txMsg = message
                    )
                }
            }
        }
    }

    fun resetState() {
        _uiState.value = PaymentUiState()
    }

    private fun extractHttpErrorField(exception: Throwable, field: String): String? {
        if (exception is retrofit2.HttpException) {
            try {
                val body = exception.response()?.errorBody()?.string()
                if (!body.isNullOrBlank()) {
                    val parsed = com.google.gson.Gson().fromJson(body, Map::class.java)
                    val value = parsed?.get(field) as? String
                    if (!value.isNullOrBlank()) return value
                }
            } catch (_: Exception) {
                // ignore parse error
            }
        }
        return null
    }

    private fun extractHttpErrorMessage(exception: Throwable, fallback: String): String {
        return extractHttpErrorField(exception, "message") ?: exception.message ?: fallback
    }
}
