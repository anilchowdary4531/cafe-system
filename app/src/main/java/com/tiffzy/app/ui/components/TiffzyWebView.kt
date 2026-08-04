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
    onBack: () -> Unit
) {
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var progress by remember { mutableIntStateOf(0) }

    // JavaScript to hide "Back to Tiffzy" links
    val hideElementsScript = """
        (function() {
            var links = document.getElementsByTagName('a');
            for (var i = 0; i < links.length; i++) {
                if (links[i].innerText.toLowerCase().includes('back to tiffzy')) {
                    links[i].style.display = 'none';
                }
            }
            // Also hide any headers/navs that might contain it if nested
            var divs = document.getElementsByTagName('div');
            for (var i = 0; i < divs.length; i++) {
                 if (divs[i].innerText.trim().toLowerCase() === 'back to tiffzy') {
                    divs[i].style.display = 'none';
                 }
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
                                if (newProgress > 80) {
                                    // Inject script early if possible
                                    view?.evaluateJavascript(hideElementsScript, null)
                                }
                                if (newProgress == 100) isLoading = false
                            }
                        }

                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                super.onPageStarted(view, url, favicon)
                                isLoading = true
                                errorMessage = null
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                isLoading = false
                                // Inject script when page is fully loaded
                                view?.evaluateJavascript(hideElementsScript, null)
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
