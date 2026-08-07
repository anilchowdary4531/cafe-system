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

data class PaymentUiState(
    val status: PaymentResultStatus = PaymentResultStatus.IDLE,
    val paymentSessionId: String? = null,
    val orderId: String? = null,
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
        restaurantId: String? = null
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
                orderId = orderId,
                amount = amount,
                errorMessage = null,
                txMsg = null
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
                customerEmail = customerEmail
            )

            val result = paymentRepository.createCashfreeOrder(request)
            result.onSuccess { response ->
                val sessionId = response.payment_session_id
                if (!sessionId.isNull_or_empty_or_blank(sessionId)) {
                    _uiState.update {
                        it.copy(
                            status = PaymentResultStatus.SESSION_CREATED,
                            paymentSessionId = sessionId,
                            orderId = response.order_id ?: orderId
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            status = PaymentResultStatus.FAILED,
                            errorMessage = response.message ?: "Failed to generate Cashfree payment session"
                        )
                    }
                }
            }.onFailure { exception ->
                _uiState.update {
                    it.copy(
                        status = PaymentResultStatus.FAILED,
                        errorMessage = exception.message ?: "Network error creating payment session"
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
        // Never trust client callback alone: Always verify payment directly with Cashfree backend
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
                txMsg = "Verifying payment with Cashfree..."
            )
        }

        viewModelScope.launch {
            val result = paymentRepository.getPaymentStatus(orderId)
                .mapCatching { it }
                .recoverCatching { paymentRepository.verifyCashfreeOrder(CashfreeVerifyOrderRequest(orderId = orderId)).getOrThrow() }

            result.onSuccess { response ->
                val finalStatus = when (response.status) {
                    "SUCCESS" -> PaymentResultStatus.SUCCESS
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
                // Fallback to client callback status if network fails
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

    private fun String?.isNull_or_empty_or_blank(s: String?): Boolean {
        return s == null || s.isEmpty() || s.isBlank()
    }
}
