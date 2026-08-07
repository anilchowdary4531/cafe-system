package com.tiffzy.app.ui.payment

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.DeliveryPartnerItem
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeliveryManagementScreen(
    onBackClick: () -> Unit = {},
    viewModel: DeliveryManagementViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedOrderForAssign by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(Unit) {
        viewModel.loadPartners()
    }

    val activeOrdersList = remember { listOf(1042, 1045, 1048) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = "Delivery Partner Management", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadPartners() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = Dimens.PaddingMedium),
                verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
            ) {
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "AVAILABLE DELIVERY FLEET (${uiState.partners.count { it.isAvailable }})",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        letterSpacing = 1.sp
                    )
                }

                items(uiState.partners) { partner ->
                    PartnerCardRow(partner = partner)
                }

                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "OUT-FOR-DELIVERY ORDERS",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        letterSpacing = 1.sp
                    )
                }

                items(activeOrdersList) { orderId ->
                    val assignedPartner = uiState.assignedPartners[orderId]
                    val currentStatus = uiState.deliveryStatuses[orderId] ?: "PENDING"

                    DeliveryOrderCard(
                        orderId = orderId,
                        assignedPartner = assignedPartner,
                        status = currentStatus,
                        onAssignClick = { selectedOrderForAssign = orderId },
                        onUpdateStatus = { nextStatus ->
                            viewModel.updateDeliveryStatus(orderId, nextStatus)
                        }
                    )
                }

                item {
                    Spacer(modifier = Modifier.height(40.dp))
                }
            }

            if (uiState.isLoading) {
                TiffzyLoadingIndicator()
            }
        }
    }

    selectedOrderForAssign?.let { orderId ->
        AssignPartnerDialog(
            partners = uiState.partners.filter { it.isAvailable },
            onDismiss = { selectedOrderForAssign = null },
            onSelect = { partner ->
                viewModel.assignPartnerToOrder(orderId, partner)
                selectedOrderForAssign = null
            }
        )
    }
}

@Composable
fun PartnerCardRow(partner: DeliveryPartnerItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.TwoWheeler, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))

            Column(modifier = Modifier.weight(1f)) {
                Text(text = partner.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(text = "${partner.phone}  •  ${partner.vehicleNo}", style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
            }

            Surface(
                color = if (partner.isAvailable) Color(0xFF10B981).copy(alpha = 0.15f) else Color(0xFFEF4444).copy(alpha = 0.15f),
                shape = CircleShape
            ) {
                Text(
                    text = if (partner.isAvailable) "ONLINE" else "BUSY",
                    color = if (partner.isAvailable) Color(0xFF10B981) else Color(0xFFEF4444),
                    fontWeight = FontWeight.Black,
                    fontSize = 10.sp,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
    }
}

@Composable
fun DeliveryOrderCard(
    orderId: Int,
    assignedPartner: DeliveryPartnerItem?,
    status: String,
    onAssignClick: () -> Unit,
    onUpdateStatus: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "ORDER #$orderId", fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium)
                Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = CircleShape) {
                    Text(text = status, fontWeight = FontWeight.Bold, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (assignedPartner == null) {
                Button(
                    onClick = onAssignClick,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Assign Delivery Partner", fontWeight = FontWeight.Bold)
                }
            } else {
                Text(text = "Driver: ${assignedPartner.name} (${assignedPartner.phone})", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text(text = "Vehicle: ${assignedPartner.vehicleNo}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

                Spacer(modifier = Modifier.height(10.dp))

                // Realtime Status Transition Buttons
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    when (status) {
                        "ACCEPTED", "ASSIGNED" -> {
                            Button(onClick = { onUpdateStatus("PICKED_UP") }, modifier = Modifier.weight(1f)) {
                                Text("Mark Picked Up", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        "PICKED_UP" -> {
                            Button(onClick = { onUpdateStatus("ON_THE_WAY") }, modifier = Modifier.weight(1f)) {
                                Text("Mark On The Way", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        "ON_THE_WAY" -> {
                            Button(onClick = { onUpdateStatus("DELIVERED") }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))) {
                                Text("Mark Delivered", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        "DELIVERED" -> {
                            OutlinedButton(onClick = {}, enabled = false, modifier = Modifier.weight(1f)) {
                                Text("Delivered Successfully", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AssignPartnerDialog(
    partners: List<DeliveryPartnerItem>,
    onDismiss: () -> Unit,
    onSelect: (DeliveryPartnerItem) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Select Delivery Driver") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                partners.forEach { partner ->
                    Card(
                        onClick = { onSelect(partner) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Person, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(text = partner.name, fontWeight = FontWeight.Bold)
                                Text(text = "${partner.vehicleNo}  •  ${partner.phone}", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
