package com.tiffzy.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun TiffzyLoadingIndicator(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
fun TiffzyErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    onLogin: (() -> Unit)? = null
) {
    val isUnauthorized = message.contains("401") || message.contains("unauthorized", ignoreCase = true)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(Dimens.PaddingLarge),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.error,
            textAlign = TextAlign.Center
        )
        
        Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
        
        if (isUnauthorized && onLogin != null) {
            TiffzyPrimaryButton(
                text = "Login Again",
                onClick = onLogin,
                modifier = Modifier.width(200.dp),
                fullWidth = false
            )
        } else {
            TiffzySecondaryButton(
                text = "Retry",
                onClick = onRetry
            )
        }
    }
}

@Composable
fun TiffzyEmptyState(
    message: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(Dimens.PaddingLarge),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
            TiffzyPrimaryButton(
                text = actionLabel,
                onClick = onAction,
                modifier = Modifier.width(200.dp),
                fullWidth = false
            )
        }
    }
}

@Composable
fun TiffzyStatusBadge(status: String, modifier: Modifier = Modifier) {
    val (color, text) = when (status.uppercase()) {
        "PLACED" -> Color(0xFF2196F3) to "NEW"
        "ACCEPTED" -> Color(0xFF673AB7) to "ACCEPTED"
        "PREPARING" -> Color(0xFFFF9800) to "PREPARING"
        "READY" -> Color(0xFF4CAF50) to "READY"
        "DELIVERED" -> MaterialTheme.colorScheme.outline to "DELIVERED"
        "CANCELLED" -> MaterialTheme.colorScheme.error to "CANCELLED"
        else -> MaterialTheme.colorScheme.outline to status
    }
    
    Surface(
        color = color.copy(alpha = 0.1f),
        shape = MaterialTheme.shapes.small,
        border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = 0.5f)),
        modifier = modifier
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}
