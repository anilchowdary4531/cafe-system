package com.tiffzy.app.data.repository

import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class WalletRepository {
    private val apiService = RetrofitClient.apiService

    suspend fun getWalletSummary(): Result<WalletSummaryResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getWalletSummary()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getWalletTransactions(
        page: Int = 1,
        limit: Int = 20,
        type: String? = null,
        direction: String? = null
    ): Result<WalletTransactionsResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getWalletTransactions(page, limit, type, direction)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTopupSession(amount: Double): Result<TopupSessionResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createTopupSession(TopupSessionRequest(amount = amount))
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyTopup(
        topupTxnId: String,
        gatewayOrderId: String? = null,
        gatewayPaymentId: String? = null
    ): Result<VerifyTopupResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.verifyTopup(
                VerifyTopupRequest(
                    topupTxnId = topupTxnId,
                    gatewayOrderId = gatewayOrderId,
                    gatewayPaymentId = gatewayPaymentId
                )
            )
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun payOrderWithWallet(orderId: Int, amount: Double): Result<PayOrderWalletResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.payOrderWithWallet(
                PayOrderWalletRequest(orderId = orderId, amount = amount)
            )
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPpiStatus(): Result<PpiStatusResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getPpiStatus()
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
