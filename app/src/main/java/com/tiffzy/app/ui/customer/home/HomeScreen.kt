package com.tiffzy.app.ui.customer.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import com.tiffzy.app.R
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.ui.auth.AuthUiState
import com.tiffzy.app.ui.auth.AuthViewModel
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens
import com.tiffzy.app.utils.ImageUtils

@Composable
fun HomeScreen(
    onLogout: () -> Unit,
    onChangeLocation: () -> Unit,
    onRestaurantClick: (String) -> Unit,
    onViewProfile: () -> Unit,
    onScanClick: () -> Unit,
    onDeleteAccount: () -> Unit = {},
    onNavigateToWeb: (String, String) -> Unit = { _, _ -> },
    locationName: String? = null,
    viewModel: HomeViewModel = viewModel(),
    authViewModel: AuthViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val authState by authViewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(authState) {
        if (authState is AuthUiState.Idle) {
            onLogout()
        }
    }

    Scaffold(
        topBar = { 
            TiffzyTopBar(
                title = "Tiffzy",
                subtitle = locationName ?: "Select Location",
                onSubtitleClick = onChangeLocation,
                navigationIcon = {
                    Box(modifier = Modifier.padding(start = Dimens.PaddingMedium)) {
                        BrandLogo(modifier = Modifier.size(32.dp))
                    }
                },
                actions = {
                    IconButton(onClick = onChangeLocation) {
                        Icon(Icons.Default.LocationOn, contentDescription = "Select Location")
                    }
                    IconButton(onClick = onScanClick) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "Scan QR Code")
                    }
                    IconButton(onClick = onViewProfile) {
                        Icon(Icons.Default.AccountCircle, contentDescription = "Profile")
                    }
                }
            ) 
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
        ) {
            // Search Bar
            Box(modifier = Modifier.padding(horizontal = 4.dp, vertical = Dimens.PaddingMedium)) {
                TiffzySearchBar(
                    value = searchQuery,
                    onValueChange = { 
                        searchQuery = it
                        viewModel.search(it)
                    },
                    placeholder = stringResource(R.string.search_placeholder)
                )
            }

            when (val state = uiState) {
                is HomeUiState.Loading -> {
                    TiffzyLoadingIndicator()
                }
                is HomeUiState.Success -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium),
                        contentPadding = PaddingValues(
                            start = 4.dp,
                            end = 4.dp,
                            bottom = Dimens.PaddingExtraLarge
                        )
                    ) {
                        // Zomato-style Category Bar
                        item {
                            Text(
                                text = stringResource(R.string.whats_on_your_mind),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(start = 8.dp, bottom = Dimens.PaddingSmall)
                            )
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingLarge),
                                contentPadding = PaddingValues(vertical = Dimens.PaddingSmall)
                            ) {
                                item {
                                    val firstRestaurantImg = state.restaurants.firstOrNull()?.bannerUrl ?: state.restaurants.firstOrNull()?.logo
                                    HomeScreenCategoryItem(CategoryItemData("All", com.tiffzy.app.R.drawable.baked_goods_1, firstRestaurantImg)) {
                                        searchQuery = ""
                                        viewModel.search("")
                                    }
                                }
                                items(state.categories) { category ->
                                    HomeScreenCategoryItem(CategoryItemData(category.name, com.tiffzy.app.R.drawable.baked_goods_2, category.imageUrl)) {
                                        searchQuery = category.name
                                        viewModel.search(category.name)
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
                        }

                        if (state.isSearching) {
                            if (state.restaurants.isEmpty() && state.items.isEmpty()) {
                                item {
                                    TiffzyEmptyState(message = stringResource(R.string.no_results_found, searchQuery))
                                }
                            } else {
                                if (state.restaurants.isNotEmpty()) {
                                    item {
                                        Text(
                                            text = stringResource(R.string.restaurants),
                                            style = MaterialTheme.typography.titleLarge,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = Dimens.PaddingSmall)
                                        )
                                    }
                                }
                                
                                items(state.restaurants) { restaurant ->
                                    TiffzyRestaurantCard(
                                        restaurant = restaurant,
                                        onClick = { onRestaurantClick(restaurant.slug) }
                                    )
                                }

                                if (state.items.isNotEmpty()) {
                                    item {
                                        Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
                                        Text(
                                            text = stringResource(R.string.dishes),
                                            style = MaterialTheme.typography.titleLarge,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = Dimens.PaddingSmall)
                                        )
                                    }
                                    
                                    items(state.items) { item ->
                                        TiffzySearchItemCard(
                                            item = item,
                                            onClick = { onRestaurantClick(item.restaurant.slug) }
                                        )
                                    }
                                }
                            }
                        } else {
                            // Main Feed
                            if (state.restaurants.isEmpty()) {
                                item {
                                    TiffzyEmptyState(
                                        message = "No restaurants available in your area yet.",
                                        actionLabel = "Browse all",
                                        onAction = { viewModel.loadRestaurants() }
                                    )
                                }
                            } else {
                                item {
                                    Text(
                                        text = stringResource(R.string.restaurants_to_explore),
                                        style = MaterialTheme.typography.titleLarge,
                                        modifier = Modifier.padding(start = 8.dp, top = Dimens.PaddingSmall)
                                    )
                                }
                                
                                items(state.restaurants) { restaurant ->
                                    TiffzyRestaurantCard(
                                        restaurant = restaurant,
                                        onClick = { onRestaurantClick(restaurant.slug) }
                                    )
                                }
                                
                                item {
                                    Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
                                    TiffzyFooter(
                                        onAboutUsClick = { onNavigateToWeb("About Us", "https://www.tiffzy.com/about-us") },
                                        onContactUsClick = { onNavigateToWeb("Contact Us", "https://www.tiffzy.com/contact-us") },
                                        onHelpCenterClick = { onNavigateToWeb("Help Center", "https://www.tiffzy.com/help-center") },
                                        onTermsClick = { onNavigateToWeb("Terms", "https://www.tiffzy.com/terms") },
                                        onPrivacyClick = { onNavigateToWeb("Privacy", "https://www.tiffzy.com/privacy") },
                                        onRefundPolicyClick = { onNavigateToWeb("Refund Policy", "https://www.tiffzy.com/refund-policy") },
                                        onQrOrderingClick = { onNavigateToWeb("QR Ordering", "https://www.tiffzy.com/qr-ordering") },
                                        onPosDashboardClick = { onNavigateToWeb("POS Dashboard", "https://www.tiffzy.com/pos-dashboard") },
                                        onAnalyticsClick = { onNavigateToWeb("Analytics", "https://www.tiffzy.com/analytics") },
                                        onInventoryClick = { onNavigateToWeb("Inventory", "https://www.tiffzy.com/inventory") },
                                        onShippingPolicyClick = { onNavigateToWeb("Shipping Policy", "https://www.tiffzy.com/shipping-policy") },
                                        onLegalDisclosureClick = { onNavigateToWeb("Legal Info", "https://www.tiffzy.com/legal-disclosure") },
                                        onDeleteAccountClick = onDeleteAccount
                                    )
                                }
                            }
                        }
                    }
                }
                is HomeUiState.Error -> {
                    TiffzyErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadRestaurants() },
                        onLogin = onLogout
                    )
                }
            }
        }
    }
}

data class CategoryItemData(val name: String, val imageRes: Int, val imageUrl: String? = null)

@Composable
fun HomeScreenCategoryItem(
    category: CategoryItemData,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(80.dp)
            .clickable { onClick() }
    ) {
        Surface(
            modifier = Modifier.size(70.dp),
            shape = androidx.compose.foundation.shape.CircleShape,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ) {
            if (category.imageUrl != null) {
                AsyncImage(
                    model = ImageUtils.resolveImageUrl(category.imageUrl),
                    contentDescription = category.name,
                    modifier = Modifier.fillMaxSize().clip(androidx.compose.foundation.shape.CircleShape),
                    contentScale = ContentScale.Crop,
                    placeholder = painterResource(id = category.imageRes),
                    error = painterResource(id = category.imageRes)
                )
            } else {
                Image(
                    painter = painterResource(id = category.imageRes),
                    contentDescription = category.name,
                    modifier = Modifier.fillMaxSize().clip(androidx.compose.foundation.shape.CircleShape),
                    contentScale = ContentScale.Crop
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = category.name,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
    }
}
