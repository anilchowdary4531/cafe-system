package com.tiffzy.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val TiffzyDarkColorScheme = darkColorScheme(
    primary = TiffzyPrimary,
    onPrimary = TiffzyBackground,
    primaryContainer = TiffzyAccent,
    onPrimaryContainer = TiffzyOnSurface,
    secondary = TiffzyAccent,
    onSecondary = TiffzyOnSurface,
    background = TiffzyBackground,
    onBackground = TiffzyOnSurface,
    surface = TiffzySurface,
    onSurface = TiffzyOnSurface,
    surfaceVariant = TiffzySurfaceAlpha,
    onSurfaceVariant = TiffzyMuted,
    outline = TiffzyBorder,
    error = TiffzyError,
    onError = TiffzyBackground
)

private val TiffzyLightColorScheme = lightColorScheme(
    primary = TiffzyOrange,
    onPrimary = TiffzyOnSurface,
    background = Color(0xFFF6F3EF),
    surface = Color(0xFFFFFFFF),
    onBackground = Color(0xFF1F2937),
    onSurface = Color(0xFF1F2937)
)

@Composable
fun TiffzyAppTheme(
    darkTheme: Boolean = true, // Default to dark as per Premium Dark Luxury theme
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
