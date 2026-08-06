package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class CheckoutPreviewRequest(
    val restaurantSlug: String,
    val items: List<OrderItemRequest>,
    val couponCode: String? = null,
    val useWallet: Boolean = false,
    val deliveryAddressId: Int? = null
)

data class CheckoutPreviewResponse(
    val subtotal: Double,
    val taxAmount: Double,
    val gstAmount: Double,
    val packingCharges: Double,
    val deliveryFee: Double,
    val couponDiscount: Double,
    val walletApplied: Double,
    val total: Double,
    val savings: Double,
    val taxes: List<TaxDetail>,
    val availableCoupons: List<Coupon>
)

data class TaxDetail(
    val name: String,
    val amount: Double,
    val percent: Double
)

data class Coupon(
    val id: Int,
    val code: String,
    val description: String,
    val discountPercent: Double?,
    val discountAmount: Double?,
    val minOrderValue: Double?
)
