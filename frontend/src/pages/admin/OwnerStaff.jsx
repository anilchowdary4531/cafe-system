import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { resolveAuthoritativeRestaurantId, resolveRestaurantName } from "../../utils/restaurantContext";
import {
    MoreVertical,
    Pencil,
    KeyRound,
    LoaderCircle,
    Search,
    ShieldCheck,
    Trash2,
    UserPlus,
    UserRoundCheck,
    UserRoundX,
    Eye,
    EyeOff,
    Copy,
    Check,
    AlertTriangle,
    X,
    RefreshCw,
    Building2,
    Shield,
    Users,
    Link2,
} from "lucide-react";
import { API } from "../../config";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import StaffSubNav from "../../components/StaffSubNav";

const DESIGNATION_OPTIONS = [
    "Chef",
    "Senior Chef",
    "Server",
    "Swiper",
    "Manager",
    "Cashier",
    "Steward",
    "Cleaner",
];

const ROLE_OPTIONS = [
    { value: "ALL", label: "All Roles" },
    { value: "MANAGER", label: "Manager" },
    { value: "WAITER", label: "Server / Waiter" },
    { value: "CHEF", label: "Chef" },
    { value: "CASHIER", label: "Cashier" },
    { value: "STAFF", label: "General Staff" },
    { value: "OWNER", label: "Owner" },
];

const STATUS_OPTIONS = [
    { value: "ALL", label: "All Statuses" },
    { value: "ACTIVE", label: "Active Only" },
    { value: "DISABLED", label: "Disabled Only" },
];

const DEFAULT_DESIGNATION_BY_ROLE = {
    MANAGER: "Manager",
    WAITER: "Server",
    CHEF: "Chef",
    CASHIER: "Cashier",
    STAFF: "Staff",
    OWNER: "Owner",
};

const ACCESS_LABELS = {
    dashboard: "Dashboard",
    billing: "Billing Desk",
    orders: "Live Orders",
    menu: "Menu Studio",
    inventory: "Inventory & BOM",
    tables: "Tables & QR",
    kitchen: "Kitchen Operations",
    printers: "Printers",
    analytics: "Analytics",
    reports: "Reports & Insights",
    paylater: "Pay Later",
    shifts: "Shift & Day Close",
    supply: "Supply Marketplace",
    delivery: "Delivery Studio",
    delivery_partners: "Delivery Partners",
    customers: "Customers",
    discounts: "Discounts & Offers",
    loyalty: "Loyalty & Rewards",
    staff: "Staff",
    settings: "Settings",
    notifications: "Notifications",
};

const defaultAccessByRole = (role) => {
    const normalizedRole = String(role || "STAFF").toUpperCase();
    if (normalizedRole === "OWNER") {
        return Object.keys(ACCESS_LABELS).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    }
    if (normalizedRole === "MANAGER") {
        return {
            dashboard: true, billing: true, orders: true, menu: true, inventory: true, tables: true,
            kitchen: true, printers: true, analytics: true, reports: true, paylater: true, shifts: true,
            supply: true, delivery: true, delivery_partners: true, customers: true, discounts: true,
            loyalty: true, staff: false, settings: false, notifications: true
        };
    }
    if (normalizedRole === "CHEF") {
        return {
            dashboard: true, billing: false, orders: true, menu: false, inventory: true, tables: false,
            kitchen: true, printers: true, analytics: false, reports: false, paylater: false, shifts: false,
            supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
            loyalty: false, staff: false, settings: false, notifications: true
        };
    }
    if (normalizedRole === "WAITER") {
        return {
            dashboard: true, billing: true, orders: true, menu: true, inventory: false, tables: true,
            kitchen: false, printers: false, analytics: false, reports: false, paylater: false, shifts: false,
            supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
            loyalty: false, staff: false, settings: false, notifications: true
        };
    }
    if (normalizedRole === "CASHIER") {
        return {
            dashboard: true, billing: true, orders: true, menu: false, inventory: false, tables: false,
            kitchen: false, printers: true, analytics: true, reports: true, paylater: true, shifts: true,
            supply: false, delivery: false, delivery_partners: false, customers: true, discounts: true,
            loyalty: true, staff: false, settings: false, notifications: true
        };
    }
    return {
        dashboard: true, billing: false, orders: false, menu: false, inventory: false, tables: false,
        kitchen: false, printers: false, analytics: false, reports: false, paylater: false, shifts: false,
        supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
        loyalty: false, staff: false, settings: false, notifications: true
    };
};

const getRoleDesignationFallback = (role) =>
    DEFAULT_DESIGNATION_BY_ROLE[String(role || "STAFF").toUpperCase()] || "Staff";

const resolveDesignation = (staffUser) => {
    const customDesignation = String(staffUser?.designation || "").trim();
    if (customDesignation) return customDesignation;
    return getRoleDesignationFallback(staffUser?.role);
};

const buildFallbackStaffLoginLink = (staffUser) => {
    const email = String(staffUser?.email || "").trim().toLowerCase();
    const params = new URLSearchParams({ mode: "staff" });
    if (email) params.set("email", email);

    const base = typeof window !== "undefined" ? window.location.origin : "";
    const path = `/login?${params.toString()}`;
    return base ? `${base}${path}` : path;
};

const getStaffLoginLink = (staffUser) => {
    const link = String(staffUser?.loginLink || "").trim();
    if (link) return link;
    return buildFallbackStaffLoginLink(staffUser);
};

const buildStaffLoginShareText = (staffUser, restaurantName, loginLink) => {
    const name = String(staffUser?.name || "there").trim() || "there";
    const restaurant = String(restaurantName || "your restaurant").trim() || "your restaurant";
    return `Hi ${name}, use this staff login link for ${restaurant}: ${loginLink}\n\nNote: Please enter your staff password or the temporary password provided by management to log in.`;
};

const generateSecureTempPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let res = "";
    for (let i = 0; i < 8; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Staff#${res}`;
};

export default function OwnerStaff() {
    const [users, setUsers] = useState([]);
    const [modules, setModules] = useState(Object.keys(ACCESS_LABELS));
    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [savingAccessFor, setSavingAccessFor] = useState(null);
    const [updatingStatusFor, setUpdatingStatusFor] = useState(null);
    const [deletingFor, setDeletingFor] = useState(null);
    const [error, setError] = useState("");
    const [selectedAccessUserId, setSelectedAccessUserId] = useState(null);
    const [accessDraft, setAccessDraft] = useState({});
    const [showAddStaffForm, setShowAddStaffForm] = useState(false);
    const [openActionMenuFor, setOpenActionMenuFor] = useState(null);
    const [editingStaffId, setEditingStaffId] = useState(null);
    const [savingEditFor, setSavingEditFor] = useState(null);
    const [generatingTempPasswordFor, setGeneratingTempPasswordFor] = useState(null);

    // Password visibility toggles
    const [showAddPassword, setShowAddPassword] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);
    // One-time temporary password reveal modal & memory-only card display
    const [temporaryPasswordModal, setTemporaryPasswordModal] = useState(null);
    const [copiedPassword, setCopiedPassword] = useState(false);
    const [temporaryPasswords, setTemporaryPasswords] = useState({});
    const [copiedPasswordId, setCopiedPasswordId] = useState(null);
    const [showCardPassword, setShowCardPassword] = useState({});
    const [loginLinks, setLoginLinks] = useState({});
    const [generatingLoginLinkFor, setGeneratingLoginLinkFor] = useState(null);
    const [copiedLoginLinkId, setCopiedLoginLinkId] = useState(null);

    // Confirmation modals
    const [confirmDeactivateUser, setConfirmDeactivateUser] = useState(null);
    const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

    const [editDraft, setEditDraft] = useState({
        name: "",
        email: "",
        phone: "",
        role: "STAFF",
        designationOption: "Staff",
        customDesignation: "",
        password: "",
        isActive: true,
        access: {},
    });

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "STAFF",
        designationOption: getRoleDesignationFallback("STAFF"),
        customDesignation: "",
        isActive: true,
        access: defaultAccessByRole("STAFF"),
    });

    const { user: authUser } = useAuth();
    let outletContext = null;
    try {
        outletContext = useOutletContext();
    } catch {
        outletContext = null;
    }

    const user = useMemo(() => {
        if (authUser && typeof authUser === "object" && Object.keys(authUser).length > 0) {
            return authUser;
        }
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, [authUser]);

    const restaurantId = useMemo(() => {
        return resolveAuthoritativeRestaurantId(user, outletContext?.restaurantId);
    }, [user, outletContext?.restaurantId]);

    const restaurantName = useMemo(() => {
        return resolveRestaurantName(user, "your restaurant");
    }, [user]);

    const loadStaff = async ({ silent = false } = {}) => {
        const effectiveRid = Number(restaurantId || resolveAuthoritativeRestaurantId(user, outletContext?.restaurantId) || 0);
        if (!effectiveRid || effectiveRid <= 0 || isNaN(effectiveRid)) {
            setLoading(false);
            setError("Restaurant not linked to owner account.");
            return;
        }

        try {
            setLoading((prev) => (silent ? prev : true));

            const params = {};
            if (query) params.q = query;
            if (roleFilter !== "ALL") params.role = roleFilter;
            if (statusFilter !== "ALL") params.status = statusFilter.toLowerCase();

            const res = await axios.get(`${API}/owner/${effectiveRid}/staff`, { params });
            setUsers(Array.isArray(res.data?.users) ? res.data.users : []);
            setModules(Array.isArray(res.data?.modules) ? res.data.modules : Object.keys(ACCESS_LABELS));
            setError("");
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to load staff users.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStaff();
    }, [restaurantId, roleFilter, statusFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadStaff({ silent: true });
        }, 350);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (!openActionMenuFor) return undefined;
        const handleOutsideClick = (event) => {
            if (event.target.closest("[data-staff-actions-menu]")) return;
            setOpenActionMenuFor(null);
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [openActionMenuFor]);

    const handleCreate = async (e) => {
        e.preventDefault();
        const trimmedName = String(form.name || "").trim();
        const trimmedEmail = String(form.email || "").trim().toLowerCase();
        const trimmedPhone = String(form.phone || "").trim();

        if (!trimmedName || !trimmedEmail || !trimmedPhone) {
            setError("Name, email, and phone number are required.");
            return;
        }

        const designation =
            form.designationOption === "OTHER"
                ? String(form.customDesignation || "").trim()
                : String(form.designationOption || "").trim();

        if (!designation) {
            setError("Designation is required.");
            return;
        }

        try {
            setCreating(true);
            setError("");

            const res = await axios.post(`${API}/owner/${restaurantId}/staff`, {
                ...form,
                name: trimmedName,
                email: trimmedEmail,
                phone: trimmedPhone,
                role: String(form.role).toUpperCase(),
                designation,
                password: form.password || undefined,
            });

            const createdUser = res.data?.user;
            const tempPassword = res.data?.temporaryPassword || form.password;

            setForm({
                name: "",
                email: "",
                phone: "",
                password: "",
                role: "STAFF",
                designationOption: getRoleDesignationFallback("STAFF"),
                customDesignation: "",
                isActive: true,
                access: defaultAccessByRole("STAFF"),
            });
            setShowAddStaffForm(false);
            setShowAddPassword(false);

            if (tempPassword) {
                if (createdUser?.id) {
                    setTemporaryPasswords((prev) => ({
                        ...prev,
                        [createdUser.id]: tempPassword,
                    }));
                }
                setTemporaryPasswordModal({
                    name: createdUser?.name || trimmedName,
                    email: createdUser?.email || trimmedEmail,
                    temporaryPassword: tempPassword,
                });
            } else {
                showToast({
                    title: "Staff Created",
                    message: `Successfully created staff profile for ${trimmedName}.`,
                    variant: "success",
                });
            }

            await loadStaff({ silent: true });
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to create staff user.");
        } finally {
            setCreating(false);
        }
    };

    const confirmToggleStatus = (staffUser) => {
        setOpenActionMenuFor(null);
        if (staffUser.isActive) {
            setConfirmDeactivateUser(staffUser);
        } else {
            executeToggleStatus(staffUser, true);
        }
    };

    const executeToggleStatus = async (staffUser, nextStatus) => {
        try {
            setUpdatingStatusFor(staffUser.id);
            await axios.patch(`${API}/owner/${restaurantId}/staff/${staffUser.id}/status`, {
                isActive: nextStatus,
            });
            showToast({
                title: nextStatus ? "Staff Activated" : "Staff Deactivated",
                message: `${staffUser.name} is now ${nextStatus ? "active" : "disabled"}. Active sessions have been revoked.`,
                variant: "success",
            });
            setConfirmDeactivateUser(null);
            await loadStaff({ silent: true });
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to update status.");
        } finally {
            setUpdatingStatusFor(null);
        }
    };

    const confirmDeleteStaff = (staffUser) => {
        setOpenActionMenuFor(null);
        setConfirmDeleteUser(staffUser);
    };

    const executeDeleteStaff = async () => {
        if (!confirmDeleteUser) return;
        const staffUser = confirmDeleteUser;
        try {
            setDeletingFor(staffUser.id);
            await axios.delete(`${API}/owner/${restaurantId}/staff/${staffUser.id}`);
            if (selectedAccessUserId === staffUser.id) {
                setSelectedAccessUserId(null);
                setAccessDraft({});
            }
            showToast({
                title: "Staff Deleted",
                message: `Successfully removed ${staffUser.name}.`,
                variant: "success",
            });
            setConfirmDeleteUser(null);
            await loadStaff({ silent: true });
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || "Failed to delete staff user.";
            setError(msg);
            showToast({
                title: "Delete Failed",
                message: msg,
                variant: "error",
            });
            setConfirmDeleteUser(null);
        } finally {
            setDeletingFor(null);
        }
    };

    const openAccessPanel = (staffUser) => {
        setOpenActionMenuFor(null);
        setSelectedAccessUserId(staffUser.id);
        setAccessDraft(staffUser.access || defaultAccessByRole(staffUser.role));
    };

    const startEditRow = (staffUser) => {
        setOpenActionMenuFor(null);
        setSelectedAccessUserId(null);
        setEditingStaffId(staffUser.id);
        setShowEditPassword(false);
        const currentDesig = resolveDesignation(staffUser);
        const isStandard = DESIGNATION_OPTIONS.includes(currentDesig);

        setEditDraft({
            name: String(staffUser?.name || ""),
            email: String(staffUser?.email || ""),
            phone: String(staffUser?.phone || ""),
            role: String(staffUser?.role || "STAFF"),
            designationOption: isStandard ? currentDesig : "OTHER",
            customDesignation: isStandard ? "" : currentDesig,
            password: "",
            isActive: Boolean(staffUser?.isActive),
            access: staffUser.access ? { ...staffUser.access } : defaultAccessByRole(staffUser.role),
        });
    };

    const cancelEditRow = () => {
        setEditingStaffId(null);
        setShowEditPassword(false);
        setEditDraft({
            name: "",
            email: "",
            phone: "",
            role: "STAFF",
            designationOption: "Staff",
            customDesignation: "",
            password: "",
            isActive: true,
            access: {},
        });
    };

    const saveEditedRow = async (staffUser) => {
        const name = String(editDraft.name || "").trim();
        const email = String(editDraft.email || "").trim().toLowerCase();
        const phone = String(editDraft.phone || "").trim();
        const designation =
            editDraft.designationOption === "OTHER"
                ? String(editDraft.customDesignation || "").trim()
                : String(editDraft.designationOption || "").trim();

        if (!name || !email) {
            setError("Name and email are required to update staff.");
            return;
        }

        try {
            setSavingEditFor(staffUser.id);
            setError("");

            const payload = {
                name,
                email,
                phone,
                designation,
                role: String(editDraft.role || "STAFF").toUpperCase(),
                isActive: Boolean(editDraft.isActive),
            };
            if (editDraft.password) {
                payload.password = editDraft.password;
            }

            await axios.put(`${API}/owner/${restaurantId}/staff/${staffUser.id}`, payload);

            if (editDraft.access && staffUser.role !== "OWNER") {
                await axios.put(`${API}/owner/${restaurantId}/staff/${staffUser.id}/access`, {
                    access: editDraft.access,
                });
            }

            showToast({
                title: "Staff user updated",
                message: `Successfully saved updates for ${name}.`,
                variant: "success",
            });

            cancelEditRow();
            await loadStaff({ silent: true });
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to update staff user.");
        } finally {
            setSavingEditFor(null);
        }
    };

    const saveAccess = async (staffUserId) => {
        try {
            setSavingAccessFor(staffUserId);
            await axios.put(`${API}/owner/${restaurantId}/staff/${staffUserId}/access`, {
                access: accessDraft,
            });
            showToast({
                title: "Permissions Saved",
                message: "Updated module access permissions successfully.",
                variant: "success",
            });
            setSelectedAccessUserId(null);
            await loadStaff({ silent: true });
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to save access.");
        } finally {
            setSavingAccessFor(null);
        }
    };

    const copyStaffLoginLink = async (staffUser) => {
        const loginLink = getStaffLoginLink(staffUser);
        try {
            await navigator.clipboard.writeText(loginLink);
            showToast({
                title: "Login link copied",
                message: `Safe pre-filled link for ${staffUser?.name || "staff"} copied to clipboard.`,
                variant: "success",
            });
        } catch {
            showToast({
                title: "Copy failed",
                message: "Clipboard access was denied by your browser.",
                variant: "error",
            });
        }
    };

    const copyTemporaryPassword = async (staffId, password) => {
        try {
            await navigator.clipboard.writeText(password);
            setCopiedPasswordId(staffId);
            setTimeout(() => setCopiedPasswordId(null), 2000);
            showToast({
                title: "Password Copied",
                message: "Temporary password copied to clipboard.",
                variant: "success",
            });
        } catch {
            showToast({
                title: "Copy failed",
                message: "Clipboard access was denied by your browser.",
                variant: "error",
            });
        }
    };

    const toggleShowCardPassword = (staffId) => {
        setShowCardPassword((prev) => ({
            ...prev,
            [staffId]: !prev[staffId],
        }));
    };

    const handleCopyCardPassword = async (staffUser) => {
        const pass = temporaryPasswords[staffUser?.id];
        if (pass) {
            await copyTemporaryPassword(staffUser.id, pass);
        } else {
            showToast({
                title: "Password Protected",
                message: "No temporary password in memory. Click Reset Password to generate one.",
                variant: "info",
            });
        }
    };

    const handleGenerateStaffLoginLink = async (staffUser) => {
        try {
            setGeneratingLoginLinkFor(staffUser.id);
            setError("");
            const res = await axios.post(`${API}/owner/${restaurantId}/staff/${staffUser.id}/login-link`);
            const { loginUrl, token, expiresAt } = res.data;
            const link = loginUrl || `${window.location.origin}/login?mode=staff&token=${token}`;
            setLoginLinks((prev) => ({
                ...prev,
                [staffUser.id]: {
                    loginUrl: link,
                    token,
                    expiresAt,
                },
            }));
            showToast({
                title: "Login Link Generated",
                message: `One-time login link for ${staffUser.name} expires in 10 minutes.`,
                variant: "success",
            });
        } catch (err) {
            console.log(err);
            const rawMsg = String(err?.response?.data?.message || err?.message || "");
            const isInternal =
                rawMsg.toLowerCase().includes("prisma") ||
                rawMsg.toLowerCase().includes("invocation") ||
                rawMsg.toLowerCase().includes("database") ||
                rawMsg.toLowerCase().includes("table");
            const msg = isInternal
                ? "Unable to generate secure login link at this moment. Please use the standard login URL or reset password."
                : (rawMsg || "Failed to generate login link.");
            setError(msg);
            showToast({
                title: "Generation Failed",
                message: msg,
                variant: "error",
            });
        } finally {
            setGeneratingLoginLinkFor(null);
        }
    };

    const copyGeneratedLoginLink = async (staffId, url) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedLoginLinkId(staffId);
            showToast({
                title: "Login link copied",
                message: "Single-use link copied to clipboard.",
                variant: "success",
            });
            setTimeout(() => setCopiedLoginLinkId(null), 2500);
        } catch {
            showToast({
                title: "Copy failed",
                message: "Your browser blocked clipboard access.",
                variant: "error",
            });
        }
    };

    const shareStaffLoginOnWhatsApp = (staffUser) => {
        const generatedLink = loginLinks[staffUser?.id]?.loginUrl;
        const tempPass = temporaryPasswords[staffUser?.id];
        let message;
        if (generatedLink) {
            message = `Hi ${staffUser?.name || "there"},\nHere is your secure passwordless login link for ${restaurantName}:\n${generatedLink}\n\n(Single-use, expires in 10 minutes)`;
        } else if (tempPass) {
            const loginLink = getStaffLoginLink(staffUser);
            message = `Hi ${staffUser?.name || "there"},\nHere is your staff login for ${restaurantName}:\n• Login URL: ${loginLink}\n• Temporary Password: ${tempPass}\n\nPlease enter this temporary password at login and update it immediately.`;
        } else {
            const loginLink = getStaffLoginLink(staffUser);
            message = buildStaffLoginShareText(staffUser, restaurantName, loginLink);
        }
        const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        const popup = window.open(shareUrl, "_blank", "noopener,noreferrer");

        if (!popup) {
            showToast({
                title: "WhatsApp blocked",
                message: "Allow pop-ups to open WhatsApp sharing.",
                variant: "error",
            });
            return;
        }

        showToast({
            title: "WhatsApp ready",
            message: `Prepared safe login message for ${staffUser?.name || "staff"}.`,
            variant: "success",
        });
    };

    const handleGenerateTempPassword = async (staffUser) => {
        setOpenActionMenuFor(null);
        if (!staffUser?.id) return;

        const targetRestaurantId = Number(
            restaurantId ||
            staffUser?.restaurantId ||
            resolveAuthoritativeRestaurantId(user, outletContext?.restaurantId) ||
            0
        );

        if (!targetRestaurantId || targetRestaurantId <= 0 || isNaN(targetRestaurantId)) {
            showToast({
                title: "Failed to generate password",
                message: "Unable to reset password because the restaurant information is unavailable. Please refresh the page and try again.",
                variant: "error",
            });
            return;
        }

        const confirmMsg = `Generate a new temporary password for ${staffUser.name}?\n\nThis will invalidate any active sessions and require them to set a new password on login.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            setGeneratingTempPasswordFor(staffUser.id);
            const res = await axios.post(`${API}/owner/${targetRestaurantId}/staff/${staffUser.id}/temp-password`);
            const tempPassword = res.data?.temporaryPassword;
            if (tempPassword) {
                setTemporaryPasswords((prev) => ({
                    ...prev,
                    [staffUser.id]: tempPassword,
                }));
                setTemporaryPasswordModal({
                    name: staffUser.name,
                    email: staffUser.email,
                    temporaryPassword: tempPassword,
                    loginLink: getStaffLoginLink(staffUser),
                });
            } else {
                showToast({
                    title: "Password Updated",
                    message: "Temporary password generated.",
                    variant: "success",
                });
            }
            await loadStaff({ silent: true });
        } catch (err) {
            console.error(err);
            const rawMessage = err?.response?.data?.message || "";
            const isRouteNotFound = rawMessage.toLowerCase().includes("not found") || err?.response?.status === 404;
            const userMessage = isRouteNotFound
                ? "Unable to reset password because the server endpoint was not found. Please refresh and try again."
                : (rawMessage || "Failed to issue temporary password.");
            showToast({
                title: "Failed to generate password",
                message: userMessage,
                variant: "error",
            });
        } finally {
            setGeneratingTempPasswordFor(null);
        }
    };

    // Filter users on client side as well for ultra-fast response
    const filteredUsers = useMemo(() => {
        return users.filter((u) => {
            if (roleFilter !== "ALL" && String(u.role).toUpperCase() !== roleFilter) return false;
            if (statusFilter === "ACTIVE" && !u.isActive) return false;
            if (statusFilter === "DISABLED" && u.isActive) return false;
            if (!query) return true;
            const q = query.toLowerCase().trim();
            return (
                String(u.name || "").toLowerCase().includes(q) ||
                String(u.email || "").toLowerCase().includes(q) ||
                String(u.phone || "").toLowerCase().includes(q) ||
                String(u.designation || "").toLowerCase().includes(q) ||
                String(u.role || "").toLowerCase().includes(q) ||
                String(u.id || "").includes(q)
            );
        });
    }, [users, roleFilter, statusFilter, query]);

    const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);

    return (
        <section data-testid="owner-staff" className="space-y-5 pb-12">
            <StaffSubNav />

            {/* Error Notification */}
            {error && (
                <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-400 shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="text-xs text-red-400 hover:text-red-200 cursor-pointer ml-3"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Add Staff Drawer / Form */}
            {showAddStaffForm && (
                <article className="rounded-2xl border border-[color:var(--app-border)]/60 bg-[var(--app-card)] p-5 shadow-lg">
                    <div className="mb-4 flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                        <h4 className="flex items-center gap-2 text-base font-bold text-[color:var(--app-text)]">
                            <UserPlus size={18} className="text-[var(--app-primary)]" />
                            Add New Staff Member
                        </h4>
                        <button
                            type="button"
                            onClick={() => setShowAddStaffForm(false)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-400">
                                    Full Name *
                                </label>
                                <input
                                    placeholder="e.g. John Doe"
                                    value={form.name}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/80 bg-[#0f172a] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[var(--app-primary)]"
                                    required
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-400">
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    placeholder="e.g. john@restaurant.com"
                                    value={form.email}
                                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/80 bg-[#0f172a] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[var(--app-primary)]"
                                    required
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-400">
                                    Phone Number *
                                </label>
                                <input
                                    placeholder="e.g. 9876543210"
                                    value={form.phone}
                                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/80 bg-[#0f172a] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[var(--app-primary)]"
                                    required
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-400">
                                    Staff Role *
                                </label>
                                <select
                                    value={form.role}
                                    onChange={(e) => {
                                        const r = e.target.value;
                                        setForm((prev) => ({
                                            ...prev,
                                            role: r,
                                            designationOption: getRoleDesignationFallback(r),
                                            access: defaultAccessByRole(r),
                                        }));
                                    }}
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/80 bg-[#0f172a] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[var(--app-primary)]"
                                >
                                    <option value="MANAGER">Manager</option>
                                    <option value="WAITER">Server / Waiter</option>
                                    <option value="CHEF">Chef</option>
                                    <option value="CASHIER">Cashier</option>
                                    <option value="STAFF">General Staff</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-400">
                                    Designation
                                </label>
                                <select
                                    value={form.designationOption}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            designationOption: e.target.value,
                                        }))
                                    }
                                    className="w-full rounded-xl border border-[color:var(--app-border)]/80 bg-[#0f172a] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[var(--app-primary)]"
                                >
                                    {DESIGNATION_OPTIONS.map((designation) => (
                                        <option key={designation} value={designation}>
                                            {designation}
                                        </option>
                                    ))}
                                    <option value="OTHER">Other (Custom)</option>
                                </select>
                            </div>

                            {form.designationOption === "OTHER" && (
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-gray-400">
                                        Custom Designation
                                    </label>
                                    <input
                                        placeholder="e.g. Head Bartender"
                                        value={form.customDesignation}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                customDesignation: e.target.value,
                                            }))
                                        }
                                        className="w-full rounded-xl border border-[color:var(--app-border)]/80 bg-[#0f172a] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[var(--app-primary)]"
                                    />
                                </div>
                            )}

                            <div>
                                <div className="mb-1 flex items-center justify-between">
                                    <label className="text-xs font-semibold text-gray-400">
                                        Temporary Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const generated = generateSecureTempPassword();
                                            setForm((prev) => ({ ...prev, password: generated }));
                                            setShowAddPassword(true);
                                        }}
                                        className="text-[11px] font-semibold text-[var(--app-primary)] hover:underline cursor-pointer"
                                    >
                                        Auto-Generate
                                    </button>
                                </div>
                                <div className="relative flex items-center">
                                    <input
                                        type={showAddPassword ? "text" : "password"}
                                        placeholder="Auto-generated if left blank"
                                        value={form.password}
                                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                                        className="w-full rounded-xl border border-[color:var(--app-border)]/80 bg-[#0f172a] pl-3.5 pr-10 py-2.5 text-xs text-white outline-none focus:border-[var(--app-primary)]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowAddPassword((prev) => !prev)}
                                        className="absolute right-3 text-gray-400 hover:text-white cursor-pointer"
                                        aria-label={showAddPassword ? "Hide password" : "Show password"}
                                    >
                                        {showAddPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-end">
                                <label className="flex items-center gap-2.5 rounded-xl border border-[color:var(--app-border)]/80 bg-[#0f172a] px-3.5 py-2.5 text-xs text-gray-300 w-full cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                                        className="rounded accent-orange-500"
                                    />
                                    <span className="font-semibold">Active Account</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAddStaffForm(false)}
                                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creating}
                                className="inline-flex items-center gap-2 rounded-xl bg-[var(--app-primary)] px-5 py-2 text-xs font-bold text-black shadow-md hover:opacity-90 disabled:opacity-60 transition cursor-pointer"
                            >
                                {creating ? (
                                    <>
                                        <LoaderCircle size={14} className="animate-spin" />
                                        <span>Creating Staff...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={14} />
                                        <span>Create Staff Member</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </article>
            )}

            {/* Staff Directory Controls & KPI Header */}
            <article className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <OwnerMenuButton />
                        <div>
                            <h4 className="text-xl font-bold flex items-center gap-2 text-[color:var(--app-text)]">
                                <Users size={22} className="text-[var(--app-primary)]" />
                                Staff Directory & Access
                            </h4>
                            <p className="text-xs theme-muted">
                                {restaurantName} &bull; {users.length} total staff &bull; {activeCount} active
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search Input */}
                        <div className="flex min-w-[200px] flex-1 sm:w-64 items-center gap-2 rounded-xl border border-[color:var(--app-border)]/70 bg-[#0f172a] px-3.5 py-2 text-xs">
                            <Search size={14} className="text-gray-400 shrink-0" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name, email, role..."
                                className="w-full bg-transparent outline-none text-white placeholder-gray-400"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery("")}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Role Filter */}
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="rounded-xl border border-[color:var(--app-border)]/70 bg-[#0f172a] px-3 py-2 text-xs font-semibold text-gray-200 outline-none"
                            aria-label="Filter staff by role"
                        >
                            {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="rounded-xl border border-[color:var(--app-border)]/70 bg-[#0f172a] px-3 py-2 text-xs font-semibold text-gray-200 outline-none"
                            aria-label="Filter staff by active status"
                        >
                            {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        {/* Add Staff Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowAddStaffForm((prev) => !prev)}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--app-primary)] px-4 py-2 text-xs font-bold text-black shadow-md transition hover:opacity-90 cursor-pointer"
                        >
                            <UserPlus size={15} />
                            <span>{showAddStaffForm ? "Hide Form" : "Add Staff"}</span>
                        </button>
                    </div>
                </div>

                {/* Directory Content List */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-[color:var(--app-border)]/40 bg-[var(--app-card)] p-12 text-center">
                        <LoaderCircle size={28} className="animate-spin text-[var(--app-primary)] mb-3" />
                        <p className="text-sm font-semibold theme-muted">Loading staff directory...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--app-border)]/60 bg-[var(--app-card)]/40 p-12 text-center">
                        <Users size={32} className="text-gray-500 mb-3" />
                        <h5 className="text-sm font-bold text-[color:var(--app-text)]">
                            {users.length === 0 ? "No Staff Members Added Yet" : "No Staff Matching Filters"}
                        </h5>
                        <p className="mt-1 text-xs theme-muted max-w-sm">
                            {users.length === 0
                                ? "Add your restaurant managers, servers, chefs, and cashiers to manage operations and permissions."
                                : "Try clearing your search query or reset the role and status filters."}
                        </p>
                        {users.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery("");
                                    setRoleFilter("ALL");
                                    setStatusFilter("ALL");
                                }}
                                className="mt-3 text-xs font-semibold text-[var(--app-primary)] hover:underline cursor-pointer"
                            >
                                Reset All Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredUsers.map((staffUser) => {
                            const isAccessOpen = selectedAccessUserId === staffUser.id;
                            const isEditing = editingStaffId === staffUser.id;
                            const staffLoginLink = getStaffLoginLink(staffUser);

                            return (
                                <div
                                    key={staffUser.id}
                                    className="relative rounded-2xl border border-[color:var(--app-border)]/50 bg-[var(--app-card)] p-4 shadow-sm hover:border-[color:var(--app-border)] transition"
                                >
                                    {isEditing ? (
                                        /* In-Place Edit Form */
                                        <div className="space-y-4 rounded-xl border border-amber-500/30 bg-[#0b1329] p-4 shadow-xl">
                                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                                <h5 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-amber-400">
                                                    <Pencil size={14} />
                                                    Editing Staff Profile: {staffUser.name} (ID: #{staffUser.id})
                                                </h5>
                                                <button
                                                    type="button"
                                                    onClick={cancelEditRow}
                                                    className="text-xs text-gray-400 hover:text-white"
                                                >
                                                    Cancel
                                                </button>
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                <div>
                                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                                        Full Name *
                                                    </label>
                                                    <input
                                                        value={editDraft.name}
                                                        onChange={(e) =>
                                                            setEditDraft((prev) => ({ ...prev, name: e.target.value }))
                                                        }
                                                        placeholder="Full name"
                                                        className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                                        Email Address *
                                                    </label>
                                                    <input
                                                        type="email"
                                                        value={editDraft.email}
                                                        onChange={(e) =>
                                                            setEditDraft((prev) => ({ ...prev, email: e.target.value }))
                                                        }
                                                        placeholder="Email address"
                                                        className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                                        Phone Number
                                                    </label>
                                                    <input
                                                        value={editDraft.phone}
                                                        onChange={(e) =>
                                                            setEditDraft((prev) => ({ ...prev, phone: e.target.value }))
                                                        }
                                                        placeholder="Phone number"
                                                        className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                                        Role
                                                    </label>
                                                    <select
                                                        value={editDraft.role}
                                                        disabled={staffUser.role === "OWNER"}
                                                        onChange={(e) => {
                                                            const r = e.target.value;
                                                            setEditDraft((prev) => ({
                                                                ...prev,
                                                                role: r,
                                                                designationOption: getRoleDesignationFallback(r),
                                                            }));
                                                        }}
                                                        className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs text-white outline-none focus:border-amber-500 disabled:opacity-60"
                                                    >
                                                        {staffUser.role === "OWNER" && <option value="OWNER">Owner</option>}
                                                        <option value="MANAGER">Manager</option>
                                                        <option value="WAITER">Server / Waiter</option>
                                                        <option value="CHEF">Chef</option>
                                                        <option value="CASHIER">Cashier</option>
                                                        <option value="STAFF">General Staff</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                                        Designation
                                                    </label>
                                                    <select
                                                        value={editDraft.designationOption}
                                                        onChange={(e) =>
                                                            setEditDraft((prev) => ({
                                                                ...prev,
                                                                designationOption: e.target.value,
                                                            }))
                                                        }
                                                        className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                    >
                                                        {DESIGNATION_OPTIONS.map((designation) => (
                                                            <option key={designation} value={designation}>
                                                                {designation}
                                                            </option>
                                                        ))}
                                                        <option value="OTHER">Other (Custom)</option>
                                                    </select>
                                                </div>

                                                {editDraft.designationOption === "OTHER" && (
                                                    <div>
                                                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                                            Custom Designation
                                                        </label>
                                                        <input
                                                            value={editDraft.customDesignation}
                                                            onChange={(e) =>
                                                                setEditDraft((prev) => ({
                                                                    ...prev,
                                                                    customDesignation: e.target.value,
                                                                }))
                                                            }
                                                            placeholder="Custom designation"
                                                            className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                        />
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                                        New Password (Optional)
                                                    </label>
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type={showEditPassword ? "text" : "password"}
                                                            value={editDraft.password}
                                                            onChange={(e) =>
                                                                setEditDraft((prev) => ({
                                                                    ...prev,
                                                                    password: e.target.value,
                                                                }))
                                                            }
                                                            placeholder="Leave blank to keep current"
                                                            className="w-full rounded-lg border border-white/10 bg-[#0f172a] pl-3 pr-9 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowEditPassword((prev) => !prev)}
                                                            className="absolute right-2.5 text-gray-400 hover:text-white cursor-pointer"
                                                            aria-label={showEditPassword ? "Hide password" : "Show password"}
                                                        >
                                                            {showEditPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex items-end">
                                                    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs text-gray-300 w-full cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(editDraft.isActive)}
                                                            disabled={staffUser.role === "OWNER"}
                                                            onChange={(e) =>
                                                                setEditDraft((prev) => ({
                                                                    ...prev,
                                                                    isActive: e.target.checked,
                                                                }))
                                                            }
                                                            className="accent-amber-500"
                                                        />
                                                        <span className="font-semibold">Active Account</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Edit Permissions Matrix if not Owner */}
                                            {staffUser.role !== "OWNER" && (
                                                <div className="pt-3 border-t border-white/10">
                                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                                        Module Access Permissions
                                                    </p>
                                                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                                        {modules.map((key) => (
                                                            <label key={key} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={Boolean(editDraft.access?.[key])}
                                                                    onChange={(e) =>
                                                                        setEditDraft((prev) => ({
                                                                            ...prev,
                                                                            access: {
                                                                                ...prev.access,
                                                                                [key]: e.target.checked,
                                                                            },
                                                                        }))
                                                                    }
                                                                    className="accent-amber-500"
                                                                />
                                                                <span>{ACCESS_LABELS[key] || key}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                                                <button
                                                    type="button"
                                                    onClick={cancelEditRow}
                                                    className="rounded-lg border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5 transition cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => saveEditedRow(staffUser)}
                                                    disabled={savingEditFor === staffUser.id}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-bold text-black shadow-md hover:bg-orange-400 disabled:opacity-60 transition cursor-pointer"
                                                >
                                                    {savingEditFor === staffUser.id ? (
                                                        <>
                                                            <LoaderCircle size={13} className="animate-spin" />
                                                            <span>Saving...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Pencil size={13} />
                                                            <span>Save Staff Updates</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Normal Staff Card View */
                                        <div className="flex flex-col gap-3 pr-24">
                                            {/* Identity Row */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-mono font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                                    #{staffUser.id}
                                                </span>
                                                <p className="text-base font-bold text-[color:var(--app-text)]">
                                                    {staffUser.name}
                                                </p>
                                                <span className="theme-staff-role-pill rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                                                    {resolveDesignation(staffUser)}
                                                </span>
                                                <span className="rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                                    {staffUser.role}
                                                </span>
                                                <span
                                                    className={`theme-staff-status-pill rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                                        staffUser.isActive ? "is-active" : "is-disabled"
                                                    }`}
                                                >
                                                    {staffUser.isActive ? "ACTIVE" : "DISABLED"}
                                                </span>
                                                <span className="flex items-center gap-1 text-[11px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
                                                    <Building2 size={12} className="text-gray-400" />
                                                    {restaurantName}
                                                </span>
                                            </div>

                                            {/* Contact Details */}
                                            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs theme-muted">
                                                <span>Email: <strong className="text-[color:var(--app-text)] font-medium">{staffUser.email}</strong></span>
                                                <span>Phone: <strong className="text-[color:var(--app-text)] font-medium">{staffUser.phone || "None"}</strong></span>
                                                <span>Joined: {new Date(staffUser.createdAt).toLocaleDateString()}</span>
                                            </div>

                                            {/* Safe Pre-fill Login URL (No tokens) */}
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                <span className="text-gray-400 font-medium">Login URL:</span>
                                                <code className="rounded bg-black/30 border border-white/10 px-2 py-1 text-[11px] text-[var(--app-primary)] select-all break-all">
                                                    {staffLoginLink}
                                                </code>
                                                <button
                                                    type="button"
                                                    onClick={() => copyStaffLoginLink(staffUser)}
                                                    className="inline-flex items-center gap-1 rounded-md bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-gray-200 hover:bg-white/10 transition cursor-pointer"
                                                >
                                                    <Copy size={12} />
                                                    <span>Copy Link</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => shareStaffLoginOnWhatsApp(staffUser)}
                                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600/20 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-600/30 transition cursor-pointer"
                                                >
                                                    <span>WhatsApp</span>
                                                </button>
                                            </div>

                                            {/* Temporary Password Row */}
                                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                                <span className="text-gray-400 font-medium">Password:</span>
                                                {temporaryPasswords[staffUser.id] ? (
                                                    <>
                                                        <code className="rounded bg-orange-500/10 border border-orange-500/30 px-2.5 py-1 font-mono text-[11px] font-bold text-orange-400 select-all">
                                                            {temporaryPasswords[staffUser.id]}
                                                        </code>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyTemporaryPassword(staffUser.id, temporaryPasswords[staffUser.id])}
                                                            className="inline-flex items-center gap-1 rounded-md bg-orange-500/20 border border-orange-500/30 px-2.5 py-1 text-[11px] font-semibold text-orange-300 hover:bg-orange-500/30 transition cursor-pointer"
                                                            title="Copy Temporary Password"
                                                            aria-label={`Copy temporary password for ${staffUser.name}`}
                                                        >
                                                            {copiedPasswordId === staffUser.id ? (
                                                                <>
                                                                    <Check size={12} className="text-emerald-400" />
                                                                    <span className="text-emerald-400 font-bold">Copied</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Copy size={12} />
                                                                    <span>Copy</span>
                                                                </>
                                                            )}
                                                        </button>
                                                        <span className="text-[11px] text-gray-400 italic">
                                                            Temporary password — shown only after reset.
                                                        </span>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-mono tracking-widest text-gray-400 select-none text-xs">
                                                            ••••••••••
                                                        </span>
                                                        {staffUser.role !== "OWNER" && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleGenerateStaffLoginLink(staffUser)}
                                                                disabled={generatingLoginLinkFor === staffUser.id || !staffUser.isActive}
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold text-orange-400 transition hover:bg-orange-500 hover:text-black cursor-pointer shadow-xs disabled:opacity-50"
                                                                title="Generate a secure 10-minute, single-use passwordless login link"
                                                                data-testid={`generate-login-link-${staffUser.id}`}
                                                            >
                                                                <Link2 size={12} />
                                                                <span>{generatingLoginLinkFor === staffUser.id ? "Generating..." : "Generate Login Link"}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Generated One-Time Login Link Card */}
                                            {loginLinks[staffUser.id] && (
                                                <div className="mt-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs space-y-2" data-testid={`login-link-container-${staffUser.id}`}>
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="font-bold text-orange-400 flex items-center gap-1.5">
                                                            <ShieldCheck size={14} className="text-emerald-400" />
                                                            Staff Login Link
                                                        </span>
                                                        <span className="text-[11px] text-amber-300 font-medium">
                                                            Expires in 10 minutes • Single use
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-gray-400 font-medium">Login Link:</span>
                                                        <code className="rounded bg-black/40 border border-white/10 px-2 py-1 text-[11px] text-orange-300 select-all font-mono break-all flex-1 min-w-[200px]">
                                                            {loginLinks[staffUser.id].loginUrl}
                                                        </code>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyGeneratedLoginLink(staffUser.id, loginLinks[staffUser.id].loginUrl)}
                                                            className="inline-flex items-center gap-1 rounded-md bg-orange-500 px-3 py-1 text-[11px] font-bold text-black hover:bg-orange-400 transition cursor-pointer"
                                                            data-testid={`copy-login-link-${staffUser.id}`}
                                                        >
                                                            {copiedLoginLinkId === staffUser.id ? (
                                                                <>
                                                                    <Check size={12} />
                                                                    <span>Copied</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Copy size={12} />
                                                                    <span>Copy Link</span>
                                                                </>
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => shareStaffLoginOnWhatsApp(staffUser)}
                                                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600/30 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/40 transition cursor-pointer"
                                                        >
                                                            <span>WhatsApp</span>
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
                                                        <span>Status: <strong className="text-emerald-400 font-semibold">Single-use login link</strong></span>
                                                        <span>•</span>
                                                        <span>Expires: <strong className="text-amber-400 font-semibold">10 minutes</strong></span>
                                                        <span>•</span>
                                                        <span className="text-gray-500">No password in link</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                                                <KeyRound size={12} className="text-amber-400 shrink-0" />
                                                <span>Password must be entered separately at login (never shared in link for security).</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons Top-Right */}
                                    {!isEditing && (
                                        <div className="absolute right-4 top-4 flex items-center gap-2" data-staff-actions-menu>
                                            <button
                                                type="button"
                                                onClick={() => startEditRow(staffUser)}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-400 transition hover:bg-amber-500 hover:text-black cursor-pointer shadow-xs"
                                                title="Edit staff member profile and permissions"
                                            >
                                                <Pencil size={13} />
                                                <span>Edit</span>
                                            </button>

                                            {staffUser.role !== "OWNER" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleGenerateTempPassword(staffUser)}
                                                    disabled={generatingTempPasswordFor === staffUser.id}
                                                    className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/15 px-3 py-1.5 text-xs font-bold text-orange-400 transition hover:bg-orange-500 hover:text-black cursor-pointer shadow-xs disabled:opacity-50"
                                                    title="Issue / Reset Temporary Password"
                                                >
                                                    <KeyRound size={13} />
                                                    <span>{generatingTempPasswordFor === staffUser.id ? "Issuing..." : "Reset Password"}</span>
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setOpenActionMenuFor((prev) =>
                                                        prev === staffUser.id ? null : staffUser.id
                                                    )
                                                }
                                                className="inline-flex items-center justify-center rounded-xl bg-[#111827] border border-white/10 p-2 text-gray-200 hover:bg-[#1b2438] cursor-pointer"
                                                aria-label="Open staff actions"
                                            >
                                                <MoreVertical size={16} />
                                            </button>

                                            {openActionMenuFor === staffUser.id && (
                                                <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-white/10 bg-[#111827] p-1.5 shadow-2xl">
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditRow(staffUser)}
                                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-amber-200 hover:bg-amber-500/10 cursor-pointer"
                                                    >
                                                        <Pencil size={14} />
                                                        Edit Profile
                                                    </button>

                                                    {staffUser.role !== "OWNER" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleGenerateTempPassword(staffUser)}
                                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-orange-300 hover:bg-orange-500/10 cursor-pointer"
                                                        >
                                                            <KeyRound size={14} />
                                                            Reset Password
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => confirmToggleStatus(staffUser)}
                                                        disabled={
                                                            updatingStatusFor === staffUser.id ||
                                                            staffUser.role === "OWNER"
                                                        }
                                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {staffUser.isActive ? (
                                                            <UserRoundX size={14} />
                                                        ) : (
                                                            <UserRoundCheck size={14} />
                                                        )}
                                                        {staffUser.isActive ? "Deactivate / Disable" : "Activate Staff"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => openAccessPanel(staffUser)}
                                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-indigo-200 hover:bg-indigo-500/10 cursor-pointer"
                                                    >
                                                        <ShieldCheck size={14} />
                                                        Permissions Matrix
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => confirmDeleteStaff(staffUser)}
                                                        disabled={deletingFor === staffUser.id || staffUser.role === "OWNER"}
                                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete Staff
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Standalone Delegate Access Drawer/Panel */}
                                    {isAccessOpen && !isEditing && (
                                        <div className="mt-4 rounded-xl border border-indigo-500/30 bg-[#0d142c] p-4 shadow-inner">
                                            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                                                <div>
                                                    <h5 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-indigo-400">
                                                        <ShieldCheck size={15} />
                                                        Module Access Permissions for {staffUser.name} ({staffUser.role})
                                                    </h5>
                                                    <p className="text-[11px] theme-muted">
                                                        Checked modules are available when {staffUser.name} logs in.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setAccessDraft(defaultAccessByRole(staffUser.role))
                                                    }
                                                    className="text-[11px] font-semibold text-indigo-300 hover:underline cursor-pointer"
                                                >
                                                    Reset to Role Defaults
                                                </button>
                                            </div>

                                            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                                {modules.map((moduleKey) => (
                                                    <label key={moduleKey} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(accessDraft[moduleKey])}
                                                            disabled={staffUser.role === "OWNER"}
                                                            onChange={(e) =>
                                                                setAccessDraft((prev) => ({
                                                                    ...prev,
                                                                    [moduleKey]: e.target.checked,
                                                                }))
                                                            }
                                                            className="accent-indigo-500 rounded"
                                                        />
                                                        <span>{ACCESS_LABELS[moduleKey] || moduleKey}</span>
                                                    </label>
                                                ))}
                                            </div>

                                            <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedAccessUserId(null)}
                                                    className="rounded-lg border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5 cursor-pointer"
                                                >
                                                    Close
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => saveAccess(staffUser.id)}
                                                    disabled={savingAccessFor === staffUser.id || staffUser.role === "OWNER"}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-4 py-1.5 text-xs font-bold text-black disabled:opacity-60 cursor-pointer"
                                                >
                                                    {savingAccessFor === staffUser.id ? (
                                                        <LoaderCircle size={13} className="animate-spin" />
                                                    ) : (
                                                        <KeyRound size={13} />
                                                    )}
                                                    Save Permissions
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </article>

            {/* One-Time Temporary Password Modal */}
            {temporaryPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[var(--app-primary)]/40 bg-[#0f172a] p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                            <h4 className="flex items-center gap-2 text-base font-bold text-white">
                                <KeyRound size={18} className="text-[var(--app-primary)]" />
                                Temporary Password Created
                            </h4>
                            <button
                                type="button"
                                onClick={() => setTemporaryPasswordModal(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-xs text-gray-300 leading-relaxed mb-4">
                            A secure temporary password was created for{" "}
                            <strong className="text-white">{temporaryPasswordModal.name}</strong> (
                            {temporaryPasswordModal.email}).
                        </p>

                        <div className="rounded-xl border border-white/15 bg-black/40 p-3.5 mb-4 space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block">
                                Temporary Password
                            </label>
                            <div className="flex items-center justify-between gap-2">
                                <code className="font-mono text-sm font-bold text-[var(--app-primary)] tracking-wide">
                                    {temporaryPasswordModal.temporaryPassword}
                                </code>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(temporaryPasswordModal.temporaryPassword);
                                            setCopiedPassword(true);
                                            setTimeout(() => setCopiedPassword(false), 2000);
                                            showToast({
                                                title: "Password Copied",
                                                message: "Temporary password copied to clipboard.",
                                                variant: "success",
                                            });
                                        } catch {
                                            showToast({ title: "Copy Failed", message: "Clipboard access denied.", variant: "error" });
                                        }
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
                                >
                                    {copiedPassword ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    <span>{copiedPassword ? "Copied" : "Copy"}</span>
                                </button>
                            </div>
                        </div>

                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2 mb-5">
                            <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />
                            <span>
                                <strong>Important Security Notice:</strong> This password is only shown once and cannot be retrieved later. Share it securely with the staff member.
                            </span>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setTemporaryPasswordModal(null)}
                                className="rounded-xl bg-[var(--app-primary)] px-5 py-2 text-xs font-bold text-black shadow-md hover:opacity-90 transition cursor-pointer"
                            >
                                I Have Shared / Saved This Password
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Deactivation Modal */}
            {confirmDeactivateUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#0f172a] p-6 shadow-2xl">
                        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                            <UserRoundX size={20} className="text-red-400" />
                            <h4 className="text-base font-bold text-white">
                                Deactivate Staff Member?
                            </h4>
                        </div>

                        <p className="text-xs text-gray-300 leading-relaxed mb-4">
                            Are you sure you want to deactivate <strong className="text-white">{confirmDeactivateUser.name}</strong>?
                        </p>

                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 mb-5">
                            Deactivating this account will immediately revoke all active login sessions and block access to staff portals until re-enabled.
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDeactivateUser(null)}
                                className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => executeToggleStatus(confirmDeactivateUser, false)}
                                disabled={updatingStatusFor === confirmDeactivateUser.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-500 transition cursor-pointer disabled:opacity-60"
                            >
                                {updatingStatusFor === confirmDeactivateUser.id ? (
                                    <LoaderCircle size={14} className="animate-spin" />
                                ) : (
                                    <UserRoundX size={14} />
                                )}
                                <span>Deactivate Account</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {confirmDeleteUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#0f172a] p-6 shadow-2xl">
                        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                            <Trash2 size={20} className="text-red-400" />
                            <h4 className="text-base font-bold text-white">
                                Delete Staff Member Permanently?
                            </h4>
                        </div>

                        <p className="text-xs text-gray-300 leading-relaxed mb-3">
                            Are you sure you want to permanently delete{" "}
                            <strong className="text-white">{confirmDeleteUser.name}</strong> (
                            {confirmDeleteUser.email})?
                        </p>

                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 mb-5">
                            <strong>Note:</strong> If this staff member has historical records (such as completed shifts, closed cash floats, or past orders), deletion will be rejected to protect business audit trails. Please <strong>deactivate</strong> the account instead if they have historical activity.
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteUser(null)}
                                className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={executeDeleteStaff}
                                disabled={deletingFor === confirmDeleteUser.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-500 transition cursor-pointer disabled:opacity-60"
                            >
                                {deletingFor === confirmDeleteUser.id ? (
                                    <LoaderCircle size={14} className="animate-spin" />
                                ) : (
                                    <Trash2 size={14} />
                                )}
                                <span>Delete Staff Member</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
