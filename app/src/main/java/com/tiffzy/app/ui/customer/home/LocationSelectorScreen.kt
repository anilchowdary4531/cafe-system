package com.tiffzy.app.ui.customer.home

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun LocationSelectorScreen(
    onLocationSelected: (Double, Double) -> Unit,
    viewModel: LocationViewModel = viewModel()
) {
    val locationState by viewModel.locationState.collectAsState()
    val addresses by viewModel.addresses.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val isGranted = permissions.values.any { it }
        if (isGranted) {
            viewModel.fetchCurrentLocation()
        }
    }

    LaunchedEffect(Unit) {
        viewModel.resetState()
        viewModel.loadSavedAddresses()
    }

    LaunchedEffect(locationState) {
        if (locationState is LocationState.Success) {
            val state = locationState as LocationState.Success
            onLocationSelected(state.latitude, state.longitude)
        }
    }

    Scaffold(
        topBar = { TiffzyTopBar(title = "Select Location") },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(Dimens.PaddingLarge)
        ) {
            // Manual Search (Mock search logic)
            TiffzySearchBar(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = "Search for area, street name..."
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            TiffzySecondaryButton(
                text = "Use Current Location",
                onClick = {
                    permissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            when (val state = locationState) {
                is LocationState.Loading -> TiffzyLoadingIndicator()
                is LocationState.Error -> {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                is LocationState.GpsDisabled -> {
                    Text(
                        text = "GPS is disabled. Please enable it in settings.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                else -> {}
            }

            if (searchQuery.isNotEmpty()) {
                // Mock search results
                Text(
                    text = "Search Results",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(vertical = Dimens.PaddingSmall)
                )
                
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { viewModel.selectLocation(17.3850, 78.4867, "Hyderabad") } // Mock Hyderabad
                ) {
                    Row(modifier = Modifier.padding(Dimens.PaddingMedium)) {
                        Icon(Icons.Default.LocationOn, null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                        Column {
                            Text("Hyderabad Area", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                            Text("City Center, India", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            } else if (addresses.isNotEmpty()) {
                Text(
                    text = "Saved Addresses",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.padding(vertical = Dimens.PaddingMedium)
                )

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
                ) {
                    items(addresses) { address ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = MaterialTheme.shapes.medium,
                            onClick = {
                                if (address.latitude != null && address.longitude != null) {
                                    viewModel.selectLocation(address.latitude, address.longitude, address.label)
                                }
                            }
                        ) {
                            Row(
                                modifier = Modifier.padding(Dimens.PaddingMedium),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                                Column {
                                    Text(
                                        text = address.label,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = address.line1,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }
            } else {
                TiffzyEmptyState(message = "Search for a location or use current location to see available restaurants.")
            }
        }
    }
}
