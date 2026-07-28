package com.tiffzy.app.ui.customer.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.Customer
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onEditProfile: () -> Unit,
    onAddressesClick: () -> Unit,
    onOrdersClick: () -> Unit,
    onLogout: () -> Unit,
    onBack: () -> Unit,
    viewModel: ProfileViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadProfile()
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Profile",
                subtitle = "Account Overview",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        when (val state = uiState) {
            is ProfileUiState.Loading -> TiffzyLoadingIndicator()
            is ProfileUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadProfile() }) {
                            Text("Retry")
                        }
                    }
                }
            }
            is ProfileUiState.Success -> {
                ProfileContent(
                    customer = state.customer,
                    onEditProfile = onEditProfile,
                    onAddressesClick = onAddressesClick,
                    onOrdersClick = onOrdersClick,
                    onLogout = { viewModel.logout(onLogout) },
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
    onEditProfile: () -> Unit,
    onAddressesClick: () -> Unit,
    onOrdersClick: () -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(Dimens.PaddingLarge)
    ) {
        // Overview Header
        Text(
            text = "OVERVIEW",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary,
            letterSpacing = 4.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Customer profile",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 8.dp)
        )
        Text(
            text = "Manage your account, orders and saved addresses.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp)
        )

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // Profile Details Section
        Text(
            text = "ACCOUNT DETAILS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
            shape = MaterialTheme.shapes.large
        ) {
            Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
                ProfileInfoRow(Icons.Default.Person, "Name", customer.name ?: "Not provided")
                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.outlineVariant)
                ProfileInfoRow(Icons.Default.Email, "Email", customer.email ?: "Not provided")
                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.outlineVariant)
                ProfileInfoRow(Icons.Default.Phone, "Phone", customer.phone)
                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.outlineVariant)
                ProfileInfoRow(Icons.Default.CheckCircle, "Status", "OTP Verified")
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // Menu Actions
        Text(
            text = "ACTIONS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

        ProfileMenuItem(
            icon = Icons.Default.Edit,
            title = "Edit Profile",
            onClick = onEditProfile
        )
        ProfileMenuItem(
            icon = Icons.Default.LocationOn,
            title = "Saved Addresses",
            onClick = onAddressesClick
        )
        ProfileMenuItem(
            icon = Icons.AutoMirrored.Filled.List,
            title = "My Order History",
            onClick = onOrdersClick
        )

        Spacer(modifier = Modifier.height(48.dp))

        TiffzyLogoutButton(onClick = onLogout)
        
        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
    }
}

@Composable
fun ProfileInfoRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
        Column {
            Text(
                text = label.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 1.sp
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun ProfileMenuItem(icon: ImageVector, title: String, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        onClick = onClick,
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f),
                fontWeight = FontWeight.SemiBold
            )
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun TiffzyLogoutButton(onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
        border = ButtonDefaults.outlinedButtonBorder.copy(
            brush = androidx.compose.ui.graphics.SolidColor(MaterialTheme.colorScheme.error.copy(alpha = 0.5f))
        )
    ) {
        Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null)
        Spacer(modifier = Modifier.width(8.dp))
        Text("Logout from Tiffzy", modifier = Modifier.padding(vertical = 8.dp), fontWeight = FontWeight.Bold)
    }
}
