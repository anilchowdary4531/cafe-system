package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class CashfreeCreateOrderRequest(
    @SerializedName("customerId") val customerId: String? = null,
    @SerializedName("orderId") val orderId: String,
    @SerializedName("restaurantId") val restaurantId: String? = null,
    @SerializedName("amount") val amount: Double,
    @SerializedName("customerPhone") val customerPhone: String? = null,
    @SerializedName("customerName") val customerName: String? = null,
    @SerializedName("customerEmail") val customerEmail: String? = null,
    @SerializedName("provider") val provider: String = "CASHFREE",
    @SerializedName("idempotencyKey") val idempotencyKey: String? = null
)

data class CashfreeCreateOrderResponse(
    @SerializedName("payment_session_id") val paymentSessionId: String? = null,
    @SerializedName("order_id") val orderId: String? = null,
    @SerializedName("orderId") val orderIdCamel: String? = null,
    @SerializedName("cf_order_id") val cfOrderId: String? = null,
    @SerializedName("order_status") val orderStatus: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("cf_env") val cfEnv: String? = null,
    @SerializedName("is_production") val isProduction: Boolean = false,
    @SerializedName("provider") val provider: String? = null,
    @SerializedName("checkoutUrl") val checkoutUrl: String? = null,
    @SerializedName("checkout_url") val checkoutUrlSnake: String? = null,
    @SerializedName("orderRef") val orderRef: String? = null,
    @SerializedName("order_ref") val orderRefSnake: String? = null,
    @SerializedName("returnUrl") val returnUrl: String? = null,
    @SerializedName("amountPaise") val amountPaise: Int? = null
) {
    fun resolvedCheckoutUrl(): String? = checkoutUrl ?: checkoutUrlSnake
    fun resolvedOrderRef(): String? = orderRef ?: orderRefSnake
    fun resolvedOrderId(): String? = orderIdCamel ?: orderId
}

data class PaymentStatusRequest(
    @SerializedName("orderId") val orderId: String,
    @SerializedName("paymentId") val paymentId: String? = null,
    @SerializedName("status") val status: String,
    @SerializedName("txMsg") val txMsg: String? = null,
    @SerializedName("provider") val provider: String = "CASHFREE"
)

data class PaymentStatusResponse(
    @SerializedName("success") val success: Boolean = true,
    @SerializedName("message") val message: String? = null
)

data class CashfreeVerifyOrderRequest(
    @SerializedName("orderId") val orderId: String
)

data class TwmReturnVerifyRequest(
    @SerializedName("order_ref") val orderRef: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("amount_paise") val amountPaise: String? = null,
    @SerializedName("txn") val txn: String? = null,
    @SerializedName("signature") val signature: String? = null,
    @SerializedName("orderId") val orderId: String? = null
)

data class CashfreeVerifyOrderResponse(
    @SerializedName("verified") val verified: Boolean = false,
    @SerializedName("status") val status: String = "PENDING",
    @SerializedName("paymentStatus") val paymentStatus: String? = null,
    @SerializedName("gatewayStatus") val gatewayStatus: String? = null,
    @SerializedName("provider") val provider: String? = null,
    @SerializedName("orderRef") val orderRef: String? = null,
    @SerializedName("transactionId") val transactionId: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("orderId") val orderId: String? = null,
    @SerializedName("amount") val amount: Double? = null,
    @SerializedName("invoiceUrl") val invoiceUrl: String? = null
)

data class PaymentProviderItem(
    @SerializedName("id") val id: String,
    @SerializedName("label") val label: String,
    @SerializedName("checkoutType") val checkoutType: String? = null,
    @SerializedName("configured") val configured: Boolean = false
)

data class PaymentProvidersResponse(
    @SerializedName("success") val success: Boolean = true,
    @SerializedName("defaultProvider") val defaultProvider: String = "TWM_PAY",
    @SerializedName("providers") val providers: List<PaymentProviderItem> = emptyList()
)

enum class PaymentResultStatus {
    IDLE,
    LOADING,
    SESSION_CREATED,
    HOSTED_CHECKOUT_READY,
    SUCCESS,
    FAILED,
    CANCELLED,
    PENDING
}
