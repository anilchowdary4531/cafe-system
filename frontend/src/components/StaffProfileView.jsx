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
        <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 md:p-8 font-sans">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header with back button */}
                <div className="flex items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 transition min-h-[44px]"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-semibold">{backLabel}</span>
                    </button>
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">{title}</h1>
                </div>

                {/* Profile Card */}
                <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-orange-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center font-bold text-2xl shadow-inner">
                                {user?.name ? user.name.slice(0, 2).toUpperCase() : "ST"}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    {user?.name || "Staff Member"}
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        Active
                                    </span>
                                </h2>
                                <p className="text-sm text-neutral-400 flex items-center gap-2 mt-0.5">
                                    <span className="text-orange-400 font-semibold">{user?.designation || effectiveRole}</span>
                                    <span>•</span>
                                    <span>{restaurantName}</span>
                                </p>
                            </div>
                        </div>

                        {!isEditing ? (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium border border-neutral-700 transition min-h-[44px]"
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
                                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium transition min-h-[44px]"
                            >
                                Cancel
                            </button>
                        )}
                    </div>

                    {/* Details or Edit Form */}
                    {!isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/60">
                                <div className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1">
                                    <Mail className="w-3.5 h-3.5" /> Email
                                </div>
                                <div className="font-semibold text-white">{user?.email || "Not specified"}</div>
                            </div>
                            <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/60">
                                <div className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1">
                                    <Phone className="w-3.5 h-3.5" /> Phone
                                </div>
                                <div className="font-semibold text-white">{user?.phone || "Not specified"}</div>
                            </div>
                            <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/60">
                                <div className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1">
                                    <Shield className="w-3.5 h-3.5" /> Designation
                                </div>
                                <div className="font-semibold text-white">{user?.designation || effectiveRole}</div>
                            </div>
                            <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/60">
                                <div className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1">
                                    <Sparkles className="w-3.5 h-3.5" /> Staff ID
                                </div>
                                <div className="font-semibold text-white">#{user?.id || "N/A"}</div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            {profileError && (
                                <div className="p-3 bg-red-950/60 border border-red-800/60 text-red-200 text-xs rounded-xl">
                                    {profileError}
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-neutral-300">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-neutral-300">Phone Number</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500"
                                    placeholder="+91..."
                                />
                            </div>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition min-h-[44px] flex items-center gap-2 disabled:opacity-50"
                                >
                                    {savingProfile ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Save Details
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Notification Sound & Vibration Settings */}
                <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-orange-400" />
                        Sound & Vibration Preferences
                    </h3>
                    <p className="text-xs text-neutral-400">
                        Customize alert tones and vibration patterns for incoming tasks, orders, and table service requests.
                    </p>
                    <NotificationSoundPicker defaultExpanded={true} />
                </div>

                {/* Change Password Card */}
                <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-orange-400" />
                        Security & Password Change
                    </h3>
                    <form onSubmit={handleChangePassword} className="space-y-4">
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
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-neutral-300">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                                >
                                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-neutral-300">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 pr-10"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                                    >
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-neutral-300">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={changingPassword}
                                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition min-h-[44px] flex items-center gap-2 disabled:opacity-50"
                            >
                                {changingPassword ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                Update Password
                            </button>
                        </div>
                    </form>
                </div>

                {/* Logout Card */}
                <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl flex items-center justify-between gap-4">
                    <div>
                        <h4 className="text-sm font-bold text-white">Log Out of Station</h4>
                        <p className="text-xs text-neutral-400">End your current shift and log out on this device.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (window.confirm("Are you sure you want to log out?")) {
                                logout();
                                navigate("/login?mode=staff");
                            }
                        }}
                        className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 text-sm font-semibold transition min-h-[44px] flex items-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );
}
