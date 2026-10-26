import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Check,
    Eye,
    EyeOff,
    KeyRound,
    LoaderCircle,
    Lock,
    LogOut,
    Mail,
    Phone,
    Shield,
    Sparkles,
    UserCheck,
    UserRound,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { API } from "../config";
import { showToast } from "../utils/toast";
import NotificationSoundPicker from "./NotificationSoundPicker";
import { resolveEffectiveStaffRole } from "../utils/staffRole";

export default function StaffProfileView({
    onBack,
    backLabel = "Back to Workspace",
    title = "Staff Profile & Settings",
}) {
    const navigate = useNavigate();
    const { user, logout, token } = useAuth();

    const handleBack = () => {
        if (typeof onBack === "function") {
            onBack();
        } else {
            navigate(-1);
        }
    };

    const effectiveRole = resolveEffectiveStaffRole(user?.role, user?.designation);
    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        user?.restaurant_id ||
        localStorage.getItem("restaurantId") ||
        1
    );
    const restaurantName = String(user?.restaurant?.name || "Tiffzy Restaurant").trim();

    // Editable profile state
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user?.name || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileError, setProfileError] = useState("");

    // Password change state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");

    useEffect(() => {
        if (user?.name) setName(user.name);
        if (user?.phone) setPhone(user.phone);
    }, [user]);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setProfileError("");

        const trimmedName = String(name || "").trim();
        if (!trimmedName) {
            setProfileError("Full name is required");
            return;
        }

        try {
            setSavingProfile(true);
            const res = await axios.put(
                `${API}/api/staff/profile/me`,
                { name: trimmedName, phone: phone.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data?.success) {
                showToast({
                    title: "Profile Updated",
                    message: "Your profile details were updated successfully.",
                    variant: "success",
                });
                setIsEditing(false);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to update profile";
            setProfileError(msg);
            showToast({
                title: "Update Failed",
                message: msg,
                variant: "error",
            });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError("");
        setPasswordSuccess("");

        if (!currentPassword) {
            setPasswordError("Current password is required");
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters long");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords do not match");
            return;
        }

        try {
            setChangingPassword(true);
            const res = await axios.post(
                `${API}/api/auth/change-password`,
                { currentPassword, newPassword },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data?.success) {
                setPasswordSuccess("Password updated successfully!");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                showToast({
                    title: "Password Changed",
                    message: "Your password has been successfully updated.",
                    variant: "success",
                });
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to change password";
            setPasswordError(msg);
            showToast({
                title: "Error",
                message: msg,
                variant: "error",
            });
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans w-full">
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 space-y-5">
                {/* Header with back button */}
                <div className="flex items-center justify-between gap-3 border-b border-neutral-800/80 pb-3.5">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800/80 text-neutral-300 hover:text-white hover:bg-neutral-800 transition min-h-[40px]"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-xs sm:text-sm font-semibold">{backLabel}</span>
                        </button>
                        <h1 className="text-base sm:text-xl font-bold tracking-tight text-white">{title}</h1>
                    </div>
                </div>

                {/* Profile Overview Section */}
                <div className="rounded-2xl border border-neutral-800/70 bg-neutral-900/40 p-4 sm:p-5 md:p-6 space-y-4">
                    {/* Profile Header Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800/60 pb-4">
                        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold text-lg sm:text-xl shrink-0">
                                {user?.name ? user.name.slice(0, 2).toUpperCase() : "ST"}
                            </div>
                            <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-bold text-white truncate">
                                        {user?.name || "Staff Member"}
                                    </h2>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                        Active
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-400 flex items-center gap-1.5 truncate">
                                    <span className="text-orange-400 font-semibold">{user?.designation || effectiveRole}</span>
                                    <span>•</span>
                                    <span>{restaurantName}</span>
                                </p>
                            </div>
                        </div>

                        <div className="shrink-0 self-end sm:self-auto">
                            {!isEditing ? (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs sm:text-sm font-semibold border border-neutral-700/60 transition min-h-[38px]"
                                >
                                    Edit Profile
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setName(user?.name || "");
                                        setPhone(user?.phone || "");
                                    }}
                                    className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 text-xs sm:text-sm font-medium transition min-h-[38px]"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Profile Information List / Edit Form */}
                    {!isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-1">
                            <div className="bg-neutral-950/40 p-3 sm:p-3.5 rounded-xl border border-neutral-800/40">
                                <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mb-1 font-medium">
                                    <Mail className="w-3.5 h-3.5 text-neutral-500" /> Email
                                </div>
                                <div className="font-semibold text-white text-xs sm:text-sm truncate">{user?.email || "Not specified"}</div>
                            </div>
                            <div className="bg-neutral-950/40 p-3 sm:p-3.5 rounded-xl border border-neutral-800/40">
                                <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mb-1 font-medium">
                                    <Phone className="w-3.5 h-3.5 text-neutral-500" /> Phone
                                </div>
                                <div className="font-semibold text-white text-xs sm:text-sm truncate">{user?.phone || "Not specified"}</div>
                            </div>
                            <div className="bg-neutral-950/40 p-3 sm:p-3.5 rounded-xl border border-neutral-800/40">
                                <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mb-1 font-medium">
                                    <Shield className="w-3.5 h-3.5 text-neutral-500" /> Designation
                                </div>
                                <div className="font-semibold text-white text-xs sm:text-sm truncate">{user?.designation || effectiveRole}</div>
                            </div>
                            <div className="bg-neutral-950/40 p-3 sm:p-3.5 rounded-xl border border-neutral-800/40">
                                <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mb-1 font-medium">
                                    <Sparkles className="w-3.5 h-3.5 text-neutral-500" /> Staff ID
                                </div>
                                <div className="font-semibold text-white text-xs sm:text-sm">#{user?.id || "N/A"}</div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-1">
                            {profileError && (
                                <div className="p-3 bg-red-950/60 border border-red-800/60 text-red-200 text-xs rounded-xl">
                                    {profileError}
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label htmlFor="staff-profile-name" className="text-xs font-semibold text-neutral-300">Full Name</label>
                                    <input
                                        id="staff-profile-name"
                                        name="name"
                                        autoComplete="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 transition min-h-[40px]"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="staff-profile-phone" className="text-xs font-semibold text-neutral-300">Phone Number</label>
                                    <input
                                        id="staff-profile-phone"
                                        name="phone"
                                        autoComplete="tel"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 transition min-h-[40px]"
                                        placeholder="+91..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-1">
                                <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs sm:text-sm transition min-h-[40px] flex items-center gap-2 disabled:opacity-50 shadow-sm"
                                >
                                    {savingProfile ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Save Details
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Notification Sound & Vibration Settings */}
                <div className="space-y-2.5">
                    <div className="px-1">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-orange-400" />
                            Sound & Vibration Preferences
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                            Customize alert tones and vibration patterns for incoming tasks, orders, and table service requests.
                        </p>
                    </div>
                    <NotificationSoundPicker defaultExpanded={false} />
                </div>

                {/* Change Password Section */}
                <div className="rounded-2xl border border-neutral-800/70 bg-neutral-900/40 p-4 sm:p-5 md:p-6 space-y-3.5">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-orange-400" />
                            Security & Password Change
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                            Update your login password to keep your staff account secure.
                        </p>
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-3.5 pt-1">
                        {passwordError && (
                            <div className="p-3 bg-red-950/60 border border-red-800/60 text-red-200 text-xs rounded-xl">
                                {passwordError}
                            </div>
                        )}
                        {passwordSuccess && (
                            <div className="p-3 bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs rounded-xl">
                                {passwordSuccess}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            <div className="space-y-1">
                                <label htmlFor="staff-profile-current-password" className="text-xs font-semibold text-neutral-300">Current Password</label>
                                <div className="relative">
                                    <input
                                        id="staff-profile-current-password"
                                        name="currentPassword"
                                        autoComplete="current-password"
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 pr-9 min-h-[40px] transition"
                                        required
                                    />
                                    <button
                                        type="button"
                                        aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                                        title={showCurrentPassword ? "Hide password" : "Show password"}
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                                    >
                                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="staff-profile-new-password" className="text-xs font-semibold text-neutral-300">New Password</label>
                                <div className="relative">
                                    <input
                                        id="staff-profile-new-password"
                                        name="newPassword"
                                        autoComplete="new-password"
                                        type={showNewPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 pr-9 min-h-[40px] transition"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                                        title={showNewPassword ? "Hide password" : "Show password"}
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                                    >
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="staff-profile-confirm-password" className="text-xs font-semibold text-neutral-300">Confirm New Password</label>
                                <input
                                    id="staff-profile-confirm-password"
                                    name="confirmPassword"
                                    autoComplete="new-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 min-h-[40px] transition"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={changingPassword}
                                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs sm:text-sm transition min-h-[40px] flex items-center gap-2 disabled:opacity-50 shadow-sm"
                            >
                                {changingPassword ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                Update Password
                            </button>
                        </div>
                    </form>
                </div>

                {/* Logout Footer Section */}
                <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white">Log Out of Station</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">End your current shift and log out on this device.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (window.confirm("Are you sure you want to log out?")) {
                                logout();
                                navigate("/login?mode=staff");
                            }
                        }}
                        className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-rose-300 hover:text-white border border-rose-800/50 text-xs sm:text-sm font-semibold transition min-h-[38px] flex items-center justify-center gap-2 shrink-0"
                    >
                        <LogOut className="w-4 h-4" />
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );
}
