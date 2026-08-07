package com.tiffzy.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import com.tiffzy.app.R
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onOtpSent: () -> Unit,
    onNavigateToRegister: () -> Unit,
    onNavigateToDeleteAccount: () -> Unit,
    onNavigateToCompleteProfile: () -> Unit,
    onAuthenticated: () -> Unit,
    onStaffLoggedIn: () -> Unit = {} // Kept for signature compatibility
) {
    var loginMode by remember { mutableStateOf("password") } // Default to "password"
    
    // OTP fields
    var emailAddress by remember { mutableStateOf("") }
    
    // Password fields
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    
    var showLanguageSelector by remember { mutableStateOf(false) }
    val currentLanguageCode by viewModel.appLanguage.collectAsState()
    val currentLanguage = supportedLanguages.find { it.code == currentLanguageCode } ?: supportedLanguages[0]
    
    val uiState by viewModel.uiState.collectAsState()

    val context = LocalContext.current
    val gso = remember {
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestProfile()
            .requestIdToken("508607286319-gdke04tjvlmttvf5ppcm45j0ncqtuhks.apps.googleusercontent.com")
            .build()
    }
    val googleSignInClient = remember { GoogleSignIn.getClient(context, gso) }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        android.util.Log.d("GOOGLE_AUTH", "STEP 1: ActivityResult received. ResultCode: ${result.resultCode}")
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            android.util.Log.d("GOOGLE_AUTH", "STEP 2: Attempting task.getResult()")
            val account = task.getResult(ApiException::class.java)
            
            val token = account.idToken
            android.util.Log.d("GOOGLE_AUTH", "STEP 3: Account received. Email=${account.email}")
            android.util.Log.d("GOOGLE_AUTH", "STEP 4: ID Token present: ${token != null}")
            
            if (token == null) {
                android.util.Log.e("GOOGLE_AUTH", "ERROR: ID Token is NULL. This usually means the Web Client ID is incorrect or mismatching.")
            } else {
                android.util.Log.d("GOOGLE_AUTH", "STEP 5: Calling viewModel.loginWithGoogle with token length: ${token.length}")
            }

            viewModel.loginWithGoogle(
                idToken = token ?: "",
                email = account.email,
                name = account.displayName,
                googleId = account.id,
                picture = account.photoUrl?.toString()
            )
        } catch (e: ApiException) {
            android.util.Log.e(
                "GOOGLE_AUTH",
                "StatusCode=${e.statusCode}, Message=${e.message}",
                e
            )
            viewModel.resetState()
        } catch (e: Exception) {
            android.util.Log.e("GOOGLE_AUTH", "TRACE: FAILURE - Unexpected Exception: ${e.message}", e)
            viewModel.resetState()
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.OtpSent) {
            onOtpSent()
        } else if (uiState is AuthUiState.Authenticated) {
            onAuthenticated()
        } else if (uiState is AuthUiState.RequiresProfileCompletion) {
            viewModel.pendingProfileInfo = (uiState as AuthUiState.RequiresProfileCompletion).partialInfo
            onNavigateToCompleteProfile()
        }
    }

    Scaffold(
        topBar = { 
            TiffzyTopBar(
                title = stringResource(R.string.sign_in),
                actions = {
                    TextButton(onClick = { showLanguageSelector = true }) {
                        Text(
                            text = "${currentLanguage.flag} ${currentLanguage.code.uppercase()}",
                            color = MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }
            ) 
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        if (showLanguageSelector) {
            LanguageSelectorDialog(
                currentLanguageCode = currentLanguageCode,
                onLanguageSelected = { viewModel.changeLanguage(it) },
                onDismiss = { showLanguageSelector = false }
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
                .padding(Dimens.PaddingLarge)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.welcome_to_tiffzy),
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center
            )
            
            Text(
                text = stringResource(R.string.welcome_subtitle),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

            if (loginMode == "password") {
                // PASSWORD LOGIN VIEW
                TiffzyTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = stringResource(R.string.username_or_email),
                    placeholder = "alex_99",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

                TiffzyTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = stringResource(R.string.password),
                    placeholder = "Enter your password",
                    isPassword = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                )
            } else {
                // OTP LOGIN VIEW
                TiffzyTextField(
                    value = emailAddress,
                    onValueChange = { emailAddress = it },
                    label = stringResource(R.string.email_address),
                    placeholder = "e.g. alex@example.com",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )
            }

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            if (uiState is AuthUiState.Loading) {
                TiffzyLoadingIndicator()
            } else {
                TiffzyPrimaryButton(
                    text = if (loginMode == "otp") stringResource(R.string.send_otp) else stringResource(R.string.login),
                    onClick = {
                        if (loginMode == "otp") {
                            viewModel.email = emailAddress
                            viewModel.sendOtp()
                        } else {
                            viewModel.username = username
                            viewModel.password = password
                            viewModel.loginCustomer()
                        }
                    }
                )
            }

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            HorizontalDivider(
                modifier = Modifier.padding(vertical = Dimens.PaddingMedium),
                color = MaterialTheme.colorScheme.outlineVariant
            )

            OutlinedButton(
                onClick = { 
                    android.util.Log.d("GOOGLE_AUTH", "Continue with Google button clicked")
                    launcher.launch(googleSignInClient.signInIntent) 
                },
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.onSurface
                )
            ) {
                Text(
                    text = stringResource(R.string.continue_with_google),
                    modifier = Modifier.padding(vertical = 8.dp),
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            // THE "SMALL LINE" FOR SWITCHING MODES
            TextButton(
                onClick = { 
                    loginMode = if (loginMode == "password") "otp" else "password" 
                    viewModel.resetState()
                }
            ) {
                Text(
                    text = if (loginMode == "password") stringResource(R.string.login_with_otp_instead) else stringResource(R.string.login_with_password_instead),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }

            TextButton(onClick = onNavigateToRegister) {
                Text(
                    text = stringResource(R.string.dont_have_account),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            TextButton(onClick = onNavigateToDeleteAccount) {
                Text(
                    text = stringResource(R.string.need_to_delete_account),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            if (uiState is AuthUiState.Error) {
                Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
                Text(
                    text = (uiState as AuthUiState.Error).message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
