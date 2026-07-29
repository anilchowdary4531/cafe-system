import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../utils/apiClient";
import { useAuth } from "../context/AuthContext";

export default function useCustomerProfile({ enabled = true } = {}) {
    const { customer, customerToken, updateCustomer } = useAuth();
    const [profile, setProfile] = useState(customer || null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const requestIdRef = useRef(0);
    const customerRef = useRef(customer || null);

    const refresh = useCallback(async () => {
        if (!enabled) return null;
        if (!customerToken) return null;

        const requestId = (requestIdRef.current += 1);
        setLoading(true);
        setError("");
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const slug = urlParams.get("slug") || "";
            const res = await api.get("/customer/profile", {
                params: slug ? { slug } : undefined
            });
            if (requestIdRef.current !== requestId) return null;
            const next = res.data?.customer || null;
            setProfile(next);
            if (next) {
                const prev = customerRef.current;
                const changed =
                    !prev ||
                    String(prev.phone || "") !== String(next.phone || "") ||
                    String(prev.name || "") !== String(next.name || "") ||
                    String(prev.email || "") !== String(next.email || "");
                if (changed) updateCustomer(next);
            }
            return next;
        } catch (err) {
            if (requestIdRef.current !== requestId) return null;
            setError(err.response?.data?.message || "Failed to load profile");
            return null;
        } finally {
            if (requestIdRef.current === requestId) setLoading(false);
        }
    }, [customerToken, enabled, updateCustomer]);

    useEffect(() => {
        customerRef.current = customer || null;
        setProfile(customer || null);
    }, [customer]);

    useEffect(() => {
        if (!enabled) return;
        refresh();
    }, [enabled, refresh]);

    const updateProfile = useCallback(
        async ({ name, email } = {}) => {
            if (!enabled) return null;
            if (!customerToken) {
                // No persisted token: update local state only (still keeps UI consistent).
                const local = {
                    ...(profile || customer || {}),
                    name: String(name ?? profile?.name ?? "").trim(),
                    email: String(email ?? profile?.email ?? "").trim(),
                };
                setProfile(local);
                updateCustomer(local);
                return local;
            }

            const currentPhone = String(profile?.phone || customer?.phone || "").trim();
            if (!currentPhone) throw new Error("Phone number is required");

            setSaving(true);
            setError("");
            try {
                const res = await api.put("/customer/profile", {
                    phone: currentPhone,
                    name: String(name || "").trim(),
                    email: String(email || "").trim(),
                });
                const next = res.data?.customer || null;
                if (next) {
                    setProfile(next);
                    updateCustomer(next);
                }
                return next;
            } catch (err) {
                setError(err.response?.data?.message || "Failed to update profile");
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [customer, customerToken, enabled, profile, updateCustomer]
    );

    return {
        profile,
        customerToken,
        loading,
        saving,
        error,
        refresh,
        updateProfile,
        setError,
    };
}
