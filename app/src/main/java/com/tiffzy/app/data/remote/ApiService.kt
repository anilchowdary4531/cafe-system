package com.tiffzy.app.data.remote

import com.tiffzy.app.data.model.*
import okhttp3.MultipartBody
import retrofit2.http.*

interface ApiService {
    @GET("healthz")
    suspend fun checkHealth(): HealthResponse

    @GET("banners")
    suspend fun getBanners(): List<BannerResponse>

    @GET("global-categories")
    suspend fun getGlobalCategories(): List<GlobalCategoryResponse>

    @GET("restaurants")
    suspend fun getRestaurants(): List<Restaurant>

    @POST("customer/send-otp")
    suspend fun sendOtp(@Body request: SendOtpRequest): SendOtpResponse

    @POST("customer/verify-otp")
    suspend fun verifyOtp(@Body request: VerifyOtpRequest): VerifyOtpResponse

    @POST("customer/register")
    suspend fun register(@Body request: CustomerRegisterRequest): VerifyOtpResponse

    @POST("customer/password-login")
    suspend fun customerLogin(@Body request: CustomerLoginRequest): VerifyOtpResponse

    @POST("customer/google-login")
    suspend fun googleLogin(@Body request: GoogleLoginRequest): VerifyOtpResponse

    @POST("login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("customer/address")
    suspend fun getAddresses(): AddressListResponse

    @POST("customer/address")
    suspend fun createAddress(@Body request: CreateAddressRequest): Address

    @PUT("customer/address/{id}")
    suspend fun updateAddress(@Path("id") id: Int, @Body request: CreateAddressRequest): Address

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

    @GET("customer/pay-later/accounts")
    suspend fun getPayLaterAccounts(): PayLaterAccountsResponse

    @GET("customer/pay-later/accounts/{accountId}/details")
    suspend fun getPayLaterDetails(@Path("accountId") accountId: Int): PayLaterDetailsResponse

    @GET("customer/pay-later/eligibility")
    suspend fun checkPayLaterEligibility(@Query("slug") restaurantSlug: String): PayLaterEligibilityResponse

    @POST("customer/pay-later/accounts/{accountId}/repay")
    suspend fun repayPayLater(
        @Path("accountId") accountId: Int,
        @Body request: PayLaterRepayRequest
    ): CreatePaymentResponse

    @POST("customer/pay-later/accounts/{accountId}/repay/verify")
    suspend fun verifyPayLaterRepay(
        @Path("accountId") accountId: Int,
        @Body request: VerifyPaymentRequest
    ): SimpleResponse

    @GET("customer/notifications")
    suspend fun getNotifications(): NotificationsResponse

    @POST("customer/notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: Int): SimpleResponse

    @POST("customer/public/delete-account/request-otp")
    suspend fun requestDeleteOtp(@Body body: Map<String, String>): SendOtpResponse

    @POST("customer/public/delete-account/verify")
    suspend fun verifyDeleteAccount(@Body body: Map<String, String>): SimpleResponse

    @GET("customer/bill/{sessionId}")
    suspend fun getLiveBill(@Path("sessionId") sessionId: Int): TableSession

    @POST("customer/open-table")
    suspend fun openTable(@Body body: Map<String, String>): TableSession

    @POST("customer/order")
    suspend fun placeDineInOrder(@Body body: Map<String, Any>): SimpleResponse

    @POST("api/payments/create-order")
    suspend fun createCashfreeOrder(@Body request: CashfreeCreateOrderRequest): CashfreeCreateOrderResponse

    @POST("payments/status")
    suspend fun sendPaymentStatus(@Body request: PaymentStatusRequest): PaymentStatusResponse

    @POST("api/payments/verify")
    suspend fun verifyCashfreeOrder(@Body request: CashfreeVerifyOrderRequest): CashfreeVerifyOrderResponse

    @GET("api/payments/status/{orderId}")
    suspend fun getPaymentStatus(@Path("orderId") orderId: String): CashfreeVerifyOrderResponse

    @GET("api/restaurant/settlements")
    suspend fun getRestaurantSettlements(
        @Query("restaurantId") restaurantId: Int? = null,
        @Query("range") range: String = "daily"
    ): SettlementSummaryResponse

    @GET("api/restaurant/payments")
    suspend fun getRestaurantPayments(
        @Query("restaurantId") restaurantId: Int? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10,
        @Query("range") range: String = "daily"
    ): SettlementOrdersResponse

    @POST("api/orders/{orderId}/status")
    suspend fun updateOrderStatus(
        @Path("orderId") orderId: Int,
        @Body body: Map<String, String>
    ): SimpleResponse

    @GET("api/restaurant/orders")
    suspend fun getKitchenOrders(
        @Query("restaurantId") restaurantId: Int? = null,
        @Query("status") status: String? = null
    ): List<OrderDetails>

    @GET("api/restaurant/inventory")
    suspend fun getInventory(
        @Query("restaurantId") restaurantId: Int? = null
    ): InventoryResponse

    @POST("api/restaurant/inventory/adjust")
    suspend fun adjustInventory(
        @Body request: InventoryAdjustmentRequest
    ): SimpleResponse

    @POST("api/restaurant/menu")
    suspend fun createMenuItem(@Body request: MenuItemRequest): MenuItem

    @PUT("api/restaurant/menu/{id}")
    suspend fun updateMenuItem(@Path("id") id: Int, @Body request: MenuItemRequest): MenuItem

    @DELETE("api/restaurant/menu/{id}")
    suspend fun deleteMenuItem(@Path("id") id: Int): SimpleResponse

    @PATCH("api/restaurant/menu/{id}/availability")
    suspend fun toggleItemAvailability(@Path("id") id: Int, @Body body: Map<String, Boolean>): SimpleResponse

    @POST("api/coupons/validate")
    suspend fun validateCoupon(@Body request: ValidateCouponRequest): ValidateCouponResponse

    @POST("api/coupons/create")
    suspend fun createCoupon(@Body request: CreateCouponRequest): SimpleResponse

    @GET("api/coupons")
    suspend fun getCoupons(): CouponListResponse

    @POST("api/delivery/assign")
    suspend fun assignDeliveryPartner(@Body request: AssignDeliveryPartnerRequest): SimpleResponse

    @POST("api/delivery/status")
    suspend fun updateDeliveryStatus(@Body request: UpdateDeliveryStatusRequest): SimpleResponse

    @GET("api/delivery/partners")
    suspend fun getDeliveryPartners(): DeliveryPartnersResponse
}
