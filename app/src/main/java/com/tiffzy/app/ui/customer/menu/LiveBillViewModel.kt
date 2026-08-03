package com.tiffzy.app.ui.customer.menu

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.TableSession
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class LiveBillUiState {
    object Idle : LiveBillUiState()
    object Loading : LiveBillUiState()
    data class Success(val session: TableSession) : LiveBillUiState()
    data class Error(val message: String) : LiveBillUiState()
}

class LiveBillViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)

    private val _uiState = MutableStateFlow<LiveBillUiState>(LiveBillUiState.Idle)
    val uiState: StateFlow<LiveBillUiState> = _uiState.asStateFlow()

    fun loadBill(sessionId: Int) {
        viewModelScope.launch {
            _uiState.value = LiveBillUiState.Loading
            try {
                val session = repository.getLiveBill(sessionId)
                _uiState.value = LiveBillUiState.Success(session)
            } catch (e: Exception) {
                _uiState.value = LiveBillUiState.Error(e.message ?: "Failed to load bill")
            }
        }
    }
}
