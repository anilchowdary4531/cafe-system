package com.tiffzy.app.ui.auth

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.AuthRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import retrofit2.HttpException

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    object OtpSent : AuthUiState()
    object Authenticated : AuthUiState()
    object AccountDeleted : AuthUiState()
    data class RequiresProfileCompletion(val partialInfo: VerifyOtpResponse) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(application: Application) : AndroidViewModel(application) {
    private val authDataStore = AuthDataStore(application)
    private val repository = AuthRepository(
        RetrofitClient.apiService,
        authDataStore
    )

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val _timerValue = MutableStateFlow(0)
    val timerValue: StateFlow<Int> = _timerValue.asStateFlow()

    private val _appLanguage = MutableStateFlow("en")
    val appLanguage: StateFlow<String> = _appLanguage.asStateFlow()

    val rememberSession = authDataStore.rememberSession
    val autoDetectLocation = authDataStore.autoDetectLocation
    val notificationsEnabled = authDataStore.notificationsEnabled

    private var timerJob: Job? = null

    val authToken = repository.getAuthTokenFlow()

    init {
        viewModelScope.launch {
            authDataStore.appLanguage.collect { code ->
                _appLanguage.value = code
            }
        }
        viewModelScope.launch {
            authDataStore.customerPhone.collect { p ->
                if (p != null) phone = p
            }
        }
        viewModelScope.launch {
            authDataStore.customerName.collect { n ->
                if (n != null) name = n
            }
        }
        viewModelScope.launch {
            authDataStore.authToken.collect { token ->
                // Basic way to get email if needed, but DataStore doesn't store it yet.
                // For now, phone and name are enough for the order.
            }
        }
    }

    fun updateSettings(remember: Boolean? = null, autoDetect: Boolean? = null, notify: Boolean? = null) {
        viewModelScope.launch {
            authDataStore.updateSettings(remember, autoDetect, notify)
        }
    }

    fun changeLanguage(languageCode: String) {
        viewModelScope.launch {
            authDataStore.saveLanguage(languageCode)
            _appLanguage.value = languageCode
        }
    }

    var phone: String = ""
    var email: String? = null
    var otp: String = ""
    var name: String? = null
    
    // Login & Register fields
    var username: String = ""
    var password: String = ""

    // Temporary storage for profile completion
    var pendingProfileInfo: VerifyOtpResponse? = null

    private fun handleError(e: Exception, defaultMessage: String) {
        val message = if (e is HttpException) {
            try {
                val errorBody = e.response()?.errorBody()?.string()
                android.util.Log.e("AUTH_ERROR", "HTTP ${e.code()} Body=$errorBody")
                // Try to get the "message" field, otherwise show the raw body
                val json = JSONObject(errorBody ?: "")
                if (json.has("message")) json.getString("message") else errorBody ?: defaultMessage
            } catch (inner: Exception) {
                // If not JSON, show the HTTP code and message
                "Error ${e.code()}: ${e.message()}"
            }
        } else {
            android.util.Log.e("AUTH_ERROR", "Exception: ${e.message}", e)
            e.message ?: defaultMessage
        }
        _uiState.value = AuthUiState.Error(message)
    }

    fun registerCustomer(request: CustomerRegisterRequest) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                repository.register(request)
                _uiState.value = AuthUiState.Authenticated
                registerFcm()
            } catch (e: Exception) {
                handleError(e, "Registration failed")
            }
        }
    }

    fun loginCustomer() {
        if (username.isEmpty() || password.isEmpty()) {
            _uiState.value = AuthUiState.Error("Username and password are required")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                repository.customerLogin(CustomerLoginRequest(username, password))
                _uiState.value = AuthUiState.Authenticated
                registerFcm()
            } catch (e: Exception) {
                handleError(e, "Login failed")
            }
        }
    }

    fun loginWithGoogle(idToken: String, email: String?, name: String?, googleId: String?, picture: String?, phone: String? = null) {
        android.util.Log.d("GOOGLE_AUTH", "AuthViewModel.loginWithGoogle() called with email: $email, phone: $phone")
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                android.util.Log.d("GOOGLE_AUTH", "Executing repository.googleLogin")
                val response = repository.googleLogin(
                    GoogleLoginRequest(
                        googleId = googleId,
                        email = email,
                        name = name,
                        picture = picture,
                        idToken = idToken,
                        phone = phone
                    )
                )
                android.util.Log.d("GOOGLE_AUTH", "repository.googleLogin success. requiresInfo=${response.requiresInfo}")
                
                if (response.requiresInfo == true) {
                    _uiState.value = AuthUiState.RequiresProfileCompletion(response)
                } else {
                    _uiState.value = AuthUiState.Authenticated
                    // Initial local save for picture to ensure it shows in Profile
                    picture?.let { pic ->
                        viewModelScope.launch {
                            authDataStore.saveAvatarUrl(pic)
                            // Also save to ProfileExtras so ProfileViewModel finds it
                            val userPhone = response.customer?.phone ?: email ?: ""
                            if (userPhone.isNotEmpty()) {
                                val extrasStore = com.tiffzy.app.data.local.ProfileExtrasDataStore(getApplication())
                                extrasStore.saveProfileExtras(userPhone, null, pic)
                            }
                        }
                    }
                    registerFcm()
                }
            } catch (e: Exception) {
                android.util.Log.e("GOOGLE_AUTH", "Backend Google Login Failed", e)
                handleError(e, "Google login failed")
            }
        }
    }

    private fun registerFcm() {
        viewModelScope.launch {
            try {
                val token = FirebaseMessaging.getInstance().token.await()
                repository.registerFcmToken(token)
            } catch (e: Exception) {
                android.util.Log.e("AuthViewModel", "FCM registration failed: ${e.message}")
            }
        }
    }

    fun sendOtp() {
        val currentEmail = email
        if (currentEmail == null || !android.util.Patterns.EMAIL_ADDRESS.matcher(currentEmail).matches()) {
            _uiState.value = AuthUiState.Error("Enter a valid email address")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                repository.sendOtp(currentEmail)
                _uiState.value = AuthUiState.OtpSent
                startTimer()
            } catch (e: Exception) {
                if (e is HttpException) {
                    val body = e.response()?.errorBody()?.string()
                    android.util.Log.e("SEND_OTP", "HTTP ${e.code()} Body=$body")
                    handleError(e, "HTTP ${e.code()} : $body")
                } else {
                    android.util.Log.e("SEND_OTP", e.toString())
                    handleError(e, e.toString())
                }
            }
        }
    }

    fun verifyOtp() {
        val currentEmail = email
        if (currentEmail == null || otp.length != 6) {
            _uiState.value = AuthUiState.Error("Enter a valid 6-digit OTP")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                val response = repository.verifyOtp(currentEmail, otp, name)
                
                if (response.requiresInfo == true) {
                    _uiState.value = AuthUiState.RequiresProfileCompletion(response)
                } else {
                    _uiState.value = AuthUiState.Authenticated
                    // Register FCM Token after successful login
                    registerFcm()
                }
            } catch (e: Exception) {
                handleError(e, "Invalid OTP")
            }
        }
    }

    private fun startTimer() {
        timerJob?.cancel()
        _timerValue.value = 60
        timerJob = viewModelScope.launch {
            while (_timerValue.value > 0) {
                delay(1000)
                _timerValue.value -= 1
            }
        }
    }

    fun resendOtp() {
        if (_timerValue.value == 0) {
            sendOtp()
        }
    }

    fun resetState() {
        _uiState.value = AuthUiState.Idle
    }

    suspend fun checkAuthStatus(): Boolean {
        val token = repository.getAuthToken()
        return if (token != null) {
            _uiState.value = AuthUiState.Authenticated
            // Refresh FCM token on every launch if authenticated to ensure backend is up to date
            viewModelScope.launch {
                try {
                    val fcmToken = FirebaseMessaging.getInstance().token.await()
                    repository.registerFcmToken(fcmToken)
                } catch (e: Exception) {
                    android.util.Log.e("AuthViewModel", "FCM refresh on launch failed: ${e.message}")
                }
            }
            true
        } else {
            false
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _uiState.value = AuthUiState.Idle
        }
    }

    fun clearCache() {
        viewModelScope.launch {
            authDataStore.clearAuth()
            // Clear other local stores if any
            _uiState.value = AuthUiState.Idle
        }
    }

    fun requestDeleteOtp(identifier: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                repository.requestDeleteOtp(identifier)
                _uiState.value = AuthUiState.OtpSent
            } catch (e: Exception) {
                handleError(e, "Failed to send deletion OTP")
            }
        }
    }

    fun confirmDeleteAccount(identifier: String, otp: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                repository.verifyDeleteAccount(identifier, otp)
                repository.logout()
                _uiState.value = AuthUiState.AccountDeleted
            } catch (e: Exception) {
                handleError(e, "Failed to delete account")
            }
        }
    }
}
