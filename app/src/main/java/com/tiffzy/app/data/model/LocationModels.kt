package com.tiffzy.app.data.model

data class Address(
    val id: Int,
    val label: String,
    val name: String?,
    val phone: String?,
    val line1: String,
    val line2: String?,
    val city: String,
    val state: String,
    val postalCode: String?,
    val latitude: Double?,
    val longitude: Double?,
    val notes: String?,
    val isDefault: Boolean
)

data class AddressListResponse(
    val addresses: List<Address>
)

data class CreateAddressRequest(
    val label: String = "Home",
    val name: String? = null,
    val phone: String? = null,
    val line1: String,
    val line2: String? = null,
    val city: String,
    val state: String,
    val postalCode: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val notes: String? = null,
    val isDefault: Boolean = false
)
