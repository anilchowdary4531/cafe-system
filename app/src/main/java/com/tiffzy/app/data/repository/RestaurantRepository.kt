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

    // Restaurant Management
    suspend fun getRestaurantDashboard(restaurantId: Int): RestaurantDashboardResponse {
        return apiService.getRestaurantDashboard(restaurantId)
    }

    suspend fun getRestaurantAnalytics(restaurantId: Int, range: String = "24h"): AnalyticsResponse {
        return apiService.getRestaurantAnalytics(restaurantId, range)
    }

    suspend fun getRestaurantSettings(restaurantId: Int): RestaurantSettingsResponse {
        return apiService.getRestaurantSettings(restaurantId)
    }

    suspend fun updateRestaurantSettings(restaurantId: Int, request: RestaurantSettingsUpdateRequest): RestaurantSettingsResponse {
        return apiService.updateRestaurantSettings(restaurantId, request)
    }

    suspend fun updateRestaurantStatus(restaurantId: Int, isActive: Boolean): RestaurantSettingsResponse {
        return apiService.updateRestaurantSettings(restaurantId, RestaurantSettingsUpdateRequest(isActive = isActive))
    }

    suspend fun getLiveOrders(status: String? = null): LiveOrdersResponse {
        return apiService.getLiveOrders(status)
    }

    suspend fun getOwnerOrders(
        restaurantId: Int,
        status: String? = null,
        source: String? = null,
        query: String? = null
    ): OwnerOrdersResponse {
        return apiService.getOwnerOrders(restaurantId, status, source, query)
    }

    suspend fun updateOrderStatus(orderId: Int, status: String, notes: String? = null): OrderResponse {
        return apiService.updateOrderStatus(orderId, UpdateOrderStatusRequest(status, notes))
    }

    // Menu Management
    suspend fun getOwnerMenu(restaurantId: Int): List<MenuItem> {
        return apiService.getOwnerMenu(restaurantId)
    }

    suspend fun createMenuItem(restaurantId: Int, request: MenuRequest): MenuItem {
        return apiService.createMenuItem(restaurantId, request)
    }

    suspend fun updateMenuItem(restaurantId: Int, menuId: Int, request: MenuRequest): MenuItem {
        return apiService.updateMenuItem(restaurantId, menuId, request)
    }

    suspend fun deleteMenuItem(restaurantId: Int, menuId: Int): DeleteResponse {
        return apiService.deleteMenuItem(restaurantId, menuId)
    }

    suspend fun uploadMenuImage(restaurantId: Int, file: MultipartBody.Part): MenuImageUploadResponse {
        return apiService.uploadMenuImage(restaurantId, file)
    }
}
