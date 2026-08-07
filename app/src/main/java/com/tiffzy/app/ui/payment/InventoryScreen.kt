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
import com.tiffzy.app.data.model.IngredientItem
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    restaurantId: Int? = null,
    onBackClick: () -> Unit = {},
    viewModel: InventoryViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedIngredientForDialog by remember { mutableStateOf<Pair<IngredientItem, String>?>(null) } // item to type (IN/OUT)

    LaunchedEffect(restaurantId) {
        viewModel.loadInventory(restaurantId)
    }

    val filteredIngredients = remember(uiState.ingredients, uiState.searchQuery, uiState.filter) {
        uiState.ingredients.filter { item ->
            val matchesQuery = item.name.contains(uiState.searchQuery, ignoreCase = true)
            val matchesFilter = when (uiState.filter) {
                InventoryFilter.ALL -> true
                InventoryFilter.LOW_STOCK -> item.isLowStock
                InventoryFilter.OUT_OF_STOCK -> item.currentStock <= 0.0
            }
            matchesQuery && matchesFilter
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Inventory & Stock",
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
                    IconButton(onClick = { viewModel.loadInventory(restaurantId) }) {
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
                    Spacer(modifier = Modifier.height(4.dp))
                    // Search Bar
                    OutlinedTextField(
                        value = uiState.searchQuery,
                        onValueChange = { viewModel.updateSearch(it) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Search ingredients (e.g., Paneer, Rice)...") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = if (uiState.searchQuery.isNotEmpty()) {
                            { IconButton(onClick = { viewModel.updateSearch("") }) { Icon(Icons.Default.Clear, contentDescription = null) } }
                        } else null,
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )
                }

                item {
                    // Filter Chips
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        InventoryFilter.entries.forEach { filterItem ->
                            val isSelected = uiState.filter == filterItem
                            FilterChip(
                                selected = isSelected,
                                onClick = { viewModel.setFilter(filterItem) },
                                label = { Text(filterItem.label, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) }
                            )
                        }
                    }
                }

                if (uiState.lowStockCount > 0) {
                    item {
                        // Low Stock Alert Banner
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFEF4444).copy(alpha = 0.15f)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(Dimens.PaddingMedium),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFEF4444))
                                Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                                Column {
                                    Text(
                                        text = "${uiState.lowStockCount} Ingredients Low in Stock",
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFEF4444)
                                    )
                                    Text(
                                        text = "Please restock soon to avoid missing menu items.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }

                item {
                    Text(
                        text = "INGREDIENTS LIST (${filteredIngredients.size})",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        letterSpacing = 1.sp
                    )
                }

                items(filteredIngredients) { ingredient ->
                    IngredientCardRow(
                        ingredient = ingredient,
                        onStockIn = { selectedIngredientForDialog = ingredient to "IN" },
                        onStockOut = { selectedIngredientForDialog = ingredient to "OUT" }
                    )
                }

                item {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "RECENT INVENTORY LOGS",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        letterSpacing = 1.sp
                    )
                }

                items(uiState.history) { log ->
                    InventoryLogRow(log = log)
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

    // Stock Adjustment Dialog
    selectedIngredientForDialog?.let { (ingredient, type) ->
        StockAdjustmentDialog(
            ingredient = ingredient,
            type = type,
            onDismiss = { selectedIngredientForDialog = null },
            onConfirm = { qty, reason ->
                viewModel.adjustStock(ingredient.id, type, qty, reason, restaurantId)
                selectedIngredientForDialog = null
            }
        )
    }
}

@Composable
fun IngredientCardRow(
    ingredient: IngredientItem,
    onStockIn: () -> Unit,
    onStockOut: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = ingredient.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    if (ingredient.isLowStock) {
                        Surface(
                            color = Color(0xFFEF4444).copy(alpha = 0.2f),
                            shape = CircleShape
                        ) {
                            Text(
                                text = "LOW STOCK",
                                color = Color(0xFFEF4444),
                                fontWeight = FontWeight.Black,
                                fontSize = 10.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Stock: ${ingredient.currentStock} ${ingredient.unit}  |  Min Required: ${ingredient.minStock} ${ingredient.unit}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                IconButton(
                    onClick = onStockOut,
                    modifier = Modifier.background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f), CircleShape)
                ) {
                    Icon(Icons.Default.Remove, contentDescription = "Stock Out", tint = MaterialTheme.colorScheme.error)
                }

                IconButton(
                    onClick = onStockIn,
                    modifier = Modifier.background(Color(0xFF10B981).copy(alpha = 0.15f), CircleShape)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Stock In", tint = Color(0xFF10B981))
                }
            }
        }
    }
}

@Composable
fun InventoryLogRow(log: com.tiffzy.app.data.model.InventoryLog) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = when (log.type) {
                    "IN" -> Icons.Default.ArrowDownward
                    "OUT" -> Icons.Default.ArrowUpward
                    else -> Icons.Default.AutoMode
                },
                contentDescription = null,
                tint = when (log.type) {
                    "IN" -> Color(0xFF10B981)
                    "OUT" -> Color(0xFFEF4444)
                    else -> MaterialTheme.colorScheme.primary
                },
                modifier = Modifier.size(20.dp)
            )

            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))

            Column(modifier = Modifier.weight(1f)) {
                Text(text = log.ingredientName, fontWeight = FontWeight.Bold)
                Text(text = log.reason ?: log.type, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${if (log.type == "IN") "+" else "-"}${log.changeQty} ${log.unit}",
                    fontWeight = FontWeight.Black,
                    color = if (log.type == "IN") Color(0xFF10B981) else Color(0xFFEF4444)
                )
                Text(text = log.timestamp, style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace)
            }
        }
    }
}

@Composable
fun StockAdjustmentDialog(
    ingredient: IngredientItem,
    type: String,
    onDismiss: () -> Unit,
    onConfirm: (Double, String) -> Unit
) {
    var quantityText by remember { mutableStateOf("") }
    var reasonText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(text = if (type == "IN") "Stock In: ${ingredient.name}" else "Stock Out: ${ingredient.name}")
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = quantityText,
                    onValueChange = { quantityText = it },
                    label = { Text("Quantity (${ingredient.unit})") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = reasonText,
                    onValueChange = { reasonText = it },
                    label = { Text("Reason / Note (Optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val qty = quantityText.toDoubleOrNull() ?: 0.0
                    if (qty > 0) {
                        onConfirm(qty, reasonText)
                    }
                }
            ) {
                Text("Confirm $type")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
