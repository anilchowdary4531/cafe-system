import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { API } from "../config";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, AlertCircle, Loader2, ArrowRight } from "lucide-react";

export default function StaffLoginLink() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();

    const [status, setStatus] = useState("verifying"); // 'verifying' | 'success' | 'error'
    const [errorMessage, setErrorMessage] = useState("");
    const executedRef = useRef(false);

    useEffect(() => {
        if (executedRef.current) return;
        executedRef.current = true;

        const token = searchParams.get("token");

        // Immediately remove raw token from browser URL and history
        if (typeof window !== "undefined") {
            try {
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch {
                // ignore
            }
        }

        if (!token) {
            setStatus("error");
            setErrorMessage("No login token provided. Please ask your restaurant owner for a fresh staff login link.");
            return;
        }

        const verifyToken = async () => {
            try {
                const res = await axios.post(`${API}/auth/staff-login-link`, { token });
                const data = res.data;

                if (data?.token && data?.user) {
                    // Authenticate staff session (creates normal session without storing raw token)
                    login(data);
                    setStatus("success");

                    const destination = data.redirectPath || (
                        data.user.role === "CHEF"
                            ? "/kitchen"
                            : ["OWNER", "MANAGER", "SUPER_ADMIN"].includes(data.user.role)
                            ? "/owner/staff"
                            : "/server"
                    );

                    setTimeout(() => {
                        navigate(destination, { replace: true });
                    }, 400);
                } else {
                    setStatus("error");
                    setErrorMessage("Authentication succeeded but failed to receive session credentials.");
                }
            } catch (err) {
                setStatus("error");
                const status = err?.response?.status;
                const serverMsg = err?.response?.data?.message;
                if (serverMsg) {
                    setErrorMessage(serverMsg);
                } else if (status === 403) {
                    setErrorMessage("This staff account is inactive.");
                } else {
                    setErrorMessage("Invalid staff login link.");
                }
            }
        };

        verifyToken();
    }, [searchParams, navigate, login]);

    return (
        <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-8 shadow-2xl text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/30">
                    {status === "verifying" && <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />}
                    {status === "success" && <ShieldCheck className="h-8 w-8 text-emerald-400" />}
                    {status === "error" && <AlertCircle className="h-8 w-8 text-red-400" />}
                </div>

                {status === "verifying" && (
                    <>
                        <h2 className="text-xl font-bold tracking-tight">Authenticating Staff...</h2>
                        <p className="mt-2 text-sm text-gray-400">
                            Verifying your one-time secure staff login link. Please wait.
                        </p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <h2 className="text-xl font-bold tracking-tight text-emerald-400">Login Successful!</h2>
                        <p className="mt-2 text-sm text-gray-300">
                            Redirecting to your workstation...
                        </p>
                    </>
                )}

                {status === "error" && (
                    <>
                        <h2 className="text-xl font-bold tracking-tight text-red-400">Login Link Invalid</h2>
                        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 text-left">
                            {errorMessage}
                        </div>
                        <div className="mt-6 flex flex-col gap-3">
                            <Link
                                to="/login?mode=staff"
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
                            >
                                <span>Go to Staff Login</span>
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
