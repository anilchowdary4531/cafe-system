import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
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
  History,
  Calendar,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { api } from "../utils/apiClient";
import { showToast } from "../utils/toast";

export default function KitchenChefDetail() {
  const { chefId } = useParams();
  const { user } = useAuth();
  const { socket } = useStaffSocket();
  const navigate = useNavigate();
  const location = useLocation();

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

  // View Mode: "QUEUE" | "HISTORY"
  const isHistoryPath = location.pathname.includes("/history") || new URLSearchParams(location.search).get("tab") === "history";
  const [viewMode, setViewMode] = useState(isHistoryPath ? "HISTORY" : "QUEUE");

  // Keep viewMode synced if URL changes
  useEffect(() => {
    if (location.pathname.includes("/history") || new URLSearchParams(location.search).get("tab") === "history") {
      setViewMode("HISTORY");
    } else {
      setViewMode("QUEUE");
    }
  }, [location.pathname, location.search]);

  // Queue State
  const [assignedItems, setAssignedItems] = useState([]);
  const [availableWork, setAvailableWork] = useState({ mode: "DISPATCHER", scope: "ITEMS", availableItems: [], availableKots: [] });
  const [kitchenConfig, setKitchenConfig] = useState({ mode: "DISPATCHER", scope: "ITEMS" });
  const [chefInfo, setChefInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // History State
  const [historyItems, setHistoryItems] = useState([]);
  const [groupedHistory, setGroupedHistory] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 20, totalCount: 0, totalPages: 1, hasMore: false });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyDateRange, setHistoryDateRange] = useState("today");
  const [customDate, setCustomDate] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historySearchInput, setHistorySearchInput] = useState("");
  const searchTimeoutRef = useRef(null);

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

  // Fetch Chef History Data
  const loadHistoryData = useCallback(async (pageToLoad = 1, silent = false) => {
    if (pageToLoad === 1 && !silent) {
      setLoadingHistory(true);
    } else if (pageToLoad > 1) {
      setLoadingMoreHistory(true);
    }
    if (pageToLoad === 1) {
      setHistoryError("");
    }

    try {
      const params = {
        page: pageToLoad,
        limit: 20,
        range: historyDateRange,
      };

      if (historyDateRange === "custom" && customDate) {
        params.date = customDate;
      }

      if (historySearch.trim()) {
        params.search = historySearch.trim();
      }

      const res = await api.get(`/owner/${restaurantId}/kitchen/chef/${chefId}/history`, { params });
      if (res.data?.ok || res.data?.success) {
        const fetchedItems = res.data.items || res.data.history || [];
        const fetchedGrouped = res.data.groupedByDate || [];
        const pagination = res.data.pagination || {
          page: 1,
          limit: 20,
          totalCount: res.data.total ?? fetchedItems.length,
          totalPages: 1,
          hasMore: false,
        };

        if (pageToLoad === 1) {
          setHistoryItems(fetchedItems);
          setGroupedHistory(fetchedGrouped);
        } else {
          setHistoryItems((prev) => {
            const existingIds = new Set(prev.map((p) => p.orderItemId || p.id));
            const newUnique = fetchedItems.filter((it) => !existingIds.has(it.orderItemId || it.id));
            return [...prev, ...newUnique];
          });

          setGroupedHistory((prevGrouped) => {
            const groupMap = new Map();
            for (const g of prevGrouped) {
              groupMap.set(g.dateKey, {
                dateKey: g.dateKey,
                dateHeading: g.dateHeading,
                items: [...g.items],
              });
            }
            for (const it of fetchedItems) {
              if (!groupMap.has(it.dateKey)) {
                groupMap.set(it.dateKey, {
                  dateKey: it.dateKey,
                  dateHeading: it.dateHeading,
                  items: [],
                });
              }
              const target = groupMap.get(it.dateKey);
              if (!target.items.some((x) => (x.orderItemId || x.id) === (it.orderItemId || it.id))) {
                target.items.push(it);
              }
            }
            return Array.from(groupMap.values());
          });
        }

        setHistoryPagination(pagination);
        setHistoryError("");
      }
    } catch (err) {
      console.error("[KitchenChefDetail] Load history error:", err);
      const errStatus = err.response?.status;
      const errMsg = err.response?.data?.message || err?.message || "Failed to load chef history";
      if (errStatus === 403) {
        setErrorMsg("Access denied. You can only access your own history.");
        setHistoryError("Access denied. You can only access your own history.");
      } else {
        setHistoryError(errMsg);
        if (!silent) {
          showToast(errMsg, "error");
        }
      }
    } finally {
      setLoadingHistory(false);
      setLoadingMoreHistory(false);
    }
  }, [restaurantId, chefId, historyDateRange, customDate, historySearch]);

  // Initial Data Load
  useEffect(() => {
    if (isAuthorized) {
      loadStationData();
      loadHistoryData(1);
    }
  }, [loadStationData, loadHistoryData, isAuthorized]);

  // Realtime Sync via Socket.IO
  useEffect(() => {
    if (!socket || !isAuthorized) return;

    const handleKitchenUpdate = () => {
      loadStationData(true);
      loadHistoryData(1, true);
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
  }, [socket, isAuthorized, loadStationData, loadHistoryData]);

  // Search input debouncer
  const handleSearchChange = (val) => {
    setHistorySearchInput(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setHistorySearch(val);
    }, 350);
  };

  const handleClearSearch = () => {
    setHistorySearchInput("");
    setHistorySearch("");
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  };

  const handleDateFilterChange = (rangeId) => {
    setHistoryDateRange(rangeId);
  };

  const handleCustomDateChange = (val) => {
    setCustomDate(val);
  };

  const handleLoadMoreHistory = () => {
    if (historyPagination.hasMore && !loadingMoreHistory) {
      loadHistoryData(historyPagination.page + 1);
    }
  };

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
      await loadHistoryData(1, true);
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
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-700 dark:text-red-300 font-mono mb-4 text-left">
            <div>Target Station: #{chefId}</div>
            <div>Authenticated User: #{user?.id} ({user?.name || "Staff"})</div>
            <div>Role: {user?.role} • {user?.designation || "Staff"}</div>
          </div>
          <div className="flex gap-2 justify-center">
            {user?.id && (
              <Link
                to={`/kitchen/chef/${user.id}`}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                Go to My Station (#{user.id})
              </Link>
            )}
            <Link
              to="/"
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Back to Home
            </Link>
          </div>
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
                {viewMode === "HISTORY" ? (
                  <span>Chef History • Completed Items • Station #{chefId}</span>
                ) : (
                  <span>My Preparation Queue • {chefInfo?.designation || "Kitchen Line"} • Active Work: <strong>{activeItems.length} items</strong></span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadStationData(false);
                loadHistoryData(1, false);
              }}
              disabled={loading || loadingHistory}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs"
            >
              <RefreshCw size={13} className={loading || loadingHistory ? "animate-spin text-orange-500" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* WORKSPACE NAVIGATION TABS (MY ASSIGNED ITEMS vs HISTORY) */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button
            type="button"
            data-testid="tab-assigned-items"
            onClick={() => {
              setViewMode("QUEUE");
              navigate(`/kitchen/chef/${chefId}`);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              viewMode === "QUEUE"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <UtensilsCrossed size={14} />
            <span>MY ASSIGNED ITEMS</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                viewMode === "QUEUE"
                  ? "bg-orange-500 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {assignedItems.length}
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-chef-history"
            onClick={() => {
              setViewMode("HISTORY");
              navigate(`/kitchen/chef/${chefId}/history`);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              viewMode === "HISTORY"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <History size={14} />
            <span>HISTORY</span>
            {historyPagination.totalCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  viewMode === "HISTORY"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {historyPagination.totalCount}
              </span>
            )}
          </button>
        </div>

        {/* ========================================================= */}
        {/* VIEW 1: MY ASSIGNED ITEMS QUEUE */}
        {/* ========================================================= */}
        {viewMode === "QUEUE" && (
          <div className="space-y-6">
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
                    { id: "ALL", label: `All (${assignedItems.length})` },
                    { id: "PENDING", label: `Pending (${pendingItems.length})` },
                    { id: "PREPARING", label: `Preparing (${prepItems.length})` },
                    { id: "READY", label: `Ready (${readyItems.length})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1 rounded-md transition ${
                        statusFilter === tab.id
                          ? "bg-orange-500 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Grid */}
              {loading && !assignedItems.length ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
                  <RefreshCw size={24} className="animate-spin text-orange-500 mx-auto mb-3" />
                  Loading assigned items...
                </div>
              ) : !displayedItems.length ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Inbox size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    No items in this queue
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    {statusFilter === "ALL"
                      ? "You currently have no items assigned. Pick from the available queue below if self-pick is enabled."
                      : `No items currently matching the ${statusFilter} filter.`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        {/* Top KOT and Table row */}
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              #{item.kotNumber || item.kotId}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                              Table: {item.tableNo || "N/A"}
                            </span>
                            {item.priority === "URGENT" && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                URGENT
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              item.status === "READY"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                : item.status === "PREPARING"
                                ? "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 animate-pulse"
                                : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        {/* Item Name and Quantity */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {item.name}
                          </div>
                          <span className="text-xs font-black px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 shrink-0">
                            {item.quantity}x
                          </span>
                        </div>

                        {/* Variant / Modifiers / Notes */}
                        {item.variant && (
                          <div className="text-[11px] text-slate-500 mb-1">Variant: {item.variant}</div>
                        )}
                        {item.notes && (
                          <div className="text-[11px] italic text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded px-2 py-1 mb-2">
                            Note: {item.notes}
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 mb-3 flex items-center justify-between">
                          <span>Waiting: {item.elapsedMinutes || 0}m</span>
                          <span>{item.assignmentSource === "SELF_PICKED" ? "Self-Picked" : "Dispatched"}</span>
                        </div>
                      </div>

                      {/* Lifecycle Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        {item.status === "PENDING" || item.status === "ACCEPTED" ? (
                          <button
                            type="button"
                            onClick={() => handleStartPreparing(item)}
                            disabled={Boolean(actionInProgress[item.id])}
                            className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <Play size={14} />
                            START PREPARING
                          </button>
                        ) : item.status === "PREPARING" ? (
                          <button
                            type="button"
                            onClick={() => handleMarkReady(item)}
                            disabled={Boolean(actionInProgress[item.id])}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <CheckCircle2 size={14} />
                            MARK READY
                          </button>
                        ) : item.status === "READY" ? (
                          <div className="py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-900/60">
                            <CheckCircle2 size={14} />
                            Ready for Waiter Pickup
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
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
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: CHEF HISTORY (DATE-WISE COMPLETED ITEMS) */}
        {/* ========================================================= */}
        {viewMode === "HISTORY" && (
          <div className="space-y-6" data-testid="chef-history-container">
            {/* History Header & Summary Banner */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <History className="text-emerald-600 dark:text-emerald-400" size={20} />
                    <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                      Chef History
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Completed Items
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Authoritative preparation records for <strong>{chefInfo?.name || "Chef"}</strong> (Station #{chefId}). Grouped by calendar date with completion timestamps.
                  </p>
                </div>

                {/* Lifetime/Total summary badge */}
                <div className="flex items-center gap-3">
                  <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Completed</div>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {historyError ? "—" : historyPagination.totalCount}
                    </div>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Showing</div>
                    <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {historyError ? 0 : historyItems.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters Bar: Date Presets, Custom Date, and Search */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Date Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "today", label: "Today" },
                    { id: "yesterday", label: "Yesterday" },
                    { id: "7d", label: "Last 7 Days" },
                    { id: "all", label: "All Time" },
                    { id: "custom", label: "Custom Date" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      data-testid={`filter-${filter.id}`}
                      onClick={() => handleDateFilterChange(filter.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        historyDateRange === filter.id
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}

                  {historyDateRange === "custom" && (
                    <input
                      type="date"
                      data-testid="custom-date-input"
                      value={customDate}
                      onChange={(e) => handleCustomDateChange(e.target.value)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  )}
                </div>

                {/* Search Input */}
                <div className="relative w-full md:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    data-testid="history-search-input"
                    placeholder="Search item, KOT #, or table..."
                    value={historySearchInput}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                  {historySearchInput && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Date-wise Grouped History Display */}
            {loadingHistory && !historyItems.length ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
                <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto mb-3" />
                Loading history...
              </div>
            ) : historyError && !historyItems.length ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/40 p-12 text-center shadow-xs">
                <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle size={28} />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1">
                  Unable to load history.
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                  {historyError}
                </p>
                <button
                  type="button"
                  onClick={() => loadHistoryData(1, false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : groupedHistory.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Inbox size={28} />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1">
                  {historySearch.trim()
                    ? `No completed items found matching "${historySearch}"`
                    : historyDateRange === "today"
                    ? "No completed items for this date."
                    : historyDateRange === "yesterday"
                    ? "No completed items for this date."
                    : historyDateRange === "custom"
                    ? "No completed items for this date."
                    : "No completed items yet."}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {historySearch.trim()
                    ? "Try adjusting your search terms or date filter."
                    : "When you mark assigned preparation items as READY, they will be archived here with exact completion timestamps."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedHistory.map((group) => (
                  <div key={group.dateKey} className="space-y-3" data-testid={`history-group-${group.dateKey}`}>
                    {/* Group Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          {group.dateHeading}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {group.items.length} {group.items.length === 1 ? "item" : "items"}
                      </span>
                    </div>

                    {/* Group Items Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.items.map((item) => (
                        <div
                          key={item.orderItemId ? `chef-history-orderItem-${item.orderItemId}` : `chef-history-item-${item.id}`}
                          data-testid={`history-item-${item.id}`}
                          data-kot-id={item.kotId}
                          data-order-item-id={item.orderItemId}
                          data-kot-item-id={item.kotItemId || item.id}
                          data-menu-item-id={item.menuItemId}
                          data-order-id={item.orderId}
                          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between transition hover:border-slate-300 dark:hover:border-slate-700"
                        >
                          <div>
                            {/* Card Top Row: KOT #, Table, Priority, Completed Badge */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                  #{item.kotNumber || item.kotId}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {item.tableNo}
                                </span>
                                {item.priority === "URGENT" || item.priority === "HIGH" ? (
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                    {item.priority}
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 size={11} />
                                COMPLETED
                              </span>
                            </div>

                            {/* Item Name and Quantity */}
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                {item.name}
                              </div>
                              <span className="text-xs font-black px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shrink-0 border border-orange-200/50 dark:border-orange-900/40">
                                {item.quantity}x
                              </span>
                            </div>

                            {/* Variant / Modifiers / Notes */}
                            {item.variantName && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                                Variant: {item.variantName}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-[11px] italic text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded px-2 py-1 mb-2 border border-amber-200/50 dark:border-amber-900/40">
                                Note: {item.notes}
                              </div>
                            )}
                          </div>

                          {/* Card Footer: Authoritative Timestamps and Assignment Source */}
                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-emerald-600 dark:text-emerald-400" />
                              <span>Completed <strong>{item.completedTime}</strong></span>
                              {typeof item.prepTimeMinutes === "number" && (
                                <span className="text-[10px] text-slate-400">({item.prepTimeMinutes}m prep)</span>
                              )}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              {item.assignmentSource === "SELF_PICKED" ? "Self-Picked" : "Dispatched"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Pagination: Load More Button */}
                {historyPagination.hasMore && (
                  <div className="flex justify-center pt-4 pb-2">
                    <button
                      type="button"
                      data-testid="load-more-btn"
                      onClick={handleLoadMoreHistory}
                      disabled={loadingMoreHistory}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-md disabled:opacity-50"
                    >
                      {loadingMoreHistory ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Loading More...</span>
                        </>
                      ) : (
                        <span>
                          Load More Completed Items ({historyItems.length} of {historyPagination.totalCount})
                        </span>
                      )}
                    </button>
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
