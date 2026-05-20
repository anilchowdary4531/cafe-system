import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./utils/axiosDefaults.js";
import { CartProvider } from "./context/CartContext";
import { BrowserRouter } from "react-router-dom";
import { RestaurantThemeProvider } from "./context/ThemeContext.jsx";
import { RestaurantContextProvider } from "./context/RestaurantContext.jsx";
import ToastHost from "./components/ToastHost.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
    <BrowserRouter>
        <RestaurantThemeProvider>
            <RestaurantContextProvider>
                <CartProvider>
                    <App />
                    <ToastHost />
                </CartProvider>
            </RestaurantContextProvider>
        </RestaurantThemeProvider>
    </BrowserRouter>
);
