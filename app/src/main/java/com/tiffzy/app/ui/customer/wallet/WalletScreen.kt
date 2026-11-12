package com.tiffzy.app.ui.customer.wallet

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.TopupStep
import com.tiffzy.app.data.model.WalletTransaction
import com.tiffzy.app.data.model.resolvedCheckoutUrl
import com.tiffzy.app.data.model.resolvedGatewayOrderId
import com.tiffzy.app.data.model.resolvedTopupTxnId
import com.tiffzy.app.ui.payment.TwmHostedCheckoutWebView
import com.tiffzy.app.ui.theme.TiffzyPrimary


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(
    onNavigateBack: () -> Unit = {},
    viewModel: WalletViewModel = viewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    var showTopupDialog by remember { mutableStateOf(false) }
    var customAmountText by remember { mutableStateOf("") }
    var activeTwmCheckout by remember { mutableStateOf<TopupStep.TwmCheckout?>(null) }
    var statusNotice by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tiffzy Wallet", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadWalletData() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val state = uiState) {
                is WalletUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is WalletUiState.Error -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color.Red, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(state.message, color = Color.Red)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadWalletData() }) {
                            Text("Retry")
                        }
                    }
                }
                is WalletUiState.Success -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        item {
                            // Wallet Card Banner
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = TiffzyPrimary)
                            ) {
                                Column(
                                    modifier = Modifier.padding(20.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("Co-branded PPI Wallet", color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp)
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = Color.White.copy(alpha = 0.2f)
                                        ) {
                                            Text(
                                                text = "Cashfree PPI",
                                                color = Color.White,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))

                                    Text("Available Balance", color = Color.White.copy(alpha = 0.9f), fontSize = 14.sp)
                                    Text(
                                        text = "₹${String.format("%.2f", state.summary.balance)}",
                                        color = Color.White,
                                        fontSize = 32.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )

                                    Spacer(modifier = Modifier.height(16.dp))

                                    Button(
                                        onClick = { showTopupDialog = true },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = TiffzyPrimary),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Icon(Icons.Default.Add, contentDescription = null)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Add Money to Wallet", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        item {
                            Text(
                                text = "Transaction History",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }

                        if (state.transactions.isEmpty()) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(32.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("No wallet transactions yet.", color = Color.Gray)
                                }
                            }
                        } else {
                            items(state.transactions) { item ->
                                TransactionRow(item)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showTopupDialog) {
        AlertDialog(
            onDismissRequest = { showTopupDialog = false },
            title = { Text("Add Money to Wallet") },
            text = {
                Column {
                    Text("Select or enter top-up amount:", fontSize = 14.sp, color = Color.Gray)
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        listOf(100.0, 500.0, 1000.0, 2000.0).forEach { preset ->
                            OutlinedButton(
                                onClick = { customAmountText = preset.toInt().toString() },
                                modifier = Modifier.weight(1f).padding(4.dp),
                                contentPadding = PaddingValues(4.dp)
                            ) {
                                Text("₹${preset.toInt()}")
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = customAmountText,
                        onValueChange = { customAmountText = it },
                        label = { Text("Amount (₹)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amt = customAmountText.toDoubleOrNull()
                        if (amt != null && amt >= 10.0) {
                            showTopupDialog = false
                            viewModel.initiateTopup(amt, provider = "TWM_PAY") { response ->
                                val checkoutUrl = response.resolvedCheckoutUrl
                                val txnId = response.resolvedTopupTxnId
                                val orderRef = response.resolvedGatewayOrderId ?: txnId
                                if (!checkoutUrl.isNullOrBlank() && !txnId.isNullOrBlank()) {
                                    activeTwmCheckout = TopupStep.TwmCheckout(
                                        topupTxnId = txnId,
                                        orderRef = orderRef ?: txnId,
                                        checkoutUrl = checkoutUrl,
                                        amount = amt,
                                        returnUrlPrefix = "https://tiffzy.com/profile/wallet"
                                    )
                                }
                            }
                        }
                    }
                ) {
                    Text("Proceed")
                }
            },
            dismissButton = {
                TextButton(onClick = { showTopupDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    activeTwmCheckout?.let { twm ->
        Dialog(
            onDismissRequest = {
                viewModel.checkTwmStatus(twm.topupTxnId, twm.orderRef) { res ->
                    statusNotice = res.message
                    activeTwmCheckout = null
                }
            },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Surface(modifier = Modifier.fillMaxSize()) {
                Column(modifier = Modifier.fillMaxSize()) {
                    TwmHostedCheckoutWebView(
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        checkoutUrl = twm.checkoutUrl,
                        returnUrlPrefix = twm.returnUrlPrefix,
                        onExternalUpiLaunch = { targetUrl ->
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl))
                                context.startActivity(Intent.createChooser(intent, "Complete UPI Payment"))
                            } catch (_: Exception) {
                                Toast.makeText(context, "No UPI app found", Toast.LENGTH_SHORT).show()
                            }
                        },
                        onReturnIntercepted = { params ->
                            viewModel.verifyTwmReturn(twm.topupTxnId, twm.orderRef, params) { res ->
                                statusNotice = res.message
                                activeTwmCheckout = null
                                statusNotice?.let { Toast.makeText(context, it, Toast.LENGTH_LONG).show() }
                            }
                        },
                        onReturnFallbackCheck = {
                            viewModel.checkTwmStatus(twm.topupTxnId, twm.orderRef) { res ->
                                statusNotice = res.message
                                activeTwmCheckout = null
                                statusNotice?.let { Toast.makeText(context, it, Toast.LENGTH_LONG).show() }
                            }
                        },
                        onBackPressed = {
                            viewModel.checkTwmStatus(twm.topupTxnId, twm.orderRef) { res ->
                                statusNotice = res.message
                                activeTwmCheckout = null
                            }
                        }
                    )
                    Button(
                        onClick = {
                            viewModel.checkTwmStatus(twm.topupTxnId, twm.orderRef) { res ->
                                statusNotice = res.message
                                activeTwmCheckout = null
                                statusNotice?.let { Toast.makeText(context, it, Toast.LENGTH_LONG).show() }
                            }
                        },
                        modifier = Modifier.fillMaxWidth().padding(16.dp)
                    ) {
                        Text("Check Payment Status")
                    }
                }
            }
        }
    }
}

@Composable
fun TransactionRow(item: WalletTransaction) {
    val isCredit = item.direction.equals("CREDIT", ignoreCase = true)
    val statusColor = if (isCredit) Color(0xFF2E7D32) else Color(0xFFC62828)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = statusColor.copy(alpha = 0.1f),
                    modifier = Modifier.size(40.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = if (isCredit) Icons.Default.ArrowDownward else Icons.Default.ArrowUpward,
                            contentDescription = null,
                            tint = statusColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = item.description ?: item.type,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = item.createdAt?.take(10) ?: "",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }
            }

            Text(
                text = "${if (isCredit) "+" else "-"}₹${String.format("%.2f", item.amount)}",
                fontWeight = FontWeight.Bold,
                color = statusColor,
                fontSize = 16.sp
            )
        }
    }
}
