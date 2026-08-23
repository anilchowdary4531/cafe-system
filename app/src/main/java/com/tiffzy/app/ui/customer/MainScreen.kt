package com.tiffzy.app.ui.customer

import androidx.compose.foundation.clickable
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
) {
    val pagerState = rememberPagerState(initialPage = initialTab.coerceIn(0, bottomNavItems.size - 1)) { bottomNavItems.size }
    val scope = rememberCoroutineScope()
    val lastLocation by locationViewModel.lastSelectedLocation.collectAsState()
    
    val cartItems by CartRepository.getInstance().cartItems.collectAsState()

    // Automatically reload restaurants when location changes or on initial load
    LaunchedEffect(lastLocation) {
        if (lastLocation != null) {
            homeViewModel.loadRestaurants(lastLocation!!.latitude, lastLocation!!.longitude)
        } else {
            homeViewModel.loadRestaurants() // Default load if no location
        }
    }

    Scaffold(
        bottomBar = {
            Column {
                // Persistent Cart Bar
                if (cartItems.isNotEmpty() && (pagerState.currentPage != 3)) {
                    val totalAmount = cartItems.sumOf { it.menuItem.price * it.quantity }
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { 
                                scope.launch { 
                                    pagerState.scrollToPage(3) 
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
                
                NavigationBar(
                    modifier = Modifier.height(80.dp), // Increased height for better visibility
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.primary,
                    tonalElevation = 8.dp, // Added shadow for attractiveness
                    windowInsets = NavigationBarDefaults.windowInsets // Properly handle system bottom bar
                ) {
                    bottomNavItems.forEachIndexed { index, item ->
                        val isSelected = pagerState.currentPage == index
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = if (isSelected) item.selectedIcon else item.unselectedIcon,
                                    contentDescription = item.label,
                                    modifier = Modifier.size(24.dp)
                                )
                            },
                            label = { 
                                Text(
                                    item.label,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium
                                )
                            },
                            selected = isSelected,
                            onClick = {
                                scope.launch {
                                    pagerState.scrollToPage(index)
                                }
                            },
                            alwaysShowLabel = true,
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = MaterialTheme.colorScheme.primary,
                                selectedTextColor = MaterialTheme.colorScheme.primary,
                                unselectedIconColor = Color.Gray,
                                unselectedTextColor = Color.Gray,
                                indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
                            )
                        )
                    }
                }
            }
        },
        contentWindowInsets = WindowInsets(0, 0, 0, 0)
    ) { innerPadding ->
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.padding(bottom = innerPadding.calculateBottomPadding()),
            beyondViewportPageCount = 0
        ) { page ->
            when (page) {
                0 -> HomeScreen(
                    onLogout = onLogout,
                    onChangeLocation = onChangeLocation,
                    onRestaurantClick = onRestaurantClick,
                    onViewProfile = { 
                        scope.launch { pagerState.scrollToPage(4) } 
                    },
                    onNotificationsClick = onNotificationsClick,
                    onScanClick = onScanClick,
                    onDeleteAccount = onDeleteAccount,
                    onNavigateToWeb = onNavigateToWeb,
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
                    onBack = { /* Not needed in pager */ },
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
                    onBack = { /* Not needed */ },
                    onNavigateToWeb = onNavigateToWeb,
                    authViewModel = authViewModel
                )
            }
        }
    }
}
