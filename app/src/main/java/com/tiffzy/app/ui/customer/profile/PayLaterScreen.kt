package com.tiffzy.app.ui.customer.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Shield
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
import com.tiffzy.app.data.model.PayLaterAccount
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PayLaterScreen(
    onAccountClick: (Int) -> Unit,
    onBack: () -> Unit,
    viewModel: PayLaterViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadAccounts()
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Pay Later",
                subtitle = "Digital Khata Accounts",
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
            when (val state = uiState) {
                is PayLaterUiState.Loading -> TiffzyLoadingIndicator()
                is PayLaterUiState.Error -> TiffzyErrorState(message = state.message, onRetry = { viewModel.loadAccounts() })
                is PayLaterUiState.Success -> {
                    PayLaterContent(
                        accounts = state.accounts,
                        onAccountClick = onAccountClick
                    )
                }
                else -> {}
            }
        }
    }
}

@Composable
fun PayLaterContent(
    accounts: List<PayLaterAccount>,
    onAccountClick: (Int) -> Unit
) {
    val totalOutstanding = accounts.sumOf { it.pendingBalance }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 4.dp, vertical = Dimens.PaddingLarge)
    ) {
        // Summary Header
        item {
            PayLaterSummaryCard(totalOutstanding = totalOutstanding, accountCount = accounts.size)
            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
            
            Text(
                text = "DINING KHATA PARTNERS",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 2.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        }

        if (accounts.isEmpty()) {
            item {
                EmptyPayLater(modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp))
            }
        } else {
            items(accounts) { account ->
                PayLaterAccountItem(account = account, onClick = { onAccountClick(account.accountId) })
                Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
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
fun PayLaterSummaryCard(totalOutstanding: Double, accountCount: Int) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f))
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingLarge)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Shield,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "VERIFIED DIGITAL KHATA",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Text(
                text = "Total Outstanding Dues",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Text(
                text = "₹${"%.2f".format(totalOutstanding)}",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Black,
                color = if (totalOutstanding > 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "$accountCount Active Partners",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "0 Overdue",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF4CAF50), // Emerald 500
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun PayLaterAccountItem(account: PayLaterAccount, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(
                        brush = Brush.verticalGradient(listOf(Color(0xFFF59E0B), Color(0xFFEA580C))),
                        shape = MaterialTheme.shapes.medium
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = account.restaurantName.take(1).uppercase(),
                    color = Color.White,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Black
                )
            }
            
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = account.restaurantName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Total Borrowed: ₹${"%.2f".format(account.totalBorrowed)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "PENDING",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "₹${"%.2f".format(account.pendingBalance)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color = if (account.pendingBalance > 0) Color(0xFFF59E0B) else Color(0xFF4CAF50)
                )
            }
            
            Spacer(modifier = Modifier.width(8.dp))
            
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
fun EmptyPayLater(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.CreditCard,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.surfaceVariant
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        Text(
            text = "No Active Credit Accounts",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Khata accounts appear when a restaurant approves credit for you.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
    }
}
