import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { BottomNav } from "./BottomNav";
import { DemoMenuModal } from "../demo/DemoMenuModal";
import { ToastContainer, ToastMessage } from "../common/Toast";
import { useSettingsStore } from "@/store/useSettingsStore";

export function AppShell() {
  const { initTheme, hasSeenSoundToast, markSoundToastSeen } = useSettingsStore();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const addToast = (toast: Omit<ToastMessage, "id">) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Expose global helper for trigger toasts
  useEffect(() => {
    (window as any).__triggerGachaToast = (toast: Omit<ToastMessage, "id">) => {
      addToast(toast);
    };
    return () => {
      delete (window as any).__triggerGachaToast;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col transition-colors">
      {/* Hidden Live Region for Screen Reader Announcements */}
      <div
        id="a11y-live-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <Navbar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 flex flex-col">
        <Outlet />
      </main>

      <BottomNav />

      <DemoMenuModal />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
