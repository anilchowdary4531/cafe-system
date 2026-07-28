package com.tiffzy.app.ui.restaurant

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantOrdersScreen(
    onOrderClick: (Int) -> Unit,
    viewModel: RestaurantOrdersViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Live Orders",
                subtitle = "Manage incoming and active orders"
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        when (val state = uiState) {
            is RestaurantOrdersUiState.Loading -> TiffzyLoadingIndicator()
            is RestaurantOrdersUiState.Error -> TiffzyErrorState(
                message = state.message,
                onRetry = { viewModel.loadOrders() },
                modifier = Modifier.padding(innerPadding)
            )
            is RestaurantOrdersUiState.Success -> {
                OrderListContent(
                    orders = state.orders,
                    onOrderClick = onOrderClick,
                    modifier = Modifier.fillMaxSize().padding(innerPadding)
                )
            }
        }
    }
}

@Composable
fun OrderListContent(
    orders: List<OrderDetails>,
    onOrderClick: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    if (orders.isEmpty()) {
        TiffzyEmptyState(
            message = "No live orders at the moment",
            modifier = modifier
        )
    } else {
        LazyColumn(
            modifier = modifier,
            contentPadding = PaddingValues(Dimens.PaddingLarge),
            verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
        ) {
            items(orders, key = { it.id }) { order ->
                RestaurantOrderCard(order = order, onClick = { onOrderClick(order.id) })
            }
        }
    }
}

@Composable
fun RestaurantOrderCard(order: OrderDetails, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "#${order.orderNo.takeLast(6)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = formatTime(order.createdAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                TiffzyStatusBadge(status = order.status)
            }
            
            Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
            Divider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
            Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "${order.items.sumOf { it.qty }} Items",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
                Icon(Icons.Default.FiberManualRecord, null, modifier = Modifier.size(4.dp), tint = MaterialTheme.colorScheme.outline)
                Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
                Text(
                    text = order.fulfillment?.uppercase() ?: "POS",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
                if (order.tableNo != null) {
                    Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
                    Icon(Icons.Default.FiberManualRecord, null, modifier = Modifier.size(4.dp), tint = MaterialTheme.colorScheme.outline)
                    Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
                    Text(
                        text = "Table ${order.tableNo}",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                Spacer(modifier = Modifier.weight(1f))
                
                Text(
                    text = "₹${order.total.toInt()}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            
            if (order.customerName != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = order.customerName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

fun formatTime(dateStr: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(dateStr)
        val outputFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
        outputFormat.format(date!!)
    } catch (e: Exception) {
        dateStr
    }
}
