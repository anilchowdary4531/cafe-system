package com.tiffzy.app.ui.components

import android.graphics.Bitmap
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TiffzyWebViewScreen(
    title: String,
    url: String,
    token: String? = null, // Accept the auth token
    onBack: () -> Unit
) {
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var progress by remember { mutableIntStateOf(0) }

    // JavaScript to sync authentication and hide "Back to Tiffzy" links
    val script = """
        (function() {
            try {
                var token = '${token ?: ""}';
                if (token !== '') {
                    if (localStorage.getItem('customerToken') !== token) {
                        localStorage.setItem('customerToken', token);
                        localStorage.setItem('android_injected', 'true');
                        // window.location.reload(); 
                    }
                }

                // Hide common UI elements that don't belong in App WebView
                var selectors = ['header', 'nav', '.navbar', '.theme-navbar', '.back-to-tiffzy'];
                selectors.forEach(function(s) {
                    var elements = document.querySelectorAll(s);
                    elements.forEach(function(el) { el.style.display = 'none'; });
                });
                
                // Hide "Login" links/buttons specifically
                var links = document.getElementsByTagName('a');
                for (var i = 0; i < links.length; i++) {
                    var text = links[i].innerText.toLowerCase();
                    if (text.includes('back to tiffzy') || text === 'login' || text === 'sign in') {
                        links[i].style.display = 'none';
                    }
                }
            } catch (e) {
                console.error('JS Injection Error:', e);
            }
        })();
    """.trimIndent()

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = title,
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            loadWithOverviewMode = true
                            useWideViewPort = true
                            builtInZoomControls = true
                            displayZoomControls = false
                            javaScriptCanOpenWindowsAutomatically = true
                            mediaPlaybackRequiresUserGesture = false
                        }
                        
                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                progress = newProgress
                                if (newProgress > 10) {
                                    view?.evaluateJavascript(script, null)
                                }
                                if (newProgress == 100) isLoading = false
                            }
                        }

                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                val newUrl = request?.url?.toString() ?: return false
                                // Handle mailto, tel, etc.
                                if (newUrl.startsWith("mailto:") || newUrl.startsWith("tel:") || newUrl.startsWith("whatsapp:")) {
                                    try {
                                        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, request.url)
                                        view?.context?.startActivity(intent)
                                        return true
                                    } catch (e: Exception) {
                                        return false
                                    }
                                }
                                return false // Allow WebView to load the URL
                            }

                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                super.onPageStarted(view, url, favicon)
                                android.util.Log.d("WEBVIEW_DEBUG", "Loading URL: ${url ?: "null"}")
                                isLoading = true
                                errorMessage = null
                                // For SPA, we inject script on start to set token before first render
                                view?.evaluateJavascript(script, null)
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                isLoading = false
                                // Ensure script runs when fully loaded
                                view?.evaluateJavascript(script, null)
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: WebResourceError?
                            ) {
                                super.onReceivedError(view, request, error)
                                if (request?.isForMainFrame == true) {
                                    errorMessage = "Connection error. Please try again."
                                    isLoading = false
                                }
                            }
                        }
                        loadUrl(url)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )

            if (isLoading) {
                LinearProgressIndicator(
                    progress = { progress / 100f },
                    modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
                    color = MaterialTheme.colorScheme.primary
                )
            }

            if (errorMessage != null) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(text = errorMessage!!, color = MaterialTheme.colorScheme.error)
                    Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
                }
            }
        }
    }
}
