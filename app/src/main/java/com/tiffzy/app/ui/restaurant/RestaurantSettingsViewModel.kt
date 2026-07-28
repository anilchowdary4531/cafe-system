package com.tiffzy.app.ui.restaurant

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.RestaurantSettings
import com.tiffzy.app.data.model.RestaurantSettingsUpdateRequest
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class SettingsUiState {
    object Idle : SettingsUiState()
    object Loading : SettingsUiState()
    data class Success(val settings: RestaurantSettings) : SettingsUiState()
    data class Error(val message: String) : SettingsUiState()
}

class RestaurantSettingsViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)
    private val authDataStore = AuthDataStore(application)

    private val _uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Idle)
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    fun loadSettings() {
        viewModelScope.launch {
            _uiState.value = SettingsUiState.Loading
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    val response = repository.getRestaurantSettings(ridString.toInt())
                    _uiState.value = SettingsUiState.Success(response.restaurant)
                } else {
                    _uiState.value = SettingsUiState.Error("Unauthorized")
                }
            } catch (e: Exception) {
                _uiState.value = SettingsUiState.Error(e.message ?: "Failed to load settings")
            }
        }
    }

    fun updateSettings(request: RestaurantSettingsUpdateRequest, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isSaving.value = true
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    repository.updateRestaurantSettings(ridString.toInt(), request)
                    loadSettings()
                    onSuccess()
                }
            } catch (e: Exception) {
                // Handle error
            } finally {
                _isSaving.value = false
            }
        }
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            authDataStore.clearAuth()
            onLoggedOut()
        }
    }
}
