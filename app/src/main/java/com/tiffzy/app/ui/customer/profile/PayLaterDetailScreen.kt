package com.tiffzy.app.ui.customer.profile

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.PayLaterAccountDetails
import com.tiffzy.app.data.model.PayLaterTransaction
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PayLaterDetailScreen(
    accountId: Int,
    onBack: () -> Unit,
    viewModel: PayLaterViewModel = viewModel()
) {
    val detailsState by viewModel.detailsState.collectAsState()

    LaunchedEffect(accountId) {
        viewModel.loadDetails(accountId)
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Khata Ledger",
                subtitle = "Transaction History",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (val state = detailsState) {
                is PayLaterDetailsUiState.Loading -> TiffzyLoadingIndicator()
                is PayLaterDetailsUiState.Error -> TiffzyErrorState(message = state.message, onRetry = { viewModel.loadDetails(accountId) })
                is PayLaterDetailsUiState.Success -> {
                    PayLaterDetailContent(
                        account = state.account,
                        onRepayClick = { /* TODO: Implement repayment flow */ }
                    )
                }
                else -> {}
            }
        }
    }
}

@Composable
fun PayLaterDetailContent(
    account: PayLaterAccountDetails,
    onRepayClick: (Double) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(Dimens.PaddingLarge)
    ) {
        item {
            DigitalKhataPass(account = account, onRepayClick = onRepayClick)
            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
            
            PayLaterMetricsGrid(account = account)
            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
            
            Text(
                text = "TRANSACTION LEDGER",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 2.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        }

        if (account.transactions.isEmpty()) {
            item {
                TiffzyEmptyState(message = "No transactions found in this ledger.")
            }
        } else {
            items(account.transactions) { transaction ->
                TransactionLedgerItem(transaction = transaction)
                Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
            }
        }
        
        item {
            Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
            PayLaterInfoSection()
            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
        }
    }
}

@Composable
fun DigitalKhataPass(account: PayLaterAccountDetails, onRepayClick: (Double) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A1A)) // Dark background for the "pass"
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(Color(0xFF2D2D2D), Color(0xFF1A1A1A))
                    )
                )
                .padding(Dimens.PaddingLarge)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = Color(0xFFF59E0B).copy(alpha = 0.2f),
                    shape = MaterialTheme.shapes.small,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.3f))
                ) {
                    Text(
                        text = "DIGITAL KHATA PASS",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Black,
                        color = Color(0xFFF59E0B),
                        letterSpacing = 1.sp
                    )
                }
                Text(
                    text = "ID: #${account.accountId}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.5f)
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Text(
                text = account.restaurantName,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Black,
                color = Color.White
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.Black.copy(alpha = 0.4f)),
                shape = MaterialTheme.shapes.large
            ) {
                Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
                    Text(
                        text = "OUTSTANDING BALANCE",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFFF59E0B),
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "₹${"%.2f".format(account.pendingBalance)}",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Black,
                        color = Color(0xFFFCD34D)
                    )
                    
                    if (account.pendingBalance > 0) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { onRepayClick(account.pendingBalance) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B)),
                            shape = MaterialTheme.shapes.medium
                        ) {
                            Icon(Icons.Default.CreditCard, contentDescription = null, tint = Color.Black)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Pay Outstanding Dues", color = Color.Black, fontWeight = FontWeight.Bold)
                        }

                        // Quick Pay Chips
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (account.pendingBalance >= 100) {
                                QuickPayChip(label = "₹100", onClick = { onRepayClick(100.0) })
                            }
                            if (account.pendingBalance >= 250) {
                                QuickPayChip(label = "₹250", onClick = { onRepayClick(250.0) })
                            }
                            if (account.pendingBalance >= 500) {
                                QuickPayChip(label = "₹500", onClick = { onRepayClick(500.0) })
                            }
                        }
                    } else {
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF10B981).copy(alpha = 0.1f), shape = MaterialTheme.shapes.medium)
                                .border(1.dp, Color(0xFF10B981).copy(alpha = 0.2f), shape = MaterialTheme.shapes.medium)
                                .padding(8.dp)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("All Dues Cleared!", color = Color(0xFF10B981), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun QuickPayChip(label: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = Color.White.copy(alpha = 0.1f),
        shape = MaterialTheme.shapes.small,
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.2f))
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
    }
}

@Composable
fun PayLaterMetricsGrid(account: PayLaterAccountDetails) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingSmall)
    ) {
        MetricCard(
            modifier = Modifier.weight(1f),
            label = "PENDING",
            value = "₹${account.pendingBalance.toInt()}",
            color = Color(0xFFF59E0B)
        )
        MetricCard(
            modifier = Modifier.weight(1f),
            label = "BORROWED",
            value = "₹${account.totalBorrowed.toInt()}",
            color = Color(0xFFEF4444)
        )
        MetricCard(
            modifier = Modifier.weight(1f),
            label = "REPAID",
            value = "₹${account.totalPaid.toInt()}",
            color = Color(0xFF10B981)
        )
    }
}

@Composable
fun MetricCard(modifier: Modifier = Modifier, label: String, value: String, color: Color) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
        shape = MaterialTheme.shapes.large
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Black,
                color = color
            )
        }
    }
}

@Composable
fun TransactionLedgerItem(transaction: PayLaterTransaction) {
    var expanded by remember { mutableStateOf(false) }
    val isRepayment = transaction.type.contains("REPAYMENT")

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f)),
        shape = MaterialTheme.shapes.large
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Surface(
                        color = (if (isRepayment) Color(0xFF10B981) else Color(0xFFEF4444)).copy(alpha = 0.1f),
                        shape = MaterialTheme.shapes.small,
                        border = androidx.compose.foundation.BorderStroke(1.dp, (if (isRepayment) Color(0xFF10B981) else Color(0xFFEF4444)).copy(alpha = 0.2f))
                    ) {
                        Text(
                            text = transaction.type.replace("_", " "),
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Black,
                            fontSize = 9.sp,
                            color = if (isRepayment) Color(0xFF10B981) else Color(0xFFF87171)
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(4.dp))
                    
                    Text(
                        text = transaction.description ?: (if (isRepayment) "Khata Repayment" else "Food Purchase"),
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Text(
                        text = transaction.createdAt.substringBefore("T"),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "${if (isRepayment) "-" else "+"}₹${"%.2f".format(transaction.amount)}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Black,
                        color = if (isRepayment) Color(0xFF10B981) else Color(0xFFF59E0B)
                    )
                    
                    if (transaction.order != null) {
                        TextButton(
                            onClick = { expanded = !expanded },
                            contentPadding = PaddingValues(0.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text(
                                text = if (expanded) "Hide Items" else "View Items",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Icon(
                                if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
            
            AnimatedVisibility(visible = expanded) {
                transaction.order?.let { order ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = Dimens.SpacingMedium)
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f), shape = MaterialTheme.shapes.medium)
                            .padding(Dimens.PaddingSmall)
                    ) {
                        Text(
                            text = "Order #${order.orderNo}",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 4.dp)
                        )
                        order.items.forEach { item ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "${item.itemName} x${item.qty}",
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    text = "₹${(item.price * item.qty).toInt()}",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

