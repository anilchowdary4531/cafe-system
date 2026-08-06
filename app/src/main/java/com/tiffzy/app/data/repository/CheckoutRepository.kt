package com.tiffzy.app.data.repository

import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.ApiService

class CheckoutRepository(private val apiService: ApiService) {

    suspend fun getAddresses(): List<Address> {
        return apiService.getAddresses().addresses
    }

    suspend fun getWalletAccounts(): List<PayLaterAccount> {
        return apiService.getPayLaterAccounts().accounts
    }

    suspend fun placeOrder(slug: String, request: OrderRequest): OrderResponse {
        return apiService.placeOrder(slug, request)
    }

    suspend fun getRestaurant(slug: String): Restaurant? {
        return apiService.getRestaurants().find { it.slug == slug }
    }
}
