package com.tiffzy.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val TiffzyDarkColorScheme = darkColorScheme(
    primary = TiffzyPrimary,
    onPrimary = Color.White,
    primaryContainer = TiffzyPrimary.copy(alpha = 0.2f),
    onPrimaryContainer = TiffzyPrimary,
    secondary = TiffzyAccent,
    onSecondary = Color.White,
    background = Color(0xFF07090D),
    onBackground = Color.White,
    surface = Color(0xFF15151A),
    onSurface = Color.White,
    surfaceVariant = Color(0xFF25252A),
    onSurfaceVariant = Color(0xFFB8AB91),
    outline = Color(0x1AFFFFFF),
    error = TiffzyError,
    onError = Color.White
)

private val TiffzyLightColorScheme = lightColorScheme(
    primary = TiffzyPrimary,
    onPrimary = Color.White,
    primaryContainer = TiffzyPrimary.copy(alpha = 0.1f),
    onPrimaryContainer = TiffzyPrimary,
    secondary = TiffzyAccent,
    onSecondary = Color.White,
    background = TiffzyBackground,
    onBackground = TiffzyOnSurface,
    surface = TiffzySurface,
    onSurface = TiffzyOnSurface,
    surfaceVariant = TiffzySurfaceAlpha,
    onSurfaceVariant = TiffzyMuted,
    outline = TiffzyBorder,
    error = TiffzyError,
    onError = Color.White
)

@Composable
fun TiffzyAppTheme(
    darkTheme: Boolean = false, // Changed default to FALSE as per user request
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) TiffzyDarkColorScheme else TiffzyLightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        shapes = TiffzyShapes,
        content = content
    )
}
