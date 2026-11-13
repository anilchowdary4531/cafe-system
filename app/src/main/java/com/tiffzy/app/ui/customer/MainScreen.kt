package com.tiffzy.app.ui.customer

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.navigation.bottomNavItems
import com.tiffzy.app.ui.auth.AuthViewModel
import com.tiffzy.app.ui.customer.cart.CartScreen
import com.tiffzy.app.ui.customer.home.HomeScreen
import com.tiffzy.app.ui.customer.home.HomeViewModel
import com.tiffzy.app.ui.customer.home.LocationViewModel
import com.tiffzy.app.ui.customer.order.OrdersScreen
import com.tiffzy.app.ui.customer.profile.ProfileScreen
import com.tiffzy.app.ui.customer.search.SearchScreen
import kotlinx.coroutines.launch
import com.tiffzy.app.data.repository.CartRepository
import com.tiffzy.app.ui.theme.Dimens
import com.tiffzy.app.ui.theme.TiffzyOrange

@Composable
fun MainScreen(
    onLogout: () -> Unit,
    onChangeLocation: () -> Unit,
    onRestaurantClick: (String) -> Unit,
    onNotificationsClick: () -> Unit,
    onScanClick: () -> Unit,
    onDeleteAccount: () -> Unit,
    onNavigateToWeb: (String, String) -> Unit,
    onOrderClick: (Int) -> Unit,
    onCheckout: () -> Unit,
    onEditProfile: () -> Unit,
    onFavoritesClick: () -> Unit,
    onPayLaterClick: () -> Unit,
    onSettingsClick: () -> Unit,
    locationName: String?,
    authViewModel: AuthViewModel,
    homeViewModel: HomeViewModel = viewModel(),
    initialTab: Int = 0,
    locationViewModel: LocationViewModel,
    onMapClick: () -> Unit = {},
    onWalletClick: () -> Unit = {},
    onAddressesClick: () -> Unit = {}
) {
    val pagerState = rememberPagerState(initialPage = initialTab.coerceIn(0, bottomNavItems.size - 1)) { bottomNavItems.size }
    val scope = rememberCoroutineScope()
    val lastLocation by locationViewModel.lastSelectedLocation.collectAsState()
    val cartItems by CartRepository.getInstance().cartItems.collectAsState()

    // Handle initialTab changes from external navigation
    LaunchedEffect(initialTab) {
        val target = initialTab.coerceIn(0, bottomNavItems.size - 1)
        if (pagerState.currentPage != target) {
            pagerState.animateScrollToPage(target)
        }
    }

    // Hardware/System back button handler: If not on Home, go to Home tab
    BackHandler(enabled = pagerState.currentPage != 0) {
        scope.launch {
            pagerState.animateScrollToPage(0)
        }
    }

    // Automatically reload restaurants when location changes
    LaunchedEffect(lastLocation) {
        if (lastLocation != null) {
            homeViewModel.loadRestaurants(lastLocation!!.latitude, lastLocation!!.longitude)
        } else {
            homeViewModel.loadRestaurants()
        }
    }

    Scaffold(
        bottomBar = {
            Column {
                // Persistent Cart Bar
                if (cartItems.isNotEmpty() && pagerState.currentPage != 3) {
                    val totalAmount = cartItems.sumOf { it.menuItem.price * it.quantity }
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { 
                                scope.launch { 
                                    pagerState.animateScrollToPage(3) 
                                } 
                            },
                        color = MaterialTheme.colorScheme.primary,
                        tonalElevation = 8.dp,
                        shadowElevation = 10.dp,
                    ) {
                        Row(
                            modifier = Modifier
                                .padding(horizontal = Dimens.PaddingLarge, vertical = 8.dp)
                                .fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column {
                                Text(
                                    text = "${cartItems.size} ITEMS",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color.White.copy(alpha = 0.8f),
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    text = "Rs ${totalAmount.toInt()}",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Color.White,
                                    fontWeight = FontWeight.Black
                                )
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "VIEW CART",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = Color.White,
                                    fontWeight = FontWeight.Black
                                )
                                Icon(
                                    imageVector = Icons.Default.ShoppingCart,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.padding(start = 8.dp).size(20.dp)
                                )
                            }
                        }
                    }
                }
                
                // Bottom Navigation Bar
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color.White,
                    shadowElevation = 6.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(42.dp),
                            horizontalArrangement = Arrangement.SpaceAround,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            bottomNavItems.forEachIndexed { index, item ->
                                val isSelected = pagerState.currentPage == index
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxHeight()
                                        .clickable(
                                            interactionSource = remember { MutableInteractionSource() },
                                            indication = null
                                        ) {
                                            scope.launch {
                                                pagerState.animateScrollToPage(index)
                                            }
                                        },
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Icon(
                                        imageVector = if (isSelected) item.selectedIcon else item.unselectedIcon,
                                        contentDescription = item.label,
                                        tint = if (isSelected) TiffzyOrange else Color(0xFF757575),
                                        modifier = Modifier.size(22.dp)
                                    )
                                    Spacer(modifier = Modifier.height(1.dp))
                                    Text(
                                        text = item.label,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontSize = 10.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) TiffzyOrange else Color(0xFF757575),
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        contentWindowInsets = WindowInsets(0, 0, 0, 0)
    ) { innerPadding ->
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = innerPadding.calculateBottomPadding()),
            beyondViewportPageCount = 1
        ) { page ->
            when (page) {
                0 -> HomeScreen(
                    onLogout = onLogout,
                    onChangeLocation = onChangeLocation,
                    onRestaurantClick = onRestaurantClick,
                    onViewProfile = { 
                        scope.launch { pagerState.animateScrollToPage(4) } 
                    },
                    onNotificationsClick = onNotificationsClick,
                    onScanClick = onScanClick,
                    onDeleteAccount = onDeleteAccount,
                    onNavigateToWeb = onNavigateToWeb,
                    onSearchClick = {
                        scope.launch { pagerState.animateScrollToPage(1) }
                    },
                    onMapClick = onMapClick,
                    locationName = locationName,
                    viewModel = homeViewModel,
                    authViewModel = authViewModel
                )
                1 -> SearchScreen(
                    onRestaurantClick = onRestaurantClick,
                    viewModel = homeViewModel
                )
                2 -> OrdersScreen(
                    onOrderClick = onOrderClick,
                    onBack = { 
                        scope.launch { pagerState.animateScrollToPage(0) }
                    },
                    onReorder = onRestaurantClick
                )
                3 -> CartScreen(
                    onNavigateToMenu = onRestaurantClick,
                    onCheckout = onCheckout
                )
                4 -> ProfileScreen(
                    onEditProfile = onEditProfile,
                    onOrdersClick = { 
                        scope.launch { pagerState.animateScrollToPage(2) }
                    },
                    onFavoritesClick = onFavoritesClick,
                    onPayLaterClick = onPayLaterClick,
                    onNotificationsClick = onNotificationsClick,
                    onSettingsClick = onSettingsClick,
                    onDeleteAccount = onDeleteAccount,
                    onLogout = onLogout,
                    onBack = { 
                        scope.launch { pagerState.animateScrollToPage(0) }
                    },
                    onWalletClick = onWalletClick,
                    onAddressesClick = onAddressesClick,
                    onNavigateToWeb = onNavigateToWeb,
                    authViewModel = authViewModel
                )
            }
        }
    }
}
