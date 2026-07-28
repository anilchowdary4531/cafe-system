package com.tiffzy.app.ui.auth

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.AuthRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    object OtpSent : AuthUiState()
    object Authenticated : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = AuthRepository(
        RetrofitClient.apiService,
        AuthDataStore(application)
    )

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val _timerValue = MutableStateFlow(0)
    val timerValue: StateFlow<Int> = _timerValue.asStateFlow()

    private var timerJob: Job? = null

    var phone: String = ""
    var email: String? = null
    var otp: String = ""
    var name: String? = null
    
    // Staff login fields
    var staffEmail: String = ""
    var staffPassword: String = ""

    fun sendOtp() {
        if (phone.length < 10) {
            _uiState.value = AuthUiState.Error("Enter a valid 10-digit phone number")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                repository.sendOtp(phone, email)
                _uiState.value = AuthUiState.OtpSent
                startTimer()
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Failed to send OTP")
            }
        }
    }

    fun verifyOtp() {
        if (otp.length != 6) {
            _uiState.value = AuthUiState.Error("Enter a valid 6-digit OTP")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                repository.verifyOtp(phone, otp, name, email)
                _uiState.value = AuthUiState.Authenticated
                
                // Register FCM Token after successful login
                // We wrap this in a more robust check because google-services.json might be missing
                try {
                    val token = FirebaseMessaging.getInstance().token.await()
                    repository.registerFcmToken(token)
                } catch (e: Exception) {
                    // Log but don't block navigation if Firebase fails
                    android.util.Log.e("AuthViewModel", "Firebase token registration failed: ${e.message}")
                }
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Invalid OTP")
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

    fun staffLogin() {
        if (staffEmail.isEmpty() || staffPassword.isEmpty()) {
            _uiState.value = AuthUiState.Error("Email and password are required")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                repository.login(staffEmail, staffPassword)
                _uiState.value = AuthUiState.Authenticated
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Login failed")
            }
        }
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
}
