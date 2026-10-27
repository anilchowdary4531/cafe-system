import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
    Volume2,
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
    const location = useLocation();
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
                title: "Error",
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
        if (!newPassword || newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("New password and confirm password do not match");
            return;
        }

        try {
            setChangingPassword(true);
            const res = await axios.post(
                `${API}/api/staff/change-password`,
                { currentPassword, newPassword },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data?.success) {
                setPasswordSuccess("Password updated successfully!");
                showToast({
                    title: "Password Changed",
                    message: "Your password was updated successfully.",
                    variant: "success",
                });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
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

    const isSettingsRoute = location.pathname.includes("/settings");
    const displayTitle = isSettingsRoute ? "Staff Settings" : title;

    return (
        <div className="min-h-screen bg-white text-[#171717] font-sans flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E7E5E4] px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs">
                <div className="w-full flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#57534E] hover:text-[#171717] border border-[#E7E5E4] transition min-h-[38px] shadow-xs cursor-pointer text-xs font-semibold"
                        >
                            <ArrowLeft className="w-4 h-4 text-[#F97316]" />
                            <span className="hidden sm:inline">{backLabel}</span>
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg font-bold text-[#171717] tracking-tight truncate flex items-center gap-2">
                                <span>{displayTitle}</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30 uppercase">
                                    {user?.designation || effectiveRole}
                                </span>
                            </h1>
                            <div className="text-xs text-[#78716C] truncate hidden sm:block">
                                {restaurantName}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm("Are you sure you want to log out?")) {
                                    logout();
                                    navigate("/login?mode=staff");
                                }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#DC2626]/20 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[38px]"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Log Out</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content - Full Width */}
            <main className="flex-1 w-full px-3 sm:px-4 md:px-6 py-4 space-y-4 max-w-none">
                {/* Profile Card & Info Grid */}
                <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E7E5E4]">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#F97316] text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                                {user?.name ? user.name.slice(0, 2).toUpperCase() : "ST"}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg sm:text-xl font-bold text-[#171717] flex items-center gap-2 flex-wrap">
                                    <span>{user?.name || "Staff Member"}</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#059669]/20">
                                        Active
                                    </span>
                                </h2>
                                <p className="text-xs text-[#57534E] flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[#EA580C] font-bold">{user?.designation || effectiveRole}</span>
                                    <span>·</span>
                                    <span>{restaurantName}</span>
                                </p>
                            </div>
                        </div>

                        <div>
                            {!isEditing ? (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#171717] text-xs font-bold border border-[#E7E5E4] transition min-h-[36px] shadow-xs cursor-pointer"
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
                                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#F5F5F4] text-[#57534E] text-xs font-bold border border-[#E7E5E4] transition min-h-[36px] shadow-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Details or Edit Form */}
                    {!isEditing ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 text-sm">
                            <div className="bg-[#FFF7ED]/30 p-3 rounded-xl border border-[#E7E5E4]">
                                <div className="text-[11px] font-semibold text-[#78716C] flex items-center gap-1.5 mb-1">
                                    <Mail className="w-3.5 h-3.5 text-[#F97316]" /> Email
                                </div>
                                <div className="font-bold text-[#171717] text-xs sm:text-sm truncate">{user?.email || "Not specified"}</div>
                            </div>
                            <div className="bg-[#FFF7ED]/30 p-3 rounded-xl border border-[#E7E5E4]">
                                <div className="text-[11px] font-semibold text-[#78716C] flex items-center gap-1.5 mb-1">
                                    <Phone className="w-3.5 h-3.5 text-[#F97316]" /> Phone
                                </div>
                                <div className="font-bold text-[#171717] text-xs sm:text-sm truncate">{user?.phone || "Not specified"}</div>
                            </div>
                            <div className="bg-[#FFF7ED]/30 p-3 rounded-xl border border-[#E7E5E4]">
                                <div className="text-[11px] font-semibold text-[#78716C] flex items-center gap-1.5 mb-1">
                                    <Shield className="w-3.5 h-3.5 text-[#F97316]" /> Designation
                                </div>
                                <div className="font-bold text-[#171717] text-xs sm:text-sm truncate">{user?.designation || effectiveRole}</div>
                            </div>
                            <div className="bg-[#FFF7ED]/30 p-3 rounded-xl border border-[#E7E5E4]">
                                <div className="text-[11px] font-semibold text-[#78716C] flex items-center gap-1.5 mb-1">
                                    <Sparkles className="w-3.5 h-3.5 text-[#F97316]" /> Staff ID
                                </div>
                                <div className="font-bold text-[#171717] text-xs sm:text-sm truncate">#{user?.id || "N/A"}</div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
                            {profileError && (
                                <div className="p-2.5 bg-[#FEF2F2] border border-[#DC2626]/30 text-[#DC2626] text-xs rounded-xl font-medium">
                                    {profileError}
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#57534E]">Full Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] text-xs sm:text-sm focus:outline-none focus:border-[#F97316]"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#57534E]">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] text-xs sm:text-sm focus:outline-none focus:border-[#F97316]"
                                        placeholder="+91..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-1">
                                <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 min-h-[38px]"
                                >
                                    {savingProfile ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    <span>Save Details</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Sound & Vibration Preferences */}
                <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
                    <div>
                        <h3 className="text-sm sm:text-base font-bold text-[#171717] flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-[#F97316]" />
                            <span>Sound & Vibration Preferences</span>
                        </h3>
                        <p className="text-xs text-[#57534E] mt-0.5">
                            Customize operational alert tones and vibration patterns for incoming tasks, orders, and table service requests.
                        </p>
                    </div>
                    <NotificationSoundPicker defaultExpanded={false} />
                </div>

                {/* Change Password Card */}
                <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
                    <h3 className="text-sm sm:text-base font-bold text-[#171717] flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-[#F97316]" />
                        <span>Security & Password Change</span>
                    </h3>
                    <form onSubmit={handleChangePassword} className="space-y-3">
                        {passwordError && (
                            <div className="p-2.5 bg-[#FEF2F2] border border-[#DC2626]/30 text-[#DC2626] text-xs rounded-xl font-medium">
                                {passwordError}
                            </div>
                        )}
                        {passwordSuccess && (
                            <div className="p-2.5 bg-[#ECFDF5] border border-[#059669]/30 text-[#059669] text-xs rounded-xl font-medium">
                                {passwordSuccess}
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[#57534E]">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] text-xs sm:text-sm focus:outline-none focus:border-[#F97316] pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#171717]"
                                >
                                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#57534E]">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] text-xs sm:text-sm focus:outline-none focus:border-[#F97316] pr-10"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#171717]"
                                    >
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#57534E]">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-[#171717] text-xs sm:text-sm focus:outline-none focus:border-[#F97316]"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={changingPassword}
                                className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs transition min-h-[38px] flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                            >
                                {changingPassword ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                <span>Update Password</span>
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
