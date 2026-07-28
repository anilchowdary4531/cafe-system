package com.tiffzy.app.ui.customer.cart

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ClearAll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.CartItem
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens
import java.util.Locale

@Composable
fun CartScreen(
    onNavigateToMenu: (String) -> Unit,
    onCheckout: () -> Unit,
    viewModel: CartViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Your Cart",
                subtitle = if (uiState.items.isNotEmpty()) "${uiState.items.size} items" else null,
                actions = {
                    if (uiState.items.isNotEmpty()) {
                        IconButton(onClick = { viewModel.clearCart() }) {
                            Icon(Icons.Default.ClearAll, contentDescription = "Clear Cart", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        if (uiState.items.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                TiffzyEmptyState(
                    message = "Your cart is empty",
                    actionLabel = "Browse Menu",
                    onAction = { 
                        uiState.restaurant?.slug?.let { onNavigateToMenu(it) } ?: onNavigateToMenu("")
                    }
                )
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                // Restaurant info header in cart
                uiState.restaurant?.let { restaurant ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.5f),
                        tonalElevation = 1.dp
                    ) {
                        Row(
                            modifier = Modifier.padding(Dimens.PaddingMedium),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AsyncImage(
                                model = restaurant.logo,
                                contentDescription = null,
                                modifier = Modifier.size(40.dp).clip(CircleShape),
                                contentScale = ContentScale.Crop
                            )
                            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                            Column {
                                Text(
                                    text = restaurant.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = restaurant.city ?: "Local",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(Dimens.PaddingMedium),
                    verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
                ) {
                    items(uiState.items, key = { it.menuItem.id }) { item ->
                        CartItemRow(
                            item = item,
                            onIncrease = { viewModel.increaseQuantity(item.menuItem.id) },
                            onDecrease = { viewModel.decreaseQuantity(item.menuItem.id) },
                            onRemove = { viewModel.removeItem(item.menuItem.id) }
                        )
                    }
                }

                BillingSection(
                    subtotal = uiState.subtotal,
                    tax = uiState.tax,
                    taxPercent = uiState.restaurant?.taxPercent ?: 0.0,
                    total = uiState.total,
                    onCheckout = onCheckout
                )
            }
        }
    }
}

@Composable
fun CartItemRow(
    item: CartItem,
    onIncrease: () -> Unit,
    onDecrease: () -> Unit,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = MaterialTheme.shapes.large
    ) {
        Row(
            modifier = Modifier
                .padding(Dimens.PaddingMedium)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = item.menuItem.image,
                contentDescription = item.menuItem.name,
                modifier = Modifier
                    .size(70.dp)
                    .clip(MaterialTheme.shapes.medium),
                contentScale = ContentScale.Crop,
                placeholder = androidx.compose.ui.res.painterResource(id = com.tiffzy.app.R.drawable.baked_goods_2),
                error = androidx.compose.ui.res.painterResource(id = com.tiffzy.app.R.drawable.baked_goods_3)
            )

            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.menuItem.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "₹${String.format(Locale.getDefault(), "%.2f", item.menuItem.price)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = "Delete",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.clickable { onRemove() }
                )
            }

            // Quantity Controls - Luxury pill style
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                shape = CircleShape,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    IconButton(
                        onClick = onDecrease,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Text("-", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    Text(
                        text = item.quantity.toString(),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp),
                        textAlign = TextAlign.Center
                    )
                    IconButton(
                        onClick = onIncrease,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Text("+", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
}

@Composable
fun BillingSection(
    subtotal: Double,
    tax: Double,
    taxPercent: Double,
    total: Double,
    onCheckout: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp
    ) {
        Column(
            modifier = Modifier.padding(Dimens.PaddingLarge)
        ) {
            Text(
                text = "Billing Details",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            BillingRow("Subtotal", subtotal)
            if (tax > 0) {
                BillingRow("Tax (${String.format(Locale.getDefault(), "%.1f", taxPercent)}%)", tax)
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = Dimens.PaddingSmall))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Total",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Rs ${String.format(Locale.getDefault(), "%.2f", total)}",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            TiffzyPrimaryButton(
                text = "Checkout - Rs ${String.format(Locale.getDefault(), "%.2f", total)}",
                onClick = onCheckout
            )
        }
    }
}

@Composable
fun BillingRow(label: String, amount: Double) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyLarge)
        Text(
            text = "Rs ${String.format(Locale.getDefault(), "%.2f", amount)}",
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium
        )
    }
}
