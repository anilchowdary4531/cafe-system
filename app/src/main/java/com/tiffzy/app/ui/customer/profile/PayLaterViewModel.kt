package com.tiffzy.app.ui.customer.profile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class PayLaterUiState {
    object Idle : PayLaterUiState()
    object Loading : PayLaterUiState()
    data class Success(val accounts: List<PayLaterAccount>) : PayLaterUiState()
    data class Error(val message: String) : PayLaterUiState()
}

sealed class PayLaterDetailsUiState {
    object Idle : PayLaterDetailsUiState()
    object Loading : PayLaterDetailsUiState()
    data class Success(val account: PayLaterAccountDetails) : PayLaterDetailsUiState()
    data class Error(val message: String) : PayLaterDetailsUiState()
}

class PayLaterViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)

    private val _uiState = MutableStateFlow<PayLaterUiState>(PayLaterUiState.Idle)
    val uiState: StateFlow<PayLaterUiState> = _uiState.asStateFlow()

    private val _detailsState = MutableStateFlow<PayLaterDetailsUiState>(PayLaterDetailsUiState.Idle)
    val detailsState: StateFlow<PayLaterDetailsUiState> = _detailsState.asStateFlow()

    fun loadAccounts() {
        viewModelScope.launch {
            _uiState.value = PayLaterUiState.Loading
            try {
                val response = repository.getPayLaterAccounts()
                _uiState.value = PayLaterUiState.Success(response.accounts)
            } catch (e: Exception) {
                _uiState.value = PayLaterUiState.Error(e.message ?: "Failed to load accounts")
            }
        }
    }

    fun loadDetails(accountId: Int) {
        viewModelScope.launch {
            _detailsState.value = PayLaterDetailsUiState.Loading
            try {
                val response = repository.getPayLaterDetails(accountId)
                _detailsState.value = PayLaterDetailsUiState.Success(response.account)
            } catch (e: Exception) {
                _detailsState.value = PayLaterDetailsUiState.Error(e.message ?: "Failed to load details")
            }
        }
    }
}
