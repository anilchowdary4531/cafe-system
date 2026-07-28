package com.tiffzy.app.ui.restaurant

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.ListAlt
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.AnalyticsResponse
import com.tiffzy.app.data.model.RestaurantSettings
import com.tiffzy.app.ui.components.TiffzyErrorState
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantDashboardScreen(
    onLogout: () -> Unit,
    onOrdersClick: () -> Unit,
    onMenuClick: () -> Unit,
    onSalesClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onSettingsClick: () -> Unit,
    viewModel: RestaurantDashboardViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadDashboard()
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Management",
                subtitle = if (uiState is DashboardUiState.Success) (uiState as DashboardUiState.Success).settings.name else "Restaurant Hub",
                actions = {
                    IconButton(onClick = { viewModel.logout(onLogout) }) {
                        Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = "Logout", tint = MaterialTheme.colorScheme.error)
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        when (val state = uiState) {
            is DashboardUiState.Loading -> TiffzyLoadingIndicator()
            is DashboardUiState.Error -> TiffzyErrorState(
                message = state.message,
                onRetry = { viewModel.loadDashboard() },
                modifier = Modifier.padding(innerPadding)
            )
            is DashboardUiState.Success -> {
                DashboardContent(
                    analytics = state.analytics,
                    settings = state.settings,
                    onOrdersClick = onOrdersClick,
                    onMenuClick = onMenuClick,
                    onSalesClick = onSalesClick,
                    onHistoryClick = onHistoryClick,
                    onSettingsClick = onSettingsClick,
                    onToggleStatus = { viewModel.toggleRestaurantStatus(state.settings.isActive) },
                    modifier = Modifier.fillMaxSize().padding(innerPadding)
                )
            }
            else -> {}
        }
    }
}

@Composable
fun DashboardContent(
    analytics: AnalyticsResponse,
    settings: RestaurantSettings,
    onOrdersClick: () -> Unit,
    onMenuClick: () -> Unit,
    onSalesClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onToggleStatus: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(Dimens.PaddingLarge)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "Today's Overview",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    letterSpacing = 2.sp
                )
                Text(
                    text = settings.name,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Black
                )
            }
            
            StatusIndicator(
                isOpen = settings.isActive,
                onClick = onToggleStatus
            )
        }
        
        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // Main Stats (Sales & Count)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)) {
            StatCard(
                label = "Today's Sales",
                value = "₹${analytics.overview.totalRevenue.toInt()}",
                icon = Icons.Default.CurrencyRupee,
                modifier = Modifier.weight(1f),
                containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            )
            StatCard(
                label = "Total Orders",
                value = analytics.overview.totalOrders.toString(),
                icon = Icons.Default.ShoppingBag,
                modifier = Modifier.weight(1f)
            )
        }
        
        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // Live Order Funnel
        Text(
            text = "LIVE ORDERS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingSmall)) {
            val newOrders = analytics.statusFunnel.filter { it.status == "PLACED" || it.status == "ACCEPTED" }.sumOf { it.count }
            val preparing = analytics.statusFunnel.find { it.status == "PREPARING" }?.count ?: 0
            val ready = analytics.statusFunnel.find { it.status == "READY" }?.count ?: 0
            val completed = analytics.overview.deliveredOrders

            MiniStat(label = "New", value = newOrders.toString(), color = Color(0xFF2196F3), modifier = Modifier.weight(1f))
            MiniStat(label = "Prep", value = preparing.toString(), color = Color(0xFFFF9800), modifier = Modifier.weight(1f))
            MiniStat(label = "Ready", value = ready.toString(), color = Color(0xFF4CAF50), modifier = Modifier.weight(1f))
            MiniStat(label = "Done", value = completed.toString(), color = MaterialTheme.colorScheme.outline, modifier = Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // Quick Actions
        Text(
            text = "QUICK ACTIONS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        
        ActionCard(
            title = "Order Manager",
            subtitle = "Accept and process incoming orders",
            icon = Icons.Default.FlashOn,
            onClick = onOrdersClick
        )
        Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        ActionCard(
            title = "Menu & Inventory",
            subtitle = "Manage items and availability",
            icon = Icons.AutoMirrored.Filled.ListAlt,
            onClick = onMenuClick
        )
        Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        ActionCard(
            title = "Sales Analytics",
            subtitle = "Revenue and growth reports",
            icon = Icons.Default.BarChart,
            onClick = onSalesClick
        )
        Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        ActionCard(
            title = "Order History",
            subtitle = "View past transactions",
            icon = Icons.Default.History,
            onClick = onHistoryClick
        )
        Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        ActionCard(
            title = "Restaurant Settings",
            subtitle = "Profile, hours and configuration",
            icon = Icons.Default.Settings,
            onClick = onSettingsClick
        )
    }
}

@Composable
fun StatusIndicator(isOpen: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = (if (isOpen) Color(0xFF4CAF50) else Color(0xFFF44336)).copy(alpha = 0.1f),
        shape = CircleShape,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (isOpen) Color(0xFF4CAF50) else Color(0xFFF44336))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(if (isOpen) Color(0xFF4CAF50) else Color(0xFFF44336))
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (isOpen) "OPEN" else "CLOSED",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = if (isOpen) Color(0xFF4CAF50) else Color(0xFFF44336)
            )
        }
    }
}

@Composable
fun MiniStat(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.1f)),
        border = androidx.compose.foundation.BorderStroke(0.5.dp, color.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier.padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = color)
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = color.copy(alpha = 0.8f))
        }
    }
}

@Composable
fun StatCard(
    label: String, 
    value: String, 
    icon: ImageVector, 
    modifier: Modifier = Modifier,
    containerColor: Color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = containerColor),
        shape = MaterialTheme.shapes.large
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp))
            Spacer(modifier = Modifier.height(16.dp))
            Text(text = value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
            Text(text = label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun ActionCard(title: String, subtitle: String, icon: ImageVector, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(48.dp).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), MaterialTheme.shapes.medium),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
            }
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.Default.ChevronRight, null, tint = MaterialTheme.colorScheme.outline)
        }
    }
}
