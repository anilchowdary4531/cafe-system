package com.tiffzy.app.ui.customer.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.R
import com.tiffzy.app.ui.customer.home.HomeUiState
import com.tiffzy.app.ui.customer.home.HomeViewModel
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun SearchScreen(
    onRestaurantClick: (String) -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        viewModel.search("") // Clear any previous search results from Home
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        // Search Bar
        Box(modifier = Modifier.padding(horizontal = Dimens.PaddingMedium, vertical = Dimens.PaddingSmall)) {
            TiffzySearchBar(
                value = searchQuery,
                onValueChange = { 
                    searchQuery = it
                    viewModel.search(it)
                },
                placeholder = "Search for restaurants or dishes",
                modifier = Modifier.focusRequester(focusRequester)
            )
        }

        when (val state = uiState) {
            is HomeUiState.Loading -> {
                TiffzyLoadingIndicator()
            }
            is HomeUiState.Success -> {
                if (searchQuery.isEmpty()) {
                    TiffzyEmptyState(
                        message = "Search for your favorite food or restaurants"
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium),
                        contentPadding = PaddingValues(
                            bottom = Dimens.PaddingExtraLarge,
                            top = Dimens.PaddingSmall
                        )
                    ) {
                        if (state.restaurants.isEmpty() && state.items.isEmpty()) {
                            item {
                                TiffzyEmptyState(message = stringResource(R.string.no_results_found, searchQuery))
                            }
                        } else {
                            items(state.restaurants) { restaurant ->
                                Box(modifier = Modifier.padding(horizontal = Dimens.PaddingMedium)) {
                                    TiffzyRestaurantCard(
                                        restaurant = restaurant,
                                        onClick = { onRestaurantClick(restaurant.slug) }
                                    )
                                }
                            }
                            items(state.items) { item ->
                                Box(modifier = Modifier.padding(horizontal = Dimens.PaddingMedium)) {
                                    TiffzySearchItemCard(
                                        item = item,
                                        onClick = { onRestaurantClick(item.restaurant.slug) }
                                    )
                                }
                            }
                        }
                    }
                }
            }
            is HomeUiState.Error -> {
                TiffzyErrorState(
                    message = state.message,
                    onRetry = { viewModel.search(searchQuery) }
                )
            }
        }
    }
}
