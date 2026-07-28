package com.tiffzy.app.ui.restaurant

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Person
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantOrderDetailScreen(
    orderId: Int,
    onBack: () -> Unit,
    viewModel: RestaurantOrdersViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    val order = (uiState as? RestaurantOrdersUiState.Success)?.orders?.find { it.id == orderId }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Order Details",
                subtitle = order?.orderNo ?: "Loading...",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        if (order == null) {
            TiffzyLoadingIndicator()
        } else {
            OrderDetailContent(
                order = order,
                onUpdateStatus = { viewModel.updateStatus(order.id, it) },
                modifier = Modifier.fillMaxSize().padding(innerPadding)
            )
        }
    }
}

@Composable
fun OrderDetailContent(
    order: OrderDetails,
    onUpdateStatus: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(Dimens.PaddingLarge)
    ) {
        // Customer Info
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Person, null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                        Text(
                            text = order.customerName ?: "Walk-in Customer",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    TiffzyStatusBadge(status = order.status)
                }
                if (order.phone != null) {
                    Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Call, null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                        Text(text = order.phone, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                
                if (order.tableNo != null) {
                    Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
                    Text(
                        text = "Dining at Table ${order.tableNo}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                } else if (order.fulfillment != null) {
                    Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
                    Text(
                        text = order.fulfillment.uppercase(),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold
                    )
                    order.deliveryAddress?.let {
                        Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        
        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
        
        // Order Items
        Text(
            text = "ORDER ITEMS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        
        order.items.forEach { item ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${item.qty}x",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.width(32.dp)
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = item.itemName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                }
                Text(text = "₹${item.total.toInt()}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
        }
        
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = "Total Amount", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Black)
            Text(text = "₹${order.total.toInt()}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
        }
        
        val paymentStatusColor = if (order.paymentStatus == "PAID" || order.paymentStatus == "SUCCESS") Color(0xFF4CAF50) else Color(0xFFFF9800)
        Text(
            text = "${order.paymentStatus ?: "PENDING"} via ${order.paymentMode ?: "CASH"}",
            style = MaterialTheme.typography.labelSmall,
            color = paymentStatusColor,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.align(Alignment.End)
        )

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
        
        // Action Buttons
        Text(
            text = "UPDATE STATUS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        
        StatusActions(status = order.status, onUpdate = onUpdateStatus)
        
        if (order.notes != null) {
            Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.2f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
                    Text("Customer Notes:", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    Text(order.notes, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
fun StatusActions(status: String, onUpdate: (String) -> Unit) {
    val current = status.uppercase()
    
    Column(verticalArrangement = Arrangement.spacedBy(Dimens.SpacingSmall)) {
        when (current) {
            "PLACED" -> {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingSmall)) {
                    Button(
                        onClick = { onUpdate("ACCEPTED") },
                        modifier = Modifier.weight(1f).height(Dimens.ButtonHeight),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
                        shape = MaterialTheme.shapes.medium
                    ) {
                        Text("ACCEPT ORDER", style = MaterialTheme.typography.labelLarge)
                    }
                    OutlinedButton(
                        onClick = { onUpdate("CANCELLED") },
                        modifier = Modifier.weight(1f).height(Dimens.ButtonHeight),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                        shape = MaterialTheme.shapes.medium
                    ) {
                        Text("REJECT", style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
            "ACCEPTED" -> {
                Button(
                    onClick = { onUpdate("PREPARING") },
                    modifier = Modifier.fillMaxWidth().height(Dimens.ButtonHeight),
                    shape = MaterialTheme.shapes.medium
                ) {
                    Text("START PREPARING", style = MaterialTheme.typography.labelLarge)
                }
            }
            "PREPARING" -> {
                Button(
                    onClick = { onUpdate("READY") },
                    modifier = Modifier.fillMaxWidth().height(Dimens.ButtonHeight),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
                    shape = MaterialTheme.shapes.medium
                ) {
                    Text("MARK AS READY", style = MaterialTheme.typography.labelLarge)
                }
            }
            "READY" -> {
                Button(
                    onClick = { onUpdate("DELIVERED") },
                    modifier = Modifier.fillMaxWidth().height(Dimens.ButtonHeight),
                    shape = MaterialTheme.shapes.medium
                ) {
                    Text("MARK AS DELIVERED / SERVED", style = MaterialTheme.typography.labelLarge)
                }
            }
            else -> {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.medium
                ) {
                    Text(
                        text = "ORDER $current",
                        modifier = Modifier.padding(Dimens.PaddingMedium),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}
