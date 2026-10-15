package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class WalletResponse(
    @SerializedName("wallet") val wallet: CustomerWallet,
    @SerializedName("limits") val limits: WalletLimits? = null
)

data class CustomerWallet(
    @SerializedName("walletId") val walletId: Int,
    @SerializedName("customerAccountId") val customerAccountId: Int,
    @SerializedName("balance") val balance: Double,
    @SerializedName("currency") val currency: String? = "INR",
    @SerializedName("status") val status: String? = "ACTIVE",
    @SerializedName("createdAt") val createdAt: String? = null
)

data class WalletLimits(
    @SerializedName("MIN_TOPUP") val minTopup: Double? = null,
    @SerializedName("MAX_TOPUP") val maxTopup: Double? = null,
    @SerializedName("MAX_BALANCE") val maxBalance: Double? = null,
    @SerializedName("CURRENCY") val currency: String? = "INR"
)

data class WalletTransactionsResponse(
    @SerializedName("page") val page: Int = 1,
    @SerializedName("limit") val limit: Int = 20,
    @SerializedName("total") val total: Int = 0,
    @SerializedName("totalPages") val totalPages: Int = 0,
    @SerializedName("transactions") val transactions: List<WalletTransaction> = emptyList()
)

data class WalletTransaction(
    @SerializedName("id") val id: Int,
    @SerializedName("type") val type: String, // WALLET_TOPUP, ORDER_PAYMENT, REFUND, REVERSAL, ADJUSTMENT_CREDIT, ADJUSTMENT_DEBIT
    @SerializedName("direction") val direction: String, // CREDIT or DEBIT
    @SerializedName("amount") val amount: Double,
    @SerializedName("balanceBefore") val balanceBefore: Double = 0.0,
    @SerializedName("balanceAfter") val balanceAfter: Double = 0.0,
    @SerializedName("orderId") val orderId: Int? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("status") val status: String? = "SUCCESS",
    @SerializedName("createdAt") val createdAt: String? = null
)

data class WalletPayOrderRequest(
    @SerializedName("orderId") val orderId: Int,
    @SerializedName("amount") val amount: Double,
    @SerializedName("idempotencyKey") val idempotencyKey: String? = null
)

data class WalletPayOrderResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String? = null,
    @SerializedName("balanceBefore") val balanceBefore: Double? = null,
    @SerializedName("balanceAfter") val balanceAfter: Double? = null
)

data class WalletTopupCreateRequest(
    @SerializedName("amount") val amount: Double,
    @SerializedName("returnUrl") val returnUrl: String? = null,
    @SerializedName("idempotencyKey") val idempotencyKey: String? = null
)

data class WalletTopupCreateResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("session") val session: WalletTopupSession? = null,
    @SerializedName("paymentSessionId", alternate = ["payment_session_id"]) val paymentSessionId: String? = null,
    @SerializedName("topupTxnId", alternate = ["topup_txn_id"]) val topupTxnId: String? = null,
    @SerializedName("gatewayOrderId", alternate = ["gateway_order_id", "cfOrderId", "cf_order_id"]) val gatewayOrderId: String? = null,
    @SerializedName("message") val message: String? = null
)

data class WalletTopupSession(
    @SerializedName("topupTxnId", alternate = ["topup_txn_id"]) val topupTxnId: String? = null,
    @SerializedName("amount") val amount: Double? = null,
    @SerializedName("paymentSessionId", alternate = ["payment_session_id"]) val paymentSessionId: String? = null,
    @SerializedName("cfOrderId", alternate = ["cf_order_id", "gatewayOrderId", "gateway_order_id"]) val cfOrderId: String? = null,
    @SerializedName("gateway") val gateway: String? = "CASHFREE",
    @SerializedName("isProduction", alternate = ["is_production"]) val isProduction: Boolean? = null,
    @SerializedName("cfEnv", alternate = ["cf_env"]) val cfEnv: String? = null
)

val WalletTopupCreateResponse.resolvedSessionId: String?
    get() = session?.paymentSessionId?.takeIf { it.isNotBlank() }
        ?: paymentSessionId?.takeIf { it.isNotBlank() }

val WalletTopupCreateResponse.resolvedTopupTxnId: String?
    get() = session?.topupTxnId?.takeIf { it.isNotBlank() }
        ?: topupTxnId?.takeIf { it.isNotBlank() }

val WalletTopupCreateResponse.resolvedGatewayOrderId: String?
    get() = session?.cfOrderId?.takeIf { it.isNotBlank() }
        ?: gatewayOrderId?.takeIf { it.isNotBlank() }
        ?: resolvedTopupTxnId

fun WalletTopupCreateResponse.resolvedIsProduction(baseUrl: String = "https://api.tiffzy.com/"): Boolean {
    val s = session
    if (s?.isProduction != null) return s.isProduction == true
    if (s?.cfEnv != null) return s.cfEnv.equals("PRODUCTION", ignoreCase = true)
    return baseUrl.contains("tiffzy.com", ignoreCase = true) && !baseUrl.contains("test", ignoreCase = true)
}

data class WalletTopupVerifyRequest(
    @SerializedName("topupTxnId") val topupTxnId: String,
    @SerializedName("gatewayOrderId") val gatewayOrderId: String? = null,
    @SerializedName("gatewayPaymentId") val gatewayPaymentId: String? = null,
    @SerializedName("idempotencyKey") val idempotencyKey: String? = null
)

data class WalletTopupVerifyResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String? = null,
    @SerializedName("balance") val balance: Double? = null,
    @SerializedName("amount") val amount: Double? = null,
    @SerializedName("topupTxnId") val topupTxnId: String? = null
)

enum class TopupErrorType {
    TOPUP_CREATE_FAILED,
    CASHFREE_PAYMENT_FAILED,
    CASHFREE_PAYMENT_CANCELLED,
    TOPUP_VERIFY_FAILED,
    NETWORK_ERROR,
    SUCCESS
}

sealed class TopupStep {
    object Idle : TopupStep()
    data class CreatingSession(val amount: Double) : TopupStep()
    data class OpeningPayment(val orderId: String, val amount: Double) : TopupStep()
    data class VerifyingPayment(val orderId: String, val amount: Double) : TopupStep()
    data class Success(val amount: Double, val newBalance: Double, val message: String) : TopupStep()
    object Cancelled : TopupStep()
    data class Error(
        val message: String,
        val errorType: TopupErrorType = TopupErrorType.CASHFREE_PAYMENT_FAILED,
        val canRetry: Boolean = false
    ) : TopupStep()
}

val TopupStep.isError: Boolean
    get() = this is TopupStep.Error

val TopupStep.errorMessage: String?
    get() = (this as? TopupStep.Error)?.message

val TopupStep.errorType: TopupErrorType?
    get() = when (this) {
        is TopupStep.Error -> this.errorType
        is TopupStep.Cancelled -> TopupErrorType.CASHFREE_PAYMENT_CANCELLED
        is TopupStep.Success -> TopupErrorType.SUCCESS
        else -> null
    }
