package com.tiffzy.app.data.remote

import com.tiffzy.app.data.model.*
import okhttp3.MultipartBody
import retrofit2.http.*

interface ApiService {
    @GET("healthz")
    suspend fun checkHealth(): HealthResponse

    @GET("restaurants")
    suspend fun getRestaurants(): List<Restaurant>

    @POST("customer/send-otp")
    suspend fun sendOtp(@Body request: SendOtpRequest): SendOtpResponse

    @POST("customer/verify-otp")
    suspend fun verifyOtp(@Body request: VerifyOtpRequest): VerifyOtpResponse

    @POST("login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("customer/address")
    suspend fun getAddresses(): AddressListResponse

    @POST("customer/address")
    suspend fun createAddress(@Body request: CreateAddressRequest): Address

    @DELETE("customer/address/{id}")
    suspend fun deleteAddress(@Path("id") id: Int)

    @GET("catalog/search")
    suspend fun searchCatalog(@Query("q") query: String): SearchResponse

    @GET("r/{slug}/menu")
    suspend fun getRestaurantMenu(@Path("slug") slug: String): RestaurantMenuResponse

    @POST("r/{slug}/order")
    suspend fun placeOrder(@Path("slug") slug: String, @Body request: OrderRequest): OrderResponse

    @POST("payments/create")
    suspend fun createPayment(@Body request: CreatePaymentRequest): CreatePaymentResponse

    @POST("payments/verify")
    suspend fun verifyPayment(@Body request: VerifyPaymentRequest): VerifyPaymentResponse

    @GET("customer/profile")
    suspend fun getProfile(): CustomerProfileResponse

    @PUT("customer/profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): CustomerProfileResponse

    @GET("customer/orders")
    suspend fun getCustomerOrders(@Query("phone") phone: String): CustomerOrderGroupsResponse

    @POST("customer/fcm-token")
    suspend fun registerFcmToken(@Body request: RegisterFcmTokenRequest)
}
