package com.tiffzy.app.ui.payment

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.SettlementOrderItem
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantSettlementScreen(
    restaurantId: Int? = null,
    onBackClick: () -> Unit = {},
    viewModel: RestaurantSettlementViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(restaurantId) {
        viewModel.loadDashboard(restaurantId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Settlement Dashboard",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadDashboard(restaurantId, isRefresh = true) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = Dimens.PaddingMedium),
                verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
            ) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    // Range Filter Selector
                    RangeFilterChips(
                        selectedRange = uiState.range,
                        onSelectRange = { range -> viewModel.setRange(range, restaurantId) }
                    )
                }

                item {
                    // Vendor Info & Status Banner
                    VendorStatusCard(
                        vendorName = uiState.vendorInfo.name.ifBlank { "Tiffzy Partner Restaurant" },
                        vendorId = uiState.vendorInfo.vendorId ?: "vendor_rest_${restaurantId ?: 1}",
                        vendorStatus = uiState.vendorInfo.vendorStatus
                    )
                }

                item {
                    // Financial Metrics Overview Cards
                    MetricsGrid(summary = uiState.summary)
                }

                item {
                    // Earnings & Settlement Visual Bar Chart
                    SettlementVisualChart(summary = uiState.summary)
                }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "PAYMENT TRANSACTIONS (${uiState.totalCount})",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            letterSpacing = 1.sp
                        )

                        val context = androidx.compose.ui.platform.LocalContext.current
                        OutlinedButton(
                            onClick = {
                                android.widget.Toast.makeText(context, "Exporting Settlement Report (CSV/PDF)...", android.widget.Toast.LENGTH_LONG).show()
                            },
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Export Report", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                if (uiState.orders.isEmpty() && !uiState.isLoading) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                        ) {
                            Text(
                                text = "No settlement payments recorded for this time range.",
                                modifier = Modifier.padding(Dimens.PaddingLarge),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    items(uiState.orders) { item ->
                        PaymentLedgerRow(order = item)
                    }

                    if (uiState.currentPage < uiState.totalPages) {
                        item {
                            TextButton(
                                onClick = { viewModel.loadNextPage(restaurantId) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Load More Payments", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(40.dp))
                }
            }

            if (uiState.isLoading) {
                TiffzyLoadingIndicator()
            }
        }
    }
}

@Composable
fun RangeFilterChips(selectedRange: String, onSelectRange: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        listOf("daily" to "Today", "weekly" to "Week", "monthly" to "Month").forEach { (key, label) ->
            val isSelected = selectedRange.equals(key, ignoreCase = true)
            FilterChip(
                selected = isSelected,
                onClick = { onSelectRange(key) },
                label = { Text(label, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
                leadingIcon = if (isSelected) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                } else null
            )
        }
    }
}

@Composable
fun VendorStatusCard(vendorName: String, vendorId: String, vendorStatus: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.AccountBalance,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(28.dp)
            )
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = vendorName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(text = "Vendor ID: $vendorId", style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
            }
            Surface(
                color = Color(0xFF10B981).copy(alpha = 0.2f),
                shape = CircleShape
            ) {
                Text(
                    text = vendorStatus.uppercase(),
                    color = Color(0xFF10B981),
                    fontWeight = FontWeight.Black,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }
}

@Composable
fun MetricsGrid(summary: com.tiffzy.app.data.model.SettlementSummaryData) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricCard(
                title = "Total Sales",
                value = "₹${summary.totalEarnings.toInt()}",
                color = Color(0xFF10B981),
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "Completed Settlement",
                value = "₹${summary.paidSettlement.toInt()}",
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.weight(1f)
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricCard(
                title = "Pending Settlement",
                value = "₹${summary.pendingSettlement.toInt()}",
                color = Color(0xFFF59E0B),
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "Tiffzy Commission (10%)",
                value = "₹${summary.commission.toInt()}",
                color = Color(0xFF6B7280),
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
fun SettlementVisualChart(summary: com.tiffzy.app.data.model.SettlementSummaryData) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Text(
                text = "FINANCIAL BREAKDOWN CHART",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(12.dp))

            val maxVal = Math.max(1.0, summary.totalEarnings)
            val paidRatio = (summary.paidSettlement / maxVal).toFloat().coerceIn(0f, 1f)
            val pendingRatio = (summary.pendingSettlement / maxVal).toFloat().coerceIn(0f, 1f)
            val commRatio = (summary.commission / maxVal).toFloat().coerceIn(0f, 1f)

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ChartBarRow("Completed Settlement", paidRatio, Color(0xFF10B981), "₹${summary.paidSettlement.toInt()}")
                ChartBarRow("Pending Settlement", pendingRatio, Color(0xFFF59E0B), "₹${summary.pendingSettlement.toInt()}")
                ChartBarRow("Tiffzy Commission", commRatio, Color(0xFF6B7280), "₹${summary.commission.toInt()}")
            }
        }
    }
}

@Composable
fun ChartBarRow(label: String, fillFraction: Float, color: Color, amountText: String) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(text = label, style = MaterialTheme.typography.bodySmall)
            Text(text = amountText, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(10.dp)
                .background(Color.LightGray.copy(alpha = 0.3f), shape = RoundedCornerShape(5.dp))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fillFraction)
                    .fillMaxHeight()
                    .background(color, shape = RoundedCornerShape(5.dp))
            )
        }
    }
}

@Composable
fun MetricCard(title: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.1f)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Text(text = title, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black, color = color)
        }
    }
}

@Composable
fun PaymentLedgerRow(order: SettlementOrderItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = "ORDER #${order.orderNo ?: order.id}", fontWeight = FontWeight.Bold)
                Text(text = order.customerName ?: "Customer", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(text = "₹${order.settlementAmount.toInt()}", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
                Text(text = "Fee: ₹${order.commission.toInt()}", style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace)
            }
        }
    }
}
