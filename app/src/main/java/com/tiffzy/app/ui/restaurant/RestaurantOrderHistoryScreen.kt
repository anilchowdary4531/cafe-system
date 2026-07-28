package com.tiffzy.app.ui.restaurant

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.ui.components.TiffzyEmptyState
import com.tiffzy.app.ui.components.TiffzyErrorState
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantOrderHistoryScreen(
    onOrderClick: (Int) -> Unit,
    onBack: () -> Unit,
    viewModel: RestaurantOrderHistoryViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currentFilter by viewModel.currentStatusFilter.collectAsState()

    val filters = listOf(
        "ALL" to null,
        "DELIVERED" to "DELIVERED",
        "CANCELLED" to "CANCELLED",
        "PLACED" to "PLACED"
    )

    LaunchedEffect(Unit) {
        viewModel.loadHistory()
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Order History",
                subtitle = "Complete record of all orders",
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
            // Filter Chips
            LazyRow(
                contentPadding = PaddingValues(horizontal = Dimens.PaddingLarge, vertical = Dimens.PaddingSmall),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filters) { (label, value) ->
                    FilterChip(
                        selected = currentFilter == value,
                        onClick = { viewModel.loadHistory(status = value) },
                        label = { Text(label) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                            selectedLabelColor = MaterialTheme.colorScheme.primary
                        )
                    )
                }
            }

            when (val state = uiState) {
                is OrderHistoryUiState.Loading -> TiffzyLoadingIndicator()
                is OrderHistoryUiState.Error -> TiffzyErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadHistory(status = currentFilter) }
                )
                is OrderHistoryUiState.Success -> {
                    HistoryList(
                        orders = state.orders,
                        onOrderClick = onOrderClick
                    )
                }
            }
        }
    }
}

@Composable
fun HistoryList(
    orders: List<OrderDetails>,
    onOrderClick: (Int) -> Unit
) {
    if (orders.isEmpty()) {
        TiffzyEmptyState(message = "No matching orders found")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(Dimens.PaddingLarge),
            verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
        ) {
            items(orders, key = { it.id }) { order ->
                RestaurantOrderCard(
                    order = order,
                    onClick = { onOrderClick(order.id) }
                )
            }
        }
    }
}
