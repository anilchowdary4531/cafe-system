package com.tiffzy.app.data.model

data class CashfreeCreateOrderRequest(
    val customerId: String? = null,
    val orderId: String,
    val restaurantId: String? = null,
    val amount: Double,
    val customerPhone: String? = null,
    val customerName: String? = null,
    val customerEmail: String? = null
)

data class CashfreeCreateOrderResponse(
    val payment_session_id: String? = null,
    val order_id: String? = null,
    val cf_order_id: String? = null,
    val order_status: String? = null,
    val message: String? = null
)

data class PaymentStatusRequest(
    val orderId: String,
    val paymentId: String? = null,
    val status: String,
    val txMsg: String? = null,
    val provider: String = "CASHFREE"
)

data class PaymentStatusResponse(
    val success: Boolean = true,
    val message: String? = null
)

data class CashfreeVerifyOrderRequest(
    val orderId: String
)

data class CashfreeVerifyOrderResponse(
    val verified: Boolean = false,
    val status: String = "PENDING",
    val message: String? = null,
    val orderId: String? = null,
    val amount: Double? = null,
    val invoiceUrl: String? = null
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
