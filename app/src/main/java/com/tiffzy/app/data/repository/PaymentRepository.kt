package com.tiffzy.app.data.repository

import com.tiffzy.app.data.model.CashfreeCreateOrderRequest
import com.tiffzy.app.data.model.CashfreeCreateOrderResponse
import com.tiffzy.app.data.model.CashfreeVerifyOrderRequest
import com.tiffzy.app.data.model.CashfreeVerifyOrderResponse
import com.tiffzy.app.data.model.PaymentStatusRequest
import com.tiffzy.app.data.model.PaymentStatusResponse
import com.tiffzy.app.data.remote.ApiService
import com.tiffzy.app.data.remote.RetrofitClient

class PaymentRepository(private val apiService: ApiService = RetrofitClient.apiService) {

    suspend fun createCashfreeOrder(request: CashfreeCreateOrderRequest): Result<CashfreeCreateOrderResponse> {
        return runCatching {
            apiService.createCashfreeOrder(request)
        }
    }

    suspend fun sendPaymentStatus(request: PaymentStatusRequest): Result<PaymentStatusResponse> {
        return runCatching {
            apiService.sendPaymentStatus(request)
        }
    }

    suspend fun verifyCashfreeOrder(request: CashfreeVerifyOrderRequest): Result<CashfreeVerifyOrderResponse> {
        return runCatching {
            apiService.verifyCashfreeOrder(request)
        }
    }

    suspend fun getPaymentStatus(orderId: String): Result<CashfreeVerifyOrderResponse> {
        return runCatching {
            apiService.getPaymentStatus(orderId)
        }
    }

    suspend fun getRestaurantSettlements(restaurantId: Int? = null, range: String = "daily"): Result<com.tiffzy.app.data.model.SettlementSummaryResponse> {
        return runCatching {
            apiService.getRestaurantSettlements(restaurantId, range)
        }
    }

    suspend fun getRestaurantPayments(restaurantId: Int? = null, page: Int = 1, limit: Int = 10, range: String = "daily"): Result<com.tiffzy.app.data.model.SettlementOrdersResponse> {
        return runCatching {
            apiService.getRestaurantPayments(restaurantId, page, limit, range)
        }
    }
}
