package com.tiffzy.app.ui.payment

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cashfree.pg.api.CFPaymentGatewayService
import com.cashfree.pg.core.api.CFSession
import com.cashfree.pg.core.api.callback.CFCheckoutResponseCallback
import com.cashfree.pg.core.api.exception.CFException
import com.cashfree.pg.core.api.utils.CFErrorResponse
import com.cashfree.pg.core.api.webcheckout.CFWebCheckoutPayment
import com.tiffzy.app.data.model.PaymentResultStatus
import com.tiffzy.app.ui.theme.TiffzyAppTheme

class PaymentActivity : ComponentActivity(), CFCheckoutResponseCallback {

    private val viewModel: PaymentViewModel by viewModels()

    private var currentOrderId: String = ""
    private var currentAmount: Double = 0.0
    private var envMode: String = "TEST"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Register Cashfree Checkout Callback
        try {
            CFPaymentGatewayService.getInstance().setCheckoutCallback(this)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Read intent extras
        currentOrderId = intent.getStringExtra(EXTRA_ORDER_ID) ?: ""
        currentAmount = intent.getDoubleExtra(EXTRA_AMOUNT, 0.0)
        envMode = intent.getStringExtra(EXTRA_ENV) ?: "TEST"

        val customerId = intent.getStringExtra(EXTRA_CUSTOMER_ID)
        val customerPhone = intent.getStringExtra(EXTRA_CUSTOMER_PHONE)
        val customerName = intent.getStringExtra(EXTRA_CUSTOMER_NAME)
        val customerEmail = intent.getStringExtra(EXTRA_CUSTOMER_EMAIL)
        val restaurantId = intent.getStringExtra(EXTRA_RESTAURANT_ID)

        if (savedInstanceState == null && currentOrderId.isNotBlank() && currentAmount > 0) {
            viewModel.fetchPaymentSession(
                orderId = currentOrderId,
                amount = currentAmount,
                customerId = customerId,
                customerPhone = customerPhone,
                customerName = customerName,
                customerEmail = customerEmail,
                restaurantId = restaurantId
            )
        }

        setContent {
            TiffzyAppTheme {
                val uiState by viewModel.uiState.collectAsState()

                // Launch Cashfree Checkout once session is generated
                LaunchedEffect(uiState.status, uiState.paymentSessionId) {
                    if (uiState.status == PaymentResultStatus.SESSION_CREATED && !uiState.paymentSessionId.isNull_or_blank()) {
                        startCashfreeCheckout(uiState.paymentSessionId!!, uiState.orderId ?: currentOrderId)
                    }
                }

                PaymentScreen(
                    uiState = uiState,
                    onBackClick = { finish() },
                    onRetryClick = {
                        viewModel.fetchPaymentSession(
                            orderId = currentOrderId,
                            amount = currentAmount,
                            customerId = customerId,
                            customerPhone = customerPhone,
                            customerName = customerName,
                            customerEmail = customerEmail,
                            restaurantId = restaurantId
                        )
                    },
                    onDoneClick = { finish() }
                )
            }
        }
    }

    private fun startCashfreeCheckout(sessionId: String, orderId: String) {
        try {
            val environment = if (envMode.equals("PRODUCTION", ignoreCase = true)) {
                CFSession.Environment.PRODUCTION
            } else {
                CFSession.Environment.SANDBOX
            }

            val cfSession = CFSession.CFSessionBuilder()
                .setEnvironment(environment)
                .setPaymentSessionID(sessionId)
                .setOrderId(orderId)
                .build()

            val cfWebCheckoutPayment = CFWebCheckoutPayment.CFWebCheckoutPaymentBuilder()
                .setSession(cfSession)
                .build()

            CFPaymentGatewayService.getInstance().doPayment(this, cfWebCheckoutPayment)
        } catch (e: CFException) {
            e.printStackTrace()
            viewModel.handlePaymentResult(
                resultStatus = PaymentResultStatus.FAILED,
                orderId = orderId,
                message = e.message ?: "Cashfree SDK launch failed"
            )
        } catch (e: Exception) {
            e.printStackTrace()
            viewModel.handlePaymentResult(
                resultStatus = PaymentResultStatus.FAILED,
                orderId = orderId,
                message = e.message ?: "Failed to initiate payment"
            )
        }
    }

    // Cashfree Checkout Callback: Payment Success
    override fun onPaymentVerify(orderId: String) {
        viewModel.handlePaymentResult(
            resultStatus = PaymentResultStatus.SUCCESS,
            orderId = orderId,
            message = "Payment verified successfully"
        )
    }

    // Cashfree Checkout Callback: Payment Failure / Cancellation / Pending
    override fun onPaymentFailure(cfErrorResponse: CFErrorResponse, orderId: String) {
        val statusName = cfErrorResponse.status ?: ""
        val message = cfErrorResponse.message ?: "Payment transaction failed"

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

    private fun String?.isNull_or_blank(): Boolean {
        return this == null || this.isBlank()
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

        fun start(
            context: Context,
            orderId: String,
            amount: Double,
            customerId: String? = null,
            customerPhone: String? = null,
            customerName: String? = null,
            customerEmail: String? = null,
            restaurantId: String? = null,
            env: String = "TEST"
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
    onDoneClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Cashfree Payment",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {

            // Summary Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Order Details",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Divider()
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Order ID", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = uiState.orderId ?: "N/A",
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
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

            // State Banners
            when (uiState.status) {
                PaymentResultStatus.LOADING -> {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        Text(
                            text = "Initializing Cashfree Payment Gateway...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                PaymentResultStatus.SESSION_CREATED -> {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        Text(
                            text = "Opening Cashfree Checkout...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
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

                    Button(
                        onClick = onDoneClick,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(text = "Done")
                    }
                }

                PaymentResultStatus.FAILED, PaymentResultStatus.CANCELLED -> {
                    val context = androidx.compose.ui.platform.LocalContext.current
                    PaymentFailureScreen(
                        errorMessage = uiState.errorMessage ?: if (uiState.status == PaymentResultStatus.CANCELLED) "Payment transaction was cancelled" else null,
                        orderId = uiState.orderId,
                        amount = uiState.amount,
                        onRetryClick = onRetryClick,
                        onChooseOtherPaymentClick = onBackClick,
                        onGoBackClick = onBackClick,
                        onSupportClick = {
                            Toast.makeText(context, "Support requested. Contacting Tiffzy Helpdesk...", Toast.LENGTH_LONG).show()
                        }
                    )
                }

                PaymentResultStatus.PENDING -> {
                    StatusBanner(
                        icon = Icons.Default.HourglassTop,
                        iconTint = Color(0xFFFFB300),
                        title = "Payment Pending",
                        subtitle = "Your transaction is pending confirmation from Cashfree.",
                        backgroundColor = Color(0xFFFFF8E1)
                    )

                    Button(
                        onClick = onDoneClick,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(text = "Check Order Status")
                    }
                }

                PaymentResultStatus.IDLE -> {
                    Text(
                        text = "Preparing payment...",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
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
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconTint,
                modifier = Modifier.size(56.dp)
            )
            Text(
                text = title,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            Text(
                text = subtitle,
                fontSize = 14.sp,
                color = Color.DarkGray,
                textAlign = TextAlign.Center
            )
        }
    }
}
