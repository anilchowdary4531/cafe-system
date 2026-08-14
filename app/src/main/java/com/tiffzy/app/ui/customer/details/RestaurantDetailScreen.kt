package com.tiffzy.app.ui.customer.details

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.SubcomposeAsyncImage
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens
import com.tiffzy.app.utils.ImageUtils

import androidx.compose.material.icons.filled.Star
import androidx.compose.runtime.remember
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantDetailScreen(
    slug: String,
    onBack: () -> Unit,
    onViewMenu: (String) -> Unit,
    onLogin: (() -> Unit)? = null,
    viewModel: RestaurantDetailViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(slug) {
        viewModel.loadRestaurantDetails(slug)
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Restaurant Details",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        when (val state = uiState) {
            is RestaurantDetailUiState.Loading -> TiffzyLoadingIndicator()
            is RestaurantDetailUiState.Error -> TiffzyErrorState(
                message = state.message,
                onRetry = { viewModel.loadRestaurantDetails(slug) },
                onLogin = onLogin
            )
            is RestaurantDetailUiState.Success -> {
                val restaurant = state.restaurant
                val rating = remember(restaurant.id) { (40 + (restaurant.id % 10)) / 10.0 }
                val deliveryTime = remember(restaurant.id) { "${25 + (restaurant.id % 20)}-${35 + (restaurant.id % 20)} min" }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .verticalScroll(rememberScrollState())
                ) {
                    // Header Image
                    Box(modifier = Modifier.height(250.dp).fillMaxWidth()) {
                        SubcomposeAsyncImage(
                            model = ImageUtils.resolveImageUrl(restaurant.bannerUrl ?: restaurant.logo),
                            contentDescription = restaurant.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop,
                            loading = {
                                Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceVariant))
                            },
                            error = {
                                RestaurantDesignPlaceholder(restaurant.name)
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
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.8f))
                                    )
                                )
                        )
                        
                        Column(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(Dimens.PaddingLarge)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    color = Color(0xFFFFD24D),
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
                                        Icon(
                                            imageVector = Icons.Default.Star,
                                            contentDescription = null,
                                            modifier = Modifier.size(12.dp),
                                            tint = Color.Black
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
                                Surface(
                                    color = Color.White.copy(alpha = 0.2f),
                                    shape = MaterialTheme.shapes.small
                                ) {
                                    Text(
                                        text = deliveryTime,
                                        style = MaterialTheme.typography.labelMedium,
                                        color = Color.White,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                            
                            Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
                            
                            Text(
                                text = restaurant.name,
                                style = MaterialTheme.typography.displaySmall,
                                color = Color.White,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }

                    Column(modifier = Modifier.padding(Dimens.PaddingLarge)) {
                        val address = listOfNotNull(
                            restaurant.addressLine1,
                            restaurant.city,
                            restaurant.state,
                            restaurant.pincode
                        ).joinToString(", ")
                        
                        if (address.isNotBlank()) {
                            InfoRow(icon = Icons.Default.LocationOn, text = address)
                        }

                        if (!restaurant.phone.isNullOrBlank()) {
                            InfoRow(icon = Icons.Default.Phone, text = restaurant.phone)
                        }
                        if (!restaurant.email.isNullOrBlank()) {
                            InfoRow(icon = Icons.Default.Email, text = restaurant.email)
                        }

                        Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                        // Status info
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = if (restaurant.isActive) 
                                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.1f)
                                else 
                                    MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.1f)
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(Dimens.PaddingMedium),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .background(
                                            if (restaurant.isActive) Color.Green else Color.Red,
                                            shape = MaterialTheme.shapes.extraSmall
                                        )
                                )
                                Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
                                Text(
                                    text = if (restaurant.isActive) "Open Now" else "Currently Closed",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (restaurant.isActive) 
                                        MaterialTheme.colorScheme.onSurface 
                                    else 
                                        MaterialTheme.colorScheme.error
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                        TiffzyPrimaryButton(
                            text = "Browse Menu",
                            onClick = { onViewMenu(restaurant.slug) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun InfoRow(icon: ImageVector, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = Dimens.PaddingSmall)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(Dimens.PaddingMedium))
        Text(
            text = text,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
