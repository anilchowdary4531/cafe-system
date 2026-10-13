import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Mail, Phone, Save, UserCircle2, X } from "lucide-react";
import { showToast } from "../../../utils/toast";
import { getCustomerProfileExtras, setCustomerProfileExtras } from "../../../utils/customerProfileExtras";

const MAX_AVATAR_FILE_BYTES = 30 * 1024 * 1024;
const MAX_AVATAR_STORED_BYTES = 1.5 * 1024 * 1024;
const AVATAR_MAX_DIMENSION = 1200;

const dataUrlByteSize = (dataUrl) => {
    const raw = String(dataUrl || "");
    const idx = raw.indexOf(",");
    if (idx < 0) return 0;
    const base64 = raw.slice(idx + 1);
    const padding = (base64.match(/=+$/) || [""])[0].length;
    return Math.floor((base64.length * 3) / 4) - padding;
};

const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read_failed"));
        reader.readAsDataURL(file);
    });

const loadImage = (dataUrl) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("image_load_failed"));
        img.src = dataUrl;
    });

const compressAvatarDataUrl = async (sourceDataUrl) => {
    const img = await loadImage(sourceDataUrl);
    const maxSide = Math.max(Number(img.width || 0), Number(img.height || 0), 1);
    const baseScale = Math.min(1, AVATAR_MAX_DIMENSION / maxSide);

    let width = Math.max(1, Math.round((img.width || 1) * baseScale));
    let height = Math.max(1, Math.round((img.height || 1) * baseScale));
    let quality = 0.9;
    let best = sourceDataUrl;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return sourceDataUrl;

    for (let attempt = 0; attempt < 8; attempt += 1) {
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const next = canvas.toDataURL("image/jpeg", quality);
        best = next;
        if (dataUrlByteSize(next) <= MAX_AVATAR_STORED_BYTES) {
            return next;
        }

        quality = Math.max(0.38, quality - 0.1);
        width = Math.max(320, Math.round(width * 0.88));
        height = Math.max(320, Math.round(height * 0.88));
    }

    return best;
};

export default function EditProfileSection({ profile, loading, saving, error, updateProfile, setError }) {
    const fileRef = useRef(null);
    const phone = String(profile?.phone || "").trim();
    const extras = useMemo(() => getCustomerProfileExtras(phone), [phone]);

    const [name, setName] = useState(() => String(profile?.name || "").trim());
    const [email, setEmail] = useState(() => String(profile?.email || "").trim());
    const [nickname, setNickname] = useState(() => String(extras.nickname || "").trim());
    const [avatarDataUrl, setAvatarDataUrl] = useState(() => String(extras.avatarDataUrl || "").trim());
    const [localError, setLocalError] = useState("");

    const persistExtras = (nextPatch = {}) => {
        if (!phone) return;
        setCustomerProfileExtras(phone, {
            nickname,
            avatarDataUrl,
            ...nextPatch,
        });
    };

    useEffect(() => {
        setName(String(profile?.name || "").trim());
        setEmail(String(profile?.email || "").trim());
    }, [profile?.email, profile?.name]);

    useEffect(() => {
        setNickname(String(extras.nickname || "").trim());
        setAvatarDataUrl(String(profile?.avatarUrl || extras.avatarDataUrl || "").trim());
    }, [extras.avatarDataUrl, extras.nickname, profile?.avatarUrl, phone]);

    const onPickAvatar = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_AVATAR_FILE_BYTES) {
            setLocalError("Profile photo must be under 30 MB.");
            return;
        }

        try {
            const rawDataUrl = await readFileAsDataUrl(file);
            const dataUrl = await compressAvatarDataUrl(rawDataUrl);
            setLocalError("");
            const nextAvatar = String(dataUrl || "");
            setAvatarDataUrl(nextAvatar);
            persistExtras({ avatarDataUrl: nextAvatar });
            await updateProfile({ name, email, avatarUrl: nextAvatar });
        } catch {
            setLocalError("Could not read image. Please try another file.");
        } finally {
            event.target.value = "";
        }
    };

    const saveProfile = async () => {
        setLocalError("");
        setError("");
        try {
            await updateProfile({ name, email, avatarUrl: avatarDataUrl });
            if (phone) {
                setCustomerProfileExtras(phone, { nickname, avatarDataUrl });
            }
            showToast({ title: "Saved", message: "Profile details updated.", variant: "success" });
        } catch {
            // hook sets error
        }
    };

    return (
        <div className="w-full space-y-5 text-left">
            <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">
                    PROFILE
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[color:var(--app-text)]">
                    Edit profile
                </h1>
                <p className="theme-muted text-xs sm:text-sm">
                    Update profile photo, name, phone, email, and nickname.
                </p>
            </div>

            {(error || localError) && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-500">
                    {error || localError}
                </div>
            )}

            <section className="rounded-xl border border-[color:var(--app-border)]/40 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 space-y-6">
                {/* Profile photo section */}
                <div className="flex items-center gap-4 pb-5 border-b border-[color:var(--app-border)]/30">
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-orange-500/25 bg-orange-500/10 text-[var(--app-primary)] shrink-0">
                        {avatarDataUrl ? (
                            <img src={avatarDataUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center">
                                <UserCircle2 size={32} />
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">Profile photo</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-orange-500/10 hover:text-[var(--app-primary)] transition-all dark:bg-slate-800"
                            >
                                <Camera size={13} />
                                Upload
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    setAvatarDataUrl("");
                                    persistExtras({ avatarDataUrl: "" });
                                    await updateProfile({ name, email, avatarUrl: "" });
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-red-500/10 hover:text-red-500 transition-all dark:bg-slate-800"
                            >
                                <X size={13} />
                                Remove
                            </button>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={onPickAvatar}
                                className="hidden"
                            />
                        </div>
                    </div>
                </div>

                {/* Form fields in clean 2-column desktop layout */}
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="theme-muted mb-1 block text-xs font-semibold">Name</label>
                        <div className="relative">
                            <UserCircle2 size={16} className="theme-muted absolute left-3 top-3" />
                            <input
                                value={name}
                                onChange={(e) => {
                                    setError("");
                                    setName(e.target.value);
                                }}
                                className="w-full rounded-lg border border-[color:var(--app-border)]/40 bg-transparent pl-9 pr-3.5 py-2.5 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[var(--app-primary)] focus:ring-1 focus:ring-[var(--app-primary)]"
                                placeholder="Your name"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="theme-muted mb-1 block text-xs font-semibold">Nick name</label>
                        <input
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="w-full rounded-lg border border-[color:var(--app-border)]/40 bg-transparent px-3.5 py-2.5 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[var(--app-primary)] focus:ring-1 focus:ring-[var(--app-primary)]"
                            placeholder="How friends call you"
                        />
                    </div>

                    <div>
                        <label className="theme-muted mb-1 block text-xs font-semibold">Email</label>
                        <div className="relative">
                            <Mail size={16} className="theme-muted absolute left-3 top-3" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setError("");
                                    setEmail(e.target.value);
                                }}
                                className="w-full rounded-lg border border-[color:var(--app-border)]/40 bg-transparent pl-9 pr-3.5 py-2.5 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[var(--app-primary)] focus:ring-1 focus:ring-[var(--app-primary)]"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="theme-muted mb-1 block text-xs font-semibold">Phone number</label>
                        <div className="relative">
                            <Phone size={16} className="theme-muted absolute left-3 top-3" />
                            <input
                                value={phone}
                                readOnly
                                className="w-full cursor-not-allowed rounded-lg border border-[color:var(--app-border)]/30 bg-black/[0.03] pl-9 pr-3.5 py-2.5 text-sm text-[color:var(--app-text)] outline-none opacity-70 dark:bg-white/[0.03]"
                            />
                        </div>
                    </div>
                </div>

                {/* Save Profile button aligned to the right */}
                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={saveProfile}
                        disabled={saving || loading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Save size={14} />
                        {saving ? "Saving..." : "Save Profile"}
                    </button>
                </div>
            </section>
        </div>
    );
}
