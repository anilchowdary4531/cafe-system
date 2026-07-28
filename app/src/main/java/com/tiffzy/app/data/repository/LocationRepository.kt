package com.tiffzy.app.data.repository

import com.tiffzy.app.data.model.Address
import com.tiffzy.app.data.model.CreateAddressRequest
import com.tiffzy.app.data.remote.ApiService

class LocationRepository(private val apiService: ApiService) {

    suspend fun getAddresses(): List<Address> {
        return apiService.getAddresses().addresses
    }

    suspend fun createAddress(request: CreateAddressRequest): Address {
        return apiService.createAddress(request)
    }

    suspend fun deleteAddress(id: Int) {
        apiService.deleteAddress(id)
    }
}
