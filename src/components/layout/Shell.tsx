"use client";

import React, { useEffect, useState } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { DemoMenuModal } from "../demo/DemoMenuModal";
import { LoginModal } from "../auth/LoginModal";
import { useThemeStore } from "@/store/useThemeStore";
import { mockLotteryApi } from "@/lib/mockApi";
import { UserSession } from "@/types/lottery";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const { initTheme } = useThemeStore();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    initTheme();
    mockLotteryApi.getSession().then(setSession);
  }, [initTheme]);

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
  };

  const handleRefresh = async () => {
    const s = await mockLotteryApi.getSession();
    setSession(s);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#080d1a] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Hidden Live Region for Accessible Announcements */}
      <div
        id="a11y-live-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <Header
        user={session?.user}
        onLoginClick={() => setLoginModalOpen(true)}
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 flex flex-col">
        {children}
      </main>

      <BottomNav />

      <DemoMenuModal onRefreshData={handleRefresh} />

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}
