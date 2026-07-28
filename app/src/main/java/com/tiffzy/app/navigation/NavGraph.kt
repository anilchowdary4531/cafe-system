package com.tiffzy.app.navigation

import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.tiffzy.app.ui.auth.AuthViewModel
import com.tiffzy.app.ui.auth.LoginScreen
import com.tiffzy.app.ui.auth.OtpScreen
import com.tiffzy.app.ui.auth.SplashScreen
import com.tiffzy.app.ui.customer.cart.CartScreen
import com.tiffzy.app.ui.customer.checkout.CheckoutScreen
import com.tiffzy.app.ui.customer.details.RestaurantDetailScreen
import com.tiffzy.app.ui.customer.home.HomeScreen
import com.tiffzy.app.ui.customer.home.LocationSelectorScreen
import com.tiffzy.app.ui.customer.home.HomeViewModel
import com.tiffzy.app.ui.customer.home.LocationViewModel
import com.tiffzy.app.ui.customer.menu.MenuScreen
import com.tiffzy.app.ui.customer.order.OrderSuccessScreen
import com.tiffzy.app.ui.customer.order.OrdersScreen
import com.tiffzy.app.ui.customer.order.OrderDetailScreen
import com.tiffzy.app.ui.customer.order.OrderTrackingScreen
import com.tiffzy.app.ui.customer.profile.ProfileScreen
import com.tiffzy.app.ui.customer.profile.EditProfileScreen
import com.tiffzy.app.ui.customer.profile.SavedAddressesScreen
import com.tiffzy.app.ui.customer.scanner.ScannerScreen
import com.tiffzy.app.ui.customer.servicechoice.ServiceChoiceScreen
import com.tiffzy.app.ui.restaurant.AddEditMenuItemScreen
import com.tiffzy.app.ui.restaurant.RestaurantDashboardScreen
import com.tiffzy.app.ui.restaurant.RestaurantDashboardViewModel
import com.tiffzy.app.ui.restaurant.RestaurantMenuScreen
import com.tiffzy.app.ui.restaurant.RestaurantMenuViewModel
import com.tiffzy.app.ui.restaurant.RestaurantOrderDetailScreen
import com.tiffzy.app.ui.restaurant.RestaurantOrderHistoryScreen
import com.tiffzy.app.ui.restaurant.RestaurantOrdersScreen
import com.tiffzy.app.ui.restaurant.RestaurantOrdersViewModel
import com.tiffzy.app.ui.restaurant.RestaurantSalesScreen
import com.tiffzy.app.ui.restaurant.RestaurantSalesViewModel
import com.tiffzy.app.ui.restaurant.RestaurantSettingsScreen
import com.tiffzy.app.ui.restaurant.RestaurantSettingsViewModel
import com.tiffzy.app.ui.restaurant.MenuUiState
import com.tiffzy.app.data.repository.CartRepository
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavType
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink

object Routes {
    const val Splash = "splash"
    const val Login = "login"
    const val Otp = "otp"
    const val Location = "location"
    const val Home = "home"
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
    const val Scanner = "scanner"
    const val ServiceChoice = "service_choice"
    const val RestaurantDashboard = "restaurant_dashboard"
    const val RestaurantOrders = "restaurant_orders"
    const val RestaurantMenu = "restaurant_menu"
    const val RestaurantSales = "restaurant_sales"
    const val RestaurantSettings = "restaurant_settings"
    const val RestaurantHistory = "restaurant_history"
    const val RestaurantOrderDetail = "restaurant_order_detail/{orderId}"
    const val RestaurantAddMenuItem = "restaurant_add_menu_item"
    const val RestaurantEditMenuItem = "restaurant_edit_menu_item/{menuId}"
    
    fun restaurantDetail(slug: String) = "restaurant/$slug"
    fun restaurantOrderDetail(orderId: Int) = "restaurant_order_detail/$orderId"
    fun restaurantEditMenuItem(menuId: Int) = "restaurant_edit_menu_item/$menuId"
    fun menu(slug: String) = "menu/$slug"
    fun orderSuccess(orderNo: String, orderId: String) = "order_success/$orderNo/$orderId"
    fun orderDetail(orderId: Int) = "order_detail/$orderId"
    fun orderTracking(orderId: Int) = "order_tracking/$orderId"
}

@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController(),
    authViewModel: AuthViewModel = viewModel()
) {
    val activity = LocalContext.current as ComponentActivity
    val locationViewModel: LocationViewModel = viewModel(activity)
    val homeViewModel: HomeViewModel = viewModel()

    NavHost(
        navController = navController,
        startDestination = Routes.Splash
    ) {
        composable(Routes.Splash) {
            SplashScreen(
                viewModel = authViewModel,
                onNavigateToHome = {
                    navController.navigate(Routes.ServiceChoice) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.navigate(Routes.Login) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                },
                onNavigateToRestaurantDashboard = {
                    navController.navigate(Routes.RestaurantDashboard) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.ServiceChoice) {
            ServiceChoiceScreen(
                onDeliverySelected = {
                    navController.navigate(Routes.Location)
                },
                onDineInSelected = {
                    navController.navigate(Routes.Scanner)
                }
            )
        }

        composable(Routes.Login) {
            LoginScreen(
                viewModel = authViewModel,
                onOtpSent = {
                    navController.navigate(Routes.Otp)
                },
                onStaffLoggedIn = {
                    navController.navigate(Routes.RestaurantDashboard) {
                        popUpTo(Routes.Login) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.Otp) {
            OtpScreen(
                viewModel = authViewModel,
                onAuthenticated = {
                    navController.navigate(Routes.Location) {
                        popUpTo(Routes.Login) { inclusive = true }
                    }
                },
                onBack = {
                    authViewModel.resetState()
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.Location) {
            LocationSelectorScreen(
                viewModel = locationViewModel,
                onLocationSelected = { _, _ ->
                    navController.navigate(Routes.Home) {
                        popUpTo(Routes.Location) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.Home) {
            HomeScreen(
                viewModel = homeViewModel,
                authViewModel = authViewModel,
                locationViewModel = locationViewModel,
                onLogout = {
                    navController.navigate(Routes.Login) {
                        popUpTo(Routes.Home) { inclusive = true }
                    }
                },
                onChangeLocation = {
                    navController.navigate(Routes.Location)
                },
                onRestaurantClick = { slug ->
                    navController.navigate(Routes.restaurantDetail(slug))
                },
                onViewProfile = {
                    navController.navigate(Routes.Profile)
                },
                onScanClick = {
                    navController.navigate(Routes.Scanner)
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
                        navController.navigate(Routes.menu(slug)) {
                            popUpTo(Routes.Scanner) { inclusive = true }
                        }
                    }
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.Profile) {
            ProfileScreen(
                onEditProfile = { navController.navigate(Routes.EditProfile) },
                onAddressesClick = { navController.navigate(Routes.SavedAddresses) },
                onOrdersClick = { navController.navigate(Routes.Orders) },
                onLogout = {
                    navController.navigate(Routes.Login) {
                        popUpTo(0) { inclusive = true }
                    }
                },
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
            RestaurantDetailScreen(
                slug = slug,
                onBack = { navController.popBackStack() },
                onViewMenu = { restaurantSlug ->
                    navController.navigate(Routes.menu(restaurantSlug))
                }
            )
        }

        composable(
            route = Routes.Menu,
            arguments = listOf(navArgument("slug") { type = NavType.StringType })
        ) { backStackEntry ->
            val slug = backStackEntry.arguments?.getString("slug") ?: ""
            MenuScreen(
                slug = slug,
                onBack = { navController.popBackStack() },
                onViewCart = { navController.navigate(Routes.Cart) }
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
            CheckoutScreen(
                onBack = { navController.popBackStack() },
                onOrderSuccess = { orderNo, orderId ->
                    navController.navigate(Routes.orderSuccess(orderNo, orderId)) {
                        popUpTo(Routes.Checkout) { inclusive = true }
                        popUpTo(Routes.Cart) { inclusive = true }
                    }
                }
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

        composable(Routes.RestaurantDashboard) {
            RestaurantDashboardScreen(
                onLogout = {
                    navController.navigate(Routes.Login) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onOrdersClick = {
                    navController.navigate(Routes.RestaurantOrders)
                },
                onMenuClick = {
                    navController.navigate(Routes.RestaurantMenu)
                },
                onSalesClick = {
                    navController.navigate(Routes.RestaurantSales)
                },
                onHistoryClick = {
                    navController.navigate(Routes.RestaurantHistory)
                },
                onSettingsClick = {
                    navController.navigate(Routes.RestaurantSettings)
                }
            )
        }

        composable(Routes.RestaurantOrders) {
            val restaurantOrdersViewModel: RestaurantOrdersViewModel = viewModel()
            RestaurantOrdersScreen(
                onOrderClick = { orderId ->
                    navController.navigate(Routes.restaurantOrderDetail(orderId))
                },
                viewModel = restaurantOrdersViewModel
            )
        }

        composable(Routes.RestaurantHistory) {
            RestaurantOrderHistoryScreen(
                onOrderClick = { orderId ->
                    navController.navigate(Routes.restaurantOrderDetail(orderId))
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.RestaurantOrderDetail,
            arguments = listOf(navArgument("orderId") { type = NavType.IntType }),
            deepLinks = listOf(navDeepLink { uriPattern = "tiffzy://restaurant/order/{orderId}" })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getInt("orderId") ?: 0
            val restaurantOrdersViewModel: RestaurantOrdersViewModel = viewModel()
            RestaurantOrderDetailScreen(
                orderId = orderId,
                onBack = { navController.popBackStack() },
                viewModel = restaurantOrdersViewModel
            )
        }

        composable(Routes.RestaurantMenu) {
            val restaurantMenuViewModel: RestaurantMenuViewModel = viewModel()
            RestaurantMenuScreen(
                onAddItem = { navController.navigate(Routes.RestaurantAddMenuItem) },
                onEditItem = { item ->
                    navController.navigate(Routes.restaurantEditMenuItem(item.id))
                },
                onBack = { navController.popBackStack() },
                viewModel = restaurantMenuViewModel
            )
        }

        composable(Routes.RestaurantAddMenuItem) {
            val restaurantMenuViewModel: RestaurantMenuViewModel = viewModel()
            AddEditMenuItemScreen(
                onBack = { navController.popBackStack() },
                viewModel = restaurantMenuViewModel
            )
        }

        composable(
            route = Routes.RestaurantEditMenuItem,
            arguments = listOf(navArgument("menuId") { type = NavType.IntType })
        ) { backStackEntry ->
            val menuId = backStackEntry.arguments?.getInt("menuId") ?: 0
            val restaurantMenuViewModel: RestaurantMenuViewModel = viewModel()
            val uiState by restaurantMenuViewModel.uiState.collectAsState()
            val menuItem = (uiState as? MenuUiState.Success)?.menu?.find { it.id == menuId }
            
            AddEditMenuItemScreen(
                menuItem = menuItem,
                onBack = { navController.popBackStack() },
                viewModel = restaurantMenuViewModel
            )
        }

        composable(Routes.RestaurantSales) {
            RestaurantSalesScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.RestaurantSettings) {
            RestaurantSettingsScreen(
                onBack = { navController.popBackStack() },
                onLogout = {
                    navController.navigate(Routes.Login) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}
