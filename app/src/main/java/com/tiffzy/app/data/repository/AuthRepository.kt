package com.tiffzy.app.data.repository

import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.ApiService
import com.tiffzy.app.data.remote.RetrofitClient
import kotlinx.coroutines.flow.Flow
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

    suspend fun sendOtp(email: String): SendOtpResponse {
        return apiService.sendOtp(SendOtpRequest(email = email, phone = email))
    }

    suspend fun verifyOtp(email: String, otp: String, name: String? = null): VerifyOtpResponse {
        val response = apiService.verifyOtp(VerifyOtpRequest(email = email, otp = otp, name = name, phone = email))
        handleCustomerAuth(response)
        return response
    }

    suspend fun register(request: CustomerRegisterRequest): VerifyOtpResponse {
        val response = apiService.register(request)
        handleCustomerAuth(response)
        return response
    }

    suspend fun customerLogin(request: CustomerLoginRequest): VerifyOtpResponse {
        val response = apiService.customerLogin(request)
        handleCustomerAuth(response)
        return response
    }

    suspend fun googleLogin(request: GoogleLoginRequest): VerifyOtpResponse {
        android.util.Log.d("GOOGLE_AUTH", "AuthRepository.googleLogin() calling API")
        val response = apiService.googleLogin(request)
        android.util.Log.d("GOOGLE_AUTH", "AuthRepository.googleLogin() received response")
        handleCustomerAuth(response)
        return response
    }

    private suspend fun handleCustomerAuth(response: VerifyOtpResponse) {
        saveAuthToken(response.token)
        // Ensure customer object is not null before accessing its properties
        val customer = response.customer ?: return
        authDataStore.saveCustomerInfo(
            customer.name ?: "Guest",
            customer.phone,
            customer.avatarUrl // Sync avatar from backend
        )
    }

    suspend fun login(email: String, password: String): LoginResponse {
        val response = apiService.login(LoginRequest(email, password))
        saveAuthToken(response.token)
        authDataStore.saveStaffInfo(response.user.name, response.user.role, response.user.restaurantId)
        return response
    }

    suspend fun saveAuthToken(token: String?) {
        if (token != null) {
            authDataStore.saveAuthToken(token)
            RetrofitClient.setToken(token)
        }
    }

    suspend fun getAuthToken(): String? {
        val token = authDataStore.authToken.first()
        RetrofitClient.setToken(token)
        return token
    }

    fun getAuthTokenFlow(): Flow<String?> {
        return authDataStore.authToken
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

    suspend fun requestDeleteOtp(identifier: String): SendOtpResponse {
        return apiService.requestDeleteOtp(mapOf("identifier" to identifier))
    }

    suspend fun verifyDeleteAccount(identifier: String, otp: String): SimpleResponse {
        return apiService.verifyDeleteAccount(mapOf("identifier" to identifier, "otp" to otp))
    }
}
