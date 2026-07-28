package com.tiffzy.app.ui.customer.order

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.data.model.OrderItemDetails
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyPrimaryButton
import com.tiffzy.app.ui.components.TiffzySoftButton
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    orderId: Int,
    onBack: () -> Unit,
    onTrackOrder: (Int) -> Unit,
    onReorder: (String) -> Unit,
    viewModel: OrdersViewModel = viewModel()
) {
    val uiState by viewModel.orderDetailState.collectAsState()

    DisposableEffect(orderId) {
        viewModel.loadOrderDetail(orderId)
        viewModel.startPollingOrder(orderId)
        onDispose {
            viewModel.stopPolling()
        }
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Order Details",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        when (val state = uiState) {
            is OrderDetailUiState.Loading -> TiffzyLoadingIndicator()
            is OrderDetailUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(state.message, color = MaterialTheme.colorScheme.error)
                }
            }
            is OrderDetailUiState.Success -> {
                OrderDetailContent(
                    order = state.order,
                    onTrackOrder = { onTrackOrder(orderId) },
                    onReorder = {
                        viewModel.reorder(state.order)
                        onReorder(state.order.restaurant?.slug ?: "")
                    },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                )
            }
            else -> {}
        }
    }
}

@Composable
fun OrderDetailContent(
    order: OrderDetails,
    onTrackOrder: () -> Unit,
    onReorder: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(Dimens.PaddingMedium)
    ) {
        // Order Summary Header
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Order #${order.orderNo}",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = formatDate(order.createdAt),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    
                    TiffzySoftButton(
                        text = "Reorder",
                        onClick = onReorder,
                        modifier = Modifier.width(100.dp).height(36.dp),
                        fullWidth = false
                    )
                }
                
                HorizontalDivider(modifier = Modifier.padding(vertical = Dimens.SpacingMedium))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Status", style = MaterialTheme.typography.labelSmall)
                        StatusChip(order.status)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Total Amount", style = MaterialTheme.typography.labelSmall)
                        Text(
                            "₹${order.total}",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

        // Track Live Button
        val isTerminal = listOf("DELIVERED", "PICKED_UP", "CANCELLED", "SERVED").contains(order.status.uppercase())
        if (!isTerminal) {
            TiffzyPrimaryButton(
                text = "Track Live Status",
                onClick = onTrackOrder,
                icon = Icons.Default.MyLocation
            )
            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))
        }

        // Tracking Timeline (Static / Simplified)
        Text("Order Status", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        OrderTrackingTimeline(status = order.status, fulfillment = order.fulfillment ?: "delivery")

        Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

        // Items
        Text("Items", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        order.items.forEach { item ->
            OrderItemRow(item)
            Spacer(modifier = Modifier.height(4.dp))
        }

        Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

        // Billing Details
        Text("Billing Summary", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        BillingSummary(order)

        if (!order.deliveryAddress.isNullOrEmpty()) {
            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))
            Text("Delivery Address", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
            Card(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = order.deliveryAddress,
                    modifier = Modifier.padding(Dimens.PaddingMedium),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
        
        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
    }
}

@Composable
fun OrderTrackingTimeline(status: String, fulfillment: String) {
    val steps = if (fulfillment.lowercase() == "pickup") {
        listOf(
            TrackingStep("PLACED", "Placed", "Order received"),
            TrackingStep("ACCEPTED", "Confirmed", "Restaurant accepted"),
            TrackingStep("PREPARING", "Preparing", "Chef is cooking"),
            TrackingStep("READY", "Ready", "Ready for pickup"),
            TrackingStep("PICKED_UP", "Picked Up", "Order collected")
        )
    } else {
        listOf(
            TrackingStep("PLACED", "Placed", "Order received"),
            TrackingStep("ACCEPTED", "Confirmed", "Restaurant accepted"),
            TrackingStep("PREPARING", "Preparing", "Chef is cooking"),
            TrackingStep("READY", "Ready", "Out for delivery"),
            TrackingStep("DELIVERED", "Delivered", "Order arrived")
        )
    }

    val currentStatus = status.uppercase()
    val currentIndex = when (currentStatus) {
        "PLACED" -> 0
        "ACCEPTED" -> 1
        "PREPARING" -> 2
        "READY" -> 3
        "DELIVERED", "PICKED_UP", "SERVED" -> 4
        else -> 0
    }

    Column(modifier = Modifier.padding(start = 8.dp)) {
        steps.forEachIndexed { index, step ->
            TimelineItem(
                step = step,
                isDone = index < currentIndex,
                isActive = index == currentIndex,
                isLast = index == steps.size - 1
            )
        }
    }
}

@Composable
fun TimelineItem(step: TrackingStep, isDone: Boolean, isActive: Boolean, isLast: Boolean) {
    Row(modifier = Modifier.height(IntrinsicSize.Min)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(
                        color = if (isDone) Color(0xFF16A34A) else if (isActive) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                        shape = MaterialTheme.shapes.small
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (isDone) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                } else {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(
                                color = if (isActive) MaterialTheme.colorScheme.primary else Color.Transparent,
                                shape = CircleShape
                            )
                    )
                }
            }
            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .weight(1f)
                        .background(
                            color = if (isDone) Color(0xFF16A34A) else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                        )
                )
            }
        }
        
        Column(modifier = Modifier.padding(start = 16.dp, bottom = 24.dp)) {
            Text(
                text = step.label,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                color = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = step.hint,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun OrderItemRow(item: OrderItemDetails) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(item.itemName, style = MaterialTheme.typography.bodyLarge)
            Text("Qty: ${item.qty} x ₹${item.price}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text("₹${item.total}", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun BillingSummary(order: OrderDetails) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            BillingRow("Subtotal", "₹${order.subtotal}")
            BillingRow("Tax", "₹${order.taxAmount}")
            BillingRow("Service Charge", "₹${order.serviceChargeAmount}")
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            BillingRow("Total", "₹${order.total}", isTotal = true)
        }
    }
}

@Composable
fun BillingRow(label: String, value: String, isTotal: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = if (isTotal) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal
        )
        Text(
            text = value,
            style = if (isTotal) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal,
            color = if (isTotal) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
        )
    }
}
