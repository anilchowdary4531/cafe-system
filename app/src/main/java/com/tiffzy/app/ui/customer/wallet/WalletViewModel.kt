package com.tiffzy.app.ui.customer.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.repository.WalletRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class WalletUiState {
    object Loading : WalletUiState()
    data class Success(
        val summary: CustomerWallet,
        val transactions: List<WalletTransaction> = emptyList()
    ) : WalletUiState()
    data class Error(val message: String) : WalletUiState()
}

class WalletViewModel(
    private val walletRepository: WalletRepository = WalletRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow<WalletUiState>(WalletUiState.Loading)
    val uiState: StateFlow<WalletUiState> = _uiState.asStateFlow()

    init {
        loadWalletData()
    }

    fun loadWalletData() {
        viewModelScope.launch {
            _uiState.value = WalletUiState.Loading
            try {
                val walletRes = walletRepository.getWallet()
                val txnsRes = try {
                    walletRepository.getWalletTransactions(page = 1, limit = 20)
                } catch (e: Exception) {
                    null
                }
                _uiState.value = WalletUiState.Success(
                    summary = walletRes.wallet,
                    transactions = txnsRes?.transactions ?: emptyList()
                )
            } catch (e: Exception) {
                _uiState.value = WalletUiState.Error(
                    e.message ?: "Failed to load wallet balance"
                )
            }
        }
    }

    fun initiateTopup(amount: Double, onSessionCreated: (WalletTopupCreateResponse) -> Unit) {
        viewModelScope.launch {
            try {
                val res = walletRepository.createWalletTopup(
                    WalletTopupCreateRequest(amount = amount)
                )
                onSessionCreated(res)
            } catch (e: Exception) {
                _uiState.value = WalletUiState.Error(e.message ?: "Topup failed")
            }
        }
    }
}
