package com.tiffzy.app.data.model

data class ValidateCouponRequest(
    val code: String,
    val subtotal: Double,
    val deliveryFee: Double = 40.0,
    val restaurantId: Int? = null
)

data class ValidateCouponResponse(
    val valid: Boolean = false,
    val code: String? = null,
    val type: String? = null, // FLAT, PERCENTAGE, FREE_DELIVERY
    val discountAmount: Double = 0.0,
    val message: String = ""
)

data class CreateCouponRequest(
    val code: String,
    val type: String, // FLAT, PERCENTAGE, FREE_DELIVERY
    val discountValue: Double,
    val minOrderAmount: Double = 0.0,
    val maxDiscount: Double? = null,
    val expiryDays: Int = 30
)

data class CouponItem(
    val id: Int = 0,
    val code: String,
    val type: String,
    val discountValue: Double,
    val minOrderAmount: Double = 0.0,
    val maxDiscount: Double? = null,
    val isActive: Boolean = true
)

data class CouponListResponse(
    val coupons: List<CouponItem> = emptyList()
)
