/**
 * Store Analytics Dashboard — Main Page
 *
 * Design decisions:
 * - "use client" (CSR) because the dashboard is inherently interactive:
 *   store switching, time window changes, auto-refresh, and auth state (localStorage)
 * - All hooks declared unconditionally at the top to comply with React Rules of Hooks
 * - Auth-first UX: unauthenticated users see a polished login/signup screen,
 *   not a blank dashboard with a login prompt
 * - useMemo for chart data derivation prevents unnecessary re-renders on polling
 * - Intl.NumberFormat for locale-aware currency/number formatting
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthScreen from "./auth-screen";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import styles from "./page.module.css";

type EventType =
  | "page_view"
  | "add_to_cart"
  | "remove_from_cart"
  | "checkout_started"
  | "purchase";

type OverviewResponse = {
  revenue: {
    today: number;
    week: number;
    month: number;
  };
  eventsByType: Record<EventType, number>;
  conversionRate: number;
  totals: {
    purchases: number;
    pageViews: number;
  };
};

type TopProductsResponse = {
  windowDays: number;
  products: Array<{
    productId: string;
    revenue: number;
    purchaseCount: number;
  }>;
};

type RecentActivityResponse = {
  events: Array<{
    eventId: string;
    storeId: string;
    eventType: EventType;
    timestamp: string;
    data: Record<string, unknown>;
  }>;
};

const DEFAULT_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID ?? "store_alpha";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

const eventTypeLabels: Record<EventType, string> = {
  page_view: "Page Views",
  add_to_cart: "Add to Cart",
  remove_from_cart: "Remove from Cart",
  checkout_started: "Checkout Started",
  purchase: "Purchases",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

export default function Home() {
  const [storeId, setStoreId] = useState(DEFAULT_STORE_ID);
  const [token, setToken] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('token') || "" : ""));
  const [user, setUser] = useState(() => (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null));
  const [topProductsDays, setTopProductsDays] = useState(30);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [topProducts, setTopProducts] = useState<TopProductsResponse | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<RecentActivityResponse['events'][number] | null>(null);

  // Auth handler: after user signup/login, also perform a store-level login
  // so the analytics endpoints receive the correct Bearer storeId token.
  // Design: two-tier auth — user auth for identity, store auth for tenant scoping.
  const handleUserAuth = useCallback((tok: string, userObj: any) => {
    setToken(tok);
    setUser(userObj);
    // Also do a store-level login so analytics endpoints work
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId }),
        });
        if (response.ok) {
          const json = (await response.json()) as { accessToken: string };
          setToken(json.accessToken);
          setUser(userObj);
        }
      } catch {
        // keep the user-auth token as fallback
      }
    })();
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', tok);
      localStorage.setItem('user', JSON.stringify(userObj));
    }
  }, [storeId]);

  // Centralized fetch helper with tenant auth headers.
  // Design: uses storeId as Bearer token (matching StoreAuthGuard's validation).
  // cache: "no-store" ensures fresh data on every request (critical for polling).
  const fetchJson = useCallback(
    async <T,>(path: string): Promise<T> => {
      if (!token) {
        throw new Error("Please log in to a store first.");
      }
      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
          "Content-Type": "application/json",
          "x-store-id": storeId,
          Authorization: `Bearer ${storeId}`,
        },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      return (await response.json()) as T;
    },
    [storeId, token],
  );

  // Parallel fetch of all three analytics endpoints.
  // Design: Promise.all fires all requests concurrently, reducing total load time
  // from ~3x serial latency to ~1x (the slowest query's latency).
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewData, topProductsData, recentActivityData] = await Promise.all([
        fetchJson<OverviewResponse>(`/analytics/overview`),
        fetchJson<TopProductsResponse>(`/analytics/top-products?days=${topProductsDays}`),
        fetchJson<RecentActivityResponse>("/analytics/recent-activity?limit=20"),
      ]);

      setOverview(overviewData);
      setTopProducts(topProductsData);
      setRecentActivity(recentActivityData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown error while loading analytics.");
    } finally {
      setLoading(false);
    }
  }, [fetchJson, topProductsDays]);

  // Initial load
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void loadDashboard();
  }, [loadDashboard, token]);

  // Auto-refresh: polls every 15 seconds for near real-time dashboard updates.
  // Trade-off: polling is less efficient than WebSockets but requires no extra
  // infrastructure. The interval is cleared on unmount to prevent memory leaks.
  useEffect(() => {
    if (!token) {
      return;
    }
    const interval = setInterval(() => {
      void loadDashboard();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadDashboard, token]);

  // Auto-refresh dashboard when topProductsDays changes
  useEffect(() => {
    if (!token) return;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topProductsDays]);

  const maxTopProductRevenue = useMemo(() => {
    if (!topProducts?.products.length) {
      return 0;
    }

    return Math.max(...topProducts.products.map((product) => product.revenue));
  }, [topProducts]);

  // Memoize chart data derived from API responses to avoid recomputation on
  // unrelated re-renders (e.g., pagination state changes).
  const eventChartData = useMemo(() =>
    overview
      ? (Object.keys(eventTypeLabels) as EventType[]).map((eventType) => ({
          type: eventTypeLabels[eventType],
          value: overview.eventsByType[eventType] ?? 0,
        }))
      : [],
    [overview]
  );

  const topProductsChartData = useMemo(() =>
    topProducts
      ? topProducts.products.map((p) => ({
          name: p.productId,
          value: p.revenue,
        }))
      : [],
    [topProducts]
  );

  const chartColors = ["#0d95b0", "#ef7f1a", "#18bed9", "#f4b33f", "#0e6c86", "#203746", "#0f5d6f"];

  // Logout handler
  const handleLogout = useCallback(() => {
    setToken("");
    setUser(null);
    setOverview(null);
    setTopProducts(null);
    setRecentActivity(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, []);

  // If not logged in, show AuthScreen
  if (!token || !user) {
    return <AuthScreen onAuth={handleUserAuth} />;
  }

  return (
    <div className={styles.pageShell}>
      <div className={styles.backgroundGlow} />
      <main className={styles.dashboard}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Amboras Analytics</p>
            <h1 className={styles.title}>Store Performance Dashboard</h1>
            <p className={styles.subtitle}>Real-time business insight for your storefront.</p>
          </div>
          <div className={styles.controls}>
            <label className={styles.controlBlock}>
              Store
              <select
                value={storeId}
                onChange={async (event) => {
                  const newStore = event.target.value;
                  setStoreId(newStore);
                  setOverview(null);
                  setTopProducts(null);
                  setRecentActivity(null);
                  setLoading(true);
                  setError(null);
                  // Auto-login for new store
                  try {
                    const response = await fetch(`${API_BASE_URL}/auth/login`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ storeId: newStore }),
                    });
                    if (!response.ok) throw new Error(`Login failed (${response.status})`);
                    const json = (await response.json()) as { accessToken: string; storeId: string };
                    setToken(json.accessToken);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('token', json.accessToken);
                    }
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : "Unable to log in.");
                  }
                }}
              >
                <option value="store_alpha">store_alpha</option>
                <option value="store_beta">store_beta</option>
                <option value="store_gamma">store_gamma</option>
              </select>
            </label>
            <label className={styles.controlBlock}>
              Top Products Window
              <select
                value={topProductsDays}
                onChange={(event) => setTopProductsDays(Number(event.target.value))}
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </label>
            <button className={styles.refreshButton} onClick={() => void loadDashboard()} type="button">
              Refresh
            </button>
            <button className={styles.logoutButton} onClick={handleLogout} type="button">
              Logout
            </button>
          </div>
        </header>

        {error ? (
          <section className={styles.errorState}>
            <h2>Unable to load dashboard data</h2>
            <p>{error}</p>
          </section>
        ) : null}

        <section className={styles.metricsGrid}>
          <article className={styles.metricCard}>
            <h3>Revenue Today</h3>
            <p>{loading || !overview ? "..." : currencyFormatter.format(overview.revenue.today)}</p>
          </article>
          <article className={styles.metricCard}>
            <h3>Revenue This Week</h3>
            <p>{loading || !overview ? "..." : currencyFormatter.format(overview.revenue.week)}</p>
          </article>
          <article className={styles.metricCard}>
            <h3>Revenue This Month</h3>
            <p>{loading || !overview ? "..." : currencyFormatter.format(overview.revenue.month)}</p>
          </article>
          <article className={styles.metricCard}>
            <h3>Conversion Rate</h3>
            <p>{loading || !overview ? "..." : `${overview.conversionRate.toFixed(2)}%`}</p>
          </article>
        </section>

        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Event Distribution</h2>
              <span>Total: {loading || !overview ? "..." : numberFormatter.format(eventChartData.reduce((acc, v) => acc + v.value, 0))}</span>
            </div>
            <div style={{ width: "100%", height: 260 }}>
              {loading ? (
                <p className={styles.loadingText}>Loading chart...</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventChartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                    <XAxis dataKey="type" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0d95b0">
                      {eventChartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={chartColors[idx % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Top Products by Revenue</h2>
              <span>{topProducts?.windowDays ?? topProductsDays}d window</span>
            </div>
            <div style={{ width: "100%", height: 260 }}>
              {loading ? (
                <p className={styles.loadingText}>Loading chart...</p>
              ) : topProducts && topProducts.products.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topProductsChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name }) => name}
                    >
                      {topProductsChartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={chartColors[idx % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => currencyFormatter.format(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className={styles.loadingText}>No purchases in the selected time window.</p>
              )}
            </div>
          </article>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent Activity</h2>
            <span>Last 20 events</span>
          </div>
          <div className={styles.activityList}>
            {loading ? (
              <p className={styles.loadingText}>Loading latest events...</p>
            ) : (
              (() => {
                const events = recentActivity?.events ?? [];
                const pageSize = 10;
                const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
                const pageEvents = events.slice(activityPage * pageSize, (activityPage + 1) * pageSize);
                return (
                  <>
                    {pageEvents.map((event) => (
                      <article
                        key={event.eventId}
                        className={styles.activityItem}
                        onClick={() => setSelectedEvent(event)}
                        style={{ cursor: "pointer" }}
                      >
                        <div>
                          <strong>{eventTypeLabels[event.eventType]}</strong>
                          <p>{event.eventId}</p>
                        </div>
                        <div>
                          <p>{new Date(event.timestamp).toLocaleString()}</p>
                          {typeof event.data.amount === "number" ? (
                            <span>{currencyFormatter.format(event.data.amount)}</span>
                          ) : null}
                        </div>
                      </article>
                    ))}
                    {events.length > pageSize && (
                      <div className={styles.pagination}>
                        <button
                          className={styles.pageBtn}
                          disabled={activityPage === 0}
                          onClick={() => setActivityPage((p) => p - 1)}
                          type="button"
                        >
                          ← Prev
                        </button>
                        <span className={styles.pageInfo}>
                          Page {activityPage + 1} of {totalPages}
                        </span>
                        <button
                          className={styles.pageBtn}
                          disabled={activityPage >= totalPages - 1}
                          onClick={() => setActivityPage((p) => p + 1)}
                          type="button"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </section>

        {/* Event Detail Popup */}
        {selectedEvent && (
          <div className={styles.modalOverlay} onClick={() => setSelectedEvent(null)}>
            <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <button className={styles.modalClose} onClick={() => setSelectedEvent(null)} type="button">
                ✕
              </button>
              <h3 className={styles.modalTitle}>Event Details</h3>
              <div className={styles.modalBody}>
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>Type</span>
                  <span className={styles.modalValue}>{eventTypeLabels[selectedEvent.eventType]}</span>
                </div>
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>Event ID</span>
                  <span className={styles.modalValueMono}>{selectedEvent.eventId}</span>
                </div>
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>Store</span>
                  <span className={styles.modalValue}>{selectedEvent.storeId}</span>
                </div>
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>Timestamp</span>
                  <span className={styles.modalValue}>{new Date(selectedEvent.timestamp).toLocaleString()}</span>
                </div>
                {Object.entries(selectedEvent.data).map(([key, val]) => (
                  <div key={key} className={styles.modalRow}>
                    <span className={styles.modalLabel}>{key.replace(/_/g, ' ')}</span>
                    <span className={styles.modalValue}>
                      {key === 'amount' && typeof val === 'number'
                        ? currencyFormatter.format(val)
                        : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
