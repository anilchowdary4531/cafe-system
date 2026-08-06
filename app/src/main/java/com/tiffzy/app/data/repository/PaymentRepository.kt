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
}
