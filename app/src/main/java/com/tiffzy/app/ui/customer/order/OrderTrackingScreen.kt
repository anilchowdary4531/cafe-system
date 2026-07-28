package com.tiffzy.app.ui.customer.order

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderTrackingScreen(
    orderId: Int,
    onBack: () -> Unit,
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
                title = "Order Tracking",
                subtitle = if (uiState is OrderDetailUiState.Success) "#" + (uiState as OrderDetailUiState.Success).order.orderNo else "",
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
                TrackingContent(
                    order = state.order,
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
fun TrackingContent(order: OrderDetails, modifier: Modifier = Modifier) {
    val scrollState = rememberScrollState()
    
    Column(
        modifier = modifier
            .verticalScroll(scrollState)
            .padding(Dimens.PaddingLarge),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        val status = order.status.uppercase()
        val isCancelled = status == "CANCELLED"
        
        if (isCancelled) {
            CancelledView(order)
        } else {
            TrackingHeader(order)
            Spacer(modifier = Modifier.height(32.dp))
            DetailedTimeline(order)
        }
        
        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
        
        // Quick Summary Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
        ) {
            Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
                Text(
                    text = order.restaurant?.name ?: "Restaurant",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${order.items.size} Items • ₹${order.total}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun CancelledView(order: OrderDetails) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            imageVector = Icons.Default.Info,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
        Text(
            text = "Order Cancelled",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.error
        )
        Text(
            text = "This order has been cancelled. If you have any questions, please contact the restaurant.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

@Composable
fun TrackingHeader(order: OrderDetails) {
    val statusText = when (order.status.uppercase()) {
        "PLACED" -> "Order Placed"
        "ACCEPTED" -> "Order Confirmed"
        "PREPARING" -> "Preparing your meal"
        "READY" -> if (order.fulfillment == "pickup") "Ready for Pickup" else "Out for Delivery"
        "DELIVERED" -> "Order Delivered"
        "PICKED_UP" -> "Order Picked Up"
        else -> order.status.capitalizeWords()
    }
    
    val statusHint = when (order.status.uppercase()) {
        "PLACED" -> "We've received your order"
        "ACCEPTED" -> "The restaurant is reviewing your order"
        "PREPARING" -> "Chef is cooking your delicious food"
        "READY" -> "Almost there! Get ready"
        "DELIVERED", "PICKED_UP" -> "Enjoy your meal!"
        else -> ""
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = statusText,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.primary,
            textAlign = TextAlign.Center
        )
        if (statusHint.isNotEmpty()) {
            Text(
                text = statusHint,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun DetailedTimeline(order: OrderDetails) {
    val steps = if (order.fulfillment?.lowercase() == "pickup") {
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

    val currentStatus = order.status.uppercase()
    val currentIndex = when (currentStatus) {
        "PLACED" -> 0
        "ACCEPTED" -> 1
        "PREPARING" -> 2
        "READY" -> 3
        "DELIVERED", "PICKED_UP", "SERVED" -> 4
        else -> 0
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        steps.forEachIndexed { index, step ->
            DetailedTimelineItem(
                step = step,
                isDone = index < currentIndex,
                isActive = index == currentIndex,
                isLast = index == steps.size - 1
            )
        }
    }
}

@Composable
fun DetailedTimelineItem(step: TrackingStep, isDone: Boolean, isActive: Boolean, isLast: Boolean) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    Row(modifier = Modifier.height(IntrinsicSize.Min)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(48.dp)) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(
                        color = if (isDone) Color(0xFF16A34A)
                        else if (isActive) MaterialTheme.colorScheme.primary.copy(alpha = alpha)
                        else MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (isDone) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                } else {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(
                                color = if (isActive) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                            )
                    )
                }
            }
            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .fillMaxHeight()
                        .background(
                            color = if (isDone) Color(0xFF16A34A)
                            else MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                        )
                )
            }
        }
        
        Column(modifier = Modifier
            .padding(start = 16.dp, bottom = 32.dp)
            .fillMaxWidth()) {
            Text(
                text = step.label,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = if (isActive) FontWeight.ExtraBold else FontWeight.Bold,
                color = if (isActive) MaterialTheme.colorScheme.primary else if (isDone) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                letterSpacing = 1.sp
            )
            Text(
                text = step.hint,
                style = MaterialTheme.typography.bodySmall,
                color = if (isActive) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
            )
        }
    }
}
