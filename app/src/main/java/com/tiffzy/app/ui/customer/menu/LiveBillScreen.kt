package com.tiffzy.app.ui.customer.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.TableSession
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveBillScreen(
    sessionId: Int,
    onBack: () -> Unit,
    viewModel: LiveBillViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(sessionId) {
        viewModel.loadBill(sessionId)
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Live Bill",
                subtitle = "Active Table Session",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            when (val state = uiState) {
                is LiveBillUiState.Loading -> TiffzyLoadingIndicator()
                is LiveBillUiState.Error -> TiffzyErrorState(message = state.message, onRetry = { viewModel.loadBill(sessionId) })
                is LiveBillUiState.Success -> {
                    BillContent(session = state.session)
                }
                else -> {}
            }
        }
    }
}

@Composable
fun BillContent(session: TableSession) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(Dimens.PaddingLarge)
    ) {
        item {
            TableInfoCard(session)
            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
            
            Text(
                text = "ORDERED ITEMS",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 2.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        }

        items(session.items) { item ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = item.itemName, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                    Text(text = "Qty: ${item.qty} x ₹${item.price.toInt()}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(text = "₹${item.total.toInt()}", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Black)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
        }

        item {
            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
            BillSummaryCard(session)
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}

@Composable
fun TableInfoCard(session: TableSession) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f))
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingLarge),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(48.dp).background(MaterialTheme.colorScheme.primary, shape = MaterialTheme.shapes.medium),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Restaurant, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary)
            }
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            Column {
                Text(text = "Table ${session.table?.tableNo ?: "..."}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
                Text(text = "Session #${session.id}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun BillSummaryCard(session: TableSession) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            SummaryRow("Subtotal", "₹${session.subtotal.toInt()}")
            SummaryRow("Taxes (5%)", "₹${session.taxAmount.toInt()}")
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text = "Total Bill", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Black)
                Text(text = "₹${session.total.toInt()}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
fun SummaryRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium)
        Text(text = value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
    }
}
