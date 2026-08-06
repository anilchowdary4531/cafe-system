package com.tiffzy.app.ui.customer.checkout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.tiffzy.app.data.repository.CheckoutRepository
import com.tiffzy.app.ui.customer.cart.CartViewModel

class CheckoutViewModelFactory(
    private val repository: CheckoutRepository,
    private val cartViewModel: CartViewModel
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(CheckoutViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return CheckoutViewModel(repository, cartViewModel) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
