package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class TableSession(
    @SerializedName("id") val id: Int,
    @SerializedName("tableId") val tableId: Int,
    @SerializedName("restaurantId") val restaurantId: Int,
    @SerializedName("status") val status: String,
    @SerializedName("subtotal") val subtotal: Double,
    @SerializedName("taxAmount") val taxAmount: Double,
    @SerializedName("total") val total: Double,
    @SerializedName("items") val items: List<TableOrderItem> = emptyList(),
    @SerializedName("table") val table: DiningTable? = null
)

data class TableOrderItem(
    @SerializedName("id") val id: Int,
    @SerializedName("menuItemId") val menuItemId: Int,
    @SerializedName("itemName") val itemName: String,
    @SerializedName("qty") val qty: Int,
    @SerializedName("price") val price: Double,
    @SerializedName("total") val total: Double
)

data class DiningTable(
    @SerializedName("id") val id: Int,
    @SerializedName("tableNo") val tableNo: String,
    @SerializedName("status") val status: String
)
