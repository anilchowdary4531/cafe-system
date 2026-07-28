package com.tiffzy.app.ui.restaurant

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.ui.components.TiffzyEmptyState
import com.tiffzy.app.ui.components.TiffzyErrorState
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantMenuScreen(
    onAddItem: () -> Unit,
    onEditItem: (MenuItem) -> Unit,
    onBack: () -> Unit,
    viewModel: RestaurantMenuViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var itemToDelete by remember { mutableStateOf<MenuItem?>(null) }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Menu Management",
                subtitle = "Manage items and availability",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAddItem, containerColor = MaterialTheme.colorScheme.primary) {
                Icon(Icons.Default.Add, "Add Item")
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        when (val state = uiState) {
            is MenuUiState.Loading -> TiffzyLoadingIndicator()
            is MenuUiState.Error -> TiffzyErrorState(
                message = state.message,
                onRetry = { viewModel.loadMenu() },
                modifier = Modifier.padding(innerPadding)
            )
            is MenuUiState.Success -> {
                if (state.menu.isEmpty()) {
                    TiffzyEmptyState(
                        message = "Your menu is empty. Start adding items!",
                        actionLabel = "Add Item",
                        onAction = onAddItem,
                        modifier = Modifier.padding(innerPadding)
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(innerPadding),
                        contentPadding = PaddingValues(Dimens.PaddingLarge),
                        verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
                    ) {
                        items(state.menu, key = { it.id }) { item ->
                            MenuManagementCard(
                                item = item,
                                onEdit = { onEditItem(item) },
                                onDelete = { itemToDelete = item },
                                onToggleAvailability = { viewModel.toggleAvailability(item) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (itemToDelete != null) {
        AlertDialog(
            onDismissRequest = { itemToDelete = null },
            title = { Text("Delete Item") },
            text = { Text("Are you sure you want to delete '${itemToDelete?.name}'? This action cannot be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        itemToDelete?.let { viewModel.deleteMenuItem(it.id) }
                        itemToDelete = null
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { itemToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun MenuManagementCard(
    item: MenuItem,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggleAvailability: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (item.isAvailable) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = item.image,
                contentDescription = null,
                modifier = Modifier
                    .size(64.dp)
                    .clip(MaterialTheme.shapes.medium)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentScale = ContentScale.Crop
            )
            
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(text = item.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(text = "₹${item.price.toInt()} • ${item.category}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(
                        checked = item.isAvailable,
                        onCheckedChange = { onToggleAvailability() },
                        modifier = Modifier.scale(0.7f)
                    )
                    Text(
                        text = if (item.isAvailable) "Available" else "Out of Stock",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (item.isAvailable) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                    )
                }
            }
            
            Row {
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, "Edit", tint = MaterialTheme.colorScheme.primary)
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, "Delete", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

// Helper to scale switch
@Composable
fun Modifier.customScale(scale: Float) = this.then(
    Modifier.layout { measurable, constraints ->
        val placeable = measurable.measure(constraints)
        layout(
            (placeable.width * scale).toInt(),
            (placeable.height * scale).toInt()
        ) {
            placeable.placeRelative(0, 0)
        }
    }
)
