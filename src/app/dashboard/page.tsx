"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
import { mockLotteryApi } from "@/lib/mockApi";
import { UserStats } from "@/types/lottery";
import { formatINR } from "@/lib/checkTicket";
import { getScheme } from "@/lib/schemes";
import { CountUp } from "@/components/reveal/CountUp";
import { useDemoStore } from "@/store/useAppStore";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Trophy,
  IndianRupee,
  Percent,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

export default function DashboardPage() {
  const { mockNewUser, setMockNewUser } = useDemoStore();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await mockLotteryApi.getStats();
      if (mockNewUser) {
        setStats({
          totalTickets: 0,
          totalSpent: 0,
          totalWon: 0,
          netProfitLoss: 0,
          winRate: 0,
          bestWin: 0,
          schemeBreakdown: {},
          monthlyBreakdown: [],
          historyTimeline: [],
        });
      } else {
        setStats(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [mockNewUser]);

  const handleSeedData = async () => {
    await mockLotteryApi.resetHistory();
    setMockNewUser(false);
    fetchStats();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-slate-400 text-sm">
        Loading analytics dashboard...
      </div>
    );
  }

  // New User Empty State
  if (!stats || stats.totalTickets === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 text-center max-w-lg mx-auto space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
          <BarChart3 className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            No Ticket History Yet
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Check your Kerala lottery tickets to automatically track your spend, winnings, and lifetime net profit / loss.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full justify-center">
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Check Your First Ticket</span>
          </Link>

          <button
            onClick={handleSeedData}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <span>Load 40 Sample Tickets</span>
          </button>
        </div>
      </div>
    );
  }

  const isNetPositive = stats.netProfitLoss >= 0;

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            Lottery Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Lifetime financial overview across all Kerala lottery schemes
          </p>
        </div>
      </div>

      {/* Hero Card: Net Profit / Loss */}
      <div className="w-full rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {isNetPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Lifetime Net Return</span>
          </div>

          <div
            className={`text-4xl sm:text-6xl font-black tracking-tight tabular-nums ${
              isNetPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-800 dark:text-slate-100"
            }`}
          >
            {stats.netProfitLoss < 0 ? "-" : "+"}
            <CountUp end={Math.abs(stats.netProfitLoss)} duration={2000} prefix="₹" />
          </div>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Total Won ({formatINR(stats.totalWon)}) minus Total Spent ({formatINR(stats.totalSpent)})
          </p>
        </div>

        <div className="z-10 flex flex-col items-center sm:items-end gap-1">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
          >
            <span>Check Next Ticket</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <span className="text-[11px] text-slate-400 mt-1">Play responsibly</span>
        </div>
      </div>

      {/* 5 Core Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Spent */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Spent
          </span>
          <div className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 mt-1 tabular-nums">
            {formatINR(stats.totalSpent)}
          </div>
        </div>

        {/* Won */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Won
          </span>
          <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {formatINR(stats.totalWon)}
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Win Rate
          </span>
          <div className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 mt-1 tabular-nums">
            {stats.winRate}%
          </div>
        </div>

        {/* Best Win */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Best Win
          </span>
          <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatINR(stats.bestWin)}
          </div>
        </div>

        {/* Tickets Checked */}
        <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Tickets
          </span>
          <div className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 mt-1 tabular-nums">
            {stats.totalTickets}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Net-Over-Time Line Chart */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Cumulative Net Return Over Time
              </h3>
              <p className="text-xs text-slate-400">Chronological net progression (₹)</p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={stats.historyTimeline}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => {
                    const parts = val.split("-");
                    return `${parts[2]}/${parts[1]}`;
                  }}
                  stroke="#94a3b8"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `₹${val}`}
                  stroke="#94a3b8"
                />
                <Tooltip
                  formatter={(value: number) => [formatINR(value), "Cumulative Net"]}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{
                    borderRadius: "16px",
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeNet"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: "#10b981" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Spend vs Winnings Bar Chart */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Monthly Spend vs Winnings
              </h3>
              <p className="text-xs text-slate-400">Side-by-side comparison per month (₹)</p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.monthlyBreakdown}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `₹${val}`}
                  stroke="#94a3b8"
                />
                <Tooltip
                  formatter={(value: number) => formatINR(value)}
                  contentStyle={{
                    borderRadius: "16px",
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Bar dataKey="spent" name="Spent" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="won" name="Won" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Breakdown by Scheme */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          Performance by Scheme
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(stats.schemeBreakdown).map(([code, sData]) => {
            const scheme = getScheme(code);
            const net = sData.won - sData.spent;
            const isPos = net >= 0;

            return (
              <div
                key={code}
                className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-sm"
                    style={{ backgroundColor: scheme.theme.primary }}
                  >
                    {scheme.code}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {scheme.name}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {sData.count} tickets • {sData.wins} wins
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    Won: {formatINR(sData.won)}
                  </div>
                  <div
                    className={`text-[11px] font-semibold tabular-nums ${
                      isPos ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"
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
    </div>
  );
}
