package com.tiffzy.app.ui.customer.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import kotlinx.coroutines.delay
import com.tiffzy.app.data.model.BannerResponse
import coil.compose.AsyncImage
import com.tiffzy.app.R
import com.tiffzy.app.ui.auth.AuthUiState
import com.tiffzy.app.ui.auth.AuthViewModel
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens
import com.tiffzy.app.utils.ImageUtils

data class CategoryItemData(
    val name: String,
    val imageUrl: String? = null
)

@Composable
fun getCategoryIcon(name: String): ImageVector {
    return when (name.lowercase()) {
        "all" -> Icons.Outlined.Restaurant
        "pizza" -> Icons.Outlined.LocalPizza
        "burger" -> Icons.Outlined.LunchDining
        "biryani", "briyani", "rice", "sweek hot briyani" -> Icons.Outlined.RiceBowl
        "drinks", "beverages", "cool drinks", "cool beverages" -> Icons.Outlined.LocalDrink
        "coffee", "hot beverages", "cofee" -> Icons.Outlined.Coffee
        "dessert", "desserts", "cake", "sweet" -> Icons.Outlined.Cake
        "fast food", "sandwich", "fries", "french fries" -> Icons.Outlined.Fastfood
        "ice cream" -> Icons.Outlined.Icecream
        "soup", "soups" -> Icons.Outlined.SoupKitchen
        "food" -> Icons.Outlined.DinnerDining
        else -> Icons.Outlined.Restaurant
    }
}

@Composable
fun HomeScreen(
    onLogout: () -> Unit,
    onChangeLocation: () -> Unit,
    onRestaurantClick: (String) -> Unit,
    onViewProfile: () -> Unit,
    onNotificationsClick: () -> Unit,
    onScanClick: () -> Unit,
    onDeleteAccount: () -> Unit = {},
    onNavigateToWeb: (String, String) -> Unit = { _, _ -> },
    locationName: String? = null,
    viewModel: HomeViewModel = viewModel(),
    authViewModel: AuthViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val authState by authViewModel.uiState.collectAsState()

    LaunchedEffect(authState) {
        if (authState is AuthUiState.Idle) {
            onLogout()
        }
    }

    Scaffold(
        topBar = { 
            TiffzyTopBar(
                title = "Tiffzy",
                subtitle = locationName ?: "Set Location",
                onSubtitleClick = onChangeLocation,
                onNotificationsClick = onNotificationsClick
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
            when (val state = uiState) {
                is HomeUiState.Loading -> {
                    TiffzyLoadingIndicator()
                }
                is HomeUiState.Success -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(0.dp), // Zero spacing between rows
                        contentPadding = PaddingValues(
                            bottom = Dimens.PaddingExtraLarge
                        )
                    ) {
                        // 1. Promo Banner Slider
                        item {
                            PromoBannerSlider(
                                banners = state.banners,
                                onBannerClick = { actionUrl: String? ->
                                    if (actionUrl != null) {
                                        if (actionUrl.startsWith("/")) {
                                            onRestaurantClick(actionUrl.substringAfterLast("/"))
                                        } else {
                                            onNavigateToWeb("Promotion", actionUrl)
                                        }
                                    }
                                },
                                modifier = Modifier
                                    .padding(horizontal = Dimens.PaddingMedium)
                                    .padding(top = Dimens.PaddingSmall)
                            )
                        }

                        // 2. Popular Categories (Circles)
                        item {
                            SectionHeader(title = "Popular Categories", modifier = Modifier.padding(horizontal = Dimens.PaddingMedium))
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium),
                                contentPadding = PaddingValues(horizontal = Dimens.PaddingMedium, vertical = Dimens.PaddingSmall)
                            ) {
                                item {
                                    HomeScreenCategoryItem(CategoryItemData("All", null)) {
                                        viewModel.search("")
                                    }
                                }
                                items(state.categories) { category ->
                                    HomeScreenCategoryItem(CategoryItemData(category.name, category.imageUrl)) {
                                        viewModel.search(category.name)
                                    }
                                }
                            }
                        }

                        // 3. Top Restaurants (Horizontal Cards)
                        if (state.restaurants.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    title = "Top Restaurants",
                                    actionText = "See all",
                                    onActionClick = { /* See all */ },
                                    modifier = Modifier.padding(horizontal = Dimens.PaddingMedium)
                                )
                                LazyRow(
                                    horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium),
                                    contentPadding = PaddingValues(horizontal = Dimens.PaddingMedium, vertical = Dimens.PaddingSmall)
                                ) {
                                    items(state.restaurants.take(5)) { restaurant ->
                                        TiffzyRestaurantSmallCard(
                                            restaurant = restaurant,
                                            onClick = { onRestaurantClick(restaurant.slug) }
                                        )
                                    }
                                }
                            }
                        }

                        // 4. Main Feed (Explore) - Grouped by Category with Horizontal Scroll
                        if (state.groupedItems.isNotEmpty()) {
                            state.groupedItems.forEach { (category, categoryItems) ->
                                item {
                                    SectionHeader(
                                        title = category,
                                        modifier = Modifier.padding(horizontal = Dimens.PaddingMedium)
                                    )
                                    LazyRow(
                                        horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingSmall),
                                        contentPadding = PaddingValues(
                                            start = Dimens.PaddingMedium,
                                            end = Dimens.PaddingMedium,
                                            bottom = 4.dp
                                        )
                                    ) {
                                        items(categoryItems) { item ->
                                            TiffzyDiscoveryItemCard(
                                                item = item,
                                                onClick = { onRestaurantClick(item.restaurant.slug) },
                                                onAddClick = { viewModel.addToCart(item) },
                                                modifier = Modifier.width(120.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        } else if (state.items.isNotEmpty()) {
                            // Grid fallback if grouping fails but items exist
                            item {
                                SectionHeader(title = "Explore Dishes", modifier = Modifier.padding(horizontal = Dimens.PaddingMedium))
                            }
                            val chunkedItems = state.items.chunked(2)
                            items(chunkedItems) { rowItems ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = Dimens.PaddingMedium),
                                    horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
                                ) {
                                    rowItems.forEach { item ->
                                        Box(modifier = Modifier.weight(1f)) {
                                            TiffzyDiscoveryItemCard(
                                                item = item,
                                                onClick = { onRestaurantClick(item.restaurant.slug) },
                                                onAddClick = { viewModel.addToCart(item) }
                                            )
                                        }
                                    }
                                    if (rowItems.size == 1) Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        } else {
                            // Fallback to restaurants if no items
                            item {
                                SectionHeader(title = "Explore Restaurants", modifier = Modifier.padding(horizontal = Dimens.PaddingMedium))
                            }

                            items(state.restaurants) { restaurant ->
                                Box(modifier = Modifier.padding(horizontal = Dimens.PaddingMedium)) {
                                    TiffzyRestaurantCard(
                                        restaurant = restaurant,
                                        onClick = { onRestaurantClick(restaurant.slug) }
                                    )
                                }
                            }
                        }

                        // Footer
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
                                onDownloadAndroidClick = { onNavigateToWeb("Tiffzy App", "https://play.google.com/apps/testing/com.tiffzy.app") },
                                onDeleteAccountClick = onDeleteAccount
                            )
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

@Composable
fun HomeScreenCategoryItem(
    category: CategoryItemData,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(56.dp) // Decreased from 64.dp
            .clickable { onClick() }
    ) {
        Surface(
            modifier = Modifier.size(48.dp), // Decreased from 56.dp
            shape = CircleShape,
            color = if (category.imageUrl.isNullOrEmpty()) 
                MaterialTheme.colorScheme.primary.copy(alpha = 0.1f) 
            else 
                MaterialTheme.colorScheme.surface,
            tonalElevation = if (category.imageUrl.isNullOrEmpty()) 0.dp else 2.dp,
            shadowElevation = if (category.imageUrl.isNullOrEmpty()) 0.dp else 4.dp
        ) {
            Box(contentAlignment = Alignment.Center) {
                if (!category.imageUrl.isNullOrEmpty()) {
                    AsyncImage(
                        model = ImageUtils.resolveImageUrl(category.imageUrl),
                        contentDescription = category.name,
                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                        contentScale = ContentScale.Crop,
                        error = rememberVectorPainter(getCategoryIcon(category.name)),
                        placeholder = rememberVectorPainter(getCategoryIcon(category.name))
                    )
                } else {
                    Icon(
                        imageVector = getCategoryIcon(category.name),
                        contentDescription = category.name,
                        modifier = Modifier.size(24.dp), // Decreased from 28.dp
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(4.dp)) // Decreased from 6.dp
        Text(
            text = category.name,
            style = MaterialTheme.typography.labelSmall, // Changed to labelSmall for compact look
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun PromoBannerSlider(
    banners: List<BannerResponse>,
    onBannerClick: (String?) -> Unit,
    modifier: Modifier = Modifier
) {
    if (banners.isEmpty()) {
        // Show default banner if none from server
        PromoBanner(modifier = modifier)
        return
    }

    val pagerState = rememberPagerState(pageCount = { banners.size })
    
    // Auto-scroll logic
    LaunchedEffect(Unit) {
        while (true) {
            delay(5000)
            if (banners.size > 1) {
                val nextTarget = (pagerState.currentPage + 1) % banners.size
                pagerState.animateScrollToPage(nextTarget)
            }
        }
    }

    Column(modifier = modifier) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxWidth()
                .height(140.dp)
                .clip(MaterialTheme.shapes.extraLarge)
        ) { page ->
            val banner = banners[page]
            Card(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable { onBannerClick(banner.actionUrl) },
                shape = MaterialTheme.shapes.extraLarge,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    AsyncImage(
                        model = ImageUtils.resolveImageUrl(banner.imageUrl),
                        contentDescription = banner.title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                    
                    if (!banner.title.isNullOrEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.6f))
                                    )
                                )
                        )
                        Text(
                            text = banner.title,
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(Dimens.PaddingMedium),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            color = Color.White
                        )
                    }
                }
            }
        }
        
        // Dots indicator
        if (banners.size > 1) {
            Row(
                modifier = Modifier
                    .padding(top = 8.dp)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                repeat(banners.size) { iteration ->
                    val color = if (pagerState.currentPage == iteration) 
                        MaterialTheme.colorScheme.primary 
                    else 
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                    Box(
                        modifier = Modifier
                            .padding(2.dp)
                            .clip(CircleShape)
                            .background(color)
                            .size(6.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun PromoBanner(modifier: Modifier = Modifier) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(140.dp), // Decreased from 160.dp
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Image(
                painter = painterResource(id = R.drawable.baked_goods_1),
                contentDescription = null,
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(0.6f)
                    .align(Alignment.CenterEnd),
                contentScale = ContentScale.Crop
            )
            
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(
                                MaterialTheme.colorScheme.primary,
                                MaterialTheme.colorScheme.primary,
                                Color.Transparent
                            )
                        )
                    )
            )

            Column(
                modifier = Modifier
                    .fillMaxHeight()
                    .padding(Dimens.PaddingLarge)
                    .fillMaxWidth(0.6f),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "Tasty Food Delivered Fast",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                    lineHeight = 32.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Order now and enjoy delicious meals!",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.8f)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { /* Action */ },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Black),
                    shape = MaterialTheme.shapes.medium,
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text("Order Now", color = Color.White, fontWeight = FontWeight.Bold)
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp).padding(start = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun SectionHeader(
    title: String,
    actionText: String? = null,
    onActionClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 0.dp), // Removed all top padding
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface
        )
        if (actionText != null) {
            Text(
                text = actionText,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable { onActionClick() }
            )
        }
    }
}
