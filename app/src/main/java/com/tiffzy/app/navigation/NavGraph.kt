package com.tiffzy.app.navigation

import androidx.activity.ComponentActivity
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.automirrored.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.tiffzy.app.ui.auth.AuthViewModel
import com.tiffzy.app.ui.auth.LoginScreen
import com.tiffzy.app.ui.auth.RegisterScreen
import com.tiffzy.app.ui.auth.DeleteAccountScreen
import com.tiffzy.app.ui.auth.OtpScreen
import com.tiffzy.app.ui.auth.SplashScreen
import com.tiffzy.app.ui.customer.cart.CartScreen
import com.tiffzy.app.ui.customer.checkout.CheckoutScreen
import com.tiffzy.app.ui.customer.details.RestaurantDetailScreen
import com.tiffzy.app.ui.customer.home.HomeScreen
import com.tiffzy.app.ui.customer.home.LocationSelectorScreen
import com.tiffzy.app.ui.customer.home.HomeViewModel
import com.tiffzy.app.ui.customer.home.LocationViewModel
import com.tiffzy.app.ui.customer.search.SearchScreen
import com.tiffzy.app.ui.customer.menu.MenuScreen
import com.tiffzy.app.ui.customer.menu.MenuViewModel
import com.tiffzy.app.ui.customer.menu.MenuViewModelFactory
import com.tiffzy.app.ui.customer.order.OrderSuccessScreen
import com.tiffzy.app.ui.customer.order.OrdersScreen
import com.tiffzy.app.ui.customer.order.OrderDetailScreen
import com.tiffzy.app.ui.customer.order.OrderTrackingScreen
import com.tiffzy.app.ui.customer.profile.ProfileScreen
import com.tiffzy.app.ui.customer.profile.EditProfileScreen
import com.tiffzy.app.ui.customer.profile.SavedAddressesScreen
import com.tiffzy.app.ui.customer.profile.FavoritesScreen
import com.tiffzy.app.ui.customer.profile.PayLaterScreen
import com.tiffzy.app.ui.customer.profile.PayLaterDetailScreen
import com.tiffzy.app.ui.customer.profile.NotificationsScreen
import com.tiffzy.app.ui.customer.profile.SettingsScreen
import com.tiffzy.app.ui.customer.menu.LiveBillScreen
import com.tiffzy.app.ui.customer.scanner.ScannerScreen
import com.tiffzy.app.ui.payment.PaymentActivity
import com.tiffzy.app.ui.components.PlaceholderScreen
import com.tiffzy.app.data.repository.CartRepository
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink

object Routes {
    const val Splash = "splash"
    const val Login = "login"
    const val Register = "register"
    const val Otp = "otp"
    const val Location = "location"
    const val Map = "map"
    const val Home = "home"
    const val Search = "search"
    const val RestaurantDetail = "restaurant/{slug}"
    const val Menu = "menu/{slug}"
    const val Cart = "cart"
    const val Checkout = "checkout"
    const val OrderSuccess = "order_success/{orderNo}/{orderId}"
    const val Orders = "orders"
    const val OrderDetail = "order_detail/{orderId}"
    const val OrderTracking = "order_tracking/{orderId}"
    const val Profile = "profile"
    const val EditProfile = "edit_profile"
    const val SavedAddresses = "saved_addresses"
    const val Favorites = "favorites"
    const val PayLater = "pay_later"
    const val PayLaterDetail = "pay_later/{accountId}"
    const val Notifications = "notifications"
    const val Settings = "settings"
    const val LiveBill = "live_bill/{sessionId}"
    const val Scanner = "scanner"
    const val DeleteAccount = "delete_account"
    const val CompleteProfile = "complete_profile"
    const val Web = "web/{title}/{url}"
    
    fun restaurantDetail(slug: String) = "restaurant/$slug"
    fun menu(slug: String) = "menu/$slug"
    fun orderSuccess(orderNo: String, orderId: String) = "order_success/$orderNo/$orderId"
    fun orderDetail(orderId: Int) = "order_detail/$orderId"
    fun orderTracking(orderId: Int) = "order_tracking/$orderId"
    fun payLaterDetail(accountId: Int) = "pay_later/$accountId"
    fun liveBill(sessionId: Int) = "live_bill/$sessionId"
    fun web(title: String, url: String): String {
        val encodedTitle = android.net.Uri.encode(title)
        val encodedUrl = android.util.Base64.encodeToString(url.toByteArray(), android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP)
        return "web/$encodedTitle/$encodedUrl"
    }
}

data class BottomNavItem(
    val route: String,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(Routes.Home, "Home", Icons.Filled.Home, Icons.Outlined.Home),
    BottomNavItem(Routes.Search, "Search", Icons.Filled.Search, Icons.Outlined.Search),
    BottomNavItem(Routes.Orders, "Orders", Icons.AutoMirrored.Filled.Assignment, Icons.AutoMirrored.Outlined.Assignment),
    BottomNavItem(Routes.Cart, "Cart", Icons.Filled.ShoppingCart, Icons.Outlined.ShoppingCart),
    BottomNavItem(Routes.Profile, "Profile", Icons.Filled.Person, Icons.Outlined.Person)
)

@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController(),
    authViewModel: AuthViewModel = viewModel()
) {
    val activity = LocalActivity.current as ComponentActivity
    val locationViewModel: LocationViewModel = viewModel(activity)
    val homeViewModel: HomeViewModel = viewModel()

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    val showBottomBar = bottomNavItems.any { item ->
        currentDestination?.hierarchy?.any { it.route == item.route } == true
    }

    val navigateToLogin = {
        authViewModel.logout()
        navController.navigate(Routes.Login) {
            popUpTo(0) { inclusive = true }
        }
    }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    modifier = Modifier.height(80.dp), // Increased for visibility
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.primary,
                    tonalElevation = 8.dp,
                    windowInsets = NavigationBarDefaults.windowInsets // Properly handle system bottom bar
                ) {
                    bottomNavItems.forEach { item ->
                        val isSelected = currentDestination?.hierarchy?.any { it.route == item.route } == true
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
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            alwaysShowLabel = true,
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Color(0xFFFE5102),
                                selectedTextColor = Color(0xFFFE5102),
                                unselectedIconColor = Color.Gray,
                                unselectedTextColor = Color.Gray,
                                indicatorColor = Color(0xFFFE5102).copy(alpha = 0.1f)
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Routes.Splash,
            modifier = Modifier.padding(bottom = innerPadding.calculateBottomPadding())
        ) {
        composable(Routes.Splash) {
            SplashScreen(
                viewModel = authViewModel,
                onNavigateToHome = {
                    navController.navigate(Routes.Home) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.navigate(Routes.Login) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                },
                onNavigateToRestaurantDashboard = {
                    navController.navigate(Routes.Login) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.Login) {
            LoginScreen(
                viewModel = authViewModel,
                onOtpSent = {
                    navController.navigate(Routes.Otp)
                },
                onNavigateToRegister = {
                    navController.navigate(Routes.Register)
                },
                onNavigateToDeleteAccount = {
                    navController.navigate(Routes.DeleteAccount)
                },
                onNavigateToCompleteProfile = {
                    navController.navigate(Routes.CompleteProfile)
                },
                onAuthenticated = {
                    navController.navigate(Routes.Home) {
                        popUpTo(Routes.Login) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.Register) {
            RegisterScreen(
                viewModel = authViewModel,
                onAuthenticated = {
                    navController.navigate(Routes.Home) {
                        popUpTo(Routes.Login) { inclusive = true }
                    }
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.DeleteAccount) {
            DeleteAccountScreen(
                viewModel = authViewModel,
                onAccountDeleted = {
                    navController.navigate(Routes.Login) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onBack = { 
                    authViewModel.resetState()
                    navController.popBackStack() 
                }
            )
        }

        composable(Routes.Otp) {
            OtpScreen(
                viewModel = authViewModel,
                onAuthenticated = {
                    navController.navigate(Routes.Home) {
                        popUpTo(Routes.Login) { inclusive = true }
                    }
                },
                onNavigateToCompleteProfile = {
                    navController.navigate(Routes.CompleteProfile)
                },
                onBack = {
                    authViewModel.resetState()
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.CompleteProfile) {
            val info = authViewModel.pendingProfileInfo
            if (info != null) {
                com.tiffzy.app.ui.auth.CompleteProfileScreen(
                    viewModel = authViewModel,
                    partialInfo = info,
                    onAuthenticated = {
                        navController.navigate(Routes.Home) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onBack = {
                        authViewModel.resetState()
                        navController.popBackStack()
                    }
                )
            } else {
                LaunchedEffect(Unit) {
                    navController.popBackStack()
                }
            }
        }

        composable(Routes.Location) {
            LocationSelectorScreen(
                viewModel = locationViewModel,
                onLocationSelected = { _, _ ->
                    navController.navigate(Routes.Home) {
                        popUpTo(Routes.Location) { inclusive = true }
                    }
                },
                onOpenMap = {
                    navController.navigate(Routes.Map)
                }
            )
        }

        composable(Routes.Map) {
            MapScreen(
                onBack = { navController.popBackStack() },
                onRestaurantClick = { slug ->
                    navController.navigate(Routes.menu(slug))
                },
                homeViewModel = homeViewModel
            )
        }

        composable(
            route = Routes.Home
        ) { backStackEntry ->
            val lastLocation by locationViewModel.lastSelectedLocation.collectAsState()
            val locationName = lastLocation?.addressName

            // Refresh home if location changes
            LaunchedEffect(lastLocation) {
                if (lastLocation != null) {
                    homeViewModel.loadRestaurants(lastLocation!!.latitude, lastLocation!!.longitude)
                }
            }

            HomeScreen(
                viewModel = homeViewModel,
                authViewModel = authViewModel,
                onLogout = navigateToLogin,
                locationName = locationName,
                onChangeLocation = {
                    navController.navigate(Routes.Location)
                },
                onMapClick = {
                    navController.navigate(Routes.Map)
                },
                onRestaurantClick = { slug ->
                    navController.navigate(Routes.menu(slug))
                },
                onViewProfile = {
                    navController.navigate(Routes.Profile)
                },
                onNotificationsClick = {
                    navController.navigate(Routes.Notifications)
                },
                onScanClick = {
                    navController.navigate(Routes.Scanner)
                },
                onDeleteAccount = {
                    navController.navigate(Routes.DeleteAccount)
                },
                onNavigateToWeb = { title, url ->
                    navController.navigate(Routes.web(title, url))
                }
            )
        }

        composable(Routes.Search) {
            SearchScreen(
                onRestaurantClick = { slug ->
                    navController.navigate(Routes.menu(slug))
                }
            )
        }

        composable(Routes.Scanner) {
            ScannerScreen(
                onQrScanned = { result ->
                    val uri = android.net.Uri.parse(result)
                    val pathSegments = uri.pathSegments
                    val slug = if (pathSegments.size >= 2 && pathSegments[0] == "r") {
                        pathSegments[1]
                    } else if (pathSegments.size >= 1) {
                        pathSegments[0]
                    } else null
                    
                    val tableNo = uri.getQueryParameter("table")
                    
                    if (slug != null) {
                        CartRepository.getInstance().setTable(tableNo)
                        // If we have a table, we can potentially "Open Table" session here
                        // For now just navigate to menu
                        navController.navigate(Routes.menu(slug)) {
                            popUpTo(Routes.Scanner) { inclusive = true }
                        }
                    }
                },
                onManualSelect = {
                    navController.navigate(Routes.Home)
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.Settings) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onLogout = navigateToLogin,
                onDeleteAccount = { navController.navigate(Routes.DeleteAccount) }
            )
        }

        composable(
            route = Routes.LiveBill,
            arguments = listOf(navArgument("sessionId") { type = NavType.IntType })
        ) { backStackEntry ->
            val sessionId = backStackEntry.arguments?.getInt("sessionId") ?: 0
            LiveBillScreen(
                sessionId = sessionId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.Favorites) {
            FavoritesScreen(
                onBack = { navController.popBackStack() },
                onRestaurantClick = { slug: String -> navController.navigate(Routes.menu(slug)) }
            )
        }

        composable(Routes.PayLater) {
            PayLaterScreen(
                onAccountClick = { accountId -> navController.navigate(Routes.payLaterDetail(accountId)) },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.PayLaterDetail,
            arguments = listOf(navArgument("accountId") { type = NavType.IntType })
        ) { backStackEntry ->
            val accountId = backStackEntry.arguments?.getInt("accountId") ?: 0
            PayLaterDetailScreen(
                accountId = accountId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.Notifications) {
            NotificationsScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.EditProfile) {
            EditProfileScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.SavedAddresses) {
            SavedAddressesScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.RestaurantDetail,
            arguments = listOf(navArgument("slug") { type = NavType.StringType })
        ) { backStackEntry ->
            val slug = backStackEntry.arguments?.getString("slug") ?: ""
            // Redirecting to Menu directly
            LaunchedEffect(slug) {
                navController.navigate(Routes.menu(slug)) {
                    popUpTo(Routes.RestaurantDetail) { inclusive = true }
                }
            }
        }

        composable(
            route = Routes.Menu,
            arguments = listOf(navArgument("slug") { type = NavType.StringType })
        ) { backStackEntry ->
            val slug = backStackEntry.arguments?.getString("slug") ?: ""
            val context = LocalContext.current
            val viewModel: MenuViewModel = viewModel(
                factory = MenuViewModelFactory(context)
            )
            MenuScreen(
                slug = slug,
                onBack = { navController.popBackStack() },
                onViewCart = { navController.navigate(Routes.Cart) },
                onViewLiveBill = { sessionId -> navController.navigate(Routes.liveBill(sessionId)) },
                onLogin = navigateToLogin,
                viewModel = viewModel
            )
        }

        composable(Routes.Cart) {
            CartScreen(
                onNavigateToMenu = { slug ->
                    if (slug.isNotEmpty()) {
                        navController.navigate(Routes.menu(slug)) {
                            popUpTo(Routes.Cart) { inclusive = true }
                        }
                    } else {
                        navController.navigate(Routes.Home) {
                            popUpTo(Routes.Cart) { inclusive = true }
                        }
                    }
                },
                onCheckout = {
                    navController.navigate(Routes.Checkout)
                }
            )
        }

        composable(Routes.Checkout) {
            val context = LocalContext.current
            val cartViewModel: com.tiffzy.app.ui.customer.cart.CartViewModel = viewModel()
            val restaurantSlug = cartViewModel.uiState.collectAsState().value.restaurant?.slug ?: ""
            val checkoutViewModel: com.tiffzy.app.ui.customer.checkout.CheckoutViewModel = viewModel(
                factory = com.tiffzy.app.ui.customer.checkout.CheckoutViewModelFactory(
                    com.tiffzy.app.data.repository.CheckoutRepository(com.tiffzy.app.data.remote.RetrofitClient.apiService),
                    cartViewModel
                )
            )

            CheckoutScreen(
                restaurantSlug = restaurantSlug,
                onBack = { navController.popBackStack() },
                onOrderSuccess = { order ->
                    val uiState = checkoutViewModel.uiState.value
                    if (uiState.selectedPaymentMethod == "CASHFREE") {
                        // Start Cashfree Payment Activity
                        PaymentActivity.start(
                            context = context,
                            orderId = order.id.toString(),
                            amount = order.total,
                            customerId = null,
                            customerPhone = authViewModel.phone,
                            customerName = authViewModel.name,
                            customerEmail = authViewModel.email,
                            restaurantId = null, // Backend will resolve this from orderId if needed
                            env = "PRODUCTION" // Match with backend environment
                        )
                        // Note: We don't navigate to success screen immediately for online payments.
                        // PaymentActivity handles its own success UI, and when finished,
                        // the user returns to Checkout which they can then leave.
                    } else {
                        // For CASH or full Wallet payments, go straight to success
                        navController.navigate(Routes.orderSuccess(order.orderNo, order.id.toString())) {
                            popUpTo(Routes.Checkout) { inclusive = true }
                            popUpTo(Routes.Cart) { inclusive = true }
                        }
                    }
                },
                onAddAddress = {
                    navController.navigate(Routes.SavedAddresses)
                },
                viewModel = checkoutViewModel,
                authViewModel = authViewModel
            )
        }

        composable(
            route = Routes.OrderSuccess,
            arguments = listOf(
                navArgument("orderNo") { type = NavType.StringType },
                navArgument("orderId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val orderNo = backStackEntry.arguments?.getString("orderNo") ?: ""
            val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
            OrderSuccessScreen(
                orderNo = orderNo,
                orderId = orderId,
                onHomeClick = {
                    navController.navigate(Routes.Home) {
                        popUpTo(Routes.Home) { inclusive = true }
                    }
                },
                onTrackOrderClick = {
                    navController.navigate(Routes.orderDetail(orderId.toInt())) {
                        popUpTo(Routes.OrderSuccess) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.Orders) {
            OrdersScreen(
                onOrderClick = { orderId ->
                    navController.navigate(Routes.orderDetail(orderId))
                },
                onBack = { navController.popBackStack() },
                onReorder = { slug ->
                    navController.navigate(Routes.menu(slug))
                }
            )
        }

        composable(
            route = Routes.OrderDetail,
            arguments = listOf(navArgument("orderId") { type = NavType.IntType }),
            deepLinks = listOf(navDeepLink { uriPattern = "tiffzy://order/{orderId}" })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getInt("orderId") ?: 0
            OrderDetailScreen(
                orderId = orderId,
                onBack = { navController.popBackStack() },
                onTrackOrder = { id ->
                    navController.navigate(Routes.orderTracking(id))
                },
                onReorder = { slug ->
                    navController.navigate(Routes.menu(slug))
                }
            )
        }

        composable(
            route = Routes.OrderTracking,
            arguments = listOf(navArgument("orderId") { type = NavType.IntType })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getInt("orderId") ?: 0
            OrderTrackingScreen(
                orderId = orderId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.Profile) {
            ProfileScreen(
                onEditProfile = { navController.navigate(Routes.EditProfile) },
                onOrdersClick = { navController.navigate(Routes.Orders) },
                onFavoritesClick = { navController.navigate(Routes.Favorites) },
                onPayLaterClick = { navController.navigate(Routes.PayLater) },
                onNotificationsClick = { navController.navigate(Routes.Notifications) },
                onSettingsClick = { navController.navigate(Routes.Settings) },
                onDeleteAccount = { navController.navigate(Routes.DeleteAccount) },
                onLogout = navigateToLogin,
                onBack = { navController.popBackStack() },
                onNavigateToWeb = { title, url ->
                    navController.navigate(Routes.web(title, url))
                },
                authViewModel = authViewModel
            )
        }

        composable(
            route = Routes.Web,
            arguments = listOf(
                navArgument("title") { type = NavType.StringType },
                navArgument("url") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val title = backStackEntry.arguments?.getString("title") ?: "Web Page"
            val encodedUrl = backStackEntry.arguments?.getString("url") ?: ""

            // Decode the URL
            val url = try {
                String(android.util.Base64.decode(encodedUrl, android.util.Base64.URL_SAFE))
            } catch (e: Exception) {
                ""
            }

            // Get token from ViewModel
            val tokenState by authViewModel.authToken.collectAsState(initial = null)

            com.tiffzy.app.ui.components.TiffzyWebViewScreen(
                title = title,
                url = url,
                token = tokenState,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
}
