package com.tiffzy.app.ui.customer.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.Customer
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.ui.auth.AuthViewModel
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onEditProfile: () -> Unit,
    onOrdersClick: () -> Unit,
    onFavoritesClick: () -> Unit = {},
    onPayLaterClick: () -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    onSettingsClick: () -> Unit = {},
    onDeleteAccount: () -> Unit,
    onLogout: () -> Unit,
    onBack: () -> Unit,
    onNavigateToWeb: (String, String) -> Unit = { _, _ -> },
    viewModel: ProfileViewModel = viewModel(),
    authViewModel: AuthViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val nickname by viewModel.nickname.collectAsState()
    val avatar by viewModel.avatar.collectAsState()
    val lastOrder by viewModel.lastOrder.collectAsState()
    val totalOrders by viewModel.totalOrders.collectAsState()
    val totalSpend by viewModel.totalSpend.collectAsState()
    val activeOrders by viewModel.activeOrders.collectAsState()
    
    var showLanguageSelector by remember { mutableStateOf(false) }
    val currentLanguageCode by authViewModel.appLanguage.collectAsState()
    val currentLanguage = supportedLanguages.find { it.code == currentLanguageCode } ?: supportedLanguages[0]

    LaunchedEffect(Unit) {
        viewModel.loadProfile()
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "My Account",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (showLanguageSelector) {
            LanguageSelectorDialog(
                currentLanguageCode = currentLanguageCode,
                onLanguageSelected = { authViewModel.changeLanguage(it) },
                onDismiss = { showLanguageSelector = false }
            )
        }

        when (val state = uiState) {
            is ProfileUiState.Loading -> TiffzyLoadingIndicator()
            is ProfileUiState.Error -> {
                TiffzyErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadProfile() },
                    onLogin = onLogout
                )
            }
            is ProfileUiState.Success -> {
                ProfileContent(
                    customer = state.customer,
                    nickname = nickname,
                    avatarUrl = avatar,
                    lastOrder = lastOrder,
                    totalOrders = totalOrders,
                    totalSpend = totalSpend,
                    activeOrders = activeOrders,
                    onEditProfile = onEditProfile,
                    onOrdersClick = onOrdersClick,
                    onFavoritesClick = onFavoritesClick,
                    onPayLaterClick = onPayLaterClick,
                    onNotificationsClick = onNotificationsClick,
                    onSettingsClick = onSettingsClick,
                    onLogout = { viewModel.logout(onLogout) },
                    onLanguageClick = { showLanguageSelector = true },
                    onDeleteAccount = onDeleteAccount,
                    onNavigateToWeb = onNavigateToWeb,
                    currentLanguage = currentLanguage,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                )
            }
            else -> {}
        }
    }
}

@Composable
fun ProfileContent(
    customer: Customer,
    nickname: String?,
    avatarUrl: String?,
    lastOrder: OrderDetails?,
    totalOrders: Int,
    totalSpend: Double,
    activeOrders: Int,
    onEditProfile: () -> Unit,
    onOrdersClick: () -> Unit,
    onFavoritesClick: () -> Unit,
    onPayLaterClick: () -> Unit,
    onNotificationsClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onLogout: () -> Unit,
    onLanguageClick: () -> Unit,
    onDeleteAccount: () -> Unit,
    onNavigateToWeb: (String, String) -> Unit,
    currentLanguage: Language,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 4.dp) // ~98% width
    ) {
        Spacer(modifier = Modifier.height(Dimens.PaddingLarge))

        Text(
            text = "Logged in as ${customer.phone}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 12.dp)
        )
        
        Spacer(modifier = Modifier.height(12.dp))

        // 1. Unified Identity Card
        ProfileHeaderCard(
            customer = customer, 
            nickname = nickname, 
            avatarUrl = avatarUrl, 
            onEditClick = onEditProfile
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Web-style Quick Stats Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            val stats = listOf(
                "Orders" to "$totalOrders",
                "Spend" to "₹${totalSpend.toInt()}",
                "Avg" to "₹${if (totalOrders > 0) (totalSpend / totalOrders).toInt() else 0}",
                "Active" to "$activeOrders"
            )
            
            stats.forEach { (label, value) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "$label: ",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    )
                    Text(
                        text = value,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // 2. Latest Activity (Recent Order)
        Text(
            text = "LATEST ACTIVITY",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 4.dp)
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onOrdersClick() },
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = MaterialTheme.shapes.large,
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            if (lastOrder != null) {
                Row(
                    modifier = Modifier.padding(Dimens.PaddingLarge),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .background(MaterialTheme.colorScheme.primaryContainer, shape = CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.ShoppingBag, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                    }
                    Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "Order #${lastOrder.orderNo}", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                        Text(text = lastOrder.status, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                    }
                    Text(text = "₹${lastOrder.total.toInt()}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Black)
                }
            } else {
                Box(modifier = Modifier.padding(Dimens.PaddingLarge).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text(text = "No recent orders found.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // 3. Rewards Section (Visual Stats)
        Text(
            text = "REWARDS & WALLET",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 4.dp)
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingSmall)
        ) {
            ModernRewardCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.AccountBalanceWallet,
                label = "Wallet",
                value = "₹0",
                color = Color(0xFFF59E0B) // Amber
            )
            ModernRewardCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.BarChart,
                label = "Spend",
                value = "₹${totalSpend.toInt()}",
                color = Color(0xFF10B981) // Emerald
            )
            ModernRewardCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.ShoppingBag,
                label = "Orders",
                value = "$totalOrders",
                color = Color(0xFF3B82F6) // Blue
            )
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // 4. Action Groups
        Text(
            text = "ACTIVITY",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 4.dp)
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = MaterialTheme.shapes.large,
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Column {
                ProfileMenuItem(
                    icon = Icons.AutoMirrored.Filled.List,
                    title = "My Orders",
                    subtitle = "History & tracking",
                    onClick = onOrdersClick
                )
                HorizontalDivider(modifier = Modifier.padding(horizontal = Dimens.PaddingLarge), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                ProfileMenuItem(
                    icon = Icons.Default.Favorite,
                    title = "Favorites",
                    subtitle = "Your liked dishes",
                    onClick = onFavoritesClick
                )
                HorizontalDivider(modifier = Modifier.padding(horizontal = Dimens.PaddingLarge), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                ProfileMenuItem(
                    icon = Icons.Default.Payments,
                    title = "Digital Khata",
                    subtitle = "Pay later accounts",
                    onClick = onPayLaterClick
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        Text(
            text = "PREFERENCES",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 4.dp)
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = MaterialTheme.shapes.large,
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Column {
                ProfileMenuItem(
                    icon = Icons.Default.Notifications,
                    title = "Notifications",
                    onClick = onNotificationsClick
                )
                HorizontalDivider(modifier = Modifier.padding(horizontal = Dimens.PaddingLarge), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                ProfileMenuItem(
                    icon = Icons.Default.Settings,
                    title = "Settings",
                    onClick = onSettingsClick
                )
                HorizontalDivider(modifier = Modifier.padding(horizontal = Dimens.PaddingLarge), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                ProfileMenuItem(
                    icon = Icons.Default.Language,
                    title = "App Language",
                    subtitle = "${currentLanguage.flag} ${currentLanguage.name}",
                    onClick = onLanguageClick
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        TiffzyLogoutButton(onClick = onLogout)
        
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        
        TextButton(
            onClick = onDeleteAccount,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error.copy(alpha = 0.7f))
        ) {
            Text("Delete Account", style = MaterialTheme.typography.labelMedium)
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
        
        // Footer Section
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

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
    }
}

@Composable
fun ProfileHeaderCard(
    customer: Customer, 
    nickname: String? = null,
    avatarUrl: String? = null,
    onEditClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onEditClick() }, // Make the whole card clickable for easier editing
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(Dimens.PaddingLarge)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Profile Picture or Initials Avatar
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(
                        brush = Brush.linearGradient(
                            colors = listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.tertiary)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (!avatarUrl.isNullOrEmpty()) {
                    AsyncImage(
                        model = avatarUrl,
                        contentDescription = "Profile Picture",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    val initials = nickname?.take(1)?.uppercase() ?: customer.name?.take(1)?.uppercase() ?: customer.phone.take(1)
                    Text(
                        text = initials,
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                }
            }

            Spacer(modifier = Modifier.width(Dimens.SpacingLarge))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (!nickname.isNullOrEmpty()) nickname else customer.name ?: "Hello Guest",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = customer.email ?: customer.phone,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Surface(
                    color = Color(0xFF10B981).copy(alpha = 0.1f),
                    shape = MaterialTheme.shapes.extraSmall,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.2f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF10B981), modifier = Modifier.size(12.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "VERIFIED ACCOUNT",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF10B981),
                            fontSize = 8.sp
                        )
                    }
                }
            }

            IconButton(onClick = onEditClick) {
                Icon(Icons.Default.ChevronRight, contentDescription = "Edit")
            }
        }
    }
}

@Composable
fun ModernRewardCard(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    label: String,
    value: String,
    color: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = MaterialTheme.shapes.large,
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .padding(Dimens.PaddingMedium)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(MaterialTheme.shapes.medium)
                    .background(color.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
            }
            
            Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
            
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center
            )
            
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun ProfileMenuItem(icon: ImageVector, title: String, subtitle: String? = null, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier.padding(horizontal = Dimens.PaddingMedium, vertical = Dimens.PaddingLarge),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
            }
            
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold
                )
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
fun TiffzyLogoutButton(onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f),
            contentColor = MaterialTheme.colorScheme.error
        ),
        elevation = null
    ) {
        Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null)
        Spacer(modifier = Modifier.width(8.dp))
        Text("Logout", modifier = Modifier.padding(vertical = 8.dp), fontWeight = FontWeight.Bold)
    }
}

