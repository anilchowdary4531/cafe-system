package com.tiffzy.app.ui.customer.order

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.data.model.OrderGroup
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyPrimaryButton
import com.tiffzy.app.ui.components.TiffzySoftButton
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersScreen(
    onOrderClick: (Int) -> Unit,
    onBack: () -> Unit,
    onReorder: (String) -> Unit,
    viewModel: OrdersViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadOrders()
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "My Orders",
                subtitle = "History & Tracking",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadOrders() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { innerPadding ->
        when (val state = uiState) {
            is OrdersUiState.Loading -> TiffzyLoadingIndicator()
            is OrdersUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        TiffzyPrimaryButton(text = "Retry", onClick = { viewModel.loadOrders() }, fullWidth = false)
                    }
                }
            }
            is OrdersUiState.Success -> {
                if (state.groups.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No orders found", style = MaterialTheme.typography.titleMedium)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                        contentPadding = PaddingValues(Dimens.PaddingLarge),
                        verticalArrangement = Arrangement.spacedBy(Dimens.SpacingLarge)
                    ) {
                        items(state.groups) { group ->
                            RestaurantOrderSection(
                                group = group,
                                onOrderClick = onOrderClick,
                                onReorder = { order ->
                                    viewModel.reorder(order)
                                    onReorder(group.restaurant?.slug ?: "")
                                },
                                onContinueOrdering = {
                                    onReorder(group.restaurant?.slug ?: "")
                                }
                            )
                        }
                    }
                }
            }
            else -> {}
        }
    }
}

@Composable
fun RestaurantOrderSection(
    group: OrderGroup,
    onOrderClick: (Int) -> Unit,
    onReorder: (OrderDetails) -> Unit,
    onContinueOrdering: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(MaterialTheme.shapes.medium)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    if (!group.restaurant?.logo.isNullOrEmpty()) {
                        AsyncImage(
                            model = group.restaurant?.logo,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Icon(Icons.Default.Restaurant, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    }
                }
                Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                Column {
                    Text(
                        text = group.restaurant?.name ?: "Restaurant",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = listOfNotNull(group.restaurant?.city, group.restaurant?.state).joinToString(", "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            TextButton(onClick = onContinueOrdering) {
                Text("Order New")
            }
        }

        Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

        group.orders.forEach { order ->
            val orderWithRestaurant = if (order.restaurant == null) order.copy(restaurant = group.restaurant) else order
            OrderHistoryCard(
                order = orderWithRestaurant,
                onClick = { onOrderClick(order.id) },
                onReorder = { onReorder(orderWithRestaurant) }
            )
            Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        }
    }
}

@Composable
fun OrderHistoryCard(
    order: OrderDetails,
    onClick: () -> Unit,
    onReorder: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
        shape = MaterialTheme.shapes.large
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Order #${order.orderNo}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = formatDate(order.createdAt),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                StatusChip(order.status)
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val type = getOrderTypeLabel(order)
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                        shape = CircleShape
                    ) {
                        Text(
                            text = type,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 10.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "₹${order.total}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TiffzySoftButton(
                        text = "Details",
                        onClick = onClick,
                        modifier = Modifier.weight(1f),
                        fullWidth = false
                    )
                    TiffzyPrimaryButton(
                        text = "Reorder",
                        onClick = onReorder,
                        modifier = Modifier.weight(1f),
                        fullWidth = false
                    )
                }
            }
        }
    }
}

fun getOrderTypeLabel(order: OrderDetails): String {
    val fulfillment = order.fulfillment?.lowercase()
    val tableNo = order.tableNo
    val source = order.orderSource?.uppercase()
    
    return when {
        fulfillment == "pickup" -> "Pickup"
        fulfillment == "delivery" -> "Delivery"
        fulfillment == "dinein" -> if (tableNo != null) "Table $tableNo" else "Dine-in"
        tableNo != null -> "Table $tableNo"
        source == "ONLINE" -> if (order.deliveryAddress != null) "Delivery" else "Pickup"
        listOf("DELIVERY", "HOME_DELIVERY", "DOOR_DELIVERY").contains(source) -> "Delivery"
        listOf("POS", "PICKUP", "TAKEAWAY", "COUNTER").contains(source) -> "Pickup"
        else -> "Takeaway"
    }
}
