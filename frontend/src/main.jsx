import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./utils/axiosDefaults.js";
import { CartProvider } from "./context/CartContext";
import { BrowserRouter } from "react-router-dom";
import { RestaurantThemeProvider } from "./context/ThemeContext.jsx";
import { RestaurantContextProvider } from "./context/RestaurantContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import ToastHost from "./components/ToastHost.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
    <ErrorBoundary>
        <BrowserRouter>
            <LanguageProvider>
                <RestaurantThemeProvider>
                    <RestaurantContextProvider>
                        <CartProvider>
                            <App />
                            <ToastHost />
                        </CartProvider>
                    </RestaurantContextProvider>
                </RestaurantThemeProvider>
            </LanguageProvider>
        </BrowserRouter>
    </ErrorBoundary>
);
