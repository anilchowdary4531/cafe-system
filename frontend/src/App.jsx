import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// ============================
// PUBLIC PAGES
// ============================
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import RefundPolicy from "./pages/RefundPolicy";
import ContactUs from "./pages/ContactUs";
import AboutUs from "./pages/AboutUs";
import HelpCenter from "./pages/HelpCenter";
import Pricing from "./pages/Pricing";
import QROrdering from "./pages/QROrdering";
import POSDashboardPage from "./pages/POSDashboardPage";
import ProductAnalytics from "./pages/ProductAnalytics";
import InventoryPage from "./pages/InventoryPage";

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
import OwnerPayLater from "./pages/admin/OwnerPayLater";
import RestaurantPublicMenu from "./pages/restaurant/RestaurantPublicMenu";
import RestaurantMenu from "./pages/restaurant/RestaurantMenu";
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import SuperAdminCreateRestaurant from "./pages/super-admin/SuperAdminCreateRestaurant";
import SuperAdminUsers from "./pages/super-admin/SuperAdminUsers";
import SuperAdminSettings from "./pages/super-admin/SuperAdminSettings";
import NewOrder from "./pages/admin/NewOrder.jsx";
import PaymentSuccess from "./pages/admin/PaymentSuccess.jsx";
import Kitchen from "./pages/Kitchen.jsx";
import KitchenChefDetail from "./pages/KitchenChefDetail.jsx";
import StaffProfile from "./pages/StaffProfile.jsx";
import Server from "./pages/Server.jsx";

import OwnerLayout from "./layouts/OwnerLayout.jsx";

export default function App() {
    const location = useLocation();

    return (
        <AuthProvider>
            <StaffSocketProvider>
                <div className="theme-adaptive min-h-screen">
                    <Routes>

                    {/* ================================= */}
                    {/* PUBLIC CUSTOMER ROUTES */}
                    {/* ================================= */}

                    <Route path="/" element={<Landing />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/refund-policy" element={<RefundPolicy />} />
                    <Route path="/contact-us" element={<ContactUs />} />
                    <Route path="/about-us" element={<AboutUs />} />
                    <Route path="/help-center" element={<HelpCenter />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/qr-ordering" element={<QROrdering />} />
                    <Route path="/pos-dashboard" element={<POSDashboardPage />} />
                    <Route path="/analytics" element={<ProductAnalytics />} />
                    <Route path="/inventory" element={<InventoryPage />} />

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

                    <Route path="/profile" element={<Navigate to={`/profile/overview${location.search || ""}`} replace />} />
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
                    <Route path="/profile/orders" element={<Navigate to={`/profile/order-history${location.search || ""}`} replace />} />
                    <Route
                        path="/profile/addresses"
                        element={
                            <>
                                <Navbar />
                                <Profile section="addresses" />
                                <Footer />
                            </>
                        }
                    />
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
                        path="/profile/pay-later"
                        element={
                            <>
                                <Navbar />
                                <Profile section="pay-later" />
                                <Footer />
                            </>
                        }
                    />
                    <Route
                        path="/profile/pay-later/:accountId"
                        element={
                            <>
                                <Navbar />
                                <Profile section="pay-later-detail" />
                                <Footer />
                            </>
                        }
                    />
                    <Route
                        path="/profile/notifications"
                        element={
                            <>
                                <Navbar />
                                <Profile section="notifications" />
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
                        path="/kitchen/chef/:chefId"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "CHEF"]}>
                                <KitchenChefDetail />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/staff/profile/:staffId"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "CHEF", "WAITER", "CASHIER", "STAFF"]}>
                                <StaffProfile />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/kitchen/assigned-items"
                        element={<Navigate to="/kitchen" replace />}
                    />
                    <Route
                        path="/kitchen/assignment-history"
                        element={<Navigate to="/kitchen" replace />}
                    />

                    <Route
                        path="/waiter"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER", "CASHIER"]}>
                                <Server />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/server"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER", "CASHIER"]}>
                                <Server />
                            </ProtectedRoute>
                        }
                    />

                    {/* ================================= */}
                    {/* RESTAURANT CUSTOMER MENU */}
                    {/* ================================= */}

                    <Route path="/r/:slug" element={<Landing />} />
                    <Route path="/r/:slug/menu" element={<RestaurantPublicMenu key={`${location.pathname}${location.search}`} />} />
                    <Route path="/m/:slug/:table?" element={<RestaurantMenu key={`${location.pathname}${location.search}`} />} />
                    <Route path="/debug/menu/:slug/:table?" element={<RestaurantMenu key={`${location.pathname}${location.search}`} />} />

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
                    <Route
                        path="/super-admin/create-restaurant"
                        element={
                            <ProtectedRoute role="SUPER_ADMIN">
                                <SuperAdminCreateRestaurant />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/super-admin/users"
                        element={
                            <ProtectedRoute role="SUPER_ADMIN">
                                <SuperAdminUsers />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/super-admin/settings"
                        element={
                            <ProtectedRoute role="SUPER_ADMIN">
                                <SuperAdminSettings />
                            </ProtectedRoute>
                        }
                    />

                    {/* ================================= */}
                    {/* OWNER PANEL */}
                    {/* ================================= */}

                    <Route
                        path="/owner"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER", "CHEF", "CASHIER"]}>
                                <OwnerLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<OwnerDashboard />} />
                        <Route path="orders" element={<OwnerOrders />} />
                        <Route path="online-orders" element={<OwnerOrders sourceFilter="ONLINE" />} />
                        <Route path="menu" element={<MenuStudio />} />
                        <Route path="tables" element={<OwnerTables />} />
                        <Route path="kitchen" element={<OwnerKitchenLive />} />
                        <Route path="analytics" element={<OwnerAnalytics />} />
                        <Route path="finance" element={<OwnerFinance />} />
                        <Route path="pay-later" element={<OwnerPayLater />} />
                        <Route path="pay-later/:accountId" element={<OwnerPayLater />} />
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
