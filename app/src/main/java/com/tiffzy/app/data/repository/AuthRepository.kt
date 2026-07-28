package com.tiffzy.app.data.repository

import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.ApiService
import com.tiffzy.app.data.remote.RetrofitClient
import kotlinx.coroutines.flow.first

class AuthRepository(
    private val apiService: ApiService,
    private val authDataStore: AuthDataStore
) {
    init {
        RetrofitClient.init(authDataStore)
    }

    suspend fun registerFcmToken(token: String) {
        try {
            apiService.registerFcmToken(RegisterFcmTokenRequest(token))
        } catch (e: Exception) {
            // Log error but don't fail login
            e.printStackTrace()
        }
    }

    suspend fun sendOtp(phone: String, email: String? = null): SendOtpResponse {
        return apiService.sendOtp(SendOtpRequest(phone, email))
    }

    suspend fun verifyOtp(phone: String, otp: String, name: String? = null, email: String? = null): VerifyOtpResponse {
        val response = apiService.verifyOtp(VerifyOtpRequest(phone, otp, name, email))
        saveAuthToken(response.token)
        authDataStore.saveCustomerInfo(response.customer.name, response.customer.phone)
        return response
    }

    suspend fun login(email: String, password: String): LoginResponse {
        val response = apiService.login(LoginRequest(email, password))
        saveAuthToken(response.token)
        authDataStore.saveStaffInfo(response.user.name, response.user.role, response.user.restaurantId)
        return response
    }

    suspend fun saveAuthToken(token: String) {
        authDataStore.saveAuthToken(token)
        RetrofitClient.setToken(token)
    }

    suspend fun getAuthToken(): String? {
        val token = authDataStore.authToken.first()
        RetrofitClient.setToken(token)
        return token
    }

    suspend fun getAccountType(): String? {
        return authDataStore.accountType.first()
    }

    suspend fun getUserRole(): String? {
        return authDataStore.userRole.first()
    }

    suspend fun logout() {
        authDataStore.clearAuth()
        RetrofitClient.setToken(null)
    }
}
