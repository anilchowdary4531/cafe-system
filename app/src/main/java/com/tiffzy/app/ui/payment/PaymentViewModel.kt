package com.tiffzy.app.ui.payment

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.repository.PaymentRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.net.URI
import java.net.URLDecoder
import java.util.UUID

/**
 * Pure URL helper for TWM Pay Android hosted checkout interception.
 * Kept free of Android framework classes so JVM unit tests can exercise it directly.
 */
object TwmCheckoutUrlHelper {
    private val EXTERNAL_PAYMENT_SCHEMES = setOf(
        "upi",
        "tez",
        "phonepe",
        "paytmmp",
        "gpay",
        "bhim",
        "cred",
        "amazonpay",
        "intent"
    )

    fun isUpiOrExternalScheme(url: String?): Boolean {
        val raw = url?.trim().orEmpty()
        if (raw.isEmpty()) return false
        val colonIdx = raw.indexOf(':')
        if (colonIdx <= 0) return false
        val scheme = raw.substring(0, colonIdx).lowercase()
        return EXTERNAL_PAYMENT_SCHEMES.contains(scheme)
    }

    fun isTwmReturnUrl(url: String?, configuredReturnPrefix: String? = null): Boolean {
        val raw = url?.trim().orEmpty()
        if (raw.isEmpty()) return false
        if (configuredReturnPrefix != null && configuredReturnPrefix.isNotBlank()) {
            val cleanPrefix = configuredReturnPrefix.substringBefore("?").trimEnd('/')
            if (cleanPrefix.isNotEmpty() && raw.startsWith(cleanPrefix, ignoreCase = true)) {
                return true
            }
        }
        val queryStart = raw.indexOf('?')
        val pathPart = if (queryStart >= 0) raw.substring(0, queryStart) else raw
        if (pathPart.contains("/payment-status", ignoreCase = true)) {
            return true
        }
        val params = parseQueryParams(raw)
        return !params["order_ref"].isNullOrBlank() &&
            (!params["signature"].isNullOrBlank() || !params["status"].isNullOrBlank())
    }

    fun parseQueryParams(url: String?): Map<String, String> {
        val raw = url?.trim().orEmpty()
        val firstQ = raw.indexOf('?')
        if (firstQ < 0 || firstQ == raw.lastIndex) return emptyMap()
        val rawQuery = raw.substring(firstQ + 1)
            .substringBefore('#')
            .replace('?', '&')
        val map = linkedMapOf<String, String>()
        for (pair in rawQuery.split('&')) {
            if (pair.isEmpty()) continue
            val eqIdx = pair.indexOf('=')
            val keyRaw = if (eqIdx >= 0) pair.substring(0, eqIdx) else pair
            val valRaw = if (eqIdx >= 0 && eqIdx < pair.length - 1) pair.substring(eqIdx + 1) else ""
            val key = URLDecoder.decode(keyRaw, "UTF-8").trim()
            val value = URLDecoder.decode(valRaw, "UTF-8").trim()
            if (key.isNotEmpty()) {
                map[key] = value
            }
        }
        return map
    }

    fun extractTwmReturnParams(url: String?): TwmReturnVerifyRequest? {
        val params = parseQueryParams(url)
        val orderRef = params["order_ref"] ?: params["orderRef"]
        val status = params["status"]
        val amountPaise = params["amount_paise"] ?: params["amountPaise"]
        val txn = params["txn"]
        val signature = params["signature"]
        val orderId = params["orderId"] ?: params["order_id"]
        if (orderRef.isNullOrBlank() && signature.isNullOrBlank() && status.isNullOrBlank()) {
            return null
        }
        return TwmReturnVerifyRequest(
            orderRef = orderRef,
            status = status,
            amountPaise = amountPaise,
            txn = txn,
            signature = signature,
            orderId = orderId
        )
    }

    fun isSafeHttpUrl(url: String?): Boolean {
        val raw = url?.trim().orEmpty()
        return try {
            val uri = URI(raw)
            val scheme = uri.scheme?.lowercase()
            scheme == "https" || scheme == "http"
        } catch (_: Exception) {
            false
        }
    }

    fun mapTwmOutcomeStatus(
        verified: Boolean,
        paymentStatus: String?,
        gatewayStatus: String?,
        allowPollIfPending: Boolean = true
    ): PaymentResultStatus {
        val normPayment = paymentStatus?.trim()?.uppercase().orEmpty()
        val normGateway = gatewayStatus?.trim()?.uppercase().orEmpty()
        return when {
            verified || normPayment == "PAID" || normPayment == "SUCCESS" -> PaymentResultStatus.SUCCESS
            normPayment == "FAILED" || normGateway == "REJECTED" || normGateway == "EXPIRED" -> PaymentResultStatus.FAILED
            normGateway == "CREATED" && !allowPollIfPending -> PaymentResultStatus.CANCELLED
            else -> PaymentResultStatus.PENDING
        }
    }
}

data class PaymentUiState(
    val status: PaymentResultStatus = PaymentResultStatus.IDLE,
    val provider: String = "CASHFREE",
    val paymentSessionId: String? = null,
    val checkoutUrl: String? = null,
    val orderRef: String? = null,
    val returnUrlPrefix: String? = null,
    val gatewayStatus: String? = null,
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

    private var currentSessionNonce: String = UUID.randomUUID().toString().take(8)

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

        if (forceFreshNonce) {
            currentSessionNonce = UUID.randomUUID().toString().take(8)
        }

        val normalizedProvider = if (paymentProvider.uppercase().contains("TWM")) "TWM_PAY" else "CASHFREE"

        _uiState.update {
            it.copy(
                status = PaymentResultStatus.LOADING,
                provider = normalizedProvider,
                orderId = orderId,
                amount = amount,
                errorMessage = null,
                txMsg = if (normalizedProvider == "TWM_PAY") "Creating TWM Pay checkout..." else null,
                paymentSessionId = null,
                checkoutUrl = null,
                orderRef = null,
                gatewayStatus = null
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
                provider = normalizedProvider,
                idempotencyKey = if (normalizedProvider == "TWM_PAY") "android_twm_${orderId}_$currentSessionNonce" else null
            )

            val result = paymentRepository.createCashfreeOrder(request)
            result.onSuccess { response ->
                val resolvedCheckout = response.resolvedCheckoutUrl()
                val responseProvider = response.provider?.uppercase() ?: normalizedProvider
                val finalOrderId = response.resolvedOrderId() ?: orderId

                if (responseProvider == "TWM_PAY" && !resolvedCheckout.isNullOrBlank()) {
                    _uiState.update {
                        it.copy(
                            status = PaymentResultStatus.HOSTED_CHECKOUT_READY,
                            provider = "TWM_PAY",
                            checkoutUrl = resolvedCheckout,
                            orderRef = response.resolvedOrderRef(),
                            returnUrlPrefix = response.returnUrl,
                            orderId = finalOrderId,
                            gatewayStatus = "CREATED"
                        )
                    }
                    Log.d("TWM_PAY_DEBUG", "Hosted checkout created: orderId=$finalOrderId, orderRef=${response.resolvedOrderRef()}")
                } else {
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
                }
            }.onFailure { exception ->
                val errorCode = extractHttpErrorField(exception, "code")?.uppercase()
                if (errorCode == "PAYMENT_VERIFICATION_PENDING" || errorCode == "ORDER_ALREADY_PAID") {
                    if (normalizedProvider == "TWM_PAY") {
                        reconcileTwmStatus(orderId)
                    } else {
                        verifyPaymentWithBackend(orderId)
                    }
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

    fun verifyTwmReturn(returnRequest: TwmReturnVerifyRequest) {
        val targetOrderId = returnRequest.orderId ?: _uiState.value.orderId
        val resolvedRequest = returnRequest.copy(
            orderRef = returnRequest.orderRef ?: _uiState.value.orderRef,
            orderId = targetOrderId
        )

        _uiState.update {
            it.copy(
                status = PaymentResultStatus.LOADING,
                txMsg = "Verifying TWM Pay signature..."
            )
        }

        viewModelScope.launch {
            val result = paymentRepository.verifyTwmReturn(resolvedRequest)
            result.onSuccess { response ->
                applyVerifiedTwmResponse(response, targetOrderId, allowPollIfPending = true)
            }.onFailure { exception ->
                val msg = extractHttpErrorMessage(exception, "Payment signature or amount verification failed")
                _uiState.update {
                    it.copy(
                        status = PaymentResultStatus.FAILED,
                        errorMessage = msg,
                        txMsg = msg
                    )
                }
            }
        }
    }

    fun reconcileTwmStatus(orderIdOverride: String? = null, pollIfPending: Boolean = true) {
        val targetId = orderIdOverride ?: _uiState.value.orderRef ?: _uiState.value.orderId
        if (targetId.isNullOrBlank()) return

        _uiState.update {
            it.copy(
                status = PaymentResultStatus.LOADING,
                txMsg = "Checking payment confirmation with TWM Pay..."
            )
        }

        viewModelScope.launch {
            val result = paymentRepository.getTwmPaymentStatus(targetId)
            result.onSuccess { response ->
                applyVerifiedTwmResponse(response, _uiState.value.orderId, allowPollIfPending = pollIfPending)
            }.onFailure { exception ->
                val msg = extractHttpErrorMessage(exception, "Unable to confirm TWM Pay status yet")
                _uiState.update {
                    it.copy(
                        status = PaymentResultStatus.PENDING,
                        txMsg = msg,
                        errorMessage = null
                    )
                }
            }
        }
    }

    private fun applyVerifiedTwmResponse(
        response: CashfreeVerifyOrderResponse,
        fallbackOrderId: String?,
        allowPollIfPending: Boolean
    ) {
        val paymentStatus = (response.paymentStatus ?: response.status).uppercase()
        val gatewayStatus = response.gatewayStatus?.uppercase()

        val mappedStatus = TwmCheckoutUrlHelper.mapTwmOutcomeStatus(
            verified = response.verified,
            paymentStatus = paymentStatus,
            gatewayStatus = gatewayStatus,
            allowPollIfPending = allowPollIfPending
        )

        val resolvedMsg = when {
            mappedStatus == PaymentResultStatus.SUCCESS -> response.message ?: "Payment verified successfully"
            gatewayStatus == "UTR_SUBMITTED" -> "UPI reference submitted. Waiting for final bank/merchant verification..."
            mappedStatus == PaymentResultStatus.FAILED -> response.message ?: "Payment failed or expired"
            else -> response.message ?: "Waiting for payment confirmation"
        }

        _uiState.update {
            it.copy(
                status = mappedStatus,
                orderId = response.orderId ?: fallbackOrderId ?: it.orderId,
                orderRef = response.orderRef ?: it.orderRef,
                gatewayStatus = gatewayStatus,
                errorMessage = if (mappedStatus == PaymentResultStatus.FAILED) resolvedMsg else null,
                txMsg = resolvedMsg
            )
        }

        if (mappedStatus == PaymentResultStatus.PENDING && allowPollIfPending && gatewayStatus == "UTR_SUBMITTED") {
            pollTwmUntilResolved(response.orderId ?: response.orderRef ?: fallbackOrderId)
        }
    }

    private fun pollTwmUntilResolved(targetId: String?) {
        if (targetId.isNullOrBlank()) return
        viewModelScope.launch {
            repeat(6) {
                delay(3000)
                if (_uiState.value.status != PaymentResultStatus.PENDING) return@launch
                val res = paymentRepository.getTwmPaymentStatus(targetId).getOrNull() ?: return@repeat
                val pStatus = (res.paymentStatus ?: res.status).uppercase()
                val gwStatus = res.gatewayStatus?.uppercase()
                if (res.verified || pStatus == "PAID" || pStatus == "SUCCESS") {
                    _uiState.update {
                        it.copy(
                            status = PaymentResultStatus.SUCCESS,
                            gatewayStatus = gwStatus ?: "PAID",
                            txMsg = res.message ?: "Payment verified successfully",
                            errorMessage = null
                        )
                    }
                    return@launch
                } else if (pStatus == "FAILED" || gwStatus == "REJECTED" || gwStatus == "EXPIRED") {
                    _uiState.update {
                        it.copy(
                            status = PaymentResultStatus.FAILED,
                            gatewayStatus = gwStatus,
                            errorMessage = res.message ?: "Payment was rejected or expired",
                            txMsg = res.message
                        )
                    }
                    return@launch
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
                        gatewayStatus = response.gatewayStatus,
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
