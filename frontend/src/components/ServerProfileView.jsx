import { useState, useEffect } from "react";
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
    MapPin,
    Phone,
    Shield,
    Sparkles,
    UserCheck,
    UserRound,
    UtensilsCrossed,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { API } from "../config";
import { showToast } from "../utils/toast";

export default function ServerProfileView({ onBackToFloorPlan }) {
    const { user, logout, token } = useAuth();

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

    // Sync initial state when user context updates
    useEffect(() => {
        if (user) {
            setName(user.name || "");
            setPhone(user.phone || "");
        }
    }, [user]);

    // Generate Initials Avatar
    const getInitials = (fullName) => {
        const parts = String(fullName || "Server User").trim().split(/\s+/);
        if (parts.length === 0) return "SU";
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    };

    // Save Profile Details
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setProfileError("");

        const trimmedName = String(name).trim();
        if (!trimmedName) {
            setProfileError("Full name cannot be empty.");
            return;
        }

        setSavingProfile(true);
        try {
            const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.put(
                `${API}/api/staff/profile/me`,
                { name: trimmedName, phone: String(phone).trim() },
                { headers: authHeader, withCredentials: true }
            );

            if (res.data?.success || res.data?.user) {
                showToast({
                    title: "Profile Updated 🎉",
                    message: "Your profile details have been saved.",
                    variant: "success",
                });
                setIsEditing(false);
                if (res.data?.user) {
                    const existingUser = JSON.parse(localStorage.getItem("user") || "{}");
                    const nextUser = { ...existingUser, ...res.data.user };
                    localStorage.setItem("user", JSON.stringify(nextUser));
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Failed to update profile.";
            setProfileError(msg);
            showToast({ title: "Update Failed", message: msg, variant: "error" });
        } finally {
            setSavingProfile(false);
        }
    };

    // Handle Password Change
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError("");
        setPasswordSuccess("");

        if (!currentPassword || !newPassword) {
            setPasswordError("Please enter current password and new password.");
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("New password and confirm password do not match.");
            return;
        }

        setChangingPassword(true);
        try {
            const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(
                `${API}/api/auth/change-password`,
                { currentPassword, newPassword },
                { headers: authHeader, withCredentials: true }
            );

            setPasswordSuccess("Password changed successfully!");
            showToast({
                title: "Security Updated 🔒",
                message: "Your password has been changed successfully.",
                variant: "success",
            });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Failed to change password.";
            setPasswordError(msg);
            showToast({ title: "Password Change Failed", message: msg, variant: "error" });
        } finally {
            setChangingPassword(false);
        }
    };

    const roleBadge = String(user?.role || "WAITER").toUpperCase();
    const designationLabel = user?.designation || (roleBadge === "WAITER" ? "Server" : roleBadge);

    return (
        <div className="flex-1 p-3 sm:p-4 max-w-4xl mx-auto w-full space-y-4 animate-in fade-in duration-200">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)]/40 pb-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBackToFloorPlan}
                        className="flex items-center gap-1.5 rounded-xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold theme-muted hover:text-[color:var(--app-text)] transition cursor-pointer"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Floor Plan</span>
                    </button>
                    <div>
                        <h1 className="text-base sm:text-lg font-black tracking-tight text-[color:var(--app-text)] flex items-center gap-2">
                            Server Profile
                            <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold">
                                ACTIVE STAFF
                            </span>
                        </h1>
                        <p className="text-[11px] theme-muted">Manage your personal information and security settings</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={logout}
                    className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden min-[480px]:inline">Sign Out</span>
                </button>
            </div>

            {/* Profile Overview Card */}
            <div className="rounded-2xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    {/* Initials Avatar */}
                    <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white font-black text-xl sm:text-2xl shadow-md border-2 border-white dark:border-slate-800">
                        {getInitials(name || user?.name)}
                    </div>

                    {/* Summary Info */}
                    <div className="flex-1 text-center sm:text-left space-y-1">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <h2 className="text-lg sm:text-xl font-black text-[color:var(--app-text)]">
                                {user?.name || "Server Staff"}
                            </h2>
                            <span className="rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 px-2.5 py-0.5 text-[10px] font-bold">
                                {designationLabel}
                            </span>
                        </div>

                        <p className="text-xs theme-muted flex items-center justify-center sm:justify-start gap-1">
                            <MapPin className="h-3.5 w-3.5 text-orange-500" />
                            <span>{restaurantName}</span>
                            <span className="opacity-60">• ID #{user?.id || "N/A"}</span>
                        </p>

                        <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs">
                            <span className="inline-flex items-center gap-1 theme-muted">
                                <Mail className="h-3.5 w-3.5 opacity-70" />
                                <span>{user?.email || "No email linked"}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 theme-muted">
                                <Phone className="h-3.5 w-3.5 opacity-70" />
                                <span>{user?.phone || "No phone linked"}</span>
                            </span>
                        </div>
                    </div>

                    {/* Edit Profile Toggle Button */}
                    {!isEditing && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>

                {/* Edit Profile Form */}
                {isEditing && (
                    <form onSubmit={handleSaveProfile} className="mt-4 pt-4 border-t border-[color:var(--app-border)]/40 space-y-3">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-orange-500">Edit Personal Details</h3>

                        {profileError && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400 font-semibold">
                                {profileError}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="block text-[11px] font-bold theme-muted mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your full name"
                                    required
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-3 py-2 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold theme-muted mb-1">Mobile Phone Number</label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Enter your phone number"
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-3 py-2 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                                />
                            </div>
                        </div>

                        {/* Protected Fields Notice */}
                        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-2.5 text-[11px] theme-muted flex items-start gap-2">
                            <Shield className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>Staff role (<strong>{roleBadge}</strong>) and assigned restaurant are managed by your administrator and cannot be self-edited.</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setName(user?.name || "");
                                    setPhone(user?.phone || "");
                                    setProfileError("");
                                }}
                                disabled={savingProfile}
                                className="rounded-xl border border-[color:var(--app-border)]/40 px-3.5 py-1.5 text-xs font-bold theme-muted hover:text-[color:var(--app-text)] transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={savingProfile}
                                className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                                {savingProfile ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                <span>Save Changes</span>
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Security & Password Section */}
            <div className="rounded-2xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-[color:var(--app-border)]/40 pb-2.5">
                    <KeyRound className="h-4 w-4 text-orange-500" />
                    <h3 className="text-sm font-extrabold text-[color:var(--app-text)]">Security & Password</h3>
                </div>

                {passwordError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400 font-semibold">
                        {passwordError}
                    </div>
                )}

                {passwordSuccess && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        {passwordSuccess}
                    </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                    <div>
                        <label className="block text-[11px] font-bold theme-muted mb-1">Current Password</label>
                        <div className="relative">
                            <input
                                type={showCurrentPassword ? "text" : "password"}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                                required
                                className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent pl-3 pr-10 py-2 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword((prev) => !prev)}
                                className="absolute right-3 top-2.5 theme-muted hover:text-[color:var(--app-text)]"
                            >
                                {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold theme-muted mb-1">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                    required
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent pl-3 pr-10 py-2 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword((prev) => !prev)}
                                    className="absolute right-3 top-2.5 theme-muted hover:text-[color:var(--app-text)]"
                                >
                                    {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold theme-muted mb-1">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter new password"
                                required
                                className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent px-3 py-2 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-1">
                        <button
                            type="submit"
                            disabled={changingPassword}
                            className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                            {changingPassword ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                            <span>Change Password</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
