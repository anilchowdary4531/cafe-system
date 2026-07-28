package com.tiffzy.app.data.model

data class CreatePaymentRequest(
    val orderId: Int,
    val paymentMethod: String,
    val provider: String
)

data class CreatePaymentResponse(
    val payment: PaymentData,
    val provider: String,
    val razorpay: RazorpayOrderData?
)

data class PaymentData(
    val id: Int,
    val orderId: Int,
    val amountSubunit: Long,
    val currency: String,
    val method: String,
    val status: String,
    val provider: String,
    val providerOrderId: String?
)

data class RazorpayOrderData(
    val keyId: String,
    val orderId: String,
    val amount: Long,
    val currency: String
)

data class VerifyPaymentRequest(
    val paymentId: Int? = null,
    val orderId: Int? = null,
    val razorpayOrderId: String? = null,
    val razorpayPaymentId: String? = null,
    val razorpaySignature: String? = null,
    val status: String? = null,
    val paymentMode: String? = null
)

data class VerifyPaymentResponse(
    val payment: PaymentData?,
    val verified: Boolean,
    val order: OrderDetails? = null
)
