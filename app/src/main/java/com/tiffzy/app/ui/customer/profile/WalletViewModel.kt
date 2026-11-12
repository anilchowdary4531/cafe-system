package com.tiffzy.app.ui.customer.profile

import android.app.Activity
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cashfree.pg.api.CFPaymentGatewayService
import com.cashfree.pg.core.api.CFSession
import com.cashfree.pg.core.api.callback.CFCheckoutResponseCallback
import com.cashfree.pg.core.api.exception.CFException
import com.cashfree.pg.core.api.utils.CFErrorResponse
import com.cashfree.pg.core.api.webcheckout.CFWebCheckoutPayment
import com.tiffzy.app.MainActivity
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.WalletRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class WalletViewModel(
    private val walletRepository: WalletRepository = WalletRepository()
) : ViewModel() {

    private val _walletState = MutableStateFlow<WalletUiState>(WalletUiState.Idle)
    val walletState: StateFlow<WalletUiState> = _walletState.asStateFlow()

    private val _topupStep = MutableStateFlow<TopupStep>(TopupStep.Idle)
    val topupStep: StateFlow<TopupStep> = _topupStep.asStateFlow()

    private val _isAddMoneyVisible = MutableStateFlow(false)
    val isAddMoneyVisible: StateFlow<Boolean> = _isAddMoneyVisible.asStateFlow()

    private val _topupAmountText = MutableStateFlow("500")
    val topupAmountText: StateFlow<String> = _topupAmountText.asStateFlow()

    private val _statusBanner = MutableStateFlow<String?>(null)
    val statusBanner: StateFlow<String?> = _statusBanner.asStateFlow()

    private val _isBannerSuccess = MutableStateFlow(false)
    val isBannerSuccess: StateFlow<Boolean> = _isBannerSuccess.asStateFlow()

    private val _selectedProvider = MutableStateFlow("CASHFREE")
    val selectedProvider: StateFlow<String> = _selectedProvider.asStateFlow()

    private val _availableOnlineProviders = MutableStateFlow<List<PaymentProviderItem>>(emptyList())
    val availableOnlineProviders: StateFlow<List<PaymentProviderItem>> = _availableOnlineProviders.asStateFlow()

    private val _providersLoaded = MutableStateFlow(false)
    val providersLoaded: StateFlow<Boolean> = _providersLoaded.asStateFlow()

    fun loadPaymentProviders() {
        viewModelScope.launch {
            try {
                val res = walletRepository.getPaymentProviders()
                val configured = res.providers.filter { it.configured }
                _availableOnlineProviders.value = configured
                _providersLoaded.value = true
                if (configured.any { it.id.equals("TWM_PAY", ignoreCase = true) }) {
                    val preferred = res.defaultProvider?.uppercase()
                    _selectedProvider.value = if (preferred == "CASHFREE" && configured.any { it.id.equals("CASHFREE", ignoreCase = true) }) {
                        "CASHFREE"
                    } else {
                        "TWM_PAY"
                    }
                } else if (configured.any { it.id.equals("CASHFREE", ignoreCase = true) }) {
                    _selectedProvider.value = "CASHFREE"
                }
            } catch (_: Exception) {
                // Keep defaults gracefully if providers endpoint is unreachable
            }
        }
    }

    fun selectProvider(provider: String) {
        _selectedProvider.value = provider.trim().uppercase()
        if (_topupStep.value is TopupStep.Error || _topupStep.value is TopupStep.Cancelled) {
            _topupStep.value = TopupStep.Idle
        }
        _statusBanner.value = null
    }

    fun loadWallet() {
        viewModelScope.launch {
            _walletState.value = WalletUiState.Loading
            try {
                Log.d("WALLET_TOPUP", "11. Wallet refresh started")
                val walletRes = walletRepository.getWallet()
                val txnRes = try {
                    walletRepository.getWalletTransactions(page = 1, limit = 20)
                } catch (e: Exception) {
                    null
                }
                _walletState.value = WalletUiState.Success(
                    wallet = walletRes.wallet,
                    transactions = txnRes?.transactions ?: emptyList()
                )
                Log.d("WALLET_TOPUP", "12. Wallet refresh completed. Balance: ₹${walletRes.wallet.balance}")
            } catch (e: Exception) {
                Log.e("WALLET_TOPUP", "Failed to load wallet data: ${e.message}")
                _walletState.value = WalletUiState.Error(e.message ?: "Failed to load wallet")
            }
        }
    }

    fun openAddMoney() {
        Log.d("WALLET_TOPUP", "1. Add Money button clicked")
        _topupStep.value = TopupStep.Idle
        _statusBanner.value = null
        _isAddMoneyVisible.value = true
    }

    fun dismissAddMoney() {
        if (isProcessing()) return
        _isAddMoneyVisible.value = false
        _topupStep.value = TopupStep.Idle
    }

    fun setTopupAmount(amount: String) {
        Log.d("WALLET_TOPUP", "2. Amount entered: ₹$amount")
        _topupAmountText.value = amount
        // Clear old error state when manually changing the amount
        _topupStep.value = TopupStep.Idle
        _statusBanner.value = null
    }

    fun setTopupAmount(amount: Int) {
        Log.d("WALLET_TOPUP", "2. Amount selected: ₹$amount")
        _topupAmountText.value = amount.toString()
        // Clear old error state when selecting a new amount
        _topupStep.value = TopupStep.Idle
        _statusBanner.value = null
    }

    fun isProcessing(): Boolean {
        return when (_topupStep.value) {
            is TopupStep.CreatingSession,
            is TopupStep.OpeningPayment,
            is TopupStep.VerifyingPayment -> true
            else -> false
        }
    }

    fun validateAmount(input: String): Pair<Boolean, String?> {
        val clean = input.trim()
        if (clean.isBlank()) return Pair(false, "Please enter an amount")
        val value = clean.toDoubleOrNull()
        if (value == null) return Pair(false, "Invalid amount entered")
        if (value <= 0) return Pair(false, "Amount must be greater than zero")
        if (value < 10.0) return Pair(false, "Minimum top-up amount is ₹10")
        if (value > 50000.0) return Pair(false, "Maximum top-up amount is ₹50,000")
        if (clean.contains(".")) {
            val decimals = clean.substringAfter(".")
            if (decimals.length > 2) return Pair(false, "Maximum 2 decimal places allowed")
        }
        return Pair(true, null)
    }

    fun initiateTopup(activity: Activity) {
        if (isProcessing()) {
            Log.w("WALLET_TOPUP", "Duplicate tap ignored: top-up already in progress.")
            return
        }

        // Clear any previous error before starting
        _topupStep.value = TopupStep.Idle
        _statusBanner.value = null

        val validation = validateAmount(_topupAmountText.value)
        if (!validation.first) {
            _topupStep.value = TopupStep.Error(
                message = validation.second ?: "Invalid amount entered",
                errorType = TopupErrorType.TOPUP_CREATE_FAILED
            )
            return
        }

        val amount = _topupAmountText.value.toDouble()
        val idempotencyKey = "IK_WLT_${System.currentTimeMillis()}_${(1000..9999).random()}"
        val chosenProvider = _selectedProvider.value

        Log.d("WALLET_TOPUP", "3. POST /api/wallet/topup/create started for amount: ₹$amount via $chosenProvider")
        _topupStep.value = TopupStep.CreatingSession(amount)

        viewModelScope.launch {
            try {
                val createReq = WalletTopupCreateRequest(
                    amount = amount,
                    returnUrl = "https://tiffzy.com/profile/wallet",
                    idempotencyKey = idempotencyKey,
                    provider = chosenProvider
                )
                val response = walletRepository.createWalletTopup(createReq)
                Log.d("WALLET_TOPUP", "4. create response received: success=${response.success}, provider=${response.resolvedProvider}")

                val targetOrderId = response.resolvedTopupTxnId
                if (response.success && response.resolvedProvider == "TWM_PAY") {
                    val checkoutUrl = response.resolvedCheckoutUrl
                    if (targetOrderId.isNullOrBlank() || checkoutUrl.isNullOrBlank()) {
                        _topupStep.value = TopupStep.Error(
                            message = response.message ?: "TWM Pay did not return a checkout URL.",
                            errorType = TopupErrorType.TOPUP_CREATE_FAILED
                        )
                        return@launch
                    }
                    _topupStep.value = TopupStep.TwmCheckout(
                        topupTxnId = targetOrderId,
                        orderRef = response.resolvedGatewayOrderId ?: targetOrderId,
                        checkoutUrl = checkoutUrl,
                        amount = amount,
                        returnUrlPrefix = "https://tiffzy.com/profile/wallet"
                    )
                    return@launch
                }

                val sessionId = response.resolvedSessionId

                if (!response.success || sessionId.isNullOrBlank() || targetOrderId.isNullOrBlank()) {
                    val errMsg = response.message ?: "Unable to start payment. Please try again."
                    Log.e("WALLET_TOPUP", "Top-up session creation failed: $errMsg")
                    _topupStep.value = TopupStep.Error(
                        message = errMsg,
                        errorType = TopupErrorType.TOPUP_CREATE_FAILED
                    )
                    return@launch
                }

                Log.d("WALLET_TOPUP", "5. Cashfree order/session ID received: orderId=$targetOrderId")

                // Register Cashfree callback on MainActivity
                MainActivity.cashfreeCheckoutCallback = object : CFCheckoutResponseCallback {
                    override fun onPaymentVerify(orderId: String) {
                        Log.d("WALLET_TOPUP", "7. Cashfree callback received: status=SUCCESS, orderId=$orderId")
                        Log.d("WALLET_TOPUP", "8. Payment status received: status=SUCCESS")
                        verifyTopup(orderId, amount)
                    }

                    override fun onPaymentFailure(cfErrorResponse: CFErrorResponse, orderId: String) {
                        val status = cfErrorResponse.status ?: "FAILED"
                        val message = cfErrorResponse.message ?: "Payment failed"
                        val resolvedOrderId = if (orderId.isNotBlank()) orderId else targetOrderId
                        Log.e("WALLET_TOPUP", "7. Cashfree callback received: status=$status, orderId=$resolvedOrderId")
                        Log.e("WALLET_TOPUP", "8. Payment status received: status=$status, message=$message")
                        handlePaymentFailure(status, message, resolvedOrderId, amount)
                    }
                }

                _topupStep.value = TopupStep.OpeningPayment(targetOrderId, amount)

                val isProd = response.resolvedIsProduction(RetrofitClient.BASE_URL)
                val environment = if (isProd) {
                    CFSession.Environment.PRODUCTION
                } else {
                    CFSession.Environment.SANDBOX
                }
                Log.d("WALLET_TOPUP", "Cashfree environment determined: $environment (isProd=$isProd)")

                val cfSession = CFSession.CFSessionBuilder()
                    .setEnvironment(environment)
                    .setPaymentSessionID(sessionId.trim())
                    .setOrderId(targetOrderId)
                    .build()

                val cfWebCheckoutPayment = CFWebCheckoutPayment.CFWebCheckoutPaymentBuilder()
                    .setSession(cfSession)
                    .build()

                try {
                    CFPaymentGatewayService.getInstance().setCheckoutCallback(
                        MainActivity.getInstance() ?: (activity as? CFCheckoutResponseCallback)
                    )
                    Log.d("WALLET_TOPUP", "6. Cashfree SDK launched for orderId=$targetOrderId (env=$environment)")
                    CFPaymentGatewayService.getInstance().doPayment(activity, cfWebCheckoutPayment)
                } catch (e: CFException) {
                    Log.e("WALLET_TOPUP", "Cashfree SDK launch failed: ${e.message}")
                    _topupStep.value = TopupStep.Error(
                        message = "Unable to start payment. Please try again.",
                        errorType = TopupErrorType.TOPUP_CREATE_FAILED
                    )
                } catch (e: Exception) {
                    Log.e("WALLET_TOPUP", "General checkout launch exception: ${e.message}")
                    _topupStep.value = TopupStep.Error(
                        message = "Unable to start payment. Please try again.",
                        errorType = TopupErrorType.TOPUP_CREATE_FAILED
                    )
                }

            } catch (e: Exception) {
                Log.e("WALLET_TOPUP", "Network failure during top-up creation: ${e.message}")
                val isNetwork = e is java.io.IOException || e is java.net.SocketTimeoutException || e is java.net.UnknownHostException
                val errorMsg = if (e is retrofit2.HttpException) {
                    try {
                        val body = e.response()?.errorBody()?.string()
                        if (body?.contains("message") == true) {
                            com.google.gson.Gson().fromJson(body, Map::class.java)["message"] as? String ?: e.message()
                        } else body ?: e.message()
                    } catch (ex: Exception) { e.message() }
                } else if (isNetwork) {
                    "Unable to start payment. Please check your connection and try again."
                } else {
                    e.message ?: "Unable to start payment. Please try again."
                }
                _topupStep.value = TopupStep.Error(
                    message = errorMsg ?: "Unable to start payment. Please try again.",
                    errorType = if (isNetwork) TopupErrorType.NETWORK_ERROR else TopupErrorType.TOPUP_CREATE_FAILED
                )
            }
        }
    }

    fun verifyTopup(orderId: String, amount: Double) {
        Log.d("WALLET_TOPUP", "9. POST /api/wallet/topup/verify started for orderId=$orderId")
        _topupStep.value = TopupStep.VerifyingPayment(orderId, amount)

        viewModelScope.launch {
            try {
                val verifyReq = WalletTopupVerifyRequest(
                    topupTxnId = orderId,
                    gatewayOrderId = orderId,
                    gatewayPaymentId = "PAY_${System.currentTimeMillis()}"
                )
                val response = walletRepository.verifyWalletTopup(verifyReq)
                Log.d("WALLET_TOPUP", "10. Verification response received: success=${response.success}, balance=₹${response.balance}")

                if (response.success) {
                    val newBalance = response.balance ?: 0.0
                    val successMsg = "₹${"%.0f".format(amount)} added successfully."

                    _topupStep.value = TopupStep.Success(
                        amount = amount,
                        newBalance = newBalance,
                        message = successMsg
                    )

                    // Close the sheet after successful payment
                    _isAddMoneyVisible.value = false
                    _statusBanner.value = successMsg
                    _isBannerSuccess.value = true

                    // Trigger authoritative wallet refresh
                    loadWallet()
                } else {
                    val msg = response.message ?: "Payment received but verification is still pending. Please refresh your wallet."
                    Log.e("WALLET_TOPUP", "Verification result: Unsuccessful - $msg")
                    _topupStep.value = TopupStep.Error(
                        message = "Payment received but verification is still pending. Please refresh your wallet.",
                        errorType = TopupErrorType.TOPUP_VERIFY_FAILED,
                        canRetry = true
                    )
                    _statusBanner.value = "Payment received but verification is still pending. Please refresh your wallet."
                    _isBannerSuccess.value = false
                }
            } catch (e: Exception) {
                Log.e("WALLET_TOPUP", "Verification network error for orderId $orderId: ${e.message}")
                // Do not claim payment failure when verification has a network/server problem
                val pendingMsg = "Payment received but verification is still pending. Please refresh your wallet."
                _topupStep.value = TopupStep.Error(
                    message = pendingMsg,
                    errorType = TopupErrorType.TOPUP_VERIFY_FAILED,
                    canRetry = true
                )
                _statusBanner.value = pendingMsg
                _isBannerSuccess.value = false
            }
        }
    }

    fun handlePaymentFailure(status: String, message: String, orderId: String? = null, amount: Double? = null) {
        val isCancelled = status.contains("CANCEL", ignoreCase = true) ||
                message.contains("cancel", ignoreCase = true) ||
                status.contains("DROP", ignoreCase = true) ||
                message.contains("drop", ignoreCase = true)

        if (isCancelled) {
            Log.d("WALLET_TOPUP", "Payment cancelled by customer.")
            _topupStep.value = TopupStep.Cancelled
            _statusBanner.value = "Payment cancelled."
            _isBannerSuccess.value = false
            _isAddMoneyVisible.value = false
            return
        }

        // Check if Cashfree SDK in DEBUG build failed due to untrusted installer / emulator sideloading
        // Matches web customer fallback behavior to ensure end-to-end verification can be tested locally
        if (com.tiffzy.app.BuildConfig.DEBUG &&
            (message.contains("not a trusted source", ignoreCase = true) ||
             message.contains("whitelisted app store", ignoreCase = true)) &&
            !orderId.isNullOrBlank() && amount != null) {
            Log.w("WALLET_TOPUP", "Cashfree production installer check blocked sideloaded debug APK. Proceeding with backend verification to complete authoritative wallet credit flow.")
            verifyTopup(orderId, amount)
            return
        }

        Log.e("WALLET_TOPUP", "Payment failed on Cashfree: status=$status, msg=$message")
        _topupStep.value = TopupStep.Error(
            message = "Payment failed. Your wallet was not credited.",
            errorType = TopupErrorType.CASHFREE_PAYMENT_FAILED
        )
        _statusBanner.value = "Payment failed. Your wallet was not credited."
        _isBannerSuccess.value = false
    }

    fun verifyTwmTopupReturn(
        topupTxnId: String,
        orderRef: String,
        amount: Double,
        params: TwmReturnVerifyRequest
    ) {
        _topupStep.value = TopupStep.VerifyingPayment(topupTxnId, amount)
        viewModelScope.launch {
            try {
                val res = walletRepository.verifyTwmWalletTopupReturn(
                    WalletTwmReturnVerifyRequest(
                        topupTxnId = topupTxnId,
                        orderRef = (params.orderRef ?: "").ifBlank { orderRef },
                        status = params.status,
                        amountPaise = params.amountPaise,
                        txn = params.txn,
                        signature = params.signature
                    )
                )
                applyTwmTopupOutcome(res, topupTxnId, orderRef, amount)
            } catch (e: Exception) {
                val errMsg = "Payment verification pending. Please check status or refresh your wallet."
                _topupStep.value = TopupStep.Error(
                    message = errMsg,
                    errorType = TopupErrorType.TOPUP_VERIFY_FAILED,
                    canRetry = true
                )
                _statusBanner.value = errMsg
                _isBannerSuccess.value = false
            }
        }
    }

    fun checkTwmTopupStatus(topupTxnId: String, orderRef: String, amount: Double) {
        _topupStep.value = TopupStep.VerifyingPayment(topupTxnId, amount)
        viewModelScope.launch {
            try {
                val res = walletRepository.getTwmWalletTopupStatus(topupTxnId, orderRef)
                applyTwmTopupOutcome(res, topupTxnId, orderRef, amount)
            } catch (e: Exception) {
                val errMsg = e.message ?: "Unable to verify TWM Pay status right now. Please retry."
                _topupStep.value = TopupStep.Error(
                    message = errMsg,
                    errorType = TopupErrorType.TOPUP_VERIFY_FAILED,
                    canRetry = true
                )
                _statusBanner.value = errMsg
                _isBannerSuccess.value = false
            }
        }
    }

    private fun applyTwmTopupOutcome(
        res: WalletTwmStatusResponse,
        topupTxnId: String,
        orderRef: String,
        amount: Double
    ) {
        val paymentStatus = (res.paymentStatus ?: res.status ?: "").trim().uppercase()
        val gatewayStatus = (res.gatewayStatus ?: "").trim().uppercase()

        when {
            paymentStatus == "PAID" || paymentStatus == "SUCCESS" || gatewayStatus == "PAID" -> {
                val newBalance = res.balance ?: 0.0
                val credited = res.amount ?: amount
                val msg = res.message ?: "₹${credited.toInt()} added to your Tiffzy Wallet"
                _topupStep.value = TopupStep.Success(
                    amount = credited,
                    newBalance = newBalance,
                    message = msg
                )
                _statusBanner.value = msg
                _isBannerSuccess.value = true
                loadWallet()
            }
            paymentStatus == "FAILED" || gatewayStatus == "REJECTED" || gatewayStatus == "EXPIRED" -> {
                val msg = res.message ?: if (gatewayStatus == "EXPIRED") {
                    "Top-up payment session expired."
                } else {
                    "Payment rejected. Your wallet was not credited."
                }
                _topupStep.value = TopupStep.Error(
                    message = msg,
                    errorType = TopupErrorType.CASHFREE_PAYMENT_FAILED,
                    canRetry = true
                )
                _statusBanner.value = msg
                _isBannerSuccess.value = false
            }
            else -> {
                val msg = res.message ?: if (gatewayStatus == "UTR_SUBMITTED") {
                    "UTR submitted — verifying UPI payment"
                } else {
                    "Payment pending confirmation from TWM Pay."
                }
                _topupStep.value = TopupStep.Pending(
                    topupTxnId = res.topupTxnId ?: topupTxnId,
                    orderRef = res.orderRef ?: orderRef,
                    amount = res.amount ?: amount,
                    gatewayStatus = gatewayStatus.ifBlank { "CREATED" },
                    message = msg
                )
                _statusBanner.value = msg
                _isBannerSuccess.value = false
            }
        }
    }

    fun clearBanner() {
        _statusBanner.value = null
    }

    fun resetTopupState() {
        _topupStep.value = TopupStep.Idle
        _statusBanner.value = null
    }
}
