package com.tiffzy.app.ui.restaurant

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.RestaurantSettings
import com.tiffzy.app.data.model.RestaurantSettingsUpdateRequest
import com.tiffzy.app.ui.components.TiffzyErrorState
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantSettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: RestaurantSettingsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val isSaving by viewModel.isSaving.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadSettings()
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Settings",
                subtitle = "Manage your establishment",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        when (val state = uiState) {
            is SettingsUiState.Loading -> TiffzyLoadingIndicator()
            is SettingsUiState.Error -> TiffzyErrorState(
                message = state.message,
                onRetry = { viewModel.loadSettings() },
                modifier = Modifier.padding(innerPadding)
            )
            is SettingsUiState.Success -> {
                SettingsContent(
                    settings = state.settings,
                    isSaving = isSaving,
                    onSave = { viewModel.updateSettings(it) { onBack() } },
                    onLogout = { viewModel.logout(onLogout) },
                    modifier = Modifier.fillMaxSize().padding(innerPadding)
                )
            }
            else -> {}
        }
    }
}

@Composable
fun SettingsContent(
    settings: RestaurantSettings,
    isSaving: Boolean,
    onSave: (RestaurantSettingsUpdateRequest) -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    var name by remember { mutableStateOf(settings.name) }
    var legalName by remember { mutableStateOf(settings.legalName ?: "") }
    var phone by remember { mutableStateOf(settings.phone ?: "") }
    var email by remember { mutableStateOf(settings.email ?: "") }
    var address by remember { mutableStateOf(settings.addressLine1 ?: "") }
    var city by remember { mutableStateOf(settings.city ?: "") }
    var pincode by remember { mutableStateOf(settings.pincode ?: "") }
    var upiId by remember { mutableStateOf(settings.upiId ?: "") }

    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(Dimens.PaddingLarge),
        verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
    ) {
        SectionTitle("BUSINESS PROFILE")
        
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Restaurant Name") },
            leadingIcon = { Icon(Icons.Default.Business, null) },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = legalName,
            onValueChange = { legalName = it },
            label = { Text("Legal Name (for invoices)") },
            modifier = Modifier.fillMaxWidth()
        )

        SectionTitle("CONTACT DETAILS")

        OutlinedTextField(
            value = phone,
            onValueChange = { phone = it },
            label = { Text("Phone Number") },
            leadingIcon = { Icon(Icons.Default.Phone, null) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email Address") },
            leadingIcon = { Icon(Icons.Default.Email, null) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )

        SectionTitle("LOCATION")

        OutlinedTextField(
            value = address,
            onValueChange = { address = it },
            label = { Text("Address") },
            leadingIcon = { Icon(Icons.Default.LocationOn, null) },
            modifier = Modifier.fillMaxWidth()
        )

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingSmall)) {
            OutlinedTextField(
                value = city,
                onValueChange = { city = it },
                label = { Text("City") },
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = pincode,
                onValueChange = { pincode = it },
                label = { Text("Pincode") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
        }

        SectionTitle("PAYMENTS")

        OutlinedTextField(
            value = upiId,
            onValueChange = { upiId = it },
            label = { Text("UPI ID (for direct payments)") },
            leadingIcon = { Icon(Icons.Default.QrCode, null) },
            placeholder = { Text("example@upi") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(Dimens.PaddingLarge))

        Button(
            onClick = {
                onSave(
                    RestaurantSettingsUpdateRequest(
                        name = name,
                        legalName = legalName,
                        phone = phone,
                        email = email,
                        addressLine1 = address,
                        city = city,
                        pincode = pincode,
                        upiId = upiId
                    )
                )
            },
            modifier = Modifier.fillMaxWidth().height(Dimens.ButtonHeight),
            shape = MaterialTheme.shapes.medium,
            enabled = !isSaving
        ) {
            if (isSaving) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
            } else {
                Text("SAVE SETTINGS", style = MaterialTheme.typography.labelLarge)
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingSmall))

        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth().height(Dimens.ButtonHeight),
            shape = MaterialTheme.shapes.medium,
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
        ) {
            Text("LOGOUT", style = MaterialTheme.typography.labelLarge)
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
    }
}

@Composable
fun SectionTitle(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.Bold,
        letterSpacing = 2.sp,
        modifier = Modifier.padding(top = Dimens.PaddingMedium, bottom = Dimens.PaddingSmall)
    )
}
