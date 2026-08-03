package com.tiffzy.app.data.model

import com.google.gson.annotations.SerializedName

data class SendOtpRequest(
    @SerializedName("email") val email: String,
    @SerializedName("phone") val phone: String
)

data class SendOtpResponse(
    @SerializedName("message") val message: String,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("email") val email: String? = null,
    @SerializedName("expiresAt") val expiresAt: String,
    @SerializedName("devOtp") val devOtp: String? = null
)

data class VerifyOtpRequest(
    @SerializedName("email") val email: String,
    @SerializedName("phone") val phone: String,
    @SerializedName("otp") val otp: String,
    @SerializedName("name") val name: String? = null
)

data class VerifyOtpResponse(
    @SerializedName("message") val message: String,
    @SerializedName("token") val token: String,
    @SerializedName("customer") val customer: Customer
)

data class Customer(
    @SerializedName("id") val id: Int,
    @SerializedName("username") val username: String? = null,
    @SerializedName("phone") val phone: String,
    @SerializedName("name") val name: String?,
    @SerializedName("email") val email: String?,
    @SerializedName("rewardPoints") val rewardPoints: Int? = 0
)

data class CustomerRegisterRequest(
    @SerializedName("username") val username: String,
    @SerializedName("phone") val phone: String,
    @SerializedName("password") val password: String,
    @SerializedName("name") val name: String? = null,
    @SerializedName("email") val email: String? = null
)

data class CustomerLoginRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String
)

data class GoogleLoginRequest(
    @SerializedName("googleId") val googleId: String? = null,
    @SerializedName("email") val email: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("picture") val picture: String? = null,
    @SerializedName("idToken") val idToken: String? = null
)

data class CustomerProfileResponse(
    @SerializedName("customer") val customer: Customer
)

data class UpdateProfileRequest(
    @SerializedName("name") val name: String?,
    @SerializedName("email") val email: String?
)

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class LoginResponse(
    @SerializedName("message") val message: String,
    @SerializedName("token") val token: String,
    @SerializedName("user") val user: StaffUser
)

data class SimpleResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String
)

data class StaffUser(
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String,
    @SerializedName("phone") val phone: String?,
    @SerializedName("role") val role: String,
    @SerializedName("restaurantId") val restaurantId: Int?,
    @SerializedName("restaurant") val restaurant: Restaurant? = null
)
