"use client";

import React, { useEffect, useState } from "react";
import { useAppSettingsStore, useDemoStore } from "@/store/useAppStore";
import { useThemeStore, ThemeMode } from "@/store/useThemeStore";
import { mockLotteryApi } from "@/lib/mockApi";
import { UserSession } from "@/types/lottery";
import {
  Settings,
  Volume2,
  VolumeX,
  Vibrate,
  Eye,
  Moon,
  Sun,
  Laptop,
  User,
  LogIn,
  LogOut,
  Sparkles,
  Trash2,
  RefreshCw,
  ShieldCheck,
  HeartHandshake,
} from "lucide-react";

export default function SettingsPage() {
  const { soundEnabled, toggleSound, hapticsEnabled, toggleHaptics, reducedMotion, setReducedMotion } =
    useAppSettingsStore();
  const { theme, setTheme } = useThemeStore();
  const { openDemoMenu } = useDemoStore();

  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataMessage, setDataMessage] = useState<string | null>(null);

  useEffect(() => {
    mockLotteryApi.getSession().then(setSession);
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const s = await mockLotteryApi.signInWithGoogle();
      setSession(s);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await mockLotteryApi.signOut();
      const s = await mockLotteryApi.getSession();
      setSession(s);
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    await mockLotteryApi.resetHistory();
    setDataMessage("Successfully restored 40 sample historical tickets.");
    setTimeout(() => setDataMessage(null), 3000);
  };

  const handleClearData = async () => {
    await mockLotteryApi.resetHistory([]);
    setDataMessage("Cleared all local tickets. New user mode active.");
    setTimeout(() => setDataMessage(null), 3000);
  };

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          Settings & Preferences
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize your experience, audio, appearance, and demo data
        </p>
      </div>

      {dataMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold animate-fade-in">
          {dataMessage}
        </div>
      )}

      {/* Account Section */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-600" />
          User Profile
        </h2>

        {session?.isAuthenticated && session.user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white font-bold text-base flex items-center justify-center shadow-md">
                {session.user.name.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {session.user.name}
                </div>
                <div className="text-xs text-slate-400">{session.user.email}</div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                You are currently browsing as a guest
              </div>
              <div className="text-[11px] text-slate-400">
                Sign in to save tickets across devices and browsers.
              </div>
            </div>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Mock Sign In</span>
            </button>
          </div>
        )}
      </div>

      {/* Appearance Section */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Appearance
        </h2>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Laptop },
            ] as const
          ).map((item) => {
            const isSelected = theme === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTheme(item.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-semibold transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sensory & Motion Preferences */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Sensory & Accessibility
        </h2>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {/* Sound Toggle (Off by default per spec) */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Audio & Sound Effects
                </div>
                <div className="text-[11px] text-slate-400">
                  Subtle Web Audio synthesize tones on character lock and wins
                </div>
              </div>
            </div>

            <button
              onClick={toggleSound}
              role="switch"
              aria-checked={soundEnabled}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                soundEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  soundEnabled ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Haptics Toggle */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <Vibrate className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Haptic Feedback
                </div>
                <div className="text-[11px] text-slate-400">
                  Subtle vibration pulses on supported mobile devices
                </div>
              </div>
            </div>

            <button
              onClick={toggleHaptics}
              role="switch"
              aria-checked={hapticsEnabled}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                hapticsEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  hapticsEnabled ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Reduced Motion Toggle */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Reduced Motion Mode
                </div>
                <div className="text-[11px] text-slate-400">
                  Skip the 8s reveal sequence in favor of immediate verdict fade
                </div>
              </div>
            </div>

            <button
              onClick={() => setReducedMotion(!reducedMotion)}
              role="switch"
              aria-checked={reducedMotion}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                reducedMotion ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  reducedMotion ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Demo Controls & Data Management */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Testing & Demo Tools
        </h2>

        <div className="space-y-2">
          <button
            onClick={openDemoMenu}
            className="w-full p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Demo Testing Menu (Or Long-Press App Logo)</span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleResetData}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>Reset & Seed 40 Tickets</span>
            </button>

            <button
              onClick={handleClearData}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear History (New User)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Responsible Gaming Notice */}
      <div className="p-5 rounded-3xl bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <HeartHandshake className="w-4 h-4 text-emerald-600" />
          <span>Responsible Play Commitment</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          This verification utility contains zero buy nudges, no streak counters, and no purchase prompts.
          State lotteries are games of pure chance governed by the Directorate of Kerala State Lotteries.
          Always play responsibly.
        </p>
      </div>
    </div>
  );
}
