import { Routes, Route, Navigate } from "react-router-dom";

// ============================
// PUBLIC PAGES
// ============================
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Cart from "./pages/Cart";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import ThankYou from "./pages/ThankYou";

// ============================
// ADMIN PAGES
// ============================
import Admin from "./pages/Admin";
import Orders from "./pages/Orders";
import Tables from "./pages/Tables";
import Dashboard from "./pages/Dashboard";

// ============================
// LAYOUT + AUTH
// ============================
import AdminLayout from "./layouts/AdminLayout";
import AuthProvider from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import { StaffSocketProvider } from "./context/StaffSocketContext.jsx";

// ============================
// OWNER / RESTAURANT PAGES
// ============================
import OwnerDashboard from "./pages/admin/OwnerDashboard";
import OwnerOrders from "./pages/admin/OwnerOrders";
import MenuStudio from "./pages/admin/MenuStudio";
import OwnerTables from "./pages/admin/OwnerTables";
import OwnerKitchenLive from "./pages/admin/OwnerKitchenLive";
import OwnerAnalytics from "./pages/admin/OwnerAnalytics";
import OwnerFinance from "./pages/admin/OwnerFinance";
import OwnerStaff from "./pages/admin/OwnerStaff";
import OwnerSettings from "./pages/admin/OwnerSettings";
import OwnerNotifications from "./pages/admin/OwnerNotifications";
import RestaurantMenu from "./pages/restaurant/RestaurantMenu";
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import NewOrder from "./pages/admin/NewOrder.jsx";
import PaymentSuccess from "./pages/admin/PaymentSuccess.jsx";
import Kitchen from "./pages/Kitchen.jsx";
import Waiter from "./pages/Waiter.jsx";

import OwnerLayout from "./layouts/OwnerLayout.jsx";

export default function App() {
    return (
        <AuthProvider>
            <StaffSocketProvider>
                <div className="theme-adaptive min-h-screen">
                    <Routes>

                    {/* ================================= */}
                    {/* PUBLIC CUSTOMER ROUTES */}
                    {/* ================================= */}

                    <Route
                        path="/"
                        element={<Navigate to="/r/cafeking" replace />}
                    />

                    <Route
                        path="/cart"
                        element={
                            <>
                                <Navbar />
                                <Cart />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/login"
                        element={
                            <>
                                <Login />
                                <Footer />
                            </>
                        }
                    />

                    <Route path="/profile" element={<Navigate to="/profile/overview" replace />} />
                    <Route
                        path="/profile/overview"
                        element={
                            <>
                                <Navbar />
                                <Profile section="overview" />
                                <Footer />
                            </>
                        }
                    />
                    <Route
                        path="/profile/order-history"
                        element={
                            <>
                                <Navbar />
                                <Profile section="orders" />
                                <Footer />
                            </>
                        }
                    />
                    <Route path="/profile/orders" element={<Navigate to="/profile/order-history" replace />} />
                    <Route
                        path="/profile/orders/:id"
                        element={
                            <>
                                <Navbar />
                                <Profile section="ordersdetail" />
                                <Footer />
                            </>
                        }
                    />
                    <Route
                        path="/profile/wallet"
                        element={
                            <>
                                <Navbar />
                                <Profile section="wallet" />
                                <Footer />
                            </>
                        }
                    />
                    <Route
                        path="/profile/edit"
                        element={
                            <>
                                <Navbar />
                                <Profile section="edit" />
                                <Footer />
                            </>
                        }
                    />
                    <Route
                        path="/profile/favorites"
                        element={
                            <>
                                <Navbar />
                                <Profile section="favorites" />
                                <Footer />
                            </>
                        }
                    />
                    <Route
                        path="/profile/settings"
                        element={
                            <>
                                <Navbar />
                                <Profile section="settings" />
                                <Footer />
                            </>
                        }
                    />

                    {/* Backward compatible alias */}
                    <Route path="/orders/history" element={<Navigate to="/profile/order-history" replace />} />

                    <Route
                        path="/orders/thank-you"
                        element={
                            <>
                                <Navbar />
                                <ThankYou />
                                <Footer />
                            </>
                        }
                    />

                    {/* ================================= */}
                    {/* STAFF REAL-TIME PAGES */}
                    {/* ================================= */}

                    <Route
                        path="/admin/new-order"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "WAITER", "STAFF"]}>
                                <NewOrder />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/payment-success"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "WAITER", "STAFF"]}>
                                <PaymentSuccess />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/kitchen"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "CHEF"]}>
                                <Kitchen />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/waiter"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER", "CASHIER"]}>
                                <Waiter />
                            </ProtectedRoute>
                        }
                    />

                    {/* ================================= */}
                    {/* RESTAURANT CUSTOMER MENU */}
                    {/* ================================= */}

                    <Route path="/r/:slug" element={<RestaurantMenu />} />

                    {/* ================================= */}
                    {/* SUPER ADMIN PANEL */}
                    {/* ================================= */}

                    <Route
                        path="/super-admin"
                        element={
                            <ProtectedRoute role="SUPER_ADMIN">
                                <SuperAdminDashboard />
                            </ProtectedRoute>
                        }
                    />

                    {/* ================================= */}
                    {/* OWNER PANEL */}
                    {/* ================================= */}

                    <Route
                        path="/owner"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"]}>
                                <OwnerLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<OwnerDashboard />} />
                        <Route path="orders" element={<OwnerOrders />} />
                        <Route path="menu" element={<MenuStudio />} />
                        <Route path="tables" element={<OwnerTables />} />
                        <Route path="kitchen" element={<OwnerKitchenLive />} />
                        <Route path="analytics" element={<OwnerAnalytics />} />
                        <Route path="finance" element={<OwnerFinance />} />
                        <Route path="staff" element={<OwnerStaff />} />
                        <Route path="settings" element={<OwnerSettings />} />
                        <Route path="notifications" element={<OwnerNotifications />} />
                    </Route>


                    {/* ================================= */}
                    {/* ADMIN PROTECTED ROUTES */}
                    {/* ================================= */}

                    <Route
                        path="/admin/*"
                        element={
                            <ProtectedRoute role="admin">
                                <AdminLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<Dashboard />} />
                        <Route path="menu" element={<Admin />} />
                        <Route path="orders" element={<Orders />} />
                        <Route path="tables" element={<Tables />} />
                    </Route>

                    {/* ================================= */}
                    {/* 404 FALLBACK - KEEP LAST */}
                    {/* ================================= */}

                    <Route
                        path="*"
                        element={
                            <div className="h-screen flex items-center justify-center text-3xl font-bold">
                                404 - Page Not Found
                            </div>
                        }
                    />

                    </Routes>
                </div>
            </StaffSocketProvider>
        </AuthProvider>
    );
}
