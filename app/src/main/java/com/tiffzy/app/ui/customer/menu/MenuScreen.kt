package com.tiffzy.app.ui.customer.menu

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.data.repository.CartRepository
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens
import com.tiffzy.app.utils.ImageUtils
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import com.tiffzy.app.ui.customer.home.getCategoryIcon
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MenuScreen(
    slug: String,
    onBack: () -> Unit,
    onViewCart: () -> Unit,
    onLogin: (() -> Unit)? = null,
    onViewLiveBill: ((Int) -> Unit)? = null,
    viewModel: MenuViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val cartItems by CartRepository.getInstance().cartItems.collectAsState()
    val activeSessionId by viewModel.activeSessionId.collectAsState()
    
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var filterVeg by remember { mutableStateOf(false) }
    var filterNonVeg by remember { mutableStateOf(false) }
    var filterRating4Plus by remember { mutableStateOf(false) }

    LaunchedEffect(slug) {
        viewModel.loadMenu(slug)
    }

    Scaffold(
        topBar = {
            val restaurant = (uiState as? MenuUiState.Success)?.restaurant
            val restaurantName = restaurant?.name ?: "Menu"
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = restaurantName.uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            letterSpacing = 4.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary
                        )
                        if (restaurant != null) {
                            Text(
                                text = "${restaurant.city ?: "Local"} • ${restaurant.addressLine1 ?: ""}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (activeSessionId != null && onViewLiveBill != null) {
                        IconButton(onClick = { onViewLiveBill(activeSessionId!!) }) {
                            Icon(Icons.Default.Receipt, contentDescription = "Live Bill", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.primary
                )
            )
        },
        bottomBar = {
            if (cartItems.isNotEmpty()) {
                val totalAmount = cartItems.sumOf { it.menuItem.price * it.quantity }
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    tonalElevation = 8.dp,
                    color = MaterialTheme.colorScheme.surface
                ) {
                    TiffzyPrimaryButton(
                        text = "View Cart (${cartItems.size} items) - Rs ${totalAmount.toInt()}",
                        onClick = onViewCart,
                        modifier = Modifier.padding(Dimens.PaddingMedium)
                    )
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        when (val state = uiState) {
            is MenuUiState.Loading -> TiffzyLoadingIndicator()
            is MenuUiState.Error -> TiffzyErrorState(
                message = state.message,
                onRetry = { viewModel.loadMenu(slug) },
                onLogin = onLogin
            )
            is MenuUiState.Success -> {
                val categories = state.categories
                
                // Initialize selected category if not set
                if (selectedCategory == null) {
                    selectedCategory = if (categories.any { it.name == "Recommended" }) "Recommended" else "All"
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    // Circular Categories with images (Zomato style)
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = Dimens.PaddingSmall),
                        contentPadding = PaddingValues(horizontal = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
                    ) {
                        item {
                            MenuCategoryCircleItem(
                                name = "All",
                                isSelected = selectedCategory == "All",
                                onClick = { selectedCategory = "All" }
                            )
                        }
                        item {
                            MenuCategoryCircleItem(
                                name = "Biryani",
                                isSelected = selectedCategory == "Biryani",
                                onClick = { selectedCategory = "Biryani" }
                            )
                        }
                        items(categories) { category ->
                            if (category.name.lowercase() != "biryani") {
                                val categoryImage = category.items.firstOrNull { !it.image.isNullOrEmpty() }?.image
                                MenuCategoryCircleItem(
                                    name = category.name,
                                    imageUrl = categoryImage,
                                    isSelected = selectedCategory == category.name,
                                    onClick = { selectedCategory = category.name }
                                )
                            }
                        }
                    }

                    // Search Bar for Dishes
                    Box(modifier = Modifier.padding(horizontal = 4.dp, vertical = Dimens.PaddingSmall)) {
                        TiffzySearchBar(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = "Search for dishes..."
                        )
                    }

                    // Filter Options
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = Dimens.PaddingSmall),
                        contentPadding = PaddingValues(horizontal = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingSmall)
                    ) {
                        item {
                            FilterChip(
                                selected = filterVeg,
                                onClick = { 
                                    filterVeg = !filterVeg
                                    if (filterVeg) filterNonVeg = false
                                },
                                label = { Text("Veg", style = MaterialTheme.typography.labelSmall) },
                                leadingIcon = { 
                                    Box(modifier = Modifier.size(10.dp).background(Color(0xFF16A34A), MaterialTheme.shapes.extraSmall)) 
                                },
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled = true,
                                    selected = filterVeg,
                                    borderColor = Color(0xFF16A34A).copy(alpha = 0.5f),
                                    selectedBorderColor = Color(0xFF16A34A)
                                )
                            )
                        }
                        item {
                            FilterChip(
                                selected = filterNonVeg,
                                onClick = { 
                                    filterNonVeg = !filterNonVeg
                                    if (filterNonVeg) filterVeg = false
                                },
                                label = { Text("Non-Veg", style = MaterialTheme.typography.labelSmall) },
                                leadingIcon = { 
                                    Box(modifier = Modifier.size(10.dp).background(Color(0xFFDC2626), MaterialTheme.shapes.extraSmall)) 
                                },
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled = true,
                                    selected = filterNonVeg,
                                    borderColor = Color(0xFFDC2626).copy(alpha = 0.5f),
                                    selectedBorderColor = Color(0xFFDC2626)
                                )
                            )
                        }
                        item {
                            FilterChip(
                                selected = filterRating4Plus,
                                onClick = { filterRating4Plus = !filterRating4Plus },
                                label = { Text("4.0+", style = MaterialTheme.typography.labelSmall) },
                                leadingIcon = { Icon(Icons.Default.Star, null, modifier = Modifier.size(14.dp), tint = Color(0xFFFACC15)) }
                            )
                        }
                    }

                    // Filter Logic
                    val filteredItems = remember(state.menu, searchQuery, selectedCategory, filterVeg, filterNonVeg, filterRating4Plus) {
                        state.menu.filter { item ->
                            val matchesSearch = item.name.contains(searchQuery, ignoreCase = true) ||
                                               (item.description?.contains(searchQuery, ignoreCase = true) == true)
                            
                            val matchesCategory = when (selectedCategory) {
                                "All" -> true
                                "Recommended" -> item.isFeatured
                                else -> item.category == selectedCategory
                            }
                            
                            val nonVegKeywords = listOf("chicken", "mutton", "fish", "prawn", "egg", "meat", "beef", "pork", "seafood", "kebab")
                            val combinedText = "${item.name} ${item.description} ${item.category}".lowercase()
                            val isNonVeg = nonVegKeywords.any { combinedText.contains(it) }
                            val isVeg = !isNonVeg
                            
                            val matchesVeg = !filterVeg || isVeg
                            val matchesNonVeg = !filterNonVeg || isNonVeg
                            val matchesRating = !filterRating4Plus || item.rating >= 4.0
                            
                            matchesSearch && matchesCategory && matchesVeg && matchesNonVeg && matchesRating
                        }
                    }
                    
                    if (filteredItems.isEmpty()) {
                        TiffzyEmptyState(message = "No dishes found matching your selection.")
                    } else {
                        val favItems = (uiState as? MenuUiState.Success)?.favorites ?: emptyList()
                        val restaurant = (uiState as? MenuUiState.Success)?.restaurant

                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            modifier = Modifier.fillMaxSize(),
                            horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium),
                            verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium),
                            contentPadding = PaddingValues(
                                start = Dimens.PaddingMedium,
                                end = Dimens.PaddingMedium,
                                bottom = Dimens.PaddingExtraLarge
                            )
                        ) {
                            items(filteredItems) { item ->
                                val isFavorite = restaurant != null && favItems.any { it.key == "${restaurant.slug}:${item.id}" }
                                MenuItemGridCard(
                                    item = item,
                                    isFavorite = isFavorite,
                                    onAdd = { viewModel.addToCart(item) },
                                    onToggleFavorite = { viewModel.toggleFavorite(item) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MenuItemGridCard(
    item: MenuItem,
    isFavorite: Boolean = false,
    onAdd: () -> Unit,
    onToggleFavorite: () -> Unit = {}
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.small,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            // Image at Top
            Box {
                AsyncImage(
                    model = ImageUtils.resolveImageUrl(item.image),
                    contentDescription = item.name,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp)
                        .clip(MaterialTheme.shapes.small)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentScale = ContentScale.Crop
                )

                // Favorite Icon Overlay
                IconButton(
                    onClick = onToggleFavorite,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                        .size(32.dp)
                        .background(Color.Black.copy(alpha = 0.3f), CircleShape)
                ) {
                    Icon(
                        imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = if (isFavorite) "Remove from favorites" else "Add to favorites",
                        tint = if (isFavorite) Color.Red else Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
                
                // Rating Badge Overlay
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(8.dp),
                    color = Color.White.copy(alpha = 0.9f),
                    shape = MaterialTheme.shapes.extraSmall
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = String.format(Locale.getDefault(), "%.1f", item.rating),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Icon(
                            Icons.Default.Star, 
                            null, 
                            tint = Color(0xFF16A34A), 
                            modifier = Modifier.size(10.dp).padding(start = 2.dp)
                        )
                    }
                }

                if (!item.isAvailable) {
                    Box(
                        modifier = Modifier
                            .matchParentSize()
                            .background(Color.Black.copy(alpha = 0.4f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Surface(
                            color = Color.Black.copy(alpha = 0.7f),
                            shape = MaterialTheme.shapes.extraSmall
                        ) {
                            Text(
                                text = "OUT OF STOCK",
                                color = Color.White,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            Column(modifier = Modifier.padding(6.dp)) {
                DietIcon(item)
                
                Text(
                    text = item.name.uppercase(),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                Row(
                    modifier = Modifier.padding(top = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "₹${item.price.toInt()}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        fontFamily = FontFamily.Monospace
                    )
                    
                    Spacer(modifier = Modifier.weight(1f))
                    
                    TiffzyAddButton(
                        onClick = onAdd,
                        enabled = item.isAvailable,
                        modifier = Modifier
                            .width(64.dp)
                            .height(32.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun TiffzyAddButton(
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = Color(0xFF16A34A),
            disabledContentColor = MaterialTheme.colorScheme.outline
        ),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (enabled) Color(0xFFE2E8F0) else MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)),
        contentPadding = PaddingValues(0.dp)
    ) {
        Text(
            text = if (enabled) "ADD" else "SOLD OUT",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            fontSize = if (enabled) 12.sp else 8.sp
        )
    }
}

@Composable
fun DietIcon(item: MenuItem) {
    val nonVegKeywords = listOf("chicken", "mutton", "fish", "prawn", "egg", "meat", "beef", "pork", "seafood", "kebab")
    val combinedText = "${item.name} ${item.description} ${item.category}".lowercase()
    val isNonVeg = nonVegKeywords.any { combinedText.contains(it) }

    Box(
        modifier = Modifier
            .size(14.dp)
            .background(Color.White)
            .padding(2.dp)
            .background(if (isNonVeg) Color(0xFFDC2626) else Color(0xFF16A34A), MaterialTheme.shapes.extraSmall)
    )
}

@Composable
fun MenuCategoryCircleItem(
    name: String,
    imageUrl: String? = null,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(70.dp)
            .clickable { onClick() }
    ) {
        Surface(
            modifier = Modifier.size(60.dp),
            shape = CircleShape,
            color = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
            border = if (isSelected) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null
        ) {
            Box(contentAlignment = Alignment.Center) {
                if (!imageUrl.isNullOrEmpty()) {
                    AsyncImage(
                        model = ImageUtils.resolveImageUrl(imageUrl),
                        contentDescription = name,
                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                        contentScale = ContentScale.Crop,
                        error = painterResource(id = com.tiffzy.app.R.drawable.baked_goods_1)
                    )
                } else {
                    Icon(
                        imageVector = getCategoryIcon(name),
                        contentDescription = name,
                        modifier = Modifier.size(30.dp),
                        tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = name,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Bold,
            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            maxLines = 1
        )
    }
}
