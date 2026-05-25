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
        setAvatarDataUrl(String(extras.avatarDataUrl || "").trim());
    }, [extras.avatarDataUrl, extras.nickname, phone]);

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
            setAvatarDataUrl(String(dataUrl || ""));
            persistExtras({ avatarDataUrl: String(dataUrl || "") });
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
            await updateProfile({ name, email });
            if (phone) {
                setCustomerProfileExtras(phone, { nickname, avatarDataUrl });
            }
            showToast({ title: "Saved", message: "Profile details updated.", variant: "success" });
        } catch {
            // hook sets error
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2 px-1">
                <p className="theme-accent-text text-[11px] font-semibold uppercase tracking-[0.28em]">Profile</p>
                <h1 className="text-2xl font-bold tracking-tight md:text-[2rem]">Edit profile</h1>
                <p className="theme-muted text-xs md:text-sm">Update profile photo, name, phone, email, and nickname.</p>
            </div>

            {(error || localError) && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error || localError}
                </div>
            )}

            <section className="rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-black/20">
                            {avatarDataUrl ? (
                                <img src={avatarDataUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <UserCircle2 size={30} className="theme-muted" />
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-semibold">Profile photo</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="theme-soft-button inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                                >
                                    <Camera size={14} />
                                    Upload
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAvatarDataUrl("");
                                        persistExtras({ avatarDataUrl: "" });
                                    }}
                                    className="theme-soft-button inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                                >
                                    <X size={14} />
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

                    <button
                        type="button"
                        onClick={saveProfile}
                        disabled={saving || loading}
                        className="theme-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <Save size={15} />
                        {saving ? "Saving..." : "Save profile"}
                    </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div>
                        <label className="theme-muted mb-1 block text-xs">Name</label>
                        <div className="relative">
                            <UserCircle2 size={16} className="theme-muted absolute left-3 top-2.5" />
                            <input
                                value={name}
                                onChange={(e) => {
                                    setError("");
                                    setName(e.target.value);
                                }}
                                className="theme-input w-full rounded-xl px-9 py-2.5 text-sm outline-none"
                                placeholder="Your name"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="theme-muted mb-1 block text-xs">Nick name</label>
                        <input
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                            placeholder="How friends call you"
                        />
                    </div>

                    <div>
                        <label className="theme-muted mb-1 block text-xs">Email</label>
                        <div className="relative">
                            <Mail size={16} className="theme-muted absolute left-3 top-2.5" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setError("");
                                    setEmail(e.target.value);
                                }}
                                className="theme-input w-full rounded-xl px-9 py-2.5 text-sm outline-none"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="theme-muted mb-1 block text-xs">Phone number</label>
                        <div className="relative">
                            <Phone size={16} className="theme-muted absolute left-3 top-2.5" />
                            <input
                                value={phone}
                                readOnly
                                className="theme-input w-full cursor-not-allowed rounded-xl px-9 py-2.5 text-sm outline-none opacity-80"
                            />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
