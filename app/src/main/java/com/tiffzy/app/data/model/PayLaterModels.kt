package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class PayLaterAccount(
    @SerializedName("accountId") val accountId: Int,
    @SerializedName("restaurantId") val restaurantId: Int,
    @SerializedName("restaurantName") val restaurantName: String,
    @SerializedName("pendingBalance") val pendingBalance: Double,
    @SerializedName("totalBorrowed") val totalBorrowed: Double,
    @SerializedName("totalPaid") val totalPaid: Double,
    @SerializedName("status") val status: String
)

data class PayLaterAccountsResponse(
    @SerializedName("accounts") val accounts: List<PayLaterAccount>
)

data class PayLaterTransaction(
    @SerializedName("id") val id: Int,
    @SerializedName("type") val type: String,
    @SerializedName("amount") val amount: Double,
    @SerializedName("description") val description: String?,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("orderId") val orderId: Int?,
    @SerializedName("order") val order: PayLaterOrderDetails?
)

data class PayLaterOrderDetails(
    @SerializedName("id") val id: Int,
    @SerializedName("orderNo") val orderNo: String,
    @SerializedName("items") val items: List<PayLaterOrderItem>
)

data class PayLaterOrderItem(
    @SerializedName("id") val id: Int,
    @SerializedName("itemName") val itemName: String,
    @SerializedName("qty") val qty: Int,
    @SerializedName("price") val price: Double
)

data class PayLaterAccountDetails(
    @SerializedName("accountId") val accountId: Int,
    @SerializedName("restaurantId") val restaurantId: Int,
    @SerializedName("restaurantName") val restaurantName: String,
    @SerializedName("pendingBalance") val pendingBalance: Double,
    @SerializedName("totalBorrowed") val totalBorrowed: Double,
    @SerializedName("totalPaid") val totalPaid: Double,
    @SerializedName("transactions") val transactions: List<PayLaterTransaction>
)

data class PayLaterDetailsResponse(
    @SerializedName("account") val account: PayLaterAccountDetails
)

data class PayLaterRepayRequest(
    @SerializedName("amount") val amount: Double
)

data class PayLaterEligibilityResponse(
    @SerializedName("eligible") val eligible: Boolean,
    @SerializedName("reason") val reason: String?,
    @SerializedName("account") val account: PayLaterAccount?
)
