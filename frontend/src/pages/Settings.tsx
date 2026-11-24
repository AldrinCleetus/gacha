import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore, ThemeMode } from "@/store/useSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useDemoStore } from "@/store/useDemoStore";
import { lotteryApi } from "@/lib/apiClient";
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
  Volume2,
  VolumeX,
  Vibrate,
  Eye,
  LogOut,
  Trash2,
  RefreshCw,
  Sparkles,
  HeartHandshake,
} from "lucide-react";

export function Settings() {
  const navigate = useNavigate();
  const {
    theme,
    setTheme,
    soundEnabled,
    toggleSound,
    hapticsEnabled,
    toggleHaptics,
    reducedMotion,
    setReducedMotion,
  } = useSettingsStore();
  const { session, logout } = useAuthStore();
  const { openDemoMenu, setMockNewUser, useMockApi, setUseMockApi } = useDemoStore();

  const [message, setMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    await lotteryApi.signOut();
    logout();
    navigate("/login");
  };

  const handleResetData = async () => {
    await lotteryApi.resetHistory();
    setMockNewUser(false);
    setMessage("Restored ~40 sample historical lotteries.");
    setTimeout(() => setMessage(null), 3000);
  };

  const handleClearData = async () => {
    await lotteryApi.resetHistory([]);
    setMockNewUser(true);
    setMessage("Local lottery history cleared. New user state active.");
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="flex-1 max-w-xl mx-auto w-full py-4 sm:py-6 space-y-6">
      <div className="pb-2 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-bold text-main">Settings</h1>
        <p className="text-xs sm:text-sm text-muted mt-0.5">
          Appearance, audio, motion preferences, and local data
        </p>
      </div>

      {message && (
        <div className="p-3 rounded-2xl bg-input-box border border-input-border text-xs text-primary font-semibold">
          {message}
        </div>
      )}

      {/* Account Card */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-soft flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-input-box border border-input-border text-primary font-bold text-sm flex items-center justify-center">
            {session.user?.name ? session.user.name.charAt(0) : "U"}
          </div>
          <div>
            <div className="text-sm font-bold text-main">{session.user?.name || "Guest"}</div>
            <div className="text-xs text-muted">{session.user?.email || "Testing session"}</div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-input-box text-xs font-semibold text-rose-600 flex items-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>

      {/* Theme */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-soft space-y-3">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider">Appearance</h2>
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
                    ? "border-primary bg-primary-subtle text-primary"
                    : "border-border text-muted hover:text-main hover:bg-input-box"
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sensory & Motion */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-soft space-y-3">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider">
          Sensory & Accessibility
        </h2>

        <div className="divide-y divide-border/60">
          {/* Sound Toggle (Off by default per spec) */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-input-box text-muted">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-main">Audio effects</div>
                <div className="text-[11px] text-muted">Web Audio tone synthesis on locks and wins</div>
              </div>
            </div>

            <button
              onClick={toggleSound}
              role="switch"
              aria-checked={soundEnabled}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                soundEnabled ? "bg-primary" : "bg-border"
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
              <div className="p-2 rounded-xl bg-input-box text-muted">
                <Vibrate className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-main">Haptic ticks</div>
                <div className="text-[11px] text-muted">Vibration pulses on supported devices</div>
              </div>
            </div>

            <button
              onClick={toggleHaptics}
              role="switch"
              aria-checked={hapticsEnabled}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                hapticsEnabled ? "bg-primary" : "bg-border"
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
              <div className="p-2 rounded-xl bg-input-box text-muted">
                <Eye className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-main">Reduce motion</div>
                <div className="text-[11px] text-muted">Skip 8s reveal for an immediate calm verdict fade</div>
              </div>
            </div>

            <button
              onClick={() => setReducedMotion(!reducedMotion)}
              role="switch"
              aria-checked={reducedMotion}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                reducedMotion ? "bg-primary" : "bg-border"
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

      {/* Backend API Connection Source */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-soft space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-muted uppercase tracking-wider">Data Source</h2>
            <p className="text-[11px] text-muted mt-0.5">Switch between live Fastify backend and offline demo mock data</p>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            !useMockApi ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
          }`}>
            {!useMockApi ? "Connected to Backend" : "Demo Mode Active"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => {
              setUseMockApi(false);
              setMessage("Switched to Live Backend API (:3001).");
              setTimeout(() => setMessage(null), 3000);
            }}
            className={`p-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              !useMockApi
                ? "bg-primary text-white border-primary shadow-soft"
                : "bg-surface border-border text-main hover:bg-input-box"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Backend</span>
          </button>

          <button
            onClick={() => {
              setUseMockApi(true);
              setMessage("Switched to Local Demo Mock Data.");
              setTimeout(() => setMessage(null), 3000);
            }}
            className={`p-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              useMockApi
                ? "bg-primary text-white border-primary shadow-soft"
                : "bg-surface border-border text-main hover:bg-input-box"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Mock / Demo</span>
          </button>
        </div>
      </div>

      {/* Demo Controls & Data Management */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-soft space-y-3">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider">Demo & Testing</h2>

        <div className="space-y-2">
          <button
            onClick={openDemoMenu}
            className="w-full p-3 rounded-2xl bg-input-box border border-input-border text-primary text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Demo Controls (or hold wordmark &quot;gacha&quot;)</span>
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleResetData}
              className="p-2.5 rounded-xl border border-border bg-surface hover:bg-input-box text-xs font-semibold text-main flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
              <span>Reset 40 lotteries</span>
            </button>

            <button
              onClick={handleClearData}
              className="p-2.5 rounded-xl border border-border bg-surface hover:bg-input-box text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear local data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Responsible play pledge */}
      <div className="p-4 rounded-2xl bg-input-box/60 border border-input-border/60 space-y-1.5 text-center text-xs text-muted">
        <div className="flex items-center justify-center gap-1.5 font-bold text-main">
          <HeartHandshake className="w-4 h-4 text-primary" />
          <span>Independent Checker</span>
        </div>
        <p className="text-[11px] text-subtle leading-relaxed">
          gacha does not promote gambling or ticket purchases. Lotteries are games of pure chance governed by the Directorate of Kerala State Lotteries. Always confirm prizes with the official results.
        </p>
      </div>
    </div>
  );
}
