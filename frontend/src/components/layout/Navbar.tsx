import React, { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDemoStore } from "@/store/useDemoStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Sun, Moon, Sparkles, Settings as SettingsIcon, LogOut } from "lucide-react";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openDemoMenu } = useDemoStore();
  const { theme, setTheme, resolvedTheme } = useSettingsStore();
  const { session, logout } = useAuthStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = () => {
    setIsPressing(true);
    pressTimerRef.current = setTimeout(() => {
      openDemoMenu();
      setIsPressing(false);
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([40, 50, 40]);
      }
    }, 750);
  };

  const cancelLongPress = () => {
    setIsPressing(false);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const navItems = [
    { path: "/check", label: "Check" },
    { path: "/results", label: "Results" },
    { path: "/tickets", label: "My Lotteries" },
    { path: "/dashboard", label: "Dashboard" },
  ];

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-page/80 dark:bg-page/80 backdrop-blur-md border-b border-border transition-colors">
      <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Left: Lowercase text wordmark "gacha" only */}
        <div
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onMouseLeave={cancelLongPress}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          className="select-none cursor-pointer flex items-center"
          title="Hold to open demo controls"
        >
          <span
            className={`text-2xl font-bold tracking-tight text-main transition-transform ${
              isPressing ? "scale-95 opacity-70" : "hover:opacity-85"
            }`}
          >
            gacha
          </span>
        </div>

        {/* Centre: Tabs (desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-surface/60 dark:bg-surface/40 p-1 rounded-2xl hairline-border">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/check" && location.pathname.startsWith("/check"));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-4 py-1.5 rounded-xl text-[14px] font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-white shadow-soft"
                    : "text-muted hover:text-main hover:bg-surface"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Theme toggle + Avatar Menu */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-main hover:bg-surface/80 transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-4 h-4 text-gold-text" />
            ) : (
              <Moon className="w-4 h-4 text-muted" />
            )}
          </button>

          {/* Avatar & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-xl bg-input-box border border-input-border text-primary font-bold text-sm flex items-center justify-center hover:opacity-90 transition-all"
              aria-label="User menu"
            >
              {session?.user?.name ? session.user.name.charAt(0) : "U"}
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-12 w-48 bg-surface border border-border rounded-2xl shadow-elevated p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setMenuOpen(false)}
              >
                <div className="px-3 py-2 border-b border-border/60 mb-1">
                  <div className="text-sm font-semibold text-main truncate">
                    {session?.user?.name || "Guest"}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {session?.user?.email || "Signed in"}
                  </div>
                </div>

                <button
                  onClick={() => navigate("/settings")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-main hover:bg-input-box transition-colors text-left"
                >
                  <SettingsIcon className="w-4 h-4 text-muted" />
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => openDemoMenu()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gold-text hover:bg-gold-bg/30 transition-colors text-left"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Demo Controls</span>
                </button>

                <button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left mt-1 border-t border-border/60"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
