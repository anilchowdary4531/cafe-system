package com.tiffzy.app.data.model

data class DeliveryPartnerItem(
    val id: Int,
    val name: String,
    val phone: String,
    val vehicleNo: String,
    val rating: Double = 4.8,
    val isAvailable: Boolean = true
)

data class AssignDeliveryPartnerRequest(
    val orderId: Int,
    val partnerId: Int,
    val partnerName: String,
    val partnerPhone: String,
    val vehicleNo: String
)

data class UpdateDeliveryStatusRequest(
    val orderId: Int,
    val status: String, // ACCEPTED, PICKED_UP, ON_THE_WAY, DELIVERED
    val lat: Double? = null,
    val lng: Double? = null
)

data class DeliveryPartnersResponse(
    val partners: List<DeliveryPartnerItem> = emptyList()
)
