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
                        contentPadding = PaddingValues(Dimens.PaddingLarge),
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
    var state by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add New Address") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.verticalScroll(rememberScrollState())
            ) {
                TiffzyTextField(value = label, onValueChange = { label = it }, label = "Label (e.g. Home, Office, Gym)")
                TiffzyTextField(value = line1, onValueChange = { line1 = it }, label = "Address Line 1")
                TiffzyTextField(value = line2, onValueChange = { line2 = it }, label = "Address Line 2 (Optional)")
                TiffzyTextField(value = city, onValueChange = { city = it }, label = "City")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TiffzyTextField(value = state, onValueChange = { state = it }, label = "State", modifier = Modifier.weight(1f))
                    TiffzyTextField(value = pin, onValueChange = { pin = it }, label = "Pincode", modifier = Modifier.weight(1f))
                }
                TiffzyTextField(value = notes, onValueChange = { notes = it }, label = "Instructions (Optional)", placeholder = "e.g. Near gate, Ring bell")
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
                            state = state,
                            postalCode = pin.ifBlank { null },
                            notes = notes.ifBlank { null },
                            isDefault = false
                        )
                    )
                },
                enabled = line1.isNotBlank() && city.isNotBlank() && state.isNotBlank()
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
