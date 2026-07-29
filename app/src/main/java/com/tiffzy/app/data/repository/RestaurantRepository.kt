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
}
