package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class RegisterFcmTokenRequest(
    @SerializedName("token") val token: String,
    @SerializedName("platform") val platform: String = "android"
)

data class TiffzyNotification(
    @SerializedName("id") val id: Int,
    @SerializedName("title") val title: String,
    @SerializedName("message") val message: String,
    @SerializedName("type") val type: String?,
    @SerializedName("read") val read: Boolean,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("restaurant") val restaurant: NotificationRestaurant?
)

data class NotificationRestaurant(
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String
)

data class NotificationsResponse(
    @SerializedName("notifications") val notifications: List<TiffzyNotification>
)
