package com.tiffzy.app.ui.restaurant

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.AnalyticsResponse
import com.tiffzy.app.ui.components.TiffzyErrorState
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantSalesScreen(
    onBack: () -> Unit,
    viewModel: RestaurantSalesViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currentRange by viewModel.currentRange.collectAsState()

    val ranges = listOf(
        "24h" to "Today",
        "7d" to "Last 7 Days",
        "30d" to "Monthly"
    )

    LaunchedEffect(Unit) {
        viewModel.loadAnalytics("24h")
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Sales Analytics",
                subtitle = "Revenue and growth reports",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            // Range Selector
            SingleChoiceSegmentedButtonRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(Dimens.PaddingLarge)
            ) {
                ranges.forEachIndexed { index, (value, label) ->
                    SegmentedButton(
                        selected = currentRange == value,
                        onClick = { viewModel.loadAnalytics(value) },
                        shape = SegmentedButtonDefaults.itemShape(index = index, count = ranges.size)
                    ) {
                        Text(label)
                    }
                }
            }

            when (val state = uiState) {
                is SalesUiState.Loading -> TiffzyLoadingIndicator()
                is SalesUiState.Error -> TiffzyErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadAnalytics(currentRange) }
                )
                is SalesUiState.Success -> {
                    AnalyticsContent(state.analytics)
                }
            }
        }
    }
}

@Composable
fun AnalyticsContent(analytics: AnalyticsResponse) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dimens.PaddingLarge)
    ) {
        val overview = analytics.overview
        
        Text(
            text = "OVERVIEW",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

        // Main Revenue Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)),
            shape = MaterialTheme.shapes.extraLarge
        ) {
            Column(modifier = Modifier.padding(Dimens.PaddingLarge)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.AutoMirrored.Filled.TrendingUp, null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
                    Text("Total Revenue", style = MaterialTheme.typography.labelMedium)
                }
                Text(
                    text = "₹${overview.totalRevenue.toInt()}",
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingLarge))

        // Grid of Stats
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)) {
            AnalyticsStatCard(
                label = "Total Orders",
                value = overview.totalOrders.toString(),
                icon = Icons.Default.ShoppingBag,
                modifier = Modifier.weight(1f)
            )
            AnalyticsStatCard(
                label = "Avg Value",
                value = "₹${overview.avgOrderValue.toInt()}",
                icon = Icons.Default.Assessment,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)) {
            AnalyticsStatCard(
                label = "Delivered",
                value = overview.deliveredOrders.toString(),
                icon = Icons.Default.CheckCircle,
                color = Color(0xFF4CAF50),
                modifier = Modifier.weight(1f)
            )
            AnalyticsStatCard(
                label = "Cancelled",
                value = overview.cancelledOrders.toString(),
                icon = Icons.Default.Cancel,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // Funnel Visualization
        Text(
            text = "ORDER STATUS DISTRIBUTION",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

        analytics.statusFunnel.forEach { statusCount ->
            val percentage = if (overview.totalOrders > 0) statusCount.count.toFloat() / overview.totalOrders else 0f
            
            Column(modifier = Modifier.padding(vertical = 4.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(statusCount.status, style = MaterialTheme.typography.bodySmall)
                    Text("${statusCount.count} orders", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { percentage },
                    modifier = Modifier.fillMaxWidth().height(8.dp).clip(MaterialTheme.shapes.extraSmall),
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                    color = if (statusCount.status == "DELIVERED") Color(0xFF4CAF50) else if (statusCount.status == "CANCELLED") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                )
            }
        }
        
        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
    }
}

@Composable
fun AnalyticsStatCard(
    label: String,
    value: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Icon(icon, null, tint = color, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.height(12.dp))
            Text(text = value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
