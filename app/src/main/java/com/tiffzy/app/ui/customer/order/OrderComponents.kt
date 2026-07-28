package com.tiffzy.app.ui.customer.order

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun StatusChip(status: String) {
    val color = when (status.uppercase()) {
        "PLACED" -> Color(0xFF3B82F6)
        "ACCEPTED", "PREPARING" -> MaterialTheme.colorScheme.secondary
        "READY" -> Color(0xFF16A34A)
        "DELIVERED", "PICKED_UP", "SERVED" -> Color(0xFF16A34A)
        "CANCELLED" -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.outline
    }
    
    Surface(
        color = color.copy(alpha = 0.1f),
        shape = MaterialTheme.shapes.small,
        border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = 0.5f))
    ) {
        Text(
            text = status.capitalizeWords(),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}

fun String.capitalizeWords(): String = split("_").joinToString(" ") { it.lowercase().replaceFirstChar { char -> char.uppercase() } }

fun formatDate(dateString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(dateString)
        val outputFormat = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())
        outputFormat.format(date!!)
    } catch (e: Exception) {
        dateString
    }
}

data class TrackingStep(val key: String, val label: String, val hint: String)
