package com.tiffzy.app.data.repository

import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.ApiService
import com.tiffzy.app.data.remote.RetrofitClient

class WalletRepository(
    private val apiService: ApiService = RetrofitClient.apiService
) {
    suspend fun getWallet(): WalletResponse {
        return apiService.getWallet()
    }

    suspend fun getWalletTransactions(page: Int = 1, limit: Int = 20): WalletTransactionsResponse {
        return apiService.getWalletTransactions(page, limit)
    }

    suspend fun createWalletTopup(request: WalletTopupCreateRequest): WalletTopupCreateResponse {
        return apiService.createWalletTopup(request)
    }

    suspend fun verifyWalletTopup(request: WalletTopupVerifyRequest): WalletTopupVerifyResponse {
        return apiService.verifyWalletTopup(request)
    }

    suspend fun getPaymentProviders(): PaymentProvidersResponse {
        return apiService.getPaymentProviders()
    }

    suspend fun verifyTwmWalletTopupReturn(request: WalletTwmReturnVerifyRequest): WalletTwmStatusResponse {
        return apiService.verifyTwmWalletTopupReturn(request)
    }

    suspend fun getTwmWalletTopupStatus(topupTxnId: String, orderRef: String? = null): WalletTwmStatusResponse {
        return apiService.getTwmWalletTopupStatus(topupTxnId, orderRef)
    }

    suspend fun payOrderWithWallet(request: WalletPayOrderRequest): WalletPayOrderResponse {
        return apiService.payOrderWithWallet(request)
    }
}
