package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class SettlementSummaryData(
    val todayOrders: Int = 0,
    val totalOrders: Int = 0,
    val totalEarnings: Double = 0.0,
    val commission: Double = 0.0,
    val settlementAmount: Double = 0.0,
    val paidSettlement: Double = 0.0,
    val pendingSettlement: Double = 0.0
)

data class RestaurantVendorInfo(
    val id: Int = 0,
    val name: String = "",
    val legalName: String? = null,
    val upiId: String? = null,
    val vendorId: String? = null,
    val vendorStatus: String = "ACTIVE"
)

data class SettlementSummaryResponse(
    val generatedAt: String? = null,
    val range: String? = null,
    val restaurant: RestaurantVendorInfo? = null,
    val summary: SettlementSummaryData = SettlementSummaryData()
)

data class SettlementOrderItem(
    val id: Int,
    val orderNo: String? = null,
    val customerName: String? = null,
    val phone: String? = null,
    val total: Double = 0.0,
    val commission: Double = 0.0,
    val settlementAmount: Double = 0.0,
    val paymentStatus: String? = null,
    val paymentMode: String? = null,
    val createdAt: String? = null
)

data class SettlementPagination(
    val page: Int = 1,
    val limit: Int = 10,
    val totalCount: Int = 0,
    val totalPages: Int = 1
)

data class SettlementOrdersResponse(
    val orders: List<SettlementOrderItem> = emptyList(),
    val pagination: SettlementPagination = SettlementPagination()
)
