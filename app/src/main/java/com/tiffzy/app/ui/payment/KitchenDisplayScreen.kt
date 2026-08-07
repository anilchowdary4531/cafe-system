package com.tiffzy.app.ui.payment

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KitchenDisplayScreen(
    restaurantId: Int? = null,
    onBackClick: () -> Unit = {},
    viewModel: KitchenDisplayViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(restaurantId) {
        viewModel.loadKitchenOrders(restaurantId)
    }

    val filteredOrders = remember(uiState.orders, uiState.selectedTab) {
        val filter = uiState.selectedTab.statusFilter.uppercase()
        uiState.orders.filter { order ->
            val status = order.status.uppercase()
            when (filter) {
                "NEW" -> status == "PENDING" || status == "NEW" || status == "ACTIVE"
                "CONFIRMED" -> status == "CONFIRMED" || status == "ACCEPTED"
                "PREPARING" -> status == "PREPARING" || status == "COOKING"
                "READY_FOR_PICKUP" -> status == "READY_FOR_PICKUP" || status == "READY" || status == "PICKUP"
                "DELIVERED" -> status == "DELIVERED" || status == "COMPLETED"
                else -> true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Kitchen Display System (KDS)",
                            fontWeight = FontWeight.Black,
                            fontSize = 20.sp
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Surface(
                            color = Color(0xFF10B981),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "LIVE SOCKET",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadKitchenOrders(restaurantId) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Category Tabs Bar
            ScrollableTabRow(
                selectedTabIndex = uiState.selectedTab.ordinal,
                edgePadding = Dimens.PaddingMedium,
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                KdsTab.entries.forEach { tab ->
                    val tabOrdersCount = uiState.orders.count { order ->
                        val status = order.status.uppercase()
                        when (tab.statusFilter) {
                            "NEW" -> status == "PENDING" || status == "NEW" || status == "ACTIVE"
                            "CONFIRMED" -> status == "CONFIRMED" || status == "ACCEPTED"
                            "PREPARING" -> status == "PREPARING" || status == "COOKING"
                            "READY_FOR_PICKUP" -> status == "READY_FOR_PICKUP" || status == "READY" || status == "PICKUP"
                            "DELIVERED" -> status == "DELIVERED" || status == "COMPLETED"
                            else -> false
                        }
                    }

                    Tab(
                        selected = uiState.selectedTab == tab,
                        onClick = { viewModel.selectTab(tab) },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(tab.title, fontWeight = FontWeight.Bold)
                                if (tabOrdersCount > 0) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Surface(
                                        color = if (uiState.selectedTab == tab) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                        shape = CircleShape
                                    ) {
                                        Text(
                                            text = "$tabOrdersCount",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                            color = if (uiState.selectedTab == tab) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }
                    )
                }
            }

            Box(modifier = Modifier.fillMaxSize()) {
                if (filteredOrders.isEmpty() && !uiState.isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.OutdoorGrill,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "No orders in ${uiState.selectedTab.title}",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 340.dp),
                        modifier = Modifier.padding(Dimens.PaddingMedium),
                        horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium),
                        verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
                    ) {
                        items(filteredOrders) { order ->
                            KitchenOrderCard(
                                order = order,
                                currentTab = uiState.selectedTab,
                                onActionClick = { nextStatus ->
                                    viewModel.updateStatus(order.id, nextStatus, restaurantId)
                                }
                            )
                        }
                    }
                }

                if (uiState.isLoading) {
                    TiffzyLoadingIndicator()
                }
            }
        }
    }
}

@Composable
fun KitchenOrderCard(
    order: OrderDetails,
    currentTab: KdsTab,
    onActionClick: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingLarge)) {
            // Header: Order No, Customer, Paid Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "ORDER #${order.orderNo ?: order.id}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = order.customerName ?: "Customer",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Surface(
                    color = if (order.paymentStatus?.uppercase() == "PAID") Color(0xFF10B981).copy(alpha = 0.15f) else Color(0xFFF59E0B).copy(alpha = 0.15f),
                    shape = CircleShape
                ) {
                    Text(
                        text = (order.paymentStatus ?: "PAID").uppercase(),
                        color = if (order.paymentStatus?.uppercase() == "PAID") Color(0xFF10B981) else Color(0xFFF59E0B),
                        fontWeight = FontWeight.Black,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.outlineVariant)

            // Items List
            order.items.forEach { item ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${item.qty}x  ${item.itemName}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "₹${item.total}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Special Instructions / Notes
            if (!order.notes.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.EditNote, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Note: ${order.notes}",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Large Touch-Friendly Staff Action Button
            when (currentTab) {
                KdsTab.NEW -> {
                    Button(
                        onClick = { onActionClick("CONFIRMED") },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("ACCEPT ORDER", fontWeight = FontWeight.Black)
                    }
                }
                KdsTab.ACCEPTED -> {
                    Button(
                        onClick = { onActionClick("PREPARING") },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Icon(Icons.Default.SoupKitchen, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("START PREPARING", fontWeight = FontWeight.Black)
                    }
                }
                KdsTab.PREPARING -> {
                    Button(
                        onClick = { onActionClick("READY_FOR_PICKUP") },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B))
                    ) {
                        Icon(Icons.Default.TakeoutDining, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("MARK READY FOR PICKUP", fontWeight = FontWeight.Black)
                    }
                }
                KdsTab.READY -> {
                    Button(
                        onClick = { onActionClick("DELIVERED") },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B82F6))
                    ) {
                        Icon(Icons.Default.DeliveryDining, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("MARK DELIVERED", fontWeight = FontWeight.Black)
                    }
                }
                KdsTab.DELIVERED -> {
                    OutlinedButton(
                        onClick = { },
                        enabled = false,
                        modifier = Modifier.fillMaxWidth().height(44.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("ORDER COMPLETED", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
