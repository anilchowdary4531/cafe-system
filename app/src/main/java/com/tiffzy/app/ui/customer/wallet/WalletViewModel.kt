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
        val summary: WalletSummaryResponse,
        val transactions: List<WalletTransactionItem> = emptyList(),
        val ppiStatus: PpiStatusData? = null
    ) : WalletUiState()
    data class Error(val message: String) : WalletUiState()
}

class WalletViewModel(
    private val walletRepository: WalletRepository = WalletRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow<WalletUiState>(WalletUiState.Loading)
    val uiState: StateFlow<WalletUiState> = _uiState.asStateFlow()

    private val _topupState = MutableStateFlow<Result<TopupSessionResponse>?>(null)
    val topupState: StateFlow<Result<TopupSessionResponse>?> = _topupState.asStateFlow()

    init {
        loadWalletData()
    }

    fun loadWalletData() {
        viewModelScope.launch {
            _uiState.value = WalletUiState.Loading
            val summaryRes = walletRepository.getWalletSummary()
            val txnsRes = walletRepository.getWalletTransactions()
            val ppiRes = walletRepository.getPpiStatus()

            if (summaryRes.isSuccess) {
                _uiState.value = WalletUiState.Success(
                    summary = summaryRes.getOrNull() ?: WalletSummaryResponse(),
                    transactions = txnsRes.getOrNull()?.transactions ?: emptyList(),
                    ppiStatus = ppiRes.getOrNull()?.ppiStatus
                )
            } else {
                _uiState.value = WalletUiState.Error(
                    summaryRes.exceptionOrNull()?.message ?: "Failed to load wallet balance"
                )
            }
        }
    }

    fun initiateTopup(amount: Double, onSessionCreated: (TopupSessionData) -> Unit) {
        viewModelScope.launch {
            val res = walletRepository.createTopupSession(amount)
            _topupState.value = res
            res.getOrNull()?.session?.let { sessionData ->
                onSessionCreated(sessionData)
            }
        }
    }

    fun verifyTopup(topupTxnId: String, gatewayPaymentId: String? = null) {
        viewModelScope.launch {
            walletRepository.verifyTopup(topupTxnId = topupTxnId, gatewayPaymentId = gatewayPaymentId)
            loadWalletData()
        }
    }
}
