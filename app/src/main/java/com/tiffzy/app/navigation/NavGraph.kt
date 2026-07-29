package com.tiffzy.app.navigation

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
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
    
    fun restaurantDetail(slug: String) = "restaurant/$slug"
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
                    navController.navigate(Routes.Location) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.navigate(Routes.Login) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                },
                onNavigateToRestaurantDashboard = {
                    // Redirect to login as Restaurant Dashboard is removed from this app
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
                onStaffLoggedIn = {
                    // Staff/Restaurant login is no longer supported in Customer app
                    navController.navigate(Routes.Login)
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
    }
}
