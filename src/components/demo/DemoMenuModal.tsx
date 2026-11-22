"use client";

import React from "react";
import { useDemoStore, ForcedOutcome } from "@/store/useAppStore";
import { X, Trophy, Sparkles, Frown, Award, UserCheck, RefreshCw, CheckCircle2 } from "lucide-react";
import { mockLotteryApi } from "@/lib/mockApi";

interface DemoMenuModalProps {
  onRefreshData?: () => void;
}

export function DemoMenuModal({ onRefreshData }: DemoMenuModalProps) {
  const {
    isDemoMenuOpen,
    closeDemoMenu,
    forcedOutcome,
    setForcedOutcome,
    mockNewUser,
    setMockNewUser,
  } = useDemoStore();

  if (!isDemoMenuOpen) return null;

  const outcomes: Array<{ id: ForcedOutcome; label: string; desc: string; icon: React.ElementType; color: string }> = [
    {
      id: "jackpot",
      label: "Force Jackpot (1st Prize)",
      desc: "Full 8-char match, ₹75,00,000 burst",
      icon: Trophy,
      color: "bg-amber-500 text-white",
    },
    {
      id: "mid",
      label: "Force Mid Win (Consolation/2nd)",
      desc: "Series mismatch or 2nd prize ₹8,000",
      icon: Award,
      color: "bg-purple-600 text-white",
    },
    {
      id: "small",
      label: "Force Small Win (Last 4)",
      desc: "Last 4 digits match, ₹5,000",
      icon: Sparkles,
      color: "bg-emerald-600 text-white",
    },
    {
      id: "none",
      label: "Force No Win",
      desc: "Gentle non-punishing reveal",
      icon: Frown,
      color: "bg-slate-500 text-white",
    },
    {
      id: null,
      label: "Normal Draw Evaluation",
      desc: "Evaluate ticket against actual draw numbers",
      icon: CheckCircle2,
      color: "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100",
    },
  ];

  const handleResetHistory = async () => {
    await mockLotteryApi.resetHistory();
    setMockNewUser(false);
    if (onRefreshData) onRefreshData();
    alert("Seeded 40 historical Kerala lottery tickets successfully!");
  };

  const handleSetZeroHistory = async () => {
    await mockLotteryApi.resetHistory([]);
    setMockNewUser(true);
    if (onRefreshData) onRefreshData();
    alert("Cleared history. App is now in new user state.");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-menu-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 id="demo-menu-title" className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Demo Testing Controls
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trigger any reveal outcome & toggle test user states
            </p>
          </div>
          <button
            onClick={closeDemoMenu}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            aria-label="Close demo menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 py-4 overflow-y-auto pr-1">
          {/* Forced Outcome Section */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
              Force Next Reveal Outcome
            </label>
            <div className="grid grid-cols-1 gap-2">
              {outcomes.map((item) => {
                const isSelected = forcedOutcome === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={String(item.id)}
                    onClick={() => setForcedOutcome(item.id)}
                    className={`flex items-center gap-3 p-3 rounded-2xl text-left border transition-all ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.label}
                        </span>
                        {isSelected && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User State & History Data */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
              User State & Historical Data
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleResetHistory}
                className="flex items-center gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-all"
              >
                <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Seed 40 Tickets
                  </div>
                  <div className="text-[11px] text-slate-500">Realistic history & stats</div>
                </div>
              </button>

              <button
                onClick={handleSetZeroHistory}
                className="flex items-center gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-all"
              >
                <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Simulate New User
                  </div>
                  <div className="text-[11px] text-slate-500">Empty dashboard state</div>
                </div>
              </button>
            </div>
          </div>

          {/* Guaranteed Sample Ticket Reference */}
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Test With Known Draw Values:
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <div>• 1st Prize Sample: <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">WA 584920</code></div>
              <div>• Consolation Sample: <code className="font-mono font-bold text-purple-600 dark:text-purple-400">WB 584920</code></div>
              <div>• Last-4 Sample: <code className="font-mono font-bold text-cyan-600 dark:text-cyan-400">WA 114920</code></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={closeDemoMenu}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
