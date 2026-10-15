package com.tiffzy.app.ui.customer.profile

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.material.icons.filled.Info
import com.tiffzy.app.MainActivity
import com.tiffzy.app.data.model.TopupErrorType
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.CustomerWallet
import com.tiffzy.app.data.model.TopupStep
import com.tiffzy.app.data.model.WalletTransaction
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletBottomSheet(
    walletState: WalletUiState,
    onDismiss: () -> Unit,
    onRefresh: () -> Unit,
    walletViewModel: WalletViewModel = viewModel()
) {
    val topupStep by walletViewModel.topupStep.collectAsState()
    val isAddMoneyVisible by walletViewModel.isAddMoneyVisible.collectAsState()
    val statusBanner by walletViewModel.statusBanner.collectAsState()
    val isBannerSuccess by walletViewModel.isBannerSuccess.collectAsState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        containerColor = MaterialTheme.colorScheme.surface,
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Dimens.PaddingLarge)
                .padding(bottom = 32.dp)
        ) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFF59E0B).copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.AccountBalanceWallet,
                            contentDescription = null,
                            tint = Color(0xFFF59E0B),
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Tiffzy Wallet",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Backed by CustomerAccount",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Row {
                    IconButton(onClick = {
                        onRefresh()
                        walletViewModel.loadWallet()
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = MaterialTheme.colorScheme.primary)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Status Banner (Success, Failure, Cancel, or Processing alert)
            statusBanner?.let { message ->
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (isBannerSuccess) Color(0xFF10B981).copy(alpha = 0.12f) else MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = if (isBannerSuccess) Icons.Default.CheckCircle else Icons.Default.ErrorOutline,
                                contentDescription = null,
                                tint = if (isBannerSuccess) Color(0xFF10B981) else MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = message,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                color = if (isBannerSuccess) Color(0xFF047857) else MaterialTheme.colorScheme.error
                            )
                        }
                        IconButton(
                            onClick = { walletViewModel.clearBanner() },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Dismiss", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            when (walletState) {
                is WalletUiState.Loading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        TiffzyLoadingIndicator()
                    }
                }
                is WalletUiState.Error -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = walletState.message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(onClick = {
                            onRefresh()
                            walletViewModel.loadWallet()
                        }) {
                            Text("Retry")
                        }
                    }
                }
                is WalletUiState.Success -> {
                    WalletSuccessContent(
                        wallet = walletState.wallet,
                        transactions = walletState.transactions,
                        onAddMoneyClick = { walletViewModel.openAddMoney() }
                    )
                }
                WalletUiState.Idle -> {
                    // Trigger refresh if idle
                    onRefresh()
                    walletViewModel.loadWallet()
                }
            }
        }
    }

    // Add Money Dialog / Sub-Sheet
    if (isAddMoneyVisible) {
        AddMoneyDialog(
            viewModel = walletViewModel,
            onDismiss = { walletViewModel.dismissAddMoney() },
            onSuccessfulTopup = {
                onRefresh()
                walletViewModel.loadWallet()
            }
        )
    }
}

@Composable
private fun WalletSuccessContent(
    wallet: CustomerWallet,
    transactions: List<WalletTransaction>,
    onAddMoneyClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "CURRENT BALANCE",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = "₹${"%.2f".format(wallet.balance)}",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = if (wallet.status == "ACTIVE") Color(0xFF10B981).copy(alpha = 0.15f) else MaterialTheme.colorScheme.errorContainer,
                        modifier = Modifier.padding(bottom = 6.dp)
                    ) {
                        Text(
                            text = wallet.status ?: "ACTIVE",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (wallet.status == "ACTIVE") Color(0xFF10B981) else MaterialTheme.colorScheme.error,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Compact [+ ADD MONEY] button
            Button(
                onClick = onAddMoneyClick,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                ),
                contentPadding = PaddingValues(vertical = 12.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "ADD MONEY",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    letterSpacing = 0.5.sp
                )
            }
        }
    }

    Spacer(modifier = Modifier.height(20.dp))

    Text(
        text = "RECENT TRANSACTIONS",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.sp
    )

    Spacer(modifier = Modifier.height(8.dp))

    if (transactions.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Default.AccountBalanceWallet,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "No wallet transactions yet",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 300.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(transactions, key = { it.id }) { txn ->
                WalletTransactionItem(txn = txn)
            }
        }
    }
}

@Composable
fun AddMoneyDialog(
    viewModel: WalletViewModel,
    onDismiss: () -> Unit,
    onSuccessfulTopup: () -> Unit
) {
    val context = LocalContext.current
    val topupStep by viewModel.topupStep.collectAsState()
    val amountText by viewModel.topupAmountText.collectAsState()
    val isProcessing = viewModel.isProcessing()

    val quickAmounts = listOf(100, 250, 500, 1000, 2000)

    val (isValidAmount, validationError) = remember(amountText) {
        viewModel.validateAmount(amountText)
    }

    val numericAmount = amountText.toDoubleOrNull()

    // Clear any previous error whenever Add Money dialog is opened/composed
    LaunchedEffect(Unit) {
        viewModel.resetTopupState()
    }

    // Listen for top-up success to trigger dismiss and refresh
    LaunchedEffect(topupStep) {
        if (topupStep is TopupStep.Success) {
            onSuccessfulTopup()
        }
    }

    Dialog(
        onDismissRequest = {
            if (!isProcessing) {
                onDismiss()
            }
        },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 24.dp)
                .wrapContentHeight(),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Add Money",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Minimum ₹10 • Maximum ₹50,000",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(
                        onClick = onDismiss,
                        enabled = !isProcessing
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Select Amount Section
                Text(
                    text = "Select Amount",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))

                // Quick amount chips (Row 1: 100, 250, 500; Row 2: 1000, 2000)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        quickAmounts.take(3).forEach { amt ->
                            val isSelected = amountText == amt.toString()
                            QuickAmountChip(
                                amount = amt,
                                isSelected = isSelected,
                                enabled = !isProcessing,
                                onClick = { viewModel.setTopupAmount(amt) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        quickAmounts.drop(3).forEach { amt ->
                            val isSelected = amountText == amt.toString()
                            QuickAmountChip(
                                amount = amt,
                                isSelected = isSelected,
                                enabled = !isProcessing,
                                onClick = { viewModel.setTopupAmount(amt) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        // Spacer to align row
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Manual Amount Input
                Text(
                    text = "Amount",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(6.dp))

                OutlinedTextField(
                    value = amountText,
                    onValueChange = { input ->
                        if (!isProcessing) {
                            // Filter input: allow numbers and single dot
                            val filtered = input.filter { it.isDigit() || it == '.' }
                            if (filtered.count { it == '.' } <= 1) {
                                viewModel.setTopupAmount(filtered)
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    prefix = {
                        Text(
                            text = "₹ ",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    },
                    placeholder = { Text("Enter amount") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(12.dp),
                    isError = amountText.isNotBlank() && !isValidAmount,
                    supportingText = {
                        if (amountText.isNotBlank() && !isValidAmount && validationError != null) {
                            Text(text = validationError, color = MaterialTheme.colorScheme.error)
                        }
                    },
                    enabled = !isProcessing
                )

                // Error Message Display
                if (topupStep is TopupStep.Error) {
                    val error = topupStep as TopupStep.Error
                    val errMsg = error.message
                    val isPending = error.errorType == TopupErrorType.TOPUP_VERIFY_FAILED

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (isPending) MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.4f)
                                else MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (isPending) Icons.Default.Info else Icons.Default.ErrorOutline,
                                contentDescription = null,
                                tint = if (isPending) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = errMsg,
                                style = MaterialTheme.typography.bodySmall,
                                color = if (isPending) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }

                // Loading State Feedback
                if (isProcessing) {
                    val loadingMessage = when (topupStep) {
                        is TopupStep.CreatingSession -> "Creating payment session..."
                        is TopupStep.OpeningPayment -> "Opening Cashfree payment..."
                        is TopupStep.VerifyingPayment -> "Verifying payment with backend..."
                        else -> "Processing payment..."
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = loadingMessage,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Primary Add Money Button
                Button(
                    onClick = {
                        val activity = context.findActivity() ?: MainActivity.getInstance()
                        if (activity != null) {
                            viewModel.initiateTopup(activity)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    enabled = isValidAmount && !isProcessing,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        val btnText = if (numericAmount != null && numericAmount > 0) {
                            "Add ₹${"%.0f".format(numericAmount)}"
                        } else {
                            "Add Money"
                        }
                        Text(
                            text = btnText,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Security Badges
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Bolt,
                        contentDescription = null,
                        tint = Color(0xFF10B981),
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Instant credit after payment",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Secure payment via Cashfree",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickAmountChip(
    amount: Int,
    isSelected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val borderColor = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
    val containerColor = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
    val textColor = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface

    Surface(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .border(1.dp, borderColor, RoundedCornerShape(10.dp))
            .clickable(enabled = enabled, onClick = onClick),
        color = containerColor,
        shape = RoundedCornerShape(10.dp)
    ) {
        Box(
            modifier = Modifier.padding(vertical = 10.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "₹${"%,d".format(amount)}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                color = textColor,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun WalletTransactionItem(txn: WalletTransaction) {
    val isCredit = txn.direction.equals("CREDIT", ignoreCase = true)
    val color = if (isCredit) Color(0xFF10B981) else Color(0xFFEF4444)
    val icon = if (isCredit) Icons.Default.ArrowDownward else Icons.Default.ArrowUpward

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(color.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = color,
                        modifier = Modifier.size(18.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = formatTxnType(txn.type),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!txn.description.isNullOrBlank()) {
                        Text(
                            text = txn.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    val dateStr = txn.createdAt?.substringBefore("T") ?: ""
                    if (dateStr.isNotEmpty()) {
                        Text(
                            text = dateStr,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${if (isCredit) "+" else "-"}₹${"%.2f".format(txn.amount)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = color
                )
                Text(
                    text = "Bal: ₹${"%.0f".format(txn.balanceAfter)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

private fun formatTxnType(type: String): String {
    return when (type.uppercase()) {
        "WALLET_TOPUP" -> "Wallet Top-up"
        "ORDER_PAYMENT" -> "Order Payment"
        "REFUND" -> "Refund"
        "REVERSAL" -> "Reversal"
        "ADJUSTMENT_CREDIT" -> "Admin Credit"
        "ADJUSTMENT_DEBIT" -> "Admin Debit"
        else -> type.replace("_", " ").lowercase().replaceFirstChar { it.uppercase() }
    }
}


private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
