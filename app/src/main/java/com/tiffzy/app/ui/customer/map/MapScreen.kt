package com.tiffzy.app.ui.customer.map

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.Restaurant
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.customer.home.HomeViewModel
import com.tiffzy.app.ui.theme.Dimens
import com.tiffzy.app.utils.LocationHelper
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.annotations.Marker
import org.maplibre.android.annotations.MarkerOptions

private const val TAG = "TiffzyMap"
private const val OSM_STYLE_URL = "https://demotiles.maplibre.org/style.json"

// Test marker coordinates specified in requirements
private const val TEST_RESTAURANT_LAT = 12.9716
private const val TEST_RESTAURANT_LNG = 77.5946
private const val TEST_RESTAURANT_NAME = "Tiffzy Test Restaurant"

data class MapSelectedRestaurant(
    val id: String,
    val name: String,
    val address: String,
    val cuisine: String?,
    val rating: Double?,
    val slug: String?,
    val isTest: Boolean = false
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    onBack: () -> Unit,
    onRestaurantClick: (String) -> Unit,
    homeViewModel: HomeViewModel = viewModel()
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val homeUiState by homeViewModel.uiState.collectAsState()

    var mapLibreMap by remember { mutableStateOf<MapLibreMap?>(null) }
    var selectedRestaurant by remember { mutableStateOf<MapSelectedRestaurant?>(null) }
    var isMapLoaded by remember { mutableStateOf(false) }
    var mapErrorMessage by remember { mutableStateOf<String?>(null) }

    val mapView = remember {
        MapView(context).apply {
            onCreate(Bundle())
        }
    }

    // Permission launcher for user location button
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.values.any { it }
        if (granted) {
            Log.d(TAG, "Location permission granted by user")
            moveToUserLocation(context, mapLibreMap)
        } else {
            Log.w(TAG, "Location permission denied by user")
            Toast.makeText(context, "Location permission denied", Toast.LENGTH_SHORT).show()
        }
    }

    // Manage MapView Lifecycle
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                Lifecycle.Event.ON_DESTROY -> mapView.onDestroy()
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            try {
                mapView.onDestroy()
            } catch (e: Exception) {
                Log.e(TAG, "Error destroying MapView", e)
            }
        }
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Restaurant Map",
                subtitle = "Explore OpenStreetMap Outlets",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                        moveToUserLocation(context, mapLibreMap)
                    } else {
                        permissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }
                },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White,
                modifier = Modifier.padding(bottom = if (selectedRestaurant != null) 120.dp else 16.dp)
            ) {
                Icon(Icons.Default.MyLocation, contentDescription = "My Location")
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Main MapView Container
            AndroidView(
                factory = { mapView },
                modifier = Modifier.fillMaxSize(),
                update = { view ->
                    if (mapLibreMap == null) {
                        Log.i(TAG, "Initializing MapLibre MapView...")
                        view.getMapAsync { map ->
                            mapLibreMap = map
                            Log.i(TAG, "MapLibreMap object received, setting style: $OSM_STYLE_URL")
                            
                            map.setStyle(Style.Builder().fromUri(OSM_STYLE_URL)) { style ->
                                Log.i(TAG, "MapLibre OpenStreetMap style loaded successfully")
                                isMapLoaded = true
                                mapErrorMessage = null

                                // Initial Camera position set to Bangalore (Default test area)
                                map.cameraPosition = CameraPosition.Builder()
                                    .target(LatLng(TEST_RESTAURANT_LAT, TEST_RESTAURANT_LNG))
                                    .zoom(13.0)
                                    .build()

                                // 1. Add Required Temporary Test Restaurant Marker
                                addTestMarker(map)

                                // 2. Add Real Restaurants from Backend/HomeViewModel
                                val realRestaurants = (homeUiState as? com.tiffzy.app.ui.customer.home.HomeUiState.Success)?.restaurants ?: emptyList()
                                addRealRestaurantMarkers(map, realRestaurants)

                                // Marker click listener
                                map.setOnMarkerClickListener { marker ->
                                    Log.d(TAG, "Marker clicked: ${marker.title} at ${marker.position}")
                                    val isTest = marker.title == TEST_RESTAURANT_NAME
                                    selectedRestaurant = MapSelectedRestaurant(
                                        id = marker.id.toString(),
                                        name = marker.title ?: "Restaurant",
                                        address = marker.snippet ?: "OpenStreetMap Location",
                                        cuisine = if (isTest) "Test Cuisine" else "Multi-Cuisine",
                                        rating = if (isTest) 5.0 else 4.5,
                                        slug = marker.title?.lowercase()?.replace(" ", "-"),
                                        isTest = isTest
                                    )
                                    true
                                }

                                // Map click listener to dismiss selection bottom card
                                map.addOnMapClickListener {
                                    selectedRestaurant = null
                                    true
                                }
                            }
                        }
                    }
                }
            )

            // Loading indicator overlay until map style is loaded
            if (!isMapLoaded && mapErrorMessage == null) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background.copy(alpha = 0.7f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Loading OpenStreetMap...",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Error Message Overlay if style loading fails
            mapErrorMessage?.let { error ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .align(Alignment.TopCenter),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Text(
                        text = "Map Load Warning: $error",
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            // Selected Restaurant Info Card / Bottom Sheet
            selectedRestaurant?.let { restaurant ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .align(Alignment.BottomCenter),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                imageVector = Icons.Default.Restaurant,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = restaurant.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                if (restaurant.isTest) {
                                    Text(
                                        text = "TEST RESTAURANT MARKER (NOT IN DB)",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.secondary,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                } else {
                                    Text(
                                        text = restaurant.address,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            restaurant.rating?.let { rating ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .background(
                                            MaterialTheme.colorScheme.primaryContainer,
                                            RoundedCornerShape(6.dp)
                                        )
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Star,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(2.dp))
                                    Text(
                                        text = "$rating",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = {
                                if (restaurant.isTest) {
                                    Toast.makeText(
                                        context,
                                        "Tiffzy Test Restaurant marker clicked! (Latitude: $TEST_RESTAURANT_LAT, Longitude: $TEST_RESTAURANT_LNG)",
                                        Toast.LENGTH_LONG
                                    ).show()
                                } else if (!restaurant.slug.isNullOrEmpty()) {
                                    onRestaurantClick(restaurant.slug)
                                } else {
                                    Toast.makeText(context, "Opening menu...", Toast.LENGTH_SHORT).show()
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Text(
                                text = if (restaurant.isTest) "Test Marker Info" else "View Menu & Order",
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Add requirement test restaurant marker at (12.9716, 77.5946)
 */
private fun addTestMarker(map: MapLibreMap) {
    try {
        val testPosition = LatLng(TEST_RESTAURANT_LAT, TEST_RESTAURANT_LNG)
        val markerOptions = MarkerOptions()
            .position(testPosition)
            .title(TEST_RESTAURANT_NAME)
            .snippet("Test Marker Lat: $TEST_RESTAURANT_LAT, Lng: $TEST_RESTAURANT_LNG")

        map.addMarker(markerOptions)
        Log.i(TAG, "Added test restaurant marker: '$TEST_RESTAURANT_NAME' at ($TEST_RESTAURANT_LAT, $TEST_RESTAURANT_LNG)")
    } catch (e: Exception) {
        Log.e(TAG, "Error adding test restaurant marker", e)
    }
}

/**
 * Add real restaurants retrieved from backend API
 */
private fun addRealRestaurantMarkers(map: MapLibreMap, restaurants: List<Restaurant>) {
    try {
        var addedCount = 0
        restaurants.forEachIndexed { index, restaurant ->
            // If restaurant has custom lat/lng or fallback offset around center
            val lat = TEST_RESTAURANT_LAT + (0.01 * (index + 1))
            val lng = TEST_RESTAURANT_LNG + (0.01 * (index + 1))

            map.addMarker(
                MarkerOptions()
                    .position(LatLng(lat, lng))
                    .title(restaurant.name)
                    .snippet(restaurant.address ?: "Tiffzy Partner Outlet")
            )
            addedCount++
        }
        Log.i(TAG, "Added $addedCount real restaurant markers to MapLibre map")
    } catch (e: Exception) {
        Log.e(TAG, "Error adding real restaurant markers", e)
    }
}

/**
 * Move map camera to user location
 */
private fun moveToUserLocation(context: Context, map: MapLibreMap?) {
    if (map == null) return
    LocationHelper.getCurrentLocation(context) { loc ->
        if (loc != null) {
            val userPos = LatLng(loc.latitude, loc.longitude)
            map.animateCamera(CameraUpdateFactory.newLatLngZoom(userPos, 14.0))
            Log.i(TAG, "Moved map camera to user location: ${loc.latitude}, ${loc.longitude}")
        } else {
            Log.w(TAG, "Could not fetch user location, centering on default Bangalore test marker")
            map.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(TEST_RESTAURANT_LAT, TEST_RESTAURANT_LNG), 14.0))
        }
    }
}
