import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../utils/apiClient";
import { showToast } from "../../../utils/toast";
import { IndianRupee, ArrowRight, ShieldCheck } from "lucide-react";

const toInr = (val) => {
  const n = Number(val || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export default function PayLaterSection() {
  const [searchParams] = useSearchParams();
  const forceCustomerMode = searchParams.get("scope") === "customer";
  const buildProfilePath = (path) => (forceCustomerMode ? `${path}?scope=customer` : path);

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const res = await api.get("/customer/pay-later/accounts");
        setAccounts(res.data?.accounts || []);
      } catch (err) {
        showToast({
          title: "Error",
          message: err.response?.data?.message || "Failed to load credit accounts",
          variant: "error"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  if (loading) {
    return <div className="py-12 text-center theme-muted">Loading your credit summaries...</div>;
  }

  return (
    <div className="space-y-6">
      <header className="theme-panel rounded-[32px] p-6 text-left">
        <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Khata Balances</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Pay Later Accounts</h1>
        <p className="theme-muted mt-2 text-sm leading-relaxed max-w-xl">
          Track your outstanding balances across approved dining partners. Repay pending dues safely using any online payment mode.
        </p>
      </header>

      {accounts.length === 0 ? (
        <div className="theme-panel rounded-[32px] p-10 text-center">
          <p className="text-base font-semibold">No credit accounts found</p>
          <p className="theme-muted mt-1.5 text-xs">
            Pay Later is only available at restaurants where the owner has approved your phone number.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/10 rounded-[28px] border border-white/5 bg-black/10 overflow-hidden">
          {accounts.map((acc) => (
            <Link
              key={acc.accountId}
              to={buildProfilePath(`/profile/pay-later/${acc.accountId}`)}
              className="group flex items-center justify-between p-5 hover:bg-white/5 transition duration-150 text-left"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base truncate group-hover:text-[color:var(--app-primary)] transition">
                  {acc.restaurantName}
                </h3>
                <div className="mt-1 flex items-center gap-4 text-xs">
                  <p className="theme-muted">
                    Borrowed: <span className="font-semibold text-white/70">₹{toInr(acc.totalBorrowed)}</span>
                  </p>
                  <span className="text-white/20">•</span>
                  <p className="theme-muted">
                    Total Paid: <span className="font-semibold text-white/70">₹{toInr(acc.totalPaid || 0)}</span>
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 ml-4 flex items-center gap-4">
                <div>
                  <p className="theme-muted text-[9px] font-extrabold uppercase tracking-wider">Pending Due</p>
                  <p className={`text-[15px] font-extrabold mt-0.5 ${acc.pendingBalance > 0 ? "text-amber-200" : "text-white/40"}`}>
                    ₹{toInr(acc.pendingBalance)}
                  </p>
                </div>
                <div className="theme-soft-button flex h-8 w-8 items-center justify-center rounded-xl group-hover:bg-[color:var(--app-primary)] group-hover:text-black transition">
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
