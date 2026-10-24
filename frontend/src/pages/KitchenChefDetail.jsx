import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChefHat,
  Clock,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UtensilsCrossed,
  Sparkles,
  ShieldAlert,
  Inbox,
  Check,
  Play,
  Layers,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { api } from "../utils/apiClient";
import { showToast } from "../utils/toast";

export default function KitchenChefDetail() {
  const { chefId } = useParams();
  const { user } = useAuth();
  const { socket } = useStaffSocket();

  const restaurantId = Number(
    user?.restaurantId ||
    user?.restaurant?.id ||
    user?.restaurant_id ||
    localStorage.getItem("restaurantId") ||
    1
  );

  // Security Check: line chef can only access their own station
  const actorRole = String(user?.role || "").toUpperCase();
  const actorDesignation = String(user?.designation || "").toLowerCase();
  const isPrivileged =
    actorRole === "OWNER" ||
    actorRole === "MANAGER" ||
    actorRole === "SUPER_ADMIN" ||
    actorDesignation.includes("senior chef") ||
    actorDesignation.includes("head chef") ||
    actorDesignation.includes("executive chef");

  const isAuthorized = isPrivileged || Number(user?.id) === Number(chefId);

  // State
  const [assignedItems, setAssignedItems] = useState([]);
  const [availableWork, setAvailableWork] = useState({ mode: "DISPATCHER", scope: "ITEMS", availableItems: [], availableKots: [] });
  const [kitchenConfig, setKitchenConfig] = useState({ mode: "DISPATCHER", scope: "ITEMS" });
  const [chefInfo, setChefInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Fetch Chef Info, Config, Assigned Items and Available Work
  const loadStationData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErrorMsg("");

    try {
      // 1. Fetch Config
      const configRes = await api.get(`/owner/${restaurantId}/kitchen/config`);
      const cfg = configRes.data?.ok ? configRes.data : { mode: "DISPATCHER", scope: "ITEMS" };
      setKitchenConfig(cfg);

      // 2. Fetch Assigned Items for this Chef
      const assignedRes = await api.get(`/owner/${restaurantId}/kitchen/chef/${chefId}/assigned-items`);
      if (assignedRes.data?.ok) {
        setAssignedItems(assignedRes.data.items || []);
      }

      // 3. Fetch Available Work if SELF_PICK
      if (cfg.mode === "SELF_PICK") {
        const availRes = await api.get(`/owner/${restaurantId}/kitchen/available-work`);
        if (availRes.data?.ok) {
          setAvailableWork(availRes.data);
        }
      } else {
        setAvailableWork({ mode: "DISPATCHER", scope: cfg.scope, availableItems: [], availableKots: [] });
      }

      // 4. Fetch Chef metadata from staff list or user
      if (Number(user?.id) === Number(chefId)) {
        setChefInfo({
          id: user.id,
          name: user.name || "Chef",
          designation: user.designation || "Chef",
        });
      } else {
        try {
          const staffRes = await api.get(`/owner/${restaurantId}/staff`);
          const staffList = Array.isArray(staffRes.data?.staff) ? staffRes.data.staff : (Array.isArray(staffRes.data) ? staffRes.data : []);
          const target = staffList.find((s) => Number(s.id) === Number(chefId));
          if (target) {
            setChefInfo(target);
          } else {
            setChefInfo({ id: chefId, name: `Chef #${chefId}`, designation: "Chef" });
          }
        } catch {
          setChefInfo({ id: chefId, name: `Chef #${chefId}`, designation: "Chef" });
        }
      }
    } catch (err) {
      console.error("[KitchenChefDetail] Load station error:", err);
      if (err.response?.status === 403) {
        setErrorMsg("Access denied. You can only access your own station.");
      } else {
        setErrorMsg(err.response?.data?.message || err?.message || "Failed to load chef station.");
      }
    } finally {
      setLoading(false);
    }
  }, [restaurantId, chefId, user]);

  useEffect(() => {
    if (isAuthorized) {
      loadStationData();
    }
  }, [loadStationData, isAuthorized]);

  // Socket.IO Realtime Sync
  useEffect(() => {
    if (!socket || !isAuthorized) return;

    const handleKitchenUpdate = () => {
      loadStationData(true);
    };

    socket.on("kitchen:config_updated", handleKitchenUpdate);
    socket.on("kitchen:item_assigned", handleKitchenUpdate);
    socket.on("kitchen:item_reassigned", handleKitchenUpdate);
    socket.on("kitchen:item_self_picked", handleKitchenUpdate);
    socket.on("kitchen:item_status_updated", handleKitchenUpdate);
    socket.on("kot:item_updated", handleKitchenUpdate);
    socket.on("kot:status_updated", handleKitchenUpdate);

    return () => {
      socket.off("kitchen:config_updated", handleKitchenUpdate);
      socket.off("kitchen:item_assigned", handleKitchenUpdate);
      socket.off("kitchen:item_reassigned", handleKitchenUpdate);
      socket.off("kitchen:item_self_picked", handleKitchenUpdate);
      socket.off("kitchen:item_status_updated", handleKitchenUpdate);
      socket.off("kot:item_updated", handleKitchenUpdate);
      socket.off("kot:status_updated", handleKitchenUpdate);
    };
  }, [socket, isAuthorized, loadStationData]);

  // Lifecycle Action: START PREPARING
  const handleStartPreparing = async (item) => {
    setActionInProgress((prev) => ({ ...prev, [item.id]: true }));
    try {
      await api.put(`/owner/${restaurantId}/kitchen/items/${item.id}/status`, {
        status: "PREPARING",
      });
      showToast(`Started preparing: ${item.name}`, "success");
      await loadStationData(true);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update item", "error");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Lifecycle Action: MARK READY
  const handleMarkReady = async (item) => {
    setActionInProgress((prev) => ({ ...prev, [item.id]: true }));
    try {
      await api.put(`/owner/${restaurantId}/kitchen/items/${item.id}/status`, {
        status: "READY",
      });
      showToast(`Marked ready: ${item.name}`, "success");
      await loadStationData(true);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update item", "error");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Self-Pick Action: CLAIM ITEM
  const handleClaimItem = async (item) => {
    setActionInProgress((prev) => ({ ...prev, [`claim_item_${item.id}`]: true }));
    try {
      const res = await api.post(`/owner/${restaurantId}/kitchen/items/${item.id}/self-pick`);
      if (res.data?.ok) {
        showToast(`Claimed: ${item.name}`, "success");
        await loadStationData(true);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        showToast("This item was just claimed by another chef.", "warning");
      } else {
        showToast(err.response?.data?.message || "Failed to claim item", "error");
      }
      await loadStationData(true);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`claim_item_${item.id}`]: false }));
    }
  };

  // Self-Pick Action: CLAIM KOT
  const handleClaimKot = async (kot) => {
    setActionInProgress((prev) => ({ ...prev, [`claim_kot_${kot.id}`]: true }));
    try {
      const res = await api.post(`/owner/${restaurantId}/kitchen/kots/${kot.id}/self-pick`);
      if (res.data?.ok) {
        showToast(`Claimed KOT #${kot.kotNumber || kot.id} (${res.data.claimedCount} items)`, "success");
        await loadStationData(true);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        showToast("All items in this KOT are already claimed.", "warning");
      } else {
        showToast(err.response?.data?.message || "Failed to claim KOT", "error");
      }
      await loadStationData(true);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`claim_kot_${kot.id}`]: false }));
    }
  };

  // Access Denied screen if line chef attempts to access another chef's station
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/60 p-6 shadow-xl text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            Access Denied
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
            You can only access your own assigned chef station.
          </p>
          <Link
            to={user?.id ? `/kitchen/chef/${user.id}` : "/kitchen"}
            className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition"
          >
            Go to My Station
          </Link>
        </div>
      </div>
    );
  }

  // Active metrics
  const activeItems = assignedItems.filter((it) => it.status !== "READY" && it.status !== "CANCELLED");
  const pendingItems = assignedItems.filter((it) => it.status === "PENDING" || it.status === "ACCEPTED");
  const prepItems = assignedItems.filter((it) => it.status === "PREPARING");
  const readyItems = assignedItems.filter((it) => it.status === "READY");

  const displayedItems = useMemo(() => {
    if (statusFilter === "ALL") return assignedItems;
    if (statusFilter === "PENDING") {
      return assignedItems.filter((it) => it.status === "PENDING" || it.status === "ACCEPTED");
    }
    return assignedItems.filter((it) => it.status === statusFilter);
  }, [assignedItems, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isPrivileged && (
              <Link
                to="/kitchen"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Back to Senior Chef Command Center"
              >
                <ArrowLeft size={16} />
              </Link>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <ChefHat className="text-orange-500" size={20} />
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500 text-white shadow-xs">
                  CHEF STATION
                </span>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {chefInfo?.name || "Chef"}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Station #{chefId}
                </span>
                {kitchenConfig.mode === "SELF_PICK" && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
                    SELF-PICK ACTIVE ({kitchenConfig.scope})
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                My Preparation Queue • {chefInfo?.designation || "Kitchen Line"} • Active Work: <strong>{activeItems.length} items</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadStationData(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-orange-500" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs">
            <div className="text-[11px] text-slate-500 font-semibold mb-1">My Assigned Total</div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{assignedItems.length}</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs">
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mb-1 flex items-center gap-1">
              <Clock size={12} />
              My Pending
            </div>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{pendingItems.length}</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs">
            <div className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold mb-1 flex items-center gap-1">
              <Flame size={12} />
              My Preparing
            </div>
            <div className="text-xl font-extrabold text-orange-600 dark:text-orange-400">{prepItems.length}</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs">
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mb-1 flex items-center gap-1">
              <CheckCircle2 size={12} />
              My Ready
            </div>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{readyItems.length}</div>
          </div>
        </div>

        {/* SECTION 1: MY ASSIGNED ITEMS */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <ChefHat size={16} className="text-orange-500" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                My Assigned Items ({displayedItems.length})
              </h2>
            </div>

            {/* Filter Tabs */}
            <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold">
              {[
                { key: "ALL", label: `ALL (${assignedItems.length})` },
                { key: "PENDING", label: `PENDING (${pendingItems.length})` },
                { key: "PREPARING", label: `PREPARING (${prepItems.length})` },
                { key: "READY", label: `READY (${readyItems.length})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-md transition text-xs font-bold ${
                    statusFilter === tab.key
                      ? "bg-orange-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {displayedItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
              <UtensilsCrossed size={32} className="mx-auto mb-2 text-slate-400" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {statusFilter === "ALL" ? "No items currently assigned" : `No items in ${statusFilter} state`}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {kitchenConfig.mode === "SELF_PICK"
                  ? "Browse the Available Work queue below to claim items or KOTs."
                  : "Items dispatched by the Senior Chef will automatically appear here."}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedItems.map((item) => {
                const isBusy = Boolean(actionInProgress[item.id]);
                const isPrep = item.status === "PREPARING";
                const isReady = item.status === "READY";

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between transition ${
                      isReady
                        ? "border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10"
                        : isPrep
                        ? "border-orange-300 dark:border-orange-800/60 bg-orange-50/20 dark:bg-orange-950/10"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div>
                      {/* Top Bar with KOT and SLA */}
                      <div className="flex items-center justify-between text-xs mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="text-slate-900 dark:text-slate-100">KOT #{item.kotNumber || item.kotId}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 dark:text-slate-300">Table {item.tableNo || "N/A"}</span>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          item.priority === "URGENT" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                          item.priority === "HIGH" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {item.priority || "NORMAL"}
                        </span>
                      </div>

                      {/* Item Details */}
                      <div className="mb-3">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 rounded text-xs font-black">
                            {item.quantity}x
                          </span>
                          <span>{item.name}</span>
                        </div>

                        {item.variant && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Variant: <strong>{item.variant}</strong>
                          </div>
                        )}

                        {item.notes && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 italic bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded mt-1.5">
                            Special: {item.notes}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-2">
                          <span>Elapsed: {item.elapsedMinutes || 0}m</span>
                          <span>•</span>
                          <span>Source: {item.assignmentSource || "DISPATCHED"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      {isReady ? (
                        <div className="w-full py-2 bg-emerald-100/60 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
                          <Check size={14} />
                          READY FOR PICKUP
                        </div>
                      ) : isPrep ? (
                        <button
                          type="button"
                          onClick={() => handleMarkReady(item)}
                          disabled={isBusy}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <CheckCircle2 size={14} />
                          MARK READY
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartPreparing(item)}
                          disabled={isBusy}
                          className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Play size={14} />
                          START PREPARING
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: AVAILABLE WORK (SELF-PICK MODE ONLY) */}
        {kitchenConfig.mode === "SELF_PICK" && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-500" />
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Available Work to Claim (Self-Pick)
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                Scope: <strong>{kitchenConfig.scope}</strong>
              </span>
            </div>

            {/* Available KOTs */}
            {(kitchenConfig.scope === "KOTS" || kitchenConfig.scope === "BOTH") && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers size={14} className="text-emerald-500" />
                  Available KOTs ({availableWork.availableKots?.length || 0})
                </h3>

                {!availableWork.availableKots?.length ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                    No unassigned KOTs currently available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableWork.availableKots.map((k) => (
                      <div
                        key={k.id}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 p-4 shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              KOT #{k.kotNumber || k.id}
                            </span>
                            <span className="text-slate-500">Table: {k.tableNo || "N/A"}</span>
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 mb-3">
                            <div>Unassigned Items: <strong>{k.unassignedCount} of {k.totalItems}</strong></div>
                            <div className="text-[11px] text-slate-500">Waiting: {k.elapsedMinutes || 0}m</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleClaimKot(k)}
                          disabled={Boolean(actionInProgress[`claim_kot_${k.id}`])}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Check size={14} />
                          CLAIM ORDER ({k.unassignedCount} items)
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Available Items */}
            {(kitchenConfig.scope === "ITEMS" || kitchenConfig.scope === "BOTH") && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UtensilsCrossed size={14} className="text-emerald-500" />
                  Available Individual Items ({availableWork.availableItems?.length || 0})
                </h3>

                {!availableWork.availableItems?.length ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                    No unassigned items currently available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableWork.availableItems.map((it) => (
                      <div
                        key={it.id}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 p-4 shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              KOT #{it.kotNumber || it.kotId}
                            </span>
                            <span className="text-slate-500">Table: {it.tableNo || "N/A"}</span>
                          </div>

                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded text-xs font-black">
                              {it.quantity}x
                            </span>
                            <span>{it.name}</span>
                          </div>

                          {it.variant && (
                            <div className="text-[11px] text-slate-500 mb-1">Variant: {it.variant}</div>
                          )}

                          <div className="text-[10px] text-slate-400 mb-3">
                            Waiting: {it.elapsedMinutes || 0}m
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleClaimItem(it)}
                          disabled={Boolean(actionInProgress[`claim_item_${it.id}`])}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Check size={14} />
                          CLAIM ITEM
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
