package com.tiffzy.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.Restaurant
import com.tiffzy.app.data.model.SearchItem
import com.tiffzy.app.ui.theme.Dimens
import java.util.Locale

@Composable
fun TiffzyRestaurantCard(
    restaurant: Restaurant,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    overrideImageRes: Int? = null
) {
    val rating = remember(restaurant.id) { (40 + (restaurant.id % 10)) / 10.0 }
    val deliveryTime = remember(restaurant.id) { "${25 + (restaurant.id % 20)}-${35 + (restaurant.id % 20)} min" }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            Box(modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)) {
                // Background Image - Prefer bannerUrl then logo
                val imageUrl = restaurant.bannerUrl ?: restaurant.logo
                AsyncImage(
                    model = if (imageUrl.isNullOrEmpty()) null else imageUrl,
                    contentDescription = restaurant.name,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                    placeholder = androidx.compose.ui.res.painterResource(id = overrideImageRes ?: com.tiffzy.app.R.drawable.baked_goods_1),
                    error = androidx.compose.ui.res.painterResource(id = overrideImageRes ?: com.tiffzy.app.R.drawable.baked_goods_1)
                )
                
                // Rating Badge
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(Dimens.PaddingSmall),
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = String.format(Locale.getDefault(), "%.1f", rating),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                // Time Badge
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(Dimens.PaddingSmall),
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f),
                    shape = MaterialTheme.shapes.extraSmall
                ) {
                    Text(
                        text = deliveryTime,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Content
            Column(
                modifier = Modifier.padding(Dimens.PaddingMedium)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = restaurant.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Black
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val category = if (restaurant.id % 2 == 0) "North Indian" else "Cafe & Desserts"
                    Text(
                        text = "$category • $deliveryTime",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                val priceForOne = 150 + (restaurant.id % 200)
                Text(
                    text = "${restaurant.city ?: "Local"} • ₹$priceForOne for one",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    letterSpacing = 1.sp
                )
            }
        }
    }
}

@Composable
fun TiffzySearchItemCard(
    item: SearchItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .padding(Dimens.PaddingSmall)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Item Image
            AsyncImage(
                model = item.image,
                contentDescription = item.name,
                modifier = Modifier
                    .size(80.dp)
                    .clip(MaterialTheme.shapes.small),
                contentScale = ContentScale.Crop,
                placeholder = androidx.compose.ui.res.painterResource(id = com.tiffzy.app.R.drawable.baked_goods_1),
                error = androidx.compose.ui.res.painterResource(id = com.tiffzy.app.R.drawable.baked_goods_1)
            )

            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))

            // Item Details
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (item.category != null) {
                        Surface(
                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f),
                            shape = MaterialTheme.shapes.extraSmall
                        ) {
                            Text(
                                text = item.category.uppercase(),
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                    
                    if (item.rating != null) {
                        Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Star, null, modifier = Modifier.size(10.dp), tint = MaterialTheme.colorScheme.primary)
                            Text(
                                text = String.format("%.1f", item.rating),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(start = 2.dp)
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
                
                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
                
                Text(
                    text = "${item.restaurant.name} • ${item.restaurant.city}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
                
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Rs ${item.price.toInt()}",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                    
                    if (item.orderCount != null && item.orderCount > 0) {
                        Text(
                            text = " • ${item.orderCount} orders",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
            
            // "Open" Button equivalent
            TiffzyPrimaryButton(
                text = "Open",
                onClick = onClick,
                modifier = Modifier.width(70.dp).height(32.dp),
                fullWidth = false
            )
        }
    }
}
