package com.tiffzy.app.ui.customer.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.Address
import com.tiffzy.app.data.model.CreateAddressRequest
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyTextField
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedAddressesScreen(
    onBack: () -> Unit,
    viewModel: ProfileViewModel = viewModel()
) {
    val addressState by viewModel.addressState.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.loadAddresses()
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Addresses",
                subtitle = "Manage Delivery Locations",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Address")
            }
        }
    ) { innerPadding ->
        when (val state = addressState) {
            is AddressUiState.Loading -> TiffzyLoadingIndicator()
            is AddressUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadAddresses() }) {
                            Text("Retry")
                        }
                    }
                }
            }
            is AddressUiState.Success -> {
                if (state.addresses.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.LocationOn, null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.outline)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("No saved addresses", style = MaterialTheme.typography.titleMedium)
                            Text("Add one to speed up checkout", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = Dimens.PaddingLarge),
                        verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
                    ) {
                        items(state.addresses) { address ->
                            AddressCard(
                                address = address,
                                onDelete = { viewModel.deleteAddress(address.id) }
                            )
                        }
                    }
                }
            }
            else -> {}
        }

        if (showAddDialog) {
            AddAddressDialog(
                onDismiss = { showAddDialog = false },
                onSave = { 
                    viewModel.addAddress(it)
                    showAddDialog = false
                }
            )
        }
    }
}

@Composable
fun AddressCard(address: Address, onDelete: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
        shape = MaterialTheme.shapes.large
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                Icons.Default.LocationOn,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 2.dp)
            )
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = address.label,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (address.isDefault) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                            shape = MaterialTheme.shapes.extraSmall
                        ) {
                            Text(
                                text = "DEFAULT",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 10.sp
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${address.line1}${if (!address.line2.isNullOrEmpty()) ", ${address.line2}" else ""}",
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = "${address.city}, ${address.state}${if (!address.postalCode.isNullOrEmpty()) " - ${address.postalCode}" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (!address.notes.isNullOrEmpty()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Note: ${address.notes}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.secondary,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error.copy(alpha = 0.6f))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddAddressDialog(
    onDismiss: () -> Unit,
    onSave: (CreateAddressRequest) -> Unit
) {
    var label by remember { mutableStateOf("Home") }
    var line1 by remember { mutableStateOf("") }
    var line2 by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var mandal by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var lat by remember { mutableStateOf("") }
    var lng by remember { mutableStateOf("") }
    var isDefault by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add New Address") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.verticalScroll(rememberScrollState())
            ) {
                TiffzyTextField(value = label, onValueChange = { label = it }, label = "Label (e.g. Home, Office)")
                TiffzyTextField(value = line1, onValueChange = { line1 = it }, label = "House / Flat / Building")
                TiffzyTextField(value = line2, onValueChange = { line2 = it }, label = "Street / Area (Optional)")
                TiffzyTextField(value = notes, onValueChange = { notes = it }, label = "Landmark / Instructions (Optional)", placeholder = "Near gate, Ring bell")
                
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TiffzyTextField(value = city, onValueChange = { city = it }, label = "City", modifier = Modifier.weight(1f))
                    TiffzyTextField(value = mandal, onValueChange = { mandal = it }, label = "Mandal/Area", modifier = Modifier.weight(1f))
                }
                
                TiffzyTextField(value = pin, onValueChange = { pin = it }, label = "Postal Code")

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TiffzyTextField(value = lat, onValueChange = { lat = it }, label = "Latitude (Opt)", modifier = Modifier.weight(1f))
                    TiffzyTextField(value = lng, onValueChange = { lng = it }, label = "Longitude (Opt)", modifier = Modifier.weight(1f))
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isDefault, onCheckedChange = { isDefault = it })
                    Text("Make this my default address", style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        CreateAddressRequest(
                            label = label,
                            line1 = line1,
                            line2 = line2.ifBlank { null },
                            city = city,
                            state = mandal, // Using mandal as state for now or we can update model
                            postalCode = pin.ifBlank { null },
                            notes = notes.ifBlank { null },
                            latitude = lat.toDoubleOrNull(),
                            longitude = lng.toDoubleOrNull(),
                            isDefault = isDefault
                        )
                    )
                },
                enabled = line1.isNotBlank() && city.isNotBlank() && mandal.isNotBlank()
            ) {
                Text("Save Address")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
