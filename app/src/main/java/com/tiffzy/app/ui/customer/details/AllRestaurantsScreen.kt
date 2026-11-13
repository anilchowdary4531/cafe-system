package com.tiffzy.app.ui.customer.details

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.customer.home.HomeUiState
import com.tiffzy.app.ui.customer.home.HomeViewModel
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllRestaurantsScreen(
    onBack: () -> Unit,
    onRestaurantClick: (String) -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "All Restaurants",
                onBackClick = onBack
            )
        },
        contentWindowInsets = WindowInsets(0, 0, 0, 0)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Search Bar
            Box(
                modifier = Modifier.padding(
                    horizontal = Dimens.PaddingMedium,
                    vertical = Dimens.PaddingSmall
                )
            ) {
                TiffzySearchBar(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = "Search restaurants..."
                )
            }

            when (val state = uiState) {
                is HomeUiState.Loading -> {
                    TiffzyLoadingIndicator()
                }
                is HomeUiState.Success -> {
                    val filteredRestaurants = remember(state.restaurants, searchQuery) {
                        if (searchQuery.isBlank()) {
                            state.restaurants
                        } else {
                            state.restaurants.filter {
                                it.name.contains(searchQuery, ignoreCase = true) ||
                                (it.city != null && it.city.contains(searchQuery, ignoreCase = true)) ||
                                (it.addressLine1 != null && it.addressLine1.contains(searchQuery, ignoreCase = true))
                            }
                        }
                    }

                    if (filteredRestaurants.isEmpty()) {
                        TiffzyEmptyState(
                            message = if (searchQuery.isBlank()) "No restaurants available" else "No restaurants found for \"$searchQuery\""
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium),
                            contentPadding = PaddingValues(
                                horizontal = Dimens.PaddingMedium,
                                vertical = Dimens.PaddingSmall
                            )
                        ) {
                            items(
                                items = filteredRestaurants,
                                key = { it.id }
                            ) { restaurant ->
                                TiffzyRestaurantCard(
                                    restaurant = restaurant,
                                    onClick = { onRestaurantClick(restaurant.slug) }
                                )
                            }
                        }
                    }
                }
                is HomeUiState.Error -> {
                    TiffzyErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadRestaurants() }
                    )
                }
            }
        }
    }
}
