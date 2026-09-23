package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class WalletSummaryResponse(
    @SerializedName("walletId") val walletId: Int = 0,
    @SerializedName("customerAccountId") val customerAccountId: Int = 0,
    @SerializedName("balance") val balance: Double = 0.0,
    @SerializedName("currency") val currency: String = "INR",
    @SerializedName("status") val status: String = "ACTIVE",
    @SerializedName("cashfreeUserId") val cashfreeUserId: String? = null,
    @SerializedName("cashfreeWalletId") val cashfreeWalletId: String? = null,
    @SerializedName("cfSubWalletId") val cfSubWalletId: String? = null,
    @SerializedName("cfProgramId") val cfProgramId: String? = null
)

data class TopupSessionRequest(
    @SerializedName("amount") val amount: Double,
    @SerializedName("returnUrl") val returnUrl: String? = null,
    @SerializedName("idempotencyKey") val idempotencyKey: String? = null
)

data class TopupSessionResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("session") val session: TopupSessionData? = null,
    @SerializedName("message") val message: String? = null
)

data class TopupSessionData(
    @SerializedName("topupTxnId") val topupTxnId: String,
    @SerializedName("amount") val amount: Double,
    @SerializedName("paymentSessionId") val paymentSessionId: String? = null,
    @SerializedName("cfOrderId") val cfOrderId: String? = null,
    @SerializedName("gateway") val gateway: String? = null
)

data class VerifyTopupRequest(
    @SerializedName("topupTxnId") val topupTxnId: String,
    @SerializedName("gatewayOrderId") val gatewayOrderId: String? = null,
    @SerializedName("gatewayPaymentId") val gatewayPaymentId: String? = null,
    @SerializedName("idempotencyKey") val idempotencyKey: String? = null
)

data class VerifyTopupResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("message") val message: String? = null,
    @SerializedName("balance") val balance: Double = 0.0,
    @SerializedName("amount") val amount: Double = 0.0,
    @SerializedName("topupTxnId") val topupTxnId: String? = null
)

data class PayOrderWalletRequest(
    @SerializedName("orderId") val orderId: Int,
    @SerializedName("amount") val amount: Double,
    @SerializedName("idempotencyKey") val idempotencyKey: String? = null
)

data class PayOrderWalletResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("message") val message: String? = null,
    @SerializedName("balanceBefore") val balanceBefore: Double = 0.0,
    @SerializedName("balanceAfter") val balanceAfter: Double = 0.0
)

data class WalletTransactionsResponse(
    @SerializedName("page") val page: Int = 1,
    @SerializedName("limit") val limit: Int = 20,
    @SerializedName("total") val total: Int = 0,
    @SerializedName("totalPages") val totalPages: Int = 0,
    @SerializedName("transactions") val transactions: List<WalletTransactionItem> = emptyList()
)

data class WalletTransactionItem(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("type") val type: String,
    @SerializedName("direction") val direction: String,
    @SerializedName("amount") val amount: Double,
    @SerializedName("balanceBefore") val balanceBefore: Double = 0.0,
    @SerializedName("balanceAfter") val balanceAfter: Double = 0.0,
    @SerializedName("description") val description: String? = null,
    @SerializedName("referenceType") val referenceType: String? = null,
    @SerializedName("referenceId") val referenceId: String? = null,
    @SerializedName("orderId") val orderId: Int? = null,
    @SerializedName("status") val status: String = "SUCCESS",
    @SerializedName("createdAt") val createdAt: String? = null
)

data class PpiStatusResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("ppiStatus") val ppiStatus: PpiStatusData? = null
)

data class PpiStatusData(
    @SerializedName("isConfigured") val isConfigured: Boolean = false,
    @SerializedName("env") val env: String = "SANDBOX",
    @SerializedName("baseUrl") val baseUrl: String? = null,
    @SerializedName("programId") val programId: String? = null,
    @SerializedName("statusMessage") val statusMessage: String? = null
)
