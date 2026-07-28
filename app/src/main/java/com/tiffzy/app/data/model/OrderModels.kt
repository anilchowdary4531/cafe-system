package com.tiffzy.app.data.model

data class OrderRequest(
    val customerName: String,
    val phone: String,
    val email: String?,
    val tableNumber: String?,
    val fulfillment: String, // delivery | pickup | dinein
    val deliveryAddress: String?,
    val deliveryLatitude: Double?,
    val deliveryLongitude: Double?,
    val notes: String?,
    val items: List<OrderItemRequest>
)

data class OrderItemRequest(
    val id: Int,
    val name: String,
    val price: Double,
    val qty: Int
)

data class OrderResponse(
    val message: String,
    val order: OrderDetails
)

data class CustomerOrderGroupsResponse(
    val phone: String,
    val groups: List<OrderGroup>
)

data class OrderGroup(
    val restaurant: RestaurantSummary?,
    val stats: OrderGroupStats,
    val orders: List<OrderDetails>
)

data class RestaurantSummary(
    val id: Int,
    val name: String,
    val slug: String,
    val city: String?,
    val state: String?,
    val logo: String?
)

data class OrderGroupStats(
    val totalOrders: Int,
    val totalSpend: Double,
    val activeOrders: Int,
    val lastOrderAt: String?
)

data class OrderDetails(
    val id: Int,
    val orderNo: String,
    val invoiceNo: String?,
    val orderSource: String?,
    val customerName: String?,
    val phone: String?,
    val email: String?,
    val tableNo: String?,
    val notes: String?,
    val deliveryAddress: String?,
    val deliveryLatitude: Double?,
    val deliveryLongitude: Double?,
    val subtotal: Double,
    val taxAmount: Double,
    val serviceChargeAmount: Double,
    val total: Double,
    val status: String,
    val paymentStatus: String?,
    val paymentMode: String?,
    val fulfillment: String?,
    val createdAt: String,
    val items: List<OrderItemDetails>,
    val statusEvents: List<OrderStatusEvent>?,
    val restaurant: RestaurantSummary? = null
)

data class OrderItemDetails(
    val id: Int,
    val menuItemId: Int?,
    val itemName: String,
    val qty: Int,
    val price: Double,
    val total: Double
)

data class OrderStatusEvent(
    val id: Int,
    val status: String,
    val source: String,
    val changedByName: String?,
    val notes: String?,
    val createdAt: String
)
