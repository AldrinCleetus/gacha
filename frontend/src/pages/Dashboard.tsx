import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { lotteryApi } from "@/lib/apiClient";
import { UserStats } from "@/types";
import { formatINR } from "@/lib/checkTicket";
import { getScheme } from "@/lib/schemes";
import { useDemoStore } from "@/store/useDemoStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useGoogleSignIn } from "@/lib/auth/useGoogleSignIn";
import { usePageMeta } from "@/lib/usePageMeta";
import { CountUp } from "@/components/reveal/CountUp";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Trophy,
  Award,
  Sparkles,
  ArrowRight,
  Info,
  Calendar,
} from "lucide-react";

export function Dashboard() {
  const { mockNewUser, setMockNewUser, useMockApi } = useDemoStore();
  const { session, isLoaded, syncVersion } = useAuthStore();
  const { signInWithGoogle, loading: googleLoading } = useGoogleSignIn();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"30D" | "6M" | "ALL">("ALL");

  usePageMeta({
    title: "Dashboard & Prize Ledger — cocolot",
    description: "Track your total spent, total won, win rate, and net return across Kerala State Lottery draws on cocolot.",
    path: "/dashboard",
    noIndex: true,
  });

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setLoading(true);
    lotteryApi
      .getStats()
      .then((data) => {
        if (cancelled) return;
        // Only honor demo mockNewUser flag when explicitly in Mock API mode
        if (useMockApi && mockNewUser) {
          setStats({
            totalTickets: 0,
            totalSpent: 0,
            totalWon: 0,
            netProfitLoss: 0,
            winRate: 0,
            bestWin: 0,
            longestDrySpell: 0,
            mostCheckedScheme: "None",
            schemeBreakdown: {},
            monthlyBreakdown: [],
            historyTimeline: [],
          });
        } else {
          setStats(data);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useMockApi, mockNewUser, isLoaded, session.isAuthenticated, session.user?.id, syncVersion]);

  const filteredTimeline = useMemo(() => {
    if (!stats?.historyTimeline) return [];
    if (timeRange === "ALL") return stats.historyTimeline;

    const days = timeRange === "30D" ? 30 : 180;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return stats.historyTimeline.filter((t) => new Date(t.date) >= cutoff);
  }, [stats?.historyTimeline, timeRange]);

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-muted">
        Loading analytics dashboard…
      </div>
    );
  }

  // New User Empty State
  if (!stats || stats.totalTickets === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-input-box text-primary flex items-center justify-center">
          <BarChart3 className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-main">No lotteries recorded yet</h2>
          <p className="text-xs text-muted">
            Check your lotteries to automatically track your lifetime return, spend, and scheme statistics.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row gap-2 w-full justify-center">
          <Link
            to="/check"
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold shadow-soft flex items-center justify-center gap-1.5"
          >
            <span>Check a lottery</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          {!session.isAuthenticated && (
            <button
              type="button"
              onClick={() => signInWithGoogle("/dashboard")}
              disabled={googleLoading}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-surface border border-border text-xs font-semibold text-main hover:bg-input-box flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{googleLoading ? "Connecting…" : "Sign in with Google"}</span>
            </button>
          )}
          <button
            onClick={async () => {
              await lotteryApi.resetHistory();
              setMockNewUser(false);
              window.location.reload();
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-surface border border-border text-xs font-semibold text-muted hover:text-main"
          >
            Seed 40 sample lotteries
          </button>
        </div>
      </div>
    );
  }

  const isNetPositive = stats.netProfitLoss >= 0;

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-bold text-main">Dashboard</h1>
        <p className="text-xs sm:text-sm text-muted mt-0.5">
          Overview of your checked lotteries and return ledger
        </p>
      </div>

      {/* Hero Net P/L Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
            {isNetPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-muted" />
            )}
            <span>Net Profit / Loss</span>
          </div>

          <div
            className={`text-4xl sm:text-6xl font-black tracking-tight tabular-nums ${
              stats.netProfitLoss > 0
                ? "text-primary"
                : stats.netProfitLoss < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-main"
            }`}
          >
            {stats.netProfitLoss < 0 ? "- " : stats.netProfitLoss > 0 ? "+ " : ""}
            <CountUp end={Math.abs(stats.netProfitLoss)} duration={1800} />
          </div>

          <p className="text-xs text-muted pt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            <span>Based on the lotteries you&apos;ve checked here.</span>
          </p>
        </div>

        <Link
          to="/check"
          className="px-5 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-soft flex items-center gap-1.5 transition-colors"
        >
          <span>Check another lottery</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 4 Core Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-soft">
          <span className="text-[11px] font-semibold text-muted block">Total Spent</span>
          <div className="text-lg sm:text-xl font-bold text-main mt-0.5 font-sans tabular-nums">
            {formatINR(stats.totalSpent)}
          </div>
          <span className="text-[10px] text-subtle">Based on checked tickets</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-border shadow-soft">
          <span className="text-[11px] font-semibold text-muted block">Total Won</span>
          <div className="text-lg sm:text-xl font-bold text-gold-text mt-0.5 font-sans tabular-nums">
            {formatINR(stats.totalWon)}
          </div>
          <span className="text-[10px] text-subtle">Prize matches</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-border shadow-soft">
          <span className="text-[11px] font-semibold text-muted block">Win Rate</span>
          <div className="text-lg sm:text-xl font-bold text-main mt-0.5 font-sans tabular-nums">
            {stats.winRate}%
          </div>
          <span className="text-[10px] text-subtle">Frequency of prize hits</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-border shadow-soft">
          <span className="text-[11px] font-semibold text-muted block">Lotteries Checked</span>
          <div className="text-lg sm:text-xl font-bold text-main mt-0.5 font-sans tabular-nums">
            {stats.totalTickets}
          </div>
          <span className="text-[10px] text-subtle">
            {session.isAuthenticated ? "Synced to account" : "Saved locally"}
          </span>
        </div>
      </div>

      {/* Highlights Card */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-soft space-y-3">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider">
          Highlights
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-input-box border border-input-border">
            <div className="text-xs text-muted flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-gold-text" />
              <span>Best Single Win</span>
            </div>
            <div className="text-base font-bold text-main font-mono mt-1">
              {formatINR(stats.bestWin)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-input-box border border-input-border">
            <div className="text-xs text-muted flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Longest Dry Spell</span>
            </div>
            <div className="text-base font-bold text-main mt-1">
              {stats.totalTickets === 0
                ? "0 draws"
                : `${stats.longestDrySpell} draw${stats.longestDrySpell !== 1 ? "s" : ""} without win`}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-input-box border border-input-border">
            <div className="text-xs text-muted flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Most-Checked Scheme</span>
            </div>
            <div className="text-base font-bold text-main mt-1 truncate">
              {stats.mostCheckedScheme}
            </div>
          </div>
        </div>
      </div>

      {/* Net Over Time Line Chart */}
      <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-border shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-main">Cumulative Net Return Over Time</h2>
            <p className="text-xs text-muted">Chronological return progression</p>
          </div>

          <div className="flex items-center gap-1 bg-input-box p-1 rounded-xl border border-input-border self-start sm:self-auto">
            {(["30D", "6M", "ALL"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  timeRange === r
                    ? "bg-surface text-main shadow-soft"
                    : "text-muted hover:text-main"
                }`}
              >
                {r === "30D" ? "30 Days" : r === "6M" ? "6 Months" : "All Time"}
              </button>
            ))}
          </div>
        </div>

        <div className="h-60 sm:h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <LineChart data={filteredTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(val) => {
                  try {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                    }
                  } catch {
                    // ignore
                  }
                  return String(val);
                }}
                stroke="var(--color-muted)"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(val) =>
                  Math.abs(val) >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`
                }
                stroke="var(--color-muted)"
              />
              <Tooltip
                formatter={(val: number) => [formatINR(val), "Net Return"]}
                labelFormatter={(lbl) => `Date: ${lbl}`}
                contentStyle={{
                  borderRadius: "16px",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="cumulativeNet"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: filteredTimeline.length <= 2 ? 5 : 2, fill: "var(--color-primary)" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Spend vs Winnings Bars */}
      <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-border shadow-soft space-y-4">
        <div>
          <h2 className="text-sm font-bold text-main">Spent vs Won by Month</h2>
          <p className="text-xs text-muted">Monthly comparison of expenditure and prize returns</p>
        </div>

        <div className="h-60 sm:h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <BarChart data={stats.monthlyBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(val) =>
                  Math.abs(val) >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`
                }
                stroke="var(--color-muted)"
              />
              <Tooltip
                formatter={(val: number) => formatINR(val)}
                contentStyle={{
                  borderRadius: "16px",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "6px" }} />
              <Bar dataKey="spent" name="Spent" fill="var(--color-muted)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="won" name="Won" fill="var(--color-gold-text)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown by Scheme */}
      <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-border shadow-soft space-y-4">
        <h2 className="text-sm font-bold text-main">By-Scheme Breakdown</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(stats.schemeBreakdown)
            .sort(([, a], [, b]) => b.count - a.count)
            .map(([code, item]) => {
            const scheme = getScheme(code);
            const net = item.won - item.spent;
            const isPos = net >= 0;

            return (
              <div
                key={code}
                className="p-4 rounded-2xl bg-input-box border border-input-border flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: scheme.theme.bg, color: scheme.theme.text }}
                  >
                    {scheme.code}
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-main">{scheme.name}</div>
                    <div className="text-[11px] text-muted">
                      {item.count} lotteries · {item.wins} wins
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-main font-sans tabular-nums">
                    Won: {formatINR(item.won)}
                  </div>
                  <div
                    className={`text-[11px] font-semibold font-sans tabular-nums ${
                      isPos ? "text-primary" : "text-muted"
                    }`}
                  >
                    Net: {isPos ? "+" : ""}
                    {formatINR(net)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Responsible Gaming Statement */}
      <div className="pt-2 pb-6 text-center text-xs text-subtle max-w-md mx-auto">
        Lotteries are for fun. Play within your means.
      </div>
    </div>
  );
}
