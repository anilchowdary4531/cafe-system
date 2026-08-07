package com.tiffzy.app.ui.payment

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.data.model.MenuItemRequest
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MenuManagementScreen(
    slug: String = "tiffzy-kitchen",
    onBackClick: () -> Unit = {},
    viewModel: MenuManagementViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var editingItem by remember { mutableStateOf<MenuItem?>(null) }
    var isAddingNew by remember { mutableStateOf(false) }

    LaunchedEffect(slug) {
        viewModel.loadMenu(slug)
    }

    val categories = remember(uiState.menuItems) {
        listOf("All") + uiState.menuItems.map { it.category }.distinct()
    }

    val filteredItems = remember(uiState.menuItems, uiState.searchQuery, uiState.selectedCategory) {
        uiState.menuItems.filter { item ->
            val matchesQuery = item.name.contains(uiState.searchQuery, ignoreCase = true)
            val matchesCat = uiState.selectedCategory == "All" || item.category.equals(uiState.selectedCategory, ignoreCase = true)
            matchesQuery && matchesCat
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = "Menu Management", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadMenu(slug) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { isAddingNew = true },
                icon = { Icon(Icons.Default.Add, contentDescription = "Add Food") },
                text = { Text("Add Food Item", fontWeight = FontWeight.Bold) },
                containerColor = MaterialTheme.colorScheme.primary
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = Dimens.PaddingMedium),
                verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
            ) {
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    // Search Bar
                    OutlinedTextField(
                        value = uiState.searchQuery,
                        onValueChange = { viewModel.updateSearch(it) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Search menu items (Paneer, Biryani)...") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = if (uiState.searchQuery.isNotEmpty()) {
                            { IconButton(onClick = { viewModel.updateSearch("") }) { Icon(Icons.Default.Clear, contentDescription = null) } }
                        } else null,
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )
                }

                item {
                    // Categories Scrollable Filter
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        categories.forEach { cat ->
                            val isSelected = uiState.selectedCategory == cat
                            FilterChip(
                                selected = isSelected,
                                onClick = { viewModel.selectCategory(cat) },
                                label = { Text(cat, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) }
                            )
                        }
                    }
                }

                items(filteredItems) { item ->
                    MenuItemCardRow(
                        item = item,
                        onEditClick = { editingItem = item },
                        onDeleteClick = { viewModel.deleteMenuItem(item.id) },
                        onToggleAvailability = { viewModel.toggleAvailability(item) }
                    )
                }

                item {
                    Spacer(modifier = Modifier.height(80.dp))
                }
            }

            if (uiState.isLoading) {
                TiffzyLoadingIndicator()
            }
        }
    }

    // Add / Edit Food Dialog
    if (isAddingNew || editingItem != null) {
        AddEditFoodDialog(
            existingItem = editingItem,
            onDismiss = {
                isAddingNew = false
                editingItem = null
            },
            onSave = { request ->
                viewModel.saveMenuItem(request, slug)
                isAddingNew = false
                editingItem = null
            }
        )
    }
}

@Composable
fun MenuItemCardRow(
    item: MenuItem,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit,
    onToggleAvailability: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Veg / Non-Veg Indicator Dot
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .background(if (item.isVeg) Color(0xFF10B981) else Color(0xFFEF4444), CircleShape)
                )

                Spacer(modifier = Modifier.width(8.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(text = item.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(text = "${item.category} • Prep: ${item.preparationTime}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }

                Switch(
                    checked = item.isAvailable,
                    onCheckedChange = { onToggleAvailability() }
                )
            }

            if (!item.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = item.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "₹${item.price.toInt()}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
                    if (item.discountPercentage > 0) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Surface(color = Color(0xFFEF4444).copy(alpha = 0.15f), shape = RoundedCornerShape(4.dp)) {
                            Text(text = "${item.discountPercentage}% OFF", color = Color(0xFFEF4444), fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(onClick = onEditClick) { Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary) }
                    IconButton(onClick = onDeleteClick) { Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFEF4444)) }
                }
            }
        }
    }
}

@Composable
fun AddEditFoodDialog(
    existingItem: MenuItem?,
    onDismiss: () -> Unit,
    onSave: (MenuItemRequest) -> Unit
) {
    var name by remember { mutableStateOf(existingItem?.name ?: "") }
    var category by remember { mutableStateOf(existingItem?.category ?: "Main Course") }
    var priceText by remember { mutableStateOf(existingItem?.price?.toString() ?: "") }
    var discountText by remember { mutableStateOf(existingItem?.discountPercentage?.toString() ?: "0") }
    var description by remember { mutableStateOf(existingItem?.description ?: "") }
    var prepTime by remember { mutableStateOf(existingItem?.preparationTime ?: "15-20 mins") }
    var isVeg by remember { mutableStateOf(existingItem?.isVeg ?: true) }
    var spicyLevel by remember { mutableStateOf(existingItem?.spicyLevel ?: "Medium") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existingItem == null) "Add New Food Item" else "Edit Food Item") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Item Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category (Main Course, Starters)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = priceText, onValueChange = { priceText = it }, label = { Text("Price (₹)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = discountText, onValueChange = { discountText = it }, label = { Text("Discount %") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = prepTime, onValueChange = { prepTime = it }, label = { Text("Preparation Time (e.g., 15 mins)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())

                // Veg / Non-Veg Selector
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Type: ", fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.width(8.dp))
                    FilterChip(selected = isVeg, onClick = { isVeg = true }, label = { Text("Veg") })
                    Spacer(modifier = Modifier.width(6.dp))
                    FilterChip(selected = !isVeg, onClick = { isVeg = false }, label = { Text("Non-Veg") })
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val price = priceText.toDoubleOrNull() ?: 0.0
                    val discount = discountText.toIntOrNull() ?: 0
                    if (name.isNotBlank() && price > 0) {
                        onSave(
                            MenuItemRequest(
                                id = existingItem?.id,
                                name = name,
                                description = description,
                                category = category,
                                price = price,
                                isVeg = isVeg,
                                spicyLevel = spicyLevel,
                                discountPercentage = discount,
                                preparationTime = prepTime
                            )
                        )
                    }
                }
            ) { Text("Save Item") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
