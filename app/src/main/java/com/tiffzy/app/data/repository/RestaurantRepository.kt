package com.tiffzy.app.data.repository

import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.ApiService
import okhttp3.MultipartBody

class RestaurantRepository(private val apiService: ApiService) {

    suspend fun checkHealth(): HealthResponse {
        return apiService.checkHealth()
    }

    suspend fun getRestaurants(): List<Restaurant> {
        return apiService.getRestaurants()
    }

    suspend fun searchCatalog(query: String): SearchResponse {
        return apiService.searchCatalog(query)
    }

    suspend fun getRestaurantMenu(slug: String): RestaurantMenuResponse {
        return apiService.getRestaurantMenu(slug)
    }

    suspend fun getAddresses(): AddressListResponse {
        return apiService.getAddresses()
    }

    suspend fun placeOrder(slug: String, request: OrderRequest): OrderResponse {
        return apiService.placeOrder(slug, request)
    }

    suspend fun createPayment(request: CreatePaymentRequest): CreatePaymentResponse {
        return apiService.createPayment(request)
    }

    suspend fun verifyPayment(request: VerifyPaymentRequest): VerifyPaymentResponse {
        return apiService.verifyPayment(request)
    }

    suspend fun getCustomerOrders(phone: String): CustomerOrderGroupsResponse {
        return apiService.getCustomerOrders(phone)
    }

    suspend fun getProfile(): CustomerProfileResponse {
        return apiService.getProfile()
    }

    suspend fun updateProfile(name: String?, email: String?): CustomerProfileResponse {
        return apiService.updateProfile(UpdateProfileRequest(name, email))
    }

    suspend fun createAddress(request: CreateAddressRequest): Address {
        return apiService.createAddress(request)
    }

    suspend fun deleteAddress(id: Int) {
        apiService.deleteAddress(id)
    }

    suspend fun getPayLaterAccounts(): PayLaterAccountsResponse {
        return apiService.getPayLaterAccounts()
    }

    suspend fun getPayLaterDetails(accountId: Int): PayLaterDetailsResponse {
        return apiService.getPayLaterDetails(accountId)
    }

    suspend fun checkPayLaterEligibility(slug: String): PayLaterEligibilityResponse {
        return apiService.checkPayLaterEligibility(slug)
    }

    suspend fun repayPayLater(accountId: Int, amount: Double): CreatePaymentResponse {
        return apiService.repayPayLater(accountId, PayLaterRepayRequest(amount))
    }

    suspend fun verifyPayLaterRepay(accountId: Int, request: VerifyPaymentRequest): SimpleResponse {
        return apiService.verifyPayLaterRepay(accountId, request)
    }

    suspend fun getNotifications(): NotificationsResponse {
        return apiService.getNotifications()
    }

    suspend fun markNotificationRead(id: Int): SimpleResponse {
        return apiService.markNotificationRead(id)
    }

    suspend fun getLiveBill(sessionId: Int): TableSession {
        return apiService.getLiveBill(sessionId)
    }

    suspend fun openTable(restaurantId: Int, tableNo: String): TableSession {
        return apiService.openTable(mapOf(
            "restaurantId" to restaurantId.toString(),
            "tableNo" to tableNo
        ))
    }

    suspend fun placeDineInOrder(sessionId: Int, items: List<OrderItemRequest>): SimpleResponse {
        return apiService.placeDineInOrder(mapOf(
            "sessionId" to sessionId,
            "items" to items
        ))
    }
}
