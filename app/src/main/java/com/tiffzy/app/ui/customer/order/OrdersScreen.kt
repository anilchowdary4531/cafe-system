package com.tiffzy.app.ui.customer.order

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.OrderDetails
import com.tiffzy.app.data.model.OrderGroup
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyPrimaryButton
import com.tiffzy.app.ui.components.TiffzySoftButton
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersScreen(
    onOrderClick: (Int) -> Unit,
    onBack: () -> Unit,
    onReorder: (String) -> Unit,
    viewModel: OrdersViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadOrders()
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "My Orders",
                subtitle = "History & Tracking",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadOrders() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { innerPadding ->
        when (val state = uiState) {
            is OrdersUiState.Loading -> TiffzyLoadingIndicator()
            is OrdersUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        TiffzyPrimaryButton(text = "Retry", onClick = { viewModel.loadOrders() }, fullWidth = false)
                    }
                }
            }
            is OrdersUiState.Success -> {
                if (state.groups.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No orders found", style = MaterialTheme.typography.titleMedium)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                        contentPadding = PaddingValues(start = 4.dp, end = 4.dp, top = Dimens.PaddingSmall, bottom = Dimens.PaddingLarge),
                        verticalArrangement = Arrangement.spacedBy(Dimens.SpacingLarge)
                    ) {
                        item {
                            SpendingDashboard(groups = state.groups)
                        }

                        items(state.groups) { group ->
                            RestaurantOrderSection(
                                group = group,
                                onOrderClick = onOrderClick,
                                onReorder = { order ->
                                    viewModel.reorder(order)
                                    onReorder(group.restaurant?.slug ?: "")
                                },
                                onContinueOrdering = {
                                    onReorder(group.restaurant?.slug ?: "")
                                }
                            )
                        }
                    }
                }
            }
            else -> {}
        }
    }
}

@Composable
fun SpendingDashboard(groups: List<OrderGroup>) {
    val totalSpend = groups.sumOf { it.stats.totalSpend }
    val totalOrders = groups.sumOf { it.stats.totalOrders }
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "ORDER INSIGHTS",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    )
                    Text(
                        text = "Orders vs spend",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "$totalOrders orders",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "₹${totalSpend.toInt()}",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))

            // Spline Area Chart (Referencing web app style)
            SplineSpendingChart(groups = groups)

            Spacer(modifier = Modifier.height(24.dp))
            
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Info, 
                    null, 
                    tint = MaterialTheme.colorScheme.primary, 
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Spending peak detected recently. Great choice!",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun SplineSpendingChart(groups: List<OrderGroup>) {
    // Aggregate daily data for the last 14 days
    val allOrders = groups.flatMap { it.orders }
    val daySdf = SimpleDateFormat("dd MMM", Locale.US)
    val inputSdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    
    val calendar = Calendar.getInstance()
    val dailyData = mutableMapOf<String, Float>()
    
    // Initialize last 10 days with 0
    repeat(10) {
        val date = daySdf.format(calendar.time)
        dailyData[date] = 0f
        calendar.add(Calendar.DAY_OF_YEAR, -1)
    }
    
    allOrders.forEach { 
        try {
            val date = inputSdf.parse(it.createdAt)
            val key = daySdf.format(date ?: Date())
            if (dailyData.containsKey(key)) {
                dailyData[key] = (dailyData[key] ?: 0f) + it.total.toFloat()
            }
        } catch (e: Exception) {}
    }

    val sortedKeys = dailyData.keys.reversed()
    val points = sortedKeys.map { dailyData[it] ?: 0f }
    val maxVal = points.maxOrNull()?.coerceAtLeast(100f) ?: 100f
    
    Column {
        Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val width = size.width - 40.dp.toPx() // Reserve space for Y-axis labels on the right
                val height = size.height - 20.dp.toPx()
                val spacing = width / (points.size - 1)
                
                // Draw Y-Axis Labels and horizontal lines
                val gridLines = 4
                for (i in 0..gridLines) {
                    val yLabelVal = (maxVal / gridLines) * i
                    val yPos = height - (yLabelVal / maxVal * height)
                    
                    // Draw grid line
                    drawLine(
                        color = Color.LightGray.copy(alpha = 0.1f),
                        start = Offset(0f, yPos),
                        end = Offset(width, yPos),
                        strokeWidth = 1.dp.toPx()
                    )
                    
                    // Draw Y-axis text
                    drawContext.canvas.nativeCanvas.drawText(
                        "₹${yLabelVal.toInt()}",
                        width + 8.dp.toPx(),
                        yPos + 4.dp.toPx(),
                        android.graphics.Paint().apply {
                            color = android.graphics.Color.GRAY
                            textSize = 24f
                            alpha = 100
                        }
                    )
                }

                val splinePath = Path()
                val fillPath = Path()
                
                val controlPoints = mutableListOf<Offset>()
                points.forEachIndexed { i, p ->
                    val x = i * spacing
                    val y = height - (p / maxVal * height)
                    controlPoints.add(Offset(x, y))
                }

                if (controlPoints.size >= 2) {
                    splinePath.moveTo(controlPoints[0].x, controlPoints[0].y)
                    fillPath.moveTo(0f, height)
                    fillPath.lineTo(controlPoints[0].x, controlPoints[0].y)

                    for (i in 0 until controlPoints.size - 1) {
                        val p0 = controlPoints[i]
                        val p1 = controlPoints[i + 1]
                        val con1 = Offset((p0.x + p1.x) / 2, p0.y)
                        val con2 = Offset((p0.x + p1.x) / 2, p1.y)
                        
                        splinePath.cubicTo(con1.x, con1.y, con2.x, con2.y, p1.x, p1.y)
                        fillPath.cubicTo(con1.x, con1.y, con2.x, con2.y, p1.x, p1.y)
                    }
                    
                    fillPath.lineTo(width, height)
                    fillPath.close()

                    // Draw Area
                    drawPath(
                        path = fillPath,
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                Color(0xFFEAB308).copy(alpha = 0.3f),
                                Color.Transparent
                            )
                        )
                    )

                    // Draw Spline Line
                    drawPath(
                        path = splinePath,
                        color = Color(0xFFEAB308),
                        style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
                    )

                    // Draw dots and values for non-zero points
                    controlPoints.forEachIndexed { i, offset ->
                        if (points[i] > 0) {
                            // Dot
                            drawCircle(
                                color = Color(0xFFEAB308),
                                radius = 4.dp.toPx(),
                                center = offset
                            )
                            drawCircle(
                                color = Color.White,
                                radius = 2.dp.toPx(),
                                center = offset
                            )
                            
                            // Point Value Label
                            drawContext.canvas.nativeCanvas.drawText(
                                "₹${points[i].toInt()}",
                                offset.x - 10.dp.toPx(),
                                offset.y - 12.dp.toPx(),
                                android.graphics.Paint().apply {
                                    color = android.graphics.Color.WHITE
                                    textSize = 28f
                                    isFakeBoldText = true
                                }
                            )
                        }
                    }
                }
            }
        }
        
        // X-Axis Labels
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp, end = 40.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            sortedKeys.forEachIndexed { i, key ->
                if (i % 3 == 0 || i == sortedKeys.size - 1) {
                    Text(
                        text = key,
                        style = MaterialTheme.typography.labelSmall,
                        fontSize = 8.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                } else {
                    Spacer(modifier = Modifier.width(0.dp))
                }
            }
        }
    }
}

@Composable
fun RestaurantOrderSection(
    group: OrderGroup,
    onOrderClick: (Int) -> Unit,
    onReorder: (OrderDetails) -> Unit,
    onContinueOrdering: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(MaterialTheme.shapes.medium)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    if (!group.restaurant?.logo.isNullOrEmpty()) {
                        AsyncImage(
                            model = group.restaurant?.logo,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Icon(Icons.Default.Restaurant, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    }
                }
                Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                Column {
                    Text(
                        text = group.restaurant?.name ?: "Restaurant",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = listOfNotNull(group.restaurant?.city, group.restaurant?.state).joinToString(", "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            TextButton(onClick = onContinueOrdering) {
                Text("Order New")
            }
        }

        Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

        group.orders.forEach { order ->
            val orderWithRestaurant = if (order.restaurant == null) order.copy(restaurant = group.restaurant) else order
            OrderHistoryCard(
                order = orderWithRestaurant,
                onClick = { onOrderClick(order.id) },
                onReorder = { onReorder(orderWithRestaurant) }
            )
            Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        }
    }
}

@Composable
fun OrderHistoryCard(
    order: OrderDetails,
    onClick: () -> Unit,
    onReorder: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
        shape = MaterialTheme.shapes.large
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Order #${order.orderNo}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = order.createdAt,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                LocalStatusChip(order.status)
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val type = getOrderTypeLabel(order)
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                        shape = CircleShape
                    ) {
                        Text(
                            text = type,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 10.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "₹${order.total}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TiffzySoftButton(
                        text = "Details",
                        onClick = onClick,
                        modifier = Modifier.weight(1f),
                        fullWidth = false
                    )
                    TiffzyPrimaryButton(
                        text = "Reorder",
                        onClick = onReorder,
                        modifier = Modifier.weight(1f),
                        fullWidth = false
                    )
                }
            }
        }
    }
}

fun getOrderTypeLabel(order: OrderDetails): String {
    val fulfillment = order.fulfillment?.lowercase()
    val tableNo = order.tableNo
    val source = order.orderSource?.uppercase()
    
    return when {
        fulfillment == "pickup" -> "Pickup"
        fulfillment == "delivery" -> "Delivery"
        fulfillment == "dinein" -> if (tableNo != null) "Table $tableNo" else "Dine-in"
        tableNo != null -> "Table $tableNo"
        source == "ONLINE" -> if (order.deliveryAddress != null) "Delivery" else "Pickup"
        listOf("DELIVERY", "HOME_DELIVERY", "DOOR_DELIVERY").contains(source) -> "Delivery"
        listOf("POS", "PICKUP", "TAKEAWAY", "COUNTER").contains(source) -> "Pickup"
        else -> "Takeaway"
    }
}

@Composable
fun LocalStatusChip(status: String) {
    val color = when (status.uppercase()) {
        "PLACED", "ACCEPTED" -> Color(0xFF3B82F6) // Blue
        "PREPARING" -> Color(0xFFF59E0B) // Amber
        "READY", "DELIVERED", "PICKED_UP" -> Color(0xFF10B981) // Emerald
        "CANCELLED" -> Color(0xFFEF4444) // Red
        else -> Color.Gray
    }

    Surface(
        color = color.copy(alpha = 0.1f),
        shape = CircleShape,
        border = BorderStroke(1.dp, color.copy(alpha = 0.2f))
    ) {
        Text(
            text = status,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.Bold
        )
    }
}
