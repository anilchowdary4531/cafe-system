package com.tiffzy.app.ui.payment

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.cashfree.pg.api.CFPaymentGatewayService
import com.cashfree.pg.core.api.CFSession
import com.cashfree.pg.core.api.callback.CFCheckoutResponseCallback
import com.cashfree.pg.core.api.exception.CFException
import com.cashfree.pg.core.api.utils.CFErrorResponse
import com.cashfree.pg.core.api.webcheckout.CFWebCheckoutPayment
import com.tiffzy.app.data.model.PaymentResultStatus
import com.tiffzy.app.data.model.TwmReturnVerifyRequest
import com.tiffzy.app.ui.theme.TiffzyAppTheme

class PaymentActivity : AppCompatActivity(), CFCheckoutResponseCallback {

    private val viewModel: PaymentViewModel by viewModels()

    private var currentOrderId: String = ""
    private var currentAmount: Double = 0.0
    private var envMode: String = "PRODUCTION"
    private var paymentProvider: String = "CASHFREE"

    private var customerId: String? = null
    private var customerPhone: String? = null
    private var customerName: String? = null
    private var customerEmail: String? = null
    private var restaurantId: String? = null

    private var lastSessionId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Read intent extras
        currentOrderId = intent.getStringExtra(EXTRA_ORDER_ID) ?: ""
        currentAmount = intent.getDoubleExtra(EXTRA_AMOUNT, 0.0)
        envMode = intent.getStringExtra(EXTRA_ENV) ?: "PRODUCTION"
        paymentProvider = intent.getStringExtra(EXTRA_PAYMENT_PROVIDER) ?: "CASHFREE"

        customerId = intent.getStringExtra(EXTRA_CUSTOMER_ID)
        customerPhone = intent.getStringExtra(EXTRA_CUSTOMER_PHONE)
        customerName = intent.getStringExtra(EXTRA_CUSTOMER_NAME)
        customerEmail = intent.getStringExtra(EXTRA_CUSTOMER_EMAIL)
        restaurantId = intent.getStringExtra(EXTRA_RESTAURANT_ID)

        if (!paymentProvider.uppercase().contains("TWM")) {
            try {
                CFPaymentGatewayService.getInstance().setCheckoutCallback(this)
            } catch (e: Exception) {
                Log.e("CASHFREE_DEBUG", "Failed to set callback: ${e.message}")
            }
        }

        if (savedInstanceState == null && currentOrderId.isNotBlank() && currentAmount > 0) {
            viewModel.fetchPaymentSession(
                orderId = currentOrderId,
                amount = currentAmount,
                customerId = customerId,
                customerPhone = customerPhone,
                customerName = customerName,
                customerEmail = customerEmail,
                restaurantId = restaurantId,
                paymentProvider = paymentProvider
            )
        }

        setContent {
            TiffzyAppTheme {
                val uiState by viewModel.uiState.collectAsState()

                val navigateToOrderSuccess: () -> Unit = {
                    com.tiffzy.app.data.repository.CartRepository.getInstance().clearCart()
                    val successIntent = Intent(this@PaymentActivity, com.tiffzy.app.MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        putExtra("payment_success", true)
                        putExtra("order_id", uiState.orderId ?: currentOrderId)
                    }
                    startActivity(successIntent)
                    finish()
                }

                LaunchedEffect(uiState.status) {
                    if (uiState.status == PaymentResultStatus.SUCCESS) {
                        com.tiffzy.app.data.repository.CartRepository.getInstance().clearCart()
                    }
                }

                BackHandler(enabled = uiState.status == PaymentResultStatus.SUCCESS) {
                    navigateToOrderSuccess()
                }

                // Launch Cashfree Checkout once session is generated
                LaunchedEffect(uiState.paymentSessionId, uiState.status) {
                    val sessionId = uiState.paymentSessionId
                    if (uiState.provider == "CASHFREE" &&
                        uiState.status == PaymentResultStatus.SESSION_CREATED &&
                        !sessionId.isNullOrBlank() &&
                        sessionId != lastSessionId
                    ) {
                        lastSessionId = sessionId
                        val targetOrderId = uiState.orderId ?: currentOrderId

                        kotlinx.coroutines.delay(500)
                        Log.d("CASHFREE_DEBUG", "Launching checkout for Order: $targetOrderId (IsProd: ${uiState.isProduction})")
                        startCashfreeCheckout(sessionId, targetOrderId, uiState.isProduction)
                    }
                }

                PaymentScreen(
                    uiState = uiState,
                    onBackClick = {
                        if (uiState.status == PaymentResultStatus.SUCCESS) {
                            navigateToOrderSuccess()
                        } else if (uiState.provider == "TWM_PAY" &&
                            uiState.status == PaymentResultStatus.HOSTED_CHECKOUT_READY
                        ) {
                            viewModel.reconcileTwmStatus(pollIfPending = false)
                        } else {
                            finish()
                        }
                    },
                    onRetryClick = {
                        lastSessionId = null
                        viewModel.fetchPaymentSession(
                            orderId = currentOrderId,
                            amount = currentAmount,
                            customerId = customerId,
                            customerPhone = customerPhone,
                            customerName = customerName,
                            customerEmail = customerEmail,
                            restaurantId = restaurantId,
                            paymentProvider = paymentProvider,
                            forceFreshNonce = true
                        )
                    },
                    onManualOpenClick = {
                        uiState.paymentSessionId?.let {
                            val targetOrderId = uiState.orderId ?: currentOrderId
                            startCashfreeCheckout(it, targetOrderId, uiState.isProduction)
                        }
                    },
                    onRefreshStatusClick = {
                        if (uiState.provider == "TWM_PAY") {
                            viewModel.reconcileTwmStatus()
                        } else {
                            viewModel.verifyPaymentWithBackend(uiState.orderId ?: currentOrderId)
                        }
                    },
                    onTwmReturnIntercepted = { request ->
                        viewModel.verifyTwmReturn(request)
                    },
                    onTwmReturnFallbackCheck = {
                        viewModel.reconcileTwmStatus()
                    },
                    onExternalUpiLaunch = { url ->
                        launchExternalUpiApp(url)
                    },
                    onDoneClick = {
                        if (uiState.status == PaymentResultStatus.SUCCESS) {
                            navigateToOrderSuccess()
                        } else if (uiState.provider == "TWM_PAY") {
                            viewModel.reconcileTwmStatus()
                            return@PaymentScreen
                        } else {
                            viewModel.verifyPaymentWithBackend(uiState.orderId ?: currentOrderId)
                            finish()
                        }
                    }
                )
            }
        }
    }

    private fun launchExternalUpiApp(url: String) {
        try {
            val intent = if (url.startsWith("intent://", ignoreCase = true)) {
                Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
            } else {
                Intent(Intent.ACTION_VIEW, Uri.parse(url))
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.w("TWM_PAY_DEBUG", "Unable to open external UPI app for URL: ${e.message}")
            Toast.makeText(
                this,
                "No UPI app found to open this payment link directly. You can scan/pay inside checkout.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun startCashfreeCheckout(sessionId: String, orderId: String, isProduction: Boolean = false) {
        val trimmedSession = sessionId.trim()

        Log.d("CASHFREE_DEBUG", "startCashfreeCheckout: orderId=$orderId, sessionLength=${trimmedSession.length}, isProdParam=$isProduction, intentEnv=$envMode")

        if (trimmedSession.isBlank() || trimmedSession == "null") {
            Toast.makeText(this, "Error: Payment session token is empty", Toast.LENGTH_LONG).show()
            viewModel.handlePaymentResult(PaymentResultStatus.FAILED, orderId, message = "Token empty")
            return
        }

        try {
            val environment = if (isProduction) {
                CFSession.Environment.PRODUCTION
            } else {
                CFSession.Environment.SANDBOX
            }

            val cfSession = CFSession.CFSessionBuilder()
                .setEnvironment(environment)
                .setPaymentSessionID(trimmedSession)
                .setOrderId(orderId)
                .build()

            val cfWebCheckoutPayment = CFWebCheckoutPayment.CFWebCheckoutPaymentBuilder()
                .setSession(cfSession)
                .build()

            CFPaymentGatewayService.getInstance().doPayment(this, cfWebCheckoutPayment)
        } catch (e: CFException) {
            Log.e("CASHFREE_DEBUG", "CFException during checkout launch: ${e.message}")
            Toast.makeText(this, "Cashfree SDK: ${e.message}", Toast.LENGTH_LONG).show()
            viewModel.handlePaymentResult(PaymentResultStatus.FAILED, orderId, message = e.message)
        } catch (e: Exception) {
            Log.e("CASHFREE_DEBUG", "General Exception during checkout launch: ${e.message}")
            Toast.makeText(this, "Payment Error: ${e.message}", Toast.LENGTH_LONG).show()
            viewModel.handlePaymentResult(PaymentResultStatus.FAILED, orderId, message = e.message)
        }
    }

    override fun onPaymentVerify(orderId: String) {
        Log.d("CASHFREE_DEBUG", "onPaymentVerify: orderId=$orderId")
        viewModel.handlePaymentResult(
            resultStatus = PaymentResultStatus.SUCCESS,
            orderId = orderId,
            message = "Payment verified successfully"
        )
    }

    override fun onPaymentFailure(cfErrorResponse: CFErrorResponse, orderId: String) {
        val statusName = cfErrorResponse.status ?: "FAILED"
        val message = cfErrorResponse.message ?: "Transaction failed"

        Log.e("CASHFREE_DEBUG", "onPaymentFailure: status=$statusName, message=$message, orderId=$orderId")

        runOnUiThread {
            Toast.makeText(this, "Cashfree: $message ($statusName)", Toast.LENGTH_LONG).show()
        }

        val resultStatus = when {
            statusName.contains("CANCEL", ignoreCase = true) || message.contains("cancel", ignoreCase = true) -> PaymentResultStatus.CANCELLED
            statusName.contains("PENDING", ignoreCase = true) -> PaymentResultStatus.PENDING
            else -> PaymentResultStatus.FAILED
        }

        viewModel.handlePaymentResult(
            resultStatus = resultStatus,
            orderId = orderId,
            message = message
        )
    }

    companion object {
        const val EXTRA_ORDER_ID = "extra_order_id"
        const val EXTRA_AMOUNT = "extra_amount"
        const val EXTRA_CUSTOMER_ID = "extra_customer_id"
        const val EXTRA_CUSTOMER_PHONE = "extra_customer_phone"
        const val EXTRA_CUSTOMER_NAME = "extra_customer_name"
        const val EXTRA_CUSTOMER_EMAIL = "extra_customer_email"
        const val EXTRA_RESTAURANT_ID = "extra_restaurant_id"
        const val EXTRA_ENV = "extra_env"
        const val EXTRA_PAYMENT_PROVIDER = "extra_payment_provider"

        fun start(
            context: Context,
            orderId: String,
            amount: Double,
            customerId: String? = null,
            customerPhone: String? = null,
            customerName: String? = null,
            customerEmail: String? = null,
            restaurantId: String? = null,
            env: String = "PRODUCTION",
            paymentProvider: String = "CASHFREE"
        ) {
            val intent = Intent(context, PaymentActivity::class.java).apply {
                putExtra(EXTRA_ORDER_ID, orderId)
                putExtra(EXTRA_AMOUNT, amount)
                putExtra(EXTRA_CUSTOMER_ID, customerId)
                putExtra(EXTRA_CUSTOMER_PHONE, customerPhone)
                putExtra(EXTRA_CUSTOMER_NAME, customerName)
                putExtra(EXTRA_CUSTOMER_EMAIL, customerEmail)
                putExtra(EXTRA_RESTAURANT_ID, restaurantId)
                putExtra(EXTRA_ENV, env)
                putExtra(EXTRA_PAYMENT_PROVIDER, paymentProvider)
            }
            context.startActivity(intent)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentScreen(
    uiState: PaymentUiState,
    onBackClick: () -> Unit,
    onRetryClick: () -> Unit,
    onManualOpenClick: () -> Unit,
    onRefreshStatusClick: () -> Unit = {},
    onTwmReturnIntercepted: (TwmReturnVerifyRequest) -> Unit = {},
    onTwmReturnFallbackCheck: () -> Unit = {},
    onExternalUpiLaunch: (String) -> Unit = {},
    onDoneClick: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val isTwm = uiState.provider == "TWM_PAY"
    val displayError = uiState.errorMessage ?: if (uiState.status == PaymentResultStatus.CANCELLED) "Payment transaction was cancelled" else null

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (isTwm) "TWM Pay Checkout" else "Cashfree Payment",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(imageVector = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { paddingValues ->
        if (uiState.status == PaymentResultStatus.HOSTED_CHECKOUT_READY && !uiState.checkoutUrl.isNullOrBlank()) {
            TwmHostedCheckoutWebView(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                checkoutUrl = uiState.checkoutUrl,
                returnUrlPrefix = uiState.returnUrlPrefix,
                onExternalUpiLaunch = onExternalUpiLaunch,
                onReturnIntercepted = onTwmReturnIntercepted,
                onReturnFallbackCheck = onTwmReturnFallbackCheck,
                onBackPressed = onBackClick
            )
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Order ID", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(text = uiState.orderId ?: "N/A", fontWeight = FontWeight.SemiBold)
                    }
                    if (!uiState.orderRef.isNullOrBlank()) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(text = "Gateway Ref", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(text = uiState.orderRef, fontWeight = FontWeight.Medium, fontSize = 12.sp)
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Amount Payable", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = "₹${String.format("%.2f", uiState.amount)}",
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 18.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            when (uiState.status) {
                PaymentResultStatus.LOADING -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        Text(
                            text = uiState.txMsg ?: if (isTwm) "Connecting to TWM Pay..." else "Initializing Cashfree...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                PaymentResultStatus.SESSION_CREATED -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        Text(
                            text = "Opening Cashfree Checkout...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Button(onClick = onManualOpenClick) {
                            Text("Open Payment Modal")
                        }
                    }
                }
                PaymentResultStatus.SUCCESS -> {
                    StatusBanner(
                        icon = Icons.Default.CheckCircle,
                        iconTint = Color(0xFF4CAF50),
                        title = "Payment Successful!",
                        subtitle = uiState.txMsg ?: "Your payment has been processed successfully.",
                        backgroundColor = Color(0xFFE8F5E9)
                    )
                    Button(onClick = onDoneClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                        Text(text = "View Order Details")
                    }
                }
                PaymentResultStatus.FAILED, PaymentResultStatus.CANCELLED -> {
                    PaymentFailureScreen(
                        errorMessage = displayError,
                        orderId = uiState.orderId,
                        amount = uiState.amount,
                        onRetryClick = onRetryClick,
                        onChooseOtherPaymentClick = onBackClick,
                        onGoBackClick = onBackClick,
                        onSupportClick = {
                            Toast.makeText(context, "Support requested.", Toast.LENGTH_LONG).show()
                        },
                        isExpired = uiState.gatewayStatus == "EXPIRED",
                        providerName = if (isTwm) "TWM Pay" else "Cashfree"
                    )
                }
                PaymentResultStatus.PENDING -> {
                    val isUtr = uiState.gatewayStatus == "UTR_SUBMITTED"
                    StatusBanner(
                        icon = Icons.Default.HourglassTop,
                        iconTint = Color(0xFFFFB300),
                        title = if (isUtr) "UPI Verification in Progress" else "Payment Pending",
                        subtitle = uiState.txMsg ?: if (isUtr) {
                            "UPI reference received. Waiting for confirmation from TWM Pay..."
                        } else {
                            "Your transaction is pending confirmation."
                        },
                        backgroundColor = Color(0xFFFFF8E1)
                    )
                    Button(onClick = onRefreshStatusClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                        Text(text = "Refresh Payment Status")
                    }
                }
                else -> {
                    Text(text = "Preparing payment...", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TwmHostedCheckoutWebView(
    modifier: Modifier = Modifier,
    checkoutUrl: String,
    returnUrlPrefix: String?,
    onExternalUpiLaunch: (String) -> Unit,
    onReturnIntercepted: (TwmReturnVerifyRequest) -> Unit,
    onReturnFallbackCheck: () -> Unit,
    onBackPressed: () -> Unit
) {
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var pageLoading by remember { mutableStateOf(true) }
    var handledReturn by remember { mutableStateOf(false) }

    BackHandler {
        val wv = webViewRef
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            onBackPressed()
        }
    }

    Box(modifier = modifier) {
        if (!TwmCheckoutUrlHelper.isSafeHttpUrl(checkoutUrl)) {
            Column(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("Invalid checkout URL", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
            }
            return@Box
        }

        val dispatchReturnInterception: (String) -> Unit = { targetUrl ->
            if (!handledReturn) {
                handledReturn = true
                val params = TwmCheckoutUrlHelper.extractTwmReturnParams(targetUrl)
                if (params != null) {
                    onReturnIntercepted(params)
                } else {
                    onReturnFallbackCheck()
                }
            }
        }

        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.loadWithOverviewMode = true
                    settings.useWideViewPort = true
                    settings.allowFileAccess = false

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): Boolean {
                            val targetUrl = request?.url?.toString().orEmpty()
                            if (targetUrl.isBlank()) return false

                            if (TwmCheckoutUrlHelper.isUpiOrExternalScheme(targetUrl)) {
                                onExternalUpiLaunch(targetUrl)
                                return true
                            }

                            if (TwmCheckoutUrlHelper.isTwmReturnUrl(targetUrl, returnUrlPrefix)) {
                                dispatchReturnInterception(targetUrl)
                                return true
                            }

                            return !TwmCheckoutUrlHelper.isSafeHttpUrl(targetUrl)
                        }

                        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                            super.onPageStarted(view, url, favicon)
                            val targetUrl = url.orEmpty()
                            if (targetUrl.isNotBlank() && TwmCheckoutUrlHelper.isTwmReturnUrl(targetUrl, returnUrlPrefix)) {
                                view?.stopLoading()
                                dispatchReturnInterception(targetUrl)
                                return
                            }
                            pageLoading = true
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            pageLoading = false
                        }
                    }

                    webViewRef = this
                    loadUrl(checkoutUrl)
                }
            }
        )

        if (pageLoading) {
            LinearProgressIndicator(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
            )
        }
    }
}

@Composable
fun StatusBanner(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    title: String,
    subtitle: String,
    backgroundColor: Color
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(24.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(56.dp))
            Text(text = title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.Black)
            Text(text = subtitle, fontSize = 14.sp, color = Color.DarkGray, textAlign = TextAlign.Center)
        }
    }
}
