package com.tiffzy.app.utils

import android.content.Context
import java.util.Locale

object LanguageHelper {
    
    fun applyLanguage(context: Context, languageCode: String) {
        val locale = Locale.forLanguageTag(languageCode)
        Locale.setDefault(locale)
        
        val resources = context.resources
        val configuration = resources.configuration
        
        configuration.setLocale(locale)
        context.createConfigurationContext(configuration)
        
        // This is still needed for some legacy components and resources access
        resources.updateConfiguration(configuration, resources.displayMetrics)
    }
}
