package com.tiffzy.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.tiffzy.app.R

@Composable
fun BrandLogo(
    modifier: Modifier = Modifier
) {
    Image(
        painter = painterResource(id = R.drawable.tiffzy_logo),
        contentDescription = "Tiffzy Logo",
        modifier = modifier.size(48.dp)
    )
}
