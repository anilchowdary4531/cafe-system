package com.tiffzy.app.ui.customer.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.FavoriteItem
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FavoritesScreen(
    onBack: () -> Unit,
    onRestaurantClick: (String) -> Unit,
    viewModel: FavoritesViewModel = viewModel()
) {
    val favorites by viewModel.favorites.collectAsState()

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Favorites",
                subtitle = "Saved Dishes",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            if (favorites.isEmpty()) {
                EmptyFavorites(modifier = Modifier.fillMaxSize())
            } else {
                val grouped = favorites.groupBy { it.restaurantSlug }
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(Dimens.PaddingLarge)
                ) {
                    grouped.forEach { (slug, items) ->
                        val restaurantName = items.firstOrNull()?.restaurantName ?: "Unknown Restaurant"
                        val restaurantSlug = slug ?: ""
                        
                        item(key = "header_$restaurantSlug") {
                            RestaurantHeader(
                                name = restaurantName, 
                                count = items.size,
                                onOpenMenu = { 
                                    if (restaurantSlug.isNotEmpty()) {
                                        onRestaurantClick(restaurantSlug) 
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
                        }
                        
                        items(items, key = { it.key }) { favorite ->
                            FavoriteItemRow(
                                item = favorite,
                                onRemove = { viewModel.removeFavorite(favorite.key) }
                            )
                            HorizontalDivider(
                                modifier = Modifier.padding(vertical = Dimens.SpacingSmall),
                                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                            )
                        }
                        
                        item {
                            Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RestaurantHeader(name: String, count: Int, onOpenMenu: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "RESTAURANT",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 1.sp
            )
            Text(
                text = name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "$count items",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        
        TextButton(onClick = onOpenMenu) {
            Text("Open Menu")
        }
    }
}

@Composable
fun FavoriteItemRow(item: FavoriteItem, onRemove: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = item.image,
            contentDescription = null,
            modifier = Modifier
                .size(56.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium),
            contentScale = ContentScale.Crop
        )
        
        Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
        
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.itemName,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "Rs ${item.price.toInt()}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        
        IconButton(onClick = onRemove) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "Remove",
                tint = MaterialTheme.colorScheme.error.copy(alpha = 0.6f)
            )
        }
    }
}

@Composable
fun EmptyFavorites(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.Favorite,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.surfaceVariant
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        Text(
            text = "No favorites yet",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Open a restaurant menu and tap the heart icon.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
