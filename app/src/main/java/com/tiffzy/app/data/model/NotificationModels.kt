package com.tiffzy.app.data.model

data class RegisterFcmTokenRequest(
    val token: String,
    val platform: String = "android"
)
