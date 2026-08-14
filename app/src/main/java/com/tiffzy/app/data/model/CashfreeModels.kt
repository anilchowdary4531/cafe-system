package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class CashfreeCreateOrderRequest(
    @SerializedName("customerId") val customerId: String? = null,
    @SerializedName("orderId") val orderId: String,
    @SerializedName("restaurantId") val restaurantId: String? = null,
    @SerializedName("amount") val amount: Double,
    @SerializedName("customerPhone") val customerPhone: String? = null,
    @SerializedName("customerName") val customerName: String? = null,
    @SerializedName("customerEmail") val customerEmail: String? = null
)

data class CashfreeCreateOrderResponse(
    @SerializedName("payment_session_id") val paymentSessionId: String? = null,
    @SerializedName("order_id") val orderId: String? = null,
    @SerializedName("cf_order_id") val cfOrderId: String? = null,
    @SerializedName("order_status") val orderStatus: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("cf_env") val cfEnv: String? = null,
    @SerializedName("is_production") val isProduction: Boolean = false
)

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

data class CashfreeVerifyOrderResponse(
    @SerializedName("verified") val verified: Boolean = false,
    @SerializedName("status") val status: String = "PENDING",
    @SerializedName("message") val message: String? = null,
    @SerializedName("orderId") val orderId: String? = null,
    @SerializedName("amount") val amount: Double? = null,
    @SerializedName("invoiceUrl") val invoiceUrl: String? = null
)

enum class PaymentResultStatus {
    IDLE,
    LOADING,
    SESSION_CREATED,
    SUCCESS,
    FAILED,
    CANCELLED,
    PENDING
}
