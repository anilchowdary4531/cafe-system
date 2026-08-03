package com.tiffzy.app.ui.customer.profile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.TiffzyNotification
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class NotificationUiState {
    object Idle : NotificationUiState()
    object Loading : NotificationUiState()
    data class Success(val notifications: List<TiffzyNotification>) : NotificationUiState()
    data class Error(val message: String) : NotificationUiState()
}

class NotificationViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)

    private val _uiState = MutableStateFlow<NotificationUiState>(NotificationUiState.Idle)
    val uiState: StateFlow<NotificationUiState> = _uiState.asStateFlow()

    fun loadNotifications() {
        viewModelScope.launch {
            _uiState.value = NotificationUiState.Loading
            try {
                val response = repository.getNotifications()
                _uiState.value = NotificationUiState.Success(response.notifications)
            } catch (e: Exception) {
                _uiState.value = NotificationUiState.Error(e.message ?: "Failed to load notifications")
            }
        }
    }

    fun markAsRead(id: Int) {
        viewModelScope.launch {
            try {
                repository.markNotificationRead(id)
                // Optionally reload or update local state
                loadNotifications()
            } catch (e: Exception) {
                // ignore
            }
        }
    }
}
