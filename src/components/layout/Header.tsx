"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, BarChart3, History, Settings, User, LogIn, Moon, Sun, Smartphone } from "lucide-react";
import { useDemoStore } from "@/store/useAppStore";
import { useThemeStore } from "@/store/useThemeStore";

interface HeaderProps {
  user?: { name: string; email: string; avatarUrl?: string } | null;
  onLoginClick?: () => void;
}

export function Header({ user, onLoginClick }: HeaderProps) {
  const pathname = usePathname();
  const { openDemoMenu } = useDemoStore();
  const { theme, setTheme, resolvedTheme } = useThemeStore();
  const [isPressing, setIsPressing] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = () => {
    setIsPressing(true);
    pressTimerRef.current = setTimeout(() => {
      openDemoMenu();
      setIsPressing(false);
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([40, 60, 40]);
      }
    }, 900); // 900ms hold to activate demo menu
  };

  const cancelLongPress = () => {
    setIsPressing(false);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const navLinks = [
    { href: "/", label: "Check", icon: Sparkles },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/history", label: "History", icon: History },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand / Logo with Long Press Handler */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none group relative"
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onMouseLeave={cancelLongPress}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          role="button"
          tabIndex={0}
          aria-label="Bhagya Kerala Lottery Checker (Hold to open Demo Menu)"
          title="Hold 1s for Demo Menu"
        >
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-md transition-all duration-300 ${
              isPressing
                ? "scale-90 bg-amber-500 shadow-amber-500/50"
                : "bg-gradient-to-tr from-emerald-600 to-teal-500 group-hover:shadow-emerald-500/30"
            }`}
          >
            <span className="text-xl">ക</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                Bhagya<span className="text-emerald-600 dark:text-emerald-400">Kerala</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                Mock
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">
              State Lottery Checker
            </p>
          </div>
          {isPressing && (
            <span className="absolute -bottom-7 left-0 text-[10px] font-medium bg-slate-900 text-white px-2 py-0.5 rounded shadow animate-pulse">
              Hold for demo...
            </span>
          )}
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Theme Quick Toggle */}
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* User profile / Login button */}
          {user ? (
            <Link
              href="/settings"
              className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-emerald-500/30 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                {user.name.charAt(0)}
              </div>
              <span className="text-xs font-medium max-w-[100px] truncate text-slate-800 dark:text-slate-200">
                {user.name.split(" ")[0]}
              </span>
            </Link>
          ) : (
            <button
              onClick={onLoginClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
