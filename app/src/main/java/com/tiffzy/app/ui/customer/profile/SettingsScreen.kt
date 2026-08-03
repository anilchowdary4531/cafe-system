package com.tiffzy.app.ui.customer.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.ui.auth.AuthViewModel
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    onDeleteAccount: () -> Unit,
    authViewModel: AuthViewModel = viewModel()
) {
    val rememberSession by authViewModel.rememberSession.collectAsState(initial = true)
    val autoDetectLocation by authViewModel.autoDetectLocation.collectAsState(initial = true)
    val notificationsEnabled by authViewModel.notificationsEnabled.collectAsState(initial = true)

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Settings",
                subtitle = "Preferences & Security",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(Dimens.PaddingLarge)
        ) {
            Text(
                text = "PRIVACY",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 2.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

            SettingToggleItem(
                icon = Icons.Default.Lock,
                title = "Remember my login",
                description = "Keeps you logged in for faster checkout next time.",
                checked = rememberSession,
                onCheckedChange = { authViewModel.updateSettings(remember = it) }
            )

            SettingToggleItem(
                icon = Icons.Default.Map,
                title = "Auto-select nearest outlet",
                description = "Uses device location to pick the closest restaurant.",
                checked = autoDetectLocation,
                onCheckedChange = { authViewModel.updateSettings(autoDetect = it) }
            )

            SettingToggleItem(
                icon = Icons.Default.Notifications,
                title = "Order notifications",
                description = "Show order status updates on this device.",
                checked = notificationsEnabled,
                onCheckedChange = { authViewModel.updateSettings(notify = it) }
            )

            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

            Text(
                text = "MAINTENANCE",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 2.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

            SettingActionItem(
                icon = Icons.Default.DeleteSweep,
                title = "Clear cached data",
                description = "Fixes stale screens and reload issues.",
                actionLabel = "Clear",
                onAction = { authViewModel.clearCache() }
            )

            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

            Text(
                text = "DANGER ZONE",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error,
                letterSpacing = 2.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

            Button(
                onClick = onDeleteAccount,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.1f), contentColor = MaterialTheme.colorScheme.error),
                shape = MaterialTheme.shapes.medium
            ) {
                Icon(Icons.Default.DeleteForever, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Delete Account", fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

            TiffzyLogoutButton(onClick = onLogout)
            
            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
        }
    }
}

@Composable
fun SettingToggleItem(
    icon: ImageVector,
    title: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Dimens.SpacingSmall),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
            Text(text = description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
}

@Composable
fun SettingActionItem(
    icon: ImageVector,
    title: String,
    description: String,
    actionLabel: String,
    onAction: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Dimens.SpacingSmall),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
            Text(text = description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        TextButton(onClick = onAction) {
            Text(actionLabel)
        }
    }
    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
}
