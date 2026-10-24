import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  History,
  Inbox,
  RefreshCw,
  Search,
  UserCheck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { api } from "../utils/apiClient";
import { showToast } from "../utils/toast";

export default function ServerHistoryView({ onBackToFloorPlan, onBack, title }) {
  const handleBack = onBack || onBackToFloorPlan;
  const { user } = useAuth();
  const { socket } = useStaffSocket();

  const restaurantId = Number(
    user?.restaurantId ||
    user?.restaurant?.id ||
    user?.restaurant_id ||
    localStorage.getItem("restaurantId") ||
    localStorage.getItem("selectedRestaurantId") ||
    1
  );

  const serverId = user?.id || user?.userId;

  // History State
  const [historyItems, setHistoryItems] = useState([]);
  const [groupedHistory, setGroupedHistory] = useState([]);
  const [summary, setSummary] = useState({
    totalServedItems: 0,
    totalServedKots: 0,
    totalServedOrders: 0,
    totalServedTables: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 1,
    hasMore: false,
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dateRange, setDateRange] = useState("today");
  const [customDate, setCustomDate] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const searchDebounceRef = useRef(null);

  // Fetch History Data from Backend Source of Truth
  const loadHistory = useCallback(
    async (pageToLoad = 1, silent = false) => {
      if (pageToLoad === 1 && !silent) {
        setLoading(true);
      } else if (pageToLoad > 1) {
        setLoadingMore(true);
      }

      try {
        const params = {
          page: pageToLoad,
          limit: 20,
          range: dateRange,
        };

        if (serverId) {
          params.serverId = serverId;
        }

        if (dateRange === "custom" && customDate) {
          params.date = customDate;
        }

        if (activeSearch.trim()) {
          params.search = activeSearch.trim();
        }

        const res = await api.get(`/owner/${restaurantId}/server/history`, { params });
        if (res.data?.ok || res.data?.success) {
          const fetchedItems = res.data.items || [];
          const fetchedGrouped = res.data.groupedByDate || [];
          const fetchedSummary = res.data.summary || {
            totalServedItems: fetchedItems.length,
            totalServedKots: 0,
            totalServedOrders: 0,
            totalServedTables: 0,
          };
          const fetchedPagination = res.data.pagination || {
            page: 1,
            limit: 20,
            totalCount: fetchedItems.length,
            totalPages: 1,
            hasMore: false,
          };

          if (pageToLoad === 1) {
            setHistoryItems(fetchedItems);
            setGroupedHistory(fetchedGrouped);
          } else {
            setHistoryItems((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newUnique = fetchedItems.filter((it) => !existingIds.has(it.id));
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
                if (!target.items.some((x) => x.id === it.id)) {
                  target.items.push(it);
                }
              }
              return Array.from(groupMap.values());
            });
          }

          setSummary(fetchedSummary);
          setPagination(fetchedPagination);
        }
      } catch (err) {
        console.error("[ServerHistoryView] Load error:", err);
        if (err.response?.status === 403) {
          showToast({
            title: "Access Denied",
            message: "You can only view your own server history.",
            variant: "error",
          });
        } else {
          showToast({
            title: "Error",
            message: err.response?.data?.message || err.message || "Failed to load server history",
            variant: "error",
          });
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [restaurantId, serverId, dateRange, customDate, activeSearch]
  );

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  // Realtime update listener on canonical socket events
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeUpdate = () => {
      loadHistory(1, true);
    };

    socket.on("food:delivered", handleRealtimeUpdate);
    socket.on("kot:item_updated", handleRealtimeUpdate);
    socket.on("kitchen:item_status_updated", handleRealtimeUpdate);
    socket.on("kot:status_updated", handleRealtimeUpdate);
    socket.on("order:updated", handleRealtimeUpdate);
    socket.on("order:status_updated", handleRealtimeUpdate);

    return () => {
      socket.off("food:delivered", handleRealtimeUpdate);
      socket.off("kot:item_updated", handleRealtimeUpdate);
      socket.off("kitchen:item_status_updated", handleRealtimeUpdate);
      socket.off("kot:status_updated", handleRealtimeUpdate);
      socket.off("order:updated", handleRealtimeUpdate);
      socket.off("order:status_updated", handleRealtimeUpdate);
    };
  }, [socket, loadHistory]);

  // Handle Search Input Debouncing
  const handleSearchChange = (val) => {
    setSearchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setActiveSearch(val);
    }, 350);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveSearch("");
  };

  const handleDateFilterChange = (rangeId) => {
    setDateRange(rangeId);
    if (rangeId !== "custom") {
      setCustomDate("");
    }
  };

  const handleLoadMore = () => {
    if (!pagination.hasMore || loadingMore) return;
    loadHistory(pagination.page + 1);
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="server-history-container">
      {/* Top Banner & Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[color:var(--app-border)]/40 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {handleBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1.5 rounded-lg border border-[color:var(--app-border)]/40 text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition"
                  title="Back to Active Service"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <History className="text-orange-500" size={20} />
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                {title || "Server Food-Service History"}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Completed Food Service
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Authoritative records of food and beverages served to guest tables by{" "}
              <strong>{user?.name || "Server"}</strong>. Grouped by calendar date.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[color:var(--app-border)]/30 text-right">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Served</div>
              <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                {summary.totalServedItems || pagination.totalCount}
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[color:var(--app-border)]/30 text-right">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Tables Attended</div>
              <div className="text-base sm:text-lg font-black text-orange-600 dark:text-orange-400">
                {summary.totalServedTables}
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[color:var(--app-border)]/30 text-right">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Showing</div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                {historyItems.length}
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadHistory(1)}
              className="p-2.5 rounded-xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs cursor-pointer"
              title="Refresh History"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Filters Bar: Date Presets, Custom Date, and Search */}
        <div className="mt-4 pt-4 border-t border-[color:var(--app-border)]/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dateRange === filter.id
                    ? "bg-orange-500 text-white shadow-xs"
                    : "bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10"
                }`}
              >
                {filter.label}
              </button>
            ))}

            {dateRange === "custom" && (
              <input
                type="date"
                data-testid="custom-date-input"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              data-testid="history-search-input"
              placeholder="Search item, order #, KOT #, or table..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Date-wise Grouped Content */}
      {loading && !historyItems.length ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[color:var(--app-border)]/40 p-12 text-center text-xs text-slate-500 shadow-xs">
          <RefreshCw size={24} className="animate-spin text-orange-500 mx-auto mb-3" />
          Loading served food history...
        </div>
      ) : groupedHistory.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[color:var(--app-border)]/40 p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-black/5 dark:bg-white/5 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Inbox size={26} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
            {activeSearch.trim()
              ? `No completed items found matching "${activeSearch}"`
              : dateRange === "today"
              ? "No completed items for this date."
              : dateRange === "yesterday"
              ? "No completed items for this date."
              : dateRange === "custom"
              ? "No completed items for this date."
              : "No completed items yet."}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {activeSearch.trim()
              ? "Try adjusting your search query or switching date filters."
              : "When you mark items served/distributed from the Live Pass or table details, they will be archived here with exact timestamps."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedHistory.map((group, gIdx) => (
            <div key={group.dateKey || group.date || `group-${gIdx}`} className="space-y-3" data-testid={`history-group-${group.dateKey || group.date || gIdx}`}>
              {/* Group Date Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[color:var(--app-border)]/40">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-orange-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {group.dateHeading || group.displayDate || group.dateKey || group.date}
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  {group.items.length} {group.items.length === 1 ? "item" : "items"}
                </span>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.items.map((item) => (
                  <div
                    key={`server-history-item-${item.id}`}
                    data-testid={`history-item-${item.id}`}
                    data-kot-id={item.kotId}
                    data-order-item-id={item.orderItemId}
                    data-menu-item-id={item.menuItemId}
                    data-order-id={item.orderId}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-[color:var(--app-border)]/40 p-4 shadow-xs flex flex-col justify-between transition hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div>
                      {/* Top Row: KOT, Order, Table, Priority, SERVED Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-tight">
                            KOT #{item.kotNo || item.kotNumber || item.kotId}
                          </span>
                          {item.orderNo && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                              Order #{item.orderNo}
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-mono">
                            {item.tableNo}
                          </span>
                          {(item.priority === "URGENT" || item.priority === "HIGH") && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                              {item.priority}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          SERVED
                        </span>
                      </div>

                      {/* Item Name & Quantity */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {item.name}
                        </div>
                        <span className="text-xs font-black px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0 border border-orange-500/20 font-mono">
                          {item.quantity}x
                        </span>
                      </div>

                      {/* Variant and Notes if present */}
                      {(item.variantName || item.notes) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 space-y-0.5">
                          {item.variantName && (
                            <span className="inline-block px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold mr-1">
                              {item.variantName}
                            </span>
                          )}
                          {item.notes && <span className="italic">Note: {item.notes}</span>}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Timestamps, Chef, Server, Source */}
                    <div className="pt-2.5 mt-2 border-t border-[color:var(--app-border)]/30 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Clock size={11} className="text-emerald-500" />
                          <span>Served {item.servedTime || item.completedTime}</span>
                        </span>
                        {item.orderSource && (
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-slate-500">
                            {item.orderSource}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                        {item.chefName && (
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            <ChefHat size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">Chef: {item.chefName}</span>
                          </span>
                        )}
                        {item.serverName && (
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            <UserCheck size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">Served by: {item.serverName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Load More Pagination */}
          {pagination.hasMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                data-testid="history-load-more-btn"
                disabled={loadingMore}
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[color:var(--app-border)]/40 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-orange-500" />
                    <span>Loading more items...</span>
                  </>
                ) : (
                  <span>Load More Records</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
