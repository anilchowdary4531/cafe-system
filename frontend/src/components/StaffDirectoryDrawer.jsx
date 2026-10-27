import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
    X,
    Search,
    UserPlus,
    Phone,
    Mail,
    Shield,
    Copy,
    Send,
    Pencil,
    UserCheck,
    UserX,
    KeyRound,
    Check,
    Lock,
    AlertTriangle,
    Link2,
    ShieldCheck,
} from "lucide-react";
import { API } from "../config";
import { showToast } from "../utils/toast";
import { useAuth } from "../context/AuthContext";
import { resolveAuthoritativeRestaurantId } from "../utils/restaurantContext";
import StaffEditModal from "./StaffEditModal";

export default function StaffDirectoryDrawer({ isOpen, onClose, restaurantId, onEditStaff }) {
    const { user: authUser } = useAuth();
    const effectiveRestaurantId = useMemo(() => {
        return resolveAuthoritativeRestaurantId(authUser, restaurantId);
    }, [authUser, restaurantId]);

    const [staffUsers, setStaffUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [temporaryPasswordModal, setTemporaryPasswordModal] = useState(null);
    const [temporaryPasswords, setTemporaryPasswords] = useState({});
    const [copiedPasswordId, setCopiedPasswordId] = useState(null);
    const [copiedPassword, setCopiedPassword] = useState(false);
    const [generatingTempPasswordFor, setGeneratingTempPasswordFor] = useState(null);
    const [loginLinks, setLoginLinks] = useState({});
    const [generatingLoginLinkFor, setGeneratingLoginLinkFor] = useState(null);
    const isGeneratingLoginLinkRef = useRef(false);
    const [copiedLoginLinkId, setCopiedLoginLinkId] = useState(null);
    const [addForm, setAddForm] = useState({
        name: "",
        phone: "",
        email: "",
        password: "",
        role: "WAITER",
        designation: "",
    });

    const loadStaff = async () => {
        if (!effectiveRestaurantId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API}/owner/${effectiveRestaurantId}/staff`);
            setStaffUsers(res.data?.users || res.data || []);
        } catch {
            showToast("Failed to load staff directory", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateStaffLoginLink = async (u) => {
        if (!u?.id || isGeneratingLoginLinkRef.current) return;
        isGeneratingLoginLinkRef.current = true;
        try {
            setGeneratingLoginLinkFor(u.id);
            const res = await axios.post(`${API}/owner/${effectiveRestaurantId}/staff/${u.id}/login-link`, {});
            const { loginUrl, token, expiresAt } = res.data;
            const link = loginUrl || `${window.location.origin}/login?mode=staff&token=${token}`;
            setLoginLinks((prev) => ({
                ...prev,
                [u.id]: {
                    loginUrl: link,
                    token,
                    expiresAt,
                },
            }));
            showToast(`One-time login link generated for ${u.name} (valid 10 mins)`, "success");
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
                : (rawMsg || "Failed to generate login link");
            showToast(msg, "error");
        } finally {
            setGeneratingLoginLinkFor(null);
            isGeneratingLoginLinkRef.current = false;
        }
    };

    const copyGeneratedLoginLink = async (staffId, url) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedLoginLinkId(staffId);
            showToast("Login link copied to clipboard", "success");
            setTimeout(() => setCopiedLoginLinkId(null), 2500);
        } catch {
            showToast("Browser blocked clipboard access", "error");
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadStaff();
        }
    }, [isOpen, effectiveRestaurantId]);

    if (!isOpen) return null;

    const filtered = staffUsers.filter((u) => {
        const q = query.toLowerCase().trim();
        if (!q) return true;
        return (
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.phone?.toLowerCase().includes(q) ||
            u.role?.toLowerCase().includes(q) ||
            u.designation?.toLowerCase().includes(q)
        );
    });

    const copyLoginLink = (user) => {
        const link = `${window.location.origin}/login?mode=staff&email=${encodeURIComponent(user.email)}`;
        navigator.clipboard.writeText(link);
        showToast(`Staff login link copied for ${user.name}!`, "success");
    };

    const copyTemporaryPassword = async (staffId, password) => {
        try {
            await navigator.clipboard.writeText(password);
            setCopiedPasswordId(staffId);
            setTimeout(() => setCopiedPasswordId(null), 2000);
            showToast("Temporary password copied to clipboard!", "success");
        } catch {
            showToast("Clipboard access denied.", "error");
        }
    };

    const shareWhatsApp = (user) => {
        const link = `${window.location.origin}/login?mode=staff&email=${encodeURIComponent(user.email)}`;
        const tempPass = temporaryPasswords[user.id];
        let text;
        if (tempPass) {
            text = `Hi ${user.name},\nHere is your Tiffzy login credential:\n• Login URL: ${link}\n• Temporary Password: ${tempPass}\n\nPlease log in and update your password immediately.`;
        } else {
            text = `Hi ${user.name}, here is your login link for Tiffzy: ${link}\n\nNote: Please enter your staff password or the temporary password provided by management to log in.`;
        }
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleGenerateTempPassword = async (user) => {
        if (!user?.id) return;
        const targetRestaurantId = Number(
            effectiveRestaurantId ||
            user?.restaurantId ||
            resolveAuthoritativeRestaurantId(authUser, restaurantId) ||
            0
        );

        if (!targetRestaurantId || targetRestaurantId <= 0 || isNaN(targetRestaurantId)) {
            showToast("Unable to reset password because the restaurant information is unavailable. Please refresh the page and try again.", "error");
            return;
        }

        const confirmMsg = `Generate a new temporary password for ${user.name}?\n\nThis will invalidate active sessions and require them to set a new password on login.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            setGeneratingTempPasswordFor(user.id);
            const res = await axios.post(`${API}/owner/${targetRestaurantId}/staff/${user.id}/temp-password`);
            const tempPassword = res.data?.temporaryPassword;
            if (tempPassword) {
                setTemporaryPasswords((prev) => ({
                    ...prev,
                    [user.id]: tempPassword,
                }));
                setTemporaryPasswordModal({
                    name: user.name,
                    email: user.email,
                    temporaryPassword: tempPassword,
                    loginLink: `${window.location.origin}/login?mode=staff&email=${encodeURIComponent(user.email)}`,
                });
            } else {
                showToast("Temporary password generated.", "success");
            }
            await loadStaff();
        } catch (err) {
            const rawMessage = err?.response?.data?.message || "";
            const isRouteNotFound = rawMessage.toLowerCase().includes("not found") || err?.response?.status === 404;
            const userMessage = isRouteNotFound
                ? "Unable to reset password because the server endpoint was not found. Please refresh and try again."
                : (rawMessage || "Failed to generate temporary password.");
            showToast(userMessage, "error");
        } finally {
            setGeneratingTempPasswordFor(null);
        }
    };

    const handleEditClick = (user) => {
        setEditingStaff(user);
        if (typeof onEditStaff === "function") {
            onEditStaff(user);
        }
    };

    const handleAddPerson = async (e) => {
        e.preventDefault();
        if (!effectiveRestaurantId) return;
        setSubmitting(true);
        try {
            const res = await axios.post(`${API}/owner/${effectiveRestaurantId}/staff`, {
                name: addForm.name,
                email: addForm.email,
                phone: addForm.phone,
                password: addForm.password || undefined,
                role: addForm.role,
                designation: addForm.designation || undefined,
            });
            const tempPassword = res.data?.temporaryPassword;
            const createdUser = res.data?.user;
            if (tempPassword) {
                if (createdUser?.id) {
                    setTemporaryPasswords((prev) => ({
                        ...prev,
                        [createdUser.id]: tempPassword,
                    }));
                }
                setTemporaryPasswordModal({
                    name: addForm.name,
                    email: addForm.email,
                    temporaryPassword: tempPassword,
                });
            } else {
                showToast(`Added ${addForm.name} to staff directory!`, "success");
            }
            setShowAddForm(false);
            setAddForm({
                name: "",
                phone: "",
                email: "",
                password: "",
                role: "WAITER",
                designation: "",
            });
            loadStaff();
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to add staff member", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-neutral-900/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-neutral-200 animation-slide-left">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                            Staff Directory
                        </h2>
                        <p className="text-xs text-neutral-500">View and manage staff accounts & details</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowAddForm((prev) => !prev)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                        >
                            <UserPlus size={14} />
                            {showAddForm ? "Cancel" : "Add Person"}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Add Person Form Drawer */}
                {showAddForm && (
                    <div className="p-4 border-b border-orange-100 bg-orange-50/40">
                        <form onSubmit={handleAddPerson} className="space-y-3 text-xs">
                            <div className="font-bold text-neutral-900 text-xs flex items-center justify-between border-b border-neutral-200/60 pb-1.5">
                                <span>Add New Person</span>
                                <span className="text-[10px] text-neutral-500 font-normal">Staff Member</span>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={addForm.name}
                                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                    placeholder="e.g. Ramesh Kumar"
                                    className="w-full p-2 bg-white rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">Phone *</label>
                                    <input
                                        type="tel"
                                        required
                                        value={addForm.phone}
                                        onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                                        placeholder="9876543210"
                                        className="w-full p-2 bg-white rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">Email *</label>
                                    <input
                                        type="email"
                                        required
                                        value={addForm.email}
                                        onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                                        placeholder="ramesh@gmail.com"
                                        className="w-full p-2 bg-white rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">Role *</label>
                                    <select
                                        value={addForm.role}
                                        onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                                        className="w-full p-2 bg-white rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="WAITER">Server / Waiter</option>
                                        <option value="CASHIER">Cashier</option>
                                        <option value="CHEF">Chef</option>
                                        <option value="MANAGER">Manager</option>
                                        <option value="STAFF">General Staff</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">Designation</label>
                                    <input
                                        type="text"
                                        value={addForm.designation}
                                        onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                                        placeholder="e.g. Senior Server"
                                        className="w-full p-2 bg-white rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">Password (Optional)</label>
                                <input
                                    type="text"
                                    value={addForm.password}
                                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                                    placeholder="Leave blank for auto-generated temporary password"
                                    className="w-full p-2 bg-white rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-neutral-400"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="px-3 py-1 text-neutral-600 bg-neutral-200/80 hover:bg-neutral-300 rounded-lg font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-1 text-white bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold shadow-xs transition-colors disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : "Save Person"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Search Bar */}
                <div className="p-4 border-b border-neutral-100 bg-white">
                    <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl border border-neutral-200">
                        <Search className="w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search staff name, role, phone..."
                            className="w-full bg-transparent text-xs outline-none text-neutral-800"
                        />
                    </div>
                </div>

                {/* Staff Cards List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="text-center py-8 text-neutral-400 text-xs">Loading staff list...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-8 text-neutral-400 text-xs">No staff members match your search.</div>
                    ) : (
                        filtered.map((u) => (
                            <div key={u.id} className="p-4 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2.5 hover:border-orange-300 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 font-bold text-sm flex items-center justify-center">
                                            {u.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-neutral-900">{u.name}</div>
                                            <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                                                <span className="bg-neutral-100 px-2 py-0.5 rounded font-semibold text-neutral-700">
                                                    {u.designation || u.role}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    u.isActive !== false ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                }`}>
                                                    {u.isActive !== false ? "ACTIVE" : "INACTIVE"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs text-neutral-600 space-y-1.5 pt-2 border-t border-neutral-100">
                                    {u.phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3.5 h-3.5 text-neutral-400" />
                                            <span>{u.phone}</span>
                                        </div>
                                    )}
                                    {u.email && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5 text-neutral-400" />
                                            <span className="truncate">{u.email}</span>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        <span className="text-neutral-500 font-medium">Login URL:</span>
                                        <code className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 truncate max-w-[220px]">
                                            {`${window.location.origin}/login?mode=staff&email=${encodeURIComponent(u.email)}`}
                                        </code>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-neutral-500 font-medium">Password:</span>
                                        {temporaryPasswords[u.id] ? (
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <code className="text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded font-mono font-bold select-all">
                                                    {temporaryPasswords[u.id]}
                                                </code>
                                                <button
                                                    type="button"
                                                    onClick={() => copyTemporaryPassword(u.id, temporaryPasswords[u.id])}
                                                    className="inline-flex items-center gap-1 rounded bg-orange-100 hover:bg-orange-200 text-orange-800 px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer"
                                                    title="Copy Temporary Password"
                                                    aria-label={`Copy temporary password for ${u.name}`}
                                                >
                                                    {copiedPasswordId === u.id ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-emerald-600" />
                                                            <span className="text-emerald-700 font-bold">Copied</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3" />
                                                            <span>Copy</span>
                                                        </>
                                                    )}
                                                </button>
                                                <span className="text-[10px] text-neutral-400 italic">
                                                    Temporary password — shown only after reset.
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono tracking-widest text-neutral-400 select-none text-xs">
                                                    ••••••••••
                                                </span>
                                                {u.role !== "OWNER" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleGenerateStaffLoginLink(u)}
                                                        disabled={generatingLoginLinkFor === u.id || !u.isActive}
                                                        className="px-2 py-0.5 text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200/60 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                        title="Generate 10-minute single-use login link"
                                                    >
                                                        <Link2 className="w-3 h-3" />
                                                        <span>{generatingLoginLinkFor === u.id ? "Generating..." : "Generate Login Link"}</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {loginLinks[u.id] && (
                                        <div className="mt-2 p-2 rounded-lg bg-orange-50/80 border border-orange-200 text-xs space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="font-bold text-orange-800 flex items-center gap-1">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                    Staff Login Link
                                                </span>
                                                <span className="text-[10px] text-amber-700 font-medium">Expires in 10 mins • Single use</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <code className="text-[10px] bg-white border border-neutral-200 rounded px-1.5 py-0.5 font-mono text-neutral-800 break-all flex-1">
                                                    {loginLinks[u.id].loginUrl}
                                                </code>
                                                <button
                                                    type="button"
                                                    onClick={() => copyGeneratedLoginLink(u.id, loginLinks[u.id].loginUrl)}
                                                    className="px-2 py-0.5 bg-orange-500 text-white rounded text-[10px] font-bold hover:bg-orange-600 transition shrink-0 cursor-pointer"
                                                >
                                                    {copiedLoginLinkId === u.id ? "Copied" : "Copy Link"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-100 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleEditClick(u)}
                                        className="px-2.5 py-1 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-lg transition-colors flex items-center gap-1 font-medium cursor-pointer"
                                        title="Edit staff member"
                                        aria-label="Edit staff member"
                                        data-testid={`edit-staff-${u.id}`}
                                    >
                                        <Pencil className="w-3 h-3" />
                                        <span>Edit</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleGenerateTempPassword(u)}
                                        disabled={generatingTempPasswordFor === u.id}
                                        className="px-2.5 py-1 text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200/60 rounded-lg transition-colors flex items-center gap-1 font-medium cursor-pointer disabled:opacity-50"
                                        title="Generate Temporary Password"
                                        aria-label="Reset Password"
                                    >
                                        <KeyRound className="w-3 h-3" />
                                        <span>{generatingTempPasswordFor === u.id ? "Resetting..." : "Reset Password"}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyLoginLink(u)}
                                        className="px-2.5 py-1 text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Copy Login Link"
                                        aria-label="Copy Link"
                                    >
                                        <Copy className="w-3 h-3" />
                                        <span>Copy Link</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => shareWhatsApp(u)}
                                        className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Share on WhatsApp"
                                        aria-label="WhatsApp"
                                    >
                                        <Send className="w-3 h-3" />
                                        <span>WhatsApp</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium pt-1">
                                    <Lock className="w-3 h-3 text-neutral-400 shrink-0" />
                                    <span>Password must be entered separately at login (never shared via link).</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Existing Phase 2 Edit Workflow Modal */}
            {editingStaff && (
                <StaffEditModal
                    isOpen={Boolean(editingStaff)}
                    onClose={() => setEditingStaff(null)}
                    staffUser={editingStaff}
                    restaurantId={effectiveRestaurantId}
                    onSaved={async () => {
                        const savedId = editingStaff?.id;
                        setEditingStaff(null);
                        if (savedId) {
                            setLoginLinks((prev) => {
                                const next = { ...prev };
                                delete next[savedId];
                                return next;
                            });
                            setTemporaryPasswords((prev) => {
                                const next = { ...prev };
                                delete next[savedId];
                                return next;
                            });
                        }
                        await loadStaff();
                    }}
                />
            )}

            {/* One-Time Temporary Password Modal */}
            {temporaryPasswordModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-2xl border border-orange-200 bg-white p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                                <KeyRound className="w-4 h-4 text-orange-600" />
                                Temporary Password Created
                            </h4>
                            <button
                                type="button"
                                onClick={() => setTemporaryPasswordModal(null)}
                                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs text-neutral-600 leading-relaxed">
                            A secure temporary password was created for{" "}
                            <strong className="text-neutral-900">{temporaryPasswordModal.name}</strong> (
                            {temporaryPasswordModal.email}).
                        </p>

                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                                Temporary Password
                            </label>
                            <div className="flex items-center justify-between gap-2">
                                <code className="font-mono text-xs font-bold text-orange-600 tracking-wide select-all">
                                    {temporaryPasswordModal.temporaryPassword}
                                </code>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(temporaryPasswordModal.temporaryPassword);
                                            setCopiedPassword(true);
                                            setTimeout(() => setCopiedPassword(false), 2000);
                                            showToast("Temporary password copied to clipboard!", "success");
                                        } catch {
                                            showToast("Clipboard access denied.", "error");
                                        }
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition cursor-pointer"
                                >
                                    {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
                                    <span>{copiedPassword ? "Copied" : "Copy"}</span>
                                </button>
                            </div>
                        </div>

                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                            <span>
                                <strong>Notice:</strong> This password is only shown once and cannot be retrieved later. Share it securely with the staff member.
                            </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    const link = temporaryPasswordModal.loginLink || `${window.location.origin}/login?mode=staff&email=${encodeURIComponent(temporaryPasswordModal.email)}`;
                                    const text = `Hi ${temporaryPasswordModal.name},\nHere is your Tiffzy login credential:\n• Login URL: ${link}\n• Temporary Password: ${temporaryPasswordModal.temporaryPassword}\n\nPlease log in and update your password immediately.`;
                                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>Share via WhatsApp</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTemporaryPasswordModal(null)}
                                className="rounded-xl bg-orange-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
