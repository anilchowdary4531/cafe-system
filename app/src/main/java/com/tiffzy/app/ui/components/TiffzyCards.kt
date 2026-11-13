package com.tiffzy.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Restaurant
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.compose.SubcomposeAsyncImage
import com.tiffzy.app.data.model.Restaurant
import com.tiffzy.app.data.model.SearchItem
import com.tiffzy.app.ui.theme.Dimens
import com.tiffzy.app.ui.theme.TiffzyOrange
import com.tiffzy.app.utils.ImageUtils
import java.util.Locale

@Composable
fun TiffzyRestaurantCard(
    restaurant: Restaurant,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val rating = remember(restaurant.id) { (40 + (restaurant.id % 10)) / 10.0 }
    val deliveryTime = remember(restaurant.id) { "${25 + (restaurant.id % 20)}-${35 + (restaurant.id % 20)} min" }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            Box(modifier = Modifier
                .fillMaxWidth()
                .height(140.dp)) { // Compact height
                val imageUrl = ImageUtils.resolveImageUrl(restaurant.bannerUrl ?: restaurant.logo)
                
                SubcomposeAsyncImage(
                    model = imageUrl,
                    contentDescription = restaurant.name,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                    loading = {
                        Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceVariant))
                    },
                    error = {
                        RestaurantDesignPlaceholder(restaurant.name, showName = false)
                    },
                    success = { state ->
                        Image(
                            painter = state.painter,
                            contentDescription = restaurant.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }
                )
                
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp),
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
                            fontWeight = FontWeight.Bold,
                            color = Color.Black
                        )
                        Icon(Icons.Default.Star, null, modifier = Modifier.size(10.dp), tint = MaterialTheme.colorScheme.primary)
                    }
                }
            }

            Column(modifier = Modifier.padding(Dimens.PaddingSmall)) {
                Text(
                    text = restaurant.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black
                )
                val category = if (restaurant.id % 2 == 0) "North Indian" else "Cafe & Desserts"
                Text(
                    text = "$rating • $category • $deliveryTime",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun TiffzyRestaurantSmallCard(
    restaurant: Restaurant,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val rating = "4.2"

    Surface(
        modifier = modifier
            .width(140.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        color = Color(0xFFFAFAFA),
        border = androidx.compose.foundation.BorderStroke(0.5.dp, Color(0xFFEEEEEE))
    ) {
        Column {
            Box(modifier = Modifier.height(80.dp).fillMaxWidth()) {
                val imageUrl = ImageUtils.resolveImageUrl(restaurant.logo ?: restaurant.bannerUrl)
                
                SubcomposeAsyncImage(
                    model = imageUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                    loading = {
                        Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceVariant))
                    },
                    error = {
                        RestaurantDesignPlaceholder(restaurant.name, showName = false)
                    },
                    success = { state ->
                        Image(
                            painter = state.painter,
                            contentDescription = restaurant.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }
                )
                
                Surface(
                    modifier = Modifier.align(Alignment.TopEnd).padding(4.dp),
                    color = Color.Black.copy(alpha = 0.7f),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Row(modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(rating, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Spacer(modifier = Modifier.width(2.dp))
                        Icon(Icons.Default.Star, null, modifier = Modifier.size(9.dp), tint = TiffzyOrange)
                    }
                }
            }
            
            Column(modifier = Modifier.padding(6.dp)) {
                Text(
                    text = restaurant.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = if (restaurant.id % 2 == 0) "Pizza, Burger" else "Biryani, Indian",
                    fontSize = 10.sp,
                    color = Color.Gray,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun TiffzyDiscoveryItemCard(
    item: SearchItem,
    onClick: () -> Unit,
    onAddClick: () -> Unit,
    modifier: Modifier = Modifier,
    quantity: Int = 0,
    onIncrease: () -> Unit = onAddClick,
    onDecrease: () -> Unit = {}
) {
    Surface(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() },
        color = Color.Transparent
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            // Food Image + Rating Overlay
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(95.dp)
                    .clip(RoundedCornerShape(12.dp))
            ) {
                AsyncImage(
                    model = ImageUtils.resolveImageUrl(item.image),
                    contentDescription = item.name,
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop,
                    placeholder = androidx.compose.ui.graphics.vector.rememberVectorPainter(Icons.Default.Restaurant),
                    error = androidx.compose.ui.graphics.vector.rememberVectorPainter(Icons.Default.Restaurant)
                )
                
                // Restaurant name at TOP of image (plain text, NO background)
                Text(
                    text = item.restaurant.name,
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = androidx.compose.ui.text.TextStyle(
                        shadow = androidx.compose.ui.graphics.Shadow(
                            color = Color.Black.copy(alpha = 0.85f),
                            offset = androidx.compose.ui.geometry.Offset(1f, 1f),
                            blurRadius = 4f
                        )
                    ),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(start = 6.dp, top = 5.dp, end = 6.dp)
                )

                // Rating Overlay at BOTTOM of image
                if (item.rating != null && item.rating > 0) {
                    Surface(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(4.dp),
                        color = Color.Black.copy(alpha = 0.7f),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = String.format("%.1f", item.rating),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                modifier = Modifier.size(9.dp),
                                tint = TiffzyOrange
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(4.dp))
            
            // Food Name below image
            Text(
                text = item.name,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Price and compact ADD button Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "₹${item.price.toInt()}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                if (quantity > 0) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = Color.White,
                        border = androidx.compose.foundation.BorderStroke(1.dp, TiffzyOrange),
                        modifier = Modifier.height(24.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clickable { onDecrease() },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "-",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TiffzyOrange
                                )
                            }
                            Text(
                                text = "$quantity",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = TiffzyOrange,
                                modifier = Modifier.padding(horizontal = 4.dp)
                            )
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clickable { onIncrease() },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "+",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TiffzyOrange
                                )
                            }
                        }
                    }
                } else {
                    Surface(
                        onClick = onAddClick,
                        shape = RoundedCornerShape(6.dp),
                        color = Color.White,
                        border = androidx.compose.foundation.BorderStroke(1.dp, TiffzyOrange),
                        modifier = Modifier.height(24.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "ADD",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = TiffzyOrange
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Add",
                                tint = TiffzyOrange,
                                modifier = Modifier.size(12.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RestaurantDesignPlaceholder(name: String, showName: Boolean = false) {
    val gradient = Brush.verticalGradient(
        colors = listOf(
            MaterialTheme.colorScheme.primary,
            MaterialTheme.colorScheme.primary.copy(alpha = 0.8f)
        )
    )
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(gradient),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(Dimens.PaddingLarge)
        ) {
            Surface(
                modifier = Modifier.size(64.dp),
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.2f),
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.5f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = name.take(1).uppercase(),
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                        fontFamily = FontFamily.Serif
                    )
                }
            }
            
            if (showName) {
                Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
                Text(
                    text = name.uppercase(),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White.copy(alpha = 0.9f),
                    letterSpacing = 2.sp,
                    textAlign = TextAlign.Center
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
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingSmall).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = ImageUtils.resolveImageUrl(item.image),
                contentDescription = item.name,
                modifier = Modifier.size(80.dp).clip(MaterialTheme.shapes.small).background(MaterialTheme.colorScheme.surfaceVariant),
                contentScale = ContentScale.Crop
            )
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = item.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(text = "${item.restaurant.name} • ${item.restaurant.city}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
                Text(text = "Rs ${item.price.toInt()}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun TiffzyNearbyRestaurantCard(
    restaurant: com.tiffzy.app.data.model.NearbyRestaurant,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .width(200.dp)
            .clickable { onClick() },
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            Box(modifier = Modifier.height(110.dp).fillMaxWidth()) {
                val imageUrl = ImageUtils.resolveImageUrl(restaurant.bannerUrl ?: restaurant.logoUrl)
                SubcomposeAsyncImage(
                    model = imageUrl,
                    contentDescription = restaurant.name,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                    loading = {
                        Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceVariant))
                    },
                    error = {
                        RestaurantDesignPlaceholder(restaurant.name, showName = false)
                    },
                    success = { state ->
                        Image(
                            painter = state.painter,
                            contentDescription = restaurant.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }
                )

                // Distance Badge on top left
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp),
                    color = Color.Black.copy(alpha = 0.7f),
                    shape = MaterialTheme.shapes.extraSmall
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${restaurant.distanceKm} km",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }

                // Open / Closed Badge on top right
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp),
                    color = if (restaurant.isOpen) Color(0xFF10B981) else Color(0xFF4B5563),
                    shape = MaterialTheme.shapes.extraSmall
                ) {
                    Text(
                        text = if (restaurant.isOpen) "Open" else "Closed",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }

                // ETA on bottom left
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(6.dp),
                    color = Color.Black.copy(alpha = 0.65f),
                    shape = MaterialTheme.shapes.extraSmall
                ) {
                    Text(
                        text = "${restaurant.estimatedDeliveryMinutes} mins",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Column(
                modifier = Modifier
                    .padding(Dimens.PaddingMedium)
                    .fillMaxWidth()
            ) {
                Text(
                    text = restaurant.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                Spacer(modifier = Modifier.height(2.dp))
                
                Text(
                    text = listOfNotNull(restaurant.city, restaurant.state).joinToString(", ").ifEmpty { "Delivery within ${restaurant.deliveryRadiusKm.toInt()} km" },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
