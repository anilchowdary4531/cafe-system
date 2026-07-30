import React, { createContext, useContext, useState, useEffect } from "react";

export const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
];

const TRANSLATIONS = {
  en: {
    selectLanguage: "Select Language",
    appLanguage: "App Language",
    cancel: "Cancel",
    close: "Close",
    
    customer: "Customer",
    staff: "Staff",
    customerLogin: "Customer Login",
    staffLogin: "Staff Login",
    createAccount: "Create Account",
    otpLogin: "OTP Login",
    welcomeBack: "Welcome Back",
    loginSubtitle: "Enter your username, phone or email and password to log in.",
    createAccountSubtitle: "Sign up to view your orders, earn rewards and reorder faster.",
    otpSubtitle: "Secure OTP login to view your orders and reorder faster.",
    staffSubtitle: "Login to manage your restaurant",
    registerRestaurant: "Register Restaurant",
    
    usernamePhoneEmail: "Username / Phone / Email",
    username: "Username",
    phoneNumber: "Phone Number",
    fullName: "Full Name",
    emailAddress: "Email Address",
    password: "Password",
    otp: "OTP",
    
    placeholderUsernamePhoneEmail: "Username, phone number or email",
    placeholderUsername: "Choose a unique username (e.g. alex_99)",
    placeholderPhone: "Enter phone number",
    placeholderFullName: "Your full name",
    placeholderEmail: "you@example.com",
    placeholderPassword: "Enter your password",
    placeholderPasswordMin: "Min 6 characters",
    placeholderOtp: "Enter 6-digit OTP",
    
    loginBtn: "Login",
    loggingIn: "Logging in...",
    createAccountBtn: "Create Account & Continue",
    creatingAccount: "Creating Account...",
    sendOtp: "Send OTP",
    sendingOtp: "Sending OTP...",
    verifyContinue: "Verify & Continue",
    verifying: "Verifying...",
    resendOtp: "Resend OTP",
    changeNumber: "Change number",
    loginHere: "Login here",
    registerHere: "Register here",
    
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    orPreferOtp: "Or prefer OTP?",
    useOtpLogin: "Use OTP Login",
    havePassword: "Have a password?",
    passwordLogin: "Password Login",
    dontHaveRestaurant: "Don't have a restaurant?",
    alreadyHaveRestaurant: "Already have a restaurant?",
    
    smartOS: "Smart restaurant operating system for modern cafes, dining, billing and live orders.",
    qrOrdering: "⚡ QR Table Ordering",
    liveKitchen: "📦 Live Kitchen Orders",
    analyticsDash: "📈 Analytics Dashboard",
    billingPayments: "💳 Billing & Payments",
    builtForGrowth: "Built for growth • Built for speed",
    poweredBy: "Powered by Tiffzy OS",
    
    myProfile: "My Profile",
    personalInformation: "Personal Information",
    myOrders: "My Orders",
    myAddresses: "Saved Addresses",
    walletCredit: "Khata / Pay Later",
    notifications: "Notifications",
    settings: "Settings",
    logOut: "Log Out",
  },
  te: {
    selectLanguage: "భాషను ఎంచుకోండి",
    appLanguage: "యాప్ భాష",
    cancel: "రద్దు చేయి",
    close: "మూసివేయి",
    
    customer: "కస్టమర్",
    staff: "స్టాఫ్",
    customerLogin: "కస్టమర్ లాగిన్",
    staffLogin: "స్టాఫ్ లాగిన్",
    createAccount: "ఖాతాను సృష్టించండి",
    otpLogin: "OTP లాగిన్",
    welcomeBack: "స్వాగతం",
    loginSubtitle: "లాగిన్ అవ్వడానికి మీ యూజర్ నేమ్, ఫోన్ లేదా ఇమెయిల్ మరియు పాస్‌వర్డ్ నమోదు చేయండి.",
    createAccountSubtitle: "మీ ఆర్డర్‌లను చూడటానికి, రివార్డ్‌లను పొందడానికి ఖాతాను నమోదు చేయండి.",
    otpSubtitle: "మీ ఆర్డర్‌లను వేగంగా పునరావృతం చేయడానికి సురక్షితమైన OTP లాగిన్.",
    staffSubtitle: "మీ రెస్టారెంట్‌ను నిర్వహించడానికి లాగిన్ చేయండి",
    registerRestaurant: "రెస్టారెంట్ నమోదు చేయండి",
    
    usernamePhoneEmail: "యూజర్ నేమ్ / ఫోన్ / ఇమెయిల్",
    username: "యూజర్ నేమ్",
    phoneNumber: "ఫోన్ నంబర్",
    fullName: "పూర్తి పేరు",
    emailAddress: "ఇమెయిల్ చిరునామా",
    password: "పాస్‌వర్డ్",
    otp: "OTP",
    
    placeholderUsernamePhoneEmail: "యూజర్ నేమ్, ఫోన్ నంబర్ లేదా ఇమెయిల్",
    placeholderUsername: "ప్రత్యేకమైన యూజర్ నేమ్ ఎంచుకోండి (ఉదా. alex_99)",
    placeholderPhone: "ఫోన్ నంబర్‌ను నమోదు చేయండి",
    placeholderFullName: "మీ పూర్తి పేరు",
    placeholderEmail: "you@example.com",
    placeholderPassword: "మీ పాస్‌వర్డ్‌ను నమోదు చేయండి",
    placeholderPasswordMin: "కనీసం 6 అక్షరాలు",
    placeholderOtp: "6-అంకెల OTP ఎంటర్ చేయండి",
    
    loginBtn: "లాగిన్",
    loggingIn: "లాగిన్ అవుతోంది...",
    createAccountBtn: "ఖాతాను సృష్టించి కొనసాగండి",
    creatingAccount: "ఖాతా సృష్టించబడుతోంది...",
    sendOtp: "OTP పంపండి",
    sendingOtp: "OTP పంపబడుతోంది...",
    verifyContinue: "ధృవీకరించి కొనసాగండి",
    verifying: "ధృవీకరిస్తోంది...",
    resendOtp: "OTP ని మళ్ళీ పంపండి",
    changeNumber: "నంబర్ మార్చండి",
    loginHere: "ఇక్కడ లాగిన్ చేయండి",
    registerHere: "ఇక్కడ నమోదు చేయండి",
    
    dontHaveAccount: "ఖాతా లేదా?",
    alreadyHaveAccount: "ఇప్పటికే ఖాతా ఉందా?",
    orPreferOtp: "లేదా OTP కావాలా?",
    useOtpLogin: "OTP లాగిన్ ఉపయోగించండి",
    havePassword: "పాస్‌వర్డ్ ఉందా?",
    passwordLogin: "పాస్‌వర్డ్ లాగిన్",
    dontHaveRestaurant: "రెస్టారెంట్ లేదా?",
    alreadyHaveRestaurant: "ఇప్పటికే రెస్టారెంట్ ఉందా?",
    
    smartOS: "ఆధునిక కేఫ్‌లు, డైనింగ్, బిల్లింగ్ మరియు లైవ్ ఆర్డర్‌ల కోసం స్మార్ట్ రెస్టారెంట్ ఆపరేటింగ్ సిస్టమ్.",
    qrOrdering: "⚡ QR టేబుల్ ఆర్డరింగ్",
    liveKitchen: "📦 లైవ్ కిచెన్ ఆర్డర్‌లు",
    analyticsDash: "📈 అనాలిటిక్స్ డాష్‌బోర్డ్",
    billingPayments: "💳 బిల్లింగ్ & పేమెంట్‌లు",
    builtForGrowth: "వేగవంతమైన ఎదుగుదల కోసం రూపుదిద్దుకుంది",
    poweredBy: "టిఫ్‌జీ OS మద్దతుతో",
    
    myProfile: "నా ప్రొఫైల్",
    personalInformation: "వ్యక్తిగత సమాచారం",
    myOrders: "నా ఆర్డర్‌లు",
    myAddresses: "సేవ్ చేసిన చిరునామాలు",
    walletCredit: "ఖాతా / పే లేటర్",
    notifications: "నోటిఫికేషన్‌లు",
    settings: "సెట్టింగ్‌లు",
    logOut: "లాగ్ అవుట్",
  },
  hi: {
    selectLanguage: "भाषा चुनें",
    appLanguage: "ऐप की भाषा",
    cancel: "रद्द करें",
    close: "बंद करें",
    
    customer: "ग्राहक",
    staff: "स्टाफ",
    customerLogin: "ग्राहक लॉगिन",
    staffLogin: "स्टाफ लॉगिन",
    createAccount: "खाता बनाएं",
    otpLogin: "ओटीपी लॉगिन",
    welcomeBack: "वापसी पर स्वागत है",
    loginSubtitle: "लॉगिन करने के लिए अपना यूजरनेम, फोन या ईमेल और पासवर्ड दर्ज करें।",
    createAccountSubtitle: "अपने ऑर्डर देखने और पुरस्कार पाने के लिए खाता बनाएं।",
    otpSubtitle: "अपने ऑर्डर जल्दी दोहराने के लिए सुरक्षित ओटीपी लॉगिन।",
    staffSubtitle: "अपने रेस्तरां को प्रबंधित करने के लिए लॉगिन करें",
    registerRestaurant: "रेस्तरां पंजीकृत करें",
    
    usernamePhoneEmail: "यूजरनेम / फोन / ईमेल",
    username: "यूजरनेम",
    phoneNumber: "फोन नंबर",
    fullName: "पूरा नाम",
    emailAddress: "ईमेल पता",
    password: "पासवर्ड",
    otp: "ओटीपी",
    
    placeholderUsernamePhoneEmail: "यूजरनेम, फोन नंबर या ईमेल",
    placeholderUsername: "एक अनूठा यूजरनेम चुनें (उदा. alex_99)",
    placeholderPhone: "फोन नंबर दर्ज करें",
    placeholderFullName: "आपका पूरा नाम",
    placeholderEmail: "you@example.com",
    placeholderPassword: "अपना पासवर्ड दर्ज करें",
    placeholderPasswordMin: "कम से कम 6 अक्षर",
    placeholderOtp: "6-अंकों का ओटीपी दर्ज करें",
    
    loginBtn: "लॉगिन",
    loggingIn: "लॉगिन हो रहा है...",
    createAccountBtn: "खाता बनाएं और आगे बढ़ें",
    creatingAccount: "खाता बनाया जा रहा है...",
    sendOtp: "ओटीपी भेजें",
    sendingOtp: "ओटीपी भेजा जा रहा है...",
    verifyContinue: "सत्यापित करें और आगे बढ़ें",
    verifying: "सत्यापित हो रहा है...",
    resendOtp: "ओटीपी पुनः भेजें",
    changeNumber: "नंबर बदलें",
    loginHere: "यहां लॉगिन करें",
    registerHere: "यहां पंजीकरण करें",
    
    dontHaveAccount: "क्या आपका खाता नहीं है?",
    alreadyHaveAccount: "क्या आपके पास खाता है?",
    orPreferOtp: "या ओटीपी पसंद करते हैं?",
    useOtpLogin: "ओटीपी लॉगिन का उपयोग करें",
    havePassword: "पासवर्ड है?",
    passwordLogin: "पासवर्ड लॉगिन",
    dontHaveRestaurant: "रेस्तरां नहीं है?",
    alreadyHaveRestaurant: "पहले से रेस्तरां है?",
    
    smartOS: "आधुनिक कैफे, भोजन, बिलिंग और लाइव ऑर्डर के लिए स्मार्ट रेस्तरां ऑपरेटिंग सिस्टम।",
    qrOrdering: "⚡ क्यूआर टेबल ऑर्डरिंग",
    liveKitchen: "📦 लाइव किचन ऑर्डर",
    analyticsDash: "📈 एनालिटिक्स डैशबोर्ड",
    billingPayments: "💳 बिलिंग और भुगतान",
    builtForGrowth: "विकास और गति के लिए निर्मित",
    poweredBy: "टिफ़्ज़ी ओएस द्वारा संचालित",
    
    myProfile: "मेरी प्रोफ़ाइल",
    personalInformation: "व्यक्तिगत जानकारी",
    myOrders: "मेरे आदेश",
    myAddresses: "सहेजे गए पते",
    walletCredit: "खाता / पे लेटर",
    notifications: "सूचनाएं",
    settings: "सेटिंग्स",
    logOut: "लॉग आउट",
  },
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const stored = localStorage.getItem("app_language");
      if (stored && LANGUAGES.some((l) => l.code === stored)) {
        return stored;
      }
    } catch {
      // ignore
    }
    return "en";
  });

  const setLanguage = (code) => {
    if (!LANGUAGES.some((l) => l.code === code)) return;
    try {
      localStorage.setItem("app_language", code);
    } catch {
      // ignore
    }
    setLanguageState(code);
  };

  const currentLanguageObj = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const t = (key, fallback = "") => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        currentLanguageObj,
        t,
        languages: LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext) || {
    language: "en",
    setLanguage: () => {},
    currentLanguageObj: LANGUAGES[0],
    t: (key, fallback) => fallback || key,
    languages: LANGUAGES,
  };
}
